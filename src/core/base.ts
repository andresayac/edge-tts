import { Constants } from '../config/constants';
import { now } from './clock';
import { EdgeTTSError } from './errors';
import {
    buildConfigMessage,
    buildSSMLMessage,
    buildSynthesisUrl,
    concatChunks,
    DEFAULT_OUTPUT_FORMAT,
    estimateDuration,
    fileExtension,
    generateSecMsGec,
    generateUUID,
    normalizeVoices,
    sentenceTextRestorer,
} from './protocol';
import { abortReason, runSession, type SocketLike } from './session';
import { toSRT as formatSRT, toVTT as formatVTT } from './subtitles';
import type {
    EdgeTTSOptions,
    SentenceBoundary,
    SynthesisOptions,
    SynthesisResult,
    Voice,
    WordBoundary,
} from './types';

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_VOICES_CACHE_TTL = 10 * 60_000;

export const NO_AUDIO_MESSAGE =
    "The service returned no audio. Voices are locale specific, so a voice cannot " +
    "read text written in another script. Check that the voice matches the language " +
    "of the text.";

export function noAudioMessage(outputFormat: string): string {
    const supported: string[] = Object.values(Constants.OUTPUT_FORMAT);
    if (supported.includes(outputFormat)) return NO_AUDIO_MESSAGE;
    return `${NO_AUDIO_MESSAGE} The output format "${outputFormat}" may also be the cause: ` +
        `the service is known to support ${supported.join(', ')}.`;
}

type Boundary = WordBoundary | SentenceBoundary;

function collect(text: string, words: WordBoundary[], sentences: SentenceBoundary[]) {
    const restore = sentenceTextRestorer(text);
    return (boundary: Boundary) => {
        if (boundary.type === 'WordBoundary') words.push(boundary);
        else sentences.push({ ...boundary, text: restore(boundary.text) });
    };
}

export abstract class EdgeTTSCore {
    protected audio_stream: Uint8Array[] = [];
    protected output_format: string = DEFAULT_OUTPUT_FORMAT;
    protected word_boundaries: WordBoundary[] = [];
    protected sentence_boundaries: SentenceBoundary[] = [];
    protected readonly options: EdgeTTSOptions;
    private voicesCache?: { expires: number; voices: Voice[] };

    protected abstract readonly defaultVoice: string;

    constructor(options: EdgeTTSOptions = {}) {
        this.options = { ...options };
    }

    protected abstract openSocket(url: string): SocketLike;
    protected abstract requestVoices(url: string): Promise<any[]>;
    protected abstract buildSSML(text: string, voice: string, options: SynthesisOptions): string;
    protected abstract timestamp(): string;
    protected abstract socketError(event: unknown, opened: boolean): Error;

    protected async recoverHandshake(): Promise<boolean> {
        return false;
    }

    protected signature(): Promise<string> {
        return generateSecMsGec(Constants.TRUSTED_CLIENT_TOKEN, now());
    }

    async normalizeVoices(data: any[]): Promise<Voice[]> {
        return normalizeVoices(data);
    }

    async getVoices(): Promise<Voice[]> {
        if (this.voicesCache && this.voicesCache.expires > Date.now()) {
            return JSON.parse(JSON.stringify(this.voicesCache.voices));
        }

        const secMsGEC = await this.signature();
        const url =
            `${this.options.voicesUrl ?? Constants.VOICES_URL}` +
            `?TrustedClientToken=${Constants.TRUSTED_CLIENT_TOKEN}` +
            `&Sec-MS-GEC=${secMsGEC}` +
            `&Sec-MS-GEC-Version=${this.options.secMsGecVersion ?? Constants.VERSION_MS_GEC}`;

        const voices = await this.normalizeVoices(await this.requestVoices(url));

        const ttl = this.options.voicesCacheTtl ?? DEFAULT_VOICES_CACHE_TTL;
        if (ttl > 0) {
            this.voicesCache = { expires: Date.now() + ttl, voices: JSON.parse(JSON.stringify(voices)) };
        }
        return voices;
    }

    async getVoicesByLanguage(locale: string): Promise<Voice[]> {
        const voices = await this.getVoices();
        return voices.filter(voice => voice.Locale?.startsWith(locale));
    }

    async getVoicesByGender(gender: 'Male' | 'Female'): Promise<Voice[]> {
        const voices = await this.getVoices();
        return voices.filter(voice => voice.Gender === gender);
    }

    async synthesize(text: string, voice: string = this.defaultVoice, options: SynthesisOptions = {}): Promise<void> {
        const audio: Uint8Array[] = [];
        const words: WordBoundary[] = [];
        const sentences: SentenceBoundary[] = [];
        this.audio_stream = audio;
        this.word_boundaries = words;
        this.sentence_boundaries = sentences;
        this.output_format = options.outputFormat || DEFAULT_OUTPUT_FORMAT;

        await this.run(text, voice, options, chunk => audio.push(chunk), collect(text, words, sentences));
    }

