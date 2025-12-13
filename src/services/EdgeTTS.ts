import WebSocket, { type RawData } from 'ws';
import { Constants } from '../config/constants';
import { writeFile } from 'fs/promises';
import { Buffer } from 'buffer';
import https from 'https';

export interface Voice {
    Name: string;
    ShortName: string;
    Gender: string;
    Locale: string;
    FriendlyName: string;
    LocalName: string;
}

export interface SynthesisOptions {
    pitch?: string | number;
    rate?: string | number;
    volume?: string | number;
    outputFormat?: string;
}

export interface WordBoundary {
    type: "WordBoundary";
    offset: number;
    duration: number;
    text: string;
}

function ensureBuffer(data: RawData): Buffer {
    if (Buffer.isBuffer(data)) {
        return data;
    }
    if (data instanceof ArrayBuffer) {
        return Buffer.from(data);
    }
    if (Array.isArray(data)) {
        return Buffer.concat(data as unknown as Uint8Array[]);
    }
    if (typeof data === 'string') {
        return Buffer.from(data, 'utf-8');
    }
    throw new Error(`Unsupported RawData type: ${typeof data}`);
}

export class EdgeTTS {
    private audio_stream: Uint8Array[] = [];
    private audio_format: string = 'mp3';
    private output_format: string = 'audio-24khz-48kbitrate-mono-mp3';
    private word_boundaries: WordBoundary[] = [];
    private ws!: WebSocket;

    async normalizeVoices(data: any[]): Promise<Voice[]> {
        const out = [];
        for (const v of data || []) {
            const short = v?.ShortName || "";
            const locale = v?.Locale || "";

            // base: remove locale prefix and Neural/NeuralHD suffix
            let base = short.replace(/^[a-z]{2}-[A-Z]{2}-/, "");
            base = base.replace(/NeuralHD$/, "").replace(/Neural$/, "").trim();

            // VoiceType: if NeuralHD/Neural in Name or ShortName
            const mix = `${v?.Name || ""} ${short}`;
            const voiceType =
                v?.VoiceType || (/NeuralHD/i.test(mix) ? "NeuralHD" : "Neural");

            // LocaleName: prefer LocaleName -> LanguageName -> locale
            const localeName = v?.LocaleName || (locale || null);

            // DisplayName: prefer DisplayName -> FriendlyName -> base -> short
            let display = v?.DisplayName || v?.FriendlyName || base || short;
            display = display.replace(/^Microsoft\s+/i, "");
            display = display.split(" - ")[0].trim();

            display = display.replace(/\s*Online\s*\(Natural\)\s*/i, " ");
            display = display.replace(/\s*Online\s*/i, " ");
            display = display.replace(/\s+/g, " ").trim();

            // VoiceTag parsing
            const tag = (v?.VoiceTag && typeof v.VoiceTag === "object") ? v.VoiceTag : {};
            const tailored = Array.isArray(tag.TailoredScenarios)
                ? tag.TailoredScenarios
                : (Array.isArray(tag.ContentCategories) ? tag.ContentCategories : []);
            const personalities = Array.isArray(tag.VoicePersonalities)
                ? tag.VoicePersonalities
                : [];

            out.push({
                Name: short || (v?.Name || ""),
                DisplayName: display,
                LocalName: display,
                ShortName: short || (v?.Name || ""),
                Gender: v?.Gender ?? null,
                Locale: locale || null,
                LocaleName: localeName,
                SecondaryLocaleList: Array.isArray(v?.SecondaryLocaleList) ? v.SecondaryLocaleList : [],
                VoiceType: voiceType,
                VoiceTag: {
                    TailoredScenarios: tailored,
                    VoicePersonalities: personalities,
                },
                FriendlyName: `${display} (${voiceType}) - ${localeName}`,
            });
        }

        return out;
    }


