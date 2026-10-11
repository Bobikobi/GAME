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

  it('shows the one line that adds the MCP server, and the repository registers it', () => {
    expect(html.match(/claude mcp add openfold -- pnpm -s mcp/g)).toHaveLength(1);
    for (const file of ['.mcp.json', '.cursor/mcp.json']) {
      const config = JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as { mcpServers: Record<string, { command: string; args: string[] }> };
      expect(config.mcpServers['openfold'], file).toEqual({ command: 'pnpm', args: ['-s', 'mcp'] });
    }
  });
});

describe('the coming-soon boxes', () => {
  for (const [page, file] of [['hub', 'hub/index.html'], ['home', 'index.html']] as const) {
    it(`show Your card, Levels and Badges on the ${page} with no digit inside`, () => {
      const text = readFileSync(join(DIST, file), 'utf8');
      const boxes = text.match(/<ul class="soon-boxes".*?<\/ul>/s)?.[0] ?? '';
      expect(boxes.match(/class="soon-box"/g)).toHaveLength(3);
      for (const name of ['Your card', 'Levels', 'Badges']) expect(boxes).toContain(name);
      expect(boxes.replace(/<[^>]*>/g, '')).not.toMatch(/\d/);
    });
  }

  it('the home page has the 3D door when a 3D build exists, and never links to a missing page', () => {
    const home = readFileSync(join(DIST, 'index.html'), 'utf8');
    expect(home.includes('href="/play3d/"')).toBe(existsSync(join(DIST, 'play3d/index.html')));
  });
});
