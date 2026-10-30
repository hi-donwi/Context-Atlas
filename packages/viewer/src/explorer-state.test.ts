import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ContextSnapshot } from '@context-atlas/model';
import { ContextExplorer } from './ContextExplorer.js';
import { filterNodes, layoutNodes, readSelection, reconcileSelection } from './explorer-state.js';

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

  it('uses a declared overview identity and keeps it reachable in navigation', () => {
    const curated: ContextSnapshot = {
      ...snapshot,
      views: [
        {
          id: 'curated-summary',
          kind: 'overview',
          label: 'Curated summary',
          description: 'Only the selected module',
          nodeIds: ['orders'],
        },
        ...snapshot.views,
      ],
    };
    expect(readSelection(curated, '').viewId).toBe('curated-summary');
    expect(readSelection(curated, '?view=missing').viewId).toBe('curated-summary');
    const markup = renderToStaticMarkup(createElement(ContextExplorer, { snapshot: curated }));
    expect(markup).toContain('Curated summary');
    expect(markup).toContain('Order module');
    expect(markup).not.toContain('Catalog module');
  });

  it('keeps an API view named overview distinct from the synthetic project summary', () => {
    const collision: ContextSnapshot = {
      ...snapshot,
      views: [{ ...snapshot.views[0]!, id: 'overview' }],
    };
    expect(readSelection(collision, '').viewId).toBe('_overview');
    expect(readSelection(collision, '?view=overview').viewId).toBe('overview');
    const markup = renderToStaticMarkup(createElement(ContextExplorer, { snapshot: collision }));
    expect(markup).toContain('Project overview');
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toContain('Order module');
  });

  it('chooses a deterministic unused synthetic overview identity', () => {
    const collision: ContextSnapshot = {
      ...snapshot,
      views: [
        { ...snapshot.views[0]!, id: 'overview' },
        { ...snapshot.views[0]!, id: '_overview' },
      ],
    };
    expect(readSelection(collision, '').viewId).toBe('__overview');
  });

  it('does not expand an empty declared overview into all project objects', () => {
    const empty: ContextSnapshot = {
      ...snapshot,
      views: [
        {
          id: 'empty-summary',
          kind: 'overview',
          label: 'Empty summary',
          description: 'No curated objects yet',
          nodeIds: [],
        },
        ...snapshot.views,
      ],
    };
    const markup = renderToStaticMarkup(createElement(ContextExplorer, { snapshot: empty }));
    expect(markup).not.toContain('Order module');
    expect(markup).not.toContain('Catalog module');
    expect(markup).toContain('0 objects');
  });

  it('resets removed views and modules when the same project snapshot is replaced', () => {
    const previous = readSelection(snapshot, '?view=api&node=create&module=orders');
    const operation = { ...snapshot.nodes[1]! };
    delete operation.moduleId;
    const replacement: ContextSnapshot = {
      ...snapshot,
      nodes: [operation],
      views: [{ ...snapshot.views[0]!, id: 'new-api' }],
    };
    expect(reconcileSelection(replacement, previous)).toEqual({
      viewId: 'overview',
      nodeId: 'create',
      moduleId: 'all',
    });
    expect(reconcileSelection(replacement, { ...previous, nodeId: 'removed' }).nodeId).toBeNull();
    expect(reconcileSelection({ ...snapshot }, previous)).toEqual(previous);
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
