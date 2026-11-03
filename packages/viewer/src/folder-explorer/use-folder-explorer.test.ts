import { describe, expect, it } from 'vitest';
import { planChangedPaths } from './use-folder-explorer.js';

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
