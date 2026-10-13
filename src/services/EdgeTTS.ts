import WebSocket from 'ws';
import { Constants } from '../config/constants';
import { writeFile } from 'fs/promises';
import { Buffer } from 'buffer';
import http from 'http';
import https from 'https';
import { webcrypto } from 'crypto';
import { EdgeTTSCore, noAudioMessage } from '../core/base';
import { adjustClock, now } from '../core/clock';
import { setWebCrypto, type WebCrypto } from '../core/crypto';
import { EdgeTTSError } from '../core/errors';
import { buildSSML, estimateDuration, fileExtension, generateSecMsGec } from '../core/protocol';
import type { SocketLike } from '../core/session';
import type { EdgeTTSOptions, SynthesisOptions, SynthesisResult } from '../core/types';

export type { Voice, SynthesisOptions, WordBoundary } from '../core/types';

// NOTE: Node 18 has no global crypto.
if (!(globalThis as { crypto?: unknown }).crypto) setWebCrypto(webcrypto as unknown as WebCrypto);

export class EdgeTTS extends EdgeTTSCore {
    protected readonly defaultVoice = 'en-US-AnaNeural';
    private ws!: WebSocket;

    constructor(options: EdgeTTSOptions = {}) {
        super(options);
    }

    generateSecMsGec = async (trustedClientToken: string): Promise<string> => {
        return generateSecMsGec(trustedClientToken, now());
    }

    async generate(text: string, voice?: string, options?: SynthesisOptions): Promise<SynthesisResult & { audio: Buffer }> {
        const result = await super.generate(text, voice, options);
        return { ...result, audio: Buffer.from(result.audio.buffer, result.audio.byteOffset, result.audio.byteLength) };
    }

    protected openSocket(url: string): SocketLike {
        this.ws = new WebSocket(url, {
            headers: { ...Constants.getBaseHeaders(), ...Constants.WSS_HEADERS, ...this.options.headers }
        });
        return this.ws as unknown as SocketLike;
    }

    protected requestVoices(url: string): Promise<any[]> {
        const headers = {
            ...Constants.getBaseHeaders(),
            ...Constants.VOICE_HEADERS,
            ...this.options.headers,
            "Accept-Encoding": "identity", // evita gzip/br/zstd
        };
        const client = url.startsWith('http:') ? http : https;

        return new Promise<any[]>((resolve, reject) => {
            const req = client.request(
                url,
                { method: "GET", headers },
                (res) => {
                    const chunks: Buffer[] = [];

                    res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                    res.on("error", reject);

                    res.on("end", () => {
                        const body = Buffer.concat(chunks as Uint8Array[]).toString("utf8");

                        if (res.statusCode !== 200) {
                            reject(new EdgeTTSError(`Voice list request failed with status ${res.statusCode}`, 'VOICES', { status: res.statusCode }));
                            return;
                        }

                        try {
                            const parsed = JSON.parse(body);

                            // soporta array directo o { voices: [...] }
                            const voices = Array.isArray(parsed)
                                ? parsed
                                : (parsed.voices || parsed.Voices || []);

                            resolve(Array.isArray(voices) ? voices : []);
                        } catch (e: any) {
                            reject(new EdgeTTSError("Invalid voice list JSON: " + (e?.message || String(e)), 'VOICES', { cause: e }));
                        }
                    });
                }
            );

            req.on("error", reject);
            req.end();
        });
    }

    protected buildSSML(text: string, voice: string, options: SynthesisOptions): string {
        const pitch = this.validatePitch(options.pitch ?? 0);
        const rate = this.validateRate(options.rate ?? 0);
        const volume = this.validateVolume(options.volume ?? 0);
        return buildSSML(text, voice, pitch, rate, volume);
    }

    protected timestamp(): string {
        return this.nowRFC1123();
    }

    protected socketError(event: unknown, opened: boolean): Error {
        const { error, message } = event as { error?: unknown; message?: string };
        const cause = error instanceof Error ? error : new Error(message || 'WebSocket error');
        if (opened || (cause as { code?: unknown }).code !== undefined) return cause;

        const status = /Unexpected server response: (\d{3})/.exec(cause.message)?.[1];
        return new EdgeTTSError(cause.message, 'HANDSHAKE', { status: status ? Number(status) : undefined, cause });
    }

