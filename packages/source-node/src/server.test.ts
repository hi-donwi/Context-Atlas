import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openFolderSource } from './filesystem-source.js';
import { startLocalApiServer } from './server.js';

interface HttpResult {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: string;
}

function getWithHost(urlValue: string, host: string): Promise<HttpResult> {
  const url = new URL(urlValue);
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: url.hostname,
        port: Number(url.port),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { host },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('error', reject);
    request.end();
  });
}

describe('startLocalApiServer', () => {
  let root: string;
  let server: Awaited<ReturnType<typeof startLocalApiServer>>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'context-atlas-api-'));
    await writeFile(join(root, 'README.md'), '# Local guide\n');
    await writeFile(join(root, 'image.png'), Buffer.from([0, 1, 2, 255]));
    const source = await openFolderSource(root);
    server = await startLocalApiServer(source);
  });

  afterEach(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  it('binds only to IPv4 loopback and serves folder info without CORS', async () => {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const response = await fetch(`${server.url}/atlas/api/info`);

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('content-security-policy')).toBe("default-src 'self'");
    await expect(response.json()).resolves.toMatchObject({
      profile: 'folder',
      scopes: [{ id: 'folder' }],
    });
  });

  it('serves one-level tree entries for the requested folder scope', async () => {
    const response = await fetch(`${server.url}/atlas/api/tree?scope=folder&dir=`);
    const entries = (await response.json()) as Array<{ path: string; kind: string }>;

    expect(response.status).toBe(200);
    expect(entries.map(({ path }) => path)).toEqual(['image.png', 'README.md']);
    expect(entries.every((entry) => entry.kind === 'file')).toBe(true);
  });

  it('serves text file content with explicit UTF-8 encoding', async () => {
    const response = await fetch(`${server.url}/atlas/api/file?scope=folder&path=README.md`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      path: 'README.md',
      type: 'markdown',
      content: '# Local guide\n',
      encoding: 'utf-8',
    });
  });

  it('encodes binary file bytes as base64 JSON', async () => {
    const response = await fetch(`${server.url}/atlas/api/file?scope=folder&path=image.png`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      path: 'image.png',
      type: 'image',
      content: 'AAEC/w==',
      encoding: 'base64',
    });
  });

  it('returns stable problem details for malformed, missing, and excluded paths', async () => {
    const traversal = await fetch(`${server.url}/atlas/api/file?scope=folder&path=..%2Fsecret.md`);
    const missing = await fetch(`${server.url}/atlas/api/file?scope=folder&path=missing.md`);
    const excluded = await fetch(`${server.url}/atlas/api/file?scope=folder&path=.env`);

    expect(traversal.status).toBe(400);
    await expect(traversal.json()).resolves.toMatchObject({
      status: 400,
      code: 'INVALID_PATH',
      instance: '/atlas/api/file',
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(excluded.status).toBe(404);
    await expect(excluded.json()).resolves.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('requires a single valid scope and rejects duplicate query parameters', async () => {
    const missingScope = await fetch(`${server.url}/atlas/api/tree`);
    const invalidScope = await fetch(`${server.url}/atlas/api/tree?scope=workspace`);
    const duplicateScope = await fetch(`${server.url}/atlas/api/tree?scope=folder&scope=folder`);

    expect(missingScope.status).toBe(400);
    expect(invalidScope.status).toBe(404);
    expect(duplicateScope.status).toBe(400);
    await expect(duplicateScope.json()).resolves.toMatchObject({ code: 'INVALID_QUERY' });
  });

  it('rejects unexpected Host headers and non-GET methods', async () => {
    const wrongHost = await getWithHost(`${server.url}/atlas/api/info`, 'attacker.example');
    const post = await fetch(`${server.url}/atlas/api/info`, { method: 'POST' });

    expect(wrongHost.status).toBe(403);
    expect(JSON.parse(wrongHost.body)).toMatchObject({ code: 'HOST_NOT_ALLOWED', status: 403 });
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET');
  });

  it('caps text responses at 5 MiB and refuses unsupported routes', async () => {
    await writeFile(join(root, 'large.txt'), Buffer.alloc(5 * 1024 * 1024 + 1, 65));
    const tooLarge = await fetch(`${server.url}/atlas/api/file?scope=folder&path=large.txt`);
    const search = await fetch(`${server.url}/atlas/api/search?scope=folder&q=guide`);

    expect(tooLarge.status).toBe(413);
    await expect(tooLarge.json()).resolves.toMatchObject({ code: 'FILE_TOO_LARGE', status: 413 });
    expect(search.status).toBe(404);
  });
});
