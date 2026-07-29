import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 测试配置:jsdom + @testing-library。独立于 vite.config.ts,不污染 app 构建。
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
    clearMocks: true,
  },
});
