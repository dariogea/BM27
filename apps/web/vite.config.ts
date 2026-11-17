import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Version of the desktop app (the one published in Releases), shown by the launcher. */
const appVersion = (
  JSON.parse(readFileSync(new URL('../desktop/package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [react()],
  worker: { format: 'es' },
  // Pre-bundle zod up front so the first page load does not trigger a reload.
  optimizeDeps: { include: ['zod'] },
  server: { port: 5173 },
});
