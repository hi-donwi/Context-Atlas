import type { ScopeInfo } from 'context-atlas-core';
export interface ScopeSwitcherProps {
    readonly scopes: readonly ScopeInfo[];
    readonly scopeId: string | null;
    readonly onSelectScope: (scopeId: string) => void;
}
/**
 * Scope control for the workspace profile: a grouped select for All, clients, and projects,
 * or a plain label when the source offers one scope (a project lock).
 */
export declare function ScopeSwitcher({ scopes, scopeId, onSelectScope }: ScopeSwitcherProps): import("react").JSX.Element | null;
