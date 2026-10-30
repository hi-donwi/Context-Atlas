import type { ContextSnapshot } from '@context-atlas/model';
import type { useExplorer } from './use-explorer.js';
export declare function PerspectiveToolbar({ snapshot, state, graphView, }: {
    snapshot: ContextSnapshot;
    state: ReturnType<typeof useExplorer>;
    graphView: boolean;
}): import("react").JSX.Element;
