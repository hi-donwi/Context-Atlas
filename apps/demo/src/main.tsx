import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@context-atlas/viewer/styles.css';
import './reset.css';
import { App, AppErrorBoundary } from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
