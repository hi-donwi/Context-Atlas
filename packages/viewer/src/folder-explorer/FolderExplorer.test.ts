import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentSource } from 'context-atlas-core';
import { FolderExplorer } from '../FolderExplorer.js';

const source: ContentSource = {
  async describe() {
    return { title: 'Guide', profile: 'folder', scopes: [{ id: 'folder', label: 'Folder' }] };
  },
  async list() {
    return [];
  },
  async read(_scopeId, path) {
    return { path, type: 'text', content: '', size: 0 };
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('FolderExplorer', () => {
  it('keeps the initial render stable for hydration when a browser preference exists', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => 'id' } });
    const markup = renderToStaticMarkup(createElement(FolderExplorer, { source }));

    expect(markup).toContain('Interface language');
    expect(markup).not.toContain('Bahasa antarmuka');
  });
});
