import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const DEPLOYED_BACKEND_URL = 'https://your-backend-url.com'; // TODO: replace with your deployed backend URL

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production' ? DEPLOYED_BACKEND_URL : 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
