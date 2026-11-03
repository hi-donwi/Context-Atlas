# ADR-0009: Scope-bound Markdown links and images

- **Date:** 2026-11-04
- **Status:** Accepted
- **Deciders:** Maintainers

## Context

The folder viewer renders Markdown locally but previously suppressed every image and left
relative links to browser navigation. Readers need to follow links and view local diagrams or
screenshots without enabling arbitrary file reads, traversing the scope to build a full index,
or contacting remote hosts.

## Decision

- Resolve relative Markdown targets against the current document path with safe relative-path
  normalization. Reject schemes, protocol-relative URLs, scope escapes, encoded paths, and
  excluded paths before asking the source for content.
- Navigate through the existing folder explorer and read targets only through the current
  `ContentSource` scope. Do not eagerly walk the scope to resolve links.
- Generate stable, unique heading IDs and preserve optional fragments in the explorer URL so
  direct loads, browser history, and relative links land on the selected heading.
- Load only bounded raster image files whose path extension, `FileContent` type, byte length,
  and image signature agree. SVG and remote images remain inert placeholders.
- Render validated image bytes through short-lived object URLs and revoke them when the image
  component is replaced or unmounted. Extend CSP with `img-src 'self' blob:` only; do not add
  remote origins or broaden other directives.

## Consequences

### Positive

- Relative Markdown navigation stays inside the current application and scope.
- Local raster images display without network requests or a broader filesystem route.
- Existing read-only, exclusion, file-size, and same-origin boundaries remain in force.

### Negative

- Unsupported, oversized, malformed, or excluded image targets show a placeholder.
- SVG images remain unavailable to avoid active-content and SVG parsing risks.

### Neutral

- The viewer resolves targets lazily; the source remains authoritative for target existence and
  read authorization.

## Alternatives considered

| Option                                             | Why rejected                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Fetch image URLs directly from Markdown            | Could contact remote hosts or expose browser requests to attacker-controlled URLs. |
| Expose arbitrary filesystem paths as static assets | Would bypass the scope-aware `ContentSource.read` boundary.                        |
| Eagerly index every file before resolving links    | Duplicates tree traversal and defeats lazy listing.                                |
| Render SVG inline or as a blob URL                 | SVG may contain active or externally-referencing content.                          |

## Follow-up

- [x] Standards updated, if this changes one
- [x] Affected code migrated, or a ticket raised
- [ ] Team informed
