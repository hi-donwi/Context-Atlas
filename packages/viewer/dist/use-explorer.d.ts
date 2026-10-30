import type { ContextSnapshot } from '@context-atlas/model';
export declare function useExplorer(snapshot: ContextSnapshot): {
    selection: import("./explorer-state.js").ExplorerSelection;
    query: string;
    setQuery: import("react").Dispatch<import("react").SetStateAction<string>>;
    display: "graph" | "list";
    setDisplay: import("react").Dispatch<import("react").SetStateAction<"graph" | "list">>;
    view: import("@context-atlas/model").ContextView | undefined;
    kind: import("@context-atlas/model").ViewKind;
    nodes: import("@context-atlas/model").ContextNode[];
    selectedNode: import("@context-atlas/model").ContextNode | null;
    onSelect: (id: string) => void;
    onView: (id: string) => void;
    onModule: (id: string) => void;
    clearSelection: () => void;
};
