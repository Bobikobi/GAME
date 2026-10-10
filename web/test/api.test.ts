// The API folder and llms.txt (docs/team/GRUNT.md, item 8). Run after the site build, which writes web/dist.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const DIST = join(ROOT, 'web/dist');
const api = readFileSync(join(DIST, 'api/index.html'), 'utf8');
const llms = readFileSync(join(DIST, 'llms.txt'), 'utf8');
const schemas = readdirSync(join(ROOT, 'schema/json')).filter((f) => f.endsWith('.schema.json'));

/** The file a site path is served from: /hub/ is hub/index.html, /llms.txt is itself; the #part is the page's. */
const servedFrom = (href: string): string => {
  const path = href.split('#')[0]!.replace(/^\//, '');
  return path === '' || path.endsWith('/') ? join(DIST, path, 'index.html') : join(DIST, path);
};

describe('the API folder', () => {
  it('lists every schema with its $id', () => {
    expect(schemas.length).toBeGreaterThan(0);
    for (const file of schemas) {
      const { $id } = JSON.parse(readFileSync(join(ROOT, 'schema/json', file), 'utf8')) as { $id: string };
      expect(api).toContain(`href="/api/schema/${file}"`);
      expect(api).toContain($id);
    }
  });

  it('publishes each schema as it is in the repository', () => {
    for (const file of schemas) {
      expect(readFileSync(join(DIST, 'api/schema', file), 'utf8')).toBe(readFileSync(join(ROOT, 'schema/json', file), 'utf8'));
    }
  });

  it('links only to files the site serves, or to GitHub', () => {
    const main = api.match(/<main.*?<\/main>/s)?.[0] ?? '';
    const hrefs = [...main.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(schemas.length - 1);
    for (const href of hrefs) {
      if (href.startsWith('https://github.com/')) continue;
      if (href.startsWith('#')) continue;
      expect(existsSync(servedFrom(href)), href).toBe(true);
    }
  });
});

describe('llms.txt', () => {
  it('starts with the product name and lists the hub-data document', () => {
    expect(llms.startsWith('# Openfold\n')).toBe(true);
    expect(llms).toContain('(/api/hub-data.json)');
  });

  it('has the five sections, and each site link but the data document resolves', () => {
    for (const section of ['Guide', 'Schemas', 'Data', 'MCP', 'Rules']) expect(llms).toContain(`\n## ${section}\n`);
    const site = [...llms.matchAll(/\]\((\/[^)]*)\)/g)].map((m) => m[1]!);
    // hub-data.json is written by the data build (item 3), which the site build does not run yet
    for (const href of site.filter((h) => h !== '/api/hub-data.json')) expect(existsSync(servedFrom(href)), href).toBe(true);
  });
});
