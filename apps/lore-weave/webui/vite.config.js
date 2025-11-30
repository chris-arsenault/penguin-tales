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
      exposes: {
        './LoreWeaveRemote': './src/LoreWeaveRemote.jsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
  base: process.env.DEPLOY_TARGET === 'aws' ? '/lore-weave/' : '/',
  build: {
    target: 'esnext',
    minify: false,
  },
  worker: {
    // Bundle workers as inline base64 data URLs to avoid CORS issues in MFE context
    format: 'es',
    plugins: () => [react()],
  },
  server: {
    port: 5004,
    strictPort: true,
    cors: {
      origin: '*',
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
});
