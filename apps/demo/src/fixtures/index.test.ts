import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { importOpenApi } from '@context-atlas/adapter-openapi';
import { demoProjects, apiProject, websiteProject } from './index.js';

describe('synthetic project fixtures', () => {
  it.each(demoProjects)(
    '$project.name has complete object and provenance references',
    (snapshot) => {
      const ids = new Set(snapshot.nodes.map((node) => node.id));
      const sources = new Set(snapshot.sources.map((source) => source.id));
      expect(ids.size).toBe(snapshot.nodes.length);
      expect(sources.size).toBe(snapshot.sources.length);
      for (const node of snapshot.nodes) {
        expect(node.sourceIds.length).toBeGreaterThan(0);
        expect(node.sourceIds.every((id) => sources.has(id))).toBe(true);
        if (node.moduleId)
          expect(snapshot.nodes.find((item) => item.id === node.moduleId)?.kind).toBe('module');
      }
      for (const edge of snapshot.edges) {
        expect(ids.has(edge.source) && ids.has(edge.target)).toBe(true);
        expect(edge.sourceIds.every((id) => sources.has(id))).toBe(true);
      }
      for (const view of snapshot.views) {
        expect(view.nodeIds.every((id) => ids.has(id))).toBe(true);
        expect(view.steps?.every((step) => view.nodeIds.includes(step.nodeId)) ?? true).toBe(true);
      }
    },
  );

  it.each(demoProjects)('$project.name public example matches the demo source', (snapshot) => {
    const file = new URL(
      `../../public/examples/${snapshot.project.id}.context.json`,
      import.meta.url,
    );
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(snapshot);
  });

  it('keeps the API example API-only and labels uncertain study and unfinished work', () => {
    expect(apiProject.nodes.some((node) => node.kind === 'page')).toBe(false);
    expect(apiProject.nodes.find((node) => node.id === 'failure-study')).toMatchObject({
      status: 'proposed',
      evidence: 'inferred',
    });
    expect(apiProject.sources.find((source) => source.id === 'commerce-study')?.freshness).toBe(
      'stale',
    );
    expect(
      apiProject.nodes.find((node) => node.id === 'reservation-task')?.details?.task?.state,
    ).toBe('blocked');
    expect(websiteProject.nodes.some((node) => node.kind === 'page')).toBe(true);
  });

  it('provides a self-contained synthetic OpenAPI document for local import', () => {
    const document = JSON.parse(
      readFileSync(new URL('../../public/examples/catalog.openapi.json', import.meta.url), 'utf8'),
    ) as unknown;
    const snapshot = importOpenApi(document);
    expect(snapshot.nodes.filter((node) => node.kind === 'operation')).toHaveLength(2);
    expect(snapshot.nodes.filter((node) => node.kind === 'entity')).toHaveLength(2);
  });
});
