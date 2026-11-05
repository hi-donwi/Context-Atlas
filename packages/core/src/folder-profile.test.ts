import { describe, expect, it } from 'vitest';
import { createFolderSourceInfo } from './folder-profile.js';

describe('createFolderSourceInfo', () => {
  it('describes one folder scope with no workspace scope switching', () => {
    expect(createFolderSourceInfo({ title: 'Project Notes' })).toEqual({
      title: 'Project Notes',
      profile: 'folder',
      scopes: [{ id: 'folder', label: 'Project Notes' }],
    });
  });

  it('uses a generic title when the folder title is blank', () => {
    expect(createFolderSourceInfo({ title: '  ' })).toEqual({
      title: 'Folder',
      profile: 'folder',
      scopes: [{ id: 'folder', label: 'Folder' }],
    });
  });

  it('trims the title and includes an optional repository revision', () => {
    expect(createFolderSourceInfo({ title: '  Guides  ', revision: ' rev-7 ' })).toEqual({
      title: 'Guides',
      profile: 'folder',
      scopes: [{ id: 'folder', label: 'Guides' }],
      repositoryRevisions: { folder: 'rev-7' },
    });
  });

  it('records an optional default document on the folder scope', () => {
    expect(createFolderSourceInfo({ title: 'Guides', defaultDocument: 'guide/README.md' })).toEqual(
      {
        title: 'Guides',
        profile: 'folder',
        scopes: [{ id: 'folder', label: 'Guides', defaultDocument: 'guide/README.md' }],
      },
    );
  });
});
