import { Command } from 'commander';
import { EdgeTTS } from '../services/EdgeTTS';

export const VoiceListCommand = new Command('voice-list')
  .description('Get the list of available voices')
  .option('--locale <locale>', 'Only voices whose locale starts with this, e.g. es or es-CO')
  .option('--gender <gender>', 'Only Male or Female voices')
  .action(async (options) => {
    const tts = new EdgeTTS();
    const gender = options.gender?.toLowerCase();
    const voices = (await tts.getVoices()).filter(voice =>
      (!options.locale || voice.Locale?.toLowerCase().startsWith(options.locale.toLowerCase())) &&
      (!gender || voice.Gender?.toLowerCase() === gender)
    );

    console.log('Available voices:');
    voices.forEach((voice) => {
      console.log(` - ${voice.ShortName}`);
    });
  });
