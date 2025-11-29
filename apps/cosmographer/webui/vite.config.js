import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

const isStandalone = process.env.STANDALONE === 'true';

export default defineConfig({
  plugins: [
    react(),
    // Only add federation when not in standalone mode
    !isStandalone && federation({
      name: 'cosmographer',
      filename: 'remoteEntry.js',
      exposes: {
        './CosmographerRemote': './src/CosmographerRemote.jsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ].filter(Boolean),
  base: process.env.DEPLOY_TARGET === 'aws' ? '/cosmographer/' : '/',
  build: {
    target: 'esnext',
    minify: false,
  },
  server: {
    port: isStandalone ? 3001 : 5002,
    strictPort: true,
    cors: true,
  },
});
