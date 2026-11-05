import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Entry } from '@context-atlas/core';
import { FolderTree } from './FolderTree.js';

function renderTree(entries: Entry[]): string {
  return renderToStaticMarkup(
    createElement(FolderTree, {
      entries,
      entriesByDirectory: {},
      expandedDirectories: new Set<string>(),
      loadingDirectories: new Set<string>(),
      directoryErrors: {},
      selectedPath: null,
      onToggleDirectory: () => undefined,
      onRetryDirectory: () => undefined,
      onSelectFile: () => undefined,
    }),
  );
}

describe('FolderTree', () => {
  it('shows a document title first and keeps the file name visible and in the label', () => {
    const markup = renderTree([
      {
        path: 'guide/01-big-picture.md',
        name: '01-big-picture.md',
        kind: 'file',
        type: 'markdown',
        title: '1. Big picture',
      },
    ]);

    expect(markup).toContain('aria-label="Open 1. Big picture (01-big-picture.md)"');
    expect(markup).toContain('<span class="atlas-folder-tree__title">1. Big picture</span>');
    expect(markup).toContain('<span class="atlas-folder-tree__name">01-big-picture.md</span>');
  });

  it('uses the file name alone when there is no distinct title', () => {
    const markup = renderTree([
      { path: 'notes.txt', name: 'notes.txt', kind: 'file', type: 'text' },
      { path: 'same.md', name: 'same.md', kind: 'file', type: 'markdown', title: 'same.md' },
    ]);

    expect(markup).toContain('aria-label="Open notes.txt"');
    expect(markup).toContain('aria-label="Open same.md"');
    expect(markup).not.toContain('atlas-folder-tree__name');
  });
});