    async *synthesizeStream(text: string, voice: string = this.defaultVoice, options: SynthesisOptions = {}): AsyncGenerator<Uint8Array, void, unknown> {
        const audio: Uint8Array[] = [];
        const words: WordBoundary[] = [];
        const sentences: SentenceBoundary[] = [];
        this.audio_stream = audio;
        this.word_boundaries = words;
        this.sentence_boundaries = sentences;
        this.output_format = options.outputFormat || DEFAULT_OUTPUT_FORMAT;

        const controller = new AbortController();
        const forwardAbort = () => controller.abort(abortReason(options.signal!));
        if (options.signal?.aborted) forwardAbort();
        else options.signal?.addEventListener('abort', forwardAbort, { once: true });

        const queue: Uint8Array[] = [];
        let wake: (() => void) | null = null;
        let done = false;
        let failure: unknown;
        const notify = () => {
            wake?.();
            wake = null;
        };

        this.run(text, voice, { ...options, signal: controller.signal }, chunk => {
            audio.push(chunk);
            queue.push(chunk);
            notify();
        }, collect(text, words, sentences)).then(
            () => { done = true; notify(); },
            error => { failure = error; done = true; notify(); },
        );

        try {
            while (!done || queue.length > 0) {
                if (queue.length === 0) {
                    await new Promise<void>(resolve => (wake = resolve));
                    continue;
                }
                yield queue.shift()!;
            }
            if (failure !== undefined) throw failure;
        } finally {
            options.signal?.removeEventListener('abort', forwardAbort);
            if (!done) controller.abort();
        }
    }

    async generate(text: string, voice: string = this.defaultVoice, options: SynthesisOptions = {}): Promise<SynthesisResult> {
        const chunks: Uint8Array[] = [];
        const words: WordBoundary[] = [];
        const sentences: SentenceBoundary[] = [];
        await this.run(text, voice, options, chunk => chunks.push(chunk), collect(text, words, sentences));

        const audio = concatChunks(chunks);
        const outputFormat = options.outputFormat || DEFAULT_OUTPUT_FORMAT;
        if (audio.length === 0) throw new EdgeTTSError(noAudioMessage(outputFormat), 'NO_AUDIO');

        return {
            audio,
            format: fileExtension(outputFormat),
            outputFormat,
            wordBoundaries: words,
            sentenceBoundaries: sentences,
            duration: estimateDuration(audio.length, outputFormat),
        };
    }

    getWordBoundaries(): WordBoundary[] {
        return this.word_boundaries;
    }

    getSentenceBoundaries(): SentenceBoundary[] {
        return this.sentence_boundaries;
    }

    toSRT(): string {
        return formatSRT(this.sentence_boundaries.length > 0 ? this.sentence_boundaries : this.word_boundaries);
    }

    toVTT(): string {
        return formatVTT(this.sentence_boundaries.length > 0 ? this.sentence_boundaries : this.word_boundaries);
    }

    private async run(
        text: string,
        voice: string,
        options: SynthesisOptions,
        onAudio: (chunk: Uint8Array) => void,
        onBoundary: (boundary: Boundary) => void,
    ): Promise<void> {
        if (text.trim() === '') throw new EdgeTTSError('The text is empty.', 'INVALID_OPTION');
        const ssml = this.buildSSML(text, voice, options);
        const outputFormat = options.outputFormat || DEFAULT_OUTPUT_FORMAT;

        const attempt = async () => {
            const requestId = generateUUID();
            const url = buildSynthesisUrl(
                this.options.wssUrl ?? Constants.WSS_URL,
                Constants.TRUSTED_CLIENT_TOKEN,
                await this.signature(),
                this.options.secMsGecVersion ?? Constants.VERSION_MS_GEC,
                requestId,
            );
            await runSession(() => this.openSocket(url), {
                configMessage: buildConfigMessage(this.timestamp(), outputFormat),
                ssmlMessage: buildSSMLMessage(requestId, this.timestamp(), ssml),
                timeout: options.timeout ?? this.options.timeout ?? DEFAULT_TIMEOUT,
                signal: options.signal,
                onAudio,
                onBoundary,
                toError: (event, opened) => this.socketError(event, opened),
            });
        };

        try {
            await attempt();
        } catch (error) {
            if (!(error instanceof EdgeTTSError && error.code === 'HANDSHAKE')) throw error;
            if (!(await this.recoverHandshake())) throw error;
            await attempt();
        }
    }
}
