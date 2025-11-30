import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'canonry',
      remotes: {
        // These will be loaded dynamically when the apps are running
        // In development, each remote runs on its own port
        nameForge: {
          type: 'module',
          name: 'nameForge',
          entry: 'http://localhost:5001/remoteEntry.js',
          entryGlobalName: 'nameForge',
        },
        cosmographer: {
          type: 'module',
          name: 'cosmographer',
          entry: 'http://localhost:5002/remoteEntry.js',
          entryGlobalName: 'cosmographer',
        },
        coherenceEngine: {
          type: 'module',
          name: 'coherenceEngine',
          entry: 'http://localhost:5003/remoteEntry.js',
          entryGlobalName: 'coherenceEngine',
        },
        loreWeave: {
          type: 'module',
          name: 'loreWeave',
          entry: 'http://localhost:5004/remoteEntry.js',
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
