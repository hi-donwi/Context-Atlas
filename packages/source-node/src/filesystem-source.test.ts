import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_FILE_SIZE_BYTES } from '@context-atlas/core';
import { FileSystemSourceError, openFolderSource } from './filesystem-source.js';

describe('openFolderSource', () => {
  let root: string;
  let outside: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'context-atlas-source-'));
    outside = await mkdtemp(join(tmpdir(), 'context-atlas-outside-'));
  });

  afterEach(async () => {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]);
  });

  it('opens one folder scope and applies an optional atlas.json title', async () => {
    await writeFile(join(root, 'atlas.json'), JSON.stringify({ title: '  Guides  ' }));
    const source = await openFolderSource(root);

    await expect(source.describe()).resolves.toEqual({
      title: 'Guides',
      profile: 'folder',
      scopes: [{ id: 'folder', label: 'Guides' }],
    });
  });

  it('uses the folder name when atlas.json is absent', async () => {
    const source = await openFolderSource(root);

    await expect(source.describe()).resolves.toMatchObject({
      title: basename(root),
      profile: 'folder',
      scopes: [{ id: 'folder', label: basename(root) }],
    });
  });

  it('fails closed when atlas.json requests unsupported scope filtering', async () => {
    await writeFile(
      join(root, 'atlas.json'),
      JSON.stringify({ title: 'Guides', exclude: ['private/**'] }),
    );

    await expect(openFolderSource(root)).rejects.toMatchObject({ code: 'UNSUPPORTED_METADATA' });
  });

  it('lists only safe file and directory entries and returns extracted titles', async () => {
    await mkdir(join(root, 'docs'));
    await mkdir(join(root, 'node_modules'));
    await writeFile(join(root, 'README.md'), '# Project guide\n');
    await writeFile(join(root, 'docs', 'guide.md'), '---\ntitle: Nested guide\n---\nBody');
    await writeFile(join(root, 'node_modules', 'hidden.js'), 'hidden');
    await writeFile(join(root, 'server.key'), 'private');

    const source = await openFolderSource(root);
    const rootEntries = await source.list('folder', '');
    const docsEntries = await source.list('folder', 'docs');

    expect(rootEntries.map(({ path }) => path)).toEqual(['docs', 'README.md']);
    expect(rootEntries.find(({ path }) => path === 'README.md')).toMatchObject({
      kind: 'file',
      type: 'markdown',
      title: 'Project guide',
    });
    expect(docsEntries.map(({ path }) => path)).toEqual(['docs/guide.md']);
    expect(docsEntries[0]).toMatchObject({ title: 'Nested guide' });
  });

  it('reads text and binary files with their type, byte size, and ISO timestamp', async () => {
    const text = '# Guide\n';
    const binary = Buffer.from([0, 1, 2, 255]);
    await writeFile(join(root, 'guide.md'), text);
    await writeFile(join(root, 'image.png'), binary);
    const source = await openFolderSource(root);

    const textContent = await source.read('folder', 'guide.md');
    const binaryContent = await source.read('folder', 'image.png');

    expect(textContent).toMatchObject({ path: 'guide.md', type: 'markdown', content: text });
    expect(textContent.size).toBe(Buffer.byteLength(text));
    expect(Number.isNaN(Date.parse(textContent.mtime ?? ''))).toBe(false);
    expect(binaryContent).toMatchObject({
      path: 'image.png',
      type: 'image',
      size: binary.byteLength,
    });
    expect(binaryContent.content).toEqual(new Uint8Array(binary));
  });

  it('rejects unsafe paths, excluded files, and unknown scopes on direct reads', async () => {
    await writeFile(join(root, 'guide.md'), '# Guide');
    await writeFile(join(root, '.env'), 'secret');
    const source = await openFolderSource(root);

    for (const path of ['../outside.md', '/etc/passwd', 'guide%2emd', '.env']) {
      await expect(source.read('folder', path)).rejects.toBeInstanceOf(FileSystemSourceError);
    }
    await expect(source.read('workspace', 'guide.md')).rejects.toMatchObject({
      code: 'INVALID_SCOPE',
    });
  });

  it('omits external symlinks from listings and denies direct reads through them', async () => {
    const secretPath = join(outside, 'secret.md');
    await writeFile(secretPath, '# Secret');
    await symlink(secretPath, join(root, 'escape.md'));
    const source = await openFolderSource(root);

    await expect(source.list('folder', '')).resolves.toEqual([]);
    await expect(source.read('folder', 'escape.md')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('does not expose an in-scope symlink alias to an excluded target', async () => {
    await mkdir(join(root, '.git'));
    await writeFile(join(root, '.git', 'secret.md'), '# Secret');
    await symlink(join(root, '.git', 'secret.md'), join(root, 'public.md'));
    const source = await openFolderSource(root);

    await expect(source.list('folder', '')).resolves.toEqual([]);
    await expect(source.read('folder', 'public.md')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lists oversized files as metadata only and refuses to read them', async () => {
    await writeFile(join(root, 'large.md'), Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, 65));
    const source = await openFolderSource(root);

    const entry = (await source.list('folder', ''))[0];
    expect(entry).toMatchObject({ path: 'large.md', kind: 'file', size: MAX_FILE_SIZE_BYTES + 1 });
    expect(entry?.title).toBeUndefined();
    await expect(source.read('folder', 'large.md')).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });
});
