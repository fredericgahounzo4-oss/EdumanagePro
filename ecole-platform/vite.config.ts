import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        name: 'EduManage Pro — Gestion Scolaire',
        short_name: 'EduManage Pro',
        description: 'Plateforme de gestion scolaire — notes, bulletins, paiements, emploi du temps.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#f4f6f9',
        theme_color: '#1a3a5c',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Ne met en cache que les fichiers de l'appli elle-même (JS/CSS/HTML/icônes) —
        // jamais les appels à l'API Django, pour ne jamais servir de données obsolètes/hors-ligne
        // à l'insu de l'utilisateur (notes, paiements...). L'appli nécessite donc une connexion
        // pour fonctionner ; seul le chargement de la coquille de l'appli est accéléré/mis en cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
