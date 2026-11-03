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

  it('returns ranked text matches with a bounded matching snippet and one-based line', async () => {
    await mkdir(join(root, 'docs'));
    await writeFile(
      join(root, 'docs', 'orchid-care.md'),
      '# Orchid care\n\nOrchids prefer shade.\n',
    );
    await writeFile(join(root, 'notes.md'), '# Notes\n\nFlowers need water.\n');
    const source = await openFolderSource(root);

    const hits = await source.search!('folder', 'orchids shade');
    const orchidHit = hits.find(({ path }) => path === 'docs/orchid-care.md');

    expect(orchidHit).toBeDefined();
    expect(orchidHit?.title).toBe('Orchid care');
    expect(orchidHit?.snippet).toContain('Orchids prefer shade.');
    expect(orchidHit?.line).toBe(3);
    expect(orchidHit?.score).toBeGreaterThan(0);
  });

  it('ranks a matching document title above a body-only match', async () => {
    await writeFile(join(root, 'orchid-guide.md'), '# Orchid guide\nCare notes.\n');
    await writeFile(join(root, 'garden-notes.md'), '# Garden notes\nOrchid care notes.\n');
    const source = await openFolderSource(root);

    const hits = await source.search!('folder', 'orchid');

    expect(hits.map(({ path }) => path)).toEqual(['orchid-guide.md', 'garden-notes.md']);
  });

  it('never indexes excluded paths, binary files, or files outside the scope', async () => {
    await mkdir(join(root, 'node_modules'));
    await writeFile(join(root, '.env'), 'orchid private');
    await writeFile(join(root, 'node_modules', 'secret.md'), 'orchid private');
    await writeFile(join(root, 'image.png'), Buffer.from('orchid private'));
    await writeFile(join(outside, 'outside.md'), 'orchid private');
    await symlink(join(outside, 'outside.md'), join(root, 'outside.md'));
    await writeFile(join(root, 'public.txt'), 'ordinary orchid note');
    const source = await openFolderSource(root);

    const privateHits = await source.search!('folder', 'private');
    const orchidHits = await source.search!('folder', 'orchid');

    expect(privateHits.map(({ path }) => path)).toEqual([]);
    expect(orchidHits.map(({ path }) => path)).toEqual(['public.txt']);
    await expect(source.search!('other-scope', 'orchid')).rejects.toMatchObject({
      code: 'INVALID_SCOPE',
    });
  });

  it('rejects empty and overlong search queries', async () => {
    const source = await openFolderSource(root);

    await expect(source.search!('folder', '   ')).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    await expect(source.search!('folder', 'x'.repeat(201))).rejects.toMatchObject({
      code: 'INVALID_QUERY',
    });
  });

  it('caps results and snippets for a query matching many files', async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        writeFile(
          join(root, `note-${index}.md`),
          `${'padding '.repeat(80)}needle result ${index}${' trailing'.repeat(80)}`,
        ),
      ),
    );
    const source = await openFolderSource(root);

    const hits = await source.search!('folder', 'needle');

    expect(hits).toHaveLength(20);
    expect(hits.every(({ snippet }) => (snippet?.length ?? 0) <= 240)).toBe(true);
    expect(hits.every(({ snippet }) => snippet?.includes('needle'))).toBe(true);
  });

  it('keeps the lazy index as a process-local snapshot until a source is reopened', async () => {
    await writeFile(join(root, 'initial.txt'), 'A local starting document.');
    const source = await openFolderSource(root);
    await source.search!('folder', 'newlyadded');

    await writeFile(join(root, 'later.txt'), 'A newlyadded local document.');

    await expect(source.search!('folder', 'newlyadded')).resolves.toEqual([]);
    const reopenedSource = await openFolderSource(root);
    await expect(reopenedSource.search!('folder', 'newlyadded')).resolves.toMatchObject([
      { path: 'later.txt', line: 1 },
    ]);
  });

  it('coalesces safe changed paths and invalidates the lazy search index', async () => {
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'first.txt'), 'old content');
    await writeFile(join(root, 'docs', 'second.txt'), 'old content');
    const source = await openFolderSource(root);
    await expect(source.search!('folder', 'freshneedle')).resolves.toEqual([]);

    const nextChange = new Promise<string[]>((resolveChange) => {
      const unsubscribe = source.watch!((paths) => {
        unsubscribe();
        resolveChange(paths);
      });
    });
    await Promise.all([
      writeFile(join(root, 'first.txt'), 'freshneedle in first file'),
      writeFile(join(root, 'docs', 'second.txt'), 'freshneedle in second file'),
    ]);

    const paths = await nextChange;
    expect(paths).toContain('first.txt');
    expect(paths).toContain('docs/second.txt');
    expect(paths.every((path) => !path.startsWith('/') && !path.includes('\\'))).toBe(true);
    await expect(source.search!('folder', 'freshneedle')).resolves.toHaveLength(2);
  });

  it('does not report excluded changes and stops reporting after unsubscribe', async () => {
    await mkdir(join(root, '.git'));
    await mkdir(join(root, 'node_modules'));
    await writeFile(join(outside, 'secret.md'), 'private');
    const source = await openFolderSource(root);
    const changes: string[][] = [];
    const unsubscribe = source.watch!((paths) => changes.push(paths));

    await writeFile(join(root, '.git', 'secret.md'), 'private');
    await writeFile(join(root, 'node_modules', 'secret.md'), 'private');
    await symlink(join(outside, 'secret.md'), join(root, 'external.md'));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    expect(changes.flat()).toEqual([]);

    unsubscribe();
    const reportedBeforeUnsubscribe = changes.length;
    await writeFile(join(root, 'ordinary.txt'), 'visible');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    expect(changes).toHaveLength(reportedBeforeUnsubscribe);
  });

  it('uses a full refresh when a changed directory has multiple in-scope symlink paths', async () => {
    await mkdir(join(root, 'target'));
    await writeFile(join(root, 'target', 'guide.md'), 'before');
    await symlink(join(root, 'target'), join(root, 'alias'));
    await symlink(join(root, 'target', 'guide.md'), join(root, 'guide-alias.md'));
    const source = await openFolderSource(root);
    let unsubscribe = (): void => undefined;
    const nextChange = new Promise<string[]>((resolveChange) => {
      unsubscribe = source.watch!((paths) => {
        unsubscribe();
        resolveChange(paths);
      });
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));

    await writeFile(join(root, 'target', 'guide.md'), 'after');

    await expect(nextChange).resolves.toEqual([]);
  });
});
