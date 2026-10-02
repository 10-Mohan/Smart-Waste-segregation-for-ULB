import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.npm_lifecycle_event === 'dev:https' ? [basicSsl()] : []),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});