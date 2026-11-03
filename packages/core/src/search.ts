export const MAX_SEARCH_QUERY_LENGTH = 200;
export const MAX_SEARCH_RESULTS = 20;
export const MAX_SEARCH_SNIPPET_CHARS = 240;

/** Trim a query and return it only when it satisfies the shared search contract. */
export function normalizeSearchQuery(query: string): string | undefined {
  const normalized = query.trim();
  if (normalized === '' || Array.from(normalized).length > MAX_SEARCH_QUERY_LENGTH) {
    return undefined;
  }
  return normalized;
}
