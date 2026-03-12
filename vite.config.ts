import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/v1': {
        target: process.env.BRAIN_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
