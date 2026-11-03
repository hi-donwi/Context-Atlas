import type { FileContent } from '@context-atlas/core';
interface FolderDocumentProps {
    readonly path: string;
    readonly file: FileContent;
}
export declare function FolderDocument({ path, file }: FolderDocumentProps): import("react").JSX.Element;
export {};
