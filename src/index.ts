#!/usr/bin/env node
import { startServer } from './mcp.js';
import { runCli } from './cli.js';

const args = process.argv.slice(2);

if (args.includes('--mcp')) {
  const urlIndex = args.indexOf('--url');
  if (urlIndex === -1 || !args[urlIndex + 1]) {
    process.stderr.write('Usage: dskit --mcp --url https://your-storybook.com\n');
    process.exit(1);
  }
  const storybookUrl = args[urlIndex + 1];

  startServer(storybookUrl).catch((err) => {
    process.stderr.write(`Fatal error: ${err.message}\n`);
    process.exit(1);
  });
} else {
  runCli(process.argv);
}
