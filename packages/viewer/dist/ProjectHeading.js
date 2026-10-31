import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
export function ProjectHeading({ project }) {
    const [linkState, setLinkState] = useState('idle');
    async function copyLink() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setLinkState('copied');
        }
        catch {
            setLinkState('failed');
        }
    }
    return (_jsxs("div", { className: "atlas-project-header", children: [_jsxs("div", { children: [_jsxs("div", { className: "atlas-project-heading-meta", children: [_jsx("span", { className: "atlas-eyebrow", children: "PROJECT ATLAS" }), _jsx("span", { className: "atlas-badge", children: project.kind }), _jsx("span", { className: "atlas-project-version", children: project.version })] }), _jsx("h1", { children: project.name }), _jsx("p", { children: project.description })] }), _jsx("button", { className: "atlas-share-button atlas-icon-button", type: "button", "aria-label": "Copy link to this selection", title: "Copy selection link", onClick: () => void copyLink(), children: linkState === 'copied' ? (_jsx(Check, { size: 18, "aria-hidden": "true" })) : (_jsx(Link2, { size: 18, "aria-hidden": "true" })) }), linkState !== 'idle' && (_jsx("span", { className: "atlas-link-status", role: "status", children: linkState === 'copied'
                    ? 'Selection link copied.'
                    : 'Copy this page URL from your browser to share the selection.' }))] }));
}
