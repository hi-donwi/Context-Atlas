import { useEffect, useId, useState } from 'react';

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

interface MermaidDiagramProps {
  readonly source: string;
}

export function MermaidDiagram({ source }: MermaidDiagramProps) {
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
      <figure className="atlas-mermaid">
        <div
          className="atlas-mermaid__svg"
          role="img"
          aria-label="Mermaid diagram"
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      </figure>
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
