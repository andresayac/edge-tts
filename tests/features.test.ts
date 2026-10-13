import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EdgeTTS, EdgeTTSError, Constants, toSRT, toVTT } from '../src/index';
import { EdgeTTS as BrowserEdgeTTS } from '../src/browser/EdgeTTS.browser';
import { resetClock } from '../src/core/clock';
import { generateSecMsGec, sentenceTextRestorer } from '../src/core/protocol';
import { recordedAudio, startFakeService, type FakeService } from './helpers/fake-service';

const SRT = `1
00:00:00,050 --> 00:00:02,013
Hello, world.

2
00:00:02,013 --> 00:00:03,913
Is this a test?

3
00:00:03,913 --> 00:00:05,400
Yes!
`;

let service: FakeService;

afterEach(() => {
    service?.stop();
    resetClock();
});

function serve(options: Parameters<typeof startFakeService>[0] = {}) {
    service = startFakeService(options);
    return service;
}

describe('constructor options', () => {
    it('connects to wssUrl with the given version and headers', async () => {
        const { wssUrl, connections } = serve();
        const tts = new EdgeTTS({ wssUrl, secMsGecVersion: '1-999.0.0.0', headers: { 'X-Test': 'yes' } });
        await tts.synthesize('hi', 'en-US-AriaNeural');
        expect(connections[0].url.searchParams.get('Sec-MS-GEC-Version')).toBe('1-999.0.0.0');
        expect(connections[0].headers.get('x-test')).toBe('yes');
        expect(Constants.WSS_URL).not.toBe(wssUrl);
    });

    it('reads voices from voicesUrl and caches them', async () => {
        const { voicesUrl, voiceRequests } = serve({
            voices: { status: 200, body: [{ ShortName: 'en-US-AriaNeural', Locale: 'en-US', Gender: 'Female', FriendlyName: 'Microsoft Aria Online (Natural) - English (United States)' }] },
        });
        const tts = new EdgeTTS({ voicesUrl });
        const voices = await tts.getVoices();
        expect(voices[0]).toMatchObject({ ShortName: 'en-US-AriaNeural', DisplayName: 'Aria', Locale: 'en-US' });
        voices[0].ShortName = 'changed';
        expect((await tts.getVoicesByLanguage('en'))[0].ShortName).toBe('en-US-AriaNeural');
        expect((await tts.getVoicesByGender('Female')).length).toBe(1);
        expect(voiceRequests.length).toBe(1);
    });

    it('fetches voices every time when the cache is off', async () => {
        const { voicesUrl, voiceRequests } = serve({ voices: { status: 200, body: [] } });
        const tts = new EdgeTTS({ voicesUrl, voicesCacheTtl: 0 });
        await tts.getVoices();
        await tts.getVoices();
        expect(voiceRequests.length).toBe(2);
    });

    it('times out after the configured inactivity', async () => {
        const { wssUrl } = serve({ silent: true });
        const error = await new EdgeTTS({ wssUrl, timeout: 100 }).synthesize('hi', 'v').catch(e => e);
        expect(error).toBeInstanceOf(EdgeTTSError);
        expect(error.code).toBe('TIMEOUT');
        expect(error.message).toBe('WebSocket inactivity timeout - no response from server');
    });
});

describe('clock skew', () => {
    it('retries once with the server clock after a refused handshake', async () => {
        const offset = 20 * 60_000;
        const { wssUrl, connections } = serve({
            date: () => new Date(Date.now() + offset).toUTCString(),
            accept: async url => url.searchParams.get('Sec-MS-GEC') === await generateSecMsGec(Constants.TRUSTED_CLIENT_TOKEN, Date.now() + offset),
        });
        const tts = new EdgeTTS({ wssUrl });
        await tts.synthesize('hi', 'en-US-AriaNeural');
        expect(tts.toBuffer().length).toBe(736);
        expect(connections.length).toBe(1);
    });

    it('does not retry when the clock is already right', async () => {
        const { wssUrl } = serve({ handshakeStatus: 403 });
        const error = await new EdgeTTS({ wssUrl }).synthesize('hi', 'v').catch(e => e);
        expect(error).toBeInstanceOf(EdgeTTSError);
        expect(error.code).toBe('HANDSHAKE');
    });
});

