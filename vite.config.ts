import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/VerseCloud/' : '/',
  plugins: [react()],
  optimizeDeps: {
    // MapLibre creates its worker with import.meta.url. Keeping the package as
    // native ESM preserves the worker file instead of pointing at a missing
    // Vite prebundle sibling.
    exclude: ['maplibre-gl'],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
})
