# ADR-0005: CLI-hosted local folder explorer

- **Date:** 2026-11-04
- **Status:** Accepted
- **Deciders:** Maintainers
- **Project:** context-atlas

## Context

Phase 2 exposes a read-only loopback API for one folder, but it has no browser interface.
The existing `ContentSource` contract and 0.2 specification define a reusable explorer;
opening a second development server or allowing the selected folder to become a static root
would weaken the local-only security boundary and complicate startup.

## Decision

We build a fixed browser UI bundle and have the local CLI serve that bundle and the existing
API from the same `127.0.0.1` origin. Static requests are restricted to the installed UI
bundle's index and asset paths; they never resolve against the selected project folder. The
browser adapts the API to `ContentSource`, and the reusable viewer consumes that contract.
The first UI slice provides lazy folder navigation, a default document/card landing view,
inert text previews, and binary metadata. It adds no external renderer dependencies.

## Consequences

### Positive

- Starting the CLI yields one same-origin local application without browser CORS.
- Scope/path authorization stays in the existing source; the UI cannot expand its access.
- The viewer remains usable by other hosts through the framework-neutral source contract.
- File content is shown as text, not executed HTML or remote resources.

### Negative

- CLI builds must bundle and package the browser assets with the server code.
- Rich Markdown, diagrams, search, events, and media previews remain future increments.

### Neutral

- The UI and the API share the same restrictive Host check and Content Security Policy.
- Deep links use the URL hash and do not require server-side SPA fallback routes.

## Alternatives considered

| Option                                                     | Why rejected                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Start a separate Vite server from the CLI                  | Adds a second listener/origin and CORS or proxy configuration for a local single-user flow.         |
| Serve the selected folder as the static document root      | Could bypass source-level exclusions and expose files outside the API contract.                     |
| Implement a full renderer matrix in the first UI increment | Too broad for the first browser integration and would require multiple dependency/security reviews. |
| Render Markdown using unsanitized HTML                     | Violates the local content security boundary and can execute folder-provided markup.                |

## Follow-up

- [x] Standards updated, if this changes one
- [x] Affected code migrated, or a ticket raised
- [ ] Team informed
