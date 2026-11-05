/** The most top-level frontmatter fields returned for display. */
export declare const MAX_FRONTMATTER_FIELDS = 50;
/** The most characters kept for one frontmatter value before it is truncated. */
export declare const MAX_FRONTMATTER_VALUE_CHARS = 2000;
/** One top-level frontmatter field, as display text. */
export interface FrontmatterField {
    readonly key: string;
    /** A scalar as text, or a nested mapping or list as dedented source text. */
    readonly value: string;
    /** `text` for scalars and block scalars; `structured` for nested mappings and lists. */
    readonly kind: 'text' | 'structured';
}
/** A Markdown document split into its frontmatter fields and its body. */
export interface SplitFrontmatter {
    readonly fields: FrontmatterField[];
    readonly body: string;
}
/**
 * Split a leading YAML frontmatter block from Markdown and describe its top-level fields as
 * display text. This is deliberately not a YAML evaluator: it never resolves anchors, tags,
 * or types, and nested content is returned as dedented source text.
 */
export declare function splitFrontmatter(markdown: string): SplitFrontmatter | undefined;
