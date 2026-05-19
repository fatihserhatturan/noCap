import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_NOCAP_API_URL || 'http://localhost:5757';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8765,
    strictPort: true,
    proxy: {
      '/api': apiTarget,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