describe('generate', () => {
    it('returns the audio, boundaries and duration without touching the instance', async () => {
        const { wssUrl } = serve();
        const tts = new EdgeTTS({ wssUrl });
        const result = await tts.generate('hi', 'en-US-AriaNeural');
        expect(Buffer.isBuffer(result.audio)).toBe(true);
        expect([...result.audio]).toEqual([...recordedAudio()]);
        expect(result.format).toBe('mp3');
        expect(result.outputFormat).toBe('audio-24khz-48kbitrate-mono-mp3');
        expect(result.wordBoundaries.length).toBe(7);
        expect(result.sentenceBoundaries.map(s => s.text)).toEqual(['Hello, world.', 'Is this a test?', 'Yes!']);
        expect(result.duration).toBeCloseTo(736 * 8 / 48000);
        expect(() => tts.toBuffer()).toThrow('Did you run synthesize() first?');
    });

    it('runs concurrently on one instance', async () => {
        const { wssUrl } = serve();
        const tts = new EdgeTTS({ wssUrl });
        const [a, b] = await Promise.all([tts.generate('a', 'v'), tts.generate('b', 'v')]);
        expect(a.audio.length).toBe(736);
        expect(b.audio.length).toBe(736);
        expect(a.wordBoundaries.length).toBe(7);
    });

    it('throws NO_AUDIO when the service sends no audio', async () => {
        const { wssUrl } = serve({ frames: [{ text: 'X-RequestId:1\r\nPath:turn.end\r\n\r\n{}' }] });
        const error = await new EdgeTTS({ wssUrl }).generate('hi', 'v').catch(e => e);
        expect(error.code).toBe('NO_AUDIO');
        expect(error.message).toContain('locale specific');
    });

    it('points at the output format when it is not a known one', async () => {
        const { wssUrl } = serve({ frames: [{ text: 'X-RequestId:1\r\nPath:turn.end\r\n\r\n{}' }] });
        const error = await new EdgeTTS({ wssUrl }).generate('hi', 'v', { outputFormat: 'riff-24khz-16bit-mono-pcm' }).catch(e => e);
        expect(error.message).toContain('locale specific');
        expect(error.message).toContain('"riff-24khz-16bit-mono-pcm" may also be the cause');
    });

    it('works in the browser class too', async () => {
        const { wssUrl } = serve();
        const result = await new BrowserEdgeTTS({ wssUrl }).generate('hi');
        expect(result.audio.length).toBe(736);
        expect(result.sentenceBoundaries.length).toBe(3);
    });
});

describe('subtitles', () => {
    it('writes one SRT cue per sentence', async () => {
        const { wssUrl } = serve();
        const tts = new EdgeTTS({ wssUrl });
        await tts.synthesize('hi', 'en-US-AriaNeural');
        expect(tts.toSRT()).toBe(SRT);
        expect(toSRT(tts.getSentenceBoundaries())).toBe(SRT);
    });

    it('writes WebVTT', async () => {
        const { wssUrl } = serve();
        const result = await new EdgeTTS({ wssUrl }).generate('hi', 'v');
        const vtt = toVTT(result.sentenceBoundaries);
        expect(vtt.startsWith('WEBVTT\n\n00:00:00.050 --> 00:00:02.013\nHello, world.\n')).toBe(true);
    });

    it('puts back the opening punctuation the service drops', () => {
        const restore = sentenceTextRestorer('¿Cómo estás? ¡Qué bien! Dijo: «hola». Normal.');
        expect(['Cómo estás?', 'Qué bien!', 'Dijo: «hola».', 'Normal.', 'not in source'].map(restore))
            .toEqual(['¿Cómo estás?', '¡Qué bien!', 'Dijo: «hola».', 'Normal.', 'not in source']);
    });

    it('formats hours', () => {
        expect(toSRT([{ offset: 0, duration: 36_000_000_000, text: 'long' }])).toBe('1\n00:00:00,000 --> 01:00:00,000\nlong\n');
    });
});

