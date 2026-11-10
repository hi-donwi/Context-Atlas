import { isExcludedPath, MAX_FILE_SIZE_BYTES, normalizeRelativePath, UnsafePathError, } from 'context-atlas-core';
const SCHEME_PREFIX = /^[a-z][a-z\d+.-]*:/i;
const UNSAFE_PATH_CHARACTERS = /[\\%:\u0000-\u001f\u007f]/;
/** Resolve a Markdown target within one scope without consulting or traversing its directory tree. */
export function resolveMarkdownTarget(sourcePath, target) {
    const trimmedTarget = target.trim();
    if (trimmedTarget === '' || trimmedTarget.startsWith('//') || SCHEME_PREFIX.test(trimmedTarget)) {
        return undefined;
    }
    let source;
    try {
        source = normalizeRelativePath(sourcePath);
    }
    catch (error) {
        if (error instanceof UnsafePathError)
            return undefined;
        throw error;
    }
    if (isExcludedPath(source))
        return undefined;
    const hashIndex = trimmedTarget.indexOf('#');
    const beforeFragment = hashIndex === -1 ? trimmedTarget : trimmedTarget.slice(0, hashIndex);
    const queryIndex = beforeFragment.indexOf('?');
    const targetPath = (queryIndex === -1 ? beforeFragment : beforeFragment.slice(0, queryIndex)).trim();
    let fragment;
    if (hashIndex !== -1) {
        try {
            fragment = decodeURIComponent(trimmedTarget.slice(hashIndex + 1).trim());
        }
        catch (error) {
            if (error instanceof URIError)
                return undefined;
            throw error;
        }
    }
    if (UNSAFE_PATH_CHARACTERS.test(targetPath))
        return undefined;
    if (targetPath === '') {
        if (fragment === undefined || fragment === '')
            return undefined;
        return { path: source, fragment };
    }
    if (targetPath.endsWith('/'))
        return undefined;
    const rootRelative = targetPath.startsWith('/');
    const targetSegments = (rootRelative ? targetPath.slice(1) : targetPath).split('/');
    if (targetSegments.some((segment) => segment === ''))
        return undefined;
    const resolvedSegments = rootRelative ? [] : source.split('/').slice(0, -1);
    for (const segment of targetSegments) {
        if (segment === '.')
            continue;
        if (segment === '..') {
            if (resolvedSegments.length === 0)
                return undefined;
            resolvedSegments.pop();
        }
        else {
            resolvedSegments.push(segment);
        }
    }
    if (resolvedSegments.length === 0)
        return undefined;
    let path;
    try {
        path = normalizeRelativePath(resolvedSegments.join('/'));
    }
    catch (error) {
        if (error instanceof UnsafePathError)
            return undefined;
        throw error;
    }
    if (isExcludedPath(path))
        return undefined;
    return fragment === undefined || fragment === '' ? { path } : { path, fragment };
}
const RASTER_IMAGE_MIME_TYPES = {
    avif: 'image/avif',
    bmp: 'image/bmp',
    gif: 'image/gif',
    ico: 'image/x-icon',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    webp: 'image/webp',
};
function rasterImageMimeType(path) {
    const extension = path.split('/').at(-1)?.split('.').at(-1)?.toLowerCase();
    return extension === undefined ? undefined : RASTER_IMAGE_MIME_TYPES[extension];
}
function hasImageSignature(mimeType, bytes) {
    const ascii = (offset, value) => [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
    switch (mimeType) {
        case 'image/avif':
            return bytes.length >= 12 && ascii(4, 'ftyp') && (ascii(8, 'avif') || ascii(8, 'avis'));
        case 'image/bmp':
            return bytes.length >= 2 && ascii(0, 'BM');
        case 'image/gif':
            return bytes.length >= 6 && (ascii(0, 'GIF87a') || ascii(0, 'GIF89a'));
        case 'image/jpeg':
            return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        case 'image/png':
            return (bytes.length >= 8 &&
                bytes[0] === 0x89 &&
                ascii(1, 'PNG') &&
                bytes[4] === 0x0d &&
                bytes[5] === 0x0a &&
                bytes[6] === 0x1a &&
                bytes[7] === 0x0a);
        case 'image/tiff':
            return (bytes.length >= 4 &&
                ((ascii(0, 'II') && bytes[2] === 0x2a && bytes[3] === 0) ||
                    (ascii(0, 'MM') && bytes[2] === 0 && bytes[3] === 0x2a)));
        case 'image/webp':
            return bytes.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP');
        case 'image/x-icon':
            return (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0);
        default:
            return false;
    }
}
/** Accept only small, correctly typed raster bytes; SVG and malformed data stay inert. */
export function isSafeRasterImageContent(path, file) {
    let normalizedPath;
    try {
        normalizedPath = normalizeRelativePath(path);
    }
    catch (error) {
        if (error instanceof UnsafePathError)
            return undefined;
        throw error;
    }
    const mimeType = rasterImageMimeType(normalizedPath);
    if (normalizedPath !== path ||
        isExcludedPath(normalizedPath) ||
        file.path !== path ||
        file.type !== 'image' ||
        !(file.content instanceof Uint8Array) ||
        file.size !== file.content.byteLength ||
        file.size > MAX_FILE_SIZE_BYTES ||
        mimeType === undefined ||
        !hasImageSignature(mimeType, file.content)) {
        return undefined;
    }
    return mimeType;
}
