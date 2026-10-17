// @ts-check
// The site (docs/team/GRUNT.md, item 4): static pages, every URL a folder with a trailing slash.
import process from 'node:process';
import vercel from '@astrojs/vercel';
import { defineConfig } from 'astro/config';

// the production address, when Vercel builds the site; the AI prompt on /hub/ names llms.txt by it, and a page's canonical link and the sitemap use it (docs/team/SEO_GEO.md)
const host = process.env['VERCEL_PROJECT_PRODUCTION_URL'];

export default defineConfig({
  // canonical links, Open Graph addresses and the sitemap need an address even off Vercel: the production one
  site: host ? `https://${host}` : 'https://theopenfold.vercel.app',
  output: 'static',
  // the four /api/s1/ routes opt out of prerendering; every other page stays a file (GRUNT item 17)
  adapter: vercel(),
  trailingSlash: 'always',
  build: { format: 'directory', client: './', server: '../.vercel/server' },
  devToolbar: { enabled: false },
  // the pages read repository files at build time: the token sheet, the board, the points, the hub-data fixture
  // @upstash/redis is bundled into the function: left external, its own dependency (uncrypto) is not traced into the deployment and the /api/s1/ routes fail with a 500
  vite: { server: { fs: { allow: ['..'] } }, ssr: { noExternal: ['@upstash/redis'] } },
});
