import type { ContextNode, ContextSnapshot } from '@context-atlas/model';

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
  const view = params.get('view');
  const node = params.get('node');
  const module = params.get('module');
  return {
    viewId: snapshot.views.some((v) => v.id === view) ? view! : 'overview',
    nodeId: snapshot.nodes.some((n) => n.id === node) ? node : null,
    moduleId: snapshot.nodes.some((n) => n.id === module && n.kind === 'module') ? module! : 'all',
  };
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
