import { ArrowUpRight } from 'lucide-react';
import type { ContextNode, ExplorerHost, JsonValue } from '@context-atlas/model';

export function InspectorDetails({
  node,
  sourceCount,
  relationshipCount,
  host,
}: {
  node: ContextNode;
  sourceCount: number;
  relationshipCount: number;
  host: ExplorerHost;
}) {
  return (
    <>
      {node.details?.endpoint && (
        <>
          <section className="atlas-inspector-section">
            <h3>API contract</h3>
            <div className="atlas-endpoint">
              <span className={`atlas-method method-${node.details.endpoint.method.toLowerCase()}`}>
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
          <dd>{sourceCount}</dd>
          <dt>Connections</dt>
          <dd>{relationshipCount}</dd>
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
