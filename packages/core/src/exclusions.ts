import { normalizeRelativePath } from './path-safety.js';

/** Files larger than this limit are metadata-only and must not be read or indexed. */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const EXCLUDED_DIRECTORIES = new Set(['.git', '.local', 'node_modules', 'dist', '__pycache__']);
const EXCLUDED_SUFFIXES = ['.pem', '.key', '.p12', '.pfx', '.kdbx'];

/** Return true for fixed denylist entries and for malformed paths, failing closed. */
export function isExcludedPath(path: string): boolean {
  let normalizedPath: string;
  try {
    normalizedPath = normalizeRelativePath(path);
  } catch {
    return true;
  }

  return normalizedPath.split('/').some((segment) => {
    const normalizedSegment = segment.toLowerCase();
    return (
      EXCLUDED_DIRECTORIES.has(normalizedSegment) ||
      normalizedSegment === '.ds_store' ||
      normalizedSegment.startsWith('.env') ||
      normalizedSegment.startsWith('id_rsa') ||
      EXCLUDED_SUFFIXES.some((suffix) => normalizedSegment.endsWith(suffix))
    );
  });
}

/** Return true when content must not be read because its size is invalid or above the cap. */
export function isMetadataOnly(sizeBytes: number): boolean {
  return !Number.isFinite(sizeBytes) || sizeBytes < 0 || sizeBytes > MAX_FILE_SIZE_BYTES;
}