describe('abort', () => {
    it('rejects with the abort reason and closes the socket', async () => {
        const { wssUrl } = serve({ silent: true });
        const controller = new AbortController();
        const pending = new EdgeTTS({ wssUrl }).synthesize('hi', 'v', { signal: controller.signal });
        setTimeout(() => controller.abort(), 50);
        const error = await pending.catch(e => e);
        expect(error.name).toBe('AbortError');
    });

    it('rejects at once when the signal is already aborted', async () => {
        const { wssUrl, connections } = serve();
        const error = await new EdgeTTS({ wssUrl }).generate('hi', 'v', { signal: AbortSignal.abort() }).catch(e => e);
        expect(error.name).toBe('AbortError');
        expect(connections.length).toBe(0);
    });

    it('stops the stream when the consumer breaks out', async () => {
        const { wssUrl } = serve();
        const tts = new EdgeTTS({ wssUrl });
        for await (const _ of tts.synthesizeStream('hi', 'v')) break;
        await tts.synthesize('hi', 'v');
        expect(tts.toBuffer().length).toBe(736);
    });
});

describe('errors', () => {
    it('are EdgeTTSError with a code and the old message', async () => {
        const error = await new EdgeTTS().synthesize('hi', 'v', { pitch: 'loud' }).catch(e => e);
        expect(error).toBeInstanceOf(EdgeTTSError);
        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBe('INVALID_OPTION');
        expect(error.message).toStartWith('Invalid pitch format');
    });

    it('report the voice list status', async () => {
        const { voicesUrl } = serve({ voices: { status: 403, body: {} } });
        const error = await new EdgeTTS({ voicesUrl }).getVoices().catch(e => e);
        expect(error.code).toBe('VOICES');
        expect(error.status).toBe(403);
    });

    it('carry the reason the service gives for refusing', async () => {
        const { wssUrl } = serve({ close: { code: 1007, reason: 'Unsupported voice xx-XX-NobodyNeural.' } });
        for (const tts of [new EdgeTTS({ wssUrl }), new BrowserEdgeTTS({ wssUrl })]) {
            const error = await tts.synthesize('hi', 'xx-XX-NobodyNeural').catch(e => e);
            expect(error).toBeInstanceOf(EdgeTTSError);
            expect(error.code).toBe('REFUSED');
            expect(error.status).toBe(1007);
            expect(error.message).toBe('The service refused the request: Unsupported voice xx-XX-NobodyNeural.');
        }
    });

    it('reject an empty text without connecting', async () => {
        const { wssUrl, connections } = serve();
        for (const text of ['', '  \n\t ']) {
            const error = await new EdgeTTS({ wssUrl }).synthesize(text, 'en-US-AriaNeural').catch(e => e);
            expect(error.code).toBe('INVALID_OPTION');
            expect(error.message).toBe('The text is empty.');
        }
        expect(connections).toHaveLength(0);
    });
});

describe('toFile', () => {
    it('does not repeat an extension that is already there', async () => {
        const { wssUrl } = serve();
        const tmp = mkdtempSync(join(tmpdir(), 'edge-tts-'));
        try {
            const tts = new EdgeTTS({ wssUrl });
            await tts.synthesize('hi', 'v');
            expect(await tts.toFile(join(tmp, 'a.mp3'))).toBe(join(tmp, 'a.mp3'));
            expect(await tts.toFile(join(tmp, 'b.MP3'))).toBe(join(tmp, 'b.MP3'));
            expect(await tts.toFile(join(tmp, 'c'))).toBe(join(tmp, 'c.mp3'));
            expect(await tts.toFile(join(tmp, 'd.wav'))).toBe(join(tmp, 'd.wav.mp3'));
            expect(readFileSync(join(tmp, 'a.mp3')).length).toBe(736);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});
