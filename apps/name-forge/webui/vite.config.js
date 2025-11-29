import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
})
