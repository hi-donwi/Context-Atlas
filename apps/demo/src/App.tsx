import { Component, useState, type ReactNode } from 'react';
import type { ContextSnapshot } from '@context-atlas/model';
import { ContextExplorer } from '@context-atlas/viewer';
import { demoProjects } from './fixtures/index.js';
import { MAX_IMPORT_BYTES, parseProjectText } from './import-project.js';

export function App() {
  const requested = new URLSearchParams(window.location.search).get('project');
  const [projects, setProjects] = useState<ContextSnapshot[]>(demoProjects);
  const [projectId, setProjectId] = useState(() =>
    demoProjects.some((p) => p.project.id === requested) ? requested! : demoProjects[0]!.project.id,
  );
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const snapshot = projects.find((project) => project.project.id === projectId) ?? projects[0]!;

  async function importFile(file: File) {
    setImporting(true);
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose a file smaller than 5 MB.');
      const imported = parseProjectText(await file.text(), file.name);
      setProjects((previous) => [
        ...previous.filter((project) => project.project.id !== imported.project.id),
        imported,
      ]);
      setProjectId(imported.project.id);
      setNotice({
        tone: 'success',
        message: `${imported.project.name} is ready. Imported data stays in this browser tab; reimport after a reload.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to read this file. Try another JSON document.',
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <ContextExplorer
      snapshot={snapshot}
      projects={projects.map((project) => project.project)}
      onProjectChange={(id) => {
        setProjectId(id);
        setNotice(null);
      }}
      onImport={importFile}
      importing={importing}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
    />
  );
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="app-error">
          <h1>Unable to display this project.</h1>
          <p>Reload to restore the synthetic demo. Imported files remain on your device.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload the demo
          </button>
        </main>
      );
    return this.props.children;
  }
}
