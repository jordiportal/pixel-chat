import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html'),
      },
    },
  },
  optimizeDeps: {
    include: ['sql.js'],
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
