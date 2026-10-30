import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: [
      {
        find: /^@context-atlas\/model$/,
        replacement: fileURLToPath(new URL('../../packages/model/src/index.ts', import.meta.url)),
      },
      {
        find: /^@context-atlas\/viewer$/,
        replacement: fileURLToPath(new URL('../../packages/viewer/src/index.ts', import.meta.url)),
      },
      {
        find: /^@context-atlas\/adapter-openapi$/,
        replacement: fileURLToPath(
          new URL('../../packages/adapter-openapi/src/index.ts', import.meta.url),
        ),
      },
    ],
  },
});
