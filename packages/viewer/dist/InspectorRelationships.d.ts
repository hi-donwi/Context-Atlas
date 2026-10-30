import type { ContextEdge, ContextNode } from '@context-atlas/model';
export declare function InspectorRelationships({ nodeId, relationships, nodes, onSelect, }: {
    nodeId: string;
    relationships: ContextEdge[];
    nodes: ContextNode[];
    onSelect: (id: string) => void;
}): import("react").JSX.Element;
