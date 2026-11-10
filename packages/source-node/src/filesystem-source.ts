import { constants, watch as watchFileSystem, type FSWatcher } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import MiniSearch from 'minisearch';
import {
  createFolderSourceInfo,
  detectFileType,
  extractTitle,
  isExcludedPath,
  isMetadataOnly,
  isPathWithinRoot,
  MAX_SEARCH_RESULTS,
  MAX_SEARCH_SNIPPET_CHARS,
  normalizeSearchQuery,
  MAX_FILE_SIZE_BYTES,
  normalizeDirectoryPath,
  normalizeRelativePath,
  UnsafePathError,
} from 'context-atlas-core';
import type {
  ContentSource,
  Entry,
  FileContent,
  FileType,
  SearchHit,
  SourceInfo,
} from 'context-atlas-core';

const MAX_METADATA_BYTES = 64 * 1024;
const MAX_TITLE_SCAN_BYTES = 64 * 1024;
const MAX_RELATIVE_PATH_LENGTH = 4096;
const SEARCH_INDEX_BATCH_SIZE = 64;
const SEARCH_INDEX_BATCH_BYTES = 1024 * 1024;
const WATCH_DEBOUNCE_MS = 100;
const MAX_CHANGE_PATHS = 128;
const TEXT_TYPES = new Set<FileType>([
  'markdown',
  'mermaid',
  'json',
  'jsonl',
  'yaml',
  'csv',
  'tsv',
  'bpmn',
  'html',
  'text',
]);

/** Stable, non-sensitive error codes returned by the local folder source. */
export type FileSystemSourceErrorCode =
  | 'INVALID_ROOT'
  | 'INVALID_SCOPE'
  | 'INVALID_PATH'
  | 'NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'FILE_CHANGED'
  | 'INVALID_QUERY'
  | 'INVALID_METADATA'
  | 'UNSUPPORTED_METADATA'
  | 'NOT_A_WORKSPACE'
  | 'UNKNOWN_PROJECT'
  | 'FILESYSTEM_ERROR';

/** A safe error from a filesystem source operation; messages never include absolute paths. */
export class FileSystemSourceError extends Error {
  constructor(readonly code: FileSystemSourceErrorCode) {
    super(errorMessage(code));
    this.name = 'FileSystemSourceError';
  }
}

function errorMessage(code: FileSystemSourceErrorCode): string {
  switch (code) {
    case 'INVALID_ROOT':
      return 'The selected folder is unavailable or is not a directory.';
    case 'INVALID_SCOPE':
      return 'The requested scope does not exist.';
    case 'INVALID_PATH':
      return 'The path is not a safe relative path.';
    case 'NOT_FOUND':
      return 'The requested item was not found.';
    case 'FILE_TOO_LARGE':
      return 'The file exceeds the content size limit.';
    case 'FILE_CHANGED':
      return 'The file changed while it was being read.';
    case 'INVALID_QUERY':
      return 'The search query is invalid.';
    case 'INVALID_METADATA':
      return 'The folder metadata file is invalid.';
    case 'UNSUPPORTED_METADATA':
      return 'The folder metadata contains settings not supported by this source.';
    case 'NOT_A_WORKSPACE':
      return 'A project can only be selected in a workspace context folder (registry.tsv and memory/projects/).';
    case 'UNKNOWN_PROJECT':
      return 'The requested project is not in the workspace registry.';
    case 'FILESYSTEM_ERROR':
      return 'The filesystem operation could not be completed.';
  }
}

interface ResolvedPath {
  readonly absolutePath: string;
  readonly scopePath: string;
}

interface ReadResult {
  readonly bytes: Buffer;
  readonly mtime: string;
}

interface SearchDocument {
  readonly path: string;
  readonly title: string;
  readonly content: string;
}

interface SearchExcerpt {
  readonly snippet: string;
  readonly line: number;
}

function toScopePath(rootPath: string, absolutePath: string): string {
  return relative(rootPath, absolutePath).split(sep).join('/');
}

