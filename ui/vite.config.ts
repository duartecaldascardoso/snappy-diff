import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  // `npm run dev` talks to a running `snappy-diff --no-open`.
  server: { proxy: { '/api': 'http://localhost:4747' } },
  worker: { format: 'es' },
  build: { target: 'es2023', chunkSizeWarningLimit: 2000 },
})
