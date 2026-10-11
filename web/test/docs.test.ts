// The creator guide on the site (docs/team/GRUNT.md, item 13). Run after the site build, which writes web/dist.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const DIST = join(ROOT, 'web/dist');
const html = readFileSync(join(DIST, 'docs/index.html'), 'utf8');
const source = readFileSync(join(ROOT, 'docs/creators/README.md'), 'utf8');

describe('the guide', () => {
  it('is docs/creators/README.md, first heading first', () => {
    const first = source.match(/^# (.+)$/m)?.[1];
    expect(first).toBeDefined();
    expect(html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1]).toBe(first);
  });

  it('gives every heading of the file an id and a contents link', () => {
    const h2 = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]!);
    expect(h2.length).toBe(source.match(/^## /gm)?.length);
    for (const id of h2) expect(html, id).toContain(`href="#${id}"`);
  });

  it('sends no relative link off the site: each is a page here or a file on GitHub', () => {
    const article = html.match(/<article class="prose">(.*?)<\/article>/s)?.[1] ?? '';
    expect(article.match(/href="/g)?.length ?? 0).toBeGreaterThan(0);
    for (const [, href] of article.matchAll(/href="([^"]+)"/g)) {
      if (/^(https?:|mailto:|#)/.test(href!)) continue;
      expect(href, href).toMatch(/^\//);
      const path = href!.split('#')[0]!.replace(/^\//, '');
      expect(existsSync(path.endsWith('/') || path === '' ? join(DIST, path, 'index.html') : join(DIST, path)), href).toBe(true);
    }
  });

  it('shows a placeholder such as <your-handle> as typed', () => {
    expect(html).not.toMatch(/<your-handle/);
    expect(html).toContain('&lt;your-handle&gt;');
  });

  it('is linked from the menu and the developer area', () => {
    expect(readFileSync(join(DIST, 'index.html'), 'utf8')).toContain('href="/docs/"');
    const hub = readFileSync(join(DIST, 'hub/index.html'), 'utf8');
    expect(hub).toContain('href="/docs/"');
    expect(hub).toContain('href="/hub/rules/"');
  });
});
