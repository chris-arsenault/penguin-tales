import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { resolve } from 'path';

// Lore Weave is an MFE remote for The Canonry shell.
// To use Lore Weave, run The Canonry (apps/canonry/webui).

export default defineConfig({
  resolve: {
    alias: {
      '@lib': resolve(__dirname, '../lib'),
    },
  },
  plugins: [
    react(),
    federation({
      name: 'loreWeave',
      filename: 'remoteEntry.js',
      manifest: true,
      exposes: {
        './LoreWeaveRemote': './src/LoreWeaveRemote.jsx',
        './SimulationTraceVisx': './src/components/dashboard/trace/SimulationTraceVisx.jsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
  // Base path - use /lore-weave/ in dev (via proxy) and production
  base: '/lore-weave/',
  build: {
    target: 'esnext',
    minify: false,
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5004,
    strictPort: true,
  },
});
