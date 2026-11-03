import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import '@context-atlas/viewer/folder-explorer.css';

const root = document.getElementById('root');
if (root === null) throw new Error('The explorer root element is missing.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
