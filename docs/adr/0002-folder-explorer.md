# ADR-0002: Folder-first content explorer

- Status: Accepted
- Date: 2026-11-03

## Context

The 0.1 viewer requires a host to project its information into a graph snapshot. That
duplicates adapter work and makes documents second-class, even though Markdown, diagrams,
tables, and contracts are where project knowledge already lives. A reusable reader should
accept those files directly while keeping the source authoritative and the host's access
boundary intact.

## Decision

Context Atlas 0.2 is a folder-first document explorer. It consumes a `ContentSource` that
describes available scopes, lists one directory level, reads a file, and may provide search
and change notifications. The source owns access to its underlying data; the viewer does not
discover or mutate files itself. A renderer registry dispatches by `FileType` and, for
Markdown code fences, by fence language. The graph snapshot remains available as a legacy
renderer for `*.context.json`; `ContextExplorer` remains exported for one minor release.

Scope is determined by the source profile:

| Profile     | Scope behavior                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `folder`    | One scope: the opened folder. There is no scope switcher.                                                                  |
| `workspace` | Detected when both `registry.tsv` and `memory/projects/` are present. The reader may show All, one client, or one project. |
| `host`      | The embedding host computes and supplies the authorized slice server-side.                                                 |

In the `workspace` profile, a project slice consists of `memory/projects/<key>/`,
`runs/<key>/`, `clients/<client>/` (including `clients/<client>/groups/<group>/` when
applicable), and the registry row's `context_repo` folder when declared and present. The
`works/` area is excluded from project scopes. All is a human-reading scope, not an export
scope: an export is always bound to exactly one project scope.

The following paths and files are never listed or served: `.git/`, `.local/`,
`node_modules/`, `dist/`, `__pycache__/`, `.DS_Store`, `.env*`, `*.pem`, `*.key`, `*.p12`,
`*.pfx`, `id_rsa*`, and `*.kdbx`. Symlinks whose resolved targets leave the scope root are
excluded. Files larger than 10 MB may appear as metadata only and are not read for rendering
or search. These exclusions are mandatory and cannot be relaxed by folder configuration.

The explorer is read-only and local: it has no upload path and renderers do not fetch remote
resources. A static build is allowed only for a single `folder`-profile scope and is refused
for the `workspace` profile. The workspace root is never exported as a static build.

## Consequences

- Hosts can supply authorized files through one contract instead of building graph adapters
  for document reading.
- The main export changes from the graph explorer to the folder explorer. The graph-based
  `ContextExplorer` remains available for one minor release, and `*.context.json` has a
  legacy renderer.
- Hosts and file sources must enforce their scope before data reaches the viewer; a client
  filter is not an authorization boundary.
- Renderer implementations and syntax support increase bundle weight, so heavy renderers
  must be loaded on demand.
- Files are untrusted input. Markdown, diagrams, HTML, SVG, and structured data require the
  renderer-specific restrictions and sandboxing defined by the 0.2 specification.
- A metadata-only size cap keeps large files from being read or rendered as ordinary
  documents.

## Alternatives

| Alternative                                   | Reason rejected                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| Keep the graph primary and add Markdown nodes | Still requires each host to build an adapter and leaves documents secondary.     |
| Build a separate static-site generator        | Duplicates the reader and loses the reusable embeddable viewer.                  |
| Add a bespoke adapter for every host          | Repeats file and scope handling instead of sharing the `ContentSource` boundary. |
