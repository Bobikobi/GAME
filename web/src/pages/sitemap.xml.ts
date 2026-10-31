// The sitemap (docs/team/SEO_GEO.md section 6): every page the site builds, from the same sources the pages use -
// the fixed pages, each guide page, each builder page - plus the game, which lives beside the site at /play/.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { builders } from '../data/boards';

const FIXED = ['/', '/play/', '/hub/', '/hub/boards/', '/hub/rules/', '/hub/tree/', '/api/'];

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://loomvale.vercel.app');
  const guide = (await getCollection('creators')).map((p) => (p.id === 'readme' ? '/docs/' : `/docs/${p.id}/`));
  const paths = [...FIXED, ...guide, ...builders.map((b) => `/hub/creators/${b.handle}/`)];
  const urls = [...new Set(paths)].sort().map((p) => `  <url><loc>${new URL(p, base).href}</loc></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
