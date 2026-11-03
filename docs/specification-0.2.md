# Context Atlas 0.2

> **Draft: target of the 0.2 release; `docs/specification.md` remains the shipped 0.1 behavior until release.**

## Purpose and scope

Context Atlas 0.2 opens a folder and presents its documents as a readable, navigable
explorer. Files remain authoritative; Atlas stores no project content. A `ContentSource`
supplies an already-bounded view of files, and a renderer registry selects a renderer by
file type and, for Markdown fences, language. The 0.1 graph snapshot remains supported as
a legacy renderer for `*.context.json`; `ContextExplorer` remains exported for one minor
release.

The product is read-only and local. It does not upload content or fetch remote resources.
The source and its host own access control. Atlas may export context only from one project
scope at a time. The workspace root is never emitted as a static build.

## Scope profiles

| Profile     | Detection or owner                                                   | Visible scopes                                                                  |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `folder`    | Default when the opened folder is not a workspace context            | The opened folder only; no scope switcher.                                      |
| `workspace` | Detected when `registry.tsv` and `memory/projects/` are both present | All, one client, or one project.                                                |
| `host`      | Supplied by an embedding host                                        | The slice computed and authorized by the host server; no Atlas scope expansion. |

A workspace project slice includes `memory/projects/<key>/`, `runs/<key>/`,
`clients/<client>/` and its `groups/<group>/` directory when applicable, and the registry
row's `context_repo` folder when declared and present. `works/` is excluded from project
scopes. All may be used by a human reader but is never an export scope; export must be
bound to one project. A host profile must apply the same boundary before supplying content.

The fixed denylist applies in every profile: `.git/`, `.local/`, `node_modules/`, `dist/`,
`__pycache__/`, `.DS_Store`, `.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa*`,
`*.kdbx`, and symlinks resolving outside the scope root. These paths are neither listed
nor served. Files larger than 10 MB may be listed as metadata only; their contents are not
read, rendered, or indexed. Optional root `atlas.json` metadata may set a title, include or
exclude globs, named scopes, or a default document, but cannot relax the fixed denylist or
the host's authorized scope. The initial local folder source reads only the optional `title`;
globs, named scopes, and default-document selection remain later work.

Static build is permitted for one `folder`-profile scope. It is refused for the `workspace`
profile, including the workspace root, and is not a mechanism for exporting All or multiple
projects.

## ContentSource contract

`@context-atlas/core` defines the framework-neutral TypeScript contract. Phase 0 declares
types only; source implementations, validation, path safety, and search behavior are
implemented in later phases. Paths are relative to a scope, and the source must enforce its
own scope on every operation.

| Type or method          | Contract                                                                                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScopeProfile`          | `'folder' \| 'workspace' \| 'host'`.                                                                                                                                                                                                         |
| `SourceInfo`            | Source title, profile, available `ScopeInfo` values, and optional repository revision metadata.                                                                                                                                              |
| `ScopeInfo`             | Stable scope identifier, display title, and optional description or revision.                                                                                                                                                                |
| `Entry`                 | One file or directory with relative path, name, kind, file type, and optional title, byte size, and modification time.                                                                                                                       |
| `FileContent`           | Relative path, file type, text or bytes, byte size, and optional modification time.                                                                                                                                                          |
| `FileType`              | A recognized document family such as Markdown, Mermaid, JSON, YAML, CSV/TSV, BPMN, image, PDF, HTML, text, binary, or unknown. Structured JSON/YAML may route to OpenAPI, UIDL, Kerangka, or legacy snapshot renderers after safe detection. |
| `SearchHit`             | Relative path, optional title, snippet, and optional score or line location.                                                                                                                                                                 |
| `describe()`            | Returns source title, profile, scopes, and available repository revisions.                                                                                                                                                                   |
| `list(scope, dir)`      | Returns one directory level for lazy tree navigation.                                                                                                                                                                                        |
| `read(scope, path)`     | Returns content and metadata after scope and path checks.                                                                                                                                                                                    |
| `search?(scope, query)` | Optionally returns ranked, bounded hits and snippets within that scope.                                                                                                                                                                      |
| `watch?(onChange)`      | Optionally reports changed relative paths and returns an unsubscribe function.                                                                                                                                                               |

## HTTP routes

The CLI source and a host HTTP source implement the same read-only route set. Query values
are URL-encoded; `scope` is required except for `info`.

| Method and route                   | Parameters                            | Response                                                                                      |
| ---------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /atlas/api/info`              | None                                  | Source title, profile, scopes, and repository revisions.                                      |
| `GET /atlas/api/tree?scope=&dir=`  | Scope and optional relative directory | One directory level.                                                                          |
| `GET /atlas/api/file?scope=&path=` | Scope and relative file path          | File type, content, byte size, modification time, and content encoding.                       |
| `GET /atlas/api/search?scope=&q=`  | Scope and query                       | Ranked hits with bounded snippets; a MiniSearch candidate runs server-side within that scope. |
| `GET /atlas/api/events`            | Server-sent events                    | Change notifications for the authorized source.                                               |

