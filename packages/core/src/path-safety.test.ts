import { describe, expect, it } from 'vitest';
import { isPathWithinRoot, normalizeDirectoryPath, normalizeRelativePath } from './path-safety.js';

describe('normalizeRelativePath', () => {
  it('preserves a safe relative file path', () => {
    expect(normalizeRelativePath('docs/guide.md')).toBe('docs/guide.md');
  });

  it.each([
    '',
    '.',
    '..',
    '../secret.md',
    'docs/../secret.md',
    '/etc/passwd',
    'C:\\private\\secret.md',
    '\\\\server\\share\\secret.md',
    'https://example.invalid/file.md',
    'docs\\guide.md',
    'docs//guide.md',
    'docs/./guide.md',
    'docs/%2e%2e/secret.md',
    'docs/%252e%252e/secret.md',
    'docs/file\u0000.md',
  ])('rejects unsafe relative path %s', (path) => {
    expect(() => normalizeRelativePath(path)).toThrow();
  });
});

describe('normalizeDirectoryPath', () => {
  it('allows the empty path to represent the scope root', () => {
    expect(normalizeDirectoryPath('')).toBe('');
  });

  it('preserves safe nested directory paths', () => {
    expect(normalizeDirectoryPath('docs/reference')).toBe('docs/reference');
  });

  it.each(['.', '..', '../outside', '/absolute', 'docs//reference', 'docs/%2e%2e/outside'])(
    'rejects unsafe directory path %s',
    (path) => {
      expect(() => normalizeDirectoryPath(path)).toThrow();
    },
  );
});

describe('isPathWithinRoot', () => {
  it('accepts the root and descendants on POSIX paths', () => {
    expect(isPathWithinRoot('/workspace/project', '/workspace/project')).toBe(true);
    expect(isPathWithinRoot('/workspace/project', '/workspace/project/docs/guide.md')).toBe(true);
  });

  it('rejects sibling-prefix paths and resolved symlink targets outside the root', () => {
    expect(isPathWithinRoot('/workspace/project', '/workspace/project-private/secret.md')).toBe(
      false,
    );
    expect(isPathWithinRoot('/workspace/project', '/outside/secret.md')).toBe(false);
  });

  it('handles platform separators and drive roots without prefix confusion', () => {
    expect(isPathWithinRoot('C:\\workspace\\project', 'C:\\workspace\\project\\docs\\a.md')).toBe(
      true,
    );
    expect(
      isPathWithinRoot('C:\\workspace\\project', 'C:\\workspace\\project-old\\secret.md'),
    ).toBe(false);
  });

  it('fails closed for non-absolute or malformed paths', () => {
    expect(isPathWithinRoot('workspace/project', 'workspace/project/file.md')).toBe(false);
    expect(isPathWithinRoot('/workspace/project', '/workspace/../outside/file.md')).toBe(false);
  });
});
