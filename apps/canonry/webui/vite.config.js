import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'canonry',
      remotes: {
        // Remotes are loaded via path prefixes through the dev proxy (localhost:3000)
        // This avoids CORS issues by keeping everything on the same origin
        nameForge: {
          type: 'module',
          name: 'nameForge',
          entry: '/name-forge/remoteEntry.js',
          entryGlobalName: 'nameForge',
        },
        cosmographer: {
          type: 'module',
          name: 'cosmographer',
          entry: '/cosmographer/remoteEntry.js',
          entryGlobalName: 'cosmographer',
        },
        coherenceEngine: {
          type: 'module',
          name: 'coherenceEngine',
          entry: '/coherence-engine/remoteEntry.js',
          entryGlobalName: 'coherenceEngine',
        },
        loreWeave: {
          type: 'module',
          name: 'loreWeave',
          entry: '/lore-weave/remoteEntry.js',
          entryGlobalName: 'loreWeave',
        },
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
  },
  server: {
    port: 5000,
    strictPort: true,
  },
});
