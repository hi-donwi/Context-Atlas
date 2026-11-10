# ADR-0004: Node folder source and loopback CLI

- **Date:** 2026-11-03
- **Status:** Accepted
- **Deciders:** Maintainers
- **Project:** context-atlas

## Context

Phase 1 provides framework-neutral source contracts and pure path, exclusion, metadata,
link, and folder-profile helpers. A local filesystem adapter and command-line server need
Node APIs, while `context-atlas-core` is also consumed by browser bundles. The 0.2
specification requires local serving to be read-only, loopback-only, and bounded to one
authorized folder scope.

## Decision

We place filesystem access and the local HTTP CLI in a Node-only workspace package, separate
from the browser-safe core package. The CLI exposes only the 0.2 `info`, `tree`, and `file`
GET routes in this phase, binds to `127.0.0.1`, validates the `Host` header, grants no CORS,
and never writes to the source. We use Node built-ins and keep viewer hosting, search, events,
workspace scopes, and remote HTTP sources out of this phase.

## Consequences

### Positive

- Browser consumers can continue importing `context-atlas-core` without Node polyfills.
- The same filesystem source can be embedded by Node hosts or used by the CLI.
- Local HTTP access is explicit, read-only, and limited to one folder scope.

### Negative

- The repository gains Node-specific package and build wiring.
- Search, change notifications, and a browser UI require later work.

### Neutral

- The local API follows the 0.2 route prefix and response contract without changing the
  existing `ContentSource` interface.

## Alternatives considered

| Option                                            | Why rejected                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Export filesystem code from the core package root | Pulls Node built-ins into browser consumers and breaks the framework-neutral boundary.         |
| Add a remote-capable HTTP client/source now       | Outside the selected local folder scope and introduces network behavior not needed by the CLI. |
| Serve static viewer assets in this phase          | The folder viewer integration is not part of this source/CLI increment.                        |

## Follow-up

- [x] Standards updated, if this changes one
- [x] Affected code migrated, or a ticket raised
- [ ] Team informed
