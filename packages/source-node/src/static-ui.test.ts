import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openFolderSource } from './filesystem-source.js';
import { startLocalApiServer } from './server.js';

describe('CLI UI static hosting', () => {
  let sourceRoot: string;
  let uiRoot: string;
  let outsideRoot: string;
  let server: Awaited<ReturnType<typeof startLocalApiServer>>;

  beforeEach(async () => {
    [sourceRoot, uiRoot, outsideRoot] = await Promise.all([
      mkdtemp(join(tmpdir(), 'context-atlas-ui-source-')),
      mkdtemp(join(tmpdir(), 'context-atlas-ui-bundle-')),
      mkdtemp(join(tmpdir(), 'context-atlas-ui-outside-')),
    ]);
    await mkdir(join(uiRoot, 'assets'));
    await writeFile(join(uiRoot, 'index.html'), '<!doctype html><title>Atlas</title>');
    await writeFile(join(uiRoot, 'assets', 'app.js'), 'document.title = "Atlas";');
    await writeFile(join(uiRoot, 'private.js'), 'must not be served');
    await writeFile(join(sourceRoot, 'notes.md'), 'source content stays behind the API');
    const source = await openFolderSource(sourceRoot);
    server = await startLocalApiServer(source, { uiDirectory: uiRoot });
  });

  afterEach(async () => {
    await server?.close();
    await Promise.all([
      rm(sourceRoot, { recursive: true, force: true }),
      rm(uiRoot, { recursive: true, force: true }),
      rm(outsideRoot, { recursive: true, force: true }),
    ]);
  });

  it('serves the bundled index and assets from the same origin with safe headers', async () => {
    const index = await fetch(server.url);
    const script = await fetch(`${server.url}/assets/app.js`);

    expect(index.status).toBe(200);
    expect(index.headers.get('content-type')).toContain('text/html');
    expect(index.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(index.headers.get('access-control-allow-origin')).toBeNull();
    await expect(index.text()).resolves.toContain('<title>Atlas</title>');
    expect(script.status).toBe(200);
    expect(script.headers.get('content-type')).toContain('javascript');
    await expect(script.text()).resolves.toContain('document.title');
  });

  it('does not serve opened-folder files or arbitrary files beside the UI bundle', async () => {
    const sourceFile = await fetch(`${server.url}/notes.md`);
    const bundleFile = await fetch(`${server.url}/private.js`);
    const missingAsset = await fetch(`${server.url}/assets/missing.js`);

    expect(sourceFile.status).toBe(404);
    expect(bundleFile.status).toBe(404);
    expect(missingAsset.status).toBe(404);
    await expect(sourceFile.json()).resolves.toMatchObject({ code: 'ROUTE_NOT_FOUND' });
  });

  it('rejects asset traversal and symlinks that resolve outside the bundle root', async () => {
    await writeFile(join(outsideRoot, 'escape.js'), 'outside bundle');
    await symlink(join(outsideRoot, 'escape.js'), join(uiRoot, 'assets', 'escape.js'));

    const traversal = await fetch(`${server.url}/assets/%2e%2e/private.js`);
    const symlinkEscape = await fetch(`${server.url}/assets/escape.js`);

    expect(traversal.status).toBe(404);
    expect(symlinkEscape.status).toBe(404);
  });

  it('keeps API routes available and serves search results from the same origin', async () => {
    const info = await fetch(`${server.url}/atlas/api/info`);
    const search = await fetch(`${server.url}/atlas/api/search?scope=folder&q=source`);

    expect(info.status).toBe(200);
    expect(search.status).toBe(200);
    expect(search.headers.get('content-type')).toContain('application/json');
    await expect(search.json()).resolves.toMatchObject([{ path: 'notes.md' }]);

    const unknownRoute = await fetch(`${server.url}/atlas/api/unknown`);
    expect(unknownRoute.status).toBe(404);
    expect(unknownRoute.headers.get('content-type')).toContain('application/problem+json');
  });

  it('returns 404 for the UI root when static hosting is not configured', async () => {
    const source = await openFolderSource(sourceRoot);
    const apiOnlyServer = await startLocalApiServer(source);

    try {
      const response = await fetch(apiOnlyServer.url);
      expect(response.status).toBe(404);
    } finally {
      await apiOnlyServer.close();
    }
  });

  it('does not serve assets for non-GET requests', async () => {
    const response = await fetch(`${server.url}/assets/app.js`, { method: 'POST' });

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });

  it('rejects a request with an unexpected Host header on the UI route', async () => {
    const address = new URL(server.url);
    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const request = httpRequest(
        {
          hostname: address.hostname,
          port: Number(address.port),
          path: '/',
          headers: { host: 'attacker.example' },
        },
        (incoming) => {
          const chunks: Buffer[] = [];
          incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
          incoming.on('end', () =>
            resolve({
              status: incoming.statusCode ?? 0,
              body: Buffer.concat(chunks).toString('utf8'),
            }),
          );
        },
      );
      request.on('error', reject);
      request.end();
    });

    expect(response.status).toBe(403);
    expect(JSON.parse(response.body)).toMatchObject({ code: 'HOST_NOT_ALLOWED' });
  });
});
