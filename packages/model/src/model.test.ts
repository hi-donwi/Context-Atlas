import { describe, expect, it } from 'vitest';
import { exportContext, searchNodes, selectNeighborhood, validateSnapshot } from './index.js';
import type { ContextNode, ContextSnapshot } from './types.js';

const node = (id: string, overrides: Partial<ContextNode> = {}): ContextNode => ({
  id,
  kind: 'service',
  label: id,
  description: `Description of ${id}`,
  sourceIds: ['contract'],
  status: 'implemented',
  evidence: 'declared',
  tags: [],
  ...overrides,
});

function fixture(): ContextSnapshot {
  return {
    schemaVersion: '1.0',
    project: {
      id: 'sample',
      name: 'Synthetic API',
      description: 'A synthetic example.',
      kind: 'api',
      capabilities: ['overview', 'journey', 'api'],
      tags: ['synthetic'],
      version: '1.0',
    },
    sources: [
      {
        id: 'contract',
        label: 'Contract',
        path: 'contracts/openapi.json',
        revision: 'sample-v1',
        freshness: 'current',
      },
      {
        id: 'notes',
        label: 'Restricted notes',
        path: 'notes/design.md',
        revision: 'sample-v2',
        freshness: 'stale',
      },
    ],
    nodes: [
      node('orders', { kind: 'module' }),
      node('create', {
        kind: 'operation',
        moduleId: 'orders',
        tags: ['checkout'],
        details: {
          endpoint: {
            method: 'POST',
            path: '/orders',
            authentication: 'Bearer',
            request: { orderId: 'example' },
            responses: {
              '201': { description: 'Created' },
              '400': { description: 'Invalid request' },
            },
          },
          notes: ['Acceptance remains unknown.'],
        },
      }),
      node('store', { kind: 'table', moduleId: 'orders' }),
      node('secret', {
        label: 'Hidden invention',
        description: 'Never export this text.',
        sourceIds: ['notes'],
      }),
      node('unrelated'),
    ],
    edges: [
      {
        id: 'write',
        source: 'create',
        target: 'store',
        relation: 'writes',
        sourceIds: ['contract'],
        evidence: 'reviewed',
      },
      {
        id: 'inferred',
        source: 'create',
        target: 'secret',
        relation: 'related-to',
        sourceIds: ['notes'],
        evidence: 'inferred',
      },
    ],
    views: [
      {
        id: 'checkout',
        kind: 'journey',
        label: 'Private journey label',
        description: 'Hidden journey narrative.',
        nodeIds: ['create', 'store', 'secret'],
        steps: [{ nodeId: 'secret', label: 'Secret step narrative' }],
      },
    ],
  };
}

describe('snapshot validation', () => {
  it('accepts a versioned snapshot without changing it', () => {
    const value = fixture();
    expect(validateSnapshot(value)).toEqual({ success: true, snapshot: value });
  });

  it('accepts a general project kind when the host has no application type metadata', () => {
    const value = fixture();
    const generic = { ...value, project: { ...value.project, kind: 'general' } };
    expect(validateSnapshot(generic)).toEqual({ success: true, snapshot: generic });
  });

  it.each([null, [], {}, { schemaVersion: '2.0' }, { ...fixture(), unknown: true }])(
    'rejects malformed snapshots',
    (value) => {
      expect(validateSnapshot(value).success).toBe(false);
    },
  );

  it('rejects unknown details and invalid field types', () => {
    const value = fixture();
    expect(
      validateSnapshot({ ...value, nodes: [{ ...value.nodes[0], details: { surprise: true } }] })
        .success,
    ).toBe(false);
    expect(
      validateSnapshot({ ...value, nodes: [{ ...value.nodes[0], sourceIds: 42 }] }).success,
    ).toBe(false);
  });

  it.each([
    '/etc/passwd',
    '../secret.md',
    'docs/../../secret.md',
    'C:\\secret.md',
    'https://example.test/a',
    'docs\\secret.md',
    'docs/%2e%2e/secret.md',
  ])('rejects unsafe source paths: %s', (path) => {
    const value = fixture();
    value.sources[0]!.path = path;
    expect(validateSnapshot(value).success).toBe(false);
  });

  it.each(['nodes', 'sources', 'edges', 'views'] as const)(
    'rejects duplicate %s identities',
    (kind) => {
      const value = fixture();
      const first = value[kind][0]!;
      const invalid = { ...value, [kind]: [...value[kind], first] };
      expect(validateSnapshot(invalid).success).toBe(false);
    },
  );

  it('reports missing node, source, module, and view references', () => {
    const value = fixture();
    value.nodes[1]!.sourceIds = ['missing-source'];
    value.nodes[1]!.moduleId = 'missing-module';
    value.edges[0]!.target = 'missing-node';
    value.views[0]!.nodeIds.push('missing-view-node');
    value.views[0]!.steps!.push({ nodeId: 'missing-step', label: 'Unknown' });
    const result = validateSnapshot(value);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.length).toBeGreaterThanOrEqual(5);
  });

  it('rejects module cycles and non-module parents', () => {
    const value = fixture();
    value.nodes[0]!.moduleId = 'create';
    expect(validateSnapshot(value).success).toBe(false);
    value.nodes[0]!.moduleId = 'orders';
    expect(validateSnapshot(value).success).toBe(false);
  });

  it('rejects a journey step outside its declared node membership', () => {
    const value = fixture();
    value.views[0]!.steps!.push({ nodeId: 'unrelated', label: 'Outside journey' });
    expect(validateSnapshot(value).success).toBe(false);
  });
});

