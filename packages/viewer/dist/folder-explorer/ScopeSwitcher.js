import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronDown } from 'lucide-react';
import { useFolderMessages } from './locale.js';
/**
 * Scope control for the workspace profile: a grouped select for All, clients, and projects,
 * or a plain label when the source offers one scope (a project lock).
 */
export function ScopeSwitcher({ scopes, scopeId, onSelectScope }) {
    const text = useFolderMessages();
    if (scopeId === null || scopes.length === 0)
        return null;
    const label = (scope) => (scope.kind === 'all' ? text.scopeAll : scope.label);
    if (scopes.length === 1) {
        const scope = scopes[0];
        return (_jsxs("p", { className: "atlas-folder-scope atlas-folder-scope--locked", title: scope.description, children: [_jsx("span", { className: "atlas-folder-scope__label", children: text.scope }), _jsx("strong", { children: label(scope) })] }));
    }
    const option = (scope) => (_jsx("option", { value: scope.id, title: scope.description, children: label(scope) }, scope.id));
    const ungrouped = scopes.filter((scope) => scope.kind !== 'client' && scope.kind !== 'project');
    const clients = scopes.filter((scope) => scope.kind === 'client');
    const projects = scopes.filter((scope) => scope.kind === 'project');
    return (_jsxs("label", { className: "atlas-folder-scope", children: [_jsx("span", { className: "atlas-folder-scope__label", children: text.scope }), _jsxs("span", { className: "atlas-folder-scope__control", children: [_jsxs("select", { value: scopeId, onChange: (event) => onSelectScope(event.currentTarget.value), children: [ungrouped.map(option), clients.length > 0 ? (_jsx("optgroup", { label: text.scopeClients, children: clients.map(option) })) : null, projects.length > 0 ? (_jsx("optgroup", { label: text.scopeProjects, children: projects.map(option) })) : null] }), _jsx(ChevronDown, { className: "atlas-folder-scope__chevron", size: 16, "aria-hidden": "true" })] })] }));
}
