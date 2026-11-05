/** Zoom levels offered by diagram controls, as multiples of the fitted width. */
export const DIAGRAM_ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const MIN_ZOOM = DIAGRAM_ZOOM_LEVELS[0];
const MAX_ZOOM = DIAGRAM_ZOOM_LEVELS[DIAGRAM_ZOOM_LEVELS.length - 1];
/** Clamp an arbitrary zoom factor into the supported range. */
export function clampDiagramZoom(zoom) {
    if (!Number.isFinite(zoom))
        return 1;
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
/** The next larger supported zoom level, or the maximum when already there. */
export function zoomInLevel(zoom) {
    const current = clampDiagramZoom(zoom);
    return DIAGRAM_ZOOM_LEVELS.find((level) => level > current + 1e-9) ?? MAX_ZOOM;
}
/** The next smaller supported zoom level, or the minimum when already there. */
export function zoomOutLevel(zoom) {
    const current = clampDiagramZoom(zoom);
    return [...DIAGRAM_ZOOM_LEVELS].reverse().find((level) => level < current - 1e-9) ?? MIN_ZOOM;
}
/** Human-readable zoom label, such as `125%`. */
export function formatDiagramZoom(zoom) {
    return `${Math.round(clampDiagramZoom(zoom) * 100)}%`;
}
/**
 * A safe download file name for a diagram, derived from the document path when one is
 * known: `docs/03-journeys.md` becomes `03-journeys-diagram.svg`.
 */
export function diagramDownloadName(documentPath) {
    const fileName = documentPath?.split('/').at(-1) ?? '';
    const stem = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
    const trimmed = stem.replace(/^[-.]+|[-.]+$/g, '').slice(0, 80);
    return trimmed === '' ? 'diagram.svg' : `${trimmed}-diagram.svg`;
}
/**
 * The natural width of a rendered diagram from its `viewBox`, used to avoid enlarging small
 * diagrams beyond the size their renderer intended. Returns `undefined` when unknown.
 */
export function naturalDiagramWidth(svg) {
    const viewBox = /<svg\b[^>]*\bviewBox\s*=\s*["']([^"']+)["']/i.exec(svg)?.[1];
    if (viewBox === undefined)
        return undefined;
    const parts = viewBox
        .trim()
        .split(/[\s,]+/)
        .map(Number);
    const width = parts[2];
    if (parts.length !== 4 || width === undefined || !Number.isFinite(width) || width <= 0) {
        return undefined;
    }
    return Math.min(width, 100_000);
}
/** Inline size of the diagram canvas: the fitted natural width scaled by the zoom. */
export function diagramCanvasSize(zoom, naturalWidth) {
    const factor = clampDiagramZoom(zoom);
    return naturalWidth === undefined
        ? `${factor * 100}%`
        : `calc(min(100%, ${Math.round(naturalWidth)}px) * ${factor})`;
}
