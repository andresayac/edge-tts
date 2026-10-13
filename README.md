# Edge TTS
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/andresayac/edge-tts)

**Edge TTS** is a powerful Text-to-Speech (TTS) package that leverages Microsoft's Edge capabilities. This package allows you to synthesize speech from text and manage voice options easily through a command-line interface (CLI).

## Features

- **Text-to-Speech**: Convert text into natural-sounding speech using Microsoft Edge's TTS capabilities.
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions included.
- **Audio Formats**: MP3 at 48 or 96 kbit/s, and WebM/Opus.
- **Multiple Voices**: Access a variety of voices to suit your project's needs.
- **Voice Filtering**: Filter voices by language and gender for better selection.
- **Audio Information**: Get detailed information about generated audio (size, duration, format).
- **Audio Export Options**: Export synthesized audio in different formats (raw, base64, or directly to a file).
- **Streaming Support**: Stream audio data in real-time for better performance.
- **Word and Sentence Boundaries**: Get word and sentence timings with precise timestamps.
- **Subtitles**: Generate SRT or WebVTT subtitles, one cue per sentence.
- **Concurrent Use**: `generate()` returns its own result, so one instance can run several syntheses at once.
- **Configurable**: Override the endpoint, headers, timeout and voice cache without waiting for a release.
- **Command-Line Interface**: Use a simple CLI for easy access to functionality.
- **Easy Integration**: Modular structure allows for easy inclusion in existing projects.

## Installation

You can install Edge TTS via npm or bun:

```bash
bun add @andresaya/edge-tts
```
```bash
npm install @andresaya/edge-tts
```

Tested on Node.js 18, 20 and 24, and on Bun.

## TypeScript Support

Edge TTS is written in **TypeScript** and includes full type definitions. No additional `@types` packages are needed.

### Available Types

```typescript
import { 
    EdgeTTS, 
    EdgeTTSError,
    Constants,
    Voice,
    SynthesisOptions,
    SynthesisResult,
    EdgeTTSOptions,
    WordBoundary,
    SentenceBoundary
} from '@andresaya/edge-tts';

// Voice interface
interface Voice {
    Name: string;
    ShortName: string;
    Gender: string;               // 'Male' | 'Female'
    Locale: string;
    FriendlyName: string;
    LocalName: string;
    DisplayName?: string;
    LocaleName?: string;
    VoiceType?: string;
    SecondaryLocaleList?: string[];
    VoiceTag?: { TailoredScenarios: string[]; VoicePersonalities: string[] };
}

// Synthesis options
interface SynthesisOptions {
    pitch?: string | number;       // e.g., '+20Hz' or 20
    rate?: string | number;        // e.g., '50%' or 50
    volume?: string | number;      // e.g., '90%' or 90
    outputFormat?: string;         // e.g., Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    signal?: AbortSignal;          // cancels the synthesis
    timeout?: number;              // inactivity timeout in ms for this call
}

// Word and sentence boundary metadata (offset and duration in 100 ns ticks)
interface WordBoundary {
    type: "WordBoundary";
    offset: number;
    duration: number;
    text: string;
}

interface SentenceBoundary {
    type: "SentenceBoundary";
    offset: number;
    duration: number;
    text: string;
}

// Returned by generate()
interface SynthesisResult {
    audio: Uint8Array;            // a Buffer in Node.js
    format: string;               // file extension: 'mp3' or 'webm'
    outputFormat: string;
    wordBoundaries: WordBoundary[];
    sentenceBoundaries: SentenceBoundary[];
    duration: number;             // estimated, in seconds
}
```

### Type-Safe Usage Example

```typescript
import { EdgeTTS, SynthesisOptions, Constants } from '@andresaya/edge-tts';

const tts = new EdgeTTS();

const options: SynthesisOptions = {
    pitch: '+10Hz',
    rate: '100%',
    volume: '90%',
    outputFormat: Constants.OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS
};

await tts.synthesize("TypeScript example", 'en-US-AriaNeural', options);

const info = tts.getAudioInfo(); // Returns: { size: number; format: string; estimatedDuration: number }
const boundaries = tts.getWordBoundaries(); // Returns: WordBoundary[]
```

## Usage

