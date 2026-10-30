import { useState } from 'react';
import { ArrowUpRight, ChevronRight, FileCode2, Link2, PanelRightClose } from 'lucide-react';
import type { ContextNode, ContextSnapshot, ExplorerHost, JsonValue } from '@context-atlas/model';
import { KindIcon } from './icons.js';

export function Inspector({
  node,
  snapshot,
  host,
  onSelect,
  onClose,
}: {
  node: ContextNode;
  snapshot: ContextSnapshot;
  host: ExplorerHost;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'details' | 'sources' | 'related'>('details');
  const sources = snapshot.sources.filter((source) => node.sourceIds.includes(source.id));
  const relationships = snapshot.edges.filter(
    (edge) => edge.source === node.id || edge.target === node.id,
  );
  return (
    <aside className="atlas-inspector" id="atlas-inspector" aria-label="Object inspector">
      <div className="atlas-inspector-top">
        <span className="atlas-eyebrow">OBJECT INSPECTOR</span>
        <button
          className="atlas-icon-button"
          type="button"
          aria-label="Close inspector"
          onClick={onClose}
        >
          <PanelRightClose size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="atlas-inspector-heading">
        <span className={`atlas-kind-icon kind-${node.kind}`}>
          <KindIcon kind={node.kind} size={22} />
        </span>
        <span className="atlas-kind-label">{node.kind}</span>
        <h2>{node.label}</h2>
        <p>{node.description}</p>
        <div className="atlas-inline-badges">
          <span className={`atlas-status status-${node.status}`}>{node.status}</span>
          <span className="atlas-badge">{node.evidence} evidence</span>
        </div>
      </div>
      <div className="atlas-inspector-tabs" role="group" aria-label="Inspector sections">
        {(['details', 'sources', 'related'] as const).map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={tab === item}
            className={tab === item ? 'is-active' : ''}
            onClick={() => setTab(item)}
          >
            {item}
            <span>
              {item === 'sources' ? sources.length : item === 'related' ? relationships.length : ''}
            </span>
          </button>
        ))}
      </div>
      <div className="atlas-inspector-body">
        {tab === 'details' && (
          <>
            {node.details?.endpoint && (
              <>
                <section className="atlas-inspector-section">
                  <h3>API contract</h3>
                  <div className="atlas-endpoint">
                    <span
                      className={`atlas-method method-${node.details.endpoint.method.toLowerCase()}`}
                    >
                      {node.details.endpoint.method}
                    </span>
                    <code>{node.details.endpoint.path}</code>
                  </div>
                  <dl className="atlas-facts">
                    <dt>Authentication</dt>
                    <dd>{node.details.endpoint.authentication}</dd>
                  </dl>
                </section>
                {node.details.endpoint.parameters && (
                  <JsonBlock label="Parameters" value={node.details.endpoint.parameters} />
                )}
                {node.details.endpoint.request && (
                  <JsonBlock label="Request payload" value={node.details.endpoint.request} />
                )}
                {Object.entries(node.details.endpoint.responses).map(([status, response]) => (
                  <JsonBlock key={status} label={`Response ${status}`} value={response} />
                ))}
              </>
            )}
            {!!node.details?.fields?.length && (
              <section className="atlas-inspector-section">
                <h3>Data structure</h3>
                <div className="atlas-field-list">
                  {node.details.fields.map((field) => (
                    <div className="atlas-field" key={field.name}>
                      <div>
                        <code>{field.name}</code>
                        {field.primaryKey && <span className="atlas-badge">PK</span>}
                        {field.required && <span className="atlas-required">required</span>}
                        <code className="atlas-muted">{field.type}</code>
                      </div>
                      {field.description && <p>{field.description}</p>}
                      {field.references && <small>References {field.references}</small>}
                    </div>
                  ))}
                </div>
              </section>
            )}
            {node.details?.task && (
              <section className="atlas-inspector-section">
                <h3>Work status</h3>
                <dl className="atlas-facts">
                  <dt>State</dt>
                  <dd>{node.details.task.state}</dd>
                  <dt>Priority</dt>
                  <dd>{node.details.task.priority}</dd>
                </dl>
              </section>
            )}
            {!!node.details?.notes?.length && (
              <section className="atlas-inspector-section">
                <h3>{node.kind === 'topic' ? 'Learning notes' : 'Context and open questions'}</h3>
                <ul className="atlas-notes">
                  {node.details.notes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </section>
            )}
            {node.details?.code && (
              <section className="atlas-inspector-section">
                <h3>Source excerpt</h3>
                <pre>
                  <code>{node.details.code}</code>
                </pre>
              </section>
            )}
            <section className="atlas-inspector-section">
              <h3>At a glance</h3>
              <dl className="atlas-facts">
                <dt>Identity</dt>
                <dd>
                  <code>{node.id}</code>
                </dd>
                <dt>Evidence</dt>
                <dd>{node.evidence}</dd>
                <dt>Source references</dt>
                <dd>{sources.length}</dd>
                <dt>Connections</dt>
                <dd>{relationships.length}</dd>
              </dl>
              {!!node.tags.length && (
                <div className="atlas-tag-list">
                  {node.tags.map((tag) => (
                    <span className="atlas-badge" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </section>
            {host.requestEdit && (
              <button
                className="atlas-button atlas-button-secondary atlas-inspector-edit"
                type="button"
                onClick={() => host.requestEdit?.(node)}
              >
                Open in host editor <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            )}
          </>
        )}
        {tab === 'sources' && (
          <>
            <p className="atlas-inspector-explanation">
              Evidence stays connected to its source revision. A current source does not imply
              business acceptance.
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
        )}
        {tab === 'related' && (
          <>
            <p className="atlas-inspector-explanation">
              Follow a relationship to inspect the next part of the story.
            </p>
            {relationships.map((edge) => {
              const outgoing = edge.source === node.id;
              const related = snapshot.nodes.find(
                (n) => n.id === (outgoing ? edge.target : edge.source),
              );
              return (
                related && (
                  <button
                    className="atlas-related"
                    type="button"
                    key={edge.id}
                    onClick={() => onSelect(related.id)}
                  >
                    <Link2 size={15} aria-hidden="true" />
                    <span>
                      <small>{outgoing ? edge.relation : `incoming ${edge.relation}`}</small>
                      <strong>{related.label}</strong>
                      <small>{edge.evidence} evidence</small>
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                )
              );
            })}
            {!relationships.length && (
              <p className="atlas-empty-inline">No relationships are recorded for this object.</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function JsonBlock({ label, value }: { label: string; value: JsonValue }) {
  return (
    <section className="atlas-inspector-section">
      <h3>{label}</h3>
      <pre>
        <code>{JSON.stringify(value, null, 2)}</code>
      </pre>
    </section>
  );
}
