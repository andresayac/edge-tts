# Edge TTS
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/andresayac/edge-tts)

**Edge TTS** is a powerful Text-to-Speech (TTS) package that leverages Microsoft's Edge capabilities. This package allows you to synthesize speech from text and manage voice options easily through a command-line interface (CLI).

## Features

- **Text-to-Speech**: Convert text into natural-sounding speech using Microsoft Edge's TTS capabilities.
- **Multiple Voices**: Access a variety of voices to suit your project's needs.
- **Voice Filtering**: Filter voices by language and gender for better selection.
- **Audio Information**: Get detailed information about generated audio (size, duration, format).
- **Audio Export Options**: Export synthesized audio in different formats (raw, base64, or directly to a file).
- **Streaming Support**: Stream audio data in real-time for better performance.
- **Word Boundaries Metadata**: Get word boundary information with precise timestamps.
- **Command-Line Interface**: Use a simple CLI for easy access to functionality.
- **Easy Integration**: Modular structure allows for easy inclusion in existing projects.
- **SSML Custom**: 🥳🥳 Edge TTS accepts raw SSML with all characteristics of Azure AI Speech.  

## Installation

You can install Edge TTS via npm or bun:

```bash
bun add @andresaya/edge-tts
```
```bash
npm install @andresaya/edge-tts
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

From file in format SSML:
```bash
edge-tts synthesize -f ssml.txt --ssml -o salida
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

#### Custom SSML (Advanced)
Edge TTS accepts raw SSML so you can control prosody, styles, pauses, pronunciations, and more. You can pass SSML from code or the CLI. By default the library auto-detects if your input is SSML; you can also force the mode.

More information
[Azure AI Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-structure)

### SSML-builder 
[@andresaya/ssml-builder](https://www.npmjs.com/package/@andresaya/ssml-builder) A powerful, type-safe TypeScript library for building Speech Synthesis Markup Language (SSML) documents. Create expressive text-to-speech applications with Azure Speech Service and other SSML-compliant engines.

#### What the library does for you

- Auto-detect / force mode: options.inputType may be 'auto' | 'ssml' | 'text' (default: auto).
- Validation: Throws helpful errors if SSML is malformed (e.g., missing <speak>, <voice>, or the synthesis namespace).
- Voice injection: If your SSML lacks <voice>, it injects one with the voice you passed.
- Text wrapping: If you pass plain text (or inputType: 'text'), it wraps it in a valid SSML envelope using your rate, pitch, and volume.

```js
import { EdgeTTS } from '@andresaya/edge-tts';

const tts = new EdgeTTS();

const ssml = `
<speak version="1.0"
       xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="https://www.w3.org/2001/mstts"
       xml:lang="es-CO">
  <voice name="es-CO-GonzaloNeural">
    <mstts:express-as style="narration-professional">
      <prosody rate="+5%" pitch="+10Hz" volume="+0%">
        Hola, este es un ejemplo de <emphasis>SSML</emphasis>.
        <break time="400ms" />
        El número es <say-as interpret-as="cardinal">2025</say-as>.
        La palabra se pronuncia
        <phoneme alphabet="ipa" ph="ˈxola">hola</phoneme>.
      </prosody>
    </mstts:express-as>
  </voice>
</speak>`.trim();

// Auto-detects SSML, or force it with inputType: 'ssml'
await tts.synthesize(ssml, 'es-CO-GonzaloNeural', { inputType: 'ssml' });
```

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
    rate: '50%',      // Speech rate: -100% to +200% (or number)
    volume: '90%',    // Speech volume: -100% to +100% (or number)
    pitch: '+20Hz'    // Voice pitch: -100Hz to +100Hz (or number)
});
```

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
