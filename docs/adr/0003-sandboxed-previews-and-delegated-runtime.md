# ADR-0003: Sandboxed previews and delegated runtime

- Status: Accepted
- Date: 2026-11-03

## Context

Context Atlas 0.1 is a read-only explorer, not an execution engine. Readers still need to
inspect UIDL and Kerangka documents, and a useful UIDL preview is possible in the browser.
Kerangka compilation, however, requires Node.js and a locally installed compiler that is
not published to npm. Execution and model ownership must remain with the system that owns
them rather than being copied into a generic viewer.

## Decision

Context Atlas may render a constrained UIDL preview and delegate compilation to a local
Kerangka installation through the CLI. This does not make Atlas a model editor or a general
execution engine.

- **UIDL preview:** Render a UIDL document with `uidl-runtime` inside an iframe with an
  opaque origin and a narrow message boundary. Seed its in-memory adapter only from
  synthetic fixture data. Do not install a mutation handler by default; attempted writes
  therefore fail closed. Any preview-only write option must remain explicitly opt-in,
  in-memory, and reset on reload; it must never persist to a source.
- **Kerangka level 1:** In the browser, present a Kerangka model as readable source and
  derived documentation: entities as an ER view, workflows as state diagrams, rules,
  actions, and permissions as tables. Do not compile or execute the model.
- **Kerangka level 2:** The CLI server may compile through a Kerangka installation or
  checkout on the user's machine, selected by local configuration or `KERANGKA_BIN`. The
  compiler requires Node.js and is not an npm dependency, so it is never bundled into the
  browser viewer. Show diagnostics and preview generated UIDL screens in the same sandbox
  with synthetic data. The CLI binary is named `kerangka`; confirm that spelling in phase 7.
- **Kerangka level 3:** Starting a Kerangka development server is excluded from 0.2 and
  requires its own later ADR.

Atlas never executes model logic itself and never writes a model. Model editing remains in
the owning editor, and compilation or execution remains delegated to an explicitly selected
local runtime.

The Atlas shell itself is not built from UIDL documents. UIDL targets business surfaces
such as forms, lists, dashboards, and settings; a document explorer would still need custom
components for Markdown, diagrams, and a lazy file tree. That would add another runtime
without removing the explorer's own implementation.

## Consequences

- A reader can inspect UIDL and Kerangka content without granting the viewer write access
  or placing a compiler in the browser bundle.
- UIDL is untrusted input and must run only in the opaque-origin preview boundary, with
  synthetic in-memory data and no persistent mutation path.
- Kerangka level 2 is available only when a compatible local installation is configured;
  Atlas must report missing tools and compiler diagnostics without attempting remote access.
- The CLI owns the child-process boundary for compilation. Starting a long-lived Kerangka
  development server remains outside this decision and 0.2.
- Renderer and compiler integration details must be validated in their implementation
  phases; this ADR authorizes no dependency or runtime change by itself.

## Alternatives

| Alternative                                  | Reason rejected                                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle the Kerangka compiler into the viewer | It requires Node.js filesystem modules, is not published to npm, and would duplicate the owning editor's runtime.                             |
| Let the generic viewer execute model logic   | It would cross the boundary between reading and a host-owned runtime and would require an unsafe general execution surface.                   |
| Build the Atlas shell as UIDL documents      | A document explorer still needs custom Markdown, diagram, and tree components, so the approach adds a runtime without replacing the explorer. |
