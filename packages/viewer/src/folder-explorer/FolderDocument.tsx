import type { ContentSource, FileContent } from '@context-atlas/core';
import { DelimitedTable } from './DelimitedTable.js';
import { MarkdownDocument } from './MarkdownDocument.js';
import { MermaidDiagram } from './MermaidDiagram.js';
import { useFolderLocale, useFolderMessages } from './locale.js';

interface FolderDocumentProps {
  readonly path: string;
  readonly file: FileContent;
  readonly scopeId: string;
  readonly source: ContentSource;
  readonly onNavigate: (path: string, fragment?: string) => void;
}

export function FolderDocument({ path, file, scopeId, source, onNavigate }: FolderDocumentProps) {
  const text = useFolderMessages();
  const locale = useFolderLocale();
  const name = path.split('/').at(-1) ?? path;
  const modified = file.mtime === undefined ? undefined : new Date(file.mtime);
  const modifiedLabel =
    modified !== undefined && !Number.isNaN(modified.getTime())
      ? modified.toLocaleString()
      : undefined;

  return (
    <article className="atlas-folder-document" aria-labelledby="atlas-folder-document-title">
      <p className="atlas-folder-document__path">{path}</p>
      <h2 id="atlas-folder-document-title">{name}</h2>
      <dl className="atlas-folder-document__facts" lang={locale}>
        <div>
          <dt>{text.type}</dt>
          <dd>{file.type}</dd>
        </div>
        <div>
          <dt>{text.size}</dt>
          <dd>
            {file.size.toLocaleString()} {text.bytes}
          </dd>
        </div>
        {modifiedLabel !== undefined && (
          <div>
            <dt>{text.modified}</dt>
            <dd>{modifiedLabel}</dd>
          </div>
        )}
      </dl>
      {typeof file.content === 'string' && file.type === 'markdown' ? (
        <MarkdownDocument
          content={file.content}
          path={path}
          scopeId={scopeId}
          source={source}
          onNavigate={onNavigate}
        />
      ) : typeof file.content === 'string' && (file.type === 'csv' || file.type === 'tsv') ? (
        <DelimitedTable
          content={file.content}
          delimiter={file.type === 'csv' ? ',' : '\t'}
          label={name}
        />
      ) : typeof file.content === 'string' && file.type === 'mermaid' ? (
        <MermaidDiagram source={file.content} documentPath={path} />
      ) : typeof file.content === 'string' ? (
        <pre className="atlas-folder-document__source">
          <code>{file.content}</code>
        </pre>
      ) : (
        <section
          className="atlas-folder-document__binary"
          aria-label={text.binaryPreview}
          lang={locale}
        >
          <h3>{text.binaryUnavailable}</h3>
          <p>{text.binaryHelp}</p>
          <p>
            {file.type} · {file.size.toLocaleString()} {text.bytes}
          </p>
        </section>
      )}
    </article>
  );
}
