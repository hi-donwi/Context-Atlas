import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Copy, Download, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { downloadText } from '../download.js';
import {
  diagramCanvasSize,
  diagramDownloadName,
  formatDiagramZoom,
  naturalDiagramWidth,
  zoomInLevel,
  zoomOutLevel,
} from './diagram-view.js';

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

type DiagramState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly svg: string }
  | { readonly status: 'error'; readonly message: string };

let mermaidConfigured = false;

function sanitizeSvg(svg: string, sanitize: (input: string) => string): string {
  return sanitize(svg)
    .replace(/url\(\s*(?!['"]?#)[^)]+\)/gi, 'none')
    .replace(/@import\s+[^;]+;?/gi, '');
}

interface DiagramFrameProps {
  readonly svg: string;
  readonly source: string;
  readonly downloadName: string;
}

interface PanStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly top: number;
}

/** A rendered, already-sanitized diagram with zoom, pan, full-screen, copy, and download. */
export function DiagramFrame({ svg, source, downloadName }: DiagramFrameProps) {
  const figureRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<PanStart | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fullScreen, setFullScreen] = useState(false);
  const [status, setStatus] = useState('');
  const naturalWidth = useMemo(() => naturalDiagramWidth(svg), [svg]);

  useEffect(() => {
    const onFullScreenChange = () =>
      setFullScreen(
        document.fullscreenElement !== null && document.fullscreenElement === figureRef.current,
      );
    document.addEventListener('fullscreenchange', onFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullScreenChange);
  }, []);

  const toggleFullScreen = () => {
    const figure = figureRef.current;
    if (figure === null) return;
    if (document.fullscreenElement === figure) {
      void document.exitFullscreen().catch(() => undefined);
    } else if (typeof figure.requestFullscreen === 'function') {
      void figure.requestFullscreen().catch(() => setStatus('Full screen is not available.'));
    } else {
      setStatus('Full screen is not available.');
    }
  };

  const copySource = () => {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard === undefined) {
      setStatus('Copy is not available in this browser.');
      return;
    }
    void clipboard.writeText(source).then(
      () => setStatus('Diagram source copied.'),
      () => setStatus('Diagram source could not be copied.'),
    );
  };

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (viewport === null || event.button !== 0) return;
    if (
      viewport.scrollWidth <= viewport.clientWidth &&
      viewport.scrollHeight <= viewport.clientHeight
    ) {
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

  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const start = panStart.current;
    const viewport = viewportRef.current;
    if (start === null || viewport === null || start.pointerId !== event.pointerId) return;
    viewport.scrollLeft = start.left - (event.clientX - start.x);
    viewport.scrollTop = start.top - (event.clientY - start.y);
  };

  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (panStart.current?.pointerId !== event.pointerId) return;
    panStart.current = null;
    viewportRef.current?.releasePointerCapture(event.pointerId);
  };

  return (
    <figure
      ref={figureRef}
      className={`atlas-mermaid${fullScreen ? ' atlas-mermaid--fullscreen' : ''}`}
    >
      <div className="atlas-mermaid__toolbar" role="toolbar" aria-label="Diagram controls">
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => setZoom(zoomOutLevel)}
        >
          <ZoomOut size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="atlas-mermaid__zoom-value"
          aria-label="Reset zoom"
          title="Reset zoom"
          onClick={() => setZoom(1)}
        >
          {zoom === 1 ? null : <RotateCcw size={14} aria-hidden="true" />}
          <span>{formatDiagramZoom(zoom)}</span>
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => setZoom(zoomInLevel)}
        >
          <ZoomIn size={16} aria-hidden="true" />
        </button>
        <span className="atlas-mermaid__toolbar-gap" aria-hidden="true" />
        <button
          type="button"
          aria-label={fullScreen ? 'Exit full screen' : 'Full screen'}
          title={fullScreen ? 'Exit full screen' : 'Full screen'}
          onClick={toggleFullScreen}
        >
          {fullScreen ? (
            <Minimize2 size={16} aria-hidden="true" />
          ) : (
            <Maximize2 size={16} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label="Copy diagram source"
          title="Copy diagram source"
          onClick={copySource}
        >
          <Copy size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Download SVG"
          title="Download SVG"
          onClick={() => downloadText(downloadName, svg, 'image/svg+xml')}
        >
          <Download size={16} aria-hidden="true" />
        </button>
      </div>
      <div
        ref={viewportRef}
        className="atlas-mermaid__viewport"
        tabIndex={0}
        aria-label="Diagram viewport; scroll or drag to pan"
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <div
          className="atlas-mermaid__canvas"
          style={{ inlineSize: diagramCanvasSize(zoom, naturalWidth) }}
        >
          <div
            className="atlas-mermaid__svg"
            role="img"
            aria-label="Mermaid diagram"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
      <p className="atlas-mermaid__status" role="status" aria-live="polite">
        {status}
      </p>
    </figure>
  );
}

interface MermaidDiagramProps {
  readonly source: string;
  /** Path of the document that holds the diagram, used for the SVG download name. */
  readonly documentPath?: string;
}

export function MermaidDiagram({ source, documentPath }: MermaidDiagramProps) {
  const reactId = useId();
  const renderId = `atlas-mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const [state, setState] = useState<DiagramState>({ status: 'loading' });

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
        if (parsed === false) throw new Error('Invalid Mermaid syntax');

        const { svg } = await mermaid.render(renderId, source);
        const safeSvg = sanitizeSvg(svg, (markup) =>
          DOMPurify.sanitize(markup, {
            USE_PROFILES: { svg: true, svgFilters: true },
            FORBID_TAGS: ['a', 'foreignObject', 'image'],
            FORBID_ATTR: ['href', 'xlink:href', 'style'],
            RETURN_TRUSTED_TYPE: false,
          }),
        );

        if (mounted) setState({ status: 'ready', svg: safeSvg });
      } catch {
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
    return (
      <DiagramFrame
        svg={state.svg}
        source={source}
        downloadName={diagramDownloadName(documentPath)}
      />
    );
  }

  if (state.status === 'error') {
    return (
      <figure className="atlas-mermaid">
        <p className="atlas-mermaid__error" role="alert">
          {state.message}
        </p>
        <details>
          <summary>View diagram source</summary>
          <pre className="atlas-markdown__code">
            <code>{source}</code>
          </pre>
        </details>
      </figure>
    );
  }

  return (
    <span className="atlas-mermaid__loading" role="status">
      Rendering Mermaid diagram…
    </span>
  );
}
