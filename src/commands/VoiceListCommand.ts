import { Command } from 'commander';
import { EdgeTTS } from '../services/EdgeTTS';

export const VoiceListCommand = new Command('voice-list')
  .description('Get the list of available voices')
  .action(async () => {
    const tts = new EdgeTTS();
    const voices = await tts.getVoices();

    console.log('Available voices:');
    voices.forEach((voice) => {
      console.log(` - ${voice.ShortName}`);
    });
  });
