import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

// Archivist is an MFE remote for The Canonry shell.
// To use Archivist, run The Canonry (apps/canonry/webui).

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'archivist',
      filename: 'remoteEntry.js',
      exposes: {
        './ArchivistRemote': './src/ArchivistRemote.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
  // Base path - use /archivist/ in dev (via proxy) and production
  base: '/archivist/',
  build: {
    target: 'esnext',
    minify: false,
  },
  server: {
    port: 5005,
    strictPort: true,
  },
});
