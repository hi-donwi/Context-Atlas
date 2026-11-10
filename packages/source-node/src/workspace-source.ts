import { realpath, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import {
  isExcludedPath,
  isPathWithinRoot,
  MAX_SEARCH_RESULTS,
  normalizeDirectoryPath,
  normalizeRelativePath,
  normalizeSearchQuery,
  parseWorkspaceRegistry,
  planWorkspaceScopes,
  UnsafePathError,
} from '@context-atlas/core';
import type {
  ContentSource,
  Entry,
  FileContent,
  ScopeInfo,
  SearchHit,
  SourceInfo,
  WorkspaceMount,
  WorkspaceScopePlan,
} from '@context-atlas/core';
import { FileSystemContentSource, FileSystemSourceError } from './filesystem-source.js';

const WATCH_DEBOUNCE_MS = 100;

/** Options for opening a folder that may be a workspace context. */
export interface ContextSourceOptions {
  /**
   * Show only this registered project's scope. The source then refuses every other scope, so
   * an agent bound to one project cannot read another client's context through it.
   */
  readonly project?: string;
}

interface MountedFolder {
  readonly name: string;
  readonly root: string;
  readonly source: FileSystemContentSource;
}

interface MountedScope {
  readonly info: ScopeInfo;
  readonly mounts: readonly MountedFolder[];
}

interface Routed {
  readonly mount: MountedFolder;
  readonly inner: string;
}

function joinScopePath(name: string, path: string): string {
  if (name === '') return path;
  return path === '' ? name : `${name}/${path}`;
}

function route(mounts: readonly MountedFolder[], path: string): Routed | undefined {
  for (const mount of mounts) {
    if (mount.name === '') return { mount, inner: path };
    if (path === mount.name) return { mount, inner: '' };
    if (path.startsWith(`${mount.name}/`)) {
      return { mount, inner: path.slice(mount.name.length + 1) };
    }
  }
  return undefined;
}

function compareNames(left: string, right: string): number {
  return left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' });
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Whether a folder is a workspace context: it holds `registry.tsv` and `memory/projects/`. */
export async function isWorkspaceContext(rootPath: string): Promise<boolean> {
  return (
    (await isFile(join(rootPath, 'registry.tsv'))) &&
    (await isDirectory(join(rootPath, 'memory', 'projects')))
  );
}

/**
 * Resolve one planned mount to a real directory inside its base, or skip it. A symlink that
 * leaves the base, a missing folder, and a folder under the fixed denylist are all skipped.
 */
async function resolveMount(
  mount: WorkspaceMount,
  contextRoot: string,
  workspaceRoot: string,
): Promise<string | undefined> {
  const base = mount.base === 'context' ? contextRoot : workspaceRoot;
  let resolved: string;
  try {
    resolved = await realpath(join(base, ...mount.path.split('/')));
  } catch {
    return undefined;
  }
  if (!isPathWithinRoot(base, resolved) || !(await isDirectory(resolved))) return undefined;
  const relativePath = relative(base, resolved).split(sep).join('/');
  return relativePath !== '' && isExcludedPath(relativePath) ? undefined : resolved;
}

/**
 * A read-only workspace context: spec 0.2's `workspace` profile. Each scope is a set of
 * folders mounted under scope-relative names; every operation is delegated to the folder
 * source of exactly one mount, so its path safety, denylist, and size limits still apply.
 */
export class WorkspaceContentSource implements ContentSource {
  private constructor(
    private readonly info: SourceInfo,
    private readonly scopes: ReadonlyMap<string, MountedScope>,
  ) {}

  static async open(
    contextRoot: string,
    options: ContextSourceOptions = {},
  ): Promise<WorkspaceContentSource> {
    let resolvedRoot: string;
    try {
      resolvedRoot = await realpath(resolve(contextRoot));
    } catch {
      throw new FileSystemSourceError('INVALID_ROOT');
    }
    if (!(await isWorkspaceContext(resolvedRoot))) {
      throw new FileSystemSourceError('NOT_A_WORKSPACE');
    }

    const contextSource = await FileSystemContentSource.open(resolvedRoot);
    const contextInfo = await contextSource.describe();
    const registry = await contextSource.read('folder', 'registry.tsv');
    const text =
      typeof registry.content === 'string'
        ? registry.content
        : Buffer.from(registry.content).toString('utf8');
    const plans = planWorkspaceScopes(parseWorkspaceRegistry(text), options);
    if (options.project !== undefined && plans.length === 0) {
      throw new FileSystemSourceError('UNKNOWN_PROJECT');
    }

    const workspaceRoot = dirname(resolvedRoot);
    const scopes = new Map<string, MountedScope>();
    for (const plan of plans) {
      const mounts: MountedFolder[] = [];
      for (const mount of plan.mounts) {
        if (mount.base === 'context' && mount.path === '' && mount.hidden === undefined) {
          mounts.push({ name: mount.name, root: resolvedRoot, source: contextSource });
          continue;
        }
        const root = await resolveMount(mount, resolvedRoot, workspaceRoot);
        if (root === undefined) continue;
        const source = await FileSystemContentSource.open(root, {
          readMetadata: false,
          ...(mount.hidden === undefined ? {} : { hiddenPaths: mount.hidden }),
        });
        mounts.push({ name: mount.name, root, source });
      }
      if (mounts.length === 0) continue;

      const scopeDefault = plan.kind === 'all' ? contextInfo.scopes[0]?.defaultDocument : undefined;
      const defaultDocument =
        scopeDefault ?? (await WorkspaceContentSource.firstFile(mounts, plan));
      scopes.set(plan.id, {
        mounts,
        info: {
          id: plan.id,
          kind: plan.kind,
          label: plan.label,
          ...(plan.description === undefined ? {} : { description: plan.description }),
          ...(defaultDocument === undefined ? {} : { defaultDocument }),
        },
      });
    }

    return new WorkspaceContentSource(
      {
        title: contextInfo.title,
        profile: 'workspace',
        scopes: [...scopes.values()].map((scope) => scope.info),
      },
      scopes,
    );
  }

  private static async firstFile(
    mounts: readonly MountedFolder[],
    plan: WorkspaceScopePlan,
  ): Promise<string | undefined> {
    for (const candidate of plan.defaultDocuments) {
      const routed = route(mounts, candidate);
      if (routed === undefined || routed.inner === '') continue;
      try {
        const parent = routed.inner.includes('/')
          ? routed.inner.slice(0, routed.inner.lastIndexOf('/'))
          : '';
        const entries = await routed.mount.source.list('folder', parent);
        if (entries.some((entry) => entry.kind === 'file' && entry.path === routed.inner)) {
          return candidate;
        }
      } catch {
        continue;
      }
    }
    return undefined;
  }

  async describe(): Promise<SourceInfo> {
    return { ...this.info, scopes: this.info.scopes.map((scope) => ({ ...scope })) };
  }

  async list(scopeId: string, dir: string): Promise<Entry[]> {
    const scope = this.scope(scopeId);
    let normalizedDir: string;
    try {
      normalizedDir = normalizeDirectoryPath(dir);
    } catch (error) {
      if (error instanceof UnsafePathError) throw new FileSystemSourceError('INVALID_PATH');
      throw error;
    }

    const routed = route(scope.mounts, normalizedDir);
    if (routed !== undefined) {
      const entries = await routed.mount.source.list('folder', routed.inner);
      return entries.map((entry) => ({
        ...entry,
        path: joinScopePath(routed.mount.name, entry.path),
      }));
    }

    const prefix = normalizedDir === '' ? '' : `${normalizedDir}/`;
    const children = new Set<string>();
    for (const mount of scope.mounts) {
      if (!mount.name.startsWith(prefix)) continue;
      children.add(mount.name.slice(prefix.length).split('/')[0]!);
    }
    if (children.size === 0) throw new FileSystemSourceError('NOT_FOUND');
    return [...children].sort(compareNames).map((name) => ({
      path: `${prefix}${name}`,
      name,
      kind: 'dir',
      type: 'unknown',
    }));
  }

  async read(scopeId: string, path: string): Promise<FileContent> {
    const scope = this.scope(scopeId);
    let normalizedPath: string;
    try {
      normalizedPath = normalizeRelativePath(path);
    } catch (error) {
      if (error instanceof UnsafePathError) throw new FileSystemSourceError('INVALID_PATH');
      throw error;
    }

    const routed = route(scope.mounts, normalizedPath);
    if (routed === undefined || routed.inner === '') throw new FileSystemSourceError('NOT_FOUND');
    const file = await routed.mount.source.read('folder', routed.inner);
    return { ...file, path: joinScopePath(routed.mount.name, file.path) };
  }

  async search(scopeId: string, query: string): Promise<SearchHit[]> {
    const scope = this.scope(scopeId);
    const normalizedQuery = normalizeSearchQuery(query);
    if (normalizedQuery === undefined) throw new FileSystemSourceError('INVALID_QUERY');

    const results = await Promise.all(
      scope.mounts.map(async (mount) =>
        (await mount.source.search('folder', normalizedQuery)).map((hit) => ({
          ...hit,
          path: joinScopePath(mount.name, hit.path),
        })),
      ),
    );
    return results
      .flat()
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .slice(0, MAX_SEARCH_RESULTS);
  }

  /**
   * Report changes as full refreshes. Mounts overlap (All contains every project folder) and
   * a changed path is relative to one mount, so the viewer revalidates what it has loaded.
   */
  watch(onChange: (paths: string[]) => void): () => void {
    const roots = [...new Set([...this.scopes.values()].flatMap((scope) => scope.mounts))]
      .map((mount) => mount.root)
      .sort((left, right) => left.length - right.length);
    const watchedRoots: string[] = [];
    for (const root of roots) {
      if (!watchedRoots.some((kept) => isPathWithinRoot(kept, root))) watchedRoots.push(root);
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribers: Array<() => void> = [];
    const schedule = (): void => {
      if (stopped) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        if (!stopped) onChange([]);
      }, WATCH_DEBOUNCE_MS);
    };

    for (const root of watchedRoots) {
      void FileSystemContentSource.open(root, { readMetadata: false })
        .then((source) => {
          if (stopped) return;
          unsubscribers.push(source.watch(schedule));
        })
        .catch(schedule);
    }

    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }

  private scope(scopeId: string): MountedScope {
    const scope = this.scopes.get(scopeId);
    if (scope === undefined) throw new FileSystemSourceError('INVALID_SCOPE');
    return scope;
  }
}

/**
 * Open a folder for the explorer: a workspace context gets the `workspace` profile, any other
 * folder the `folder` profile. A project lock requires a workspace context.
 */
export async function openContextSource(
  rootPath: string,
  options: ContextSourceOptions = {},
): Promise<ContentSource> {
  let resolvedRoot: string;
  try {
    resolvedRoot = await realpath(resolve(rootPath));
  } catch {
    throw new FileSystemSourceError('INVALID_ROOT');
  }
  if (await isWorkspaceContext(resolvedRoot)) {
    return WorkspaceContentSource.open(resolvedRoot, options);
  }
  if (options.project !== undefined) throw new FileSystemSourceError('NOT_A_WORKSPACE');
  return FileSystemContentSource.open(resolvedRoot);
}
