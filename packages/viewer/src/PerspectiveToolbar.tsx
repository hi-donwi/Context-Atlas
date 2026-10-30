import { GitBranch, LayoutGrid, List, Search, X } from 'lucide-react';
import type { ContextSnapshot } from '@context-atlas/model';
import type { useExplorer } from './use-explorer.js';

export function PerspectiveToolbar({
  snapshot,
  state,
  graphView,
}: {
  snapshot: ContextSnapshot;
  state: ReturnType<typeof useExplorer>;
  graphView: boolean;
}) {
  const modules = snapshot.nodes.filter((node) => node.kind === 'module');
  const viewTitle =
    state.kind === 'overview' ? 'Project overview' : (state.view?.label ?? 'Project context');
  return (
    <>
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
    </>
  );
}
