import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward /api requests to the backend during local development,
      // so the frontend can call fetch('/api/...') without CORS issues.
      '/api': 'http://localhost:3002',
    },
  },
});
