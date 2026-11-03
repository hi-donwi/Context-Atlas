/** A file in the current scope that can be considered as a link target. */
export interface LinkEntry {
    /** File path relative to the scope root. */
    readonly path: string;
    /** File name, including its extension when present. */
    readonly name: string;
    /** Optional `name` value extracted from the file's frontmatter. */
    readonly frontmatterName?: string;
}
/** A link resolved to an indexed file, with an optional heading fragment. */
export interface ResolvedLink {
    /** File path relative to the scope root. */
    readonly path: string;
    /** Heading fragment without the leading `#`. */
    readonly fragment?: string;
}
/** Resolve a relative or wiki link only when its target exists in the supplied scope index. */
export declare function resolveLink(sourcePath: string, target: string, entries: readonly LinkEntry[]): ResolvedLink | undefined;
