import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, FileText, X } from 'lucide-react';
import { exportContext, type ContextSnapshot } from '@context-atlas/model';
import { downloadText } from './download.js';

export function ExportDialog({
  snapshot,
  nodeId,
  allowedSourceIds,
  onClose,
}: {
  snapshot: ContextSnapshot;
  nodeId: string;
  allowedSourceIds: readonly string[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [neighbors, setNeighbors] = useState(true);
  const [objective, setObjective] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const result = useMemo(() => {
    try {
      return {
        packet: exportContext(snapshot, {
          nodeIds: [nodeId],
          allowedSourceIds,
          depth: neighbors ? 1 : 0,
          maxNodes: 30,
          objective: objective.trim(),
        }),
        error: null,
      };
    } catch (error) {
      return {
        packet: null,
        error: error instanceof Error ? error.message : 'Unable to prepare this context selection.',
      };
    }
  }, [snapshot, nodeId, allowedSourceIds, neighbors, objective]);
  async function copy() {
    if (!result.packet) return;
    try {
      await navigator.clipboard.writeText(result.packet.markdown);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }
  return (
    <dialog
      className="atlas-export-dialog"
      ref={ref}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="atlas-export-title"
    >
      <div className="atlas-dialog-content">
        <div className="atlas-dialog-heading">
          <span className="atlas-kind-icon kind-document">
            <FileText size={22} aria-hidden="true" />
          </span>
          <button className="atlas-icon-button" aria-label="Close export" onClick={onClose}>
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <span className="atlas-eyebrow">FROM UNDERSTANDING TO ACTION</span>
        <h2 id="atlas-export-title">Take the context with you.</h2>
        <p>
          A bounded, source-linked packet for a person or coding agent. Only the selected project is
          included.
        </p>
        <label className="atlas-field-label" htmlFor="atlas-objective">
          Task objective <span>optional</span>
        </label>
        <input
          id="atlas-objective"
          className="atlas-input"
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          placeholder="What should happen next?"
          maxLength={500}
        />
        <label className="atlas-checkbox-label">
          <input
            type="checkbox"
            checked={neighbors}
            onChange={(event) => setNeighbors(event.target.checked)}
          />
          Include directly connected objects and required module references
        </label>
        {result.error && (
          <p className="atlas-error-message" role="alert">
            {result.error}
          </p>
        )}
        {result.packet && (
          <>
            <div className="atlas-packet-summary">
              <span>
                <strong>{result.packet.nodeIds.length}</strong> objects
              </span>
              <span>
                <strong>{result.packet.snapshot.sources.length}</strong> sources
              </span>
              <span>
                <strong>{result.packet.snapshot.edges.length}</strong> connections
              </span>
            </div>
            <pre className="atlas-packet-preview" aria-label="Context packet preview">
              {result.packet.markdown}
            </pre>
            <div className="atlas-dialog-actions">
              <button
                className="atlas-button atlas-button-secondary"
                onClick={() =>
                  downloadText(
                    `${snapshot.project.id}.context.json`,
                    JSON.stringify(result.packet!.snapshot, null, 2),
                    'application/json',
                  )
                }
              >
                <Download size={16} aria-hidden="true" />
                JSON
              </button>
              <button
                className="atlas-button atlas-button-secondary"
                onClick={() =>
                  downloadText(
                    `${snapshot.project.id}.context.md`,
                    result.packet!.markdown,
                    'text/markdown',
                  )
                }
              >
                <Download size={16} aria-hidden="true" />
                Markdown
              </button>
              <button className="atlas-button atlas-button-primary" onClick={() => void copy()}>
                {copyState === 'copied' ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Copy size={16} aria-hidden="true" />
                )}
                {copyState === 'copied' ? 'Copied' : 'Copy context'}
              </button>
            </div>
            {copyState === 'failed' && (
              <p className="atlas-error-message" role="status">
                Clipboard access is unavailable. Download Markdown instead.
              </p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
