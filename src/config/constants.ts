export const Constants = {
    TRUSTED_CLIENT_TOKEN: '6A5AA1D4EAFF4E9FB37E23D68491D6F4',
    BASE_URL: 'https://api.msedgeservices.com/tts/cognitiveservices',
    WSS_URL: 'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1',
    VOICES_URL: 'https://api.msedgeservices.com/tts/cognitiveservices/voices/list',

    CHROMIUM_FULL_VERSION: '142.0.3595.0',
    CHROMIUM_MAJOR_VERSION: '142',
    VERSION_MS_GEC: '1-142.0.3595',

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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'es,es-ES;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,es-CO;q=0.5,es-MX;q=0.4',
            'Cookie': 'MUID=' + this.token32()
        };
    },

    WSS_HEADERS: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Sec-WebSocket-Protocol': 'synthesize',
        'Sec-WebSocket-Version': '13',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0'
    },

    VOICE_HEADERS: {
        'Sec-CH-UA': '" Not;A Brand";v="99", "Microsoft Edge";v="140", "Chromium";v="140"',
        'Sec-CH-UA-Mobile': '?0',
        'Accept': '*/*',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty'
    },
    
    // https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech?tabs=nonstreaming
    OUTPUT_FORMAT: {
        // Streaming        
        AMR_WB_16000HZ: 'amr-wb-16000hz',
        AUDIO_16KHZ_16BIT_32KBPS_MONO_OPUS: 'audio-16khz-16bit-32kbps-mono-opus',
        AUDIO_16KHZ_32KBITRATE_MONO_MP3: 'audio-16khz-32kbitrate-mono-mp3',
        AUDIO_16KHZ_64KBITRATE_MONO_MP3: 'audio-16khz-64kbitrate-mono-mp3',
        AUDIO_16KHZ_128KBITRATE_MONO_MP3: 'audio-16khz-128kbitrate-mono-mp3',
        AUDIO_24KHZ_16BIT_24KBPS_MONO_OPUS: 'audio-24khz-16bit-24kbps-mono-opus',
        AUDIO_24KHZ_16BIT_48KBPS_MONO_OPUS: 'audio-24khz-16bit-48kbps-mono-opus',
        AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'audio-24khz-48kbitrate-mono-mp3',
        AUDIO_24KHZ_96KBITRATE_MONO_MP3: 'audio-24khz-96kbitrate-mono-mp3',
        AUDIO_24KHZ_160KBITRATE_MONO_MP3: 'audio-24khz-160kbitrate-mono-mp3',
        AUDIO_48KHZ_96KBITRATE_MONO_MP3: 'audio-48khz-96kbitrate-mono-mp3',
        AUDIO_48KHZ_192KBITRATE_MONO_MP3: 'audio-48khz-192kbitrate-mono-mp3',
        G722_16KHZ_64KBPS: 'g722-16khz-64kbps',
        OGG_16KHZ_16BIT_MONO_OPUS: 'ogg-16khz-16bit-mono-opus',
        OGG_24KHZ_16BIT_MONO_OPUS: 'ogg-24khz-16bit-mono-opus',
        OGG_48KHZ_16BIT_MONO_OPUS: 'ogg-48khz-16bit-mono-opus',
        RAW_8KHZ_8BIT_MONO_ALAW: 'raw-8khz-8bit-mono-alaw',
        RAW_8KHZ_8BIT_MONO_MULAW: 'raw-8khz-8bit-mono-mulaw',
        RAW_8KHZ_16BIT_MONO_PCM: 'raw-8khz-16bit-mono-pcm',
        RAW_16KHZ_16BIT_MONO_PCM: 'raw-16khz-16bit-mono-pcm',
        RAW_16KHZ_16BIT_MONO_TRUESILK: 'raw-16khz-16bit-mono-truesilk',
        RAW_22050HZ_16BIT_MONO_PCM: 'raw-22050hz-16bit-mono-pcm',
        RAW_24KHZ_16BIT_MONO_PCM: 'raw-24khz-16bit-mono-pcm',
        RAW_24KHZ_16BIT_MONO_TRUESILK: 'raw-24khz-16bit-mono-truesilk',
        RAW_44100HZ_16BIT_MONO_PCM: 'raw-44100hz-16bit-mono-pcm',
        RAW_48KHZ_16BIT_MONO_PCM: 'raw-48khz-16bit-mono-pcm',
        WEBM_16KHZ_16BIT_MONO_OPUS: 'webm-16khz-16bit-mono-opus',
        WEBM_24KHZ_16BIT_24KBPS_MONO_OPUS: 'webm-24khz-16bit-24kbps-mono-opus',
        WEBM_24KHZ_16BIT_MONO_OPUS: 'webm-24khz-16bit-mono-opus',
        // NonStreaming        
        RIFF_8KHZ_8BIT_MONO_ALAW: 'riff-8khz-8bit-mono-alaw',
        RIFF_8KHZ_8BIT_MONO_MULAW: 'riff-8khz-8bit-mono-mulaw',
        RIFF_8KHZ_16BIT_MONO_PCM: 'riff-8khz-16bit-mono-pcm',
        RIFF_22050HZ_16BIT_MONO_PCM: 'riff-22050hz-16bit-mono-pcm',
        RIFF_24KHZ_16BIT_MONO_PCM: 'riff-24khz-16bit-mono-pcm',
        RIFF_44100HZ_16BIT_MONO_PCM: 'riff-44100hz-16bit-mono-pcm',
        RIFF_48KHZ_16BIT_MONO_PCM: 'riff-48khz-16bit-mono-pcm'
    }


};
