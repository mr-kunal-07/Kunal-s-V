import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    includeAssets: ['vault.svg', 'icons/*.png'],
    manifest: {
      id: '/', name: 'Kunal’s Vault', short_name: 'Keep', description: 'Your notes, daily tasks, and personal memories.',
      start_url: '/dashboard', scope: '/', display: 'standalone', background_color: '#f2ece3', theme_color: '#a8442e',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Day Book', url: '/day-book', description: 'Open your daily tasks' },
        { name: 'My memories', url: '/dashboard', description: 'Open your personal archive' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,woff,woff2,png,svg,ico,webmanifest}'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      navigateFallbackDenylist: [/^\/__\//, /^\/api\//],
      cleanupOutdatedCaches: true,
    },
  })],
  server: { host: '127.0.0.1' },
})
