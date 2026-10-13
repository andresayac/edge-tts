#!/usr/bin/env node

import { SynthesizeCommand } from '../commands/SynthesizeCommand';
import { VoiceListCommand } from '../commands/VoiceListCommand';
import { Command } from 'commander';

const program = new Command();

program
  .version('1.8.3')
  .addCommand(SynthesizeCommand)
  .addCommand(VoiceListCommand);

program.parseAsync().catch((error) => {
  console.error(`Error: ${(error as Error).message}`);
  process.exit(1);
});
