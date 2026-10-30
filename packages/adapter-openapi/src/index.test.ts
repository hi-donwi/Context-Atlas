import { describe, expect, it } from 'vitest';
import { importOpenApi, OpenApiImportError } from './index.js';

const document = {
  openapi: '3.1.0',
  info: { title: 'Example API', version: '1.2.0' },
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
    schemas: { Item: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, label: { type: 'string' } } } },
  },
  paths: {
    '/items': {
      parameters: [{ name: 'locale', in: 'query', schema: { type: 'string' } }],
      post: {
        operationId: 'createItem', summary: 'Create an item', tags: ['Items'],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } } }, '400': { description: 'Invalid input' } },
      },
      get: { security: [], responses: { '200': { description: 'List items' } } },
    },
  },
};

describe('importOpenApi', () => {
  it('projects declared API contracts without inventing implementation or physical tables', () => {
    const snapshot = importOpenApi(document, { projectId: 'example', sourcePath: 'contracts/openapi.json' });
    expect(snapshot.project.id).toBe('example');
    expect(snapshot.project.name).toBe('Example API');
    expect(snapshot.nodes.filter((node) => node.kind === 'operation')).toHaveLength(2);
    expect(snapshot.nodes.every((node) => node.status === 'proposed' && node.evidence === 'declared')).toBe(true);
    expect(snapshot.nodes.some((node) => node.kind === 'table' || node.kind === 'service' || node.kind === 'page')).toBe(false);
    expect(snapshot.sources[0]).toMatchObject({ path: 'contracts/openapi.json', freshness: 'unknown', revision: '1.2.0' });
  });

  it('retains request, response variants, inherited parameters, and authentication', () => {
    const snapshot = importOpenApi(document);
    const endpoint = snapshot.nodes.find((node) => node.details?.endpoint?.method === 'POST')?.details?.endpoint;
    expect(endpoint).toMatchObject({ method: 'POST', path: '/items', authentication: 'bearerAuth' });
    expect(endpoint?.request).toEqual(document.paths['/items'].post.requestBody);
    expect(endpoint?.responses).toEqual(document.paths['/items'].post.responses);
    expect(endpoint?.parameters).toEqual(document.paths['/items'].parameters);
    expect(snapshot.nodes.find((node) => node.details?.endpoint?.method === 'GET')?.details?.endpoint?.authentication).toBe('Public');
  });

  it('keeps method/path identities stable when an operationId changes', () => {
    const changed = structuredClone(document);
    changed.paths['/items'].post.operationId = 'renamedCreate';
    expect(importOpenApi(changed).nodes.map((node) => node.id)).toEqual(importOpenApi(document).nodes.map((node) => node.id));
  });

  it('exposes schemas as entities and connects declared input and output references', () => {
    const snapshot = importOpenApi(document);
    const schema = snapshot.nodes.find((node) => node.kind === 'entity');
    expect(schema?.label).toBe('Item');
    expect(schema?.details?.fields).toContainEqual({ name: 'id', type: 'string', required: true });
    expect(snapshot.edges.filter((edge) => edge.target === schema?.id).map((edge) => edge.relation)).toEqual(expect.arrayContaining(['accepts', 'returns']));
  });

  it('resolves local response objects while preserving external references without fetching them', () => {
    const snapshot = importOpenApi({
      openapi: '3.0.3', info: { title: 'Reference API', version: '1' },
      components: { responses: { Success: { description: 'Resolved locally' } } },
      paths: { '/health': { get: { responses: { '200': { $ref: '#/components/responses/Success' }, '502': { $ref: 'https://example.invalid/error.json' } } } } },
    });
    const responses = snapshot.nodes.find((node) => node.kind === 'operation')?.details?.endpoint?.responses;
    expect(responses?.['200']).toEqual({ description: 'Resolved locally' });
    expect(responses?.['502']).toEqual({ $ref: 'https://example.invalid/error.json' });
  });

  it('rejects unsupported or incomplete input with an actionable typed error', () => {
    for (const input of [null, [], {}, { openapi: '2.0' }, { openapi: '3.2.0', info: {}, paths: {} }, { openapi: '3.1.0', info: { title: 'Missing version' }, paths: {} }]) {
      expect(() => importOpenApi(input)).toThrow(OpenApiImportError);
    }
  });

  it('rejects malformed operations instead of silently producing incomplete endpoints', () => {
    expect(() => importOpenApi({ openapi: '3.1.0', info: { title: 'Broken', version: '1' }, paths: { '/broken': { post: { responses: [] } } } })).toThrow(/responses/i);
    expect(() => importOpenApi({ openapi: '3.1.0', info: { title: 'Broken', version: '1' }, paths: { notAPath: { get: { responses: {} } } } })).toThrow(/path/i);
  });

  it('rejects absolute and traversal source paths', () => {
    for (const sourcePath of ['/private/openapi.json', '../openapi.json', 'C:\\private\\openapi.json', 'contracts/../openapi.json']) {
      expect(() => importOpenApi(document, { sourcePath })).toThrow(/source path/i);
    }
  });

  it('produces an inspectable empty project when a valid contract declares no operations', () => {
    const snapshot = importOpenApi({ openapi: '3.0.3', info: { title: 'Empty API', version: '0' }, paths: {} });
    expect(snapshot.nodes).toEqual([]);
    expect(snapshot.views.map((view) => view.kind)).toEqual(['overview', 'api']);
  });

  it('does not mutate the input document', () => {
    const original = structuredClone(document);
    importOpenApi(document);
    expect(document).toEqual(original);
  });
});