    async getVoices(): Promise<Voice[]> {
        const secMsGEC = await this.generateSecMsGec(Constants.TRUSTED_CLIENT_TOKEN);

        const httpsAgent = new https.Agent({ rejectUnauthorized: false });

        const url =
            `${Constants.VOICES_URL}` +
            `?TrustedClientToken=${Constants.TRUSTED_CLIENT_TOKEN}` +
            `&Sec-MS-GEC=${secMsGEC}` +
            `&Sec-MS-GEC-Version=${Constants.VERSION_MS_GEC}`;

        const headers = {
            ...Constants.getBaseHeaders(),
            "Accept-Encoding": "identity", // evita gzip/br/zstd
        };

        const voicesRaw = await new Promise<any[]>((resolve, reject) => {
            const req = https.request(
                url,
                { method: "GET", headers, agent: httpsAgent },
                (res) => {
                    const chunks: Buffer[] = [];

                    res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                    res.on("error", reject);

                    res.on("end", () => {
                        const body = Buffer.concat(chunks as Uint8Array[]).toString("utf8");

                        try {
                            const parsed = JSON.parse(body);

                            // soporta array directo o { voices: [...] }
                            const voices = Array.isArray(parsed)
                                ? parsed
                                : (parsed.voices || parsed.Voices || []);

                            resolve(Array.isArray(voices) ? voices : []);
                        } catch (e: any) {
                            reject(new Error("JSON inválido: " + (e?.message || String(e))));
                        }
                    });
                }
            );

            req.on("error", reject);
            req.end();
        });

        return this.normalizeVoices(voicesRaw);
    }


    async getVoicesByLanguage(locale: string): Promise<Voice[]> {
        const voices = await this.getVoices();
        return voices.filter(voice => voice.Locale.startsWith(locale));
    }

