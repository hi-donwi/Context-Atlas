import { useMemo } from 'react';
import { FolderExplorer } from '@context-atlas/viewer/folder-explorer';
import { createApiContentSource } from './api-content-source.js';

export function App() {
  const source = useMemo(() => createApiContentSource(), []);
  return <FolderExplorer source={source} />;
}
