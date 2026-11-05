import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { test, expect } from '@playwright/test';

let fixtureRoot: string;
let cliProcess: ChildProcessWithoutNullStreams;
let cliUrl: string;

function pngChunk(type: string, data: Buffer): Buffer {
  const chunkType = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([chunkType, data]);
  let crc = 0xffffffff;
  for (const byte of crcInput) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, crcInput, checksum]);
}

function createPixelPng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.from([0, 23, 110, 92, 255]))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

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
  await mkdir(join(fixtureRoot, 'assets'));
  await writeFile(join(fixtureRoot, 'atlas.json'), JSON.stringify({ title: 'Browser guide' }));
  await writeFile(
    join(fixtureRoot, 'README.md'),
    '# Reading this folder\n\n> **In plain words:** the document is formatted.\n\n' +
      '```mermaid\nflowchart LR\n  A[Markdown source] --> B[Rendered diagram]\n```\n\n' +
      '```mermaid\nnot-a-supported-diagram\n```\n\n' +
      'Unsafe tags stay visible as source: <script>window.sourceRan = true</script>\n\n' +
      '[Open the nested section](docs/note.md#Destination%20details) · [Blocked outside link](../outside.md)\n\n' +
      '![local image](assets/pixel.png)\n\n' +
      '![remote image](https://example.invalid/image.png)',
  );
  await writeFile(join(fixtureRoot, 'docs', 'note.txt'), 'A nested local note about orchids.');
  await writeFile(
    join(fixtureRoot, 'docs', 'note.md'),
    '# Nested note\n\n## Destination details\n\nSection content.\n\n' +
      Array.from({ length: 24 }, (_, index) => `Additional local paragraph ${index + 1}.`).join(
        '\n\n',
      ) +
      '\n\n[Back to README](../README.md)',
  );
  await writeFile(join(fixtureRoot, 'assets', 'pixel.png'), createPixelPng());
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
    if (!request.url().startsWith(cliUrl) && !request.url().startsWith('blob:')) {
      externalRequests.push(request.url());
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(cliUrl);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/assets/favicon.svg');
  const favicon = await page.request.get(new URL('/assets/favicon.svg', cliUrl).href);
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()['content-type']).toContain('image/svg+xml');
  await expect(page.getByRole('heading', { name: 'Browser guide' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reading this folder' })).toBeVisible();
  await expect(page.getByText('In plain words:', { exact: false })).toBeVisible();
  await expect(page.getByText('Image not loaded: remote image')).toBeVisible();
  const localImage = page.getByRole('img', { name: 'local image' });
  await expect(localImage).toBeVisible();
  await expect(localImage).toHaveAttribute('src', /^blob:/);
  await expect(localImage).toHaveJSProperty('naturalWidth', 1);
  await expect(page.locator('.atlas-mermaid__svg svg')).toBeVisible();
  await expect(page.getByText('This Mermaid diagram could not be rendered.')).toBeVisible();
  await expect(page.getByText('flowchart LR', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Blocked outside link', { exact: true }).locator('xpath=ancestor::a'),
  ).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Folder contents' })).toBeVisible();
  await expect(page.getByText(/Unsafe tags stay visible as source/)).toBeVisible();
  await expect(
    page.evaluate(() => (window as Window & { sourceRan?: boolean }).sourceRan),
  ).resolves.toBe(undefined);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to document' })).toBeFocused();

  await page.getByRole('link', { name: 'Open the nested section' }).click();
  await expect(page.getByRole('heading', { name: 'Nested note' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Destination details' })).toHaveAttribute(
    'id',
    'destination-details',
  );
  await expect
    .poll(() => page.evaluate(() => window.location.hash))
    .toContain('#destination-details');
  await expect
    .poll(() =>
      page.evaluate(
        () => document.getElementById('destination-details')?.getBoundingClientRect().top,
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.getElementById('destination-details')?.getBoundingClientRect().top,
      ),
    )
    .toBeLessThan(200);
  await expect(page.locator('.atlas-folder-document__path')).toHaveText('docs/note.md');
  await page.getByRole('link', { name: 'Back to README' }).click();
  await expect(page.getByRole('heading', { name: 'Reading this folder' })).toBeVisible();

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
