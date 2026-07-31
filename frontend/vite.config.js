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
  test: {
    // jsdom dibutuhkan komponen (render, klik); nav.test.js tidak butuh DOM
    // tapi tetap jalan normal di lingkungan ini.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    // globals: false (default) — ikut konvensi nav.test.js yang eksplisit
    // import { describe, test, expect } dari 'vitest'.
  },
});
