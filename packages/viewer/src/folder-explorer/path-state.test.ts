import { describe, expect, it } from 'vitest';
import type { Entry } from '@context-atlas/core';
import {
  findDefaultDocument,
  formatExplorerLocation,
  parseExplorerLocation,
} from './path-state.js';

const file = (path: string, name: string): Entry => ({
  path,
  name,
  kind: 'file',
  type: 'markdown',
});

describe('folder explorer path state', () => {
  it('prefers README.md, then index.md, and ignores matching directories', () => {
    const entries: Entry[] = [
      { path: 'README.md', name: 'README.md', kind: 'dir', type: 'unknown' },
      file('index.md', 'index.md'),
      file('README.md', 'README.md'),
    ];

    expect(findDefaultDocument(entries)).toBe('README.md');
    expect(findDefaultDocument([file('index.md', 'index.md')])).toBe('index.md');
    expect(findDefaultDocument([file('notes.md', 'notes.md')])).toBeUndefined();
  });

  it('round-trips a safe nested path through a reloadable URL hash', () => {
    const hash = formatExplorerLocation('folder', 'docs/Release notes #1.md');

    expect(hash).toBe('#/folder/docs/Release%20notes%20%231.md');
    expect(parseExplorerLocation(hash)).toEqual({
      scopeId: 'folder',
      path: 'docs/Release notes #1.md',
    });
  });

  it('ignores empty, incomplete, malformed, and unsafe URL hashes', () => {
    expect(parseExplorerLocation('')).toBeUndefined();
    expect(parseExplorerLocation('#/folder')).toBeUndefined();
    expect(parseExplorerLocation('#/folder/../private.md')).toBeUndefined();
    expect(parseExplorerLocation('#/folder/%E0%A4%A')).toBeUndefined();
  });
});
