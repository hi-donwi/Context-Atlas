import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FileText, Folder, FolderOpen } from 'lucide-react';
import { formatFolderMessage, useFolderMessages } from './locale.js';
import { visibleFolderEntries } from './visible-entries.js';
export function FolderTree(props) {
    return (_jsx("ul", { className: "atlas-folder-tree", children: visibleFolderEntries(props.entries).map((entry) => (_jsx(TreeEntry, { entry: entry, ...props }, entry.path))) }));
}
function TreeEntry({ entry, ...props }) {
    const text = useFolderMessages();
    if (entry.kind === 'dir') {
        const expanded = props.expandedDirectories.has(entry.path);
        const entries = props.entriesByDirectory[entry.path];
        const children = entries === undefined ? undefined : visibleFolderEntries(entries);
        const loading = props.loadingDirectories.has(entry.path);
        const error = props.directoryErrors[entry.path];
        const Icon = expanded ? FolderOpen : Folder;
        return (_jsxs("li", { className: "atlas-folder-tree__item", children: [_jsxs("button", { className: "atlas-folder-tree__button", type: "button", "aria-label": formatFolderMessage(expanded ? text.collapseFolder : text.expandFolder, {
                        name: entry.name,
                    }), "aria-expanded": expanded, onClick: () => props.onToggleDirectory(entry.path), children: [_jsx(Icon, { size: 16, "aria-hidden": "true" }), _jsx("span", { children: entry.name })] }), expanded && (_jsxs("ul", { className: "atlas-folder-tree atlas-folder-tree--nested", children: [loading && (_jsx("li", { className: "atlas-folder-tree__status", role: "status", children: formatFolderMessage(text.loadingDirectory, { name: entry.name }) })), error !== undefined && (_jsxs("li", { className: "atlas-folder-tree__error", children: [_jsx("span", { role: "alert", children: text.directoryError }), _jsx("button", { type: "button", onClick: () => props.onRetryDirectory(entry.path), children: formatFolderMessage(text.retryDirectory, { name: entry.name }) })] })), children !== undefined && children.length === 0 && !loading && (_jsx("li", { className: "atlas-folder-tree__status", children: text.directoryEmpty })), children?.map((child) => (_jsx(TreeEntry, { entry: child, ...props }, child.path)))] }))] }, entry.path));
    }
    const title = entry.title?.trim();
    const distinctTitle = title !== undefined && title !== '' && title !== entry.name ? title : null;
    return (_jsx("li", { className: "atlas-folder-tree__item", children: _jsxs("button", { className: "atlas-folder-tree__button", type: "button", "aria-label": formatFolderMessage(text.openFile, {
                name: distinctTitle === null ? entry.name : `${distinctTitle} (${entry.name})`,
            }), "aria-current": props.selectedPath === entry.path ? 'page' : undefined, onClick: () => props.onSelectFile(entry.path), children: [_jsx(FileText, { size: 16, "aria-hidden": "true" }), distinctTitle === null ? (_jsx("span", { children: entry.name })) : (_jsxs("span", { className: "atlas-folder-tree__label", children: [_jsx("span", { className: "atlas-folder-tree__title", children: distinctTitle }), _jsx("span", { className: "atlas-folder-tree__name", children: entry.name })] }))] }) }, entry.path));
}
