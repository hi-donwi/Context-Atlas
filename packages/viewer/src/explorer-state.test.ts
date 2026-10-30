import { describe, expect, it } from 'vitest';
import type { ContextSnapshot } from '@context-atlas/model';
import { filterNodes, layoutNodes, readSelection } from './explorer-state.js';

const snapshot: ContextSnapshot = {
  schemaVersion: '1.0',
  project: {
    id: 'example',
    name: 'Example',
    description: 'Synthetic',
    kind: 'api',
    capabilities: ['overview', 'api'],
    tags: [],
    version: '1',
  },
  sources: [],
  nodes: [
    {
      id: 'orders',
      label: 'Orders',
      description: 'Order module',
      kind: 'module',
      sourceIds: [],
      status: 'proposed',
      evidence: 'declared',
      tags: [],
    },
    {
      id: 'create',
      label: 'Create order',
      description: 'Creates an order',
      kind: 'operation',
      moduleId: 'orders',
      sourceIds: [],
      status: 'implemented',
      evidence: 'reviewed',
      tags: ['checkout'],
    },
    {
      id: 'catalog',
      label: 'Catalog',
      description: 'Catalog module',
      kind: 'module',
      sourceIds: [],
      status: 'proposed',
      evidence: 'declared',
      tags: [],
    },
  ],
  edges: [],
  views: [
    { id: 'api', kind: 'api', label: 'API', description: 'API contracts', nodeIds: ['create'] },
  ],
};

describe('explorer selection', () => {
  it('combines the selected view, module and case-insensitive search', () => {
    expect(filterNodes(snapshot, 'api', 'orders', 'CHECKOUT').map((n) => n.id)).toEqual(['create']);
    expect(filterNodes(snapshot, 'api', 'catalog', '')).toEqual([]);
  });

  it('never expands an empty named view into the entire project', () => {
    const empty = { ...snapshot, views: [{ ...snapshot.views[0]!, nodeIds: [] }] };
    expect(filterNodes(empty, 'api', 'all', '')).toEqual([]);
  });

  it('restores valid deep links and discards invalid object selections', () => {
    expect(readSelection(snapshot, '?view=api&node=create&module=orders')).toEqual({
      viewId: 'api',
      nodeId: 'create',
      moduleId: 'orders',
    });
    expect(readSelection(snapshot, '?view=missing&node=missing&module=missing')).toEqual({
      viewId: 'overview',
      nodeId: null,
      moduleId: 'all',
    });
  });

  it('keeps graph layout stable and does not mutate the snapshot', () => {
    const before = JSON.stringify(snapshot);
    const first = layoutNodes(snapshot.nodes);
    expect(first).toEqual(layoutNodes(snapshot.nodes));
    expect(new Set(first.map((n) => `${n.position.x}:${n.position.y}`)).size).toBe(
      snapshot.nodes.length,
    );
    expect(JSON.stringify(snapshot)).toBe(before);
  });
});
