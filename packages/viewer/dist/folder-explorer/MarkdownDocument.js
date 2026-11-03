import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Children, isValidElement } from 'react';
import Markdown, {} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './MermaidDiagram.js';
function textContent(children) {
    return Children.toArray(children)
        .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
        .join('');
}
const components = {
    pre({ children }) {
        const code = Children.toArray(children).find((child) => isValidElement(child));
        if (isValidElement(code)) {
            const language = /(?:^|\s)language-([^\s]+)/.exec(code.props.className ?? '')?.[1];
            if (language?.toLowerCase() === 'mermaid') {
                return _jsx(MermaidDiagram, { source: textContent(code.props.children) });
            }
        }
        return _jsx("pre", { className: "atlas-markdown__code", children: children });
    },
    img({ alt }) {
        return (_jsxs("span", { className: "atlas-markdown__image-placeholder", children: ["Image not loaded", alt ? `: ${alt}` : ''] }));
    },
    a({ href, title, children }) {
        if (href === undefined)
            return _jsx(_Fragment, { children: children });
        const external = /^https?:\/\//i.test(href);
        return (_jsx("a", { href: href, title: title, target: external ? '_blank' : undefined, rel: external ? 'noopener noreferrer' : undefined, children: children }));
    },
};
export function MarkdownDocument({ content }) {
    return (_jsx("div", { className: "atlas-markdown", children: _jsx(Markdown, { remarkPlugins: [remarkGfm], components: components, skipHtml: true, children: content }) }));
}
