import { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type { ContextNode, ContextSnapshot } from '@context-atlas/model';
import { KindIcon } from './icons.js';
import { layoutNodes } from './explorer-state.js';

type AtlasNode = Node<{ context: ContextNode; onSelect: (id: string) => void }, 'context'>;

function ContextCard({ data, selected }: NodeProps<AtlasNode>) {
  const node = data.context;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <button
        className={`atlas-graph-card ${selected ? 'is-selected' : ''}`}
        type="button"
        onClick={() => data.onSelect(node.id)}
        aria-label={`Inspect ${node.label}`}
        aria-pressed={selected}
      >
        <span className="atlas-graph-card-kind">
          <span className={`atlas-kind-icon kind-${node.kind}`}>
            <KindIcon kind={node.kind} />
          </span>
          <span>{node.kind}</span>
          <span
            className={`atlas-evidence-dot evidence-${node.evidence}`}
            title={`${node.evidence} evidence`}
          />
        </span>
        <strong title={node.label}>{node.label}</strong>
        {node.details?.endpoint ? (
          <code className="atlas-graph-path">
            {node.details.endpoint.method} {node.details.endpoint.path}
          </code>
        ) : !node.details?.fields?.length ? (
          <span className="atlas-graph-description">{node.description}</span>
        ) : null}
        {!!node.details?.fields?.length && (
          <span className="atlas-graph-fields">
            {node.details.fields.slice(0, 2).map((field) => (
              <span key={field.name}>
                <code>{field.name}</code>
                <span>{field.type}</span>
              </span>
            ))}
            {node.details.fields.length > 2 && (
              <span className="atlas-muted">+ {node.details.fields.length - 2} more fields</span>
            )}
          </span>
        )}
        <span className={`atlas-status status-${node.status}`}>{node.status}</span>
      </button>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

const nodeTypes = { context: ContextCard };

export function GraphView({
  snapshot,
  nodes,
  selectedId,
  onSelect,
}: {
  snapshot: ContextSnapshot;
  nodes: ContextNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const graphNodes = useMemo(
    () =>
      layoutNodes(nodes).map(({ node, position }): AtlasNode => ({
        id: node.id,
        type: 'context',
        position,
        selected: node.id === selectedId,
        data: { context: node, onSelect },
        ariaLabel: node.label,
      })),
    [nodes, selectedId, onSelect],
  );
  const edges = useMemo(() => {
    const ids = new Set(nodes.map((node) => node.id));
    return snapshot.edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label ?? edge.relation,
        type: 'smoothstep',
        animated: false,
        style: { strokeDasharray: edge.evidence === 'inferred' ? '5 5' : undefined },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--atlas-edge)' },
      }));
  }, [snapshot.edges, nodes]);
  return (
    <div className="atlas-graph" aria-label="Project relationship diagram">
      <ReactFlow<AtlasNode>
        key={nodes.map((n) => n.id).join('|')}
        nodes={graphNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        edgesReconnectable={false}
        minZoom={0.25}
        maxZoom={1.8}
        panOnScroll
        preventScrolling={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      <div className="atlas-graph-legend">
        <span>
          <i />
          Declared connection
        </span>
        <span>
          <i className="is-inferred" />
          Inferred connection
        </span>
      </div>
    </div>
  );
}
