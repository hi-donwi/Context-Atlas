import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openContextSource, startLocalApiServer } from 'context-atlas-source-node';
import type { LocalApiServer } from 'context-atlas-source-node';

const USAGE = 'Usage: context-atlas [folder] [--port <port>] [--project <key>]';
const PROJECT_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface CliOptions {
  readonly help: false;
  readonly rootPath: string;
  readonly port: number;
  /** Lock a workspace context to one registered project's scope. */
  readonly project?: string;
}

export interface CliOutput {
  log(message: string): void;
}

export interface CliRuntimeOptions {
  /** Override the installed browser bundle directory for tests or embedded hosts. */
  readonly uiDirectory?: string;
  /** Directory a relative folder argument is resolved against; defaults to `process.cwd()`. */
  readonly currentDirectory?: string;
}

/**
 * The directory the reader typed the command in. npm runs scripts from the package root, so
 * `npm start -- ../notes` would otherwise resolve against this repository instead of the
 * reader's shell; npm records the original directory in `INIT_CWD`.
 */
export function invocationDirectory(
  env: Readonly<Record<string, string | undefined>> = process.env,
  cwd = process.cwd(),
): string {
  const initial = env.INIT_CWD;
  if (env.npm_lifecycle_event === undefined || initial === undefined) return cwd;
  return initial !== '' && isAbsolute(initial) ? initial : cwd;
}

/** An invalid command-line invocation, safe to print without a stack trace. */
export class CliUsageError extends Error {
  constructor() {
    super(USAGE);
    this.name = 'CliUsageError';
  }
}

/** Parse the supported CLI arguments without performing filesystem or network operations. */
export function parseCliArgs(
  args: readonly string[],
  currentDirectory = process.cwd(),
): CliOptions | { readonly help: true } {
  if (args.includes('--help') || args.includes('-h')) return { help: true };

  let folder: string | undefined;
  let port = 0;
  let portProvided = false;
  let project: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === '--port' || argument.startsWith('--port=')) {
      if (portProvided) throw new CliUsageError();
      portProvided = true;
      const value = argument === '--port' ? args[++index] : argument.slice('--port='.length);
      if (value === undefined || !/^\d+$/.test(value)) throw new CliUsageError();
      port = Number(value);
      if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw new CliUsageError();
      continue;
    }

    if (argument === '--project' || argument.startsWith('--project=')) {
      if (project !== undefined) throw new CliUsageError();
      const value = argument === '--project' ? args[++index] : argument.slice('--project='.length);
      if (value === undefined || !PROJECT_KEY.test(value)) throw new CliUsageError();
      project = value;
      continue;
    }

    if (argument.startsWith('-') || folder !== undefined) throw new CliUsageError();
    folder = argument;
  }

  return {
    help: false,
    rootPath: resolve(currentDirectory, folder ?? '.'),
    port,
    ...(project === undefined ? {} : { project }),
  };
}

/** Open a folder and start the read-only local API, or print usage when help is requested. */
export async function runCli(
  args: readonly string[],
  output: CliOutput = { log: (message) => console.log(message) },
  runtime: CliRuntimeOptions = {},
): Promise<LocalApiServer | undefined> {
  const options = parseCliArgs(args, runtime.currentDirectory);
  if (options.help) {
    output.log(USAGE);
    return undefined;
  }

  const source = await openContextSource(
    options.rootPath,
    options.project === undefined ? {} : { project: options.project },
  );
  const uiDirectory = runtime.uiDirectory ?? fileURLToPath(new URL('./ui/', import.meta.url));
  const server = await startLocalApiServer(source, { port: options.port, uiDirectory });
  output.log(`Context Atlas API listening at ${server.url}`);
  return server;
}

export { USAGE as CLI_USAGE };
