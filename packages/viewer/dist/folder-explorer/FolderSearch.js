import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { normalizeSearchQuery } from '@context-atlas/core';
import { formatFolderMessage, useFolderMessages } from './locale.js';
/** Local, keyboard-accessible search for one already-authorized folder scope. */
export function FolderSearch({ source, scopeId, onOpenFile }) {
    const text = useFolderMessages();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);
    const triggerRef = useRef(null);
    const requestId = useRef(0);
    const close = useCallback(() => {
        requestId.current += 1;
        setOpen(false);
        setHits(null);
        setLoading(false);
        setError(null);
        triggerRef.current?.focus();
    }, []);
    useEffect(() => {
        if (open)
            inputRef.current?.focus();
    }, [open]);
    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                if (open)
                    inputRef.current?.focus();
                else
                    setOpen(true);
            }
            else if (event.key === 'Escape' && open) {
                event.preventDefault();
                close();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [close, open]);
    const search = async (event) => {
        event.preventDefault();
        const normalizedQuery = normalizeSearchQuery(query);
        if (normalizedQuery === undefined) {
            setHits(null);
            setError('invalidQuery');
            return;
        }
        if (scopeId === null || source.search === undefined) {
            setHits(null);
            setError('searchUnavailable');
            return;
        }
        const currentRequest = ++requestId.current;
        setHits(null);
        setError(null);
        setLoading(true);
        try {
            const results = await source.search(scopeId, normalizedQuery);
            if (requestId.current === currentRequest)
                setHits(results);
        }
        catch {
            if (requestId.current === currentRequest) {
                setError('searchFailed');
            }
        }
        finally {
            if (requestId.current === currentRequest)
                setLoading(false);
        }
    };
    if (source.search === undefined)
        return null;
    return (_jsxs("div", { className: "atlas-folder-search", children: [_jsxs("button", { ref: triggerRef, className: "atlas-folder-search__trigger", type: "button", "aria-expanded": open, "aria-controls": "atlas-folder-search-panel", "aria-label": text.searchShortcut, "aria-keyshortcuts": "Control+K Meta+K", onClick: () => (open ? close() : setOpen(true)), children: [_jsx(Search, { size: 16, "aria-hidden": "true" }), _jsx("span", { children: text.search }), _jsx("kbd", { "aria-hidden": "true", children: "\u2318/Ctrl K" })] }), _jsxs("section", { className: "atlas-folder-search__panel", id: "atlas-folder-search-panel", "aria-label": text.searchFolder, hidden: !open, children: [_jsxs("form", { className: "atlas-folder-search__form", role: "search", onSubmit: search, children: [_jsx("label", { className: "atlas-folder-search__visually-hidden", htmlFor: "atlas-folder-search-input", children: text.searchFiles }), _jsx("input", { ref: inputRef, id: "atlas-folder-search-input", type: "search", value: query, placeholder: text.searchPlaceholder, autoComplete: "off", onChange: (event) => setQuery(Array.from(event.currentTarget.value).slice(0, 200).join('')) }), _jsx("button", { className: "atlas-folder-search__submit", type: "submit", disabled: loading, children: text.search }), _jsxs("button", { className: "atlas-folder-search__close", type: "button", onClick: close, children: [_jsx(X, { size: 16, "aria-hidden": "true" }), _jsx("span", { className: "atlas-folder-search__visually-hidden", children: text.closeSearch })] })] }), loading ? (_jsx("p", { className: "atlas-folder-search__message", role: "status", "aria-live": "polite", children: text.searching })) : error !== null ? (_jsx("p", { className: "atlas-folder-search__message atlas-folder-search__message--error", role: "alert", children: text[error] })) : hits !== null && hits.length === 0 ? (_jsx("p", { className: "atlas-folder-search__message", role: "status", "aria-live": "polite", children: text.noResults })) : hits !== null ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "atlas-folder-search__summary", role: "status", "aria-live": "polite", children: [hits.length, " ", hits.length === 1 ? text.resultOne : text.resultMany] }), _jsx("ul", { className: "atlas-folder-search__results", "aria-label": text.searchResults, children: hits.map((hit) => {
                                    const title = hit.title ?? hit.path;
                                    const line = hit.line === undefined
                                        ? ''
                                        : formatFolderMessage(text.line, { number: hit.line });
                                    return (_jsx("li", { children: _jsxs("button", { className: "atlas-folder-search__result", type: "button", "aria-label": formatFolderMessage(text.openResult, {
                                                name: title,
                                                path: hit.path,
                                                line,
                                            }), onClick: () => {
                                                onOpenFile(hit.path);
                                                close();
                                            }, children: [_jsx("span", { className: "atlas-folder-search__result-title", children: title }), _jsx("span", { className: "atlas-folder-search__result-path", children: hit.path }), _jsx("span", { className: "atlas-folder-search__result-snippet", children: hit.snippet })] }) }, hit.path));
                                }) })] })) : (_jsx("p", { className: "atlas-folder-search__message", children: text.localSearch }))] })] }));
}
