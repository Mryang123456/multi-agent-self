import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 契约 multi-tenant-login-api.md:本地开发 proxy /api → api(:3000)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
