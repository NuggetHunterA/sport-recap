import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE: Unterpfad beim Hosting, z. B. "/sport-recap/" für GitHub Pages
export default defineConfig({
  base: process.env.BASE ?? '/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sport Recap',
        short_name: 'Recap',
        description: 'Spoilerfreie Bewertung der Spiele von letzter Nacht',
        lang: 'de',
        theme_color: '#07090d',
        background_color: '#07090d',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
});
