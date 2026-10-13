import fixture from '../fixtures/session.json';

export interface Frame { text?: string; binary?: string }

export interface FakeServiceOptions {
    handshakeStatus?: number;
    date?: () => string;
    accept?: (url: URL) => boolean | Promise<boolean>;
    frames?: Frame[];
    silent?: boolean;
    // Close with this code and reason after the SSML message, as the service
    // does for an unsupported voice or output format.
    close?: { code: number; reason: string };
    voices?: { status: number; body: unknown };
}

export interface FakeService {
    wssUrl: string;
    voicesUrl: string;
    httpUrl: string;
    connections: { url: URL; headers: Headers; messages: string[] }[];
    voiceRequests: { url: URL; headers: Headers }[];
    stop(): void;
}

export const recorded = fixture as { text: string; frames: Frame[] };

export function recordedAudio(frames: Frame[] = recorded.frames): Uint8Array {
    const parts = frames.filter(f => f.binary).map(f => {
        const bytes = Buffer.from(f.binary!, 'base64');
        return bytes.subarray(2 + bytes.readUInt16BE(0));
    });
    return new Uint8Array(Buffer.concat(parts));
}

export function startFakeService(options: FakeServiceOptions = {}): FakeService {
    const connections: FakeService['connections'] = [];
    const voiceRequests: FakeService['voiceRequests'] = [];
    const date = options.date ?? (() => new Date().toUTCString());

    const server = Bun.serve({
        port: 0,
        async fetch(req, srv) {
            const url = new URL(req.url);
            if (url.pathname === '/voices') {
                voiceRequests.push({ url, headers: req.headers });
                const voices = options.voices ?? { status: 200, body: [] };
                return new Response(JSON.stringify(voices.body), {
                    status: voices.status,
                    headers: { 'Content-Type': 'application/json', Date: date() },
                });
            }
            if (url.pathname === '/ws') {
                const rejected = options.handshakeStatus ?? (options.accept && !(await options.accept(url)) ? 403 : undefined);
                if (rejected) {
                    return new Response('', { status: rejected, headers: { Date: date() } });
                }
                const connection = { url, headers: req.headers, messages: [] as string[] };
                connections.push(connection);
                if (srv.upgrade(req, { data: connection })) return undefined;
            }
            return new Response('', { status: 404, headers: { Date: date() } });
        },
        websocket: {
            message(ws, message) {
                const connection = ws.data as FakeService['connections'][number];
                const text = typeof message === 'string' ? message : Buffer.from(message).toString();
                connection.messages.push(text);
                if (!text.includes('Path:ssml') || options.silent) return;
                if (options.close) {
                    ws.close(options.close.code, options.close.reason);
                    return;
                }
                for (const frame of options.frames ?? recorded.frames) {
                    if (frame.text !== undefined) ws.send(frame.text);
                    else ws.send(Buffer.from(frame.binary!, 'base64'));
                }
            },
        },
    });

    const base = `localhost:${server.port}`;
    return {
        wssUrl: `ws://${base}/ws`,
        voicesUrl: `http://${base}/voices`,
        httpUrl: `http://${base}`,
        connections,
        voiceRequests,
        stop: () => server.stop(true),
    };
}
