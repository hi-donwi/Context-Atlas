import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, expect } from '@playwright/test';

let fixtureRoot: string;
let cliProcess: ChildProcessWithoutNullStreams;
let cliUrl: string;

async function startCli(root: string): Promise<void> {
  const cliPath = resolve('apps/cli/dist/bin.js');
  cliProcess = spawn(process.execPath, [cliPath, root, '--port', '0'], {
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
  fixtureRoot = await mkdtemp(join(tmpdir(), 'context-atlas-browser-fixture-'));
  await mkdir(join(fixtureRoot, 'docs'));
  await writeFile(join(fixtureRoot, 'atlas.json'), JSON.stringify({ title: 'Browser guide' }));
  await writeFile(
    join(fixtureRoot, 'README.md'),
    '# Browser guide\n\nUnsafe tags stay visible as source: <script>window.sourceRan = true</script>',
  );
  await writeFile(join(fixtureRoot, 'docs', 'note.txt'), 'A nested local note about orchids.');
  await writeFile(join(fixtureRoot, 'image.png'), Buffer.from([0, 1, 2, 255]));
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

test('browse a local folder with keyboard controls, safe previews, and mobile reflow', async ({
  page,
}) => {
  const externalRequests: string[] = [];
  const consoleErrors: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(cliUrl)) externalRequests.push(request.url());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(cliUrl);
  await expect(page.getByRole('heading', { name: 'Browser guide' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Folder contents' })).toBeVisible();
  await expect(page.getByText(/Unsafe tags stay visible as source/)).toBeVisible();
  await expect(
    page.evaluate(() => (window as Window & { sourceRan?: boolean }).sourceRan),
  ).resolves.toBe(undefined);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to document' })).toBeFocused();

  const docsButton = page.getByRole('button', { name: 'Expand folder docs' });
  await docsButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Collapse folder docs' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('button', { name: 'Open note.txt' }).click();
  await expect(page.getByText('A nested local note about orchids.')).toBeVisible();

  await page.getByRole('button', { name: 'Open image.png' }).click();
  await expect(page.getByText('Binary preview unavailable')).toBeVisible();
  await expect(page.getByText('4 bytes', { exact: true })).toBeVisible();

  await page.keyboard.press('Control+k');
  const searchInput = page.getByRole('searchbox', { name: 'Search files in this folder' });
  await expect(searchInput).toBeFocused();
  await searchInput.fill('orch');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const searchResult = page.getByRole('button', { name: 'Open note.txt at docs/note.txt, line 1' });
  await expect(searchResult).toBeVisible();
  await searchResult.press('Enter');
  await expect(page.getByText('A nested local note about orchids.')).toBeVisible();

  await page.keyboard.press('Control+k');
  await searchInput.fill('zzzznoresulttoken');
  await searchInput.press('Enter');
  await expect(page.getByText('No matching files found.', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 800 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  expect(externalRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
