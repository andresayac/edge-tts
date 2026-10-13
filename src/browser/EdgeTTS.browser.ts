import { Constants } from '../config/constants';
import { EdgeTTSCore, noAudioMessage } from '../core/base';
import { EdgeTTSError } from '../core/errors';
import { buildSSML, concatChunks } from '../core/protocol';
import type { SocketLike } from '../core/session';
import type { EdgeTTSOptions, SynthesisOptions } from '../core/types';

export type { Voice, SynthesisOptions, WordBoundary, SentenceBoundary, EdgeTTSOptions, SynthesisResult } from '../core/types';
export { EdgeTTSError, type EdgeTTSErrorCode } from '../core/errors';
export { toSRT, toVTT } from '../core/subtitles';

export class EdgeTTS extends EdgeTTSCore {
    protected readonly defaultVoice = 'en-US-JennyNeural';
    private ws?: WebSocket;

    constructor(options: EdgeTTSOptions = {}) {
        super(options);
    }

    protected openSocket(url: string): SocketLike {
        this.ws = new WebSocket(url);
        return this.ws as unknown as SocketLike;
    }

    protected async requestVoices(url: string): Promise<any[]> {
        const response = await fetch(url, { headers: Constants.getBaseHeaders() });
        if (!response.ok) {
            throw new EdgeTTSError(`Voice list request failed with status ${response.status}`, 'VOICES', { status: response.status });
        }
        const data = await response.json();
        // The readaloud endpoint returns a bare array, not { voices: [...] }.
        return Array.isArray(data) ? data : (data?.voices || []);
    }

    protected buildSSML(text: string, voice: string, options: SynthesisOptions): string {
        const pitch = this.validatePitch(options.pitch ?? 0);
        const rate = this.validateRate(options.rate ?? 0);
        const volume = this.validateVolume(options.volume ?? 0);
        return buildSSML(text, voice, pitch, rate, volume);
    }

    protected timestamp(): string {
        return new Date().toUTCString();
    }

    protected socketError(_event: unknown, opened: boolean): Error {
        return new EdgeTTSError('WebSocket error', opened ? 'NETWORK' : 'HANDSHAKE');
    }

    private validatePitch(pitch: string | number): string {
        if (typeof pitch === 'number') {
            return (pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`);
        }
        return pitch;
    }

    private validateRate(rate: string | number): string {
        let rateValue: number;
        if (typeof rate === 'string') {
            rateValue = parseFloat(rate.replace('%', ''));
        } else {
            rateValue = rate;
        }
        return rateValue >= 0 ? `+${rateValue}%` : `${rateValue}%`;
    }

    private validateVolume(volume: string | number): string {
        let volumeValue: number;
        if (typeof volume === 'string') {
            volumeValue = parseInt(volume.replace('%', ''), 10);
        } else {
            volumeValue = volume;
        }
        return `${volumeValue}%`;
    }

    getAudioData(): Uint8Array {
        if (this.audio_stream.length === 0) {
            throw new EdgeTTSError("No audio data available", 'NO_AUDIO');
        }
        // When the service cannot speak the text it answers with a single empty
        // chunk, so the stream is not empty but the audio is. Checking the byte
        // count rather than the chunk count is what catches that.
        const result = concatChunks(this.audio_stream);
        if (result.length === 0) {
            throw new EdgeTTSError(noAudioMessage(this.output_format), 'NO_AUDIO');
        }
        return result;
    }
}
