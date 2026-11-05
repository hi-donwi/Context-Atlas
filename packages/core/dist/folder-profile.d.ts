import type { SourceInfo } from './index.js';
/** Optional descriptive metadata for a source that exposes one opened folder. */
export interface FolderSourceOptions {
    /** Display title for the opened folder. */
    readonly title: string;
    /** Optional revision for the folder's repository or mount. */
    readonly revision?: string;
    /** Optional scope-relative file to open first, already validated by the source. */
    readonly defaultDocument?: string;
}
/** Create SourceInfo for one opened folder; this profile intentionally has no scope switcher. */
export declare function createFolderSourceInfo(options: FolderSourceOptions): SourceInfo;
