import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, "/api" is forwarded to the backend. In production set
// VITE_API_BASE_URL to the backend's public URL (see frontend/.env.example).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': process.env.VITE_DEV_API_TARGET || 'http://localhost:4000' },
  },
})
