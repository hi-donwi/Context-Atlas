# Contributing

Context Atlas is a source-linked project explorer. Contributions should make project
information easier to understand without creating another source of truth.

## Development

Use Node.js 22.12 or later and the committed npm lockfile.

```sh
npm ci
npm run dev
npm run verify
npx playwright install chromium
npm run test:e2e
```

Keep TypeScript strict. Put reusable contracts and pure graph behavior in
`packages/model`, source-specific projection in adapters, and presentation in the viewer.
The demo supplies examples and browser interactions; it must not become the owner of
business rules or integration permissions.

## Changes

1. Describe the reader's problem and the expected behavior.
2. Add a failing test for new logic or a reproduced defect.
3. Make the smallest coherent change and run the relevant checks.
4. For visual changes, inspect a narrow and wide layout and keyboard access.
5. Update public contracts and documentation when behavior changes.
6. Open a focused pull request with the result and verification evidence.

Use Conventional Commit messages, such as `fix(model): reject dangling view references`.
Architectural changes should explain the source ownership and compatibility implications
in an ADR under `docs/adr/`.

## Examples and reports

Use purpose-built synthetic fixtures. Do not contribute client documents, copied private
snapshots, credentials, private source paths, or real customer records. A bug report should
include a small synthetic input, expected behavior, observed behavior, and reproduction
steps. Do not include secrets or private project data in a public security report.

## Compatibility

Snapshot version `1.0` is explicit. Do not silently reinterpret existing node kinds,
evidence states, or relationships. Preserve source references and mark inferred facts.
Adapters must not label a declaration as implemented or accepted without supporting
evidence. An edit callback is an intent for the host to validate, not permission to write.
