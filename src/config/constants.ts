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
    }
};
