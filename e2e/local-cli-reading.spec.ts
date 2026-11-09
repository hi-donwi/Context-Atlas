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
  fixtureRoot = await mkdtemp(join(tmpdir(), 'context-atlas-reading-fixture-'));
  await mkdir(join(fixtureRoot, 'guide'));
  await mkdir(join(fixtureRoot, 'data'));
  await writeFile(
    join(fixtureRoot, 'atlas.json'),
    JSON.stringify({ title: 'Reading aids', defaultDocument: 'guide/start.md' }),
  );
  await writeFile(join(fixtureRoot, 'README.md'), '# Readme fallback\n');
  await writeFile(
    join(fixtureRoot, 'guide', 'start.md'),
    '---\ntitle: Start here\nowner: docs team\ntags:\n  - onboarding\n  - visual\n---\n' +
      '# Start here\n\n' +
      '```mermaid\nflowchart LR\n  A[Read the guide] --> B[Open the data]\n```\n',
  );
  await writeFile(
    join(fixtureRoot, 'guide', 'schedule.md'),
    '# Draft schedule\n\n' +
      '```mermaid\ntimeline\n  title Milestones\n  November : Design review\n  December : Test cycle\n```\n\n' +
      '```mermaid\ngantt\n  title Work plan\n  dateFormat YYYY-MM-DD\n  section Delivery\n  Design review :2026-11-02, 2026-11-06\n  Test cycle :2026-12-01, 2026-12-11\n```\n',
  );
  await writeFile(
    join(fixtureRoot, 'data', 'endpoints.csv'),
    'method,path\nPOST,/orders\nGET,/health\nGET,/orders/10\nGET,/orders/9\n',
  );
  await startCli(fixtureRoot);
});

test('renders timeline and Gantt schedules with readable labels and diagram controls', async ({
  page,
}) => {
  await page.goto(cliUrl);
  await page.getByRole('button', { name: 'Expand folder guide' }).click();
  await page.getByRole('button', { name: 'Open Draft schedule (schedule.md)' }).click();
  await expect(page.getByRole('heading', { name: 'Draft schedule', level: 1 })).toBeVisible();
  const diagrams = page.getByRole('img', { name: 'Mermaid diagram' });
  await expect(diagrams).toHaveCount(2);
  await expect(diagrams.nth(0)).toContainText('Design review');
  await expect(diagrams.nth(1)).toContainText('Test cycle');
  await expect(page.getByRole('toolbar', { name: 'Diagram controls' })).toHaveCount(2);
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

test('opens the default document with metadata, diagram controls, and data tables', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(cliUrl);
  await expect(page.getByRole('heading', { name: 'Start here', level: 1 })).toBeVisible();
  await expect(page.locator('.atlas-folder-document__path')).toHaveText('guide/start.md');

  const metadata = page.getByRole('region', { name: 'Document metadata' });
  await expect(metadata.getByText('docs team', { exact: true })).toBeVisible();
  await expect(metadata.getByText('- onboarding\n- visual')).toBeVisible();
  await expect(page.getByText('owner: docs team')).toHaveCount(0);

  const controls = page.getByRole('toolbar', { name: 'Diagram controls' });
  await expect(page.getByRole('img', { name: 'Mermaid diagram' })).toBeVisible();
  await controls.getByRole('button', { name: 'Zoom in' }).click();
  await expect(controls.getByRole('button', { name: 'Reset zoom' })).toHaveText('125%');
  await controls.getByRole('button', { name: 'Reset zoom' }).click();
  await expect(controls.getByRole('button', { name: 'Reset zoom' })).toHaveText('100%');
  const download = page.waitForEvent('download');
  await controls.getByRole('button', { name: 'Download SVG' }).click();
  expect((await download).suggestedFilename()).toBe('start-diagram.svg');

  await page.getByRole('button', { name: 'Expand folder data' }).click();
  await page.getByRole('button', { name: 'Open endpoints.csv' }).click();
  const table = page.getByRole('region', { name: 'endpoints.csv' });
  await expect(table.getByRole('status')).toHaveText('4 of 4 rows');

  await table.getByRole('button', { name: 'Sort by path' }).click();
  await expect(table.locator('tbody tr td:nth-child(2)')).toHaveText([
    '/health',
    '/orders',
    '/orders/9',
    '/orders/10',
  ]);

  await table.getByRole('searchbox', { name: 'Filter rows' }).fill('get');
  await expect(table.getByRole('status')).toHaveText('3 of 4 rows');
  expect(consoleErrors).toEqual([]);
});
