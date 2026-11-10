import { isExcludedPath } from './exclusions.js';
import { normalizeRelativePath, UnsafePathError } from './path-safety.js';
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PROJECT_MOUNTS = ['memory', 'runs', 'client', 'group'];
const HIDDEN_IN_PROJECTS = ['works'];
function optionalValue(value) {
    const trimmed = value?.trim();
    return trimmed === undefined || trimmed === '' || trimmed === '-' ? undefined : trimmed;
}
function safeSegment(value) {
    return value !== undefined && SEGMENT.test(value) && value !== '..' ? value : undefined;
}
function safeContextRepo(value) {
    if (value === undefined)
        return undefined;
    try {
        const normalized = normalizeRelativePath(value);
        return normalized === value && !isExcludedPath(normalized) ? normalized : undefined;
    }
    catch (error) {
        if (error instanceof UnsafePathError)
            return undefined;
        throw error;
    }
}
/**
 * Parse a tab-separated workspace registry by its header row. Rows without a safe `key` and
 * `client` are skipped, `-` means absent, and an unsafe `context_repo` is dropped.
 */
export function parseWorkspaceRegistry(text) {
    const lines = text.split(/\r\n|\r|\n/);
    const header = lines[0]?.split('\t').map((name) => name.trim()) ?? [];
    const column = (name) => header.indexOf(name);
    const keyColumn = column('key');
    const clientColumn = column('client');
    if (keyColumn === -1 || clientColumn === -1)
        return [];
    const groupColumn = column('group');
    const descriptionColumn = column('description');
    const contextRepoColumn = column('context_repo');
    const projects = [];
    const seen = new Set();
    for (const line of lines.slice(1)) {
        if (line.trim() === '' || line.trimStart().startsWith('#'))
            continue;
        const cells = line.split('\t');
        const cell = (index) => index === -1 ? undefined : optionalValue(cells[index]);
        const key = safeSegment(cell(keyColumn));
        const client = safeSegment(cell(clientColumn));
        const rawGroup = cell(groupColumn);
        const group = safeSegment(rawGroup);
        if (key === undefined || client === undefined || (rawGroup !== undefined && !group))
            continue;
        if (seen.has(key))
            continue;
        seen.add(key);
        const description = cell(descriptionColumn);
        const contextRepo = safeContextRepo(cell(contextRepoColumn));
        projects.push({
            key,
            client,
            ...(group === undefined ? {} : { group }),
            ...(description === undefined ? {} : { description }),
            ...(contextRepo === undefined ? {} : { contextRepo }),
        });
    }
    return projects;
}
function contextRepoMountName(contextRepo) {
    const name = contextRepo.split('/').at(-1);
    return PROJECT_MOUNTS.includes(name) ? `${name}-repo` : name;
}
function projectMounts(project, prefix = '') {
    const mounts = [];
    if (project.contextRepo !== undefined) {
        mounts.push({
            name: `${prefix}${contextRepoMountName(project.contextRepo)}`,
            base: 'workspace',
            path: project.contextRepo,
            hidden: HIDDEN_IN_PROJECTS,
        });
    }
    mounts.push({
        name: `${prefix}memory`,
        base: 'context',
        path: `memory/projects/${project.key}`,
        hidden: HIDDEN_IN_PROJECTS,
    }, {
        name: `${prefix}runs`,
        base: 'context',
        path: `runs/${project.key}`,
        hidden: HIDDEN_IN_PROJECTS,
    });
    return mounts;
}
function projectScope(project) {
    const mounts = projectMounts(project);
    mounts.push({
        name: 'client',
        base: 'context',
        path: `clients/${project.client}`,
        hidden: ['groups', ...HIDDEN_IN_PROJECTS],
    });
    if (project.group !== undefined) {
        mounts.push({
            name: 'group',
            base: 'context',
            path: `clients/${project.client}/groups/${project.group}`,
            hidden: HIDDEN_IN_PROJECTS,
        });
    }
    const contextRepo = mounts.find((mount) => mount.base === 'workspace');
    return {
        id: `project:${project.key}`,
        kind: 'project',
        label: project.key,
        ...(project.description === undefined ? {} : { description: project.description }),
        mounts,
        defaultDocuments: [
            ...(contextRepo === undefined ? [] : [`${contextRepo.name}/README.md`]),
            'memory/active.md',
            'memory/project.md',
        ],
    };
}
function clientScope(client, projects) {
    return {
        id: `client:${client}`,
        kind: 'client',
        label: client,
        mounts: [
            { name: 'client', base: 'context', path: `clients/${client}`, hidden: HIDDEN_IN_PROJECTS },
            ...projects.flatMap((project) => projectMounts(project, `projects/${project.key}/`)),
        ],
        defaultDocuments: ['client/client.md'],
    };
}
/**
 * Plan the spec 0.2 workspace scopes: All (the context folder), one per client, and one per
 * project. A project slice holds its memory, its runs, its client folder without other groups,
 * its own group, and its declared context repository; `works/` is hidden in every slice.
 */
export function planWorkspaceScopes(projects, options = {}) {
    const byKey = [...projects].sort((left, right) => left.key.localeCompare(right.key, 'en'));
    if (options.project !== undefined) {
        const project = byKey.find((item) => item.key === options.project);
        return project === undefined ? [] : [projectScope(project)];
    }
    const clients = [...new Set(byKey.map((project) => project.client))].sort((left, right) => left.localeCompare(right, 'en'));
    return [
        {
            id: 'all',
            kind: 'all',
            label: 'All',
            mounts: [{ name: '', base: 'context', path: '' }],
            defaultDocuments: ['README.md', 'index.md'],
        },
        ...clients.map((client) => clientScope(client, byKey.filter((project) => project.client === client))),
        ...byKey.map(projectScope),
    ];
}
