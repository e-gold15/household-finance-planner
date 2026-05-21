import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Only list assets that actually exist in public/ — missing files cause SW install failures
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon.svg'],
      manifest: {
        name: 'Household Finance Planner',
        short_name: 'Finance',
        description: 'Track household income, expenses, savings and goals',
        theme_color: '#25a27a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        // No lang/dir hardcoded — app is bilingual (EN + HE), let the OS choose
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Cache app shell and static assets (cache-first)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Never cache API calls — always go to network
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/api\.frankfurter\.app\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
