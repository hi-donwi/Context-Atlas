import { describe, expect, it } from 'vitest';
import { detectFileType, extractFrontmatterMetadata, extractTitle } from './content-metadata.js';

describe('detectFileType', () => {
  it.each([
    ['docs/README.MD', 'markdown'],
    ['diagrams/system.mmd', 'mermaid'],
    ['diagrams/system.mermaid', 'mermaid'],
    ['contracts/api.JSON', 'json'],
    ['records/events.jsonl', 'jsonl'],
    ['settings/app.YAML', 'yaml'],
    ['settings/app.yml', 'yaml'],
    ['data/export.csv', 'csv'],
    ['data/export.TSV', 'tsv'],
    ['workflow/process.bpmn', 'bpmn'],
    ['images/diagram.SVG', 'image'],
    ['images/photo.jpeg', 'image'],
    ['images/banner.avif', 'image'],
    ['manuals/guide.pdf', 'pdf'],
    ['preview/page.htm', 'html'],
    ['src/app.tsx', 'text'],
    ['archives/backup.zip', 'binary'],
    ['media/recording.mp4', 'binary'],
    ['office/plan.docx', 'binary'],
  ] as const)('detects %s as %s', (path, expected) => {
    expect(detectFileType(path)).toBe(expected);
  });

  it('returns unknown for unrecognized or extensionless names', () => {
    expect(detectFileType('assets/archive.dat')).toBe('unknown');
    expect(detectFileType('README')).toBe('unknown');
    expect(detectFileType('assets/file.constructor')).toBe('unknown');
    expect(detectFileType('assets/file.__proto__')).toBe('unknown');
  });
});

describe('extractFrontmatterMetadata', () => {
  it('reads title and name fields from YAML frontmatter', () => {
    expect(
      extractFrontmatterMetadata('---\ntitle: "API Guide"\nname: api-reference\n---\nBody'),
    ).toEqual({ title: 'API Guide', name: 'api-reference' });
  });

  it('supports CRLF, single quotes, and plain values with comments', () => {
    expect(
      extractFrontmatterMetadata(
        "---\r\ntitle: 'Getting Started'\r\nname: quickstart # alias\r\n---\r\n",
      ),
    ).toEqual({ title: 'Getting Started', name: 'quickstart' });
  });

  it('ignores malformed, missing, or empty frontmatter fields', () => {
    expect(extractFrontmatterMetadata('title: Not frontmatter\n')).toEqual({});
    expect(extractFrontmatterMetadata('---\ntitle:\nname: \n')).toEqual({});
    expect(extractFrontmatterMetadata('---\ntitle: Open\n# no closing delimiter')).toEqual({});
  });
});

describe('extractTitle', () => {
  it('prefers a non-empty frontmatter title over the first level-one heading', () => {
    expect(extractTitle('---\ntitle: Release Notes\n---\n# Older heading')).toBe('Release Notes');
  });

  it('extracts the first level-one heading outside fenced code blocks', () => {
    const markdown = [
      '```md',
      '# Not a title',
      '```',
      '',
      '# Real title ###',
      '# Later title',
    ].join('\n');
    expect(extractTitle(markdown)).toBe('Real title');
  });

  it('returns undefined when no title is available', () => {
    expect(extractTitle('')).toBeUndefined();
    expect(extractTitle('## A lower-level heading\n\nParagraph')).toBeUndefined();
  });
});
