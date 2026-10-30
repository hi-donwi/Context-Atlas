import type { ContextSnapshot } from '@context-atlas/model';
import type { useExplorer } from './use-explorer.js';
export declare function PerspectiveContent({ snapshot, state, graphView, showOverview, }: {
    snapshot: ContextSnapshot;
    state: ReturnType<typeof useExplorer>;
    graphView: boolean;
    showOverview: boolean;
}): import("react").JSX.Element;
