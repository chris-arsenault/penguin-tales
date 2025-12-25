import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

// Chronicler is an MFE remote for The Canonry shell.
// To use Chronicler, run The Canonry (apps/canonry/webui).

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'chronicler',
      filename: 'remoteEntry.js',
      manifest: true,
      exposes: {
        './ChroniclerRemote': './src/ChroniclerRemote.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }) as PluginOption,
  ],
  // Base path - use /chronicler/ in dev (via proxy) and production
  base: '/chronicler/',
  build: {
    target: 'esnext',
    minify: true,
  },
  server: {
    port: 5007,
    strictPort: true,
  },
});
