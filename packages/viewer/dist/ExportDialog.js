import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, FileText, X } from 'lucide-react';
import { exportContext } from '@context-atlas/model';
import { downloadText } from './download.js';
export function ExportDialog({ snapshot, nodeId, allowedSourceIds, onClose, }) {
    const ref = useRef(null);
    const [neighbors, setNeighbors] = useState(true);
    const [objective, setObjective] = useState('');
    const [copyState, setCopyState] = useState('idle');
    useEffect(() => {
        ref.current?.showModal();
    }, []);
    const result = useMemo(() => {
        try {
            return {
                packet: exportContext(snapshot, {
                    nodeIds: [nodeId],
                    allowedSourceIds,
                    depth: neighbors ? 1 : 0,
                    maxNodes: 30,
                    objective: objective.trim(),
                }),
                error: null,
            };
        }
        catch (error) {
            return {
                packet: null,
                error: error instanceof Error ? error.message : 'Unable to prepare this context selection.',
            };
        }
    }, [snapshot, nodeId, allowedSourceIds, neighbors, objective]);
    async function copy() {
        if (!result.packet)
            return;
        try {
            await navigator.clipboard.writeText(result.packet.markdown);
            setCopyState('copied');
        }
        catch {
            setCopyState('failed');
        }
    }
    return (_jsx("dialog", { className: "atlas-export-dialog", ref: ref, onCancel: onClose, onClick: (event) => {
            if (event.target === event.currentTarget)
                onClose();
        }, "aria-labelledby": "atlas-export-title", children: _jsxs("div", { className: "atlas-dialog-content", children: [_jsxs("div", { className: "atlas-dialog-heading", children: [_jsx("span", { className: "atlas-kind-icon kind-document", children: _jsx(FileText, { size: 22, "aria-hidden": "true" }) }), _jsx("button", { className: "atlas-icon-button", "aria-label": "Close export", onClick: onClose, children: _jsx(X, { size: 19, "aria-hidden": "true" }) })] }), _jsx("span", { className: "atlas-eyebrow", children: "FROM UNDERSTANDING TO ACTION" }), _jsx("h2", { id: "atlas-export-title", children: "Take the context with you." }), _jsx("p", { children: "A bounded, source-linked packet for a person or coding agent. Only the selected project is included." }), _jsxs("label", { className: "atlas-field-label", htmlFor: "atlas-objective", children: ["Task objective ", _jsx("span", { children: "optional" })] }), _jsx("input", { id: "atlas-objective", className: "atlas-input", value: objective, onChange: (event) => setObjective(event.target.value), placeholder: "What should happen next?", maxLength: 500 }), _jsxs("label", { className: "atlas-checkbox-label", children: [_jsx("input", { type: "checkbox", checked: neighbors, onChange: (event) => setNeighbors(event.target.checked) }), "Include directly connected objects and required module references"] }), result.error && (_jsx("p", { className: "atlas-error-message", role: "alert", children: result.error })), result.packet && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "atlas-packet-summary", children: [_jsxs("span", { children: [_jsx("strong", { children: result.packet.nodeIds.length }), " objects"] }), _jsxs("span", { children: [_jsx("strong", { children: result.packet.snapshot.sources.length }), " sources"] }), _jsxs("span", { children: [_jsx("strong", { children: result.packet.snapshot.edges.length }), " connections"] })] }), _jsx("pre", { className: "atlas-packet-preview", "aria-label": "Context packet preview", children: result.packet.markdown }), _jsxs("div", { className: "atlas-dialog-actions", children: [_jsxs("button", { className: "atlas-button atlas-button-secondary", onClick: () => downloadText(`${snapshot.project.id}.context.json`, JSON.stringify(result.packet.snapshot, null, 2), 'application/json'), children: [_jsx(Download, { size: 16, "aria-hidden": "true" }), "JSON"] }), _jsxs("button", { className: "atlas-button atlas-button-secondary", onClick: () => downloadText(`${snapshot.project.id}.context.md`, result.packet.markdown, 'text/markdown'), children: [_jsx(Download, { size: 16, "aria-hidden": "true" }), "Markdown"] }), _jsxs("button", { className: "atlas-button atlas-button-primary", onClick: () => void copy(), children: [copyState === 'copied' ? (_jsx(Check, { size: 16, "aria-hidden": "true" })) : (_jsx(Copy, { size: 16, "aria-hidden": "true" })), copyState === 'copied' ? 'Copied' : 'Copy context'] })] }), copyState === 'failed' && (_jsx("p", { className: "atlas-error-message", role: "status", children: "Clipboard access is unavailable. Download Markdown instead." }))] }))] }) }));
}
