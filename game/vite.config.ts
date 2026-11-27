import { defineConfig } from 'vite';

export default defineConfig({
  // relative paths, so the same build works on any preview URL
  base: './',
  build: {
    target: 'es2022',
    // Phaser alone is about 1.2 MB minified; it and the scenes are one cacheable file (game.ts), fetched after the title
    chunkSizeWarningLimit: 1700,
  },
  server: { host: true },
});
