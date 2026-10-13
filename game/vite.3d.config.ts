import { cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/**
 * The 3D door's build (`pnpm --filter game build:3d`): the client at game/play3d, shipped as game/dist-3d and then
 * at /play3d/ (tools/src/site/play3d.ts). Its own public folder holds the 3D models; the sprites of the bundle, the
 * font and the icon are the classic game's and are copied in from game/public after the build.
 */
export default defineConfig({
  root: here('./play3d'),
  base: './',
  publicDir: here('./public3d'),
  build: {
    outDir: here('./dist-3d'),
    emptyOutDir: true,
    target: 'es2022',
    // three.js and the client are one cacheable file
    chunkSizeWarningLimit: 1600,
  },
  server: { host: true },
  plugins: [
    {
      name: 'copy-classic-public',
      closeBundle() {
        for (const name of ['kit', 'fonts', 'favicon.png']) cpSync(here(`./public/${name}`), here(`./dist-3d/${name}`), { recursive: true });
      },
    },
  ],
});
