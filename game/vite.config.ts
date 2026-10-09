import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  // relative paths, so the same build works on any preview URL
  base: './',
  build: {
    target: 'es2022',
    // Phaser alone is about 1.2 MB minified; it is one cacheable file
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // the 3D trial of the valley, a page of its own at /3d.html
        valley3d: fileURLToPath(new URL('./3d.html', import.meta.url)),
        // the 3D cell trial, one camp at full finish, at /cell.html
        cell3d: fileURLToPath(new URL('./cell.html', import.meta.url)),
      },
    },
  },
  server: { host: true },
});
