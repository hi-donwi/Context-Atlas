import type { ContextNode, ContextSnapshot, ExplorerHost } from '@context-atlas/model';
export declare function Inspector({ node, snapshot, host, onSelect, onClose, }: {
    node: ContextNode;
    snapshot: ContextSnapshot;
    host: ExplorerHost;
    onSelect: (id: string) => void;
    onClose: () => void;
}): import("react").JSX.Element;
