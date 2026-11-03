#!/usr/bin/env node
import { CLI_USAGE, CliUsageError, runCli } from './cli.js';

try {
  const server = await runCli(process.argv.slice(2));
  if (server !== undefined) {
    const shutdown = (): void => {
      void server
        .close()
        .then(() => {
          process.exitCode = 0;
        })
        .catch(() => {
          process.exitCode = 1;
        });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'The local API could not start.';
  process.stderr.write(`${message}\n`);
  if (error instanceof CliUsageError) process.stderr.write(`${CLI_USAGE}\n`);
  process.exitCode = 1;
}
