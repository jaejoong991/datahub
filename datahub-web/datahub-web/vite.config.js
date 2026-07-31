import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Saat VITE_API_MODE=http, request /api diteruskan ke backend.
      '/api': { target: process.env.API_TARGET || 'http://localhost:3000', changeOrigin: true },
    },
  },
});
