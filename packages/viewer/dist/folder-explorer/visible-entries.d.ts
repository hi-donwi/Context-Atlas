import type { Entry } from 'context-atlas-core';
/** Filter navigation only; this does not change source permissions, search or direct links. */
export declare function visibleFolderEntries(entries: readonly Entry[]): readonly Entry[];
/** Put common orientation documents before supporting folders, preserving all other order. */
export declare function prioritizeRootEntries(entries: readonly Entry[]): readonly Entry[];
