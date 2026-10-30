import type { ContextNode, ContextSnapshot } from './types.js';
/** Select a bounded neighborhood and include mandatory module references. */
export declare function selectNeighborhood(snapshot: ContextSnapshot, nodeIds: readonly string[], depth?: 0 | 1, maxNodes?: number): ContextSnapshot;
/** Search only within the supplied, already-authorized project snapshot. */
export declare function searchNodes(snapshot: ContextSnapshot, query: string, moduleId?: string): ContextNode[];