    protected async recoverHandshake(): Promise<boolean> {
        const serverTime = await this.serverTime();
        return serverTime !== undefined && adjustClock(serverTime);
    }

    private serverTime(): Promise<number | undefined> {
        const origin = new URL((this.options.wssUrl ?? Constants.WSS_URL).replace(/^ws/, 'http')).origin + '/';
        const client = origin.startsWith('http:') ? http : https;

        return new Promise(resolve => {
            const req = client.request(origin, { method: 'HEAD', timeout: 10_000 }, (res) => {
                res.resume();
                const date = Date.parse(res.headers.date ?? '');
                resolve(Number.isNaN(date) ? undefined : date);
            });
            req.on('timeout', () => req.destroy());
            req.on('error', () => resolve(undefined));
            req.end();
        });
    }

    private validatePitch(pitch: string | number): string {
        if (typeof pitch === 'number') {
            return (pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`);
        }
        if (!/^[+-]?\d{1,3}(?:\.\d+)?Hz$/.test(pitch)) {
            throw new EdgeTTSError("Invalid pitch format. Expected format: '-100Hz to +100Hz' or a number.", 'INVALID_OPTION');
        }
        return pitch;
    }

    private validateRate(rate: string | number): string {
        let rateValue: number;
        if (typeof rate === 'string') {
            rateValue = parseFloat(rate.replace('%', ''));
            if (isNaN(rateValue)) throw new EdgeTTSError("Invalid rate format.", 'INVALID_OPTION');
        } else {
            rateValue = rate;
        }

        if (rateValue >= 0) {
            return `+${rateValue}%`;
        }
        return `${rateValue}%`;
    }

    private validateVolume(volume: string | number): string {
        let volumeValue: number;
        if (typeof volume === 'string') {
            volumeValue = parseInt(volume.replace('%', ''), 10);
            if (isNaN(volumeValue)) throw new EdgeTTSError("Invalid volume format.", 'INVALID_OPTION');
        } else {
            volumeValue = volume;
        }

        if (volumeValue < -100 || volumeValue > 100) {
            throw new EdgeTTSError("Invalid volume. Expected a value from -100% to 100%.", 'INVALID_OPTION');
        }

        return `${volumeValue}%`;
    }

    private nowRFC1123(timeZone = 'UTC'): string {
        const now = new Date();

        const options: Intl.DateTimeFormatOptions = {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone,
            timeZoneName: 'short'
        };

        return now.toLocaleString('en-US', options);
    }

    getDuration(): number {
        if (this.audio_stream.length === 0) {
            throw new EdgeTTSError("No audio data available", 'NO_AUDIO');
        }
        return estimateDuration(this.toBuffer().length, this.output_format);
    }

    getAudioInfo(): { size: number; format: string; estimatedDuration: number } {
        const buffer = this.toBuffer();
        return {
            size: buffer.length,
            format: fileExtension(this.output_format),
            estimatedDuration: this.getDuration()
        };
    }

    async toFile(outputPath: string, format?: string): Promise<string> {
        if (!format) {
            format = fileExtension(this.output_format);
        }
        const audioBuffer = this.toBuffer();
        const finalPath = outputPath.toLowerCase().endsWith(`.${format.toLowerCase()}`)
            ? outputPath
            : `${outputPath}.${format}`;
        await writeFile(finalPath, new Uint8Array(audioBuffer));

        return finalPath;
    }

    toRaw(): string {
        return this.toBase64();
    }

    toBase64(): string {
        return this.toBuffer().toString('base64');
    }

    toBuffer(): Buffer {
        if (this.audio_stream.length === 0) {
            throw new EdgeTTSError("No audio data available. Did you run synthesize() first?", 'NO_AUDIO');
        }
        // When the service cannot speak the text it answers with a single empty
        // chunk, so the stream is not empty but the audio is. Checking the byte
        // count rather than the chunk count is what catches that.
        const buffer = Buffer.concat(this.audio_stream);
        if (buffer.length === 0) {
            throw new EdgeTTSError(noAudioMessage(this.output_format), 'NO_AUDIO');
        }
        return buffer;
    }

    async saveMetadata(outputPath: string): Promise<void> {
        if (this.word_boundaries.length === 0) {
            throw new Error("No metadata available to save.");
        }

        const json = JSON.stringify(this.word_boundaries, null, 4);

        await writeFile(outputPath, json);
    }
}
