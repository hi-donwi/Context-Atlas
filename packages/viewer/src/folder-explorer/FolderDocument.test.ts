import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ContentSource, FileContent } from 'context-atlas-core';
import { FolderDocument } from './FolderDocument.js';
import { FolderLocaleContext } from './locale.js';

const source: ContentSource = {
  async describe() {
    return { title: 'Test source', profile: 'folder', scopes: [{ id: 'test', label: 'Test' }] };
  },
  async list() {
    return [];
  },
  async read() {
    return { path: 'docs/image.png', type: 'image', content: new Uint8Array(), size: 0 };
  },
};

function renderDocument(type: FileContent['type'], content: string): string {
  return renderToStaticMarkup(
    createElement(FolderDocument, {
      path: type === 'mermaid' ? 'docs/architecture.mmd' : 'docs/guide.md',
      scopeId: 'test',
      source,
      onNavigate: () => undefined,
      file: {
        path: 'docs/guide.md',
        type,
        content,
        size: new TextEncoder().encode(content).length,
      },
    }),
  );
}

describe('FolderDocument', () => {
  it('renders Markdown headings, blockquotes, and GFM tables as formatted content', () => {
    const markup = renderDocument(
      'markdown',
      '# Local guide\n\n> **In plain words:** readable content.\n\n| Route | Method |\n| --- | --- |\n| /health | GET |',
    );

    expect(markup).toContain('<h1 id="local-guide">Local guide</h1>');
    expect(markup).toContain('<blockquote>');
    expect(markup).toContain('<table>');
  });

  it('assigns unique heading anchors for repeated Markdown headings', () => {
    const markup = renderDocument('markdown', '# Setup\n\n# Setup');

    expect(markup).toContain('<h1 id="setup">Setup</h1>');
    expect(markup).toContain('<h1 id="setup-1">Setup</h1>');
  });

  it('keeps generated heading anchors unique when a heading matches a duplicate suffix', () => {
    const markup = renderDocument('markdown', '# Topic\n\n# Topic\n\n# Topic 1');

    expect(markup).toContain('<h1 id="topic">Topic</h1>');
    expect(markup).toContain('<h1 id="topic-1">Topic</h1>');
    expect(markup).toContain('<h1 id="topic-1-1">Topic 1</h1>');
  });

  it('renders Mermaid fences and Mermaid files through the diagram renderer', () => {
    const fenced = renderDocument('markdown', '```mermaid\nflowchart LR\n  A --> B\n```');
    const standalone = renderDocument('mermaid', 'flowchart LR\n  A --> B');

    expect(fenced).toContain('atlas-mermaid');
    expect(standalone).toContain('atlas-mermaid');
  });

  it('does not activate raw HTML or fetch Markdown images', () => {
    const markup = renderDocument(
      'markdown',
      '# Safe\n\n<script>window.pwned = true</script>\n\n![remote](https://example.invalid/image.png)',
    );

    expect(markup).not.toContain('<script');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('src="https://example.invalid');
  });

  it('renders YAML frontmatter as a metadata card instead of a rule and paragraph', () => {
    const markup = renderDocument(
      'markdown',
      '---\nname: visual-context\ndescription: >-\n  Write a guide.\nmetadata:\n  pack: core\n---\n# Visual guide\n\nBody text.',
    );

    expect(markup).toContain('aria-label="Document metadata"');
    expect(markup).toContain('<dt>name</dt><dd>visual-context</dd>');
    expect(markup).toContain('<dt>description</dt><dd>Write a guide.</dd>');
    expect(markup).toContain('<pre class="atlas-frontmatter__structured">pack: core</pre>');
    expect(markup).not.toContain('<hr');
    expect(markup).toContain('<h1 id="visual-guide">Visual guide</h1>');
  });

  it('renders CSV and TSV files and csv fences as sortable, filterable tables', () => {
    const csv = renderDocument('csv', 'method,path\nGET,/health\nPOST,/orders');
    const tsv = renderDocument('tsv', 'key\tclient\nalpha\tone');
    const fenced = renderDocument('markdown', '```csv\nname,count\nalpha,2\n```');

    expect(csv).toContain('aria-label="Filter rows"');
    expect(csv).toContain('aria-sort="none"');
    expect(csv).toContain('Sort by method');
    expect(csv).toContain('<td>/orders</td>');
    expect(csv).toContain('2 of 2 rows');
    expect(tsv).toContain('<td>alpha</td>');
    expect(fenced).toContain('Sort by count');
    expect(fenced).not.toContain('atlas-markdown__code');
  });

  it('localizes file metadata and explains that document content is not translated', () => {
    const markup = renderToStaticMarkup(
      createElement(
        FolderLocaleContext.Provider,
        { value: 'id' },
        createElement(FolderDocument, {
          path: 'notes.txt',
          scopeId: 'test',
          source,
          onNavigate: () => undefined,
          file: { path: 'notes.txt', type: 'text', content: 'Original content', size: 1234567 },
        }),
      ),
    );

    expect(markup).toContain('<dt>Jenis</dt><dd>Teks</dd>');
    expect(markup).toContain('1.234.567 byte');
    expect(markup).toContain('Isi dokumen tetap menggunakan bahasa sumber.');
    expect(markup).toContain('Original content');
  });

  it('uses the selected language for table count formatting', () => {
    const content = `Item\n${Array.from({ length: 1000 }, (_, index) => `Item ${index}`).join('\n')}`;
    const markup = renderToStaticMarkup(
      createElement(
        FolderLocaleContext.Provider,
        { value: 'id' },
        createElement(FolderDocument, {
          path: 'data.csv',
          scopeId: 'test',
          source,
          onNavigate: () => undefined,
          file: { path: 'data.csv', type: 'csv', content, size: content.length },
        }),
      ),
    );

    expect(markup.includes('1.000 dari 1.000 baris')).toBe(true);
  });
});
