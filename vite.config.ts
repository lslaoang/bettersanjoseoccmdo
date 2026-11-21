import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.md'],
  // Dev only: the live site reaches the API through CloudFront at /api/*.
  server: {
    proxy: {
      '/api': {
        target: 'https://omr8yma31f.execute-api.ap-southeast-1.amazonaws.com',
        changeOrigin: true,
      },
    },
  },
});