The initial folder CLI implements only the info, tree, and file routes; search and events
remain later work. Run `context-atlas [folder] [--port <port>]`; it defaults to the current
directory and an available port. The CLI binds only to `127.0.0.1`, rejects unexpected
`Host` values, sends no CORS permission, and uses `default-src 'self'`. Text responses are
limited to 5 MiB. The file route returns JSON with an `encoding` field: `utf-8` for textual
content and `base64` for binary content. Errors use RFC 9457 `application/problem+json`
with a stable `code`; stack traces and absolute paths are not returned. Routes do not accept
write requests.

## Viewer layout

| Area   | Contents                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Left   | Profile-appropriate scope switcher, lazy file tree, document titles, natural sorting, type icons, child counts, and date-grouped runs. |
| Centre | Selected document; a folder opens its `README.md` or `index.md`, otherwise a card grid of child documents.                             |
| Right  | Heading outline, frontmatter, backlinks, file facts, and available source revision.                                                    |
| Top    | Breadcrumbs, search (`Cmd/Ctrl+K`), theme toggle, copy path, and copy context.                                                         |

Deep links use `#/<scope>/<path>#<heading>` and are reloadable. On narrow screens, the tree
and outline become drawers while the document keeps the available width. Folder profile
does not show a scope switcher.

## Renderer matrix

All library names below are candidates only. The implementation phase must verify the
candidate's current documentation and publish date, then pin the selected version in that
phase. Phase 0 adds no renderer dependencies. Heavy renderers load only when needed.

### Requested visualisations

| Visualisation               | Input                                       | Renderer candidate or behavior                                                                  |
| --------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Flowchart                   | Mermaid `flowchart` fence                   | Mermaid candidate.                                                                              |
| Mindmap                     | Mermaid `mindmap` fence                     | Mermaid candidate.                                                                              |
| Sequence diagram            | Mermaid `sequenceDiagram` fence             | Mermaid candidate.                                                                              |
| Class diagram               | Mermaid `classDiagram` fence                | Mermaid candidate.                                                                              |
| Entity-relationship diagram | Mermaid `erDiagram` fence                   | Mermaid candidate; verify documented support when pinned.                                       |
| State diagram               | Mermaid `stateDiagram-v2` fence             | Mermaid candidate.                                                                              |
| Gantt chart                 | Mermaid `gantt` fence                       | Mermaid candidate.                                                                              |
| Pie chart                   | Mermaid `pie` fence                         | Mermaid candidate.                                                                              |
| Git graph                   | Mermaid `gitGraph` fence                    | Mermaid candidate.                                                                              |
| Timeline                    | Mermaid `timeline` fence                    | Mermaid candidate.                                                                              |
| Quadrant chart              | Mermaid `quadrantChart` fence               | Mermaid candidate.                                                                              |
| Bar chart                   | Mermaid `xychart-beta` bar form             | Mermaid candidate; this syntax is beta.                                                         |
| Line chart                  | Mermaid `xychart-beta` line form            | Mermaid candidate; this syntax is beta.                                                         |
| Interactive graph           | `graph` fence (YAML/JSON) or `*.graph.json` | Interactive node graph; React Flow is a candidate and is already used by the project.           |
| Table                       | GFM table, `.csv`/`.tsv`, or `csv` fence    | Built-in table renderer with sorting, filtering, sticky header, column controls, and row count. |

