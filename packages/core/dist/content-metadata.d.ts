import type { FileType } from './index.js';
/** Frontmatter fields used by document titles and wiki-link lookup. */
export interface FrontmatterMetadata {
    readonly title?: string;
    readonly name?: string;
}
/** Detect a renderer family from a file path without reading its contents. */
export declare function detectFileType(path: string): FileType;
/** Extract the supported title and wiki-name scalars from a YAML frontmatter block. */
export declare function extractFrontmatterMetadata(markdown: string): FrontmatterMetadata;
/** Prefer a frontmatter title, then the first level-one Markdown heading outside code fences. */
export declare function extractTitle(markdown: string): string | undefined;
