import { describe, expect, it, vi } from 'vitest';
import {
  createApiContentSource,
  LocalApiProtocolError,
  LocalApiRequestError,
} from './api-content-source.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

describe('createApiContentSource', () => {
  it('reads source info and one-level tree from same-origin API paths', async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher
      .mockResolvedValueOnce(
        jsonResponse({
          title: 'Project notes',
          profile: 'folder',
          scopes: [{ id: 'folder', label: 'Project notes' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            path: 'docs/guide.md',
            name: 'guide.md',
            kind: 'file',
            type: 'markdown',
            size: 12,
          },
        ]),
      );
    const source = createApiContentSource(fetcher);

    await expect(source.describe()).resolves.toMatchObject({
      title: 'Project notes',
      profile: 'folder',
      scopes: [{ id: 'folder' }],
    });
    await expect(source.list('folder', 'docs/release notes')).resolves.toMatchObject([
      { path: 'docs/guide.md', kind: 'file', type: 'markdown' },
    ]);

    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      '/atlas/api/info',
      '/atlas/api/tree?scope=folder&dir=docs%2Frelease+notes',
    ]);
  });

  it('returns text files without changing their content', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        path: 'guide.md',
        type: 'markdown',
        content: '# Guide\n\n<body> stays text',
        encoding: 'utf-8',
        size: 26,
        mtime: '2026-11-04T00:00:00.000Z',
      }),
    );
    const source = createApiContentSource(fetcher);

    await expect(source.read('folder', 'guide.md')).resolves.toEqual({
      path: 'guide.md',
      type: 'markdown',
      content: '# Guide\n\n<body> stays text',
      size: 26,
      mtime: '2026-11-04T00:00:00.000Z',
    });
  });

  it('decodes binary file content from base64 into bytes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        path: 'diagram.bin',
        type: 'binary',
        content: 'AAEC/w==',
        encoding: 'base64',
        size: 4,
      }),
    );
    const source = createApiContentSource(fetcher);

    const file = await source.read('folder', 'diagram.bin');

    expect(file.content).toEqual(new Uint8Array([0, 1, 2, 255]));
    expect(file.size).toBe(4);
  });

  it('searches the requested scope and validates ranked hits', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse([
        {
          path: 'docs/orchids.md',
          title: 'Orchid guide',
          snippet: 'Orchid care needs light.',
          score: 1.25,
          line: 8,
        },
      ]),
    );
    const source = createApiContentSource(fetcher);

    await expect(source.search!('folder', ' orchid guide ')).resolves.toEqual([
      {
        path: 'docs/orchids.md',
        title: 'Orchid guide',
        snippet: 'Orchid care needs light.',
        score: 1.25,
        line: 8,
      },
    ]);
    expect(fetcher).toHaveBeenCalledWith('/atlas/api/search?scope=folder&q=+orchid+guide+', {
      headers: { Accept: 'application/json' },
    });
  });

  it('rejects malformed search hit payloads', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse([{ path: '../private.md', snippet: 5, score: 'high', line: 0 }]),
      );
    const source = createApiContentSource(fetcher);

    await expect(source.search!('folder', 'private')).rejects.toBeInstanceOf(LocalApiProtocolError);
  });

  it('exposes safe RFC 9457 detail without losing status and code', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: 'The requested item was not found.',
          instance: '/atlas/api/file',
          code: 'NOT_FOUND',
        },
        404,
      ),
    );
    const source = createApiContentSource(fetcher);

    const read = source.read('folder', 'missing.md');

    await expect(read).rejects.toBeInstanceOf(LocalApiRequestError);
    await expect(read).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'The requested item was not found.',
    });
  });

  it('rejects malformed server responses and invalid base64', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ title: 5, profile: 'folder', scopes: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          path: 'image.png',
          type: 'image',
          content: 'not base64!',
          encoding: 'base64',
          size: 4,
        }),
      );
    const source = createApiContentSource(fetcher);

    await expect(source.describe()).rejects.toBeInstanceOf(LocalApiProtocolError);
    await expect(source.read('folder', 'image.png')).rejects.toBeInstanceOf(LocalApiProtocolError);
  });
});
