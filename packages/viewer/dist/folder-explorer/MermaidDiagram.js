import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
let mermaidConfigured = false;
function sanitizeSvg(svg, sanitize) {
    return sanitize(svg)
        .replace(/url\(\s*(?!['"]?#)[^)]+\)/gi, 'none')
        .replace(/@import\s+[^;]+;?/gi, '');
}
export function MermaidDiagram({ source }) {
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
        return (_jsx("figure", { className: "atlas-mermaid", children: _jsx("div", { className: "atlas-mermaid__svg", role: "img", "aria-label": "Mermaid diagram", dangerouslySetInnerHTML: { __html: state.svg } }) }));
    }
    if (state.status === 'error') {
        return (_jsxs("figure", { className: "atlas-mermaid", children: [_jsx("p", { className: "atlas-mermaid__error", role: "alert", children: state.message }), _jsxs("details", { children: [_jsx("summary", { children: "View diagram source" }), _jsx("pre", { className: "atlas-markdown__code", children: _jsx("code", { children: source }) })] })] }));
    }
    return (_jsx("span", { className: "atlas-mermaid__loading", role: "status", children: "Rendering Mermaid diagram\u2026" }));
}
