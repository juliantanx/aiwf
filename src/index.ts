#!/usr/bin/env node
import { Command } from 'commander';
import {
  registerInitCommand,
  registerRunCommand,
  registerListCommand,
  registerCreateCommand,
  registerValidateCommand,
  registerModelsCommand,
  registerHooksCommand,
  registerRunsCommand,
} from './commands/index.js';

const program = new Command();

program
  .name('aiwf')
  .description('AI Workflow CLI - Manage AI workflows for team collaboration')
  .version('0.1.0');

// Register commands
registerInitCommand(program);
registerRunCommand(program);
registerListCommand(program);
registerCreateCommand(program);
registerValidateCommand(program);
registerModelsCommand(program);
registerHooksCommand(program);
registerRunsCommand(program);

// Parse arguments
program.parse();
