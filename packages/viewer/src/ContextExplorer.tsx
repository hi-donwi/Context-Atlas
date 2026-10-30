import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ContextSnapshot, ExplorerHost } from '@context-atlas/model';
import { ExplorerTopbar } from './ExplorerTopbar.js';
import { ExportDialog } from './ExportDialog.js';
import { Inspector } from './Inspector.js';
import { InspectorEmpty } from './InspectorEmpty.js';
import { PerspectiveContent } from './PerspectiveContent.js';
import { PerspectiveToolbar } from './PerspectiveToolbar.js';
import { ProjectHeading } from './ProjectHeading.js';
import { Sidebar, type ProjectOption } from './Sidebar.js';
import { useExplorer } from './use-explorer.js';

export interface ContextExplorerProps {
  snapshot: ContextSnapshot;
  host?: ExplorerHost | undefined;
  projects?: ProjectOption[] | undefined;
  onProjectChange?: ((id: string) => void) | undefined;
  onImport?: ((file: File) => Promise<void>) | undefined;
  importing?: boolean | undefined;
  notice?: { tone: 'error' | 'success'; message: string } | null | undefined;
  onDismissNotice?: (() => void) | undefined;
  allowedSourceIds?: readonly string[] | undefined;
}

export function ContextExplorer(props: ContextExplorerProps) {
  return <ExplorerWorkbench key={props.snapshot.project.id} {...props} />;
}

function ExplorerWorkbench({
  snapshot,
  host = {},
  projects = [snapshot.project],
  onProjectChange,
  onImport,
  importing = false,
  notice,
  onDismissNotice,
  allowedSourceIds,
}: ContextExplorerProps) {
  const state = useExplorer(snapshot);
  const [exportId, setExportId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reachedInspectorNode, setReachedInspectorNode] = useState<string | null>(null);
  const graphView = ['journey', 'architecture', 'data'].includes(state.kind);
  const showOverview =
    state.kind === 'overview' && !state.query && state.selection.moduleId === 'all';
  const selectedForExport =
    state.selectedNode?.id ??
    state.nodes.find((n) => n.kind !== 'module')?.id ??
    state.nodes[0]?.id;
  return (
    <div className={`atlas-app ${sidebarOpen ? 'atlas-sidebar-open' : ''}`}>
      <a className="atlas-skip-link" href="#atlas-main">
        Skip to project content
      </a>
      {sidebarOpen && (
        <button
          className="atlas-sidebar-backdrop"
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <Sidebar
        snapshot={snapshot}
        projects={projects}
        viewId={state.selection.viewId}
        onView={state.onView}
        onProjectChange={onProjectChange}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="atlas-workspace">
        <ExplorerTopbar
          projectName={snapshot.project.name}
          onOpenNavigation={() => setSidebarOpen(true)}
          onImport={onImport}
          importing={importing}
          canExport={!!selectedForExport}
          onExport={() => {
            if (selectedForExport) setExportId(selectedForExport);
          }}
          notice={notice}
          onDismissNotice={onDismissNotice}
        />
        <ProjectHeading project={snapshot.project} />
        <div className="atlas-body">
          <main className="atlas-main" id="atlas-main">
            <PerspectiveToolbar snapshot={snapshot} state={state} graphView={graphView} />
            <PerspectiveContent
              snapshot={snapshot}
              state={state}
              graphView={graphView}
              showOverview={showOverview}
            />
          </main>
          {state.selectedNode ? (
            <Inspector
              key={state.selectedNode.id}
              node={state.selectedNode}
              snapshot={snapshot}
              host={host}
              onSelect={state.onSelect}
              onClose={state.clearSelection}
            />
          ) : (
            <InspectorEmpty snapshot={snapshot} />
          )}
        </div>
        <footer className="atlas-footer">
          <span>
            <span className="atlas-local-dot" />A snapshot of what is known.
          </span>
          <span>Source-linked · Capability-driven · Read-only</span>
        </footer>
      </div>
      {state.selectedNode && state.selectedNode.id !== reachedInspectorNode && (
        <a
          className="atlas-inspector-jump"
          href="#atlas-inspector"
          onClick={() => setReachedInspectorNode(state.selectedNode!.id)}
        >
          Inspect {state.selectedNode.label}
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      )}
      {exportId && (
        <ExportDialog
          snapshot={snapshot}
          nodeId={exportId}
          allowedSourceIds={allowedSourceIds ?? snapshot.sources.map((source) => source.id)}
          onClose={() => setExportId(null)}
        />
      )}
    </div>
  );
}
