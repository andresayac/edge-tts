import { webCrypto } from './crypto';
import type { SentenceBoundary, Voice, WordBoundary } from './types';

export const DEFAULT_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

const decoder = new TextDecoder();

export function buildSynthesisUrl(base: string, token: string, secMsGec: string, version: string, connectionId: string): string {
    return `${base}?Ocp-Apim-Subscription-Key=${token}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${version}&ConnectionId=${connectionId}`;
}

export function buildConfigMessage(timestamp: string, outputFormat: string): string {
    return `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":true,"wordBoundaryEnabled":true},"outputFormat":"${outputFormat}"}}}}`;
}

export function buildSSMLMessage(requestId: string, timestamp: string, ssml: string): string {
    return `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n${ssml}`;
}

export function escapeXML(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function buildSSML(text: string, voice: string, pitch: string, rate: string, volume: string): string {
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
                    <voice name="${voice}">
                        <prosody pitch="${pitch}" rate="${rate}" volume="${volume}">
                            ${escapeXML(text)}
                        </prosody>
                    </voice>
                </speak>`;
}

function headerPath(head: string): string {
    return /Path:([^\r\n]*)/i.exec(head)?.[1]?.trim() ?? '';
}

export function parseTextFrame(text: string): { path: string; body: string } {
    const split = text.indexOf('\r\n\r\n');
    if (split === -1) return { path: headerPath(text), body: '' };
    return { path: headerPath(text.slice(0, split)), body: text.slice(split + 4) };
}

export function parseBinaryFrame(data: Uint8Array): { path: string; body: Uint8Array } {
    if (data.length < 2) return { path: '', body: new Uint8Array(0) };
    const headerLength = (data[0] << 8) | data[1];
    return {
        path: headerPath(decoder.decode(data.subarray(2, 2 + headerLength))),
        body: data.slice(2 + headerLength),
    };
}

export function parseMetadata(body: string): (WordBoundary | SentenceBoundary)[] {
    let metadata: any;
    try {
        metadata = JSON.parse(body);
    } catch {
        return [];
    }
    if (!Array.isArray(metadata?.Metadata)) return [];

    const boundaries: (WordBoundary | SentenceBoundary)[] = [];
    for (const item of metadata.Metadata) {
        if (item?.Type !== 'WordBoundary' && item?.Type !== 'SentenceBoundary') continue;
        boundaries.push({
            type: item.Type,
            offset: item.Data.Offset,
            duration: item.Data.Duration,
            text: item.Data.text?.Text,
        });
    }
    return boundaries;
}

const OPENING_PUNCTUATION = '¿¡«"\'“‘([';

// NOTE: the service drops opening punctuation such as ¿ and ¡ from sentence text.
export function sentenceTextRestorer(source: string): (text: string) => string {
    let cursor = 0;
    return (text) => {
        const index = text ? source.indexOf(text, cursor) : -1;
        if (index === -1) return text;
        let start = index;
        while (start > cursor && OPENING_PUNCTUATION.includes(source[start - 1])) start--;
        cursor = index + text.length;
        return source.slice(start, cursor);
    };
}

export async function generateSecMsGec(trustedClientToken: string, nowMs: number): Promise<string> {
    const ticks = Math.floor(nowMs / 1000) + 11644473600;
    const rounded = ticks - (ticks % 300);
    const windowsTicks = rounded * 10_000_000;

    const data = new TextEncoder().encode(`${windowsTicks}${trustedClientToken}`);
    const hashBuffer = await webCrypto().subtle.digest('SHA-256', data);

    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-xxxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function fileExtension(format: string): string {
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

// NOTE: MP3 is CBR; formats without a bitrate (opus) assume 48 kbit/s.
export function estimateDuration(bytes: number, outputFormat: string): number {
    const kbps = Number(/(\d+)kbitrate/.exec(outputFormat)?.[1] ?? 48);
    return (bytes * 8) / (kbps * 1000);
}

export function concatChunks(chunks: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

export function normalizeVoices(data: any[]): Voice[] {
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
