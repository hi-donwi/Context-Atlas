# Bilingual viewing: draft proposal

**Status:** staged implementation and future design, 2026-11-09. The workspace owner approved
the narrow localization exception and its local rule copies were updated. The first viewer
slice adds English/Indonesian controls to the local folder explorer. It does not translate
source documents automatically or implement translation mapping and freshness detection.
The generic public application contains no private project material or translation provider.

## Objective

Let readers use the explorer interface and a project's documents in either of two languages
without making translations a second source of truth. The request is for English and
Indonesian; the design should be reusable for other languages and for projects that have no
translations. Keep current English-only folders and existing hosts working unchanged.

## Separate decisions

1. **Workspace policy:** a narrow exception for localized UI text and clearly marked derived
   translations was approved locally; source identifiers, primary specifications, decisions,
   commit messages and technical identifiers remain English.
2. **Interface locale:** the folder explorer can switch navigation, accessible names,
   controls and loading/error/empty states. Dates and numbers currently follow the browser's
   locale, not the selected interface language. The selection does not translate content.
3. **Document locale (future design):** an authorized project may provide a derived document
   translation. A future viewer would identify its source, language, review state and freshness,
   and offer the original. The current viewer relies on links and labels in the documents.
   No translation overwrites the original or changes an approval status.
4. **Project content:** translations belong inside the owning project's private context
   boundary, never in a public generic application repository. Start with overview,
   blockers/decisions, progress, and next steps; each must name its own source and as-of
   date. The current work does not create or expose private examples in this repository.

### Policy intent

> English remains required for source-code identifiers and comments, agent instructions, canonical
> technical specifications, decisions and commit messages. A project may keep localized
> user-interface messages and source-linked, clearly labeled derived translations in the
> languages its users need. The canonical source remains authoritative; translations must
> identify their source and review/freshness state and follow the same privacy boundary.

This wording describes the intent; the actual workspace contract remains the authority.

## Candidate behaviour

- Interface and document locale are separate controls. The locale preference may be stored
  only after its persistence and scope are agreed; it must never store document content.
- Locale resources are host-supplied or distributed by the application when permitted by
  the applicable policy. No new translation or AI provider is called by default. Selecting
  a locale cannot send document content, metadata or telemetry to a remote service.
- A translated document is explicitly associated with one canonical source in the same
  authorized scope. Display the source path, source revision or content hash, translation
  language, translation date and review state. Do not infer approval from a translated file.
- Compare a recorded source content hash with the actual source bytes, or use another
  explicitly specified equivalent that works for dirty/non-Git folders. A changed source,
  absent metadata, unreadable source, or unverified review is never presented as a fresh,
  reviewed translation. State the reason and offer the original; do not silently hide it.
- If no translation is available, show the original and clearly label the fallback. A
  failed load, stale manifest, unauthorized path, or incomplete translation must not expand
  scope or fabricate a translated document. Retain access to original content.
- Preserve IDs, dates, numbers, status qualifiers, code, API paths, links and Mermaid graph
  structure. Make translated heading fragments and cross-language links explicit rather
  than assuming their slugs are interchangeable. Render Markdown under existing sanitization
  and source-scope rules; reject unsafe paths and remote resources as today.
- Search remains within the existing authorized source. Clearly indicate whether results
  search canonical content, translations, or both; do not promise cross-language semantic
  search when only literal indexing exists. Avoid duplicate results and stale snippets.
- Make the switcher keyboard-accessible, expose the current language and fallback state to
  assistive technology, and preserve the selected document when changing the interface
  language. Language changes must not reset a different project or scope.

## Design choices still to approve

- Whether to extend the initial bundled UI catalogue with host-supplied resources, and how
  to preserve compatibility for embedded hosts.
- Translation mapping convention, metadata format and ownership; source links and hashes
  must remain verifiable even for uncommitted files. No new `atlas.json` key should be used
  until its strict validation and backward compatibility are addressed.
- Automatic locale selection and whether to persist a language-only preference.
- Whether stale translations are displayed with a warning or require an explicit opt-in.
- The exact reviewer identity and audit workflow for declaring a translation reviewed.
- Whether local-only machine translation is desired later, with explicit consent, provider
  verification and controls. A future local provider must not fall back to a remote one.

## Implementation slices

1. The workspace owner approved the narrow localization policy exception locally.
2. The initial folder-explorer UI slice provides a locale switcher, English fallback and
   localized controls. Locale choice is in memory and resets on reload; it does not translate
   document bodies. The separate graph/snapshot explorer remains outside this slice.
3. Future work: add scoped translated-document association, source/hash freshness checks, original
   fallback, and secure link/diagram handling. Test missing, stale, unsafe, unreviewed and
   changing sources, including non-Git and dirty files.
4. Project-owned derived summaries can be linked manually in their own private context;
   their review status and source hashes must remain visible. Automatic stale checks and
   document-language switching remain future work.

Each additional slice needs a named claim, review and tests. This document does not by itself
claim a project task or client acceptance.

## Verification and boundaries

Use `npm run verify` and `npm run test:e2e` after implementation. Unit tests should cover
locale fallback, source/hash validation, stable identifiers and scope enforcement; browser
tests should cover switching, accessible names, original navigation, no-translation and
stale states. Verify narrow and wide layouts, Mermaid rendering, local search semantics and
that no unexpected network request carries context. Use synthetic fixtures for application
tests. CI results must not be inferred from local checks.

Always preserve the existing read-only and source-owned context boundaries. Ask before
changing workspace policy, adding dependencies, invoking a provider, publishing artifacts,
or changing an embedded public API. Never commit private documents, real records, secrets,
or private project paths to the public application repository.
