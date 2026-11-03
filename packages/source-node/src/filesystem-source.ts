import { constants } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import {
  createFolderSourceInfo,
  detectFileType,
  extractTitle,
  isExcludedPath,
  isMetadataOnly,
  isPathWithinRoot,
  MAX_FILE_SIZE_BYTES,
  normalizeDirectoryPath,
  normalizeRelativePath,
  UnsafePathError,
} from '@context-atlas/core';
import type { ContentSource, Entry, FileContent, FileType, SourceInfo } from '@context-atlas/core';

const MAX_METADATA_BYTES = 64 * 1024;
const MAX_TITLE_SCAN_BYTES = 64 * 1024;
const MAX_RELATIVE_PATH_LENGTH = 4096;
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
  | 'INVALID_METADATA'
  | 'UNSUPPORTED_METADATA'
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
    case 'INVALID_METADATA':
      return 'The folder metadata file is invalid.';
    case 'UNSUPPORTED_METADATA':
      return 'The folder metadata contains settings not supported by this source.';
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

function toScopePath(rootPath: string, absolutePath: string): string {
  return relative(rootPath, absolutePath).split(sep).join('/');
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

async function resolveWithinScope(rootPath: string, scopePath: string): Promise<ResolvedPath> {
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
  if (resolvedScopePath !== '' && isExcludedPath(resolvedScopePath)) {
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

async function readMetadataTitle(rootPath: string): Promise<string | undefined> {
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
    const unsupportedKeys = ['include', 'exclude', 'scopes', 'defaultDocument'];
    if (
      Object.keys(record).some((key) => key !== 'title') ||
      unsupportedKeys.some((key) => Object.prototype.hasOwnProperty.call(record, key))
    ) {
      throw new FileSystemSourceError('UNSUPPORTED_METADATA');
    }
    if (record.title === undefined) return undefined;
    if (
      typeof record.title !== 'string' ||
      record.title.length > 200 ||
      /[\u0000-\u001f\u007f]/.test(record.title)
    ) {
      throw new FileSystemSourceError('INVALID_METADATA');
    }
    return record.title.trim() || undefined;
  } catch (error) {
    if (error instanceof FileSystemSourceError && error.code === 'NOT_FOUND') return undefined;
    throw error;
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

/** A Node-only `ContentSource` for one local folder. Open it before handing it to a host or CLI. */
export class FileSystemContentSource implements ContentSource {
  private constructor(
    private readonly rootPath: string,
    private readonly info: SourceInfo,
  ) {}

  /** Resolve and validate a folder root; optional `atlas.json` may supply a display title. */
  static async open(rootPath: string): Promise<FileSystemContentSource> {
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

    const title = (await readMetadataTitle(resolvedRoot)) ?? (basename(resolvedRoot) || 'Folder');
    return new FileSystemContentSource(resolvedRoot, createFolderSourceInfo({ title }));
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
    if (normalizedDir !== '' && isExcludedPath(normalizedDir)) {
      throw new FileSystemSourceError('NOT_FOUND');
    }

    const resolvedDirectory = await resolveWithinScope(this.rootPath, normalizedDir);
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
      if (path.length > MAX_RELATIVE_PATH_LENGTH || isExcludedPath(path)) continue;

      let resolvedChild: ResolvedPath;
      let childStat;
      try {
        resolvedChild = await resolveWithinScope(this.rootPath, path);
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

    return entries.sort((left, right) =>
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
    if (normalizedPath.length > MAX_RELATIVE_PATH_LENGTH || isExcludedPath(normalizedPath)) {
      throw new FileSystemSourceError('NOT_FOUND');
    }

    const resolved = await resolveWithinScope(this.rootPath, normalizedPath);
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

  private assertScope(scopeId: string): void {
    if (scopeId !== 'folder') throw new FileSystemSourceError('INVALID_SCOPE');
  }
}

/** Open a filesystem source after validating the selected folder and its optional metadata. */
export async function openFolderSource(rootPath: string): Promise<FileSystemContentSource> {
  return FileSystemContentSource.open(rootPath);
}
