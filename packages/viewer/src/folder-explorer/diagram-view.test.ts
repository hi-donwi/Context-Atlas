import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  clampDiagramZoom,
  diagramCanvasSize,
  diagramDownloadName,
  formatDiagramZoom,
  naturalDiagramWidth,
  zoomInLevel,
  zoomOutLevel,
} from './diagram-view.js';
import { DiagramFrame } from './MermaidDiagram.js';

describe('diagram zoom levels', () => {
  it('steps through the supported levels and stops at both ends', () => {
    expect(zoomInLevel(1)).toBe(1.25);
    expect(zoomOutLevel(1)).toBe(0.75);
    expect(zoomInLevel(4)).toBe(4);
    expect(zoomOutLevel(0.5)).toBe(0.5);
  });

  it('snaps an in-between zoom to the neighbouring level', () => {
    expect(zoomInLevel(1.1)).toBe(1.25);
    expect(zoomOutLevel(1.1)).toBe(1);
  });

  it('clamps invalid and out-of-range values', () => {
    expect(clampDiagramZoom(Number.NaN)).toBe(1);
    expect(clampDiagramZoom(10)).toBe(4);
    expect(clampDiagramZoom(0.1)).toBe(0.5);
    expect(formatDiagramZoom(1.25)).toBe('125%');
  });
});

describe('diagram natural size', () => {
  it('reads the natural width from the SVG viewBox', () => {
    expect(naturalDiagramWidth('<svg id="x" viewBox="-8 -8 412.5 300">')).toBe(412.5);
    expect(naturalDiagramWidth("<svg viewBox='0,0,90,40'>")).toBe(90);
  });

  it('ignores a missing or malformed viewBox', () => {
    expect(naturalDiagramWidth('<svg width="100%">')).toBeUndefined();
    expect(naturalDiagramWidth('<svg viewBox="0 0 -5 10">')).toBeUndefined();
    expect(naturalDiagramWidth('<svg viewBox="0 0 wide 10">')).toBeUndefined();
  });

  it('caps small diagrams at their natural width and scales by zoom', () => {
    expect(diagramCanvasSize(1, 412.5)).toBe('calc(min(100%, 413px) * 1)');
    expect(diagramCanvasSize(2, 300)).toBe('calc(min(100%, 300px) * 2)');
    expect(diagramCanvasSize(1.5, undefined)).toBe('150%');
  });
});

describe('diagram download names', () => {
  it('derives a safe SVG name from the document path', () => {
    expect(diagramDownloadName('guide/03-journeys.md')).toBe('03-journeys-diagram.svg');
    expect(diagramDownloadName('docs/flow chart (v2).mmd')).toBe('flow-chart-v2-diagram.svg');
  });

  it('falls back to a generic name', () => {
    expect(diagramDownloadName()).toBe('diagram.svg');
    expect(diagramDownloadName('...')).toBe('diagram.svg');
  });
});

describe('DiagramFrame', () => {
  it('renders the diagram with labelled zoom, full-screen, copy, and download controls', () => {
    const markup = renderToStaticMarkup(
      createElement(DiagramFrame, {
        svg: '<svg viewBox="0 0 10 10"></svg>',
        source: 'flowchart LR\n  A --> B',
        downloadName: 'guide-diagram.svg',
      }),
    );

    expect(markup).toContain('role="toolbar"');
    for (const label of [
      'Zoom out',
      'Reset zoom',
      'Zoom in',
      'Full screen',
      'Copy diagram source',
      'Download SVG',
    ]) {
      expect(markup).toContain(`aria-label="${label}"`);
    }
    expect(markup).toContain('class="atlas-mermaid__svg"');
    expect(markup).toContain('100%');
  });
});
