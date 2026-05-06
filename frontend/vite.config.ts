import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist', // Output to frontend/dist for NestJS assets
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3001, // Dev server port (not used in production)
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Proxy to NestJS backend
        changeOrigin: true,
      },
    },
  },
});