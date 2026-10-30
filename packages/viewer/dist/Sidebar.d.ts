import type { ContextSnapshot } from '@context-atlas/model';
export interface ProjectOption {
    id: string;
    name: string;
    kind: string;
}
export declare function Sidebar({ snapshot, projects, viewId, onView, onProjectChange, onClose, }: {
    snapshot: ContextSnapshot;
    projects: ProjectOption[];
    viewId: string;
    onView: (id: string) => void;
    onProjectChange?: ((id: string) => void) | undefined;
    onClose: () => void;
}): import("react").JSX.Element;
