# ADR-0007: Same-origin local change events

- **Date:** 2026-11-03
- **Status:** Accepted
- **Deciders:** Maintainers
- **Project:** context-atlas

## Context

The folder-first explorer now has a local search index and a same-origin loopback API, but
files changed after the explorer opens can leave both the tree/document and the search snapshot
stale. The framework-neutral `ContentSource.watch(onChange)` contract already permits sources
to report changed relative paths. The product needs a bounded event contract that recovers from
missed changes without storing or replaying project data.

## Decision

- Expose `GET /atlas/api/events` as a same-origin Server-Sent Events endpoint.
- Send named `change` events with JSON `{ "paths": [...] }`. Paths are safe, slash-separated,
  relative to the authorized scope, and never include excluded content or absolute paths.
- Coalesce filesystem bursts over a 100 ms quiet window. A batch contains at most 128 unique
  paths, each at most 4096 characters. Use an empty path list for an unknown filename or when
  the event batch cannot be safely represented; this means revalidate the whole scope.
- Use native EventSource reconnect without event IDs, a replay buffer, or persistent event
  history. The browser performs a full-scope refresh whenever the stream opens, including after
  a reconnect.
- A named path refreshes its loaded parent directory and the selected document if it changed.
  A full refresh revalidates all loaded directories and the selected document. The local source
  invalidates its process-local search index when it observes an eligible filesystem change.
- Close filesystem watchers on unsubscribe and close all open event streams/watchers when the
  CLI server shuts down. The loopback server remains read-only.

## Consequences

### Positive

- Changes become visible without restarting the CLI, including changes missed while a browser
  was disconnected.
- No absolute paths, excluded content, durable event data, or cross-scope authority are added.
- Search keeps its existing lazy in-memory design while rebuilding only after observed changes.

### Negative

- Reconnect requires a full refresh of cached explorer state; this is intentionally simpler than
  event IDs, replay, and client cursors.
- Filesystem watcher behavior differs by platform and may not provide a filename; those cases
  trigger a full-scope refresh rather than attempting to guess.

## References

- Node.js v22.12 `fs.watch`: https://nodejs.org/docs/v22.12.0/api/fs.html#fswatchfilename-options-listener
- WHATWG Server-Sent Events: https://html.spec.whatwg.org/multipage/server-sent-events.html
- ADR-0006: Lazy process-local folder search index (search cache invalidation is triggered by
  observed local changes).
