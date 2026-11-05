import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Copy, Download, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { downloadText } from '../download.js';
import { diagramCanvasSize, diagramDownloadName, formatDiagramZoom, naturalDiagramWidth, zoomInLevel, zoomOutLevel, } from './diagram-view.js';
const MAX_MERMAID_SOURCE_CHARS = 50_000;
const SECURE_DIRECTIVE_KEYS = [
    'secure',
    'securityLevel',
    'startOnLoad',
    'maxTextSize',
    'suppressErrorRendering',
    'htmlLabels',
    'themeCSS',
];
let mermaidConfigured = false;
function sanitizeSvg(svg, sanitize) {
    return sanitize(svg)
        .replace(/url\(\s*(?!['"]?#)[^)]+\)/gi, 'none')
        .replace(/@import\s+[^;]+;?/gi, '');
}
/** A rendered, already-sanitized diagram with zoom, pan, full-screen, copy, and download. */
export function DiagramFrame({ svg, source, downloadName }) {
    const figureRef = useRef(null);
    const viewportRef = useRef(null);
    const panStart = useRef(null);
    const [zoom, setZoom] = useState(1);
    const [fullScreen, setFullScreen] = useState(false);
    const [status, setStatus] = useState('');
    const naturalWidth = useMemo(() => naturalDiagramWidth(svg), [svg]);
    useEffect(() => {
        const onFullScreenChange = () => setFullScreen(document.fullscreenElement !== null && document.fullscreenElement === figureRef.current);
        document.addEventListener('fullscreenchange', onFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullScreenChange);
    }, []);
    const toggleFullScreen = () => {
        const figure = figureRef.current;
        if (figure === null)
            return;
        if (document.fullscreenElement === figure) {
            void document.exitFullscreen().catch(() => undefined);
        }
        else if (typeof figure.requestFullscreen === 'function') {
            void figure.requestFullscreen().catch(() => setStatus('Full screen is not available.'));
        }
        else {
            setStatus('Full screen is not available.');
        }
    };
    const copySource = () => {
        const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
        if (clipboard === undefined) {
            setStatus('Copy is not available in this browser.');
            return;
        }
        void clipboard.writeText(source).then(() => setStatus('Diagram source copied.'), () => setStatus('Diagram source could not be copied.'));
    };
    const startPan = (event) => {
        const viewport = viewportRef.current;
        if (viewport === null || event.button !== 0)
            return;
        if (viewport.scrollWidth <= viewport.clientWidth &&
            viewport.scrollHeight <= viewport.clientHeight) {
            return;
        }
        panStart.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            left: viewport.scrollLeft,
            top: viewport.scrollTop,
        };
        viewport.setPointerCapture(event.pointerId);
    };
    const movePan = (event) => {
        const start = panStart.current;
        const viewport = viewportRef.current;
        if (start === null || viewport === null || start.pointerId !== event.pointerId)
            return;
        viewport.scrollLeft = start.left - (event.clientX - start.x);
        viewport.scrollTop = start.top - (event.clientY - start.y);
    };
    const endPan = (event) => {
        if (panStart.current?.pointerId !== event.pointerId)
            return;
        panStart.current = null;
        viewportRef.current?.releasePointerCapture(event.pointerId);
    };
    return (_jsxs("figure", { ref: figureRef, className: `atlas-mermaid${fullScreen ? ' atlas-mermaid--fullscreen' : ''}`, children: [_jsxs("div", { className: "atlas-mermaid__toolbar", role: "toolbar", "aria-label": "Diagram controls", children: [_jsx("button", { type: "button", "aria-label": "Zoom out", title: "Zoom out", onClick: () => setZoom(zoomOutLevel), children: _jsx(ZoomOut, { size: 16, "aria-hidden": "true" }) }), _jsxs("button", { type: "button", className: "atlas-mermaid__zoom-value", "aria-label": "Reset zoom", title: "Reset zoom", onClick: () => setZoom(1), children: [zoom === 1 ? null : _jsx(RotateCcw, { size: 14, "aria-hidden": "true" }), _jsx("span", { children: formatDiagramZoom(zoom) })] }), _jsx("button", { type: "button", "aria-label": "Zoom in", title: "Zoom in", onClick: () => setZoom(zoomInLevel), children: _jsx(ZoomIn, { size: 16, "aria-hidden": "true" }) }), _jsx("span", { className: "atlas-mermaid__toolbar-gap", "aria-hidden": "true" }), _jsx("button", { type: "button", "aria-label": fullScreen ? 'Exit full screen' : 'Full screen', title: fullScreen ? 'Exit full screen' : 'Full screen', onClick: toggleFullScreen, children: fullScreen ? (_jsx(Minimize2, { size: 16, "aria-hidden": "true" })) : (_jsx(Maximize2, { size: 16, "aria-hidden": "true" })) }), _jsx("button", { type: "button", "aria-label": "Copy diagram source", title: "Copy diagram source", onClick: copySource, children: _jsx(Copy, { size: 16, "aria-hidden": "true" }) }), _jsx("button", { type: "button", "aria-label": "Download SVG", title: "Download SVG", onClick: () => downloadText(downloadName, svg, 'image/svg+xml'), children: _jsx(Download, { size: 16, "aria-hidden": "true" }) })] }), _jsx("div", { ref: viewportRef, className: "atlas-mermaid__viewport", tabIndex: 0, "aria-label": "Diagram viewport; scroll or drag to pan", onPointerDown: startPan, onPointerMove: movePan, onPointerUp: endPan, onPointerCancel: endPan, children: _jsx("div", { className: "atlas-mermaid__canvas", style: { inlineSize: diagramCanvasSize(zoom, naturalWidth) }, children: _jsx("div", { className: "atlas-mermaid__svg", role: "img", "aria-label": "Mermaid diagram", dangerouslySetInnerHTML: { __html: svg } }) }) }), _jsx("p", { className: "atlas-mermaid__status", role: "status", "aria-live": "polite", children: status })] }));
}
export function MermaidDiagram({ source, documentPath }) {
    const reactId = useId();
    const renderId = `atlas-mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const [state, setState] = useState({ status: 'loading' });
    useEffect(() => {
        let mounted = true;
        if (source.length > MAX_MERMAID_SOURCE_CHARS) {
            setState({ status: 'error', message: 'This diagram is too large to render.' });
            return () => {
                mounted = false;
            };
        }
        setState({ status: 'loading' });
        void (async () => {
            try {
                const [{ default: mermaid }, { default: DOMPurify }] = await Promise.all([
                    import('mermaid'),
                    import('dompurify'),
                ]);
                if (!mermaidConfigured) {
                    mermaid.initialize({
                        startOnLoad: false,
                        securityLevel: 'strict',
                        htmlLabels: false,
                        maxTextSize: MAX_MERMAID_SOURCE_CHARS,
                        suppressErrorRendering: true,
                        secure: SECURE_DIRECTIVE_KEYS,
                    });
                    mermaidConfigured = true;
                }
                const parsed = await mermaid.parse(source, { suppressErrors: true });
                if (parsed === false)
                    throw new Error('Invalid Mermaid syntax');
                const { svg } = await mermaid.render(renderId, source);
                const safeSvg = sanitizeSvg(svg, (markup) => DOMPurify.sanitize(markup, {
                    USE_PROFILES: { svg: true, svgFilters: true },
                    FORBID_TAGS: ['a', 'foreignObject', 'image'],
                    FORBID_ATTR: ['href', 'xlink:href', 'style'],
                    RETURN_TRUSTED_TYPE: false,
                }));
                if (mounted)
                    setState({ status: 'ready', svg: safeSvg });
            }
            catch {
                if (mounted) {
                    setState({ status: 'error', message: 'This Mermaid diagram could not be rendered.' });
                }
            }
        })();
        return () => {
            mounted = false;
        };
    }, [renderId, source]);
    if (state.status === 'ready') {
        return (_jsx(DiagramFrame, { svg: state.svg, source: source, downloadName: diagramDownloadName(documentPath) }));
    }
    if (state.status === 'error') {
        return (_jsxs("figure", { className: "atlas-mermaid", children: [_jsx("p", { className: "atlas-mermaid__error", role: "alert", children: state.message }), _jsxs("details", { children: [_jsx("summary", { children: "View diagram source" }), _jsx("pre", { className: "atlas-markdown__code", children: _jsx("code", { children: source }) })] })] }));
    }
    return (_jsx("span", { className: "atlas-mermaid__loading", role: "status", children: "Rendering Mermaid diagram\u2026" }));
}
