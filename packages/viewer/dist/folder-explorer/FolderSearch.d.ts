import { type ContentSource } from '@context-atlas/core';
interface FolderSearchProps {
    readonly source: ContentSource;
    readonly scopeId: string | null;
    readonly onOpenFile: (path: string) => void;
}
/** Local, keyboard-accessible search for one already-authorized folder scope. */
export declare function FolderSearch({ source, scopeId, onOpenFile }: FolderSearchProps): import("react").JSX.Element | null;
export {};
