import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ExplorerTopbar } from './ExplorerTopbar.js';
import { ExportDialog } from './ExportDialog.js';
import { Inspector } from './Inspector.js';
import { InspectorEmpty } from './InspectorEmpty.js';
import { PerspectiveContent } from './PerspectiveContent.js';
import { PerspectiveToolbar } from './PerspectiveToolbar.js';
import { ProjectHeading } from './ProjectHeading.js';
import { Sidebar } from './Sidebar.js';
import { useExplorer } from './use-explorer.js';
export function ContextExplorer(props) {
    return _jsx(ExplorerWorkbench, { ...props }, props.snapshot.project.id);
}
function ExplorerWorkbench({ snapshot, host = {}, projects = [snapshot.project], onProjectChange, onImport, importing = false, notice, onDismissNotice, allowedSourceIds, }) {
    const state = useExplorer(snapshot);
    const [exportId, setExportId] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [reachedInspectorNode, setReachedInspectorNode] = useState(null);
    const graphView = ['journey', 'architecture', 'data'].includes(state.kind);
    const showOverview = state.kind === 'overview' && !state.query && state.selection.moduleId === 'all';
    const selectedForExport = state.selectedNode?.id ??
        state.nodes.find((n) => n.kind !== 'module')?.id ??
        state.nodes[0]?.id;
    return (_jsxs("div", { className: `atlas-app ${sidebarOpen ? 'atlas-sidebar-open' : ''}`, children: [_jsx("a", { className: "atlas-skip-link", href: "#atlas-main", children: "Skip to project content" }), sidebarOpen && (_jsx("button", { className: "atlas-sidebar-backdrop", type: "button", onClick: () => setSidebarOpen(false), "aria-label": "Close navigation" })), _jsx(Sidebar, { snapshot: snapshot, projects: projects, viewId: state.selection.viewId, onView: state.onView, onProjectChange: onProjectChange, onClose: () => setSidebarOpen(false) }), _jsxs("div", { className: "atlas-workspace", children: [_jsx(ExplorerTopbar, { projectName: snapshot.project.name, onOpenNavigation: () => setSidebarOpen(true), onImport: onImport, importing: importing, canExport: !!selectedForExport, onExport: () => {
                            if (selectedForExport)
                                setExportId(selectedForExport);
                        }, notice: notice, onDismissNotice: onDismissNotice }), _jsx(ProjectHeading, { project: snapshot.project }), _jsxs("div", { className: "atlas-body", children: [_jsxs("main", { className: "atlas-main", id: "atlas-main", children: [_jsx(PerspectiveToolbar, { snapshot: snapshot, state: state, graphView: graphView }), _jsx(PerspectiveContent, { snapshot: snapshot, state: state, graphView: graphView, showOverview: showOverview })] }), state.selectedNode ? (_jsx(Inspector, { node: state.selectedNode, snapshot: snapshot, host: host, onSelect: state.onSelect, onClose: state.clearSelection }, state.selectedNode.id)) : (_jsx(InspectorEmpty, { snapshot: snapshot }))] }), _jsxs("footer", { className: "atlas-footer", children: [_jsxs("span", { children: [_jsx("span", { className: "atlas-local-dot" }), "A snapshot of what is known."] }), _jsx("span", { children: "Source-linked \u00B7 Capability-driven \u00B7 Read-only" })] })] }), state.selectedNode && state.selectedNode.id !== reachedInspectorNode && (_jsxs("a", { className: "atlas-inspector-jump", href: "#atlas-inspector", onClick: () => setReachedInspectorNode(state.selectedNode.id), children: ["Inspect ", state.selectedNode.label, _jsx(ArrowRight, { size: 14, "aria-hidden": "true" })] })), exportId && (_jsx(ExportDialog, { snapshot: snapshot, nodeId: exportId, allowedSourceIds: allowedSourceIds ?? snapshot.sources.map((source) => source.id), onClose: () => setExportId(null) }))] }));
}
