import type { ContextNode } from '@context-atlas/model';
export declare function NodeList({ nodes, selectedId, onSelect, }: {
    nodes: ContextNode[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}): import("react").JSX.Element;
