import { ChevronRight, Link2 } from 'lucide-react';
import type { ContextEdge, ContextNode } from '@context-atlas/model';

export function InspectorRelationships({
  nodeId,
  relationships,
  nodes,
  onSelect,
}: {
  nodeId: string;
  relationships: ContextEdge[];
  nodes: ContextNode[];
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <p className="atlas-inspector-explanation">
        Follow a relationship to inspect the next part of the story.
      </p>
      {relationships.map((edge) => {
        const outgoing = edge.source === nodeId;
        const related = nodes.find((n) => n.id === (outgoing ? edge.target : edge.source));
        return (
          related && (
            <button
              className="atlas-related"
              type="button"
              key={edge.id}
              onClick={() => onSelect(related.id)}
            >
              <Link2 size={15} aria-hidden="true" />
              <span>
                <small>{outgoing ? edge.relation : `incoming ${edge.relation}`}</small>
                <strong>{related.label}</strong>
                <small>{edge.evidence} evidence</small>
              </span>
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          )
        );
      })}
      {!relationships.length && (
        <p className="atlas-empty-inline">No relationships are recorded for this object.</p>
      )}
    </>
  );
}
