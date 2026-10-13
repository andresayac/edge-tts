import { EdgeTTSError } from './errors';
import { parseBinaryFrame, parseMetadata, parseTextFrame } from './protocol';
import type { SentenceBoundary, WordBoundary } from './types';

export interface SocketLike {
    binaryType: string;
    readonly readyState: number;
    onopen: ((event: any) => void) | null;
    onmessage: ((event: { data: unknown }) => void) | null;
    onerror: ((event: any) => void) | null;
    onclose: ((event: any) => void) | null;
    send(data: string): void;
    close(): void;
}

export interface SessionOptions {
    configMessage: string;
    ssmlMessage: string;
    timeout: number;
    signal?: AbortSignal;
    onAudio(chunk: Uint8Array): void;
    onBoundary(boundary: WordBoundary | SentenceBoundary): void;
    toError(event: unknown, opened: boolean): Error;
}

const CONNECTING = 0;
const OPEN = 1;

export function abortReason(signal: AbortSignal): unknown {
    if (signal.reason !== undefined) return signal.reason;
    const error = new Error('This operation was aborted');
    error.name = 'AbortError';
    return error;
}

function toBytes(data: unknown): Uint8Array {
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new Uint8Array(0);
}

export function runSession(open: () => SocketLike, options: SessionOptions): Promise<void> {
    return new Promise((resolve, reject) => {
        if (options.signal?.aborted) {
            reject(abortReason(options.signal));
            return;
        }

        const socket = open();
        socket.binaryType = 'arraybuffer';

        let settled = false;
        let opened = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const finish = (error?: unknown) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', onAbort);
            if (error === undefined) {
                resolve();
                return;
            }
            if (socket.readyState === CONNECTING || socket.readyState === OPEN) socket.close();
            reject(error);
        };

        const arm = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                finish(new EdgeTTSError('WebSocket inactivity timeout - no response from server', 'TIMEOUT'));
            }, options.timeout);
        };

        const onAbort = () => finish(abortReason(options.signal!));
        options.signal?.addEventListener('abort', onAbort, { once: true });
        arm();

        socket.onopen = () => {
            if (settled) return;
            opened = true;
            arm();
            socket.send(options.configMessage);
            socket.send(options.ssmlMessage);
        };

        socket.onmessage = (event) => {
            if (settled) return;
            arm();
            if (typeof event.data === 'string') {
                const frame = parseTextFrame(event.data);
                if (frame.path === 'audio.metadata') {
                    for (const boundary of parseMetadata(frame.body)) options.onBoundary(boundary);
                } else if (frame.path === 'turn.end') {
                    socket.close();
                }
                return;
            }
            const frame = parseBinaryFrame(toBytes(event.data));
            if (frame.path === 'audio') options.onAudio(frame.body);
        };

        socket.onerror = (event) => finish(options.toError(event, opened));
        socket.onclose = () => finish();
    });
}