describe('bounded graph selection', () => {
  it('includes one-hop neighbors and required module ancestors only', () => {
    const result = selectNeighborhood(fixture(), ['create']);
    expect(result.nodes.map((entry) => entry.id)).toEqual(['orders', 'create', 'store', 'secret']);
    expect(result.nodes.some((entry) => entry.id === 'unrelated')).toBe(false);
    expect(validateSnapshot(result).success).toBe(true);
  });

  it('supports an exact selection with module closure', () => {
    const result = selectNeighborhood(fixture(), ['create'], 0);
    expect(result.nodes.map((entry) => entry.id)).toEqual(['orders', 'create']);
    expect(result.edges).toEqual([]);
    expect(validateSnapshot(result).success).toBe(true);
  });

  it('does not silently discard explicit selection or exceed the node budget', () => {
    expect(() => selectNeighborhood(fixture(), ['create'], 0, 1)).toThrow(/budget|limit/i);
    expect(selectNeighborhood(fixture(), ['create'], 1, 2).nodes).toHaveLength(2);
    expect(() => selectNeighborhood(fixture(), ['missing'])).toThrow(/unknown/i);
    expect(() => selectNeighborhood(fixture(), [], 1, 0)).toThrow(/budget|limit/i);
  });

  it('returns independent objects so consumers cannot mutate the source', () => {
    const value = fixture();
    const result = selectNeighborhood(value, ['create'], 0);
    result.nodes[0]!.label = 'Changed';
    expect(value.nodes[0]!.label).toBe('orders');
  });
});

describe('source-allowlisted context export', () => {
  it('exports a valid snapshot without disallowed facts or view narratives', () => {
    const packet = exportContext(fixture(), {
      nodeIds: ['create'],
      allowedSourceIds: ['contract'],
      objective: 'Review this operation',
    });
    const serialized = JSON.stringify(packet);
    expect(packet.nodeIds).toEqual(['orders', 'create', 'store']);
    expect(packet.snapshot.sources.map((source) => source.id)).toEqual(['contract']);
    expect(serialized).not.toContain('Hidden invention');
    expect(serialized).not.toContain('Never export');
    expect(serialized).not.toContain('Hidden journey');
    expect(serialized).not.toContain('Secret step');
    expect(serialized).not.toContain('Restricted notes');
    expect(validateSnapshot(packet.snapshot).success).toBe(true);
    expect(packet.markdown).toContain('Review this operation');
    expect(packet.markdown).toContain('POST /orders');
    expect(packet.markdown).toContain('sample-v1');
    expect(packet.markdown).toContain('Acceptance remains unknown.');
    expect(packet.markdown).toContain('400');
  });

  it('rejects selected facts outside the explicit source allowlist', () => {
    expect(() =>
      exportContext(fixture(), { nodeIds: ['secret'], allowedSourceIds: ['contract'] }),
    ).toThrow(/allowed|source/i);
    expect(() => exportContext(fixture(), { nodeIds: ['create'], allowedSourceIds: [] })).toThrow(
      /allowed|source/i,
    );
    expect(() =>
      exportContext(fixture(), { nodeIds: ['create'], allowedSourceIds: ['missing'] }),
    ).toThrow(/unknown/i);
  });

  it('does not export an edge whose own evidence source is excluded', () => {
    const value = fixture();
    value.edges[0]!.sourceIds = ['notes'];
    const packet = exportContext(value, {
      nodeIds: ['create', 'store'],
      allowedSourceIds: ['contract'],
      depth: 0,
    });
    expect(packet.snapshot.edges).toEqual([]);
  });

  it('rejects an allowed child when its required module evidence is excluded', () => {
    const value = fixture();
    value.nodes[0]!.sourceIds = ['notes'];
    expect(() =>
      exportContext(value, { nodeIds: ['create'], allowedSourceIds: ['contract'] }),
    ).toThrow(/allowed|source/i);
  });

  it('is deterministic and does not modify the imported snapshot', () => {
    const value = fixture();
    const before = JSON.stringify(value);
    const options = { nodeIds: ['create'], allowedSourceIds: ['contract'] } as const;
    expect(exportContext(value, options)).toEqual(exportContext(value, options));
    expect(JSON.stringify(value)).toBe(before);
  });
});

describe('search', () => {
  it('matches labels, tags, and endpoint paths without losing module scope', () => {
    expect(searchNodes(fixture(), 'CHECKOUT').map((entry) => entry.id)).toEqual(['create']);
    expect(searchNodes(fixture(), '/orders', 'orders').map((entry) => entry.id)).toEqual([
      'create',
    ]);
    expect(searchNodes(fixture(), 'unrelated', 'orders')).toEqual([]);
    expect(searchNodes(fixture(), 'no matching entry')).toEqual([]);
  });
});
