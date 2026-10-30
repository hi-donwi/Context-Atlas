import { ArrowUpRight, FileCode2 } from 'lucide-react';
import type { ContextSource, ExplorerHost } from '@context-atlas/model';

export function InspectorSources({
  sources,
  host,
}: {
  sources: ContextSource[];
  host: ExplorerHost;
}) {
  return (
    <>
      <p className="atlas-inspector-explanation">
        Evidence stays connected to its source revision. A current source does not imply business
        acceptance.
      </p>
      {sources.length ? (
        sources.map((source) => (
          <section className="atlas-source-card" key={source.id}>
            <div>
              <FileCode2 size={17} aria-hidden="true" />
              <strong>{source.label}</strong>
              <span className={`atlas-badge freshness-${source.freshness}`}>
                {source.freshness}
              </span>
            </div>
            <code>{source.path}</code>
            <dl className="atlas-facts">
              <dt>Revision</dt>
              <dd>{source.revision}</dd>
              {source.repository && (
                <>
                  <dt>Repository</dt>
                  <dd>{source.repository}</dd>
                </>
              )}
            </dl>
            {host.openReference && (
              <button
                className="atlas-text-button"
                type="button"
                onClick={() => host.openReference?.(source)}
              >
                Open source <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            )}
          </section>
        ))
      ) : (
        <p className="atlas-empty-inline">No source has been attached to this object yet.</p>
      )}
    </>
  );
}