Other diagram syntaxes supported by the selected Mermaid candidate may include user journey,
Sankey, block, packet, kanban, C4, requirement, treemap, and additional beta types. They do
not replace the fifteen requested visualisations above.

### Other file types and Markdown features

| Input                                   | Rendering and constraints                                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markdown                                | GFM tables, task lists, strikethrough, autolinks, footnotes, YAML frontmatter card, heading anchors, and GitHub-style alerts. Resolve relative links and images only within scope. Resolve `[[wiki-links]]` by file name or frontmatter `name`. Raw HTML is disabled by default and sanitized when a renderer requires HTML. |
| Math                                    | `$...$` and `$$...$$` using a KaTeX candidate, loaded lazily.                                                                                                                                                                                                                                                                |
| Code fences and source files            | Bounded language set with a Shiki candidate, loaded lazily. Fence language is part of renderer dispatch.                                                                                                                                                                                                                     |
| `chart` fence                           | Vega-Lite JSON with tooltips and legend toggle. Disable the data loader so specifications cannot fetch URLs; use a CSP-compatible interpreter candidate.                                                                                                                                                                     |
| `openapi.json` and `*.openapi.yaml`     | API reference grouped by tag, with operations, parameters, request/response schemas, authentication, and status codes. Reuse the existing OpenAPI adapter where applicable.                                                                                                                                                  |
| `.bpmn`                                 | Read-only navigable BPMN view; retain the bpmn.io watermark required by its license.                                                                                                                                                                                                                                         |
| `.mmd` and `.mermaid`                   | Mermaid document renderer.                                                                                                                                                                                                                                                                                                   |
| `.json`                                 | Collapsible tree by default; safely detect OpenAPI, UIDL, Kerangka, graph, and legacy Context Snapshot inputs for their dedicated renderers.                                                                                                                                                                                 |
| `.jsonl`                                | Records displayed as a table.                                                                                                                                                                                                                                                                                                |
| `.yaml` and `.yml`                      | Highlighted source; apply the same safe format detection as JSON.                                                                                                                                                                                                                                                            |
| `.svg`, `.png`, `.jpg`, `.webp`, `.gif` | Image viewer; SVG is displayed through an image element, never inserted as active markup.                                                                                                                                                                                                                                    |
| `.pdf`                                  | Browser-native PDF viewer.                                                                                                                                                                                                                                                                                                   |
| `.html`                                 | Source by default; optional preview in an opaque-origin sandboxed iframe.                                                                                                                                                                                                                                                    |
| Other files                             | Metadata card; binary data is not interpreted as text.                                                                                                                                                                                                                                                                       |

Candidate renderer packages include Markdown/GFM and sanitization tools, Mermaid, KaTeX,
Shiki, Vega-Lite, a BPMN viewer, and UIDL Runtime. Search implementation candidates include
MiniSearch. These are not pinned or added by this draft; each must be checked and pinned in
its owning implementation phase.

### Diagram error handling

Diagram rendering is lazy, strict, and bounded by source length. A parse error produces an
error card with the parser message and source, never a blank panel. Diagrams provide zoom,
pan, full screen, source copy, and SVG download where the renderer safely supports them.

## Security hardening

- Every source enforces its authorized scope on both listing and reading. Resolve paths
  against the scope root and reject traversal, encoded traversal, absolute paths, and
  symlinks that escape it.
- Apply the fixed exclusions and 10 MB metadata-only limit in every profile. Recheck them
  on direct file reads, search, and export; a hidden tree entry is not sufficient protection.
- Keep the system read-only. Do not provide upload, mutation, or source-write routes.
- Do not fetch remote Markdown links, images, OpenAPI references, chart data, or other
  renderer resources. No request may leave the serving origin.
- Sanitize rendered Markdown, keep raw HTML disabled unless sanitized, use strict Mermaid
  security, show SVG as an image, and disable external chart data loading.
