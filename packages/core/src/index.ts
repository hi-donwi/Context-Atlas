/** The scope strategy used by a content source. */
export type ScopeProfile = 'folder' | 'workspace' | 'host';

/** A file family recognized by the explorer and its renderer registry. */
export type FileType =
  | 'markdown'
  | 'mermaid'
  | 'json'
  | 'jsonl'
  | 'yaml'
  | 'csv'
  | 'tsv'
  | 'bpmn'
  | 'image'
  | 'pdf'
  | 'html'
  | 'text'
  | 'binary'
  | 'unknown';

/** A named, source-authorized view of a subset of content. */
export interface ScopeInfo {
  /** Stable identifier used when listing, reading, or searching this scope. */
  readonly id: string;
  /** Human-readable scope name. */
  readonly label: string;
  /** Optional explanation of the content included in this scope. */
  readonly description?: string;
  /** Optional revision associated with this scope. */
  readonly revision?: string;
}

/** Descriptive metadata for a content source and its available scopes. */
export interface SourceInfo {
  /** Human-readable source name. */
  readonly title: string;
  /** Determines how the explorer presents the source's scopes. */
  readonly profile: ScopeProfile;
  /** Scopes the source authorizes for this reader. */
  readonly scopes: ScopeInfo[];
  /** Optional map from repository or mount identifiers to their revisions. */
  readonly repositoryRevisions?: Readonly<Record<string, string>>;
}

/** One file or directory entry relative to the selected scope root. */
export interface Entry {
  /** Path relative to the scope root; it is not an operating-system path. */
  readonly path: string;
  /** Final path segment displayed in the tree. */
  readonly name: string;
  /** Whether the entry is a directory or a file. */
  readonly kind: 'dir' | 'file';
  /** Detected renderer family; directories may use `unknown`. */
  readonly type: FileType;
  /** Optional display title extracted from a document. */
  readonly title?: string;
  /** File size in bytes, when available. */
  readonly size?: number;
  /** Optional modification timestamp in ISO 8601 format. */
  readonly mtime?: string;
}

/** File bytes and metadata returned by a source after scope checks. */
export interface FileContent {
  /** Path relative to the selected scope root. */
  readonly path: string;
  /** Detected renderer family. */
  readonly type: FileType;
  /** Text content as a string or binary content as bytes. */
  readonly content: string | Uint8Array;
  /** Content size in bytes. */
  readonly size: number;
  /** Optional modification timestamp in ISO 8601 format. */
  readonly mtime?: string;
}

/** A ranked search result whose path remains relative to its authorized scope. */
export interface SearchHit {
  /** Path relative to the searched scope root. */
  readonly path: string;
  /** Optional display title for the matching document. */
  readonly title?: string;
  /** Bounded excerpt containing the query match. */
  readonly snippet: string;
  /** Optional source-specific relevance score. */
  readonly score?: number;
  /** Optional one-based line containing the match. */
  readonly line?: number;
}

/**
 * Read-only access to content that a source has already scoped and authorized.
 * Implementations must enforce scope boundaries on each operation.
 */
export interface ContentSource {
  /** Describe the source, its profile, its scopes, and available revisions. */
  describe(): Promise<SourceInfo>;

  /** List one directory level using a path relative to the selected scope root. */
  list(scopeId: string, dir: string): Promise<Entry[]>;

  /** Read one relative file path after rechecking scope and path safety. */
  read(scopeId: string, path: string): Promise<FileContent>;

  /** Optionally search within one authorized scope and return ranked results. */
  search?(scopeId: string, query: string): Promise<SearchHit[]>;

  /**
   * Optionally report changed safe paths relative to the authorized scope and return an
   * unsubscribe function. An empty path list means the entire scope may have changed.
   */
  watch?(onChange: (paths: string[]) => void): () => void;
}

export { isExcludedPath, isMetadataOnly, MAX_FILE_SIZE_BYTES } from './exclusions.js';
export {
  isPathWithinRoot,
  normalizeDirectoryPath,
  normalizeRelativePath,
  UnsafePathError,
} from './path-safety.js';
export { detectFileType, extractFrontmatterMetadata, extractTitle } from './content-metadata.js';
export type { FrontmatterMetadata } from './content-metadata.js';
export {
  MAX_FRONTMATTER_FIELDS,
  MAX_FRONTMATTER_VALUE_CHARS,
  splitFrontmatter,
} from './frontmatter.js';
export type { FrontmatterField, SplitFrontmatter } from './frontmatter.js';
export { resolveLink } from './links.js';
export type { LinkEntry, ResolvedLink } from './links.js';
export { createFolderSourceInfo } from './folder-profile.js';
export type { FolderSourceOptions } from './folder-profile.js';
export {
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_RESULTS,
  MAX_SEARCH_SNIPPET_CHARS,
  normalizeSearchQuery,
} from './search.js';
