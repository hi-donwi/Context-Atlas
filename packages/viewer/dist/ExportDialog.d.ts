import { type ContextSnapshot } from '@context-atlas/model';
export declare function ExportDialog({ snapshot, nodeId, allowedSourceIds, onClose, }: {
    snapshot: ContextSnapshot;
    nodeId: string;
    allowedSourceIds: readonly string[];
    onClose: () => void;
}): import("react").JSX.Element;
