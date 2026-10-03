import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
// From vitest/config, not vite: it is the one that accepts the `test` key.
import { defineConfig } from 'vitest/config'

// The backend is called through a dev proxy, so the app uses plain relative
// URLs and never needs to know the API host.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/parse': 'http://127.0.0.1:8000',
      '/score': 'http://127.0.0.1:8000',
      '/quizzes': 'http://127.0.0.1:8000',
      '/check': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
