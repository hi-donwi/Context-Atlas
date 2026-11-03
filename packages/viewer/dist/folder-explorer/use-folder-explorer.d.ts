import type { ContentSource, Entry, FileContent, SourceInfo } from '@context-atlas/core';
export interface FolderExplorerState {
    readonly info: SourceInfo | null;
    readonly scopeId: string | null;
    readonly entriesByDirectory: Readonly<Record<string, readonly Entry[]>>;
    readonly expandedDirectories: ReadonlySet<string>;
    readonly loadingDirectories: ReadonlySet<string>;
    readonly directoryErrors: Readonly<Record<string, string>>;
    readonly sourceLoading: boolean;
    readonly sourceError: string | null;
    readonly selectedPath: string | null;
    readonly selectedFile: FileContent | null;
    readonly fileLoading: boolean;
    readonly fileError: string | null;
    readonly reloadSource: () => void;
    readonly toggleDirectory: (path: string) => void;
    readonly retryDirectory: (path: string) => void;
    readonly selectFile: (path: string) => void;
    readonly retryFile: () => void;
}
export declare function useFolderExplorer(source: ContentSource): FolderExplorerState;
