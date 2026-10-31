import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Background, BackgroundVariant, Controls, Handle, MarkerType, Position, ReactFlow, } from '@xyflow/react';
import { KindIcon } from './icons.js';
import { layoutNodes } from './explorer-state.js';
function ContextCard({ data, selected }) {
    const node = data.context;
    return (_jsxs(_Fragment, { children: [_jsx(Handle, { type: "target", position: Position.Left }), _jsxs("button", { className: `atlas-graph-card ${selected ? 'is-selected' : ''}`, type: "button", onClick: () => data.onSelect(node.id), "aria-label": `Inspect ${node.label}`, "aria-pressed": selected, children: [_jsxs("span", { className: "atlas-graph-card-kind", children: [_jsx("span", { className: `atlas-kind-icon kind-${node.kind}`, children: _jsx(KindIcon, { kind: node.kind }) }), _jsx("span", { children: node.kind }), _jsx("span", { className: `atlas-evidence-dot evidence-${node.evidence}`, title: `${node.evidence} evidence` })] }), _jsx("strong", { title: node.label, children: node.label }), node.details?.endpoint ? (_jsxs("code", { className: "atlas-graph-path", children: [node.details.endpoint.method, " ", node.details.endpoint.path] })) : !node.details?.fields?.length ? (_jsx("span", { className: "atlas-graph-description", children: node.description })) : null, !!node.details?.fields?.length && (_jsxs("span", { className: "atlas-graph-fields", children: [node.details.fields.slice(0, 2).map((field) => (_jsxs("span", { children: [_jsx("code", { children: field.name }), _jsx("span", { children: field.type })] }, field.name))), node.details.fields.length > 2 && (_jsxs("span", { className: "atlas-muted", children: ["+ ", node.details.fields.length - 2, " more fields"] }))] })), _jsx("span", { className: `atlas-status status-${node.status}`, children: node.status })] }), _jsx(Handle, { type: "source", position: Position.Right })] }));
}
const nodeTypes = { context: ContextCard };
export function GraphView({ snapshot, nodes, selectedId, onSelect, }) {
    const graphNodes = useMemo(() => layoutNodes(nodes).map(({ node, position }) => ({
        id: node.id,
        type: 'context',
        position,
        selected: node.id === selectedId,
        data: { context: node, onSelect },
        ariaLabel: node.label,
    })), [nodes, selectedId, onSelect]);
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
    return (_jsxs("div", { className: "atlas-graph", "aria-label": "Project relationship diagram", children: [_jsxs(ReactFlow, { nodes: graphNodes, edges: edges, nodeTypes: nodeTypes, fitView: true, fitViewOptions: { padding: 0.2, maxZoom: 1 }, nodesDraggable: false, nodesConnectable: false, nodesFocusable: false, edgesFocusable: false, edgesReconnectable: false, minZoom: 0.25, maxZoom: 1.8, panOnScroll: true, preventScrolling: false, children: [_jsx(Background, { variant: BackgroundVariant.Dots, gap: 20, size: 1 }), _jsx(Controls, { showInteractive: false, position: "bottom-left" })] }, nodes.map((n) => n.id).join('|')), _jsxs("div", { className: "atlas-graph-legend", children: [_jsxs("span", { children: [_jsx("i", {}), "Declared connection"] }), _jsxs("span", { children: [_jsx("i", { className: "is-inferred" }), "Inferred connection"] })] })] }));
}
