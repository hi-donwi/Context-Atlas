/** One project row of a workspace context registry (`registry.tsv`). */
export interface WorkspaceProject {
    /** Project key: one safe path segment, unique within the registry. */
    readonly key: string;
    /** Owning client: one safe path segment. */
    readonly client: string;
    /** Optional product group inside the client: one safe path segment. */
    readonly group?: string;
    /** Optional one-line description from the registry. */
    readonly description?: string;
    /** Optional project context repository, relative to the workspace root. */
    readonly contextRepo?: string;
}
/** The kind of a workspace scope, used to group scopes in a scope switcher. */
export type WorkspaceScopeKind = 'all' | 'client' | 'project';
/**
 * One folder mounted into a workspace scope. `name` is the scope-relative directory the folder
 * appears under; an empty name mounts the folder as the scope root. `path` is relative to the
 * opened context folder (`context`) or to its parent workspace folder (`workspace`).
 */
export interface WorkspaceMount {
    readonly name: string;
    readonly base: 'context' | 'workspace';
    readonly path: string;
    /** Top-level names inside the mounted folder that this scope must not list or serve. */
    readonly hidden?: readonly string[];
}
/** A workspace scope before the source checks which mounted folders exist. */
export interface WorkspaceScopePlan {
    readonly id: string;
    readonly kind: WorkspaceScopeKind;
    readonly label: string;
    readonly description?: string;
    readonly mounts: readonly WorkspaceMount[];
    /** Scope-relative landing documents, most preferred first; the source keeps the first file. */
    readonly defaultDocuments: readonly string[];
}
/** Options that narrow the planned scopes. */
export interface WorkspaceScopeOptions {
    /** Plan only this project's scope, so a reader cannot switch to other clients or projects. */
    readonly project?: string;
}
/**
 * Parse a tab-separated workspace registry by its header row. Rows without a safe `key` and
 * `client` are skipped, `-` means absent, and an unsafe `context_repo` is dropped.
 */
export declare function parseWorkspaceRegistry(text: string): WorkspaceProject[];
/**
 * Plan the spec 0.2 workspace scopes: All (the context folder), one per client, and one per
 * project. A project slice holds its memory, its runs, its client folder without other groups,
 * its own group, and its declared context repository; `works/` is hidden in every slice.
 */
export declare function planWorkspaceScopes(projects: readonly WorkspaceProject[], options?: WorkspaceScopeOptions): WorkspaceScopePlan[];
