import { Constants } from '../config/constants';

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
}

export class EdgeTTS {
    private audio_stream: Uint8Array[] = [];
    private ws?: WebSocket;

    async getVoices(): Promise<Voice[]> {
        const secMsGEC = await this.generateSecMsGec(Constants.TRUSTED_CLIENT_TOKEN);
        
        const response = await fetch(
            `${Constants.VOICES_URL}?Ocp-Apim-Subscription-Key=${Constants.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=${Constants.VERSION_MS_GEC}`,
            { headers: Constants.getBaseHeaders() }
        );
        
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

    private getSSML(text: string, voice: string, options: SynthesisOptions = {}): string {
        const pitch = this.validatePitch(options.pitch ?? 0);
        const rate = this.validateRate(options.rate ?? 0);
        const volume = this.validateVolume(options.volume ?? 0);

        return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
                    <voice name="${voice}">
                        <prosody pitch="${pitch}" rate="${rate}" volume="${volume}">
                            ${text}
                        </prosody>
                    </voice>
                </speak>`;
    }

    private nowRFC1123(): string {
        return new Date().toUTCString();
    }

    private parseRFC1123(rfcStr: string): Date {
        return new Date(rfcStr);
    }

    private buildTTSConfigMessage(): string {
        const timestamp = this.nowRFC1123();
        return `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
            `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":true},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
    }

    async synthesize(text: string, voice: string = 'en-US-JennyNeural', options: SynthesisOptions = {}): Promise<void> {
        const secMsGEC = await this.generateSecMsGec(Constants.TRUSTED_CLIENT_TOKEN);

        return new Promise((resolve, reject) => {
            this.audio_stream = [];
            const reqId = this.generateUUID();
            const url = `${Constants.WSS_URL}?Ocp-Apim-Subscription-Key=${Constants.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=${Constants.VERSION_MS_GEC}&ConnectionId=${reqId}`;
            
            console.log('WebSocket URL:', url);
            this.ws = new WebSocket(url);

            const SSML_text = this.getSSML(text, voice, options);
            
            const timeout = setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                }
                reject(new Error("Synthesis timeout"));
            }, 30000);

            this.ws.onopen = () => {
                const message = this.buildTTSConfigMessage();
                this.ws!.send(message);
                const timestamp = this.nowRFC1123();
                const speechMessage = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n${SSML_text}`;
                this.ws!.send(speechMessage);
            };

            this.ws.onmessage = (event) => {
                if (typeof event.data === 'string') {
                    if (event.data.includes('Path:turn.end')) {
                        this.ws?.close();
                    }
                } else {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const arrayBuffer = reader.result as ArrayBuffer;
                        const uint8Array = new Uint8Array(arrayBuffer);
                        this.processAudioData(uint8Array);
                    };
                    reader.readAsArrayBuffer(event.data);
                }
            };

            this.ws.onerror = (err: any) => {
                clearTimeout(timeout);
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                }
                reject(new Error('WebSocket error'));
            };

            this.ws.onclose = () => {
                clearTimeout(timeout);
                resolve();
            };
        });
    }

    private processAudioData(buffer: Uint8Array): void {
        const needle = new TextEncoder().encode("Path:audio\r\n");
        const audioStartIndex = this.indexOf(buffer, needle);

        if (audioStartIndex !== -1) {
            const audioChunk = buffer.slice(audioStartIndex + needle.length);
            this.audio_stream.push(audioChunk);
        }
    }

    private indexOf(arr: Uint8Array, subarr: Uint8Array): number {
        for (let i = 0; i <= arr.length - subarr.length; i++) {
            let match = true;
            for (let j = 0; j < subarr.length; j++) {
                if (arr[i + j] !== subarr[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
    }

    private async generateSecMsGec(trustedClientToken: string): Promise<string> {
        const now = this.nowRFC1123();
        const fixedDate = this.parseRFC1123(now);
        const ticks = Math.floor(fixedDate.getTime() / 1000) + 11644473600;
        const rounded = ticks - (ticks % 300);
        const windowsTicks = rounded * 10_000_000;

        const encoder = new TextEncoder();
        const data = encoder.encode(`${windowsTicks}${trustedClientToken}`);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);

        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    }

    getAudioData(): Uint8Array {
        if (this.audio_stream.length === 0) {
            throw new Error("No audio data available");
        }
        const totalLength = this.audio_stream.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of this.audio_stream) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    }
}
