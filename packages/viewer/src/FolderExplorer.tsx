import { useState } from 'react';
import { FolderPlus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { ContentSource } from '@context-atlas/core';
import { FolderDocument } from './folder-explorer/FolderDocument.js';
import { FolderSearch } from './folder-explorer/FolderSearch.js';
import { FolderTree } from './folder-explorer/FolderTree.js';
import { useFolderExplorer } from './folder-explorer/use-folder-explorer.js';

export interface FolderExplorerProps {
  readonly source: ContentSource;
}

/** Read-only browser explorer for a single folder `ContentSource`. */
export function FolderExplorer({ source }: FolderExplorerProps) {
  const [navigationOpen, setNavigationOpen] = useState(true);
  const state = useFolderExplorer(source);
  const rootEntries = state.entriesByDirectory[''] ?? [];

  return (
    <div className="atlas-folder-explorer">
      <a className="atlas-folder-explorer__skip-link" href="#atlas-folder-main">
        Skip to document
      </a>
      <header className="atlas-folder-explorer__header">
        <div className="atlas-folder-explorer__brand">
          <span className="atlas-folder-explorer__eyebrow">Context Atlas · Local folder</span>
          <h1>{state.info?.title ?? 'Context Atlas'}</h1>
        </div>
        <FolderSearch source={source} scopeId={state.scopeId} onOpenFile={state.selectFile} />
        <span className="atlas-folder-explorer__read-only">Read only</span>
        <button
          className="atlas-folder-explorer__navigation-toggle"
          type="button"
          aria-expanded={navigationOpen}
          aria-controls="atlas-folder-navigation"
          onClick={() => setNavigationOpen((open) => !open)}
        >
          {navigationOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          <span>{navigationOpen ? 'Hide folder contents' : 'Show folder contents'}</span>
        </button>
      </header>

      <div className="atlas-folder-explorer__layout">
        <nav
          className="atlas-folder-explorer__navigation"
          id="atlas-folder-navigation"
          aria-label="Folder contents"
          data-open={navigationOpen}
        >
          <h2>Files</h2>
          {state.sourceLoading ? (
            <p className="atlas-folder-explorer__muted" role="status">
              Loading folder contents…
            </p>
          ) : state.sourceError !== null ? (
            <div className="atlas-folder-explorer__inline-error">
              <p role="alert">{state.sourceError}</p>
              <button type="button" onClick={state.reloadSource}>
                Retry
              </button>
            </div>
          ) : rootEntries.length === 0 ? (
            <p className="atlas-folder-explorer__muted">This folder has no visible files.</p>
          ) : (
            <FolderTree
              entries={rootEntries}
              entriesByDirectory={state.entriesByDirectory}
              expandedDirectories={state.expandedDirectories}
              loadingDirectories={state.loadingDirectories}
              directoryErrors={state.directoryErrors}
              selectedPath={state.selectedPath}
              onToggleDirectory={state.toggleDirectory}
              onRetryDirectory={state.retryDirectory}
              onSelectFile={state.selectFile}
            />
          )}
        </nav>

        <main
          className="atlas-folder-explorer__main"
          id="atlas-folder-main"
          tabIndex={-1}
          aria-busy={state.sourceLoading || state.fileLoading}
        >
          {state.sourceLoading ? (
            <p className="atlas-folder-explorer__status" role="status">
              Loading folder…
            </p>
          ) : state.sourceError !== null ? (
            <section className="atlas-folder-explorer__state">
              <h2>Folder unavailable</h2>
              <p>The local folder source could not be reached.</p>
              <button type="button" onClick={state.reloadSource}>
                Retry loading folder
              </button>
            </section>
          ) : state.fileLoading ? (
            <p className="atlas-folder-explorer__status" role="status">
              Opening {state.selectedPath}…
            </p>
          ) : state.fileError !== null ? (
            <section className="atlas-folder-explorer__state" role="alert">
              <h2>File unavailable</h2>
              <p>{state.fileError}</p>
              <button type="button" onClick={state.retryFile}>
                Retry opening file
              </button>
            </section>
          ) : state.selectedFile !== null && state.selectedPath !== null ? (
            <FolderDocument path={state.selectedPath} file={state.selectedFile} />
          ) : rootEntries.length === 0 ? (
            <section className="atlas-folder-explorer__state">
              <FolderPlus size={24} aria-hidden="true" />
              <h2>No visible files</h2>
              <p>Files excluded for safety are not shown here.</p>
            </section>
          ) : (
            <section className="atlas-folder-explorer__landing">
              <p className="atlas-folder-explorer__eyebrow">Folder overview</p>
              <h2>Choose a file to inspect</h2>
              <p className="atlas-folder-explorer__muted">
                Select a file from the folder contents. Text is shown as inert source.
              </p>
              <ul className="atlas-folder-explorer__cards">
                {rootEntries.map((entry) => (
                  <li key={entry.path}>
                    <button
                      type="button"
                      onClick={() =>
                        entry.kind === 'dir'
                          ? state.toggleDirectory(entry.path)
                          : state.selectFile(entry.path)
                      }
                    >
                      <span>{entry.name}</span>
                      <span className="atlas-folder-explorer__card-meta">
                        {entry.kind === 'dir' ? 'Folder' : entry.type}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
