# ADR-0001: Derived context snapshots and host-owned edits

- Status: Accepted
- Date: 2026-10-30

## Context

Readers need to connect project purpose, journeys, API contracts, implementation,
data, and work. Some projects only need documentation. Others already have a model
compiler and visual builder. Requiring all consumers to adopt that engine would limit
reuse; copying its semantics into a generic canvas would create conflicting behavior.

## Decision

Use a framework-neutral, explicitly versioned Context Snapshot contract. The first
version is `1.0`. Snapshots project existing sources into typed nodes, relationships,
source references, and views. They are read models, not new authoritative contracts.

Keep the model independent of React, source repositories, and host runtimes. A reusable
viewer consumes the model. Source-specific adapters project declared facts and retain
source revisions, evidence labels, and known gaps.

Journey views document order and relationships. They do not execute application workflows.
Canvas layout is separate from semantic identity and behavior.

Hosts own authorized loading, source navigation, editing, conflict checks, compiler
validation, and execution. The viewer can issue `openReference` and `requestEdit`
callbacks. It cannot grant permission to mutate or bypass the host's validation.

Context export requires an explicit source allowlist and a bounded selection. The host
authorizes the input and scope; an in-memory filter is not an authorization boundary.

## Consequences

- Ordinary project documentation and model-authoring tools can share visual components.
- A changed source can regenerate a snapshot without a competing editable contract.
- Evidence, implementation status, and source freshness remain distinguishable.
- Hosts must implement adapters and source resolution; the explorer cannot discover
  every business relationship automatically.
- A snapshot can be incomplete. The interface must expose unknowns rather than infer
  unsupported runtime or acceptance claims.

## Alternatives

| Alternative | Reason rejected |
| --- | --- |
| Require one application compiler for all projects | Couples documentation users to unrelated runtime semantics |
| Store API, task, and workflow state in the canvas | Creates duplicate authorities and conflicting write rules |
| Reconstruct all journeys automatically from source | Cannot establish business intent or acceptance from implementation alone |
| Use an untyped mind map as the contract | Cannot reliably validate references, evidence, or regeneration |
| Make edit callbacks write sources directly | Bypasses host ownership, revision checks, and domain validation |