- Sandbox HTML and UIDL previews in opaque-origin iframes with a narrow message boundary.
  Never grant same-origin access. UIDL data is synthetic and in memory; omit the mutation
  handler by default so writes fail closed. Any preview-only write mode is explicitly
  opt-in, ephemeral, and never writes a source.
- For local HTTP serving, bind only to loopback, reject unexpected Host headers, do not
  enable CORS, set a restrictive Content Security Policy, and cap text responses at 5 MB.
- Context copy/export is restricted to exactly one project scope. Never create a static
  build of the workspace root or an All scope.

## UIDL and Kerangka levels

| Level            | Support in 0.2                                                                                                                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UIDL preview     | Render `*.uidl.json` or a `uidl` fence in the opaque-origin sandbox. Seed the in-memory adapter from a sibling synthetic fixtures file when present. Invalid documents show safe validation diagnostics. Writes fail closed by default.                                                                              |
| Kerangka level 1 | Read models in the browser without a compiler: entities as an ER view, workflows as state diagrams, rules/actions/permissions as tables, plus raw source.                                                                                                                                                            |
| Kerangka level 2 | The CLI may compile using a locally installed Kerangka tool or checkout. The compiler requires Node.js, is not an npm dependency, and is never bundled. Show diagnostics and preview generated UIDL screens in the sandbox with synthetic data. The CLI binary is named `kerangka`; confirm its spelling in phase 7. |
| Kerangka level 3 | Out of scope for 0.2. Starting a Kerangka development server requires a separate later ADR.                                                                                                                                                                                                                          |

Atlas does not execute model logic or write models. The Atlas shell itself is implemented as
the viewer, not as UIDL: a document explorer still needs its own Markdown, diagram, and tree
components, so representing the shell as UIDL would add a runtime without removing code.

## Performance budgets

| Measure      | Target                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------- |
| First paint  | Under 2 seconds for a workspace with approximately 10,000 files, using lazy tree traversal. |
| Search       | Under 300 ms for the same scale after the scoped index is available.                        |
| Viewer shell | Under 300 KB gzip; heavy renderers are split into on-demand chunks.                         |

Measure and record results on the authoring machine. These budgets do not permit reading
large file contents eagerly or indexing outside the active scope.

## Acceptance criteria

- Opening an ordinary folder shows only that folder and no scope switcher.
- Opening a workspace context detects its profile and provides All, client, and project
  views; selecting a project reveals only that project's allowed slice and never `works/`.
- A host-provided source cannot expand beyond the server-computed slice. Path traversal,
  excluded paths, and escaping symlinks are refused by direct reads as well as tree listing.
- A project export is limited to one project scope. A folder-scope static build works; a
  workspace-profile static build, especially of the root, is refused.
- The viewer renders all fifteen requested visualisations and the listed file families in
  light and dark themes. Invalid diagrams show actionable error cards.
- UIDL previews are opaque-origin and fail closed for writes. Kerangka level 1 is readable
  without a compiler; level 2 uses only a local CLI installation; level 3 is absent.
- Rendering stays local and read-only; no request leaves the serving origin.
- On a roughly 10,000-file fixture, first paint is under 2 seconds, search is under 300 ms,
  and the shell is under 300 KB gzip.
- `npm run format:check`, `npm run verify`, and `npm run test:e2e` pass. Browser acceptance
  covers narrow and wide layouts, with no console errors.

## Verification

Each implementation phase adds tests for the behavior it introduces. Release verification
runs:

```sh
npm run format:check
npm run verify
npm run test:e2e
```

Browser tests reuse an installed Chromium. Ask before downloading it if it is missing.
Public fixtures and screenshots use synthetic data only.

## Out of scope

- Editing source documents, model writes, uploads, remote fetches, or remote execution.
- Static export of the workspace root, All scopes, or multiple project scopes.
- Starting a Kerangka development server (level 3); that requires a later ADR.
- A CLI, renderer implementation, or runtime behavior in phase 0. Phase 0 records decisions,
  drafts this specification, and declares the `@context-atlas/core` types only.
- Migrating a host integration or client-specific study material into the public repository.
