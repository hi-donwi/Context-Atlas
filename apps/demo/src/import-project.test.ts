import { describe, expect, it } from 'vitest';
import { apiProject } from './fixtures/index.js';
import { parseProjectText } from './import-project.js';

describe('local project import', () => {
  it('accepts a valid context snapshot without replacing its provenance', () => {
    const imported = parseProjectText(JSON.stringify(apiProject), 'project.json');
    expect(imported.project.id).toBe(apiProject.project.id);
    expect(imported.sources).toEqual(apiProject.sources);
  });

  it('rejects malformed JSON and unsupported files with actionable errors', () => {
    expect(() => parseProjectText('{broken', 'broken.json')).toThrow('valid JSON');
    expect(() => parseProjectText('{}', 'project.yaml')).toThrow('JSON');
    expect(() => parseProjectText(JSON.stringify({ schemaVersion: '9.0' }), 'future.json')).toThrow(
      'snapshot',
    );
  });

  it('imports declared API facts without creating frontend or database behavior', () => {
    const imported = parseProjectText(
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Synthetic API', version: '1' },
        paths: { '/items': { get: { responses: { '200': { description: 'Items' } } } } },
      }),
      'contract.json',
    );
    expect(imported.project.kind).toBe('api');
    expect(imported.nodes.filter((n) => n.kind === 'operation')).toHaveLength(1);
    expect(imported.nodes.some((n) => n.kind === 'page' || n.kind === 'table')).toBe(false);
  });

  it('caps input size before parsing to keep a browser import bounded', () => {
    expect(() => parseProjectText(' '.repeat(5 * 1024 * 1024 + 1), 'large.json')).toThrow('5 MB');
  });
});
