import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openContextSource } from './workspace-source.js';

const REGISTRY = [
  'key\tclient\tgroup\tfolder\tremote\tcontext_scope\tsecurity_profile\tdescription\tcontext_repo\tkind',
  'billing-api\tnorthwind\tfinance\t-\t-\tclient\t-\tBilling backend\tprojects/northwind/billing-context\tcode',
  'portal\tnorthwind\t-\t-\t-\tclient\t-\t-\t-\tcode',
].join('\n');

async function put(root: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
}

describe('openContextSource', () => {
  let workspace: string;
  let context: string;
  let outside: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'context-atlas-workspace-'));
    outside = await mkdtemp(join(tmpdir(), 'context-atlas-outside-'));
    context = join(workspace, 'context');
    await put(context, 'registry.tsv', REGISTRY);
    await put(context, 'atlas.json', JSON.stringify({ title: 'Workspace context' }));
    await put(context, 'README.md', '# Workspace context');
    await put(
      context,
      'memory/projects/billing-api/active.md',
      '# Billing active\n\nInvoices ship.',
    );
    await put(context, 'memory/projects/portal/active.md', '# Portal active\n\nPages ship.');
    await put(context, 'runs/billing-api/2026-11-10-first/handoff.md', '# Handoff');
    await put(context, 'clients/northwind/client.md', '# Northwind');
    await put(context, 'clients/northwind/groups/finance/decisions.md', '# Finance decisions');
    await put(context, 'clients/northwind/groups/retail/secret.md', '# Retail only\n\nInvoices.');
    await put(context, 'works/scratch.md', '# Scratch');
    await put(workspace, 'projects/northwind/billing-context/README.md', '# Billing context');
    await put(workspace, 'projects/northwind/billing-context/works/draft.md', '# Draft');
  });

  afterEach(async () => {
    await Promise.all([
      rm(workspace, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]);
  });

  it('opens an ordinary folder with the folder profile', async () => {
    const source = await openContextSource(join(workspace, 'projects'));
    await expect(source.describe()).resolves.toMatchObject({ profile: 'folder' });
  });

  it('detects a workspace context and describes All, client, and project scopes', async () => {
    const source = await openContextSource(context);
    await expect(source.describe()).resolves.toEqual({
      title: 'Workspace context',
      profile: 'workspace',
      scopes: [
        { id: 'all', kind: 'all', label: 'All', defaultDocument: 'README.md' },
        {
          id: 'client:northwind',
          kind: 'client',
          label: 'northwind',
          defaultDocument: 'client/client.md',
        },
        {
          id: 'project:billing-api',
          kind: 'project',
          label: 'billing-api',
          description: 'Billing backend',
          defaultDocument: 'billing-context/README.md',
        },
        {
          id: 'project:portal',
          kind: 'project',
          label: 'portal',
          defaultDocument: 'memory/active.md',
        },
      ],
    });
  });

  it('lists a project slice as its mounted folders, skipping folders that do not exist', async () => {
    const source = await openContextSource(context);
    const names = async (scope: string, dir: string): Promise<string[]> =>
      (await source.list(scope, dir)).map((entry) => entry.path);

    await expect(names('project:billing-api', '')).resolves.toEqual([
      'billing-context',
      'client',
      'group',
      'memory',
      'runs',
    ]);
    await expect(names('project:portal', '')).resolves.toEqual(['client', 'memory']);
    await expect(names('project:billing-api', 'runs')).resolves.toEqual(['runs/2026-11-10-first']);
  });

  it('reads through a mount and returns scope-relative paths', async () => {
    const source = await openContextSource(context);
    await expect(source.read('project:billing-api', 'memory/active.md')).resolves.toMatchObject({
      path: 'memory/active.md',
      type: 'markdown',
      content: '# Billing active\n\nInvoices ship.',
    });
  });

  it('keeps other groups and works/ out of a project slice but not out of All', async () => {
    const source = await openContextSource(context);

    await expect(source.list('project:billing-api', 'client')).resolves.toMatchObject([
      { path: 'client/client.md' },
    ]);
    await expect(
      source.read('project:billing-api', 'client/groups/retail/secret.md'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(source.list('project:billing-api', 'group')).resolves.toMatchObject([
      { path: 'group/decisions.md' },
    ]);
    await expect(source.list('project:billing-api', 'billing-context')).resolves.toMatchObject([
      { path: 'billing-context/README.md' },
    ]);
    await expect(source.list('all', '')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'works' })]),
    );
  });

  it('nests every project slice of a client under projects/ in the client scope', async () => {
    const source = await openContextSource(context);
    const names = async (dir: string): Promise<string[]> =>
      (await source.list('client:northwind', dir)).map((entry) => entry.path);

    await expect(names('')).resolves.toEqual(['client', 'projects']);
    await expect(names('projects')).resolves.toEqual(['projects/billing-api', 'projects/portal']);
    await expect(names('projects/billing-api')).resolves.toEqual([
      'projects/billing-api/billing-context',
      'projects/billing-api/memory',
      'projects/billing-api/runs',
    ]);
    await expect(names('client/groups')).resolves.toEqual([
      'client/groups/finance',
      'client/groups/retail',
    ]);
  });

  it('rejects unknown scopes, virtual folders as files, and unknown virtual folders', async () => {
    const source = await openContextSource(context);
    await expect(source.list('project:missing', '')).rejects.toMatchObject({
      code: 'INVALID_SCOPE',
    });
    await expect(source.read('client:northwind', 'projects')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(source.list('client:northwind', 'elsewhere')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(source.read('project:billing-api', '../registry.tsv')).rejects.toMatchObject({
      code: 'INVALID_PATH',
    });
  });

  it('searches only the folders of the selected scope', async () => {
    const source = await openContextSource(context);
    const paths = (await source.search!('project:billing-api', 'invoices')).map((hit) => hit.path);

    expect(paths).toEqual(['memory/active.md']);
  });

  it('locks the source to one project when asked', async () => {
    const source = await openContextSource(context, { project: 'portal' });

    await expect(source.describe()).resolves.toMatchObject({
      profile: 'workspace',
      scopes: [{ id: 'project:portal' }],
    });
    await expect(source.list('all', '')).rejects.toMatchObject({ code: 'INVALID_SCOPE' });
    await expect(source.list('project:billing-api', '')).rejects.toMatchObject({
      code: 'INVALID_SCOPE',
    });
  });

  it('refuses a project lock that names no registered project or no workspace', async () => {
    await expect(openContextSource(context, { project: 'missing' })).rejects.toMatchObject({
      code: 'UNKNOWN_PROJECT',
    });
    await expect(
      openContextSource(join(workspace, 'projects'), { project: 'portal' }),
    ).rejects.toMatchObject({ code: 'NOT_A_WORKSPACE' });
  });

  it('skips a context repository that resolves outside the workspace', async () => {
    await put(outside, 'README.md', '# Outside');
    await rm(join(workspace, 'projects/northwind/billing-context'), { recursive: true });
    await symlink(outside, join(workspace, 'projects/northwind/billing-context'));
    const source = await openContextSource(context);

    await expect(source.list('project:billing-api', '')).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'billing-context' })]),
    );
  });

  it('asks for a full refresh when a mounted folder changes', async () => {
    const source = await openContextSource(context, { project: 'billing-api' });
    const change = new Promise<string[]>((resolveChange) => {
      const unsubscribe = source.watch!((paths) => {
        unsubscribe();
        resolveChange(paths);
      });
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
    await writeFile(join(workspace, 'projects/northwind/billing-context/README.md'), '# Changed');

    await expect(change).resolves.toEqual([]);
  });
});
