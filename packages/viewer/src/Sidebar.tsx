import { ChevronDown, ChevronRight, GitFork, Layers, Orbit } from 'lucide-react';
import type { ContextSnapshot, ContextView } from '@context-atlas/model';
import { ViewIcon } from './icons.js';
import { getOverviewId } from './explorer-state.js';

export interface ProjectOption {
  id: string;
  name: string;
  kind: string;
}

export function Sidebar({
  snapshot,
  projects,
  viewId,
  onView,
  onProjectChange,
  onClose,
}: {
  snapshot: ContextSnapshot;
  projects: ProjectOption[];
  viewId: string;
  onView: (id: string) => void;
  onProjectChange?: ((id: string) => void) | undefined;
  onClose: () => void;
}) {
  const views: ContextView[] = snapshot.views.some((view) => view.kind === 'overview')
    ? snapshot.views
    : [
        {
          id: getOverviewId(snapshot),
          kind: 'overview',
          label: 'Overview',
          description: 'Project context summary',
          nodeIds: snapshot.nodes.map((node) => node.id),
        },
        ...snapshot.views,
      ];
  return (
    <aside className="atlas-sidebar" aria-label="Project navigation">
      <a
        className="atlas-brand"
        href="https://github.com/hi-donwi/Context-Atlas"
        target="_blank"
        rel="noreferrer"
      >
        <span className="atlas-brand-mark">
          <Orbit size={24} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <span>
          context<span>atlas</span>
        </span>
        <span className="atlas-brand-version">0.1</span>
      </a>
      <div className="atlas-workspace-label">
        <span className="atlas-eyebrow">YOUR WORKSPACE</span>
        <span className="atlas-local-dot" title="Runs in your browser" />
      </div>
      <label className="atlas-project-select">
        <span className="atlas-project-avatar">
          <Layers size={18} aria-hidden="true" />
        </span>
        <span className="atlas-sr-only">Select project</span>
        <select
          aria-label="Select project"
          value={snapshot.project.id}
          onChange={(event) => {
            onProjectChange?.(event.target.value);
            onClose();
          }}
          disabled={!onProjectChange}
        >
          {!projects.some((project) => project.id === snapshot.project.id) && (
            <option value={snapshot.project.id} hidden>
              {snapshot.project.name}
            </option>
          )}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>
      <div className="atlas-project-type">
        {snapshot.project.kind.replace('-', ' ')} project <span className="atlas-dot-separator" />{' '}
        {snapshot.project.version}
      </div>
      <nav aria-label="Project views">
        <span className="atlas-eyebrow atlas-nav-heading">EXPLORE</span>
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            className={`atlas-nav-item ${viewId === view.id ? 'is-active' : ''}`}
            aria-current={viewId === view.id ? 'page' : undefined}
            onClick={() => {
              onView(view.id);
              onClose();
            }}
          >
            <ViewIcon kind={view.kind} />
            <span>{view.label}</span>
            {view.kind !== 'overview' && (
              <span className="atlas-nav-count">{view.nodeIds.length}</span>
            )}
            {viewId === view.id && <ChevronRight size={14} aria-hidden="true" />}
          </button>
        ))}
      </nav>
      <div className="atlas-sidebar-bottom">
        <div className="atlas-sidebar-note">
          <span className="atlas-eyebrow">A LITTLE CONTEXT GOES A LONG WAY.</span>
          <p>
            Find the connections.
            <br />
            Make the next move.
          </p>
        </div>
        <a
          className="atlas-source-link"
          href="https://github.com/hi-donwi/Context-Atlas"
          target="_blank"
          rel="noreferrer"
        >
          <GitFork size={16} aria-hidden="true" />
          Open source on GitHub
          <ChevronRight size={14} aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
}
