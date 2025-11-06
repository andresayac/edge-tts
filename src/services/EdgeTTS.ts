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
    inputType?: 'auto' | 'ssml' | 'text'; // Nuevo campo
}

interface SSMLValidationResult {
    isValid: boolean;
    isSSML: boolean;
    errors?: string[];
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
    private word_boundaries: WordBoundary[] = [];
    private ws!: WebSocket;

    async getVoices(): Promise<Voice[]> {
        const secMsGEC = await this.generateSecMsGec(
            Constants.TRUSTED_CLIENT_TOKEN,
        )

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
        });

        const response = await new Promise<Response>((resolve, reject) => {
            const req = https.request(
                `${Constants.VOICES_URL}?Ocp-Apim-Subscription-Key=${Constants.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=${Constants.VERSION_MS_GEC}`,
                {
                    headers: Constants.getBaseHeaders(),
                    agent: httpsAgent
                },
                (res) => {
                    let data = '';
                    res.on('data', (chunk) => (data += chunk));
                    res.on('end', () => resolve(new Response(data, { status: res.statusCode || 200 })));
                }
            );
            req.on('error', reject);
            req.end();
        });

        const data = await response.json();
        return data.map((voice: any) => {
            voice.FriendlyName = voice.FriendlyName || voice.LocalName;
            delete voice.SampleRateHertz;
            delete voice.Status;
            return voice;
        });
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
            const url = `${Constants.WSS_URL}?Ocp-Apim-Subscription-Key=${Constants.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=${Constants.VERSION_MS_GEC}&ConnectionId=${reqId}`;

            this.ws = new WebSocket(url, {
                headers: Constants.getBaseHeaders(),
                rejectUnauthorized: false
            });

            const SSML_text = this.getSSML(text, voice, options);
            
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
                const message = this.buildTTSConfigMessage();
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

    private detectSSML(content: string): SSMLValidationResult {
        const trimmedContent = content.trim();

        const looksLikeSSML = /^<\?xml|^<speak/i.test(trimmedContent);

        if (!looksLikeSSML) {
            return { isValid: true, isSSML: false };
        }

        const errors: string[] = [];

        const hasSpeakTag = /<speak\b[^>]*>[\s\S]*<\/speak>/i.test(trimmedContent);
        const hasVoiceTag = /<voice\b[^>]*>[\s\S]*<\/voice>/i.test(trimmedContent);

        if (!hasSpeakTag) {
            throw new Error('Invalid SSML: Missing <speak> tag');
        }

        if (!hasVoiceTag) {
            throw new Error('Invalid SSML: Missing <voice> tag');
        }

        const hasCorrectNamespace = /xmlns="http:\/\/www\.w3\.org\/2001\/10\/synthesis"/i.test(trimmedContent);
        if (!hasCorrectNamespace && hasSpeakTag) {
            throw new Error('Invalid SSML: Missing or incorrect namespace declaration');
        }

        return {
            isValid: errors.length === 0,
            isSSML: hasSpeakTag || hasVoiceTag,
            errors: errors.length > 0 ? errors : undefined
        };
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
        const inputType = options.inputType || 'auto';
        let treatAsSSML = false;

        if (inputType === 'ssml') {
            treatAsSSML = true;
        } else if (inputType === 'text') {
            treatAsSSML = false;
        } else { // 'auto'
            const detection = this.detectSSML(content);
            treatAsSSML = detection.isSSML;

            if (detection.isSSML) {
                console.log('→ Detected SSML input');
                if (!detection.isValid) {
                    console.warn('⚠ SSML validation warnings:', detection.errors);
                }
            } else {
                console.log('→ Detected plain text input');
            }
        }

        if (treatAsSSML) {
            let ssml = content.trim();

            if (!ssml.includes('xmlns=')) {
                ssml = ssml.replace(
                    /<speak([^>]*)>/i,
                    '<speak$1 xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts">'
                );
            }

            if (!/<voice\b[^>]*>/i.test(ssml) && voice) {
                ssml = ssml.replace(
                    /(<speak[^>]*>)([\s\S]*?)(<\/speak>)/i,
                    `$1<voice name="${voice}">$2</voice>$3`
                );
            }

            return ssml;
        }

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


    private buildTTSConfigMessage(): string {
        const timestamp = this.nowRFC1123();
        return `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
            `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":true},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
    }


    async *synthesizeStream(text: string, voice: string = 'en-US-AnaNeural', options: SynthesisOptions = {}): AsyncGenerator<Uint8Array, void, unknown> {
        this.audio_stream = [];

        const reqId = this.generateUUID();
        const secMsGEC = await this.generateSecMsGec(
            Constants.TRUSTED_CLIENT_TOKEN,
        );

        const url = `${Constants.WSS_URL}?Ocp-Apim-Subscription-Key=${Constants.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=${Constants.VERSION_MS_GEC}&ConnectionId=${reqId}`;

        this.ws = new WebSocket(url, {
            headers: Constants.getBaseHeaders(),
            rejectUnauthorized: false
        });

        const SSML_text = this.getSSML(text, voice, options);

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
            const message = this.buildTTSConfigMessage();
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

    getAudioInfo(): { size: number; format: string; estimatedDuration: number } {
        const buffer = this.toBuffer();
        return {
            size: buffer.length,
            format: this.audio_format,
            estimatedDuration: this.getDuration()
        };
    }

    async toFile(outputPath: string, format = this.audio_format): Promise<string> {
        if (!format || typeof format !== 'string') format = this.audio_format;
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
