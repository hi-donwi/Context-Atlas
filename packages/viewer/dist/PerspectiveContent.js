import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { NodeList } from './NodeList.js';
import { Overview } from './Overview.js';
const GraphView = lazy(() => import('./GraphView.js').then((module) => ({ default: module.GraphView })));
export function PerspectiveContent({ snapshot, state, graphView, showOverview, }) {
    const visibleIds = new Set(state.nodes.map((node) => node.id));
    const overviewSnapshot = {
        ...snapshot,
        nodes: state.nodes,
        edges: snapshot.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    };
    return (_jsx(_Fragment, { children: showOverview ? (_jsx(Overview, { snapshot: overviewSnapshot, onView: state.onView, onSelect: state.onSelect })) : state.nodes.length === 0 ? (_jsxs("div", { className: "atlas-empty-state", children: [_jsx(Search, { size: 28, "aria-hidden": "true" }), _jsx("h3", { children: "No objects in this selection." }), _jsx("p", { children: "Try another term or module. The explorer only shows recorded context." }), _jsx("button", { className: "atlas-button atlas-button-secondary", type: "button", onClick: () => {
                        state.setQuery('');
                        state.onModule('all');
                    }, children: "Reset filters" })] })) : (_jsxs(_Fragment, { children: [state.kind === 'journey' && !!state.view?.steps?.length && (_jsx("ol", { className: "atlas-journey-steps", "aria-label": "Journey steps", children: state.view.steps.map((step, index) => (_jsxs("li", { children: [_jsxs("button", { type: "button", className: state.selectedNode?.id === step.nodeId ? 'is-active' : '', onClick: () => state.onSelect(step.nodeId), children: [_jsx("span", { children: String(index + 1).padStart(2, '0') }), _jsx("strong", { children: step.label })] }), index < state.view.steps.length - 1 && (_jsx(ArrowRight, { size: 14, "aria-hidden": "true" }))] }, `${step.nodeId}-${index}`))) })), graphView && state.display === 'graph' ? (_jsx(Suspense, { fallback: _jsx("div", { className: "atlas-graph atlas-graph-loading", role: "status", children: "Loading the relationship diagram\u2026" }), children: _jsx(GraphView, { snapshot: snapshot, nodes: state.nodes, selectedId: state.selectedNode?.id ?? null, onSelect: state.onSelect }) })) : (_jsx(NodeList, { nodes: state.nodes, selectedId: state.selectedNode?.id ?? null, onSelect: state.onSelect })), _jsxs("div", { className: "atlas-view-footer", children: [_jsxs("span", { children: [state.nodes.length, " objects in this perspective"] }), graphView && (_jsxs("button", { className: "atlas-text-button", type: "button", onClick: () => state.setDisplay(state.display === 'graph' ? 'list' : 'graph'), children: [state.display === 'graph' ? 'View as accessible list' : 'Return to graph', _jsx(ArrowRight, { size: 14, "aria-hidden": "true" })] }))] })] })) }));
}
