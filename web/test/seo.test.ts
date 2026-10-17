// Search and AI-answer visibility (docs/team/SEO_GEO.md, GRUNT CR-108): the built site serves a sitemap and a
// robots file, every page carries a canonical link, Open Graph and parseable structured data, and the file for AI
// readers holds the guide. Run after `pnpm build` (the `site` step of `pnpm verify`).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = join(import.meta.dirname, '../dist');
const read = (path: string): string => readFileSync(join(DIST, path), 'utf8');
const ORIGIN = 'https://theopenfold.vercel.app';

const tag = (html: string, re: RegExp): string | undefined => re.exec(html)?.[1];
const meta = (html: string, key: string): string | undefined =>
  tag(html, new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`));
const blocks = (html: string): Record<string, unknown>[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
const kinds = (html: string): unknown[] => blocks(html).map((b) => b['@type']);

const PAGES: [string, string][] = [
  ['/', 'index.html'],
  ['/hub/', 'hub/index.html'],
  ['/docs/', 'docs/index.html'],
  ['/api/', 'api/index.html'],
  ['/hub/boards/', 'hub/boards/index.html'],
  ['/hub/rules/', 'hub/rules/index.html'],
];

describe('the sitemap and robots', () => {
  const sitemap = read('sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);

  it('is XML that lists the home page, the game, the guide, the developer area and a builder page, with absolute addresses', () => {
    expect(sitemap.startsWith('<?xml')).toBe(true);
    for (const path of ['/', '/play/', '/docs/', '/hub/', '/hub/boards/', '/hub/rules/', '/api/']) expect(locs, path).toContain(`${ORIGIN}${path}`);
    expect(locs.some((l) => l.startsWith(`${ORIGIN}/hub/creators/`))).toBe(true);
    for (const l of locs) expect(l.startsWith('https://')).toBe(true);
  });

  it('lists only pages that were built', () => {
    for (const l of locs) {
      const path = l.slice(ORIGIN.length);
      expect(existsSync(join(DIST, path, 'index.html')), path).toBe(true);
    }
  });

  it('is named by robots.txt, which keeps the write routes out and the rest open', () => {
    const robots = read('robots.txt');
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(robots).toMatch(/User-agent: \*\s+Allow: \//);
    expect(robots).toContain('Disallow: /api/feedback');
    expect(robots).not.toMatch(/Disallow: \/\s*$/m);
  });
});

describe('the head of a page', () => {
  it.each(PAGES)('%s has a canonical link, Open Graph and a card', (path, file) => {
    const html = read(file);
    const title = tag(html, /<title>([^<]*)<\/title>/);
    expect(title).toBeTruthy();
    expect(tag(html, /<link rel="canonical" href="([^"]*)"/)).toBe(`${ORIGIN}${path}`);
    expect(meta(html, 'og:url')).toBe(`${ORIGIN}${path}`);
    expect(meta(html, 'og:title')).toBe(title);
    expect(meta(html, 'og:description')).toBe(tag(html, /<meta name="description" content="([^"]*)"/));
    expect(meta(html, 'og:type')).toBe('website');
    expect(meta(html, 'og:site_name')).toBe('Openfold');
    expect(meta(html, 'twitter:card')).toMatch(/^summary/);
  });

  it('points og:image at a card that exists, or at none', () => {
    for (const [, file] of PAGES) {
      const image = meta(read(file), 'og:image');
      if (image === undefined) continue;
      expect(image.startsWith(`${ORIGIN}/`)).toBe(true);
      expect(existsSync(join(DIST, image.slice(ORIGIN.length))), image).toBe(true);
    }
    const card = join(import.meta.dirname, '../public/og/card.png');
    expect(meta(read('index.html'), 'og:image') !== undefined).toBe(existsSync(card));
  });
});

describe('structured data', () => {
  it('parses on every page, and names the site', () => {
    for (const [, file] of PAGES) expect(kinds(read(file)), file).toContain('WebSite');
  });

  it('describes the game on the home page as a free browser game, with only what the site holds', () => {
    const game = blocks(read('index.html')).find((b) => b['@type'] === 'VideoGame')!;
    expect(game).toBeDefined();
    expect(game['name']).toBe('Openfold');
    expect(game['isAccessibleForFree']).toBe(true);
    expect(game['url']).toBe(`${ORIGIN}/`);
    expect((game['offers'] as { price: string }).price).toBe('0');
    expect(game['playMode']).toBe('SinglePlayer');
    for (const claim of ['aggregateRating', 'review', 'author', 'publisher']) expect(game, claim).not.toHaveProperty(claim);
  });

  it('describes the source code on the developer pages', () => {
    for (const file of ['hub/index.html', 'docs/index.html']) {
      const code = blocks(read(file)).find((b) => b['@type'] === 'SoftwareSourceCode')!;
      expect(code, file).toBeDefined();
      expect(code['codeRepository']).toBe('https://github.com/Bobikobi/GAME');
      expect(code['programmingLanguage']).toBe('TypeScript');
    }
  });
});

describe('the files for AI readers', () => {
  it('llms.txt links the full text, and the full text holds the guide and the roadmap', () => {
    expect(read('llms.txt')).toContain('/llms-full.txt');
    const full = read('llms-full.txt');
    expect(full).toContain('Add a fruit in 10 minutes');
    expect(full).toContain('ROADMAP.md');
    expect(full.length).toBeGreaterThan(20_000);
  });
});
