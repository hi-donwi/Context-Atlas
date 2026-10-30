import { lazy, Suspense } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import type { ContextSnapshot } from '@context-atlas/model';
import { NodeList } from './NodeList.js';
import { Overview } from './Overview.js';
import type { useExplorer } from './use-explorer.js';

const GraphView = lazy(() =>
  import('./GraphView.js').then((module) => ({ default: module.GraphView })),
);

export function PerspectiveContent({
  snapshot,
  state,
  graphView,
  showOverview,
}: {
  snapshot: ContextSnapshot;
  state: ReturnType<typeof useExplorer>;
  graphView: boolean;
  showOverview: boolean;
}) {
  return (
    <>
      {showOverview ? (
        <Overview snapshot={snapshot} onView={state.onView} onSelect={state.onSelect} />
      ) : state.nodes.length === 0 ? (
        <div className="atlas-empty-state">
          <Search size={28} aria-hidden="true" />
          <h3>No objects in this selection.</h3>
          <p>Try another term or module. The explorer only shows recorded context.</p>
          <button
            className="atlas-button atlas-button-secondary"
            type="button"
            onClick={() => {
              state.setQuery('');
              state.onModule('all');
            }}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <>
          {state.kind === 'journey' && !!state.view?.steps?.length && (
            <ol className="atlas-journey-steps" aria-label="Journey steps">
              {state.view.steps.map((step, index) => (
                <li key={`${step.nodeId}-${index}`}>
                  <button
                    type="button"
                    className={state.selectedNode?.id === step.nodeId ? 'is-active' : ''}
                    onClick={() => state.onSelect(step.nodeId)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{step.label}</strong>
                  </button>
                  {index < state.view!.steps!.length - 1 && (
                    <ArrowRight size={14} aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          )}
          {graphView && state.display === 'graph' ? (
            <Suspense
              fallback={
                <div className="atlas-graph atlas-graph-loading" role="status">
                  Loading the relationship diagram…
                </div>
              }
            >
              <GraphView
                snapshot={snapshot}
                nodes={state.nodes}
                selectedId={state.selectedNode?.id ?? null}
                onSelect={state.onSelect}
              />
            </Suspense>
          ) : (
            <NodeList
              nodes={state.nodes}
              selectedId={state.selectedNode?.id ?? null}
              onSelect={state.onSelect}
            />
          )}
          <div className="atlas-view-footer">
            <span>{state.nodes.length} objects in this perspective</span>
            {graphView && (
              <button
                className="atlas-text-button"
                type="button"
                onClick={() => state.setDisplay(state.display === 'graph' ? 'list' : 'graph')}
              >
                {state.display === 'graph' ? 'View as accessible list' : 'Return to graph'}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
