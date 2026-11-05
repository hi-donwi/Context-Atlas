/** Zoom levels offered by diagram controls, as multiples of the fitted width. */
export declare const DIAGRAM_ZOOM_LEVELS: readonly [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
/** Clamp an arbitrary zoom factor into the supported range. */
export declare function clampDiagramZoom(zoom: number): number;
/** The next larger supported zoom level, or the maximum when already there. */
export declare function zoomInLevel(zoom: number): number;
/** The next smaller supported zoom level, or the minimum when already there. */
export declare function zoomOutLevel(zoom: number): number;
/** Human-readable zoom label, such as `125%`. */
export declare function formatDiagramZoom(zoom: number): string;
/**
 * A safe download file name for a diagram, derived from the document path when one is
 * known: `docs/03-journeys.md` becomes `03-journeys-diagram.svg`.
 */
export declare function diagramDownloadName(documentPath?: string): string;
/**
 * The natural width of a rendered diagram from its `viewBox`, used to avoid enlarging small
 * diagrams beyond the size their renderer intended. Returns `undefined` when unknown.
 */
export declare function naturalDiagramWidth(svg: string): number | undefined;
/** Inline size of the diagram canvas: the fitted natural width scaled by the zoom. */
export declare function diagramCanvasSize(zoom: number, naturalWidth: number | undefined): string;
