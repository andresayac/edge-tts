import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdgeTTS } from '../src/services/EdgeTTS';
import { EdgeTTS as BrowserEdgeTTS } from '../src/browser/EdgeTTS.browser';
import { Constants } from '../src/config/constants';
import { recorded, recordedAudio, startFakeService, type FakeService } from './helpers/fake-service';

// NOTE: the 1.8.x public API; these must keep passing unchanged.

const WORDS = ['Hello', 'world', 'Is', 'this', 'a', 'test', 'Yes'];
const original = { wss: Constants.WSS_URL, voices: Constants.VOICES_URL };

let service: FakeService;
let tmp: string;

beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'edge-tts-'));
});

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function useService(options: Parameters<typeof startFakeService>[0] = {}) {
    service = startFakeService(options);
    Constants.WSS_URL = service.wssUrl;
}

afterEach(() => {
    service?.stop();
    Constants.WSS_URL = original.wss;
    Constants.VOICES_URL = original.voices;
});

describe('Node EdgeTTS', () => {
    it('synthesizes the audio of every binary frame', async () => {
        useService();
        const tts = new EdgeTTS();
        await tts.synthesize(recorded.text, 'en-US-AriaNeural');
        expect([...tts.toBuffer()]).toEqual([...recordedAudio()]);
    });

    it('collects the word boundaries', async () => {
        useService();
        const tts = new EdgeTTS();
        await tts.synthesize(recorded.text, 'en-US-AriaNeural');
        const words = tts.getWordBoundaries();
        expect(words.map(w => w.text)).toEqual(WORDS);
        expect(words[0]).toEqual({ type: 'WordBoundary', offset: 500000, duration: 4500000, text: 'Hello' });
    });

    it('connects with the token, the signature and Edge headers', async () => {
        useService();
        await new EdgeTTS().synthesize('hi', 'en-US-AriaNeural');
        const { url, headers } = service.connections[0];
        expect(url.searchParams.get('Ocp-Apim-Subscription-Key')).toBe(Constants.TRUSTED_CLIENT_TOKEN);
        expect(url.searchParams.get('Sec-MS-GEC')).toMatch(/^[0-9A-F]{64}$/);
        expect(url.searchParams.get('Sec-MS-GEC-Version')).toBe(Constants.VERSION_MS_GEC);
        expect(url.searchParams.get('ConnectionId')).toBeTruthy();
        expect(headers.get('user-agent')).toContain('Edg/');
    });

    it('sends the config, then the escaped SSML with the prosody', async () => {
        useService();
        await new EdgeTTS().synthesize('a < b & "c"', 'es-CO-SalomeNeural', { pitch: '+5Hz', rate: 10, volume: '-20%' });
        const [config, ssml] = service.connections[0].messages;
        expect(config).toContain('Path:speech.config');
        expect(config).toContain('"outputFormat":"audio-24khz-48kbitrate-mono-mp3"');
        expect(ssml).toContain('Path:ssml');
        expect(ssml).toContain('<voice name="es-CO-SalomeNeural">');
        expect(ssml).toContain('<prosody pitch="+5Hz" rate="+10%" volume="-20%">');
        expect(ssml).toContain('a &lt; b &amp; &quot;c&quot;');
    });

    it('passes the output format and names the file after it', async () => {
        useService();
        const tts = new EdgeTTS();
        await tts.synthesize('hi', 'en-US-AriaNeural', { outputFormat: 'webm-24khz-16bit-mono-opus' });
        expect(service.connections[0].messages[0]).toContain('"outputFormat":"webm-24khz-16bit-mono-opus"');
        const path = await tts.toFile(join(tmp, 'out'));
        expect(path).toBe(join(tmp, 'out') + '.webm');
        expect([...readFileSync(path)]).toEqual([...recordedAudio()]);
    });

    it('exports base64 and raw', async () => {
        useService();
        const tts = new EdgeTTS();
        await tts.synthesize('hi', 'en-US-AriaNeural');
        expect(tts.toBase64()).toBe(Buffer.from(recordedAudio()).toString('base64'));
        expect(tts.toRaw()).toBe(tts.toBase64());
        expect(tts.getAudioInfo()).toEqual({ size: 736, format: 'mp3', estimatedDuration: tts.getDuration() });
    });

    it('starts from scratch on every synthesis', async () => {
        useService();
        const tts = new EdgeTTS();
        await tts.synthesize('hi', 'en-US-AriaNeural');
        await tts.synthesize('hi', 'en-US-AriaNeural');
        expect(tts.toBuffer().length).toBe(736);
        expect(tts.getWordBoundaries().length).toBe(WORDS.length);
    });

    it('streams the same audio', async () => {
        useService();
        const tts = new EdgeTTS();
        const chunks: Uint8Array[] = [];
        for await (const chunk of tts.synthesizeStream('hi', 'en-US-AriaNeural')) chunks.push(chunk);
        expect([...Buffer.concat(chunks)]).toEqual([...recordedAudio()]);
        expect(tts.toBuffer().length).toBe(736);
        expect(tts.getWordBoundaries().map(w => w.text)).toEqual(WORDS);
    });

    it('rejects when the handshake is refused', async () => {
        useService({ handshakeStatus: 403 });
        await expect(new EdgeTTS().synthesize('hi', 'en-US-AriaNeural')).rejects.toThrow(/403|101/);
    });

    it('rejects an invalid pitch, rate or volume', async () => {
        useService();
        const tts = new EdgeTTS();
        await expect(tts.synthesize('hi', 'v', { pitch: 'loud' })).rejects.toThrow('Invalid pitch format');
        await expect(tts.synthesize('hi', 'v', { rate: 'fast' })).rejects.toThrow('Invalid rate format.');
        await expect(tts.synthesize('hi', 'v', { volume: '500%' })).rejects.toThrow('Invalid volume');
    });

    it('throws before any synthesis', () => {
        expect(() => new EdgeTTS().toBuffer()).toThrow('No audio data available. Did you run synthesize() first?');
    });
});

describe('browser EdgeTTS', () => {
    it('synthesizes the audio of every binary frame', async () => {
        useService();
        const tts = new BrowserEdgeTTS();
        await tts.synthesize(recorded.text, 'en-US-AriaNeural');
        expect([...tts.getAudioData()]).toEqual([...recordedAudio()]);
    });

    it('streams the same audio', async () => {
        useService();
        const chunks: Uint8Array[] = [];
        for await (const chunk of new BrowserEdgeTTS().synthesizeStream('hi', 'en-US-AriaNeural')) chunks.push(chunk);
        expect([...Buffer.concat(chunks)]).toEqual([...recordedAudio()]);
    });

    it('rejects with "WebSocket error" when the handshake is refused', async () => {
        useService({ handshakeStatus: 403 });
        await expect(new BrowserEdgeTTS().synthesize('hi', 'en-US-AriaNeural')).rejects.toThrow('WebSocket error');
    });

    it('sends the prosody it is given without validating it', async () => {
        useService();
        await new BrowserEdgeTTS().synthesize('hi', 'en-US-AriaNeural', { pitch: 'x-high' });
        expect(service.connections[0].messages[1]).toContain('pitch="x-high"');
    });
});