### Command-Line Interface

Install globally to use the CLI:

```bash
npm install -g @andresaya/edge-tts
```

To synthesize speech from text:
```bash
edge-tts synthesize -t "Hello, world!" -o hello_world_audio
```

Other options:
```bash
# Choose the voice, read the text from a file, write subtitles too
edge-tts synthesize -f story.txt -v es-CO-SalomeNeural -o story.mp3 --subtitles story.srt

# Read from stdin, WebM/Opus output, WebVTT subtitles
cat story.txt | edge-tts synthesize -f - --format webm-24khz-16bit-mono-opus -o story --subtitles story.vtt
```

To list available voices, optionally filtered:
```bash
edge-tts voice-list
edge-tts voice-list --locale es-CO --gender female
```

### Integration into Your Project

```js
import { EdgeTTS } from '@andresaya/edge-tts';

// Initialize the EdgeTTS service
const tts = new EdgeTTS();
```

### Configuration

Every option is optional. The defaults come from `Constants`, so when Microsoft changes the service you can point the library at the new values yourself instead of waiting for a release.

```js
const tts = new EdgeTTS({
    wssUrl: 'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1',
    voicesUrl: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list',
    secMsGecVersion: '1-155.0.4283.45',
    headers: { 'User-Agent': '...' },   // Node.js only, added to the default headers
    timeout: 30000,                     // ms without data before giving up
    voicesCacheTtl: 600000,             // ms to reuse the voice list, 0 to always fetch it
});
```

If the computer's clock is off, the service refuses the connection. In Node.js the library then reads the time from the server and retries once.

## API Reference

### Voice Management

#### Get All Voices
```js
const voices = await tts.getVoices();
console.log(`Found ${voices.length} voices`);
```

#### Filter Voices by Language
```js
// Get all English voices
const englishVoices = await tts.getVoicesByLanguage('en');

// Get specific locale voices
const usEnglishVoices = await tts.getVoicesByLanguage('en-US');
```

#### Filter Voices by Gender
```js
// Get all female voices
const femaleVoices = await tts.getVoicesByGender('Female');

// Get all male voices
const maleVoices = await tts.getVoicesByGender('Male');
```

### Text Synthesis

#### Basic Synthesis
```js
// Simple synthesis with default voice
await tts.synthesize("Hello, world!");

// Synthesis with specific voice
await tts.synthesize("Hello, world!", 'en-US-AriaNeural');
```

#### Matching the voice to the text

Voices are locale specific. A voice can only read text written in the script of
its own language, so passing Chinese, Cyrillic, Arabic or Devanagari text to an
English voice returns no audio at all:

```js
// Nothing to play: an English voice cannot read this.
await tts.synthesize("这是一个测试", 'en-US-AriaNeural');

// Works.
await tts.synthesize("这是一个测试", 'zh-CN-XiaoxiaoNeural');
```

A few foreign words inside an otherwise English sentence are fine; the problem
only appears when the other script is most of the text. `toBuffer()` throws in
this case rather than handing back an empty buffer.

#### Advanced Synthesis with Options
```js
await tts.synthesize("Hello, world!", 'en-US-AriaNeural', {
    rate: '50%',           // Speech rate: -100% to +200% (or number)
    volume: '90%',         // Speech volume: -100% to +100% (or number)
    pitch: '+20Hz',        // Voice pitch: -100Hz to +100Hz (or number)
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3'  // Audio output format
});
```

#### Independent Results with generate()

`synthesize()` keeps the audio on the instance, so two calls at the same time on one instance overwrite each other. `generate()` returns everything in its own result instead and leaves the instance alone:

```js
const [hello, bye] = await Promise.all([
    tts.generate("Hello!", 'en-US-AriaNeural'),
    tts.generate("Goodbye!", 'en-US-AriaNeural'),
]);

hello.audio;              // Buffer in Node.js, Uint8Array in the browser
hello.format;             // 'mp3'
hello.duration;           // estimated seconds
hello.wordBoundaries;     // WordBoundary[]
hello.sentenceBoundaries; // SentenceBoundary[]
```

#### Audio Output Formats

You can specify the format using the `outputFormat` option:

