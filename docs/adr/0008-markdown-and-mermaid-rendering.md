# ADR-0008: Safe Markdown and Mermaid rendering

- **Date:** 2026-11-03
- **Status:** Accepted
- **Deciders:** Maintainers
- **Project:** context-atlas

## Context

The folder explorer currently shows every text file as escaped source. Readers need to see
Markdown and Mermaid documents in their intended form, while the local folder remains
untrusted input and the loopback viewer must not execute it or contact remote resources.
Mermaid's SVG output uses inline SVG styles; the existing `default-src 'self'` policy blocks
those styles and causes incomplete diagrams and CSP errors.

## Decision

Render Markdown with `react-markdown` 10.1.0 and `remark-gfm` 4.0.1, with raw HTML skipped,
and suppress Markdown images so opening a document never fetches an image URL. Render Mermaid
fences and `.mmd`/`.mermaid` files on demand with `mermaid` 12.3.0, strict security, disabled
HTML labels and auto-start, protected security directives, and a 50,000-character input cap.
Sanitize returned SVG with DOMPurify 3.4.17 before insertion; remove SVG links, images,
foreign objects, style attributes, imports, and non-fragment CSS URLs. Invalid diagrams show
an inert source fallback.

The local server adds `style-src 'self' 'unsafe-inline'` for Mermaid's generated SVG styles.
The existing `default-src 'self'` remains in force for scripts, images, connections, and other
resources; no `script-src 'unsafe-inline'` or remote origin is added.

## Consequences

### Positive

- Markdown structure, GFM tables, and Mermaid diagrams are readable without executing raw HTML.
- Mermaid and DOMPurify are loaded only when a diagram is present; Markdown image URLs do not
  trigger network requests.
- The source scope, read-only API, loopback binding, and script policy remain unchanged.

### Negative

- `style-src 'unsafe-inline'` is broader than the former CSS policy, though it does not enable
  inline scripts or remote resource loading.
- Mermaid adds a sizable optional browser chunk and increases the dependency tree.
- Markdown images remain placeholders until scope-aware local image resolution is implemented.

### Neutral

- Other text and binary file renderers retain their existing behavior.
- The dependencies are pinned exactly and are not published as part of this local CLI setup.

## Alternatives considered

| Option                                                | Why rejected                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| Render Markdown as unsanitized HTML                   | Allows folder-provided markup to execute or mutate the viewer.                   |
| Keep all text as source                               | Does not meet the reader-facing purpose of the folder explorer.                  |
| Allow inline scripts or remote renderer/CDN resources | Weakens the security boundary and requires network access.                       |
| Render diagrams on the server                         | Adds an execution/rendering service path and expands the CLI's responsibilities. |
| Forbid all inline SVG styles                          | Mermaid diagrams lose their intended layout and styling under CSP.               |

## Sources

- Mermaid API and security levels: https://mermaid.js.org/config/usage.html
- `react-markdown` 10.1.0 safety and component API: https://github.com/remarkjs/react-markdown/tree/10.1.0
- `remark-gfm` 4.0.1: https://github.com/remarkjs/remark-gfm/tree/4.0.1
- DOMPurify 3.4.17: https://github.com/cure53/DOMPurify/tree/3.4.17

## Follow-up

- [x] Standards updated, if this changes one
- [x] Affected code migrated, or a ticket raised
- [ ] Team informed
