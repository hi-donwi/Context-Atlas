import type { ContextEdge, ContextNode, ContextSource } from '@context-atlas/model';

export function source(id: string, path: string, label: string, freshness: ContextSource['freshness'] = 'current'): ContextSource {
  return { id, path, label: `Synthetic ${label}`, revision: 'demo-v1', repository: 'synthetic/example-project', freshness };
}

export function node(input: Pick<ContextNode, 'id' | 'kind' | 'label' | 'description'> & Partial<ContextNode>): ContextNode {
  return { sourceIds: ['commerce-journey'], status: 'implemented', evidence: 'reviewed', tags: [], ...input };
}

export function edge(sourceId: string, target: string, relation: string, provenance = 'commerce-journey', label?: string): ContextEdge {
  return { id: `${sourceId}:${relation}:${target}`, source: sourceId, target, relation, sourceIds: [provenance], evidence: 'reviewed', ...(label ? { label } : {}) };
}
