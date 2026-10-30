import type { ContextNode, ContextSnapshot } from './types.js';
import { assertSnapshot } from './validation.js';

function ancestors(id: string, nodes: Map<string, ContextNode>): string[] {
  const result: string[] = [];
  let current = nodes.get(id);
  while (current) {
    result.push(current.id);
    current = current.moduleId === undefined ? undefined : nodes.get(current.moduleId);
  }
  return result;
}

/** Select a bounded neighborhood and include mandatory module references. */
export function selectNeighborhood(
  snapshot: ContextSnapshot,
  nodeIds: readonly string[],
  depth: 0 | 1 = 1,
  maxNodes = 30,
): ContextSnapshot {
  assertSnapshot(snapshot);
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 1000) throw new Error('Node budget must be an integer between 1 and 1000');
  if (depth !== 0 && depth !== 1) throw new Error('Neighborhood depth must be 0 or 1');
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const explicit = new Set(nodeIds);
  const selected = new Set<string>();
  for (const id of explicit) {
    if (!byId.has(id)) throw new Error(`Unknown selected node: ${id}`);
    ancestors(id, byId).forEach((ancestor) => selected.add(ancestor));
  }
  if (selected.size > maxNodes) throw new Error('Node budget is too small for the selection and its module references');
  if (depth === 1) {
    const neighbors = new Set<string>();
    for (const edge of snapshot.edges) {
      if (explicit.has(edge.source)) neighbors.add(edge.target);
      if (explicit.has(edge.target)) neighbors.add(edge.source);
    }
    for (const node of snapshot.nodes) {
      if (!neighbors.has(node.id)) continue;
      const required = ancestors(node.id, byId).filter((id) => !selected.has(id));
      if (selected.size + required.length <= maxNodes) required.forEach((id) => selected.add(id));
    }
  }
  const nodes = snapshot.nodes.filter((node) => selected.has(node.id));
  const edges = snapshot.edges.filter((edge) => selected.has(edge.source) && selected.has(edge.target));
  const referencedSources = new Set([...nodes, ...edges].flatMap((item) => item.sourceIds));
  const capabilities = snapshot.project.capabilities.includes('overview')
    ? snapshot.project.capabilities : ['overview' as const, ...snapshot.project.capabilities];
  return structuredClone({
    schemaVersion: snapshot.schemaVersion,
    project: { ...snapshot.project, capabilities },
    nodes,
    edges,
    sources: snapshot.sources.filter((source) => referencedSources.has(source.id)),
    views: [{
      id: 'selected-context', kind: 'overview', label: 'Selected context',
      description: 'A bounded selection of project context.', nodeIds: nodes.map((node) => node.id),
    }],
  });
}

/** Search only within the supplied, already-authorized project snapshot. */
export function searchNodes(snapshot: ContextSnapshot, query: string, moduleId?: string): ContextNode[] {
  const needle = query.trim().toLocaleLowerCase('en');
  return snapshot.nodes.filter((node) => {
    if (moduleId && node.id !== moduleId && node.moduleId !== moduleId) return false;
    const endpoint = node.details?.endpoint;
    const haystack = [node.id, node.label, node.description, node.kind, ...node.tags, endpoint?.method ?? '', endpoint?.path ?? ''];
    return !needle || haystack.some((part) => part.toLocaleLowerCase('en').includes(needle));
  });
}
