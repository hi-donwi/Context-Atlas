import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliUsageError, invocationDirectory, parseCliArgs, runCli } from './cli.js';

describe('invocationDirectory', () => {
  it('uses the directory npm was invoked from when an npm script starts the CLI', () => {
    expect(
      invocationDirectory(
        { npm_lifecycle_event: 'start', INIT_CWD: '/home/reader/notes' },
        '/repo',
      ),
    ).toBe('/home/reader/notes');
  });

  it('uses the process directory outside npm scripts', () => {
    expect(invocationDirectory({ INIT_CWD: '/home/reader/notes' }, '/repo')).toBe('/repo');
    expect(invocationDirectory({}, '/repo')).toBe('/repo');
  });

  it('ignores an empty or relative npm invocation directory', () => {
    expect(invocationDirectory({ npm_lifecycle_event: 'start', INIT_CWD: '' }, '/repo')).toBe(
      '/repo',
    );
    expect(
      invocationDirectory({ npm_lifecycle_event: 'start', INIT_CWD: 'relative/dir' }, '/repo'),
    ).toBe('/repo');
  });
});

describe('parseCliArgs', () => {
  it('defaults to the current directory and an available port', () => {
    expect(parseCliArgs([], '/workspace')).toEqual({
      help: false,
      rootPath: '/workspace',
      port: 0,
    });
  });

  it('accepts one folder and a validated port in either order', () => {
    expect(parseCliArgs(['--port', '4317', './docs'], '/workspace')).toEqual({
      help: false,
      rootPath: resolve('/workspace', './docs'),
      port: 4317,
    });
    expect(parseCliArgs(['/tmp/notes', '--port=0'], '/workspace')).toEqual({
      help: false,
      rootPath: '/tmp/notes',
      port: 0,
    });
  });

  it('returns help without opening a folder', () => {
    expect(parseCliArgs(['--help'], '/workspace')).toEqual({ help: true });
    expect(parseCliArgs(['-h'], '/workspace')).toEqual({ help: true });
  });

  it.each([
    ['--port'],
    ['--port', '-1'],
    ['--port', '65536'],
    ['--port', '1.5'],
    ['--host', '0.0.0.0'],
    ['one', 'two'],
  ])('rejects unsafe or malformed arguments %s', (...args) => {
    expect(() => parseCliArgs(args, '/workspace')).toThrow(CliUsageError);
  });
});

describe('runCli', () => {
  let root: string;
  let uiRoot: string;

  beforeEach(async () => {
    [root, uiRoot] = await Promise.all([
      mkdtemp(join(tmpdir(), 'context-atlas-cli-')),
      mkdtemp(join(tmpdir(), 'context-atlas-cli-ui-')),
    ]);
    await mkdir(join(uiRoot, 'assets'));
    await writeFile(join(uiRoot, 'index.html'), '<!doctype html><title>Atlas</title>');
  });

  afterEach(async () => {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(uiRoot, { recursive: true, force: true }),
    ]);
  });

  it('starts the loopback API and prints no absolute folder path', async () => {
    const messages: string[] = [];
    const server = await runCli(
      [root],
      { log: (message) => messages.push(message) },
      { uiDirectory: uiRoot },
    );

    expect(server?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(messages).toEqual([`Context Atlas API listening at ${server?.url}`]);
    expect(messages.join(' ')).not.toContain(root);
    await expect(fetch(server?.url ?? '')).resolves.toMatchObject({ status: 200 });
    await server?.close();
  });

  it('prints usage and does not start a server when help is requested', async () => {
    const messages: string[] = [];
    await expect(runCli(['--help'], { log: (message) => messages.push(message) })).resolves.toBe(
      undefined,
    );
    expect(messages.join('\n')).toContain('context-atlas [folder] [--port <port>]');
  });
});
