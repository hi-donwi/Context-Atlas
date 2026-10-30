# Context Atlas 0.1

Context Atlas helps a reader understand a project, trace a feature across its layers,
and prepare a bounded context packet for the next task. It is a reusable read-only
explorer with host-owned integration points, not an execution engine.

## Initial release

- A framework-neutral, versioned context snapshot with typed nodes, relationships,
  evidence, source revisions, and capability-driven views.
- A `general` project kind for hosts that do not declare an API, website, full-stack, or
  learning category; existing project kinds retain their meanings.
- Runtime validation rejects malformed snapshots, duplicate identities, missing
  references, unsupported versions, and unsafe source paths.
- A React explorer with navigation, search, module filtering, graph and textual views,
  a source-linked inspector, API details, field lists, work records, and study notes.
- An API-first synthetic project and a website synthetic project demonstrate different
  capabilities. Imported JSON stays in browser memory and never uploads automatically.
- Import a snapshot or OpenAPI 3.0/3.1 JSON document. No remote reference fetching.
- Export a selected, source-allowlisted neighborhood as Markdown and valid snapshot JSON.
- Host callbacks can open references and request editing; hosts retain authorization
  and semantic write validation. The standalone demo does not edit application behavior.

## Acceptance

An unfamiliar reader can identify a feature's actor, ordered journey, endpoint contract,
service and data references, failure path, source evidence, and next task. API-only
projects expose no invented frontend. Hypothetical study notes and implementation
evidence retain distinct labels. Unknown, stale, and inferred information is visible.

Snapshot import failure preserves the currently opened project and reports an actionable
error. Empty search results provide a reset. URL selection can be shared and reloaded.
Keyboard users have a textual equivalent to canvas selection. Narrow layouts preserve
navigation, inspector access, readable controls, and bounded horizontal content.

## Commands and layout

Use Node 22.12 or later and npm workspaces. `npm ci` installs locked dependencies;
`npm run dev` serves the demo; `npm run verify` runs strict type checks, unit tests,
package builds, and the demo build; `npm run test:e2e` verifies browser journeys.

`packages/model` owns contracts, validation, graph selection, and exports;
`packages/adapter-openapi` projects declared API facts; `packages/viewer` owns rendering
and interactions; `apps/demo` supplies synthetic examples and local file import.

## Boundaries

Always preserve provenance and validate external input. Display imported text as text.
Public examples are purpose-built synthetic data. No automatic filesystem discovery,
network calls, API execution, telemetry, task writes, or model compilation are included.
Real project adapters remain with their hosts and require separate implementation.

## Design declaration

Use an editorial engineering workbench: warm neutral canvas, dark ink typography, teal
accent, thin semantic borders, compact controls, square icon targets, and a clear three-pane
hierarchy. Use the system sans-serif stack and monospace for contracts. CSS semantic
tokens own color, spacing, radii, and typography. Prefer diagrams to decorative imagery.
Desktop shows navigation, work surface, and inspector together; narrow screens stack them
with explicit section links and a textual graph alternative. No external fonts or assets.

## Verification

Unit tests cover malformed input, referential integrity, source allowlists, bounded
selection, deterministic exports, and the OpenAPI adapter. Browser tests cover project
switching, journey/API inspection, search, invalid import recovery, downloads, deep links,
and narrow layouts. Source review precedes public publication.