function searchExcerpt(content: string, query: string): SearchExcerpt | undefined {
  const terms = query.toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu) ?? [];
  if (terms.length === 0) return undefined;

  const normalizedContent = content.toLocaleLowerCase('en-US');
  const matchAt = terms
    .map((term) => normalizedContent.indexOf(term))
    .filter((index) => index >= 0)
    .reduce((first, index) => Math.min(first, index), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(matchAt)) return undefined;

  const line = content.slice(0, matchAt).split(/\r\n|\r|\n/).length;
  const characters = Array.from(content);
  const matchCharacter = Array.from(content.slice(0, matchAt)).length;
  const contentWindowSize = MAX_SEARCH_SNIPPET_CHARS - 2;
  let start = Math.max(0, matchCharacter - Math.floor(contentWindowSize / 2));
  let end = Math.min(characters.length, start + contentWindowSize);
  if (end === characters.length) start = Math.max(0, end - contentWindowSize);

  const snippet = `${start > 0 ? '…' : ''}${characters
    .slice(start, end)
    .join('')}${end < characters.length ? '…' : ''}`;
  return { snippet, line };
}

function mapFilesystemError(error: unknown): FileSystemSourceError {
  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error.code as string)
      : undefined;
  if (errorCode === 'ENOENT' || errorCode === 'ENOTDIR' || errorCode === 'ELOOP') {
    return new FileSystemSourceError('NOT_FOUND');
  }
  return new FileSystemSourceError('FILESYSTEM_ERROR');
}

async function resolveWithinScope(
  rootPath: string,
  scopePath: string,
  excluded: (path: string) => boolean = isExcludedPath,
): Promise<ResolvedPath> {
  if (scopePath.length > MAX_RELATIVE_PATH_LENGTH) {
    throw new FileSystemSourceError('INVALID_PATH');
  }

  const candidatePath = join(rootPath, ...scopePath.split('/'));
  if (!isPathWithinRoot(rootPath, candidatePath)) throw new FileSystemSourceError('NOT_FOUND');

  let absolutePath: string;
  try {
    absolutePath = await realpath(candidatePath);
  } catch (error) {
    throw mapFilesystemError(error);
  }

  if (!isPathWithinRoot(rootPath, absolutePath)) throw new FileSystemSourceError('NOT_FOUND');
  const resolvedScopePath = toScopePath(rootPath, absolutePath);
  if (resolvedScopePath !== '' && excluded(resolvedScopePath)) {
    throw new FileSystemSourceError('NOT_FOUND');
  }
  return { absolutePath, scopePath: resolvedScopePath };
}

async function readStableFile(absolutePath: string, maxBytes: number): Promise<ReadResult> {
  let handle;
  try {
    handle = await open(absolutePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await handle.stat();
    if (!before.isFile()) throw new FileSystemSourceError('NOT_FOUND');
    if (isMetadataOnly(before.size) || before.size > maxBytes) {
      throw new FileSystemSourceError('FILE_TOO_LARGE');
    }

    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (offset !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
      throw new FileSystemSourceError('FILE_CHANGED');
    }
    return { bytes, mtime: after.mtime.toISOString() };
  } catch (error) {
    if (error instanceof FileSystemSourceError) throw error;
    throw mapFilesystemError(error);
  } finally {
    await handle?.close();
  }
}

interface FolderMetadata {
  readonly title?: string;
  readonly defaultDocument?: string;
}

async function readFolderMetadata(rootPath: string): Promise<FolderMetadata> {
  try {
    const resolved = await resolveWithinScope(rootPath, 'atlas.json');
    const { bytes } = await readStableFile(resolved.absolutePath, MAX_METADATA_BYTES);
    let metadata: unknown;
    try {
      metadata = JSON.parse(bytes.toString('utf8')) as unknown;
    } catch {
      throw new FileSystemSourceError('INVALID_METADATA');
    }

    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
      throw new FileSystemSourceError('INVALID_METADATA');
    }
    const record = metadata as Record<string, unknown>;
    const supportedKeys = new Set(['title', 'defaultDocument']);
    if (Object.keys(record).some((key) => !supportedKeys.has(key))) {
      throw new FileSystemSourceError('UNSUPPORTED_METADATA');
    }

    let title: string | undefined;
    if (record.title !== undefined) {
      if (
        typeof record.title !== 'string' ||
        record.title.length > 200 ||
        /[\u0000-\u001f\u007f]/.test(record.title)
      ) {
        throw new FileSystemSourceError('INVALID_METADATA');
      }
      title = record.title.trim() || undefined;
    }

    const defaultDocument = await readDefaultDocument(rootPath, record.defaultDocument);
    return {
      ...(title === undefined ? {} : { title }),
      ...(defaultDocument === undefined ? {} : { defaultDocument }),
    };
  } catch (error) {
    if (error instanceof FileSystemSourceError && error.code === 'NOT_FOUND') return {};
    throw error;
  }
}

