# Integration guide

Context Atlas accepts a snapshot whose sources the host has already authorized.
Adapters translate source facts; the viewer provides navigation and interaction.
The packages are npm workspaces in this repository and are not yet published to npm.

## Build a snapshot

Use the exported `ContextSnapshot` type from `@context-atlas/model`. Its top-level shape
is `schemaVersion`, `project`, `sources`, `nodes`, `edges`, and `views`.

1. Give the project and each source, node, edge, and view a stable ID.
2. Declare only the project's available view capabilities.
3. Attach source IDs and evidence labels to nodes and relationships.
4. Keep source paths relative to their repository and include a revision.
5. Reference the same node from multiple views rather than duplicating it.
6. Validate the resulting snapshot before display or persistence.

```ts
import { validateSnapshot } from '@context-atlas/model';

const result = validateSnapshot(untrustedJson);
if (!result.success) {
  throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
}

const snapshot = result.snapshot;
```

Do not mark generated declarations as verified implementations. A technical adapter
should retain a source's stated facts and leave missing business relationships visible.
Use a separate, source-linked documentation overlay for reviewed narrative mappings.

## Project OpenAPI

```ts
import { importOpenApi } from '@context-atlas/adapter-openapi';

const snapshot = importOpenApi(openApiJson, {
  projectId: 'sample-api',
  name: 'Sample API',
  sourcePath: 'contracts/openapi.json',
});
```

The adapter accepts OpenAPI 3.0/3.1 JSON and projects declared operations and schemas.
It does not make HTTP requests, fetch remote `$ref` documents, or infer database tables,
application services, frontend pages, or completed user journeys. Keep the original
contract authoritative and regenerate the snapshot when it changes.

## Embed the viewer

```tsx
import type { ContextSnapshot, ExplorerHost } from '@context-atlas/model';
import { ContextExplorer } from '@context-atlas/viewer';
import '@context-atlas/viewer/styles.css';

export function ProjectContext({
  snapshot,
  host,
}: {
  snapshot: ContextSnapshot;
  host: ExplorerHost;
}) {
  return <ContextExplorer snapshot={snapshot} host={host} />;
}
```

`host.openReference(source)` asks the host to open the selected source. Resolve its
repository, relative path, and revision within an authorized root. A path in an imported
snapshot is not permission to open that file.

`host.requestEdit(node)` is an edit intent. A host may open a documentation editor or
an existing application-model editor. It must check permissions, validate semantics,
handle revision conflicts, and save through its normal source-writing mechanism.
Regenerate derived contracts and snapshots after the edit.

Supplying the callback does not turn the graph into an executable workflow or a model
builder. The standalone demo does not implement application-model editing.

## Export selected context

```ts
import { exportContext } from '@context-atlas/model';

const packet = exportContext(snapshot, {
  nodeIds: ['sample-operation'],
  allowedSourceIds: ['api-contract', 'reviewed-journey'],
  depth: 1,
  maxNodes: 20,
  objective: 'Explain this operation and identify the next implementation task.',
});

const markdown = packet.markdown;
const selectedSnapshot = packet.snapshot;
```

The source allowlist is mandatory. Choose it from the host's approved export scope,
not simply from every source in a workspace. The host is responsible for deciding
whether the reader, coding agent, or export destination may receive those facts.
Authorize data before it enters the viewer: a source filter is not access control.

Keep selected exports small. Include source revisions and unknowns so a receiving agent
can locate the actual files and avoid treating stale evidence as current behavior.

## Planned host adapters

An agent-workspace host can project project summaries, tasks, runs, and documentation,
while retaining its existing record ownership and write commands. A Kerangka host can
project model/IR, UIDL, and journey references, then route edits to its existing editors
and compiler validation. Neither production integration is included in this release.

Avoid copying an entire host runtime into an adapter. The reusable seam is the snapshot
and callbacks; authorization and business semantics remain with the owning system.
