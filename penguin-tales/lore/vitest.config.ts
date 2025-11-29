import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '__tests__/**/*.test.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@lore-weave/core': path.resolve(__dirname, '../../apps/lore-weave/dist'),
    },
  },
});
