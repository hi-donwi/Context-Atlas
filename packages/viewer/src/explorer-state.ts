import type { ContextNode, ContextSnapshot } from '@context-atlas/model';

export interface ExplorerSelection {
  viewId: string;
  nodeId: string | null;
  moduleId: string;
}

export function getOverviewId(snapshot: ContextSnapshot): string {
  const declared = snapshot.views.find((view) => view.kind === 'overview');
  if (declared) return declared.id;
  const viewIds = new Set(snapshot.views.map((view) => view.id));
  let id = 'overview';
  while (viewIds.has(id)) id = `_${id}`;
  return id;
}

export function reconcileSelection(
  snapshot: ContextSnapshot,
  previous: { viewId: string | null; nodeId: string | null; moduleId: string | null },
): ExplorerSelection {
  const overviewId = getOverviewId(snapshot);
  return {
    viewId:
      previous.viewId === overviewId || snapshot.views.some((view) => view.id === previous.viewId)
        ? previous.viewId!
        : overviewId,
    nodeId: snapshot.nodes.some((node) => node.id === previous.nodeId) ? previous.nodeId : null,
    moduleId: snapshot.nodes.some((node) => node.id === previous.moduleId && node.kind === 'module')
      ? previous.moduleId!
      : 'all',
  };
}

export function filterNodes(
  snapshot: ContextSnapshot,
  viewId: string,
  moduleId: string,
  query: string,
): ContextNode[] {
  const view = snapshot.views.find((item) => item.id === viewId);
  const ids = view ? new Set(view.nodeIds) : null;
  const term = query.trim().toLowerCase();
  return snapshot.nodes.filter((node) => {
    if (ids && !ids.has(node.id)) return false;
    if (moduleId !== 'all' && node.moduleId !== moduleId && node.id !== moduleId) return false;
    return (
      !term ||
      [node.label, node.description, node.id, ...node.tags, node.details?.endpoint?.path ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  });
}

export function layoutNodes(nodes: readonly ContextNode[]) {
  const columns = nodes.length <= 4 ? 2 : 3;
  return nodes.map((node, index) => ({
    node,
    position: { x: (index % columns) * 270, y: Math.floor(index / columns) * 185 },
  }));
}

export function readSelection(snapshot: ContextSnapshot, search: string) {
  const params = new URLSearchParams(search);
  return reconcileSelection(snapshot, {
    viewId: params.get('view'),
    nodeId: params.get('node'),
    moduleId: params.get('module'),
  });
}

export function selectionUrl(
  projectId: string,
  viewId: string,
  nodeId: string | null,
  moduleId: string,
): string {
  const params = new URLSearchParams({ project: projectId, view: viewId });
  if (nodeId) params.set('node', nodeId);
  if (moduleId !== 'all') params.set('module', moduleId);
  return `?${params.toString()}`;
}