    async getVoicesByGender(gender: 'Male' | 'Female'): Promise<Voice[]> {
        const voices = await this.getVoices();
        return voices.filter(voice => voice.Gender === gender);
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-xxxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private validatePitch(pitch: string | number): string {
        if (typeof pitch === 'number') {
            return (pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`);
        }
        if (!/^[+-]?\d{1,3}(?:\.\d+)?Hz$/.test(pitch)) {
            throw new Error("Invalid pitch format. Expected format: '-100Hz to +100Hz' or a number.");
        }
        return pitch;
    }

    private validateRate(rate: string | number): string {
        let rateValue: number;
        if (typeof rate === 'string') {
            rateValue = parseFloat(rate.replace('%', ''));
            if (isNaN(rateValue)) throw new Error("Invalid rate format.");
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
            if (isNaN(volumeValue)) throw new Error("Invalid volume format.");
        } else {
            volumeValue = volume;
        }

        if (volumeValue < -100 || volumeValue > 100) {
            throw new Error("Volume cannot be negative. Expected a value from -100% to 100% (or more).");
        }

        return `${volumeValue}%`;
    }
    async synthesize(text: string, voice: string = 'en-US-AnaNeural', options: SynthesisOptions = {}): Promise<void> {
        const secMsGEC = await this.generateSecMsGec(
            Constants.TRUSTED_CLIENT_TOKEN,
        )

        return new Promise((resolve, reject) => {
            this.audio_stream = [];
            const reqId = this.generateUUID();
            const url = `${Constants.WSS_URL}?TrustedClientToken=${Constants.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=${Constants.VERSION_MS_GEC}&ConnectionId=${reqId}`;

            this.ws = new WebSocket(url, {
                headers: Constants.getBaseHeaders(),
                rejectUnauthorized: false
            });

            const SSML_text = this.getSSML(text, voice, options);
            const outputFormat = options.outputFormat || 'audio-24khz-48kbitrate-mono-mp3';
            this.output_format = outputFormat;

            let timedOut = false;
            let inactivityTimeout: ReturnType<typeof setTimeout>;

            const resetInactivityTimeout = () => {
                clearTimeout(inactivityTimeout);
                inactivityTimeout = setTimeout(() => {
                    timedOut = true;
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.close();
                    }
                    reject(new Error("WebSocket inactivity timeout - no response from server"));
                }, 30000); // 30 seconds of inactivity
            };

            this.ws.on('open', () => {
                resetInactivityTimeout(); // start the inactivity timeout
                const message = this.buildTTSConfigMessage(outputFormat);
                this.ws.send(message);
                const timestamp = this.nowRFC1123();
                const speechMessage = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n${SSML_text}`;
                this.ws.send(speechMessage);
            });

            this.ws.on('message', (data: RawData) => {
                resetInactivityTimeout(); // restart inactivity timeout
                this.processAudioData(data);
            });

            this.ws.on('error', (err: any) => {
                clearTimeout(inactivityTimeout);
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                }
                reject(err);
            });

            this.ws.on('close', () => {
                clearTimeout(inactivityTimeout);
                if (!timedOut) {
                    resolve();
                }
            });
        });
    }

    private escapeXML(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    private getSSML(content: string, voice: string, options: SynthesisOptions = {}): string {
        const pitch = this.validatePitch(options.pitch ?? 0);
        const rate = this.validateRate(options.rate ?? 0);
        const volume = this.validateVolume(options.volume ?? 0);

        const escapedText = this.escapeXML(content);

        return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
                    <voice name="${voice}">
                        <prosody pitch="${pitch}" rate="${rate}" volume="${volume}">
                            ${escapedText}
                        </prosody>
                    </voice>
                </speak>
        `;
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

    private parseRFC1123(rfcStr: string): Date {
        return new Date(rfcStr);
    }


    private buildTTSConfigMessage(outputFormat: string = 'audio-24khz-48kbitrate-mono-mp3'): string {
        const timestamp = this.nowRFC1123();
        return `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
            `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":true},"outputFormat":"${outputFormat}"}}}}`;
    }


    async *synthesizeStream(text: string, voice: string = 'en-US-AnaNeural', options: SynthesisOptions = {}): AsyncGenerator<Uint8Array, void, unknown> {
        this.audio_stream = [];

        const reqId = this.generateUUID();
        const secMsGEC = await this.generateSecMsGec(
            Constants.TRUSTED_CLIENT_TOKEN,
        );

        const url = `${Constants.WSS_URL}?TrustedClientToken=${Constants.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=${Constants.VERSION_MS_GEC}&ConnectionId=${reqId}`;

        this.ws = new WebSocket(url, {
            headers: Constants.getBaseHeaders(),
            rejectUnauthorized: false
        });

        const SSML_text = this.getSSML(text, voice, options);
        const outputFormat = options.outputFormat || 'audio-24khz-48kbitrate-mono-mp3';
        this.output_format = outputFormat;

        const queue: Uint8Array[] = [];
        let done = false;
        let error: Error | null = null;
        let notify: (() => void) | null = null;

        const push = (chunk: Uint8Array) => {
            queue.push(chunk);
            if (notify) {
                notify();
                notify = null;
            }
        };

        let timedOut = false;
        let inactivityTimeout: ReturnType<typeof setTimeout>;

        const resetInactivityTimeout = () => {
            clearTimeout(inactivityTimeout);
            inactivityTimeout = setTimeout(() => {
                timedOut = true;
                error = new Error("WebSocket inactivity timeout - no response from server");
                done = true;
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                }
                if (notify) {
                    notify();
                    notify = null;
                }
            }, 30000); // 30 seconds of inactivity
        };

        this.ws.on('open', () => {
            resetInactivityTimeout(); // start the inactivity timeout
            const message = this.buildTTSConfigMessage(outputFormat);
            this.ws.send(message);

            const timestamp = this.nowRFC1123();
            const speechMessage = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n${SSML_text}`;
            this.ws.send(speechMessage);
        });

        this.ws.on('message', (data: RawData) => {
            resetInactivityTimeout(); // restart inactivity timeout
            const buffer = ensureBuffer(data);
            const needle = Buffer.from('Path:audio\r\n');

            const audioStartIndex = buffer.indexOf(new Uint8Array(needle));

            if (audioStartIndex !== -1) {
                const audioChunk = buffer.subarray(audioStartIndex + needle.length);
                const chunk = new Uint8Array(audioChunk);
                this.audio_stream.push(chunk);
                push(chunk);
            }

            if (buffer.toString().includes("Path:audio.metadata")) {
                const metadataStart = buffer.indexOf("\r\n\r\n") + 4;
                const metadataJson = buffer.toString().substring(metadataStart);
                const meta = this.parseMetadata(metadataJson);
                if (meta !== null) {
                    this.word_boundaries.push(meta);
                }
                return;
            }

            if (buffer.toString().includes('Path:turn.end')) {
                this.ws?.close();
            }
        });

        this.ws.on('error', (err: any) => {
            clearTimeout(inactivityTimeout);
            error = err;
            done = true;
            if (notify) {
                notify();
                notify = null;
            }
        });

        this.ws.on('close', () => {
            clearTimeout(inactivityTimeout);
            done = true;
            if (notify) {
                notify();
                notify = null;
            }
        });

        while (!done || queue.length > 0) {
            if (queue.length === 0) {
                await new Promise<void>(resolve => (notify = resolve));
                continue;
            }
            const chunk = queue.shift();
            if (chunk) {
                yield chunk;
            }
        }

        if (error) {
            throw error;
        }
    }

    private processAudioData(data: RawData): void {
        const buffer = ensureBuffer(data);
        const needle = Buffer.from("Path:audio\r\n");

        const audioStartIndex = buffer.indexOf(new Uint8Array(needle));

        if (audioStartIndex !== -1) {
            const audioChunk = buffer.subarray(audioStartIndex + needle.length);
            this.audio_stream.push(new Uint8Array(audioChunk));
        }

        if (buffer.toString().includes("Path:audio.metadata")) {
            const metadataStart = buffer.indexOf("\r\n\r\n") + 4;
            const metadataJson = buffer.toString().substring(metadataStart);
            const meta = this.parseMetadata(metadataJson);
            if (meta !== null) {
                this.word_boundaries.push(meta);
            }
            return;
        }

        if (buffer.toString().includes("Path:turn.end")) {
            this.ws?.close();
        }
    }

    private parseMetadata(data: string, offsetCompensation: number = 0): WordBoundary | null {
        let metadata;

        try {
            metadata = JSON.parse(data);
        } catch {
            return null;
        }

        if (!metadata.Metadata) {
            return null;
        }

        for (const metaObj of metadata.Metadata) {
            if (metaObj.Type === "WordBoundary") {
                const currentOffset = metaObj.Data.Offset + offsetCompensation;
                const currentDuration = metaObj.Data.Duration;

                return {
                    type: "WordBoundary",
                    offset: currentOffset,
                    duration: currentDuration,
                    text: metaObj.Data.text?.Text,
                };
            }
        }

        return null;
    }

    generateSecMsGec = async (trustedClientToken: string): Promise<string> => {
        const now = this.nowRFC1123();

        const fixedDate = this.parseRFC1123(now);

        const ticks = Math.floor(fixedDate.getTime() / 1000) + 11644473600;
        const rounded = ticks - (ticks % 300);
        const windowsTicks = rounded * 10_000_000;

        const encoder = new TextEncoder()
        const data = encoder.encode(`${windowsTicks}${trustedClientToken}`)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)

        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase()
    }

    getDuration(): number {
        if (this.audio_stream.length === 0) {
            throw new Error("No audio data available");
        }
        // Estimate duration based on the size of the audio stream
        const bufferSize = this.toBuffer().length;
        const estimatedDuration = bufferSize / (24000 * 3); // 24000 Hz sample rate, 3 bytes per sample (16-bit stereo)
        return estimatedDuration;
    }

    private getFileExtension(format: string): string {
        if (format.includes('mp3')) return 'mp3';
        if (format.includes('opus') && format.includes('webm')) return 'webm';
        if (format.includes('opus') && format.includes('ogg')) return 'ogg';
        if (format.includes('wav') || format.includes('riff')) return 'wav';
        if (format.includes('pcm') && format.includes('raw')) return 'pcm';
        if (format.includes('alaw')) return 'alaw';
        if (format.includes('mulaw')) return 'mulaw';
        if (format.includes('truesilk')) return 'silk';
        if (format.includes('g722')) return 'g722';
        if (format.includes('amr')) return 'amr';
        return 'audio';
    }

    getAudioInfo(): { size: number; format: string; estimatedDuration: number } {
        const buffer = this.toBuffer();
        return {
            size: buffer.length,
            format: this.getFileExtension(this.output_format),
            estimatedDuration: this.getDuration()
        };
    }

    async toFile(outputPath: string, format?: string): Promise<string> {
        if (!format) {
            format = this.getFileExtension(this.output_format);
        }
        const audioBuffer = this.toBuffer();
        const finalPath = `${outputPath}.${format}`;
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
            throw new Error("No audio data available. Did you run synthesize() first?");
        }
        return Buffer.concat(this.audio_stream);
    }

    async saveMetadata(outputPath: string): Promise<void> {
        if (this.word_boundaries.length === 0) {
            throw new Error("No metadata available to save.");
        }

        const json = JSON.stringify(this.word_boundaries, null, 4);

        await writeFile(outputPath, json);
    }

    getWordBoundaries(): WordBoundary[] {
        return this.word_boundaries;
    }
}
