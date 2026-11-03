/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages serves the app under /<repo>/; the workflow sets BASE_PATH.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'Security+ Pocket · SY0-701',
        short_name: 'Sec+ Pocket',
        description: 'Estudia CompTIA Security+ SY0-701 offline.',
        lang: 'es',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0d0f12',
        theme_color: '#0b6bcb',
        start_url: '.',
        scope: '.',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,json}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: { chunkSizeWarningLimit: 1200 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