/**
 * Validate an atlas.json default document. An unsafe or excluded path fails closed; a path
 * that is safe but missing or not a file is ignored so the reader falls back to README.md.
 */
async function readDefaultDocument(rootPath: string, value: unknown): Promise<string | undefined> {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > MAX_RELATIVE_PATH_LENGTH) {
    throw new FileSystemSourceError('INVALID_METADATA');
  }
  let path: string;
  try {
    path = normalizeRelativePath(value);
  } catch (error) {
    if (error instanceof UnsafePathError) throw new FileSystemSourceError('INVALID_METADATA');
    throw error;
  }
  if (path !== value || isExcludedPath(path)) {
    throw new FileSystemSourceError('INVALID_METADATA');
  }
  try {
    const resolved = await resolveWithinScope(rootPath, path);
    return (await stat(resolved.absolutePath)).isFile() ? path : undefined;
  } catch {
    return undefined;
  }
}

async function readMarkdownTitle(
  absolutePath: string,
  expectedSize: number,
): Promise<string | undefined> {
  if (isMetadataOnly(expectedSize)) return undefined;

  let handle;
  try {
    handle = await open(absolutePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const fileStat = await handle.stat();
    if (!fileStat.isFile() || fileStat.size !== expectedSize || isMetadataOnly(fileStat.size)) {
      return undefined;
    }
    const prefixLength = Math.min(fileStat.size, MAX_TITLE_SCAN_BYTES);
    const prefix = Buffer.alloc(prefixLength);
    let offset = 0;
    while (offset < prefix.byteLength) {
      const { bytesRead } = await handle.read(prefix, offset, prefix.byteLength - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset !== prefix.byteLength) return undefined;
    return extractTitle(prefix.toString('utf8'));
  } catch {
    return undefined;
  } finally {
    await handle?.close();
  }
}

/** Options for opening one folder, used when a workspace scope mounts several folders. */
export interface FolderOpenOptions {
  /** Read the folder's optional `atlas.json`; defaults to true. Mounted folders skip it. */
  readonly readMetadata?: boolean;
  /** Top-level names inside the folder that are neither listed nor served, like the denylist. */
  readonly hiddenPaths?: readonly string[];
}

function exclusionFor(hiddenPaths: readonly string[] = []): (path: string) => boolean {
  const hidden = hiddenPaths.filter(
    (name) => /^[^/]+$/.test(name) && name !== '.' && name !== '..',
  );
  if (hidden.length === 0) return isExcludedPath;
  return (path) =>
    isExcludedPath(path) || hidden.some((name) => path === name || path.startsWith(`${name}/`));
}

/** A Node-only `ContentSource` for one local folder. Open it before handing it to a host or CLI. */
export class FileSystemContentSource implements ContentSource {
  private searchIndexPromise: Promise<MiniSearch<SearchDocument>> | undefined;

  private constructor(
    private readonly rootPath: string,
    private readonly info: SourceInfo,
    private readonly excluded: (path: string) => boolean,
  ) {}

  /**
   * Resolve and validate a folder root; optional `atlas.json` may supply a display title and
   * a default document.
   */
  static async open(
    rootPath: string,
    options: FolderOpenOptions = {},
  ): Promise<FileSystemContentSource> {
    if (rootPath.trim() === '') throw new FileSystemSourceError('INVALID_ROOT');

    let resolvedRoot: string;
    try {
      resolvedRoot = await realpath(resolve(rootPath));
      const rootStat = await stat(resolvedRoot);
      if (!rootStat.isDirectory()) throw new FileSystemSourceError('INVALID_ROOT');
    } catch (error) {
      if (error instanceof FileSystemSourceError) throw error;
      throw new FileSystemSourceError('INVALID_ROOT');
    }

    const metadata = options.readMetadata === false ? {} : await readFolderMetadata(resolvedRoot);
    const title = metadata.title ?? (basename(resolvedRoot) || 'Folder');
    return new FileSystemContentSource(
      resolvedRoot,
      createFolderSourceInfo({
        title,
        ...(metadata.defaultDocument === undefined
          ? {}
          : { defaultDocument: metadata.defaultDocument }),
      }),
      exclusionFor(options.hiddenPaths),
    );
  }

  async describe(): Promise<SourceInfo> {
    return { ...this.info, scopes: this.info.scopes.map((scope) => ({ ...scope })) };
  }

  async list(scopeId: string, dir: string): Promise<Entry[]> {
    this.assertScope(scopeId);

    let normalizedDir: string;
    try {
      normalizedDir = normalizeDirectoryPath(dir);
    } catch (error) {
      if (error instanceof UnsafePathError) throw new FileSystemSourceError('INVALID_PATH');
      throw error;
    }
    if (normalizedDir.length > MAX_RELATIVE_PATH_LENGTH) {
      throw new FileSystemSourceError('INVALID_PATH');
    }
    if (normalizedDir !== '' && this.excluded(normalizedDir)) {
      throw new FileSystemSourceError('NOT_FOUND');
    }

    const resolvedDirectory = await resolveWithinScope(this.rootPath, normalizedDir, this.excluded);
    let directoryStat;
    let children;
    try {
      directoryStat = await stat(resolvedDirectory.absolutePath);
      if (!directoryStat.isDirectory()) throw new FileSystemSourceError('NOT_FOUND');
      children = await readdir(resolvedDirectory.absolutePath, { withFileTypes: true });
    } catch (error) {
      if (error instanceof FileSystemSourceError) throw error;
      throw mapFilesystemError(error);
    }

    const entries: Entry[] = [];
    for (const child of children) {
      const path = normalizedDir === '' ? child.name : `${normalizedDir}/${child.name}`;
      if (path.length > MAX_RELATIVE_PATH_LENGTH || this.excluded(path)) continue;

      let resolvedChild: ResolvedPath;
      let childStat;
      try {
        resolvedChild = await resolveWithinScope(this.rootPath, path, this.excluded);
        childStat = await stat(resolvedChild.absolutePath);
      } catch {
        continue;
      }
      if (!childStat.isFile() && !childStat.isDirectory()) continue;

      const kind = childStat.isDirectory() ? 'dir' : 'file';
      const type = kind === 'file' ? detectFileType(path) : 'unknown';
      const title =
        kind === 'file' && type === 'markdown'
          ? await readMarkdownTitle(resolvedChild.absolutePath, childStat.size)
          : undefined;
      entries.push({
        path,
        name: child.name,
        kind,
        type,
        ...(title === undefined ? {} : { title }),
        ...(kind === 'file' ? { size: childStat.size } : {}),
        mtime: childStat.mtime.toISOString(),
      });
    }

    return entries.sort(
      (left, right) =>
        (left.kind === right.kind ? 0 : left.kind === 'dir' ? -1 : 1) ||
        left.name.localeCompare(right.name, 'en', { numeric: true, sensitivity: 'base' }),
    );
  }

  async read(scopeId: string, path: string): Promise<FileContent> {
    this.assertScope(scopeId);

    let normalizedPath: string;
    try {
      normalizedPath = normalizeRelativePath(path);
    } catch (error) {
      if (error instanceof UnsafePathError) throw new FileSystemSourceError('INVALID_PATH');
      throw error;
    }
    if (normalizedPath.length > MAX_RELATIVE_PATH_LENGTH || this.excluded(normalizedPath)) {
      throw new FileSystemSourceError('NOT_FOUND');
    }

    const resolved = await resolveWithinScope(this.rootPath, normalizedPath, this.excluded);
    const { bytes, mtime } = await readStableFile(resolved.absolutePath, MAX_FILE_SIZE_BYTES);
    const type = detectFileType(normalizedPath);
    const content = TEXT_TYPES.has(type) ? bytes.toString('utf8') : new Uint8Array(bytes);
    return {
      path: normalizedPath,
      type,
      content,
      size: bytes.byteLength,
      mtime,
    };
  }

  async search(scopeId: string, query: string): Promise<SearchHit[]> {
    this.assertScope(scopeId);
    const normalizedQuery = normalizeSearchQuery(query);
    if (normalizedQuery === undefined) {
      throw new FileSystemSourceError('INVALID_QUERY');
    }

    const index = await this.getSearchIndex();
    const results = index
      .search(normalizedQuery, { prefix: true, boost: { title: 2 } })
      .slice(0, MAX_SEARCH_RESULTS);
    const hits: SearchHit[] = [];

    for (const result of results) {
      try {
        const file = await this.read(scopeId, result.id);
        if (typeof file.content !== 'string') continue;
        const excerpt = searchExcerpt(file.content, normalizedQuery);
        if (excerpt === undefined) continue;
        hits.push({
          path: file.path,
          ...(typeof result.title === 'string' ? { title: result.title } : {}),
          snippet: excerpt.snippet,
          score: result.score,
          line: excerpt.line,
        });
      } catch (error) {
        if (
          error instanceof FileSystemSourceError &&
          ['NOT_FOUND', 'FILE_CHANGED', 'FILE_TOO_LARGE'].includes(error.code)
        ) {
          continue;
        }
        throw error;
      }
    }

    return hits;
  }

  watch(onChange: (paths: string[]) => void): () => void {
    const watchers = new Map<string, FSWatcher>();
    const pendingPaths = new Set<string>();
    let pendingFullRefresh = false;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let reconcileTask = Promise.resolve();
    let ambiguousDirectories = new Set<string>();

    const flush = (): void => {
      debounceTimer = undefined;
      if (stopped) return;
      const paths = pendingFullRefresh ? [] : [...pendingPaths].sort();
      pendingFullRefresh = false;
      pendingPaths.clear();
      onChange(paths);
    };

    const scheduleFlush = (): void => {
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, WATCH_DEBOUNCE_MS);
    };

    const queueVisiblePath = (scopePath: string): void => {
      void resolveWithinScope(this.rootPath, scopePath, this.excluded)
        .then(async (resolved) => {
          const entryStat = await stat(resolved.absolutePath);
          if (entryStat.isFile() || entryStat.isDirectory()) queueChange(scopePath);
        })
        .catch(() => queueChange(undefined));
    };

    const queueChange = (scopePath: string | undefined): void => {
      if (stopped) return;
      this.searchIndexPromise = undefined;
      if (scopePath === undefined || scopePath.length > MAX_RELATIVE_PATH_LENGTH) {
        pendingFullRefresh = true;
        pendingPaths.clear();
      } else if (!pendingFullRefresh) {
        pendingPaths.add(scopePath);
        if (pendingPaths.size > MAX_CHANGE_PATHS) {
          pendingFullRefresh = true;
          pendingPaths.clear();
        }
      }
      scheduleFlush();
    };

    const addWatcher = (absoluteDirectory: string, scopeDirectory: string): void => {
      if (stopped || watchers.has(absoluteDirectory)) return;
      try {
        const watcher = watchFileSystem(absoluteDirectory, (eventType, filename) => {
          if (filename === null || ambiguousDirectories.has(absoluteDirectory)) {
            queueChange(undefined);
          } else {
            const name = filename.toString();
            if (name === basename(absoluteDirectory)) {
              queueChange(undefined);
            } else {
              const path = scopeDirectory === '' ? name : `${scopeDirectory}/${name}`;
              if (path.length > MAX_RELATIVE_PATH_LENGTH) {
                queueChange(undefined);
              } else {
                try {
                  const safePath = normalizeRelativePath(path);
                  if (!this.excluded(safePath)) queueVisiblePath(safePath);
                } catch (error) {
                  if (error instanceof UnsafePathError) queueChange(undefined);
                  else throw error;
                }
              }
            }
          }

          if (eventType === 'rename' || filename === null) {
            reconcileTask = reconcileTask.then(reconcileWatchers).catch(() => {
              queueChange(undefined);
            });
          }
        });
        watchers.set(absoluteDirectory, watcher);
        watcher.on('error', () => {
          watcher.close();
          watchers.delete(absoluteDirectory);
          queueChange(undefined);
        });
      } catch {
        queueChange(undefined);
      }
    };

    const reconcileWatchers = async (): Promise<void> => {
      if (stopped) return;
      const directories = new Map<string, string>([[this.rootPath, '']]);
      const nextAmbiguousDirectories = new Set<string>();
      const visited = new Set<string>([this.rootPath]);
      const pending = [{ absolutePath: this.rootPath, scopePath: '', ambiguous: false }];

      while (pending.length > 0) {
        const directory = pending.pop()!;
        let children;
        try {
          children = await readdir(directory.absolutePath, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const child of children) {
          if (!child.isDirectory() && !child.isSymbolicLink()) continue;
          const path =
            directory.scopePath === '' ? child.name : `${directory.scopePath}/${child.name}`;
          if (path.length > MAX_RELATIVE_PATH_LENGTH || this.excluded(path)) continue;
          try {
            normalizeRelativePath(path);
          } catch {
            continue;
          }

          let resolved: ResolvedPath;
          let childStat;
          try {
            resolved = await resolveWithinScope(this.rootPath, path, this.excluded);
            childStat = await stat(resolved.absolutePath);
          } catch {
            continue;
          }
          if (!childStat.isDirectory()) {
            if (child.isSymbolicLink() && resolved.scopePath !== path && childStat.isFile()) {
              nextAmbiguousDirectories.add(directory.absolutePath);
              nextAmbiguousDirectories.add(dirname(resolved.absolutePath));
            }
            continue;
          }

          const ambiguous = directory.ambiguous || resolved.scopePath !== path;
          if (ambiguous) nextAmbiguousDirectories.add(resolved.absolutePath);
          if (visited.has(resolved.absolutePath)) {
            nextAmbiguousDirectories.add(resolved.absolutePath);
            continue;
          }
          const scopePath = toScopePath(this.rootPath, resolved.absolutePath);
          visited.add(resolved.absolutePath);
          directories.set(resolved.absolutePath, scopePath);
          pending.push({ absolutePath: resolved.absolutePath, scopePath, ambiguous });
        }
      }

      if (stopped) return;
      ambiguousDirectories = nextAmbiguousDirectories;
      for (const [absolutePath, scopePath] of directories) addWatcher(absolutePath, scopePath);
      for (const [absolutePath, watcher] of watchers) {
        if (!directories.has(absolutePath)) {
          watcher.close();
          watchers.delete(absolutePath);
        }
      }
    };

    addWatcher(this.rootPath, '');
    reconcileTask = reconcileTask.then(reconcileWatchers).catch(() => queueChange(undefined));

    return () => {
      stopped = true;
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      pendingPaths.clear();
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
    };
  }

  private async getSearchIndex(): Promise<MiniSearch<SearchDocument>> {
    if (this.searchIndexPromise === undefined) {
      this.searchIndexPromise = this.buildSearchIndex().catch((error: unknown) => {
        this.searchIndexPromise = undefined;
        throw error;
      });
    }
    return this.searchIndexPromise;
  }

  private async buildSearchIndex(): Promise<MiniSearch<SearchDocument>> {
    const index = new MiniSearch<SearchDocument>({
      fields: ['title', 'content'],
      idField: 'path',
      storeFields: ['title'],
    });
    const directories = [''];
    let batch: SearchDocument[] = [];
    let batchBytes = 0;

    const addBatch = async (): Promise<void> => {
      if (batch.length === 0) return;
      await index.addAllAsync(batch, { chunkSize: SEARCH_INDEX_BATCH_SIZE });
      batch = [];
      batchBytes = 0;
    };

    for (let directoryIndex = 0; directoryIndex < directories.length; directoryIndex += 1) {
      const directory = directories[directoryIndex]!;
      const entries = await this.list('folder', directory);
      for (const entry of entries) {
        if (entry.kind === 'dir') {
          directories.push(entry.path);
          continue;
        }
        if (!TEXT_TYPES.has(entry.type)) continue;

        try {
          const file = await this.read('folder', entry.path);
          if (typeof file.content !== 'string') continue;
          batch.push({
            path: file.path,
            title: entry.title ?? entry.name,
            content: file.content,
          });
          batchBytes += Buffer.byteLength(file.content, 'utf8');
          if (batch.length >= SEARCH_INDEX_BATCH_SIZE || batchBytes >= SEARCH_INDEX_BATCH_BYTES) {
            await addBatch();
          }
        } catch (error) {
          if (
            error instanceof FileSystemSourceError &&
            ['NOT_FOUND', 'FILE_CHANGED', 'FILE_TOO_LARGE'].includes(error.code)
          ) {
            continue;
          }
          throw error;
        }
      }
    }

    await addBatch();
    return index;
  }

  private assertScope(scopeId: string): void {
    if (scopeId !== 'folder') throw new FileSystemSourceError('INVALID_SCOPE');
  }
}

/** Open a filesystem source after validating the selected folder and its optional metadata. */
export async function openFolderSource(rootPath: string): Promise<FileSystemContentSource> {
  return FileSystemContentSource.open(rootPath);
}
