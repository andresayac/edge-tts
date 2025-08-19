#!/usr/bin/env node

import { SynthesizeCommand } from '../commands/SynthesizeCommand';
import { VoiceListCommand } from '../commands/VoiceListCommand';
import { Command } from 'commander';

const program = new Command();

program
  .version('1.3.2')
  .addCommand(SynthesizeCommand)
  .addCommand(VoiceListCommand);

try {
  program.parse();
} catch (error) {
  console.error(`Error: ${(error as Error).message}`);
  process.exit(1);
}
