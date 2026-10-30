import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@context-atlas/model': fileURLToPath(new URL('../../packages/model/src/index.ts', import.meta.url)),
      '@context-atlas/viewer': fileURLToPath(new URL('../../packages/viewer/src/index.ts', import.meta.url)),
      '@context-atlas/adapter-openapi': fileURLToPath(new URL('../../packages/adapter-openapi/src/index.ts', import.meta.url)),
    },
  },
});
