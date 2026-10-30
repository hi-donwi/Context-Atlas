import { lazy, Suspense, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  FileUp,
  GitBranch,
  LayoutGrid,
  Link2,
  List,
  Menu,
  Search,
  X,
} from 'lucide-react';
import type { ContextSnapshot, ExplorerHost } from '@context-atlas/model';
import { ExportDialog } from './ExportDialog.js';
import { Inspector } from './Inspector.js';
import { InspectorEmpty } from './InspectorEmpty.js';
import { NodeList } from './NodeList.js';
import { Overview } from './Overview.js';
import { Sidebar, type ProjectOption } from './Sidebar.js';
import { useExplorer } from './use-explorer.js';

const GraphView = lazy(() =>
  import('./GraphView.js').then((module) => ({ default: module.GraphView })),
);

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
  const input = useRef<HTMLInputElement>(null);
  const [exportId, setExportId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reachedInspectorNode, setReachedInspectorNode] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const modules = snapshot.nodes.filter((n) => n.kind === 'module');
  const graphView = ['journey', 'architecture', 'data'].includes(state.kind);
  const showOverview =
    state.kind === 'overview' && !state.query && state.selection.moduleId === 'all';
  const selectedForExport =
    state.selectedNode?.id ??
    state.nodes.find((n) => n.kind !== 'module')?.id ??
    state.nodes[0]?.id;
  const viewTitle =
    state.kind === 'overview' ? 'Project overview' : (state.view?.label ?? 'Project context');
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkState('copied');
    } catch {
      setLinkState('failed');
    }
  }
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
        <header className="atlas-topbar">
          <div className="atlas-breadcrumb">
            <button
              type="button"
              className="atlas-icon-button atlas-mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={19} aria-hidden="true" />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} aria-hidden="true" />
            <strong>{snapshot.project.name}</strong>
          </div>
          <div className="atlas-topbar-actions">
            <span className="atlas-browser-badge">
              <span className="atlas-local-dot" />
              Browser local
            </span>
            {onImport && (
              <>
                <input
                  ref={input}
                  className="atlas-sr-only"
                  type="file"
                  accept=".json,application/json"
                  aria-label="Import context JSON"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    if (file) void onImport(file);
                  }}
                />
                <button
                  className="atlas-button atlas-button-secondary"
                  type="button"
                  onClick={() => input.current?.click()}
                  disabled={importing}
                >
                  <FileUp size={16} aria-hidden="true" />
                  <span>{importing ? 'Importing…' : 'Import JSON'}</span>
                </button>
              </>
            )}
            <button
              className="atlas-button atlas-button-primary"
              type="button"
              disabled={!selectedForExport}
              onClick={() => {
                if (selectedForExport) setExportId(selectedForExport);
              }}
            >
              <ArrowDownToLine size={16} aria-hidden="true" />
              <span>Export context</span>
            </button>
          </div>
        </header>
        {notice && (
          <div
            className={`atlas-notice notice-${notice.tone}`}
            role={notice.tone === 'error' ? 'alert' : 'status'}
          >
            <span>{notice.message}</span>
            {onDismissNotice && (
              <button
                className="atlas-icon-button"
                type="button"
                aria-label="Dismiss message"
                onClick={onDismissNotice}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="atlas-project-header">
          <div>
            <div className="atlas-project-heading-meta">
              <span className="atlas-eyebrow">PROJECT ATLAS</span>
              <span className="atlas-badge">{snapshot.project.kind}</span>
              <span className="atlas-project-version">{snapshot.project.version}</span>
            </div>
            <h1>{snapshot.project.name}</h1>
            <p>{snapshot.project.description}</p>
          </div>
          <button
            className="atlas-share-button atlas-icon-button"
            type="button"
            aria-label="Copy link to this selection"
            title="Copy selection link"
            onClick={() => void copyLink()}
          >
            {linkState === 'copied' ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <Link2 size={18} aria-hidden="true" />
            )}
          </button>
          {linkState !== 'idle' && (
            <span className="atlas-link-status" role="status">
              {linkState === 'copied'
                ? 'Selection link copied.'
                : 'Copy this page URL from your browser to share the selection.'}
            </span>
          )}
        </div>
        <div className="atlas-body">
          <main className="atlas-main" id="atlas-main">
            <div className="atlas-view-heading">
              <div>
                <div className="atlas-view-kicker">
                  <GitBranch size={14} aria-hidden="true" />
                  <span>
                    {state.kind === 'overview'
                      ? 'One project. Every perspective.'
                      : state.view?.description}
                  </span>
                </div>
                <h2>{viewTitle}</h2>
              </div>
              <span className="atlas-object-count">{state.nodes.length} objects</span>
            </div>
            <div className="atlas-toolbar">
              <label className="atlas-search">
                <Search size={16} aria-hidden="true" />
                <span className="atlas-sr-only">Search context</span>
                <input
                  type="search"
                  aria-label="Search context"
                  placeholder="Search this perspective…"
                  value={state.query}
                  onChange={(event) => state.setQuery(event.target.value)}
                />
                {state.query && (
                  <button
                    className="atlas-icon-button"
                    type="button"
                    aria-label="Clear search"
                    onClick={() => state.setQuery('')}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </label>
              <label className="atlas-module-filter">
                <span className="atlas-sr-only">Filter module</span>
                <select
                  aria-label="Filter module"
                  value={state.selection.moduleId}
                  onChange={(event) => state.onModule(event.target.value)}
                >
                  <option value="all">All modules</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.label}
                    </option>
                  ))}
                </select>
              </label>
              {graphView && (
                <div className="atlas-view-switch" role="group" aria-label="Display mode">
                  <button
                    type="button"
                    aria-label="Graph view"
                    aria-pressed={state.display === 'graph'}
                    onClick={() => state.setDisplay('graph')}
                  >
                    <LayoutGrid size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="List view"
                    aria-pressed={state.display === 'list'}
                    onClick={() => state.setDisplay('list')}
                  >
                    <List size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            {showOverview ? (
              <Overview snapshot={snapshot} onView={state.onView} onSelect={state.onSelect} />
            ) : state.nodes.length === 0 ? (
              <div className="atlas-empty-state">
                <Search size={28} aria-hidden="true" />
                <h3>No objects in this selection.</h3>
                <p>Try another term or module. The explorer only shows recorded context.</p>
                <button
                  className="atlas-button atlas-button-secondary"
                  type="button"
                  onClick={() => {
                    state.setQuery('');
                    state.onModule('all');
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <>
                {state.kind === 'journey' && !!state.view?.steps?.length && (
                  <ol className="atlas-journey-steps" aria-label="Journey steps">
                    {state.view.steps.map((step, index) => (
                      <li key={`${step.nodeId}-${index}`}>
                        <button
                          type="button"
                          className={state.selectedNode?.id === step.nodeId ? 'is-active' : ''}
                          onClick={() => state.onSelect(step.nodeId)}
                        >
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <strong>{step.label}</strong>
                        </button>
                        {index < state.view!.steps!.length - 1 && (
                          <ArrowRight size={14} aria-hidden="true" />
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {graphView && state.display === 'graph' ? (
                  <Suspense
                    fallback={
                      <div className="atlas-graph atlas-graph-loading" role="status">
                        Loading the relationship diagram…
                      </div>
                    }
                  >
                    <GraphView
                      snapshot={snapshot}
                      nodes={state.nodes}
                      selectedId={state.selectedNode?.id ?? null}
                      onSelect={state.onSelect}
                    />
                  </Suspense>
                ) : (
                  <NodeList
                    nodes={state.nodes}
                    selectedId={state.selectedNode?.id ?? null}
                    onSelect={state.onSelect}
                  />
                )}
                <div className="atlas-view-footer">
                  <span>{state.nodes.length} objects in this perspective</span>
                  {graphView && (
                    <button
                      className="atlas-text-button"
                      type="button"
                      onClick={() => state.setDisplay(state.display === 'graph' ? 'list' : 'graph')}
                    >
                      {state.display === 'graph' ? 'View as accessible list' : 'Return to graph'}
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </>
            )}
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
