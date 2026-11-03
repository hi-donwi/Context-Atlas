import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

let fixtureRoot: string;
let cliProcess: ChildProcessWithoutNullStreams;
let cliUrl: string;

async function startCli(root: string): Promise<void> {
  cliProcess = spawn(process.execPath, [resolve('apps/cli/dist/bin.js'), root, '--port', '0'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    let stdout = '';
    let stderr = '';
    cliProcess.stdout.setEncoding('utf8');
    cliProcess.stderr.setEncoding('utf8');
    cliProcess.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      const match = /Context Atlas API listening at (http:\/\/127\.0\.0\.1:\d+)/.exec(stdout);
      if (match !== null) {
        cliUrl = match[1]!;
        resolveReady();
      }
    });
    cliProcess.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    cliProcess.once('error', rejectReady);
    cliProcess.once('exit', (code) => {
      rejectReady(new Error(`Local CLI exited before startup (${code}): ${stderr}`));
    });
  });
}

test.beforeAll(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), 'context-atlas-events-fixture-'));
  await mkdir(join(fixtureRoot, 'docs'));
  await writeFile(join(fixtureRoot, 'docs', 'selected.txt'), 'An initial note about orchids.');
  await startCli(fixtureRoot);
});

test.afterAll(async () => {
  if (cliProcess !== undefined && cliProcess.exitCode === null) {
    await new Promise<void>((resolveExit) => {
      cliProcess.once('exit', () => resolveExit());
      cliProcess.kill('SIGTERM');
    });
  }
  if (fixtureRoot !== undefined) await rm(fixtureRoot, { recursive: true, force: true });
});

test('refreshes changed files, folders, and the local search index', async ({ page }) => {
  const externalRequests: string[] = [];
  const eventRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(cliUrl)) externalRequests.push(request.url());
    if (request.url().startsWith(`${cliUrl}/atlas/api/events`)) eventRequests.push(request.url());
  });

  await page.goto(cliUrl);
  await expect(page.getByRole('heading', { name: /context-atlas-events-fixture-/ })).toBeVisible();
  await expect.poll(() => eventRequests.length).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Expand folder docs' }).click();
  await page.getByRole('button', { name: 'Open selected.txt' }).click();
  await expect(page.getByText('An initial note about orchids.')).toBeVisible();

  await page.keyboard.press('Control+k');
  const searchInput = page.getByRole('searchbox', { name: 'Search files in this folder' });
  await searchInput.fill('orchids');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('button', { name: /Open selected.txt/ })).toBeVisible();

  await writeFile(
    join(fixtureRoot, 'docs', 'selected.txt'),
    'Updated note with the unique freshcontexttoken.',
  );
  await expect(page.getByText('Updated note with the unique freshcontexttoken.')).toBeVisible();

  await writeFile(join(fixtureRoot, 'docs', 'added.txt'), 'A newly added document.');
  await expect(page.getByRole('button', { name: 'Open added.txt' })).toBeVisible();

  await searchInput.fill('freshcontexttoken');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('button', { name: /Open selected.txt/ })).toBeVisible();
  expect(externalRequests).toEqual([]);
});
