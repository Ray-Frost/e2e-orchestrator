import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyConfig = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: apiProxyConfig,
  },
  preview: {
    proxy: apiProxyConfig,
  },
});
