import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        'permission-denied': 'src/react/permission-denied/index.html',
        'recording': 'src/react/recording/index.html'
      }
    }
  },
  server: {
    port: 3000
  }
})