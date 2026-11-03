import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Children, createElement, isValidElement, useEffect, useState, } from 'react';
import Markdown, {} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './MermaidDiagram.js';
import { formatExplorerLocation } from './path-state.js';
import { isSafeRasterImageContent, resolveMarkdownTarget } from './markdown-targets.js';
function textContent(children) {
    return Children.toArray(children)
        .map((child) => {
        if (typeof child === 'string' || typeof child === 'number')
            return String(child);
        return isValidElement(child)
            ? textContent(child.props.children)
            : '';
    })
        .join('');
}
function headingSlug(children) {
    const slug = textContent(children)
        .normalize('NFKD')
        .toLocaleLowerCase('en-US')
        .replace(/\p{M}/gu, '')
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 512);
    return slug || 'section';
}
function MarkdownImage({ source, scopeId, documentPath, src, alt, title }) {
    const path = src === undefined ? undefined : resolveMarkdownTarget(documentPath, src)?.path;
    const [image, setImage] = useState(null);
    const [failedPath, setFailedPath] = useState(null);
    useEffect(() => {
        let active = true;
        let objectUrl;
        setImage(null);
        setFailedPath(null);
        if (path === undefined)
            return () => void (active = false);
        void source
            .read(scopeId, path)
            .then((file) => {
            const mimeType = isSafeRasterImageContent(path, file);
            if (mimeType === undefined || !(file.content instanceof Uint8Array)) {
                if (active)
                    setFailedPath(path);
                return;
            }
            const bytes = new Uint8Array(file.content);
            const url = URL.createObjectURL(new Blob([bytes.buffer], { type: mimeType }));
            if (!active) {
                URL.revokeObjectURL(url);
                return;
            }
            objectUrl = url;
            setImage({ path, url });
        })
            .catch(() => {
            if (active)
                setFailedPath(path);
        });
        return () => {
            active = false;
            if (objectUrl !== undefined)
                URL.revokeObjectURL(objectUrl);
        };
    }, [path, scopeId, source]);
    if (path !== undefined && image?.path === path) {
        return (_jsx("img", { className: "atlas-markdown__image", src: image.url, alt: alt ?? '', title: title, loading: "lazy", decoding: "async" }));
    }
    const label = alt ? `: ${alt}` : '';
    const status = path !== undefined && failedPath !== path ? 'Loading image' : 'Image not loaded';
    return (_jsxs("span", { className: "atlas-markdown__image-placeholder", children: [status, label] }));
}
function markdownComponents(context) {
    const headingIds = new Set();
    const renderHeading = (tag, children) => {
        const slug = headingSlug(children);
        let id = slug;
        let duplicateIndex = 0;
        while (headingIds.has(id)) {
            duplicateIndex += 1;
            id = `${slug}-${duplicateIndex}`;
        }
        headingIds.add(id);
        return createElement(tag, { id }, children);
    };
    return {
        h1({ children }) {
            return renderHeading('h1', children);
        },
        h2({ children }) {
            return renderHeading('h2', children);
        },
        h3({ children }) {
            return renderHeading('h3', children);
        },
        h4({ children }) {
            return renderHeading('h4', children);
        },
        h5({ children }) {
            return renderHeading('h5', children);
        },
        h6({ children }) {
            return renderHeading('h6', children);
        },
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
        img({ src, alt, title }) {
            return (_jsx(MarkdownImage, { source: context.source, scopeId: context.scopeId, documentPath: context.path, src: src, alt: alt, title: title }));
        },
        a({ href, title, children }) {
            if (href === undefined)
                return _jsx(_Fragment, { children: children });
            const external = /^https?:\/\//i.test(href);
            const absolute = /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//');
            const target = absolute ? undefined : resolveMarkdownTarget(context.path, href);
            if (!absolute && target === undefined) {
                return _jsx("span", { className: "atlas-markdown__link-unavailable", children: children });
            }
            if (target !== undefined) {
                const fragment = target.fragment === undefined ? undefined : headingSlug(target.fragment);
                return (_jsx("a", { href: formatExplorerLocation(context.scopeId, target.path, fragment), title: title, onClick: (event) => {
                        if (event.button !== 0 ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey) {
                            return;
                        }
                        event.preventDefault();
                        context.onNavigate(target.path, fragment);
                    }, children: children }));
            }
            return (_jsx("a", { href: href, title: title, target: external ? '_blank' : undefined, rel: external ? 'noopener noreferrer' : undefined, children: children }));
        },
    };
}
export function MarkdownDocument({ content, path, scopeId, source, onNavigate, }) {
    return (_jsx("div", { className: "atlas-markdown", children: _jsx(Markdown, { remarkPlugins: [remarkGfm], components: markdownComponents({ path, scopeId, source, onNavigate }), skipHtml: true, children: content }) }));
}
