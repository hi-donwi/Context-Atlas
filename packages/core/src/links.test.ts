import { describe, expect, it } from 'vitest';
import { resolveLink } from './links.js';

interface TestLinkEntry {
  readonly path: string;
  readonly name: string;
  readonly frontmatterName?: string;
}

function entry(path: string, frontmatterName?: string): TestLinkEntry {
  const name = path.split('/').at(-1) ?? path;
  return frontmatterName === undefined ? { path, name } : { path, name, frontmatterName };
}

const files = [
  entry('README.md'),
  entry('docs/index.md'),
  entry('docs/guide.md'),
  entry('docs/reference/index.md'),
  entry('api/overview.md', 'api-reference'),
  entry('other/index.md'),
  entry('other/guide.md'),
];

describe('resolveLink', () => {
  it('resolves relative paths from the current document directory', () => {
    expect(resolveLink('docs/index.md', './guide.md', files)).toEqual({ path: 'docs/guide.md' });
    expect(resolveLink('docs/reference/index.md', '../guide.md', files)).toEqual({
      path: 'docs/guide.md',
    });
  });

  it('resolves root-relative and extensionless Markdown links within the scope', () => {
    expect(resolveLink('docs/index.md', '/README', files)).toEqual({ path: 'README.md' });
    expect(resolveLink('docs/index.md', 'guide', files)).toEqual({ path: 'docs/guide.md' });
  });

  it('preserves an in-document or target heading fragment', () => {
    expect(resolveLink('docs/index.md', '#overview', files)).toEqual({
      path: 'docs/index.md',
      fragment: 'overview',
    });
    expect(resolveLink('docs/index.md', './guide.md?mode=print#details', files)).toEqual({
      path: 'docs/guide.md',
      fragment: 'details',
    });
  });

  it('does not resolve an in-document fragment when its source is outside the index', () => {
    expect(resolveLink('private/secret.md', '#details', files)).toBeUndefined();
  });

  it('resolves wiki links by file name or frontmatter name', () => {
    expect(resolveLink('docs/index.md', '[[guide]]', files)).toEqual({ path: 'docs/guide.md' });
    expect(resolveLink('docs/index.md', '[[api-reference#auth|API]]', files)).toEqual({
      path: 'api/overview.md',
      fragment: 'auth',
    });
  });

  it('prefers a same-directory wiki match and rejects ambiguous matches', () => {
    expect(resolveLink('other/index.md', '[[guide]]', files)).toEqual({ path: 'other/guide.md' });
    expect(resolveLink('root.md', '[[guide]]', files)).toBeUndefined();
  });

  it.each([
    '../../../secret.md',
    '../../%2e%2e/secret.md',
    'https://example.invalid/guide.md',
    'javascript:alert(1)',
    '//example.invalid/guide.md',
    'docs\\guide.md',
    'missing.md',
  ])('refuses links outside the index or scope: %s', (target) => {
    expect(resolveLink('docs/reference/index.md', target, files)).toBeUndefined();
  });
});
