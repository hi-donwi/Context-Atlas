import type { FileContent } from '@context-atlas/core';

interface FolderDocumentProps {
  readonly path: string;
  readonly file: FileContent;
}

export function FolderDocument({ path, file }: FolderDocumentProps) {
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
      <dl className="atlas-folder-document__facts">
        <div>
          <dt>Type</dt>
          <dd>{file.type}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{file.size.toLocaleString()} bytes</dd>
        </div>
        {modifiedLabel !== undefined && (
          <div>
            <dt>Modified</dt>
            <dd>{modifiedLabel}</dd>
          </div>
        )}
      </dl>
      {typeof file.content === 'string' ? (
        <pre className="atlas-folder-document__source">
          <code>{file.content}</code>
        </pre>
      ) : (
        <section className="atlas-folder-document__binary" aria-label="Binary file preview">
          <h3>Binary preview unavailable</h3>
          <p>This file is available as data but is not interpreted in this viewer.</p>
          <p>
            {file.type} · {file.size.toLocaleString()} bytes
          </p>
        </section>
      )}
    </article>
  );
}
