import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FileContent } from '@context-atlas/core';
import { FolderDocument } from './FolderDocument.js';

function renderDocument(type: FileContent['type'], content: string): string {
  return renderToStaticMarkup(
    createElement(FolderDocument, {
      path: type === 'mermaid' ? 'docs/architecture.mmd' : 'docs/guide.md',
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

    expect(markup).toContain('<h1>Local guide</h1>');
    expect(markup).toContain('<blockquote>');
    expect(markup).toContain('<table>');
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
});
