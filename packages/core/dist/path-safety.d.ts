/** Raised when a caller supplies a path that cannot safely identify content within a scope. */
export declare class UnsafePathError extends Error {
    constructor();
}
/** Validate and return a canonical slash-separated file path relative to its scope root. */
export declare function normalizeRelativePath(path: string): string;
/** Validate a directory path relative to its scope root; the empty path denotes the root. */
export declare function normalizeDirectoryPath(path: string): string;
/**
 * Compare canonical absolute paths using segment boundaries. Callers should resolve symlinks
 * before passing the candidate so an escaping link is rejected without filesystem access here.
 */
export declare function isPathWithinRoot(rootPath: string, candidatePath: string): boolean;
