import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@context-atlas/core': fileURLToPath(
        new URL('./packages/core/src/index.ts', import.meta.url),
      ),
      '@context-atlas/source-node': fileURLToPath(
        new URL('./packages/source-node/src/index.ts', import.meta.url),
      ),
      '@context-atlas/model': fileURLToPath(
        new URL('./packages/model/src/index.ts', import.meta.url),
      ),
      '@context-atlas/adapter-openapi': fileURLToPath(
        new URL('./packages/adapter-openapi/src/index.ts', import.meta.url),
      ),
    },
  },
  test: { include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'] },
});
