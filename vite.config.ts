import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:8000';
  if (command === 'serve' && ['calvac.in', 'www.calvac.in', 'jjyysdxkoarjlxwttiak.supabase.co'].includes(new URL(target).hostname)
    && env.ALLOW_PRODUCTION_PROXY !== 'true') {
    throw new Error('Production API proxy requires ALLOW_PRODUCTION_PROXY=true. Use a local or preview backend.');
  }
  return {
    plugins: [react(), {
      name: 'local-development-csp', apply: 'serve',
      transformIndexHtml: html => html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/, ''),
    }],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { host: '127.0.0.1', proxy: { '/api': { target, changeOrigin: true } } },
    build: { sourcemap: false, manifest: true },
  };
});
