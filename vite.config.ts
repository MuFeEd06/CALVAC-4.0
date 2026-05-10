import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    proxy: {
      '/api': {
        target: 'https://calvac.in',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: { 'calvac.in': 'localhost' },
        headers: {
          'X-Forwarded-Host': 'localhost:5173',
          'Origin': 'https://calvac.in',
        },
      },
    },
  },
  build: {
    // Content-hash filenames → safe to serve with Cache-Control: immutable
    rollupOptions: {
      output: {
        // Put all assets in /assets/ so the vercel.json rule catches them all
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        manualChunks: {
          'react-vendor':  ['react', 'react-dom', 'react-router-dom'],
          'motion-vendor': ['framer-motion'],
          'admin-bundle':  [
            './src/pages/admin/AdminDashboardPage',
            './src/pages/admin/AdminProductsPage',
            './src/pages/admin/AdminSettingsPage',
            './src/pages/admin/AdminLoginPage',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
    // Generate source maps only in dev
    sourcemap: false,
  },
})
