# Edge TTS
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/andresayac/edge-tts)

**Edge TTS** is a powerful Text-to-Speech (TTS) package that leverages Microsoft's Edge capabilities. This package allows you to synthesize speech from text and manage voice options easily through a command-line interface (CLI).

## Features

- **Text-to-Speech**: Convert text into natural-sounding speech using Microsoft Edge's TTS capabilities.
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions included.
- **Multiple Audio Formats**: Support for 36+ audio formats (MP3, WebM, OGG, WAV, PCM, and more).
- **Multiple Voices**: Access a variety of voices to suit your project's needs.
- **Voice Filtering**: Filter voices by language and gender for better selection.
- **Audio Information**: Get detailed information about generated audio (size, duration, format).
- **Audio Export Options**: Export synthesized audio in different formats (raw, base64, or directly to a file).
- **Streaming Support**: Stream audio data in real-time for better performance.
- **Word Boundaries Metadata**: Get word boundary information with precise timestamps.
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

## TypeScript Support

Edge TTS is written in **TypeScript** and includes full type definitions. No additional `@types` packages are needed.

### Available Types

```typescript
import { 
    EdgeTTS, 
    Constants,
    Voice,
    SynthesisOptions,
    WordBoundary 
} from '@andresaya/edge-tts';

// Voice interface
interface Voice {
    Name: string;
    ShortName: string;
    Gender: 'Male' | 'Female';
    Locale: string;
    FriendlyName: string;
    LocalName: string;
}

// Synthesis options
interface SynthesisOptions {
    pitch?: string | number;       // e.g., '+20Hz' or 20
    rate?: string | number;        // e.g., '50%' or 50
    volume?: string | number;      // e.g., '90%' or 90
    outputFormat?: string;         // e.g., Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
}

// Word boundary metadata
interface WordBoundary {
    type: "WordBoundary";
    offset: number;
    duration: number;
    text: string;
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

To list available voices:
```bash
edge-tts voice-list
```

### Integration into Your Project

```js
import { EdgeTTS } from '@andresaya/edge-tts';

// Initialize the EdgeTTS service
const tts = new EdgeTTS();
```

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

#### Advanced Synthesis with Options
```js
await tts.synthesize("Hello, world!", 'en-US-AriaNeural', {
    rate: '50%',           // Speech rate: -100% to +200% (or number)
    volume: '90%',         // Speech volume: -100% to +100% (or number)
    pitch: '+20Hz',        // Voice pitch: -100Hz to +100Hz (or number)
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3'  // Audio output format
});
```

#### Audio Output Formats

Edge TTS supports multiple audio formats. You can specify the format using the `outputFormat` option:

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

// Lossless WAV
await tts.synthesize("Hello!", 'en-US-AriaNeural', {
    outputFormat: Constants.OUTPUT_FORMAT.RIFF_24KHZ_16BIT_MONO_PCM
});
await tts.toFile('./output/audio'); // Automatically saved as .wav
```

**Available formats (all 36 tested and compatible):**

- **MP3 Formats** (Streaming): 16kHz, 24kHz, 48kHz with various bitrates (32-192 kbps)
- **Opus Formats** (Streaming): Audio, WebM, and OGG containers
- **WAV/PCM Formats** (Non-streaming): RIFF (8-48 kHz) and RAW variants
- **Specialized Codecs**: AMR-WB, G.722, TrueSilk, A-law, μ-law

See `Constants.OUTPUT_FORMAT` for the complete list. The file extension is automatically detected based on the format.

**Format recommendations:**
- 🌐 **Web streaming**: `WEBM_24KHZ_16BIT_MONO_OPUS` or `AUDIO_24KHZ_96KBITRATE_MONO_MP3`
- 📱 **Mobile apps**: `AUDIO_24KHZ_48KBITRATE_MONO_MP3`
- 💾 **High quality**: `AUDIO_48KHZ_192KBITRATE_MONO_MP3` or `RIFF_48KHZ_16BIT_MONO_PCM`
- ⚡ **Low bandwidth**: `AUDIO_16KHZ_32KBITRATE_MONO_MP3`


#### Streaming Synthesis
```js
// Stream audio data in real-time
for await (const chunk of tts.synthesizeStream("Long text to stream...", 'en-US-AriaNeural')) {
    // Process each audio chunk as it arrives
    console.log(`Received chunk: ${chunk.length} bytes`);
}
```

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
```

### Word Boundaries Metadata

```php
// Get word boundaries with timestamps
$boundaries = $tts->getWordBoundaries();

// Save metadata to file
$tts->saveMetadata('metadata.json');
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

**⚠️ Important:** Currently, this library only works reliably with **Microsoft Edge browser**. We are working to extend support to other browsers. Community contributions and suggestions are welcome!

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

```js
import { EdgeTTS } from '@andresaya/edge-tts';

async function handleErrors() {
    const tts = new EdgeTTS();
    
    try {
        await tts.synthesize("Test text", 'invalid-voice-name');
    } catch (error) {
        console.error('Synthesis failed:', error.message);
    }
    
    try {
        // This will throw an error - no audio data
        const duration = tts.getDuration();
    } catch (error) {
        console.error('No audio data available:', error.message);
    }
    
    try {
        // Invalid volume range
        await tts.synthesize("Test", 'en-US-AriaNeural', { volume: -150 });
    } catch (error) {
        console.error('Invalid parameter:', error.message);
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
