import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
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
    // The only large chunk is the deliberately lazy-loaded MapLibre renderer
    // (about 256 kB compressed); keep the default warning meaningful for every
    // other route while recognizing this audited WebGL boundary.
    chunkSizeWarningLimit: 1000,
  },
})
