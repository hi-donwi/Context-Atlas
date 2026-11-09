import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DelimitedTable } from './DelimitedTable.js';
import { MarkdownDocument } from './MarkdownDocument.js';
import { MermaidDiagram } from './MermaidDiagram.js';
import { useFolderLocale, useFolderMessages } from './locale.js';
export function FolderDocument({ path, file, scopeId, source, onNavigate }) {
    const text = useFolderMessages();
    const locale = useFolderLocale();
    const name = path.split('/').at(-1) ?? path;
    const modified = file.mtime === undefined ? undefined : new Date(file.mtime);
    const modifiedLabel = modified !== undefined && !Number.isNaN(modified.getTime())
        ? modified.toLocaleString()
        : undefined;
    return (_jsxs("article", { className: "atlas-folder-document", "aria-labelledby": "atlas-folder-document-title", children: [_jsx("p", { className: "atlas-folder-document__path", children: path }), _jsx("h2", { id: "atlas-folder-document-title", children: name }), _jsxs("dl", { className: "atlas-folder-document__facts", lang: locale, children: [_jsxs("div", { children: [_jsx("dt", { children: text.type }), _jsx("dd", { children: file.type })] }), _jsxs("div", { children: [_jsx("dt", { children: text.size }), _jsxs("dd", { children: [file.size.toLocaleString(), " ", text.bytes] })] }), modifiedLabel !== undefined && (_jsxs("div", { children: [_jsx("dt", { children: text.modified }), _jsx("dd", { children: modifiedLabel })] }))] }), typeof file.content === 'string' && file.type === 'markdown' ? (_jsx(MarkdownDocument, { content: file.content, path: path, scopeId: scopeId, source: source, onNavigate: onNavigate })) : typeof file.content === 'string' && (file.type === 'csv' || file.type === 'tsv') ? (_jsx(DelimitedTable, { content: file.content, delimiter: file.type === 'csv' ? ',' : '\t', label: name })) : typeof file.content === 'string' && file.type === 'mermaid' ? (_jsx(MermaidDiagram, { source: file.content, documentPath: path })) : typeof file.content === 'string' ? (_jsx("pre", { className: "atlas-folder-document__source", children: _jsx("code", { children: file.content }) })) : (_jsxs("section", { className: "atlas-folder-document__binary", "aria-label": text.binaryPreview, lang: locale, children: [_jsx("h3", { children: text.binaryUnavailable }), _jsx("p", { children: text.binaryHelp }), _jsxs("p", { children: [file.type, " \u00B7 ", file.size.toLocaleString(), " ", text.bytes] })] }))] }));
}
