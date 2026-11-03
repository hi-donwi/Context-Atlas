import type { ContentSource, FileContent } from '@context-atlas/core';
interface FolderDocumentProps {
    readonly path: string;
    readonly file: FileContent;
    readonly scopeId: string;
    readonly source: ContentSource;
    readonly onNavigate: (path: string, fragment?: string) => void;
}
export declare function FolderDocument({ path, file, scopeId, source, onNavigate }: FolderDocumentProps): import("react").JSX.Element;
export {};
