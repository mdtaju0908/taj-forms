import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.VITE_BASE_PATH || '/forms/'
const apiOrigin = process.env.VITE_API_ORIGIN || 'http://localhost:5010'

export default defineConfig({
  base: base.endsWith('/') ? base : `${base}/`,
  plugins: [react()],
  server: { port: 5174, strictPort: true, proxy: { '/forms/v1': { target: apiOrigin, changeOrigin: true } } },
  // Icon barrel maps can be large; let Vite serve only the icons the app imports.
  optimizeDeps: { exclude: ['lucide-react'] },
  build: { sourcemap: false },
})
