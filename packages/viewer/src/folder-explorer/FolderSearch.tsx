import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { normalizeSearchQuery, type ContentSource, type SearchHit } from 'context-atlas-core';
import { formatFolderMessage, useFolderMessages } from './locale.js';

interface FolderSearchProps {
  readonly source: ContentSource;
  readonly scopeId: string | null;
  readonly onOpenFile: (path: string) => void;
}

/** Local, keyboard-accessible search for one already-authorized folder scope. */
export function FolderSearch({ source, scopeId, onOpenFile }: FolderSearchProps) {
  const text = useFolderMessages();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'invalidQuery' | 'searchUnavailable' | 'searchFailed' | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestId = useRef(0);

  const close = useCallback(() => {
    requestId.current += 1;
    setOpen(false);
    setHits(null);
    setLoading(false);
    setError(null);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (open) inputRef.current?.focus();
        else setOpen(true);
      } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [close, open]);

  const search = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const normalizedQuery = normalizeSearchQuery(query);
    if (normalizedQuery === undefined) {
      setHits(null);
      setError('invalidQuery');
      return;
    }
    if (scopeId === null || source.search === undefined) {
      setHits(null);
      setError('searchUnavailable');
      return;
    }

    const currentRequest = ++requestId.current;
    setHits(null);
    setError(null);
    setLoading(true);
    try {
      const results = await source.search(scopeId, normalizedQuery);
      if (requestId.current === currentRequest) setHits(results);
    } catch {
      if (requestId.current === currentRequest) {
        setError('searchFailed');
      }
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  };

  if (source.search === undefined) return null;

  return (
    <div className="atlas-folder-search">
      <button
        ref={triggerRef}
        className="atlas-folder-search__trigger"
        type="button"
        aria-expanded={open}
        aria-controls="atlas-folder-search-panel"
        aria-label={text.searchShortcut}
        aria-keyshortcuts="Control+K Meta+K"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Search size={16} aria-hidden="true" />
        <span>{text.search}</span>
        <kbd aria-hidden="true">⌘/Ctrl K</kbd>
      </button>

      <section
        className="atlas-folder-search__panel"
        id="atlas-folder-search-panel"
        aria-label={text.searchFolder}
        hidden={!open}
      >
        <form className="atlas-folder-search__form" role="search" onSubmit={search}>
          <label
            className="atlas-folder-search__visually-hidden"
            htmlFor="atlas-folder-search-input"
          >
            {text.searchFiles}
          </label>
          <input
            ref={inputRef}
            id="atlas-folder-search-input"
            type="search"
            value={query}
            placeholder={text.searchPlaceholder}
            autoComplete="off"
            onChange={(event) =>
              setQuery(Array.from(event.currentTarget.value).slice(0, 200).join(''))
            }
          />
          <button className="atlas-folder-search__submit" type="submit" disabled={loading}>
            {text.search}
          </button>
          <button className="atlas-folder-search__close" type="button" onClick={close}>
            <X size={16} aria-hidden="true" />
            <span className="atlas-folder-search__visually-hidden">{text.closeSearch}</span>
          </button>
        </form>

        {loading ? (
          <p className="atlas-folder-search__message" role="status" aria-live="polite">
            {text.searching}
          </p>
        ) : error !== null ? (
          <p
            className="atlas-folder-search__message atlas-folder-search__message--error"
            role="alert"
          >
            {text[error]}
          </p>
        ) : hits !== null && hits.length === 0 ? (
          <p className="atlas-folder-search__message" role="status" aria-live="polite">
            {text.noResults}
          </p>
        ) : hits !== null ? (
          <>
            <p className="atlas-folder-search__summary" role="status" aria-live="polite">
              {hits.length} {hits.length === 1 ? text.resultOne : text.resultMany}
            </p>
            <ul className="atlas-folder-search__results" aria-label={text.searchResults}>
              {hits.map((hit) => {
                const title = hit.title ?? hit.path;
                const line =
                  hit.line === undefined
                    ? ''
                    : formatFolderMessage(text.line, { number: hit.line });
                return (
                  <li key={hit.path}>
                    <button
                      className="atlas-folder-search__result"
                      type="button"
                      aria-label={formatFolderMessage(text.openResult, {
                        name: title,
                        path: hit.path,
                        line,
                      })}
                      onClick={() => {
                        onOpenFile(hit.path);
                        close();
                      }}
                    >
                      <span className="atlas-folder-search__result-title">{title}</span>
                      <span className="atlas-folder-search__result-path">{hit.path}</span>
                      <span className="atlas-folder-search__result-snippet">{hit.snippet}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="atlas-folder-search__message">{text.localSearch}</p>
        )}
      </section>
    </div>
  );
}
