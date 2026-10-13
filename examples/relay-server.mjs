// NOTE: browser side: new EdgeTTS({ wssUrl: 'ws://127.0.0.1:8080' })
import { WebSocketServer, WebSocket } from 'ws';
import { Constants } from '../dist/index.js'; // or '@andresaya/edge-tts'

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8080);

const server = new WebSocketServer({ host: HOST, port: PORT });

server.on('connection', (client, request) => {
    const query = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : '';
    const upstream = new WebSocket(Constants.WSS_URL + query, {
        headers: { ...Constants.getBaseHeaders(), ...Constants.WSS_HEADERS },
    });
    const pending = [];

    client.on('message', (data, isBinary) => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary });
        else pending.push([data, isBinary]);
    });
    upstream.on('open', () => {
        for (const [data, isBinary] of pending.splice(0)) upstream.send(data, { binary: isBinary });
    });
    upstream.on('message', (data, isBinary) => client.send(data, { binary: isBinary }));

    upstream.on('close', () => client.close());
    upstream.on('error', () => client.close());
    client.on('close', () => upstream.terminate());
    client.on('error', () => upstream.terminate());
});

console.log(`Edge TTS relay listening on ws://${HOST}:${PORT}`);
