// Entry point for the CLI tool
import { program } from 'commander';
import { setupCommands } from './commands.js';
import path from 'path';

// Fix: Commander wants .usage() argument to match subcommand usage, not global usage
// So leave .usage() blank (defaults to 'unique-item-cli [options] [command]'), or provide the subcommand usage
// But test expects to see 'Usage: generate [options]' in generate's help, not global help.
// So safest is to not override here, let per-command usage control help messages.
program
  .name('unique-item-cli');

// Register all CLI commands (implementation in commands.js)
setupCommands(program);

// Parse CLI arguments and run corresponding command
program.parse(process.argv);
