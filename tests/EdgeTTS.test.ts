import { describe, expect, it } from 'bun:test';
import { EdgeTTS } from '../src/services/EdgeTTS';

// The service answers text it cannot speak with a single empty chunk rather
// than an error, so the stream is not empty but the audio is. These build that
// state directly, which keeps the tests offline and deterministic.
function withStream(chunks: Uint8Array[]): EdgeTTS {
    const tts = new EdgeTTS();
    (tts as unknown as { audio_stream: Uint8Array[] }).audio_stream = chunks;
    return tts;
}

const EMPTY_CHUNK = [new Uint8Array(0)];
const REAL_AUDIO = [new Uint8Array([0xff, 0xfb, 0x90]), new Uint8Array([0x00, 0x01])];

describe('toBuffer', () => {
    it('throws when the stream carries no bytes', () => {
        expect(() => withStream(EMPTY_CHUNK).toBuffer()).toThrow();
    });

    it('explains that the voice may not match the text', () => {
        expect(() => withStream(EMPTY_CHUNK).toBuffer()).toThrow(/locale specific/);
    });

    it('still reports an unused instance separately', () => {
        expect(() => withStream([]).toBuffer()).toThrow(/Did you run synthesize/);
    });

    it('returns the audio when there are bytes', () => {
        const buffer = withStream(REAL_AUDIO).toBuffer();
        expect(buffer.length).toBe(5);
        expect([...buffer]).toEqual([0xff, 0xfb, 0x90, 0x00, 0x01]);
    });

    it('is not fooled by several empty chunks', () => {
        const many = [new Uint8Array(0), new Uint8Array(0), new Uint8Array(0)];
        expect(() => withStream(many).toBuffer()).toThrow(/locale specific/);
    });

    it('keeps audio that arrives after an empty chunk', () => {
        const mixed = [new Uint8Array(0), new Uint8Array([0x42])];
        expect(withStream(mixed).toBuffer().length).toBe(1);
    });
});

// These delegate to toBuffer, so they inherit the guard. Without it they
// returned an empty string and a duration of zero as though nothing was wrong.
describe('consumers of toBuffer', () => {
    it('toBase64 throws rather than returning an empty string', () => {
        expect(() => withStream(EMPTY_CHUNK).toBase64()).toThrow(/locale specific/);
    });

    it('getDuration throws rather than reporting zero', () => {
        expect(() => withStream(EMPTY_CHUNK).getDuration()).toThrow(/locale specific/);
    });

    it('getAudioInfo throws rather than reporting a size of zero', () => {
        expect(() => withStream(EMPTY_CHUNK).getAudioInfo()).toThrow(/locale specific/);
    });

    it('still works for real audio', () => {
        expect(withStream(REAL_AUDIO).toBase64().length).toBeGreaterThan(0);
        expect(withStream(REAL_AUDIO).getAudioInfo().size).toBe(5);
    });
});
