import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import type { ContextSnapshot } from '@context-atlas/model';

export function ProjectHeading({ project }: { project: ContextSnapshot['project'] }) {
  const [linkState, setLinkState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkState('copied');
    } catch {
      setLinkState('failed');
    }
  }
  return (
    <div className="atlas-project-header">
      <div>
        <div className="atlas-project-heading-meta">
          <span className="atlas-eyebrow">PROJECT ATLAS</span>
          <span className="atlas-badge">{project.kind}</span>
          <span className="atlas-project-version">{project.version}</span>
        </div>
        <h1>{project.name}</h1>
        <p>{project.description}</p>
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
  );
}
