import type { ContentSource } from 'context-atlas-core';
export interface FolderExplorerProps {
    readonly source: ContentSource;
}
/** Read-only browser explorer for a folder or workspace-context `ContentSource`. */
export declare function FolderExplorer({ source }: FolderExplorerProps): import("react").JSX.Element;
