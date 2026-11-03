import type { Entry } from '@context-atlas/core';
export interface ExplorerLocation {
    readonly scopeId: string;
    readonly path: string;
    readonly fragment?: string;
}
/** Prefer the conventional folder landing documents without selecting directories. */
export declare function findDefaultDocument(entries: readonly Entry[]): string | undefined;
/** Encode a safe relative file path as a URL hash that survives page reloads. */
export declare function formatExplorerLocation(scopeId: string, path: string, fragment?: string): string;
/** Parse a URL hash, returning no selection for malformed or unsafe paths. */
export declare function parseExplorerLocation(hash: string): ExplorerLocation | undefined;