```js
import { EdgeTTS, Constants } from '@andresaya/edge-tts';

const tts = new EdgeTTS();

// High quality MP3
await tts.synthesize("Hello!", 'en-US-AriaNeural', {
    outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
});
await tts.toFile('./output/audio'); // Automatically saved as .mp3

// WebM/Opus for web
await tts.synthesize("Hello!", 'en-US-AriaNeural', {
    outputFormat: Constants.OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS
});
await tts.toFile('./output/audio'); // Automatically saved as .webm
```

**Available formats:**

| Constant | Value |
|----------|-------|
| `AUDIO_24KHZ_48KBITRATE_MONO_MP3` (default) | `audio-24khz-48kbitrate-mono-mp3` |
| `AUDIO_24KHZ_96KBITRATE_MONO_MP3` | `audio-24khz-96kbitrate-mono-mp3` |
| `WEBM_24KHZ_16BIT_MONO_OPUS` | `webm-24khz-16bit-mono-opus` |

The service returns no audio for other formats, such as WAV, PCM or other MP3 bitrates.


#### Streaming Synthesis
```js
// Stream audio data in real-time
for await (const chunk of tts.synthesizeStream("Long text to stream...", 'en-US-AriaNeural')) {
    // Process each audio chunk as it arrives
    console.log(`Received chunk: ${chunk.length} bytes`);
}
```

Leaving the loop early with `break` closes the connection.

#### Cancelling and Timeouts
```js
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

try {
    await tts.synthesize("Hello!", 'en-US-AriaNeural', { signal: controller.signal, timeout: 10000 });
} catch (error) {
    if (error.name === 'AbortError') console.log('Cancelled');
}
```

`signal` works with `synthesize()`, `synthesizeStream()` and `generate()`. `timeout` is how long to wait without receiving data, 30 seconds by default.

### Audio Information

#### Get Audio Details
```js
await tts.synthesize("Hello, world!");

const audioInfo = tts.getAudioInfo();
console.log(`Size: ${audioInfo.size} bytes`);
console.log(`Format: ${audioInfo.format}`);
console.log(`Duration: ${audioInfo.estimatedDuration} seconds`);
```

#### Get Duration Only
```js
const duration = tts.getDuration();
console.log(`Audio duration: ${duration} seconds`);
```

### Export Options

#### Export as Base64
```js
await tts.synthesize("Hello, world!");
const base64Audio = tts.toBase64();
console.log(`Base64 length: ${base64Audio.length}`);
```

#### Export as Raw Buffer
```js
const rawAudio = tts.toRaw(); // Alias for toBase64()
const buffer = tts.toBuffer(); // Get as Buffer object
```

#### Export to File
```js
const filePath = await tts.toFile("output_audio");
console.log(`Audio saved to: ${filePath}`);
// Creates: output_audio.mp3

await tts.toFile("speech.mp3"); // Creates: speech.mp3 (the extension is not repeated)
```

### Word and Sentence Boundaries

Offsets and durations are in 100-nanosecond ticks (10,000,000 per second).

```js
await tts.synthesize("Hello, world. How are you?", 'en-US-AriaNeural');

const words = tts.getWordBoundaries();         // [{ type: 'WordBoundary', offset, duration, text: 'Hello' }, ...]
const sentences = tts.getSentenceBoundaries(); // [{ type: 'SentenceBoundary', offset, duration, text: 'Hello, world.' }, ...]

// Save word boundaries to a JSON file
await tts.saveMetadata('metadata.json');
```

### Subtitles

One cue per sentence, with the punctuation of the original text.

```js
import { writeFile } from 'fs/promises';
import { toSRT, toVTT } from '@andresaya/edge-tts';

await tts.synthesize("¿Hola? Esto es una prueba.", 'es-CO-SalomeNeural');
await writeFile('speech.srt', tts.toSRT());
await writeFile('speech.vtt', tts.toVTT());

// From a generate() result
const result = await tts.generate("Hello, world.", 'en-US-AriaNeural');
await writeFile('hello.srt', toSRT(result.sentenceBoundaries));
```


## Examples

