import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronDown, ChevronRight, GitFork, Layers, Orbit } from 'lucide-react';
import { ViewIcon } from './icons.js';
import { getOverviewId } from './explorer-state.js';
export function Sidebar({ snapshot, projects, viewId, onView, onProjectChange, onClose, }) {
    const views = snapshot.views.some((view) => view.kind === 'overview')
        ? snapshot.views
        : [
            {
                id: getOverviewId(snapshot),
                kind: 'overview',
                label: 'Overview',
                description: 'Project context summary',
                nodeIds: snapshot.nodes.map((node) => node.id),
            },
            ...snapshot.views,
        ];
    return (_jsxs("aside", { className: "atlas-sidebar", "aria-label": "Project navigation", children: [_jsxs("a", { className: "atlas-brand", href: "https://github.com/hi-donwi/Context-Atlas", target: "_blank", rel: "noreferrer", children: [_jsx("span", { className: "atlas-brand-mark", children: _jsx(Orbit, { size: 24, strokeWidth: 1.6, "aria-hidden": "true" }) }), _jsxs("span", { children: ["context", _jsx("span", { children: "atlas" })] }), _jsx("span", { className: "atlas-brand-version", children: "0.1" })] }), _jsxs("div", { className: "atlas-workspace-label", children: [_jsx("span", { className: "atlas-eyebrow", children: "YOUR WORKSPACE" }), _jsx("span", { className: "atlas-local-dot", title: "Runs in your browser" })] }), _jsxs("label", { className: "atlas-project-select", children: [_jsx("span", { className: "atlas-project-avatar", children: _jsx(Layers, { size: 18, "aria-hidden": "true" }) }), _jsx("span", { className: "atlas-sr-only", children: "Select project" }), _jsxs("select", { "aria-label": "Select project", value: snapshot.project.id, onChange: (event) => {
                            onProjectChange?.(event.target.value);
                            onClose();
                        }, disabled: !onProjectChange, children: [!projects.some((project) => project.id === snapshot.project.id) && (_jsx("option", { value: snapshot.project.id, hidden: true, children: snapshot.project.name })), projects.map((project) => (_jsx("option", { value: project.id, children: project.name }, project.id)))] }), _jsx(ChevronDown, { size: 14, "aria-hidden": "true" })] }), _jsxs("div", { className: "atlas-project-type", children: [_jsxs("span", { className: "atlas-project-kind", title: `${snapshot.project.kind.replace('-', ' ')} project`, children: [snapshot.project.kind.replace('-', ' '), " project"] }), _jsx("span", { className: "atlas-dot-separator", "aria-hidden": "true" }), _jsx("span", { className: "atlas-project-version", title: snapshot.project.version, children: snapshot.project.version })] }), _jsxs("nav", { "aria-label": "Project views", children: [_jsx("span", { className: "atlas-eyebrow atlas-nav-heading", children: "EXPLORE" }), views.map((view) => (_jsxs("button", { type: "button", className: `atlas-nav-item ${viewId === view.id ? 'is-active' : ''}`, "aria-current": viewId === view.id ? 'page' : undefined, onClick: () => {
                            onView(view.id);
                            onClose();
                        }, children: [_jsx(ViewIcon, { kind: view.kind }), _jsx("span", { children: view.label }), view.kind !== 'overview' && (_jsx("span", { className: "atlas-nav-count", children: view.nodeIds.length })), viewId === view.id && _jsx(ChevronRight, { size: 14, "aria-hidden": "true" })] }, view.id)))] }), _jsxs("div", { className: "atlas-sidebar-bottom", children: [_jsxs("div", { className: "atlas-sidebar-note", children: [_jsx("span", { className: "atlas-eyebrow", children: "A LITTLE CONTEXT GOES A LONG WAY." }), _jsxs("p", { children: ["Find the connections.", _jsx("br", {}), "Make the next move."] })] }), _jsxs("a", { className: "atlas-source-link", href: "https://github.com/hi-donwi/Context-Atlas", target: "_blank", rel: "noreferrer", children: [_jsx(GitFork, { size: 16, "aria-hidden": "true" }), "Open source on GitHub", _jsx(ChevronRight, { size: 14, "aria-hidden": "true" })] })] })] }));
}
