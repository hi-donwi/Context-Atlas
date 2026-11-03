import { normalizeRelativePath } from './path-safety.js';

/** A file in the current scope that can be considered as a link target. */
export interface LinkEntry {
  /** File path relative to the scope root. */
  readonly path: string;
  /** File name, including its extension when present. */
  readonly name: string;
  /** Optional `name` value extracted from the file's frontmatter. */
  readonly frontmatterName?: string;
}

/** A link resolved to an indexed file, with an optional heading fragment. */
export interface ResolvedLink {
  /** File path relative to the scope root. */
  readonly path: string;
  /** Heading fragment without the leading `#`. */
  readonly fragment?: string;
}

interface LinkParts {
  readonly path: string;
  readonly fragment?: string;
}

const SCHEME_PREFIX = /^[a-z][a-z\d+.-]*:/i;
const UNSAFE_PATH_CHARACTERS = /[\\%:\u0000-\u001f\u007f]/;

function splitTarget(target: string): LinkParts {
  const hashIndex = target.indexOf('#');
  const beforeFragment = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const queryIndex = beforeFragment.indexOf('?');
  const path = (queryIndex === -1 ? beforeFragment : beforeFragment.slice(0, queryIndex)).trim();
  const fragment = hashIndex === -1 ? undefined : target.slice(hashIndex + 1).trim();
  return fragment === undefined || fragment === '' ? { path } : { path, fragment };
}

function safeEntryPath(entry: LinkEntry): string | undefined {
  try {
    return normalizeRelativePath(entry.path);
  } catch {
    return undefined;
  }
}

function findExactPath(path: string, entries: readonly LinkEntry[]): string | undefined {
  const matches = entries
    .map(safeEntryPath)
    .filter((entryPath): entryPath is string => entryPath !== undefined && entryPath === path);
  return matches.length === 1 ? matches[0] : undefined;
}

function hasExtension(path: string): boolean {
  const name = path.split('/').at(-1) ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1;
}

function findFile(
  path: string,
  directoryIntent: boolean,
  entries: readonly LinkEntry[],
): string | undefined {
  const candidates = [path];
  if (!hasExtension(path)) candidates.push(`${path}.md`);
  if (directoryIntent) {
    candidates.push(`${path}/README.md`, `${path}/index.md`);
  }

  for (const candidate of candidates) {
    const resolved = findExactPath(candidate, entries);
    if (resolved !== undefined) return resolved;
  }
  return undefined;
}

function resolveRelativePath(
  sourcePath: string,
  targetPath: string,
): {
  readonly path?: string;
  readonly directoryIntent: boolean;
} {
  let source: string;
  try {
    source = normalizeRelativePath(sourcePath);
  } catch {
    return { directoryIntent: false };
  }

  if (
    targetPath === '' ||
    targetPath.startsWith('//') ||
    SCHEME_PREFIX.test(targetPath) ||
    UNSAFE_PATH_CHARACTERS.test(targetPath)
  ) {
    return { directoryIntent: false };
  }

  const rootRelative = targetPath.startsWith('/');
  const pathWithoutRoot = rootRelative ? targetPath.slice(1) : targetPath;
  const directoryIntent = pathWithoutRoot.endsWith('/');
  const targetSegments = pathWithoutRoot.split('/');
  if (
    targetSegments.some((segment, index) => segment === '' && index !== targetSegments.length - 1)
  ) {
    return { directoryIntent: false };
  }
  if (directoryIntent) targetSegments.pop();

  const segments = rootRelative ? [] : source.split('/').slice(0, -1);
  for (const segment of targetSegments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return { directoryIntent: false };
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  if (segments.length === 0) return { directoryIntent };
  try {
    return { path: normalizeRelativePath(segments.join('/')), directoryIntent };
  } catch {
    return { directoryIntent: false };
  }
}

function removeExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function resolveWikiLink(
  sourcePath: string,
  target: string,
  entries: readonly LinkEntry[],
): ResolvedLink | undefined {
  const value = target.slice(2, -2).split('|', 1)[0]?.trim() ?? '';
  if (value === '' || UNSAFE_PATH_CHARACTERS.test(value) || value.startsWith('/')) return undefined;

  const { path: query, fragment } = splitTarget(value);
  if (query === '' || query.startsWith('../') || query === '..') return undefined;
  const normalizedQuery = query.toLocaleLowerCase('en-US');
  const source = safeEntryPath({ path: sourcePath, name: '' });
  if (source === undefined) return undefined;
  const sourceDirectory = source.split('/').slice(0, -1).join('/');

  const matches = new Map<string, LinkEntry>();
  for (const entry of entries) {
    const path = safeEntryPath(entry);
    if (path === undefined) continue;

    const basename = entry.name || path.split('/').at(-1) || '';
    const names = [
      basename.toLocaleLowerCase('en-US'),
      removeExtension(basename).toLocaleLowerCase('en-US'),
      path.toLocaleLowerCase('en-US'),
      removeExtension(path).toLocaleLowerCase('en-US'),
      entry.frontmatterName?.trim().toLocaleLowerCase('en-US'),
    ].filter((name): name is string => name !== undefined && name !== '');

    if (names.includes(normalizedQuery)) matches.set(path, entry);
  }

  const candidates = [...matches.keys()];
  const sameDirectory = candidates.filter(
    (path) => path.split('/').slice(0, -1).join('/') === sourceDirectory,
  );
  const resolvedPath =
    sameDirectory.length === 1
      ? sameDirectory[0]
      : candidates.length === 1
        ? candidates[0]
        : undefined;
  if (resolvedPath === undefined) return undefined;
  return fragment === undefined ? { path: resolvedPath } : { path: resolvedPath, fragment };
}

/** Resolve a relative or wiki link only when its target exists in the supplied scope index. */
export function resolveLink(
  sourcePath: string,
  target: string,
  entries: readonly LinkEntry[],
): ResolvedLink | undefined {
  const trimmedTarget = target.trim();
  if (trimmedTarget === '') return undefined;

  const normalizedSource = safeEntryPath({ path: sourcePath, name: '' });
  if (normalizedSource === undefined || findExactPath(normalizedSource, entries) === undefined) {
    return undefined;
  }

  if (trimmedTarget.startsWith('[[') && trimmedTarget.endsWith(']]')) {
    return resolveWikiLink(sourcePath, trimmedTarget, entries);
  }

  const parts = splitTarget(trimmedTarget);
  if (parts.path === '' && parts.fragment !== undefined) {
    try {
      const source = normalizeRelativePath(sourcePath);
      return { path: source, fragment: parts.fragment };
    } catch {
      return undefined;
    }
  }

  const { path, directoryIntent } = resolveRelativePath(sourcePath, parts.path);
  if (path === undefined) return undefined;

  const resolvedPath = findFile(path, directoryIntent, entries);
  if (resolvedPath === undefined) return undefined;
  return parts.fragment === undefined
    ? { path: resolvedPath }
    : { path: resolvedPath, fragment: parts.fragment };
}
