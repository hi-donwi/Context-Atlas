# ADR-0006: Lazy process-local folder search index

- **Date:** 2026-11-03
- **Status:** Accepted
- **Deciders:** Maintainers
- **Project:** context-atlas

## Context

The 0.2 contract includes optional `ContentSource.search` and a read-only local search route.
The folder source and CLI initially implement only info, tree, and file access. Re-scanning
and reading the entire folder for every query would make repeated searches unnecessarily
expensive, while persisting the index would introduce a new content store and lifecycle.

## Decision

Use MiniSearch 7.2.0 in the Node-only folder source to build an in-memory index lazily on the
first query. Index only the current folder scope and recognized text files that pass the
existing path, exclusion, metadata, and size checks. Return up to 20 ranked hits with a
matching excerpt capped at 240 characters and a one-based line number. The index is a
snapshot for the lifetime of the CLI; file changes after indexing require a CLI restart until
a later events/invalidation phase is approved.

MiniSearch is pinned exactly at 7.2.0, is MIT-licensed, and has no runtime dependencies.
Its official README documents in-memory indexing, ranked search and prefix matching:
https://github.com/lucaong/minisearch. The package metadata is available at:
https://registry.npmjs.org/minisearch/latest.

## Consequences

### Positive

- Repeated searches use an in-memory ranked index without disk persistence or remote services.
- The index stays inside the Node adapter; browser consumers do not download the search engine.
- Scope checks and exclusions remain owned by the filesystem source.

### Negative

- The first search must construct the index and may take longer than subsequent searches.
- The in-memory index consumes process memory and becomes stale after files change until CLI restart.
- Search snippets require bounded source reads for the highest-ranked results.

### Neutral

- Live index invalidation remains a separate concern for the later events phase.
- Search returns a fixed, bounded result set; it does not expose pagination or workspace search.

On one local synthetic fixture of 10,000 small text files, first search (including lazy index
construction) took 1,515 ms and a repeat search took 2 ms. This is a single measurement, not a
cross-machine performance guarantee; it demonstrates the expected difference between index
construction and reuse.

## Alternatives considered

| Option                                                       | Why rejected                                                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Recursively scan and read every text file for every query    | Repeats file traversal and parsing on every query instead of reusing a built index.                                               |
| Persist a serialized index on disk                           | Adds a durable copy of project content, cache invalidation, and cleanup/security concerns.                                        |
| Build a custom full-text ranking engine                      | Reimplements tokenization, ranking, prefix matching, and index maintenance already covered by the selected library.               |
| Add filesystem watchers and index invalidation in this phase | Couples search to event lifecycle and broadens this phase; documented snapshot semantics are explicit until that later increment. |

## Follow-up

- [x] Standards updated, if this changes one
- [x] Affected code migrated, or a ticket raised
- [ ] Team informed