### Complete Example with Voice Selection
```js
import { EdgeTTS } from '@andresaya/edge-tts';

async function textToSpeechExample() {
    const tts = new EdgeTTS();
    
    // Get available English voices
    const englishVoices = await tts.getVoicesByLanguage('en-US');
    console.log(`Available English voices: ${englishVoices.length}`);
    
    // Use the first available voice
    const voice = englishVoices[0];
    console.log(`Using voice: ${voice.FriendlyName}`);
    
    // Synthesize with custom options
    await tts.synthesize(
        "This is a test of the Edge TTS system with custom voice parameters.",
        voice.ShortName,
        {
            pitch: '+10Hz',
            rate: '-10%',
            volume: '90%'
        }
    );
    
    // Get audio information
    const info = tts.getAudioInfo();
    console.log(`Generated audio: ${info.size} bytes, ${info.estimatedDuration.toFixed(2)}s`);
    
    // Save to file
    const outputPath = await tts.toFile('./output/speech');
    console.log(`Audio saved to: ${outputPath}`);
}

textToSpeechExample().catch(console.error);
```

### Streaming Example
```js
import { EdgeTTS } from '@andresaya/edge-tts';
import { createWriteStream } from 'fs';

async function streamingExample() {
    const tts = new EdgeTTS();
    const writeStream = createWriteStream('streaming_output.mp3');
    
    const longText = "This is a very long text that will be streamed...";
    
    for await (const chunk of tts.synthesizeStream(longText, 'en-US-AriaNeural')) {
        writeStream.write(chunk);
        console.log(`Streamed ${chunk.length} bytes`);
    }
    
    writeStream.end();
    console.log('Streaming completed!');
}

streamingExample().catch(console.error);
```

### Voice Exploration Example
```js
import { EdgeTTS } from '@andresaya/edge-tts';

async function exploreVoices() {
    const tts = new EdgeTTS();
    
    // Get all voices
    const allVoices = await tts.getVoices();
    console.log(`Total voices available: ${allVoices.length}`);
    
    // Group by language
    const languages = [...new Set(allVoices.map(v => v.Locale.split('-')[0]))];
    console.log(`Languages available: ${languages.join(', ')}`);
    
    // Get Spanish voices
    const spanishVoices = await tts.getVoicesByLanguage('es');
    console.log(`Spanish voices: ${spanishVoices.length}`);
    
    // Get female voices
    const femaleVoices = await tts.getVoicesByGender('Female');
    console.log(`Female voices: ${femaleVoices.length}`);
    
    // Test different voices
    const testText = "Hola, este es un ejemplo de síntesis de voz.";
    
    for (const voice of spanishVoices.slice(0, 3)) {
        console.log(`Testing voice: ${voice.FriendlyName}`);
        
        await tts.synthesize(testText, voice.ShortName);
        const filePath = await tts.toFile(`./voices/${voice.ShortName}`);
        
        console.log(`Saved: ${filePath}`);
    }
}

exploreVoices().catch(console.error);
```

## Browser Support

This library can be used directly in web browsers via CDN or ES modules.

