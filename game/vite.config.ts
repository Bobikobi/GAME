import { defineConfig } from 'vite';

export default defineConfig({
  // relative paths, so the same build works on any preview URL
  base: './',
  build: {
    target: 'es2022',
    // Phaser alone is about 1.2 MB minified; it is one cacheable file
    chunkSizeWarningLimit: 1600,
  },
  server: { host: true },
});
