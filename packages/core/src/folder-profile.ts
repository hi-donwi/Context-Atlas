import type { SourceInfo } from './index.js';

/** Optional descriptive metadata for a source that exposes one opened folder. */
export interface FolderSourceOptions {
  /** Display title for the opened folder. */
  readonly title: string;
  /** Optional revision for the folder's repository or mount. */
  readonly revision?: string;
}

/** Create SourceInfo for one opened folder; this profile intentionally has no scope switcher. */
export function createFolderSourceInfo(options: FolderSourceOptions): SourceInfo {
  const title = options.title.trim() || 'Folder';
  const revision = options.revision?.trim();

  return {
    title,
    profile: 'folder',
    scopes: [{ id: 'folder', label: title }],
    ...(revision === undefined || revision === ''
      ? {}
      : { repositoryRevisions: { folder: revision } }),
  };
}
