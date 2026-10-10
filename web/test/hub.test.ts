// The developer area (docs/team/GRUNT.md, item 7). Run after the site build, which writes web/dist.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_PALETTE } from '../../tools/src/kit/palette';

const ROOT = join(import.meta.dirname, '../..');
const DIST = join(ROOT, 'web/dist');
const html = readFileSync(join(DIST, 'hub/index.html'), 'utf8');

/** The file a site path is served from: /hub/ is hub/index.html, /llms.txt is itself; the #part is the page's. */
const servedFrom = (href: string): string => {
  const path = href.split('#')[0]!.replace(/^\//, '');
  return path === '' || path.endsWith('/') ? join(DIST, path, 'index.html') : join(DIST, path);
};

describe('the developer area', () => {
  it('has one button, the copy button, and no form', () => {
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*data-copy="prompt"/);
    expect(html).not.toContain('<form');
  });

  it('renders the prompt without JavaScript, naming llms.txt and the pnpm check', () => {
    const pre = html.match(/<pre class="code" id="prompt">(.*?)<\/pre>/s)?.[1] ?? '';
    expect(pre).toContain('llms.txt');
    expect(pre).toContain('content/extensions/');
    expect(pre).toContain('pnpm check');
  });

  it('sends every Start here link to a page of the site or to GitHub', () => {
    const start = html.match(/<section class="start".*?<\/section>/s)?.[0] ?? '';
    const hrefs = [...start.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      if (href.startsWith('https://github.com/')) continue;
      expect(href, href).toMatch(/^\//);
      expect(existsSync(servedFrom(href)), href).toBe(true);
    }
  });

  it('draws the core palette, one swatch a colour', () => {
    const swatches = html.match(/<ul class="swatches".*?<\/ul>/s)?.[0] ?? '';
    expect(swatches.match(/<li/g)).toHaveLength(CORE_PALETTE.length);
    for (const hex of CORE_PALETTE) expect(html).toContain(`background: ${hex};`);
  });
});
