export declare function ExplorerTopbar({ projectName, onOpenNavigation, onImport, importing, canExport, onExport, notice, onDismissNotice, }: {
    projectName: string;
    onOpenNavigation: () => void;
    onImport?: ((file: File) => Promise<void>) | undefined;
    importing: boolean;
    canExport: boolean;
    onExport: () => void;
    notice?: {
        tone: 'error' | 'success';
        message: string;
    } | null | undefined;
    onDismissNotice?: (() => void) | undefined;
}): import("react").JSX.Element;
