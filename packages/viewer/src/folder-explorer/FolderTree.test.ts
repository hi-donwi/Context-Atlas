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

  it('hides Git metadata and technical entries by default while retaining documents', () => {
    const markup = renderTree([
      { path: '.gitignore', name: '.gitignore', kind: 'file', type: 'text' },
      { path: '.gitattributes', name: '.gitattributes', kind: 'file', type: 'text' },
      { path: '.github', name: '.github', kind: 'dir', type: 'unknown' },
      { path: '.notes.md', name: '.notes.md', kind: 'file', type: 'markdown' },
      { path: 'test', name: 'test', kind: 'dir', type: 'unknown' },
      { path: 'runs', name: 'runs', kind: 'dir', type: 'unknown' },
      { path: 'package-lock.json', name: 'package-lock.json', kind: 'file', type: 'json' },
      { path: 'AGENTS.md', name: 'AGENTS.md', kind: 'file', type: 'markdown' },
      { path: 'api-spec.md', name: 'api-spec.md', kind: 'file', type: 'markdown' },
      { path: 'git-guide.md', name: 'git-guide.md', kind: 'file', type: 'markdown' },
    ]);

    expect(markup).not.toContain('.gitignore');
    expect(markup).not.toContain('.gitattributes');
    expect(markup).not.toContain('.github');
    expect(markup).toContain('.notes.md');
    expect(markup).not.toContain('Expand folder test');
    expect(markup).not.toContain('Expand folder runs');
    expect(markup).not.toContain('package-lock.json');
    expect(markup).not.toContain('AGENTS.md');
    expect(markup).toContain('api-spec.md');
    expect(markup).toContain('git-guide.md');
  });

  it('hides Git metadata inside expanded directories', () => {
    const markup = renderToStaticMarkup(
      createElement(FolderTree, {
        entries: [{ path: 'docs', name: 'docs', kind: 'dir', type: 'unknown' }],
        entriesByDirectory: {
          docs: [
            { path: 'docs/.gitkeep', name: '.gitkeep', kind: 'file', type: 'text' },
            { path: 'docs/readme.md', name: 'readme.md', kind: 'file', type: 'markdown' },
          ],
        },
        expandedDirectories: new Set(['docs']),
        loadingDirectories: new Set<string>(),
        directoryErrors: {},
        selectedPath: null,
        onToggleDirectory: () => undefined,
        onRetryDirectory: () => undefined,
        onSelectFile: () => undefined,
      }),
    );

    expect(markup).not.toContain('.gitkeep');
    expect(markup).toContain('readme.md');
  });
});
