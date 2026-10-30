import { useRef } from 'react';
import { ArrowDownToLine, ChevronRight, FileUp, Menu, X } from 'lucide-react';

export function ExplorerTopbar({
  projectName,
  onOpenNavigation,
  onImport,
  importing,
  canExport,
  onExport,
  notice,
  onDismissNotice,
}: {
  projectName: string;
  onOpenNavigation: () => void;
  onImport?: ((file: File) => Promise<void>) | undefined;
  importing: boolean;
  canExport: boolean;
  onExport: () => void;
  notice?: { tone: 'error' | 'success'; message: string } | null | undefined;
  onDismissNotice?: (() => void) | undefined;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <header className="atlas-topbar">
        <div className="atlas-breadcrumb">
          <button
            type="button"
            className="atlas-icon-button atlas-mobile-menu"
            onClick={() => onOpenNavigation()}
            aria-label="Open navigation"
          >
            <Menu size={19} aria-hidden="true" />
          </button>
          <span>Workspace</span>
          <ChevronRight size={13} aria-hidden="true" />
          <strong>{projectName}</strong>
        </div>
        <div className="atlas-topbar-actions">
          <span className="atlas-browser-badge">
            <span className="atlas-local-dot" />
            Browser local
          </span>
          {onImport && (
            <>
              <input
                ref={input}
                className="atlas-sr-only"
                type="file"
                accept=".json,application/json"
                aria-label="Import context JSON"
                tabIndex={-1}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void onImport(file);
                }}
              />
              <button
                className="atlas-button atlas-button-secondary"
                type="button"
                onClick={() => input.current?.click()}
                disabled={importing}
              >
                <FileUp size={16} aria-hidden="true" />
                <span>{importing ? 'Importing…' : 'Import JSON'}</span>
              </button>
            </>
          )}
          <button
            className="atlas-button atlas-button-primary"
            type="button"
            disabled={!canExport}
            onClick={onExport}
          >
            <ArrowDownToLine size={16} aria-hidden="true" />
            <span>Export context</span>
          </button>
        </div>
      </header>
      {notice && (
        <div
          className={`atlas-notice notice-${notice.tone}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          <span>{notice.message}</span>
          {onDismissNotice && (
            <button
              className="atlas-icon-button"
              type="button"
              aria-label="Dismiss message"
              onClick={onDismissNotice}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
