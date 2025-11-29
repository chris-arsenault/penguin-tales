import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.DEPLOY_TARGET === 'aws' ? '/cosmographer/' : '/',
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 5174
  }
});
