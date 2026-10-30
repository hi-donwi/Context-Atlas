import { ArrowUpLeft, FileCode2, GitBranch, MousePointer2 } from 'lucide-react';
import type { ContextSnapshot } from '@context-atlas/model';

export function InspectorEmpty({ snapshot }: { snapshot: ContextSnapshot }) {
  const stale = snapshot.sources.filter((s) => s.freshness !== 'current').length;
  const inferred = snapshot.edges.filter((e) => e.evidence === 'inferred').length;
  return (
    <aside className="atlas-inspector atlas-inspector-empty" aria-label="Inspector guidance">
      <span className="atlas-eyebrow">THE DETAILS ARE CONNECTED</span>
      <div className="atlas-inspector-illustration" aria-hidden="true">
        <span>
          <FileCode2 size={21} />
        </span>
        <i />
        <span>
          <GitBranch size={21} />
        </span>
        <i />
        <span>
          <MousePointer2 size={21} />
        </span>
      </div>
      <h2>
        A clearer picture,
        <br />
        one object at a time.
      </h2>
      <p>
        Select a module, step, or object to inspect its purpose, contracts, data, and source
        evidence.
      </p>
      <span className="atlas-inspect-hint">
        <ArrowUpLeft size={16} aria-hidden="true" />
        Start anywhere. Follow a connection.
      </span>
      <div className="atlas-evidence-summary">
        <span className="atlas-eyebrow">SNAPSHOT HEALTH</span>
        <div>
          <span>Source references</span>
          <strong>{snapshot.sources.length}</strong>
        </div>
        <div>
          <span>Stale or unknown sources</span>
          <strong>{stale}</strong>
        </div>
        <div>
          <span>Inferred relationships</span>
          <strong>{inferred}</strong>
        </div>
        <p>
          Evidence describes what is known. Verification and business acceptance remain separate.
        </p>
      </div>
      <div className="atlas-local-note">
        <span className="atlas-local-dot" />
        <span>Browser local. No automatic uploads.</span>
      </div>
    </aside>
  );
}
