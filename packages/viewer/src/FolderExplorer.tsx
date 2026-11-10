import { useEffect, useState } from 'react';
import { ChevronDown, FolderPlus, Languages, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { ContentSource } from '@context-atlas/core';
import { FolderDocument } from './folder-explorer/FolderDocument.js';
import { FolderSearch } from './folder-explorer/FolderSearch.js';
import { FolderTree } from './folder-explorer/FolderTree.js';
import { ScopeSwitcher } from './folder-explorer/ScopeSwitcher.js';
import {
  FolderLocaleContext,
  formatFolderFileType,
  formatFolderMessage,
  loadFolderLocale,
  resolveFolderLocale,
  saveFolderLocale,
  useFolderMessages,
  type FolderLocale,
} from './folder-explorer/locale.js';
import { useFolderExplorer } from './folder-explorer/use-folder-explorer.js';
import { prioritizeRootEntries, visibleFolderEntries } from './folder-explorer/visible-entries.js';

export interface FolderExplorerProps {
  readonly source: ContentSource;
}

/** Read-only browser explorer for a folder or workspace-context `ContentSource`. */
export function FolderExplorer({ source }: FolderExplorerProps) {
  const [locale, setLocale] = useState<FolderLocale>('en');
  useEffect(() => setLocale(loadFolderLocale()), []);
  const changeLocale = (nextLocale: FolderLocale) => {
    setLocale(nextLocale);
    saveFolderLocale(nextLocale);
  };
  return (
    <FolderLocaleContext.Provider value={locale}>
      <LocalizedFolderExplorer source={source} locale={locale} onLocaleChange={changeLocale} />
    </FolderLocaleContext.Provider>
  );
}

function LocalizedFolderExplorer({
  source,
  locale,
  onLocaleChange,
}: FolderExplorerProps & {
  readonly locale: FolderLocale;
  readonly onLocaleChange: (locale: FolderLocale) => void;
}) {
  const text = useFolderMessages();
  const [navigationOpen, setNavigationOpen] = useState(true);
  const state = useFolderExplorer(source);
  const rootEntries = prioritizeRootEntries(
    visibleFolderEntries(state.entriesByDirectory[''] ?? []),
  );
  const rootLoaded = state.entriesByDirectory[''] !== undefined;
  const rootError = !rootLoaded && state.directoryErrors[''] !== undefined;
  const workspace = state.info?.profile === 'workspace';

  return (
    <div className="atlas-folder-explorer">
      <a className="atlas-folder-explorer__skip-link" href="#atlas-folder-main" lang={locale}>
        {text.skip}
      </a>
      <header className="atlas-folder-explorer__header" lang={locale}>
        <div className="atlas-folder-explorer__brand">
          <span className="atlas-folder-explorer__eyebrow">
            {workspace ? text.workspaceContext : text.localFolder}
          </span>
          <div className="atlas-folder-explorer__brand-title">
            <h1>{state.info?.title ?? 'Context Atlas'}</h1>
            <span className="atlas-folder-explorer__read-only">{text.readOnly}</span>
          </div>
        </div>
        <div className="atlas-folder-explorer__actions">
          <FolderSearch source={source} scopeId={state.scopeId} onOpenFile={state.selectFile} />
          <label className="atlas-folder-explorer__locale">
            <span className="atlas-folder-explorer__visually-hidden">{text.language}</span>
            <Languages
              className="atlas-folder-explorer__locale-icon"
              size={16}
              aria-hidden="true"
            />
            <select
              value={locale}
              onChange={(event) => onLocaleChange(resolveFolderLocale(event.currentTarget.value))}
            >
              <option value="en" lang="en">
                {text.english}
              </option>
              <option value="id" lang="id">
                {text.indonesian}
              </option>
            </select>
            <ChevronDown
              className="atlas-folder-explorer__locale-chevron"
              size={16}
              aria-hidden="true"
            />
          </label>
          <button
            className="atlas-folder-explorer__navigation-toggle"
            type="button"
            aria-expanded={navigationOpen}
            aria-controls="atlas-folder-navigation"
            onClick={() => setNavigationOpen((open) => !open)}
          >
            {navigationOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            <span>{navigationOpen ? text.hideContents : text.showContents}</span>
          </button>
        </div>
      </header>

      <div className="atlas-folder-explorer__layout" data-navigation-open={navigationOpen}>
        <nav
          className="atlas-folder-explorer__navigation"
          id="atlas-folder-navigation"
          aria-label={text.folderContents}
          lang={locale}
          data-open={navigationOpen}
        >
          {workspace && state.info !== null ? (
            <ScopeSwitcher
              scopes={state.info.scopes}
              scopeId={state.scopeId}
              onSelectScope={state.selectScope}
            />
          ) : null}
          <h2>{text.files}</h2>
          {state.sourceLoading ? (
            <p className="atlas-folder-explorer__muted" role="status">
              {text.loadingContents}
            </p>
          ) : state.sourceError !== null ? (
            <div className="atlas-folder-explorer__inline-error">
              <p role="alert">{text.sourceError}</p>
              <button type="button" onClick={state.reloadSource}>
                {text.retry}
              </button>
            </div>
          ) : rootError ? (
            <div className="atlas-folder-explorer__inline-error">
              <p role="alert">{text.directoryError}</p>
              <button type="button" onClick={() => state.retryDirectory('')}>
                {text.retry}
              </button>
            </div>
          ) : !rootLoaded ? (
            <p className="atlas-folder-explorer__muted" role="status">
              {text.loadingContents}
            </p>
          ) : rootEntries.length === 0 ? (
            <p className="atlas-folder-explorer__muted">{text.emptyFolder}</p>
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
          {state.sourceLoading || (!rootLoaded && !rootError && state.sourceError === null) ? (
            <p className="atlas-folder-explorer__status" role="status" lang={locale}>
              {text.loadingFolder}
            </p>
          ) : state.sourceError !== null ? (
            <section className="atlas-folder-explorer__state" lang={locale}>
              <h2>{text.folderUnavailable}</h2>
              <p>{text.folderUnreachable}</p>
              <button type="button" onClick={state.reloadSource}>
                {text.retryFolder}
              </button>
            </section>
          ) : state.fileLoading ? (
            <p className="atlas-folder-explorer__status" role="status" lang={locale}>
              {formatFolderMessage(text.openingFile, { name: state.selectedPath ?? '' })}
            </p>
          ) : state.fileError !== null ? (
            <section className="atlas-folder-explorer__state" role="alert" lang={locale}>
              <h2>{text.fileUnavailable}</h2>
              <p>{text.fileError}</p>
              <button type="button" onClick={state.retryFile}>
                {text.retryFile}
              </button>
            </section>
          ) : state.selectedFile !== null &&
            state.selectedPath !== null &&
            state.scopeId !== null ? (
            <FolderDocument
              path={state.selectedPath}
              file={state.selectedFile}
              scopeId={state.scopeId}
              source={source}
              onNavigate={state.selectFile}
            />
          ) : rootEntries.length === 0 ? (
            <section className="atlas-folder-explorer__state" lang={locale}>
              <FolderPlus size={24} aria-hidden="true" />
              <h2>{text.noVisibleFiles}</h2>
              <p>{text.filesExcluded}</p>
            </section>
          ) : (
            <section className="atlas-folder-explorer__landing" lang={locale}>
              <p className="atlas-folder-explorer__eyebrow">{text.folderOverview}</p>
              <h2>{text.chooseFile}</h2>
              <p className="atlas-folder-explorer__muted">{text.chooseFileHelp}</p>
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
                        {entry.kind === 'dir'
                          ? text.folder
                          : formatFolderFileType(entry.type, locale)}
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
