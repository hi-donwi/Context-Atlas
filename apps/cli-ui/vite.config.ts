import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: [
      {
        find: /^@context-atlas\/viewer\/folder-explorer$/,
        replacement: fileURLToPath(
          new URL('../../packages/viewer/src/FolderExplorer.tsx', import.meta.url),
        ),
      },
      {
        find: /^@context-atlas\/core$/,
        replacement: fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      },
      {
        find: /^@context-atlas\/viewer$/,
        replacement: fileURLToPath(new URL('../../packages/viewer/src/index.ts', import.meta.url)),
      },
    ],
  },
  build: {
    outDir: '../cli/dist/ui',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/atlas/api': 'http://127.0.0.1:4317',
    },
  },
});