**⚠️ Important:** Connecting directly, synthesis only works in **Microsoft Edge**. The speech service refuses connections whose user agent is not Edge, and a web page cannot change the user agent its browser sends. Chrome, Firefox and Safari get a 403 when synthesizing. For those browsers, use a relay (see [Other Browsers](#other-browsers-relay)). The Node.js version is not affected.

### CDN Usage (UMD)

```html
<!-- Load from CDN -->
<script src="https://unpkg.com/@andresaya/edge-tts@latest/dist/browser/edge-tts.umd.min.js"></script>

<script>
  const tts = new EdgeTTS();
  
  // Get available voices
  tts.getVoices().then(voices => {
    console.log('Available voices:', voices.length);
  });
  
  // Synthesize speech
  async function speak() {
    await tts.synthesize("Hello from the browser!", 'en-US-AriaNeural');
    const audioData = tts.getAudioData();
    
    // Play audio
    const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
  }
</script>
```

### ES Module Import

```html
<script type="module">
  import { EdgeTTS } from 'https://unpkg.com/@andresaya/edge-tts@latest/dist/browser/edge-tts.esm.min.js';
  
  const tts = new EdgeTTS();
  
  // Use the library
  const voices = await tts.getVoices();
  console.log(voices);
</script>
```

### Streaming Support in Browser

```html
<script type="module">
  import { EdgeTTS } from 'https://unpkg.com/@andresaya/edge-tts@latest/dist/browser/edge-tts.esm.min.js';
  
  const tts = new EdgeTTS();
  const chunks = [];
  
  // Stream audio chunks in real-time
  for await (const chunk of tts.synthesizeStream("Long text to stream...", 'en-US-AriaNeural')) {
    chunks.push(chunk);
    console.log(`Received chunk: ${chunk.length} bytes`);
  }
  
  // Combine and play all chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const audioData = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    audioData.set(chunk, offset);
    offset += chunk.length;
  }
  
  const blob = new Blob([audioData], { type: 'audio/mp3' });
  const audio = new Audio(URL.createObjectURL(blob));
  audio.play();
</script>
```

### Other Browsers (Relay)

A small relay running in Node.js connects to the service with Edge's headers and passes the messages through. Start the example relay:

```bash
node examples/relay-server.mjs   # ws://127.0.0.1:8080
```

And point the browser at it:

```js
const tts = new EdgeTTS({ wssUrl: 'ws://127.0.0.1:8080' });
await tts.synthesize("Hello from Chrome!", 'en-US-AriaNeural');
```

The example only listens on `127.0.0.1`. If you deploy it, put it behind your own authentication or origin check so it is not open to everyone.

### Complete Browser Example

For a full working example with voice selection and synthesis, see [`examples/browser-standalone.html`](examples/browser-standalone.html).

## Voice Options

### Synthesis Parameters

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `pitch` | `string \| number` | `-100Hz` to `+100Hz` | Voice pitch adjustment |
| `rate` | `string \| number` | `-100%` to `+200%` | Speech rate adjustment |
| `volume` | `string \| number` | `-100%` to `+100%` | Volume adjustment |

### Parameter Examples
```js

// Using numbers (recommended)
{ pitch: 20, rate: -10, volume: 90 }

// Using strings
{ pitch: '+20Hz', rate: '-10%', volume: '90%' }

// Mixed usage
{ pitch: 15, rate: '25%', volume: 85 }

```

## Error Handling

Errors raised by the library are `EdgeTTSError` instances with a `code`. Network errors from Node.js (such as `ECONNREFUSED`) are passed through unchanged.

| `code` | When |
|--------|------|
| `HANDSHAKE` | The service refused the connection. `status` holds the HTTP status in Node.js (usually 403). |
| `NETWORK` | The connection failed after it was open (browser). |
| `TIMEOUT` | No data arrived for `timeout` ms. |
| `NO_AUDIO` | No synthesis yet, or the service returned no audio (voice and text in different scripts, or an unsupported format). |
| `INVALID_OPTION` | `pitch`, `rate` or `volume` is not valid. |
| `VOICES` | The voice list request failed. `status` holds the HTTP status. |

Cancelling with an `AbortSignal` rejects with the signal's reason, an `AbortError`.

```js
import { EdgeTTS, EdgeTTSError } from '@andresaya/edge-tts';

async function handleErrors() {
    const tts = new EdgeTTS();
    
    try {
        await tts.synthesize("Test", 'en-US-AriaNeural', { volume: -150 });
    } catch (error) {
        if (error instanceof EdgeTTSError && error.code === 'INVALID_OPTION') {
            console.error('Invalid parameter:', error.message);
        }
    }
    
    try {
        // This will throw an error - no audio data
        const duration = tts.getDuration();
    } catch (error) {
        console.error(error.code, error.message); // NO_AUDIO ...
    }
}
```

## PHP Version
If you want to use Edge TTS with PHP, you can check out the PHP version of this package: [Edge TTS PHP](https://github.com/andresayac/edge-tts-php)

## License
This project is licensed under the GNU General Public License v3 (GPLv3).

## Acknowledgments

We would like to extend our gratitude to the developers and contributors of the following projects for their inspiration and groundwork:

* https://github.com/rany2/edge-tts/tree/master/examples
* https://github.com/rany2/edge-tts/blob/master/src/edge_tts/util.py
* https://github.com/hasscc/hass-edge-tts/blob/main/custom_components/edge_tts/tts.py
