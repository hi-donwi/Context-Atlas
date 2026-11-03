/** Create SourceInfo for one opened folder; this profile intentionally has no scope switcher. */
export function createFolderSourceInfo(options) {
    const title = options.title.trim() || 'Folder';
    const revision = options.revision?.trim();
    return {
        title,
        profile: 'folder',
        scopes: [{ id: 'folder', label: title }],
        ...(revision === undefined || revision === ''
            ? {}
            : { repositoryRevisions: { folder: revision } }),
    };
}
