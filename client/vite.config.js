import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  // itch.io serves the game from a CDN subdirectory, so assets must be relative
  base: mode === 'itch' ? './' : '/',
  plugins: [react()],
  server: {
    proxy: { '/socket.io': { target: 'http://localhost:4560', ws: true } }
  }
}))
