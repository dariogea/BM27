import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // Pre-bundle zod up front so the first page load does not trigger a reload.
  optimizeDeps: { include: ['zod'] },
  server: { port: 5173 },
});
