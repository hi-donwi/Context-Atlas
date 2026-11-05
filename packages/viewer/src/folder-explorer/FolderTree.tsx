import { FileText, Folder, FolderOpen } from 'lucide-react';
import type { Entry } from '@context-atlas/core';

interface FolderTreeProps {
  readonly entries: readonly Entry[];
  readonly entriesByDirectory: Readonly<Record<string, readonly Entry[]>>;
  readonly expandedDirectories: ReadonlySet<string>;
  readonly loadingDirectories: ReadonlySet<string>;
  readonly directoryErrors: Readonly<Record<string, string>>;
  readonly selectedPath: string | null;
  readonly onToggleDirectory: (path: string) => void;
  readonly onRetryDirectory: (path: string) => void;
  readonly onSelectFile: (path: string) => void;
}

export function FolderTree(props: FolderTreeProps) {
  return (
    <ul className="atlas-folder-tree">
      {props.entries.map((entry) => (
        <TreeEntry key={entry.path} entry={entry} {...props} />
      ))}
    </ul>
  );
}

function TreeEntry({ entry, ...props }: FolderTreeProps & { readonly entry: Entry }) {
  if (entry.kind === 'dir') {
    const expanded = props.expandedDirectories.has(entry.path);
    const children = props.entriesByDirectory[entry.path];
    const loading = props.loadingDirectories.has(entry.path);
    const error = props.directoryErrors[entry.path];
    const Icon = expanded ? FolderOpen : Folder;

    return (
      <li className="atlas-folder-tree__item" key={entry.path}>
        <button
          className="atlas-folder-tree__button"
          type="button"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} folder ${entry.name}`}
          aria-expanded={expanded}
          onClick={() => props.onToggleDirectory(entry.path)}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{entry.name}</span>
        </button>
        {expanded && (
          <ul className="atlas-folder-tree atlas-folder-tree--nested">
            {loading && (
              <li className="atlas-folder-tree__status" role="status">
                Loading {entry.name}…
              </li>
            )}
            {error !== undefined && (
              <li className="atlas-folder-tree__error">
                <span role="alert">{error}</span>
                <button type="button" onClick={() => props.onRetryDirectory(entry.path)}>
                  Retry loading {entry.name}
                </button>
              </li>
            )}
            {children !== undefined && children.length === 0 && !loading && (
              <li className="atlas-folder-tree__status">This folder is empty.</li>
            )}
            {children?.map((child) => (
              <TreeEntry key={child.path} entry={child} {...props} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const title = entry.title?.trim();
  const distinctTitle = title !== undefined && title !== '' && title !== entry.name ? title : null;

  return (
    <li className="atlas-folder-tree__item" key={entry.path}>
      <button
        className="atlas-folder-tree__button"
        type="button"
        aria-label={
          distinctTitle === null ? `Open ${entry.name}` : `Open ${distinctTitle} (${entry.name})`
        }
        aria-current={props.selectedPath === entry.path ? 'page' : undefined}
        onClick={() => props.onSelectFile(entry.path)}
      >
        <FileText size={16} aria-hidden="true" />
        {distinctTitle === null ? (
          <span>{entry.name}</span>
        ) : (
          <span className="atlas-folder-tree__label">
            <span className="atlas-folder-tree__title">{distinctTitle}</span>
            <span className="atlas-folder-tree__name">{entry.name}</span>
          </span>
        )}
      </button>
    </li>
  );
}
