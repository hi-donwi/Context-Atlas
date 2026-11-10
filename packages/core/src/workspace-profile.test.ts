import { describe, expect, it } from 'vitest';
import { parseWorkspaceRegistry, planWorkspaceScopes } from './workspace-profile.js';

const REGISTRY = [
  'key\tclient\tgroup\tfolder\tremote\tcontext_scope\tsecurity_profile\tdescription\tcontext_repo\tkind',
  'billing-api\tnorthwind\tfinance\tprojects/northwind/billing-api\t-\tclient\t-\tBilling backend\tprojects/northwind/billing-context\tcode',
  'field-notes\tsolo\t-\t-\t-\tclient\t-\tResearch notes\t-\tresearch',
  '# a comment row is ignored',
  '',
  'portal\tnorthwind\t-\tprojects/northwind/portal\t-\tclient\t-\t-\t-\tcode',
].join('\n');

describe('parseWorkspaceRegistry', () => {
  it('reads projects by header name and treats "-" as absent', () => {
    expect(parseWorkspaceRegistry(REGISTRY)).toEqual([
      {
        key: 'billing-api',
        client: 'northwind',
        group: 'finance',
        description: 'Billing backend',
        contextRepo: 'projects/northwind/billing-context',
      },
      { key: 'field-notes', client: 'solo', description: 'Research notes' },
      { key: 'portal', client: 'northwind' },
    ]);
  });

  it('accepts columns in any order', () => {
    expect(parseWorkspaceRegistry('client\tkey\nacme\tsite\n')).toEqual([
      { key: 'site', client: 'acme' },
    ]);
  });

  it('returns no projects without key and client columns', () => {
    expect(parseWorkspaceRegistry('name\towner\nsite\tacme\n')).toEqual([]);
    expect(parseWorkspaceRegistry('')).toEqual([]);
  });

  it('skips rows whose key, client, or group is not one safe path segment', () => {
    const rows = [
      'key\tclient\tgroup',
      '../escape\tacme\t-',
      'site\t../acme\t-',
      'shop\tacme\tfinance/east',
      'ok\tacme\t-',
    ].join('\n');
    expect(parseWorkspaceRegistry(rows)).toEqual([{ key: 'ok', client: 'acme' }]);
  });

  it('drops an unsafe or excluded context repository path but keeps the project', () => {
    const rows = [
      'key\tclient\tcontext_repo',
      'a\tacme\t../outside',
      'b\tacme\t/absolute/path',
      'c\tacme\t.local/private-context',
    ].join('\n');
    expect(parseWorkspaceRegistry(rows)).toEqual([
      { key: 'a', client: 'acme' },
      { key: 'b', client: 'acme' },
      { key: 'c', client: 'acme' },
    ]);
  });

  it('ignores duplicate keys after the first row', () => {
    expect(parseWorkspaceRegistry('key\tclient\nsite\tacme\nsite\tother\n')).toEqual([
      { key: 'site', client: 'acme' },
    ]);
  });
});

describe('planWorkspaceScopes', () => {
  const projects = parseWorkspaceRegistry(REGISTRY);

  it('lists All, then each client, then each project', () => {
    expect(planWorkspaceScopes(projects).map((scope) => [scope.id, scope.kind])).toEqual([
      ['all', 'all'],
      ['client:northwind', 'client'],
      ['client:solo', 'client'],
      ['project:billing-api', 'project'],
      ['project:field-notes', 'project'],
      ['project:portal', 'project'],
    ]);
  });

  it('maps All to the context folder itself', () => {
    expect(planWorkspaceScopes(projects)[0]).toEqual({
      id: 'all',
      kind: 'all',
      label: 'All',
      mounts: [{ name: '', base: 'context', path: '' }],
      defaultDocuments: ['README.md', 'index.md'],
    });
  });

  it('slices one project to its memory, runs, client, group, and context repository', () => {
    const scope = planWorkspaceScopes(projects).find((item) => item.id === 'project:billing-api');
    expect(scope).toEqual({
      id: 'project:billing-api',
      kind: 'project',
      label: 'billing-api',
      description: 'Billing backend',
      mounts: [
        {
          name: 'billing-context',
          base: 'workspace',
          path: 'projects/northwind/billing-context',
          hidden: ['works'],
        },
        { name: 'memory', base: 'context', path: 'memory/projects/billing-api', hidden: ['works'] },
        { name: 'runs', base: 'context', path: 'runs/billing-api', hidden: ['works'] },
        { name: 'client', base: 'context', path: 'clients/northwind', hidden: ['groups', 'works'] },
        {
          name: 'group',
          base: 'context',
          path: 'clients/northwind/groups/finance',
          hidden: ['works'],
        },
      ],
      defaultDocuments: ['billing-context/README.md', 'memory/active.md', 'memory/project.md'],
    });
  });

  it('omits the group and context repository mounts when the row declares none', () => {
    const scope = planWorkspaceScopes(projects).find((item) => item.id === 'project:portal');
    expect(scope?.mounts.map((mount) => mount.name)).toEqual(['memory', 'runs', 'client']);
    expect(scope?.defaultDocuments).toEqual(['memory/active.md', 'memory/project.md']);
  });

  it('renames a context repository mount that would collide with a fixed mount', () => {
    const [scope] = planWorkspaceScopes(
      parseWorkspaceRegistry('key\tclient\tcontext_repo\nsite\tacme\tprojects/acme/memory\n'),
      { project: 'site' },
    );
    expect(scope?.mounts[0]).toEqual({
      name: 'memory-repo',
      base: 'workspace',
      path: 'projects/acme/memory',
      hidden: ['works'],
    });
  });

  it('gives a client scope its own folder and every project slice of that client', () => {
    const scope = planWorkspaceScopes(projects).find((item) => item.id === 'client:northwind');
    expect(scope?.mounts.map((mount) => `${mount.name} <- ${mount.base}:${mount.path}`)).toEqual([
      'client <- context:clients/northwind',
      'projects/billing-api/billing-context <- workspace:projects/northwind/billing-context',
      'projects/billing-api/memory <- context:memory/projects/billing-api',
      'projects/billing-api/runs <- context:runs/billing-api',
      'projects/portal/memory <- context:memory/projects/portal',
      'projects/portal/runs <- context:runs/portal',
    ]);
    expect(scope?.defaultDocuments).toEqual(['client/client.md']);
  });

  it('locks the plan to one project when asked', () => {
    expect(planWorkspaceScopes(projects, { project: 'portal' }).map((scope) => scope.id)).toEqual([
      'project:portal',
    ]);
  });

  it('returns no scopes for a project that is not registered', () => {
    expect(planWorkspaceScopes(projects, { project: 'missing' })).toEqual([]);
  });
});
