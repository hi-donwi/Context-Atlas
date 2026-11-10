import { type ContentSource } from 'context-atlas-core';
interface MarkdownDocumentProps {
    readonly content: string;
    readonly path: string;
    readonly scopeId: string;
    readonly source: ContentSource;
    readonly onNavigate: (path: string, fragment?: string) => void;
}
export declare function MarkdownDocument({ content, path, scopeId, source, onNavigate, }: MarkdownDocumentProps): import("react").JSX.Element;
export {};
