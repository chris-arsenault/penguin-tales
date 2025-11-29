import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { federation } from '@module-federation/vite'
import { resolve } from 'path'

const isStandalone = process.env.STANDALONE === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Only add federation when not in standalone mode
    !isStandalone && federation({
      name: 'nameForge',
      filename: 'remoteEntry.js',
      exposes: {
        './NameForgeRemote': './src/NameForgeRemote.jsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ].filter(Boolean),
  // Base path - only use /name-forge/ when DEPLOY_TARGET=aws is set
  base: process.env.DEPLOY_TARGET === 'aws' ? '/name-forge/' : '/',
  resolve: {
    alias: {
      '@lib': resolve(__dirname, '../lib'),
    },
  },
  optimizeDeps: {
    include: ['seedrandom', 'zod'],
  },
  server: {
    port: isStandalone ? 3000 : 5001,
    strictPort: true,
    cors: true,
  },
  build: {
    target: 'esnext',
    minify: false,
  },
})
