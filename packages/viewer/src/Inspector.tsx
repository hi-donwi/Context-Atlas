import { useState } from 'react';
import { PanelRightClose } from 'lucide-react';
import type { ContextNode, ContextSnapshot, ExplorerHost } from '@context-atlas/model';
import { KindIcon } from './icons.js';
import { InspectorDetails } from './InspectorDetails.js';
import { InspectorSources } from './InspectorSources.js';
import { InspectorRelationships } from './InspectorRelationships.js';

export function Inspector({
  node,
  snapshot,
  host,
  onSelect,
  onClose,
}: {
  node: ContextNode;
  snapshot: ContextSnapshot;
  host: ExplorerHost;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'details' | 'sources' | 'related'>('details');
  const sources = snapshot.sources.filter((source) => node.sourceIds.includes(source.id));
  const relationships = snapshot.edges.filter(
    (edge) => edge.source === node.id || edge.target === node.id,
  );
  return (
    <aside className="atlas-inspector" id="atlas-inspector" aria-label="Object inspector">
      <div className="atlas-inspector-top">
        <span className="atlas-eyebrow">OBJECT INSPECTOR</span>
        <button
          className="atlas-icon-button"
          type="button"
          aria-label="Close inspector"
          onClick={onClose}
        >
          <PanelRightClose size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="atlas-inspector-heading">
        <span className={`atlas-kind-icon kind-${node.kind}`}>
          <KindIcon kind={node.kind} size={22} />
        </span>
        <span className="atlas-kind-label">{node.kind}</span>
        <h2>{node.label}</h2>
        <p>{node.description}</p>
        <div className="atlas-inline-badges">
          <span className={`atlas-status status-${node.status}`}>{node.status}</span>
          <span className="atlas-badge">{node.evidence} evidence</span>
        </div>
      </div>
      <div className="atlas-inspector-tabs" role="group" aria-label="Inspector sections">
        {(['details', 'sources', 'related'] as const).map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={tab === item}
            className={tab === item ? 'is-active' : ''}
            onClick={() => setTab(item)}
          >
            {item}
            <span>
              {item === 'sources' ? sources.length : item === 'related' ? relationships.length : ''}
            </span>
          </button>
        ))}
      </div>
      <div className="atlas-inspector-body">
        {tab === 'details' && (
          <InspectorDetails
            node={node}
            sourceCount={sources.length}
            relationshipCount={relationships.length}
            host={host}
          />
        )}
        {tab === 'sources' && <InspectorSources sources={sources} host={host} />}
        {tab === 'related' && (
          <InspectorRelationships
            nodeId={node.id}
            relationships={relationships}
            nodes={snapshot.nodes}
            onSelect={onSelect}
          />
        )}
      </div>
    </aside>
  );
}
