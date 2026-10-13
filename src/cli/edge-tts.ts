#!/usr/bin/env node

import { SynthesizeCommand } from '../commands/SynthesizeCommand';
import { VoiceListCommand } from '../commands/VoiceListCommand';
import { Command } from 'commander';

const { version } = require('../../package.json');

const program = new Command();

program
  .version(version)
  .addCommand(SynthesizeCommand)
  .addCommand(VoiceListCommand);

program.parseAsync().catch((error) => {
  console.error(`Error: ${(error as Error).message}`);
  process.exit(1);
});
