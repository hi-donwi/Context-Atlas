import type { Entry } from '@context-atlas/core';
interface FolderTreeProps {
    readonly entries: readonly Entry[];
    readonly entriesByDirectory: Readonly<Record<string, readonly Entry[]>>;
    readonly expandedDirectories: ReadonlySet<string>;
    readonly loadingDirectories: ReadonlySet<string>;
    readonly directoryErrors: Readonly<Record<string, string>>;
    readonly selectedPath: string | null;
    readonly onToggleDirectory: (path: string) => void;
    readonly onRetryDirectory: (path: string) => void;
    readonly onSelectFile: (path: string) => void;
}
export declare function FolderTree(props: FolderTreeProps): import("react").JSX.Element;
export {};
