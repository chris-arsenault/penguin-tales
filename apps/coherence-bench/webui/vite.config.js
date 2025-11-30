import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

// Coherence Bench is an MFE remote for The Canonry.
// To use Coherence Bench, run The Canonry (apps/canonry/webui).

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'coherenceBench',
      filename: 'remoteEntry.js',
      exposes: {
        './CoherenceBenchRemote': './src/CoherenceBenchRemote.jsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
  base: process.env.DEPLOY_TARGET === 'aws' ? '/coherence-bench/' : '/',
  build: {
    target: 'esnext',
    minify: false,
  },
  server: {
    port: 5003,
    strictPort: true,
    cors: true,
  },
});
