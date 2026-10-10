// @ts-check
// The site (docs/team/GRUNT.md, item 4): static pages, every URL a folder with a trailing slash.
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  // the pages read repository files at build time: the token sheet, the board, the points, the hub-data fixture
  vite: { server: { fs: { allow: ['..'] } } },
});
