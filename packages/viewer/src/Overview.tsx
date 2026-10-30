import { ArrowRight, ArrowUpRight, CheckCheck, GitBranch, Layers, Waypoints } from 'lucide-react';
import type { ContextNode, ContextSnapshot } from '@context-atlas/model';
import { KindIcon } from './icons.js';

interface OverviewProps {
  snapshot: ContextSnapshot;
  onView: (id: string) => void;
  onSelect: (id: string) => void;
}

export function Overview({ snapshot, onView, onSelect }: OverviewProps) {
  const modules = snapshot.nodes.filter((n) => n.kind === 'module');
  const journey = snapshot.views.find((v) => v.kind === 'journey');
  const tasks = snapshot.nodes.filter((n) => n.kind === 'task');
  const verified = snapshot.nodes.filter(
    (n) => n.status === 'verified' || n.status === 'accepted',
  ).length;
  const metrics = [
    { label: 'Modules', value: modules.length, icon: Layers },
    { label: 'Connected objects', value: snapshot.nodes.length, icon: GitBranch },
    { label: 'Relationships', value: snapshot.edges.length, icon: Waypoints },
    { label: 'Verified objects', value: verified, icon: CheckCheck },
  ];
  return (
    <div className="atlas-overview">
      <div className="atlas-overview-intro">
        <span className="atlas-eyebrow">THE PROJECT, CONNECTED</span>
        <h2>
          Understand the parts.
          <br />
          <span>Follow the whole story.</span>
        </h2>
        <p>{snapshot.project.description}</p>
      </div>
      <div className="atlas-metrics">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div className="atlas-metric" key={label}>
            <div>
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </div>
            <strong>{String(value).padStart(2, '0')}</strong>
          </div>
        ))}
      </div>
      {journey && (
        <button className="atlas-journey-feature" onClick={() => onView(journey.id)} type="button">
          <span className="atlas-feature-icon">
            <Waypoints size={26} aria-hidden="true" />
          </span>
          <span className="atlas-feature-copy">
            <span className="atlas-eyebrow">START WITH A JOURNEY</span>
            <strong>{journey.label}</strong>
            <span>{journey.description}</span>
          </span>
          <span className="atlas-feature-action">
            Follow the flow <ArrowRight size={17} aria-hidden="true" />
          </span>
        </button>
      )}
      <div className="atlas-section-heading">
        <div>
          <span className="atlas-eyebrow">EXPLORE BY RESPONSIBILITY</span>
          <h3>Inside the project</h3>
        </div>
        <span className="atlas-muted">{modules.length} modules</span>
      </div>
      <div className="atlas-module-grid">
        {modules.map((module) => (
          <ModuleCard key={module.id} module={module} snapshot={snapshot} onSelect={onSelect} />
        ))}
      </div>
      <div className="atlas-section-heading">
        <div>
          <span className="atlas-eyebrow">CONTEXT THAT MOVES WORK FORWARD</span>
          <h3>Open threads</h3>
        </div>
        <button
          className="atlas-text-button"
          onClick={() => {
            const work = snapshot.views.find((v) => v.kind === 'work');
            if (work) onView(work.id);
          }}
          disabled={!snapshot.views.some((v) => v.kind === 'work')}
        >
          View work <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="atlas-thread-list">
        {tasks.length ? (
          tasks.slice(0, 3).map((task) => (
            <button
              type="button"
              key={task.id}
              onClick={() => onSelect(task.id)}
              className="atlas-thread"
            >
              <span className={`atlas-thread-marker task-${task.details?.task?.state ?? 'todo'}`} />
              <span>
                <strong>{task.label}</strong>
                <span>{task.description}</span>
              </span>
              <span className="atlas-badge">{task.details?.task?.state ?? task.status}</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          ))
        ) : (
          <p className="atlas-empty-inline">
            No work records in this snapshot. Add a task adapter to connect ongoing work.
          </p>
        )}
      </div>
      <div className="atlas-provenance-note">
        <CheckCheck size={17} aria-hidden="true" />
        <p>
          <strong>Every connection has a source.</strong> Inspect an object to see its evidence,
          revision, and what is still uncertain.
        </p>
      </div>
    </div>
  );
}

function ModuleCard({
  module,
  snapshot,
  onSelect,
}: {
  module: ContextNode;
  snapshot: ContextSnapshot;
  onSelect: (id: string) => void;
}) {
  const children = snapshot.nodes.filter((n) => n.moduleId === module.id);
  const operations = children.filter((n) => n.kind === 'operation').length;
  const tables = children.filter((n) => n.kind === 'table' || n.kind === 'entity').length;
  return (
    <button className="atlas-module-card" type="button" onClick={() => onSelect(module.id)}>
      <span className="atlas-module-card-top">
        <span className="atlas-kind-icon kind-module">
          <KindIcon kind="module" size={21} />
        </span>
        <ArrowUpRight size={18} aria-hidden="true" />
      </span>
      <strong>{module.label}</strong>
      <p>{module.description}</p>
      <span className="atlas-module-card-footer">
        <span>{children.length} objects</span>
        <span>{operations} operations</span>
        <span>{tables} data models</span>
      </span>
    </button>
  );
}
