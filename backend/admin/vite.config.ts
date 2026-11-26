import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Served by the backend under /admin once built, as Medusa serves its admin. /admin is also the
 * team's API: a page asked by the browser (Accept: text/html) gets the dashboard, a JSON call the API.
 * In development, the API calls go to the backend through the proxy.
 */
const backend = process.env.TRAIKU_BACKEND_URL ?? 'http://localhost:9000';
const api = { target: backend, bypass: (req: { headers: { accept?: string } }) => (req.headers.accept?.includes('text/html') ? '/admin/index.html' : undefined) };

export default defineConfig({
  base: '/admin/',
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  plugins: [react()],
  server: { port: 5173, proxy: { '^/admin/(?!@|src/|node_modules/|assets/).+': api, '/auth': backend, '/files': backend } },
  build: { outDir: 'dist', emptyOutDir: true },
});
