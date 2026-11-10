import { describe, expect, it } from 'vitest';
import type { FileContent } from 'context-atlas-core';
import { isSafeRasterImageContent, resolveMarkdownTarget } from './markdown-targets.js';

describe('resolveMarkdownTarget', () => {
  it('resolves relative, scope-root, and fragment targets without traversing the scope', () => {
    expect(resolveMarkdownTarget('docs/guide.md', '../images/diagram.png?raw=1#preview')).toEqual({
      path: 'images/diagram.png',
      fragment: 'preview',
    });
    expect(resolveMarkdownTarget('docs/guide.md', '/README.md')).toEqual({ path: 'README.md' });
    expect(resolveMarkdownTarget('docs/guide.md', 'next.md#Details%20%26%20examples')).toEqual({
      path: 'docs/next.md',
      fragment: 'Details & examples',
    });
    expect(resolveMarkdownTarget('docs/guide.md', '#setup')).toEqual({
      path: 'docs/guide.md',
      fragment: 'setup',
    });
  });

  it.each([
    '../../../outside.md',
    'https://example.invalid/image.png',
    '//example.invalid/image.png',
    'javascript:alert(1)',
    '%2e%2e/private.md',
    '.git/config',
    'docs/.env.local',
    'docs\\guide.md',
  ])('rejects unsafe or excluded local targets: %s', (target) => {
    expect(resolveMarkdownTarget('docs/guide.md', target)).toBeUndefined();
  });
});

describe('isSafeRasterImageContent', () => {
  it('accepts bounded PNG bytes whose path and content type agree', () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const file: FileContent = {
      path: 'images/pixel.png',
      type: 'image',
      content: bytes,
      size: bytes.byteLength,
    };

    expect(isSafeRasterImageContent('images/pixel.png', file)).toBe('image/png');
  });

  it.each([
    {
      path: 'images/vector.svg',
      type: 'image',
      content: new Uint8Array([60, 115, 118, 103, 62]),
    },
    {
      path: 'images/not-a-png.png',
      type: 'image',
      content: new Uint8Array([60, 115, 118, 103, 62]),
    },
    {
      path: 'images/pixel.png',
      type: 'text',
      content: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    },
  ])('refuses unsafe image content %#', ({ path, type, content }) => {
    expect(
      isSafeRasterImageContent(path, {
        path,
        type: type as FileContent['type'],
        content,
        size: content.byteLength,
      }),
    ).toBeUndefined();
  });

  it('rejects mismatched paths and byte lengths', () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(
      isSafeRasterImageContent('images/pixel.png', {
        path: 'other/pixel.png',
        type: 'image',
        content: bytes,
        size: bytes.byteLength,
      }),
    ).toBeUndefined();
    expect(
      isSafeRasterImageContent('images/pixel.png', {
        path: 'images/pixel.png',
        type: 'image',
        content: bytes,
        size: bytes.byteLength + 1,
      }),
    ).toBeUndefined();
  });
});
