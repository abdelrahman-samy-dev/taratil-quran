import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Same URL as the legacy worker so existing installs pick up the new one.
      injectRegister: false,
      registerType: 'prompt',
      manifest: false, // public/manifest.webmanifest is hand-written
      injectManifest: {
        globPatterns: [
          '**/*.{js,css,html,svg,webmanifest}',
          'icons/*.png',
          'fonts/*.woff2',
          'assets/cairo-arabic-*.woff2',
          'assets/cairo-latin-wght-*.woff2',
          'assets/amiri-arabic-*.woff2',
        ],
        globIgnores: ['data/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
});
