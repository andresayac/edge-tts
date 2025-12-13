import { Command } from 'commander';
import { EdgeTTS } from '../services/EdgeTTS';
import { readFile } from 'fs/promises';

export const SynthesizeCommand = new Command('synthesize')
  .description('Edge TTS: synthesize text to audio')
  .option('-t, --text <text>', 'Text to convert to audio')
  .option('-v, --voice [voice]', 'Voice to use for the audio synthesis', 'en-US-AriaNeural')
  .option('-r, --rate [rate]', 'Rate of speech', '0%')
  .option('-l, --volume [volume]', 'Volume of speech', '0%')
  .option('-p, --pitch [pitch]', 'Pitch of speech', '0Hz')
  .option('-o, --output [output]', 'Output file name', `output_${Date.now()}`)
  .option('-f, --file [file]', 'Input file (text)')
  .action(async (options) => {
    const { text, voice, pitch, rate, volume, output, file } = options;

    if (!text && !file) {
      console.error('Error: Text (-t) or file (-f) is required');
      process.exit(1);
    }

    if (text && file) {
      console.error('Error: Cannot use both text (-t) and file (-f) options');
      process.exit(1);
    }

    let content = text;

    if (file) {
      try {
        content = await readFile(file, 'utf-8');
        console.log(`Reading from file: ${file}`);
      } catch (error) {
        console.error(`Error reading file: ${error}`);
        process.exit(1);
      }
    }

    const tts = new EdgeTTS();

    await tts.synthesize(content, voice, { 
      pitch, 
      rate, 
      volume,
    });

    const savedPath = await tts.toFile(output);
    console.log(`Audio file generated: ${savedPath}`);
  });
