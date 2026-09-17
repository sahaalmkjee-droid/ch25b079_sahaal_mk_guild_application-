import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/jobs': 'http://127.0.0.1:8000',
      '/resume': 'http://127.0.0.1:8000',
      '/matches': 'http://127.0.0.1:8000',
      '/agent': 'http://127.0.0.1:8000',
      '/briefing': 'http://127.0.0.1:8000',
      '/analytics': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
      '/database': 'http://127.0.0.1:8000'
    }
  }
})
