export const Constants = {
    TRUSTED_CLIENT_TOKEN: '6A5AA1D4EAFF4E9FB37E23D68491D6F4',
    BASE_URL: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud',
    WSS_URL: 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1',
    VOICES_URL: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list',

    CHROMIUM_FULL_VERSION: '153.0.0.0',
    CHROMIUM_MAJOR_VERSION: '153',
    // NOTE: keep the `1-` prefix. The newer `2-153.0.4234.32` scheme belongs to
    // api.msedgeservices.com, whose WebSocket rejects the `1-`-prefixed token
    // endpoint we still use (fails the 101 handshake). Verified 2026-09-19.
    VERSION_MS_GEC: '1-153.0.4234.32',

    token32() {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);

        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    },

    getBaseHeaders() {
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': 'MUID=' + this.token32()
        };
    },

    WSS_HEADERS: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Sec-WebSocket-Protocol': 'synthesize',
        'Sec-WebSocket-Version': '13',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0'
    },

    VOICE_HEADERS: {
        'Sec-CH-UA': '"Microsoft Edge";v="153", "Not_A Brand";v="8", "Chromium";v="153"',
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
