/** Raised when a caller supplies a path that cannot safely identify content within a scope. */
export class UnsafePathError extends Error {
    constructor() {
        super('Path must be a safe relative path');
        this.name = 'UnsafePathError';
    }
}
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const SCHEME_PREFIX = /^[a-z][a-z\d+.-]*:/i;
function validateRelativePath(path, allowEmpty) {
    if (allowEmpty && path === '')
        return '';
    if (path === '' ||
        path.startsWith('/') ||
        SCHEME_PREFIX.test(path) ||
        /[\\%:]/.test(path) ||
        CONTROL_CHARACTERS.test(path)) {
        throw new UnsafePathError();
    }
    const segments = path.split('/');
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
        throw new UnsafePathError();
    }
    return segments.join('/');
}
/** Validate and return a canonical slash-separated file path relative to its scope root. */
export function normalizeRelativePath(path) {
    return validateRelativePath(path, false);
}
/** Validate a directory path relative to its scope root; the empty path denotes the root. */
export function normalizeDirectoryPath(path) {
    return validateRelativePath(path, true);
}
function canonicalAbsolutePath(path) {
    if (path === '' || CONTROL_CHARACTERS.test(path))
        return undefined;
    const slashPath = path.replace(/\\/g, '/');
    const drive = /^([a-z]):\//i.exec(slashPath)?.[1];
    if (!slashPath.startsWith('/') && drive === undefined)
        return undefined;
    const prefix = drive === undefined ? '/' : `${drive.toUpperCase()}:/`;
    const remainder = drive === undefined ? slashPath.replace(/^\/+/, '') : slashPath.slice(3);
    const segments = [];
    for (const segment of remainder.split('/')) {
        if (segment === '' || segment === '.')
            continue;
        if (segment === '..')
            return undefined;
        segments.push(segment);
    }
    return segments.length === 0 ? prefix : `${prefix}${segments.join('/')}`;
}
/**
 * Compare canonical absolute paths using segment boundaries. Callers should resolve symlinks
 * before passing the candidate so an escaping link is rejected without filesystem access here.
 */
export function isPathWithinRoot(rootPath, candidatePath) {
    const root = canonicalAbsolutePath(rootPath);
    const candidate = canonicalAbsolutePath(candidatePath);
    if (root === undefined || candidate === undefined)
        return false;
    if (candidate === root)
        return true;
    const prefix = root.endsWith('/') ? root : `${root}/`;
    return candidate.startsWith(prefix);
}
