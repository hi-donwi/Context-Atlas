import { describe, expect, it } from 'vitest';
import { MAX_FRONTMATTER_FIELDS, splitFrontmatter } from './frontmatter.js';

describe('splitFrontmatter', () => {
  it('returns undefined when a document has no closed frontmatter block', () => {
    expect(splitFrontmatter('# Title\n\nBody')).toBeUndefined();
    expect(splitFrontmatter('---\ntitle: Open\nno closing fence')).toBeUndefined();
  });

  it('separates top-level fields from the Markdown body', () => {
    const result = splitFrontmatter(
      '---\nname: visual-context\ntitle: "Visual: guide"\n# a comment\n---\n# Heading\n\nBody',
    );

    expect(result?.fields).toEqual([
      { key: 'name', value: 'visual-context', kind: 'text' },
      { key: 'title', value: 'Visual: guide', kind: 'text' },
    ]);
    expect(result?.body).toBe('# Heading\n\nBody');
  });

  it('folds and keeps block scalars', () => {
    const result = splitFrontmatter(
      '---\ndescription: >-\n  Write a guide\n  for people.\n\n  Second paragraph.\nnotes: |\n  line one\n  line two\n---\n',
    );

    expect(result?.fields).toEqual([
      {
        key: 'description',
        value: 'Write a guide for people.\nSecond paragraph.',
        kind: 'text',
      },
      { key: 'notes', value: 'line one\nline two', kind: 'text' },
    ]);
  });

  it('keeps nested mappings and lists as dedented source text', () => {
    const result = splitFrontmatter(
      '---\nmetadata:\n  pack: core\n  keywords: a, b\ntags:\n  - one\n  - two\n---\nBody',
    );

    expect(result?.fields).toEqual([
      { key: 'metadata', value: 'pack: core\nkeywords: a, b', kind: 'structured' },
      { key: 'tags', value: '- one\n- two', kind: 'structured' },
    ]);
  });

  it('joins multi-line plain scalars and accepts a byte-order mark and CRLF', () => {
    const result = splitFrontmatter('﻿---\r\nsummary: first\r\n  second\r\n---\r\nBody');

    expect(result?.fields).toEqual([{ key: 'summary', value: 'first second', kind: 'text' }]);
    expect(result?.body).toBe('Body');
  });

  it('bounds the number of fields and the length of each value', () => {
    const many = Array.from({ length: MAX_FRONTMATTER_FIELDS + 5 }, (_, i) => `k${i}: v`).join(
      '\n',
    );
    const long = 'x'.repeat(5000);
    const result = splitFrontmatter(`---\n${many}\nlong: ${long}\n---\n`);

    expect(result?.fields).toHaveLength(MAX_FRONTMATTER_FIELDS);
    const bounded = splitFrontmatter(`---\nlong: ${long}\n---\n`);
    expect(bounded?.fields[0]?.value.length).toBeLessThanOrEqual(2001);
    expect(bounded?.fields[0]?.value.endsWith('…')).toBe(true);
  });
});
