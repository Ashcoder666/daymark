import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    injectRegister: false,
    manifest: {
      name: 'Daymark — Make today count', short_name: 'Daymark',
      description: 'Your private daily plans, routines, and focus workspace.',
      start_url: '/', scope: '/', display: 'standalone',
      background_color: '#101116', theme_color: '#101116',
      icons: [192, 512].map(size => ({src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any'})),
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,ico}'], navigateFallback: '/index.html' },
  })],
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
})
