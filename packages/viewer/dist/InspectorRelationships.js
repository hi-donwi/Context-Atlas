import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronRight, Link2 } from 'lucide-react';
export function InspectorRelationships({ nodeId, relationships, nodes, onSelect, }) {
    return (_jsxs(_Fragment, { children: [_jsx("p", { className: "atlas-inspector-explanation", children: "Follow a relationship to inspect the next part of the story." }), relationships.map((edge) => {
                const outgoing = edge.source === nodeId;
                const related = nodes.find((n) => n.id === (outgoing ? edge.target : edge.source));
                return (related && (_jsxs("button", { className: "atlas-related", type: "button", onClick: () => onSelect(related.id), children: [_jsx(Link2, { size: 15, "aria-hidden": "true" }), _jsxs("span", { children: [_jsx("small", { children: outgoing ? edge.relation : `incoming ${edge.relation}` }), _jsx("strong", { children: related.label }), _jsxs("small", { children: [edge.evidence, " evidence"] })] }), _jsx(ChevronRight, { size: 15, "aria-hidden": "true" })] }, edge.id)));
            }), !relationships.length && (_jsx("p", { className: "atlas-empty-inline", children: "No relationships are recorded for this object." }))] }));
}
