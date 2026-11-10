import { describe, expect, it } from 'vitest';
import type { SourceInfo } from 'context-atlas-core';
import { chooseInitialScope, planChangedPaths } from './use-folder-explorer.js';

describe('planChangedPaths', () => {
  it('refreshes all cached and expanded directories and the selected file for a full refresh', () => {
    const plan = planChangedPaths(
      [],
      new Set(['', 'docs']),
      new Set(['docs', 'docs/archive']),
      'docs/guide.md',
    );

    expect(plan).toEqual({
      directories: ['', 'docs', 'docs/archive'],
      refreshSelectedFile: true,
    });
  });

  it('refreshes a changed file parent and a selected document under a changed directory', () => {
    const plan = planChangedPaths(
      ['docs/guide.md', 'notes'],
      new Set(['', 'docs']),
      new Set(['docs']),
      'docs/guide.md',
    );

    expect(plan).toEqual({
      directories: ['', 'docs'],
      refreshSelectedFile: true,
    });
  });

  it('refreshes a changed directory when it is already visible', () => {
    const plan = planChangedPaths(
      ['docs/archive'],
      new Set(['', 'docs']),
      new Set(['docs', 'docs/archive']),
      'docs/archive/guide.md',
    );

    expect(plan).toEqual({
      directories: ['docs', 'docs/archive'],
      refreshSelectedFile: true,
    });
  });
});

describe('chooseInitialScope', () => {
  const workspace: SourceInfo = {
    title: 'Workspace',
    profile: 'workspace',
    scopes: [
      { id: 'all', label: 'All', kind: 'all' },
      { id: 'project:site', label: 'site', kind: 'project' },
    ],
  };

  it('keeps the scope named by the address when the source offers it', () => {
    expect(chooseInitialScope(workspace, 'project:site')).toBe('project:site');
  });

  it('falls back to the first scope for a missing or unknown address scope', () => {
    expect(chooseInitialScope(workspace, undefined)).toBe('all');
    expect(chooseInitialScope(workspace, 'project:other')).toBe('all');
  });

  it('accepts one folder scope or one or more workspace scopes and nothing else', () => {
    expect(
      chooseInitialScope(
        { title: 'F', profile: 'folder', scopes: [{ id: 'folder', label: 'F' }] },
        undefined,
      ),
    ).toBe('folder');
    expect(chooseInitialScope({ ...workspace, scopes: [] }, undefined)).toBeUndefined();
    expect(chooseInitialScope({ ...workspace, profile: 'host' }, undefined)).toBeUndefined();
    expect(chooseInitialScope({ ...workspace, profile: 'folder' }, undefined)).toBeUndefined();
  });
});
