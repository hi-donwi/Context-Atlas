import { normalizeRelativePath, UnsafePathError } from 'context-atlas-core';
/** Prefer the conventional folder landing documents without selecting directories. */
export function findDefaultDocument(entries) {
    for (const name of ['README.md', 'index.md']) {
        const match = entries.find((entry) => entry.kind === 'file' && entry.name === name);
        if (match !== undefined)
            return match.path;
    }
    return undefined;
}
/** Encode a safe relative file path as a URL hash that survives page reloads. */
export function formatExplorerLocation(scopeId, path, fragment) {
    const normalizedPath = normalizeRelativePath(path);
    const route = `#/${encodeURIComponent(scopeId)}/${normalizedPath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}`;
    return fragment === undefined || fragment === ''
        ? route
        : `${route}#${encodeURIComponent(fragment)}`;
}
/** Parse a URL hash, returning no selection for malformed or unsafe paths. */
export function parseExplorerLocation(hash) {
    if (!hash.startsWith('#/'))
        return undefined;
    const routeAndFragment = hash.slice(2);
    const fragmentIndex = routeAndFragment.indexOf('#');
    const route = fragmentIndex === -1 ? routeAndFragment : routeAndFragment.slice(0, fragmentIndex);
    const encodedFragment = fragmentIndex === -1 ? undefined : routeAndFragment.slice(fragmentIndex + 1);
    const segments = route.split('/');
    if (segments.length < 2 || segments.some((segment) => segment === ''))
        return undefined;
    try {
        const scopeId = decodeURIComponent(segments[0]);
        const path = segments
            .slice(1)
            .map((segment) => decodeURIComponent(segment))
            .join('/');
        if (scopeId === '' || normalizeRelativePath(path) !== path)
            return undefined;
        if (encodedFragment === undefined || encodedFragment === '')
            return { scopeId, path };
        const fragment = decodeURIComponent(encodedFragment);
        if (fragment.length > 512)
            return undefined;
        return { scopeId, path, fragment };
    }
    catch (error) {
        if (error instanceof URIError || error instanceof UnsafePathError)
            return undefined;
        throw error;
    }
}
