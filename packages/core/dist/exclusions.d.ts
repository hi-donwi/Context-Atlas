/** Files larger than this limit are metadata-only and must not be read or indexed. */
export declare const MAX_FILE_SIZE_BYTES: number;
/** Return true for fixed denylist entries and for malformed paths, failing closed. */
export declare function isExcludedPath(path: string): boolean;
/** Return true when content must not be read because its size is invalid or above the cap. */
export declare function isMetadataOnly(sizeBytes: number): boolean;
