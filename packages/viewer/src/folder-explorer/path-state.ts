import { normalizeRelativePath, UnsafePathError } from '@context-atlas/core';
import type { Entry } from '@context-atlas/core';

export interface ExplorerLocation {
  readonly scopeId: string;
  readonly path: string;
}

/** Prefer the conventional folder landing documents without selecting directories. */
export function findDefaultDocument(entries: readonly Entry[]): string | undefined {
  for (const name of ['README.md', 'index.md']) {
    const match = entries.find((entry) => entry.kind === 'file' && entry.name === name);
    if (match !== undefined) return match.path;
  }
  return undefined;
}

/** Encode a safe relative file path as a URL hash that survives page reloads. */
export function formatExplorerLocation(scopeId: string, path: string): string {
  const normalizedPath = normalizeRelativePath(path);
  return `#/${encodeURIComponent(scopeId)}/${normalizedPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

/** Parse a URL hash, returning no selection for malformed or unsafe paths. */
export function parseExplorerLocation(hash: string): ExplorerLocation | undefined {
  if (!hash.startsWith('#/')) return undefined;
  const segments = hash.slice(2).split('/');
  if (segments.length < 2 || segments.some((segment) => segment === '')) return undefined;

  try {
    const scopeId = decodeURIComponent(segments[0]!);
    const path = segments
      .slice(1)
      .map((segment) => decodeURIComponent(segment))
      .join('/');
    if (scopeId === '' || normalizeRelativePath(path) !== path) return undefined;
    return { scopeId, path };
  } catch (error) {
    if (error instanceof URIError || error instanceof UnsafePathError) return undefined;
    throw error;
  }
}
