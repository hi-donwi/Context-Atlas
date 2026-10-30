import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ContextSnapshot } from '@context-atlas/model';
import { filterNodes, readSelection, reconcileSelection, selectionUrl } from './explorer-state.js';

export function useExplorer(snapshot: ContextSnapshot) {
  const [storedSelection, setSelection] = useState(() =>
    readSelection(snapshot, typeof window === 'undefined' ? '' : window.location.search),
  );
  const selection = useMemo(
    () => reconcileSelection(snapshot, storedSelection),
    [snapshot, storedSelection],
  );
  const [query, setQuery] = useState('');
  const [display, setDisplay] = useState<'graph' | 'list'>('graph');
  const view = snapshot.views.find((v) => v.id === selection.viewId);
  const kind = view?.kind ?? 'overview';
  const nodes = useMemo(
    () => filterNodes(snapshot, selection.viewId, selection.moduleId, query),
    [snapshot, selection.viewId, selection.moduleId, query],
  );
  const selectedNode = snapshot.nodes.find((n) => n.id === selection.nodeId) ?? null;
  const onSelect = useCallback(
    (id: string) => setSelection((previous) => ({ ...previous, nodeId: id })),
    [],
  );
  const onView = useCallback((id: string) => {
    setSelection((previous) => ({ ...previous, viewId: id, nodeId: null }));
    setQuery('');
  }, []);
  const onModule = useCallback(
    (id: string) => setSelection((previous) => ({ ...previous, moduleId: id, nodeId: null })),
    [],
  );
  const clearSelection = useCallback(
    () => setSelection((previous) => ({ ...previous, nodeId: null })),
    [],
  );
  useEffect(() => {
    setSelection((previous) => {
      const next = reconcileSelection(snapshot, previous);
      return previous.viewId === next.viewId &&
        previous.nodeId === next.nodeId &&
        previous.moduleId === next.moduleId
        ? previous
        : next;
    });
    setQuery('');
  }, [snapshot]);
  useEffect(() => {
    const url = selectionUrl(
      snapshot.project.id,
      selection.viewId,
      selectedNode?.id ?? null,
      selection.moduleId,
    );
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${url}${window.location.hash}`,
    );
  }, [snapshot.project.id, selection, selectedNode?.id]);
  useEffect(() => {
    const restore = () => {
      setSelection(readSelection(snapshot, window.location.search));
      setQuery('');
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [snapshot]);
  return {
    selection,
    query,
    setQuery,
    display,
    setDisplay,
    view,
    kind,
    nodes,
    selectedNode,
    onSelect,
    onView,
    onModule,
    clearSelection,
  };
}
