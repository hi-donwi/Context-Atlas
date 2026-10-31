import type { ContextSnapshot, ExplorerHost } from '@context-atlas/model';
import { type ProjectOption } from './Sidebar.js';
export interface ContextExplorerProps {
    snapshot: ContextSnapshot;
    host?: ExplorerHost | undefined;
    projects?: ProjectOption[] | undefined;
    onProjectChange?: ((id: string) => void) | undefined;
    onImport?: ((file: File) => Promise<void>) | undefined;
    importing?: boolean | undefined;
    notice?: {
        tone: 'error' | 'success';
        message: string;
    } | null | undefined;
    onDismissNotice?: (() => void) | undefined;
    allowedSourceIds?: readonly string[] | undefined;
}
export declare function ContextExplorer(props: ContextExplorerProps): import("react").JSX.Element;
