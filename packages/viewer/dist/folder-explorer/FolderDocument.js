import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MarkdownDocument } from './MarkdownDocument.js';
import { MermaidDiagram } from './MermaidDiagram.js';
export function FolderDocument({ path, file, scopeId, source, onNavigate }) {
    const name = path.split('/').at(-1) ?? path;
    const modified = file.mtime === undefined ? undefined : new Date(file.mtime);
    const modifiedLabel = modified !== undefined && !Number.isNaN(modified.getTime())
        ? modified.toLocaleString()
        : undefined;
    return (_jsxs("article", { className: "atlas-folder-document", "aria-labelledby": "atlas-folder-document-title", children: [_jsx("p", { className: "atlas-folder-document__path", children: path }), _jsx("h2", { id: "atlas-folder-document-title", children: name }), _jsxs("dl", { className: "atlas-folder-document__facts", children: [_jsxs("div", { children: [_jsx("dt", { children: "Type" }), _jsx("dd", { children: file.type })] }), _jsxs("div", { children: [_jsx("dt", { children: "Size" }), _jsxs("dd", { children: [file.size.toLocaleString(), " bytes"] })] }), modifiedLabel !== undefined && (_jsxs("div", { children: [_jsx("dt", { children: "Modified" }), _jsx("dd", { children: modifiedLabel })] }))] }), typeof file.content === 'string' && file.type === 'markdown' ? (_jsx(MarkdownDocument, { content: file.content, path: path, scopeId: scopeId, source: source, onNavigate: onNavigate })) : typeof file.content === 'string' && file.type === 'mermaid' ? (_jsx(MermaidDiagram, { source: file.content })) : typeof file.content === 'string' ? (_jsx("pre", { className: "atlas-folder-document__source", children: _jsx("code", { children: file.content }) })) : (_jsxs("section", { className: "atlas-folder-document__binary", "aria-label": "Binary file preview", children: [_jsx("h3", { children: "Binary preview unavailable" }), _jsx("p", { children: "This file is available as data but is not interpreted in this viewer." }), _jsxs("p", { children: [file.type, " \u00B7 ", file.size.toLocaleString(), " bytes"] })] }))] }));
}
