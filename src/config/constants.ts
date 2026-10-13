import { webCrypto } from '../core/crypto';

export const Constants = {
    TRUSTED_CLIENT_TOKEN: '6A5AA1D4EAFF4E9FB37E23D68491D6F4',
    BASE_URL: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud',
    // NOTE: token goes as Ocp-Apim-Subscription-Key here; Edge user agents only.
    WSS_URL: 'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1',
    VOICES_URL: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list',

    CHROMIUM_FULL_VERSION: '155.0.0.0',
    CHROMIUM_MAJOR_VERSION: '155',
    VERSION_MS_GEC: '1-155.0.4283.45',

    token32() {
        const bytes = new Uint8Array(16);
        webCrypto().getRandomValues(bytes);

        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    },

    getBaseHeaders() {
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': 'MUID=' + this.token32()
        };
    },

    WSS_HEADERS: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0'
    },

    VOICE_HEADERS: {
        'Sec-CH-UA': '"Microsoft Edge";v="155", "Chromium";v="155", "Not(A:Brand";v="24"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Accept': '*/*',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty'
    },

    // https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech?tabs=nonstreaming
    OUTPUT_FORMAT: {
        'AUDIO_24KHZ_48KBITRATE_MONO_MP3': 'audio-24khz-48kbitrate-mono-mp3',
        'AUDIO_24KHZ_96KBITRATE_MONO_MP3': 'audio-24khz-96kbitrate-mono-mp3',
        'WEBM_24KHZ_16BIT_MONO_OPUS': 'webm-24khz-16bit-mono-opus',
    }


};
