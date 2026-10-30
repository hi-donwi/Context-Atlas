import { jsx as _jsx } from "react/jsx-runtime";
import { BookOpen, Boxes, Braces, CheckCheck, CircleUserRound, Database, FileCode2, FileText, GitBranch, LayoutDashboard, LayoutTemplate, ListTodo, Network, Server, Waypoints, } from 'lucide-react';
const nodeIcons = {
    module: Boxes,
    actor: CircleUserRound,
    journey: Waypoints,
    page: LayoutTemplate,
    operation: Braces,
    service: Server,
    entity: Database,
    table: Database,
    task: ListTodo,
    document: FileText,
    decision: GitBranch,
    test: CheckCheck,
    topic: BookOpen,
};
const viewIcons = {
    overview: LayoutDashboard,
    journey: Waypoints,
    architecture: Network,
    api: Braces,
    data: Database,
    work: ListTodo,
    study: BookOpen,
};
export function KindIcon({ kind, size = 16 }) {
    const Icon = nodeIcons[kind] ?? FileCode2;
    return _jsx(Icon, { size: size, strokeWidth: 1.7, "aria-hidden": "true" });
}
export function ViewIcon({ kind, size = 18 }) {
    const Icon = viewIcons[kind];
    return _jsx(Icon, { size: size, strokeWidth: 1.7, "aria-hidden": "true" });
}
