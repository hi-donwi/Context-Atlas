import { ArrowUpRight } from 'lucide-react';
import type { ContextNode } from '@context-atlas/model';
import { KindIcon } from './icons.js';

export function NodeList({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: ContextNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="atlas-node-list" aria-label="Context objects">
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          className={`atlas-object-row ${selectedId === node.id ? 'is-selected' : ''}`}
          onClick={() => onSelect(node.id)}
          aria-pressed={selectedId === node.id}
        >
          <span className={`atlas-kind-icon kind-${node.kind}`}>
            <KindIcon kind={node.kind} size={18} />
          </span>
          <span className="atlas-object-copy">
            <span className="atlas-object-title">{node.label}</span>
            <span className="atlas-object-description">{node.description}</span>
          </span>
          <span className="atlas-object-meta">
            <span className="atlas-kind-label">{node.kind}</span>
            <span className={`atlas-status status-${node.status}`}>{node.status}</span>
          </span>
          <ArrowUpRight size={15} className="atlas-row-arrow" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
