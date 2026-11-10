import { ChevronDown } from 'lucide-react';
import type { ScopeInfo } from '@context-atlas/core';
import { useFolderMessages } from './locale.js';

export interface ScopeSwitcherProps {
  readonly scopes: readonly ScopeInfo[];
  readonly scopeId: string | null;
  readonly onSelectScope: (scopeId: string) => void;
}

/**
 * Scope control for the workspace profile: a grouped select for All, clients, and projects,
 * or a plain label when the source offers one scope (a project lock).
 */
export function ScopeSwitcher({ scopes, scopeId, onSelectScope }: ScopeSwitcherProps) {
  const text = useFolderMessages();
  if (scopeId === null || scopes.length === 0) return null;
  const label = (scope: ScopeInfo): string => (scope.kind === 'all' ? text.scopeAll : scope.label);

  if (scopes.length === 1) {
    const scope = scopes[0]!;
    return (
      <p className="atlas-folder-scope atlas-folder-scope--locked" title={scope.description}>
        <span className="atlas-folder-scope__label">{text.scope}</span>
        <strong>{label(scope)}</strong>
      </p>
    );
  }

  const option = (scope: ScopeInfo) => (
    <option key={scope.id} value={scope.id} title={scope.description}>
      {label(scope)}
    </option>
  );
  const ungrouped = scopes.filter((scope) => scope.kind !== 'client' && scope.kind !== 'project');
  const clients = scopes.filter((scope) => scope.kind === 'client');
  const projects = scopes.filter((scope) => scope.kind === 'project');

  return (
    <label className="atlas-folder-scope">
      <span className="atlas-folder-scope__label">{text.scope}</span>
      <span className="atlas-folder-scope__control">
        <select value={scopeId} onChange={(event) => onSelectScope(event.currentTarget.value)}>
          {ungrouped.map(option)}
          {clients.length > 0 ? (
            <optgroup label={text.scopeClients}>{clients.map(option)}</optgroup>
          ) : null}
          {projects.length > 0 ? (
            <optgroup label={text.scopeProjects}>{projects.map(option)}</optgroup>
          ) : null}
        </select>
        <ChevronDown className="atlas-folder-scope__chevron" size={16} aria-hidden="true" />
      </span>
    </label>
  );
}
