import type { ContextNode, ContextSnapshot } from '@context-atlas/model';
export declare function GraphView({ snapshot, nodes, selectedId, onSelect, }: {
    snapshot: ContextSnapshot;
    nodes: ContextNode[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}): import("react").JSX.Element;
