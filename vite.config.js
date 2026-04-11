import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 1001,
    host: true,
    hmr: false, // prevents mobile refresh loop from WebSocket reconnects
  },
})
