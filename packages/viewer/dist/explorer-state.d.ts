import type { ContextNode, ContextSnapshot } from '@context-atlas/model';
export interface ExplorerSelection {
    viewId: string;
    nodeId: string | null;
    moduleId: string;
}
export declare function getOverviewId(snapshot: ContextSnapshot): string;
export declare function reconcileSelection(snapshot: ContextSnapshot, previous: {
    viewId: string | null;
    nodeId: string | null;
    moduleId: string | null;
}): ExplorerSelection;
export declare function filterNodes(snapshot: ContextSnapshot, viewId: string, moduleId: string, query: string): ContextNode[];
export declare function layoutNodes(nodes: readonly ContextNode[]): {
    node: ContextNode;
    position: {
        x: number;
        y: number;
    };
}[];
export declare function readSelection(snapshot: ContextSnapshot, search: string): ExplorerSelection;
export declare function selectionUrl(projectId: string, viewId: string, nodeId: string | null, moduleId: string): string;
