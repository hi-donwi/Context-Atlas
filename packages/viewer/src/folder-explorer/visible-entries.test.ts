import { describe, expect, it } from 'vitest';
import type { Entry } from 'context-atlas-core';
import { prioritizeRootEntries, visibleFolderEntries } from './visible-entries.js';

describe('reader-friendly navigation', () => {
  it('prioritizes the readme and guides without mutating source order', () => {
    const entries: Entry[] = [
      { path: 'notes.md', name: 'notes.md', kind: 'file', type: 'markdown' },
      { path: 'docs', name: 'docs', kind: 'dir', type: 'unknown' },
      { path: 'guide', name: 'guide', kind: 'dir', type: 'unknown' },
      { path: 'README.md', name: 'README.md', kind: 'file', type: 'markdown' },
    ];

    expect(prioritizeRootEntries(entries).map((entry) => entry.name)).toEqual([
      'README.md',
      'guide',
      'docs',
      'notes.md',
    ]);
    expect(entries[0]?.name).toBe('notes.md');
  });

  it('keeps documentation and ordinary content while hiding technical items', () => {
    const entries: Entry[] = [
      { path: 'runs', name: 'runs', kind: 'dir', type: 'unknown' },
      { path: 'tests', name: 'tests', kind: 'dir', type: 'unknown' },
      { path: 'specs', name: 'specs', kind: 'dir', type: 'unknown' },
      { path: 'runs.md', name: 'runs.md', kind: 'file', type: 'markdown' },
      { path: 'check.test.ts', name: 'check.test.ts', kind: 'file', type: 'text' },
      { path: 'atlas.json', name: 'atlas.json', kind: 'file', type: 'json' },
      { path: '.gitignore', name: '.gitignore', kind: 'file', type: 'text' },
    ];

    expect(visibleFolderEntries(entries).map((entry) => entry.name)).toEqual(['specs', 'runs.md']);
  });
});
