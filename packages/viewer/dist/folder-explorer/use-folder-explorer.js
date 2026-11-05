import { useCallback, useEffect, useRef, useState } from 'react';
import { isExcludedPath, normalizeRelativePath, UnsafePathError, } from '@context-atlas/core';
import { findDefaultDocument, formatExplorerLocation, parseExplorerLocation, } from './path-state.js';
export function planChangedPaths(paths, cachedDirectories, expandedDirectories, selectedPath) {
    const visibleDirectories = new Set([...cachedDirectories, ...expandedDirectories]);
    const directories = new Set();
    if (paths.length === 0) {
        for (const directory of visibleDirectories)
            directories.add(directory);
        return {
            directories: [...directories].sort(),
            refreshSelectedFile: selectedPath !== null,
        };
    }
    let refreshSelectedFile = false;
    for (const path of paths) {
        let normalizedPath;
        try {
            normalizedPath = normalizeRelativePath(path);
            if (normalizedPath !== path) {
                return planChangedPaths([], cachedDirectories, expandedDirectories, selectedPath);
            }
        }
        catch (error) {
            if (error instanceof UnsafePathError) {
                return planChangedPaths([], cachedDirectories, expandedDirectories, selectedPath);
            }
            throw error;
        }
        if (isExcludedPath(normalizedPath))
            continue;
        const separator = normalizedPath.lastIndexOf('/');
        directories.add(separator === -1 ? '' : normalizedPath.slice(0, separator));
        if (visibleDirectories.has(normalizedPath))
            directories.add(normalizedPath);
        if (selectedPath !== null &&
            (normalizedPath === selectedPath || selectedPath.startsWith(`${normalizedPath}/`))) {
            refreshSelectedFile = true;
        }
    }
    return { directories: [...directories].sort(), refreshSelectedFile };
}
export function useFolderExplorer(source) {
    const [sourceAttempt, setSourceAttempt] = useState(0);
    const [info, setInfo] = useState(null);
    const [scopeId, setScopeId] = useState(null);
    const [entriesByDirectory, setEntriesByDirectory] = useState({});
    const [expandedDirectories, setExpandedDirectories] = useState(new Set());
    const [loadingDirectories, setLoadingDirectories] = useState(new Set());
    const [directoryErrors, setDirectoryErrors] = useState({});
    const [sourceLoading, setSourceLoading] = useState(true);
    const [sourceError, setSourceError] = useState(null);
    const [selectedPath, setSelectedPath] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileLoading, setFileLoading] = useState(false);
    const [fileError, setFileError] = useState(null);
    const fileRequestId = useRef(0);
    const initialSelectionHandled = useRef(false);
    const entriesByDirectoryRef = useRef(entriesByDirectory);
    const expandedDirectoriesRef = useRef(expandedDirectories);
    const selectedPathRef = useRef(selectedPath);
    entriesByDirectoryRef.current = entriesByDirectory;
    expandedDirectoriesRef.current = expandedDirectories;
    selectedPathRef.current = selectedPath;
    const reloadSource = useCallback(() => setSourceAttempt((attempt) => attempt + 1), []);
    const selectFile = useCallback(async (path, historyMode = 'push', fragment) => {
        if (scopeId === null)
            return;
        const requestId = ++fileRequestId.current;
        setSelectedPath(path);
        setSelectedFile(null);
        setFileError(null);
        setFileLoading(true);
        if (historyMode !== 'none') {
            const nextHash = formatExplorerLocation(scopeId, path, fragment);
            if (window.location.hash !== nextHash) {
                window.history[historyMode === 'push' ? 'pushState' : 'replaceState'](null, '', nextHash);
            }
        }
        try {
            const file = await source.read(scopeId, path);
            if (fileRequestId.current === requestId)
                setSelectedFile(file);
        }
        catch {
            if (fileRequestId.current === requestId) {
                setFileError('The selected file could not be opened. It may have moved or be excluded.');
            }
        }
        finally {
            if (fileRequestId.current === requestId)
                setFileLoading(false);
        }
    }, [scopeId, source]);
    useEffect(() => {
        let active = true;
        initialSelectionHandled.current = false;
        fileRequestId.current += 1;
        setInfo(null);
        setScopeId(null);
        setEntriesByDirectory({});
        setExpandedDirectories(new Set());
        setLoadingDirectories(new Set());
        setDirectoryErrors({});
        setSelectedPath(null);
        setSelectedFile(null);
        setSourceError(null);
        setSourceLoading(true);
        void (async () => {
            try {
                const sourceInfo = await source.describe();
                if (sourceInfo.profile !== 'folder' || sourceInfo.scopes.length !== 1) {
                    throw new Error('unsupported profile');
                }
                const folderScope = sourceInfo.scopes[0];
                if (folderScope === undefined)
                    throw new Error('missing scope');
                const rootEntries = await source.list(folderScope.id, '');
                if (!active)
                    return;
                setInfo(sourceInfo);
                setScopeId(folderScope.id);
                setEntriesByDirectory({ '': rootEntries });
            }
            catch {
                if (active)
                    setSourceError('The folder source could not be loaded. Check the local server and retry.');
            }
            finally {
                if (active)
                    setSourceLoading(false);
            }
        })();
        return () => {
            active = false;
            fileRequestId.current += 1;
        };
    }, [source, sourceAttempt]);
    useEffect(() => {
        const rootEntries = entriesByDirectory[''];
        if (scopeId === null || rootEntries === undefined || initialSelectionHandled.current)
            return;
        initialSelectionHandled.current = true;
        const location = parseExplorerLocation(window.location.hash);
        if (location?.scopeId === scopeId) {
            void selectFile(location.path, 'none', location.fragment);
            return;
        }
        const scopeDefault = info?.scopes.find((scope) => scope.id === scopeId)?.defaultDocument;
        const defaultPath = scopeDefault ?? findDefaultDocument(rootEntries);
        if (defaultPath !== undefined)
            void selectFile(defaultPath, 'replace');
    }, [entriesByDirectory, info, scopeId, selectFile]);
    useEffect(() => {
        if (scopeId === null)
            return;
        const handleHashChange = () => {
            const location = parseExplorerLocation(window.location.hash);
            if (location?.scopeId === scopeId) {
                void selectFile(location.path, 'none', location.fragment);
            }
            else {
                fileRequestId.current += 1;
                setSelectedPath(null);
                setSelectedFile(null);
                setFileError(null);
                setFileLoading(false);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [scopeId, selectFile]);
    useEffect(() => {
        if (scopeId === null || selectedPath === null || selectedFile === null || fileLoading)
            return;
        const location = parseExplorerLocation(window.location.hash);
        if (location?.scopeId !== scopeId ||
            location.path !== selectedPath ||
            location.fragment === undefined) {
            return;
        }
        const frame = window.requestAnimationFrame(() => {
            const heading = [...document.querySelectorAll('.atlas-markdown [id]')].find((element) => element.id === location.fragment);
            heading?.scrollIntoView({ block: 'start' });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [fileLoading, scopeId, selectedFile, selectedPath]);
    const loadDirectory = useCallback((path) => {
        if (scopeId === null)
            return;
        setLoadingDirectories((current) => new Set(current).add(path));
        setDirectoryErrors((current) => {
            const next = { ...current };
            delete next[path];
            return next;
        });
        void source
            .list(scopeId, path)
            .then((entries) => setEntriesByDirectory((current) => ({ ...current, [path]: entries })))
            .catch(() => setDirectoryErrors((current) => ({ ...current, [path]: 'Could not load this folder.' })))
            .finally(() => setLoadingDirectories((current) => {
            const next = new Set(current);
            next.delete(path);
            return next;
        }));
    }, [scopeId, source]);
    useEffect(() => {
        if (scopeId === null || source.watch === undefined)
            return;
        return source.watch((paths) => {
            const plan = planChangedPaths(paths, new Set(Object.keys(entriesByDirectoryRef.current)), expandedDirectoriesRef.current, selectedPathRef.current);
            for (const directory of plan.directories)
                loadDirectory(directory);
            const currentPath = selectedPathRef.current;
            if (plan.refreshSelectedFile && currentPath !== null)
                void selectFile(currentPath, 'none');
        });
    }, [loadDirectory, scopeId, selectFile, source]);
    const toggleDirectory = useCallback((path) => {
        if (scopeId === null)
            return;
        if (expandedDirectories.has(path)) {
            setExpandedDirectories((current) => {
                const next = new Set(current);
                next.delete(path);
                return next;
            });
            return;
        }
        setExpandedDirectories((current) => new Set(current).add(path));
        if (entriesByDirectory[path] === undefined && !loadingDirectories.has(path)) {
            loadDirectory(path);
        }
    }, [entriesByDirectory, expandedDirectories, loadDirectory, loadingDirectories, scopeId]);
    const retryFile = useCallback(() => {
        if (selectedPath !== null)
            void selectFile(selectedPath, 'none');
    }, [selectedPath, selectFile]);
    return {
        info,
        scopeId,
        entriesByDirectory,
        expandedDirectories,
        loadingDirectories,
        directoryErrors,
        sourceLoading,
        sourceError,
        selectedPath,
        selectedFile,
        fileLoading,
        fileError,
        reloadSource,
        toggleDirectory,
        retryDirectory: loadDirectory,
        selectFile: (path, fragment) => void selectFile(path, 'push', fragment),
        retryFile,
    };
}
