import type { FileContent } from '@context-atlas/core';
export interface MarkdownTarget {
    readonly path: string;
    readonly fragment?: string;
}
/** Resolve a Markdown target within one scope without consulting or traversing its directory tree. */
export declare function resolveMarkdownTarget(sourcePath: string, target: string): MarkdownTarget | undefined;
/** Accept only small, correctly typed raster bytes; SVG and malformed data stay inert. */
export declare function isSafeRasterImageContent(path: string, file: FileContent): string | undefined;
