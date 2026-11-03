export declare const MAX_SEARCH_QUERY_LENGTH = 200;
export declare const MAX_SEARCH_RESULTS = 20;
export declare const MAX_SEARCH_SNIPPET_CHARS = 240;
/** Trim a query and return it only when it satisfies the shared search contract. */
export declare function normalizeSearchQuery(query: string): string | undefined;
