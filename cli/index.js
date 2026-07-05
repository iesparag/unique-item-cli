// Entry point for the CLI tool
import { program } from 'commander';
import { setupCommands } from './commands.js';

// Register all CLI commands (implementation in commands.js)
setupCommands(program);

// Parse CLI arguments and run corresponding command
program.parse(process.argv);
