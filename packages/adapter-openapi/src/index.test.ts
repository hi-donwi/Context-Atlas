import { describe, expect, it } from 'vitest';
import { validateSnapshot } from '@context-atlas/model';
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
    for (const sourcePath of ['/private/openapi.json', '../openapi.json', 'C:\\private\\openapi.json', 'contracts/../openapi.json', 'contracts\\openapi.json', 'contracts/%2e%2e/openapi.json', 'contracts//openapi.json', 'contracts/openapi.json/']) {
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

  it('ignores specification extensions on paths and retains declared authentication scopes', () => {
    const snapshot = importOpenApi({
      openapi: '3.1.0', info: { title: 'Scoped API', version: '1' },
      paths: { 'x-owner': 'synthetic-team', '/orders': { post: { security: [{ oauth: ['orders:create'] }], responses: { '201': { description: 'Created' } } } } },
    });
    expect(snapshot.nodes.find((node) => node.kind === 'operation')?.details?.endpoint?.authentication).toBe('oauth [orders:create]');
  });

  it('deduplicates repeated operation tags without emitting duplicate graph identities', () => {
    const input = structuredClone(document);
    input.paths['/items'].post.tags = ['Items', 'Items'];
    const snapshot = importOpenApi(input);
    expect(snapshot.nodes.find((node) => node.details?.endpoint?.method === 'POST')?.tags).toEqual(['Items']);
    expect(new Set(snapshot.edges.map((edge) => edge.id)).size).toBe(snapshot.edges.length);
    expect(validateSnapshot(snapshot)).toMatchObject({ success: true });
  });

  it('rejects blank custom project names before returning an invalid snapshot', () => {
    for (const name of ['', '   ']) expect(() => importOpenApi(document, { name })).toThrow(OpenApiImportError);
  });

  it('overrides inherited parameters with operation parameters having the same name and location', () => {
    const snapshot = importOpenApi({
      openapi: '3.1.0', info: { title: 'Override API', version: '1' },
      paths: { '/items': {
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } }, { name: 'locale', in: 'query', schema: { type: 'string' } }],
        get: { parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', maximum: 10 } }, { name: 'limit', in: 'header', schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } },
      } },
    });
    const parameters = snapshot.nodes.find((node) => node.kind === 'operation')?.details?.endpoint?.parameters;
    expect(parameters).toEqual([
      { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 10 } },
      { name: 'locale', in: 'query', schema: { type: 'string' } },
      { name: 'limit', in: 'header', schema: { type: 'string' } },
    ]);
  });

  it('rejects prototype and unsupported response keys instead of silently losing response data', () => {
    for (const status of ['__proto__', 'constructor', '600', '20X']) {
      const input = JSON.parse(`{"openapi":"3.1.0","info":{"title":"Response API","version":"1"},"paths":{"/items":{"get":{"responses":{"${status}":{"description":"Invalid response key"},"200":{"description":"OK"}}}}}}`) as unknown;
      expect(() => importOpenApi(input)).toThrow(/response.*key/i);
    }
  });

  it('supports response ranges, default responses, and opaque extensions without changing the response prototype', () => {
    const snapshot = importOpenApi({ openapi: '3.1.0', info: { title: 'Responses API', version: '1' }, paths: { '/items': { get: { responses: { '2XX': { description: 'Success range' }, default: { description: 'Other outcomes' }, 'x-owner': 'synthetic-team' } } } } });
    const responses = snapshot.nodes.find((node) => node.kind === 'operation')?.details?.endpoint?.responses;
    expect(responses).toEqual({ '2XX': { description: 'Success range' }, default: { description: 'Other outcomes' } });
    expect(Object.getPrototypeOf(responses)).toBe(Object.prototype);
    expect(validateSnapshot(snapshot)).toMatchObject({ success: true });
  });

  it('rejects any projected object that cannot satisfy the public context contract', () => {
    const input = { openapi: '3.1.0', info: { title: 'Invalid schema label', version: '1' }, paths: {}, components: { schemas: { '': { type: 'object' } } } };
    expect(() => importOpenApi(input)).toThrow(/projected context is invalid/i);
  });
});
