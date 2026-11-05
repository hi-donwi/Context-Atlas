interface DiagramFrameProps {
    readonly svg: string;
    readonly source: string;
    readonly downloadName: string;
}
/** A rendered, already-sanitized diagram with zoom, pan, full-screen, copy, and download. */
export declare function DiagramFrame({ svg, source, downloadName }: DiagramFrameProps): import("react").JSX.Element;
interface MermaidDiagramProps {
    readonly source: string;
    /** Path of the document that holds the diagram, used for the SVG download name. */
    readonly documentPath?: string;
}
export declare function MermaidDiagram({ source, documentPath }: MermaidDiagramProps): import("react").JSX.Element;
export {};
