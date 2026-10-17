// The home page (docs/team/GRUNT.md, item 5, with the criteria the owner restated on 2026-10-10, DECISIONS.md).
// Run after the site build, which writes web/dist.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The page without the Vercel Web Analytics pair (its queue stub and its loader), the only scripts the home page may carry; a JSON-LD block is data, not script, and is removed too. */
const withoutAnalytics = (page: string): string =>
  page.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '').replace(/<script>\s*window\.va =[\s\S]*?<\/script>/, '').replace('<script defer src="/_vercel/insights/script.js"></script>', '');

const ROOT = join(import.meta.dirname, '../..');
const DIST = join(ROOT, 'web/dist');
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const board = JSON.parse(readFileSync(join(ROOT, 'content/board.json'), 'utf8')) as {
  board: Record<string, { points: number }>;
};

const size = (path: string): number => statSync(join(DIST, path)).size;
const files = (dir: string): string[] => (existsSync(join(DIST, dir)) ? readdirSync(join(DIST, dir)).map((f) => `${dir}/${f}`) : []);

describe('the home page', () => {
  it('has no script but Vercel Web Analytics, and no inline style attribute', () => {
    expect(html).toContain('<script defer src="/_vercel/insights/script.js"></script>');
    expect(withoutAnalytics(html)).not.toContain('<script');
    expect(html).not.toMatch(/\sstyle="/);
  });

  it('opens the classic game at /play/ with the primary button', () => {
    expect(html).toMatch(/<a class="btn primary stretch" href="\/play\/">Play<\/a>/);
  });

  it('shows the 3D door exactly when its loop ships, and always when a 3D build ships', () => {
    const door = html.includes('href="/play3d/"');
    expect(door).toBe(existsSync(join(DIST, 'media/camp-loop.mp4')));
    if (existsSync(join(DIST, 'play3d/index.html'))) expect(door).toBe(true);
  });

  it('puts the builder with the most points first on the board', () => {
    const [first] = Object.entries(board.board).sort((a, b) => b[1].points - a[1].points);
    expect(first).toBeDefined();
    const row = html.match(/<ol class="rows">\s*<li>.*?<\/li>/s)?.[0] ?? '';
    expect(row).toContain(`<b>${first![0]}</b>`);
    expect(html).toContain(`.rows li:nth-child(1) .count { --to: ${first![1].points}; }`);
  });

  it('weighs under 300KB with its stylesheets, faces, scene and loop', () => {
    const css = [...html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)].map((m) => m[1]!.slice(1));
    const faces = [...html.matchAll(/<link rel="preload" href="\/([^"]+\.woff2)"/g)].map((m) => m[1]!);
    const parts = ['index.html', ...css, ...faces, ...files('scene'), ...files('media')];
    const total = parts.reduce((sum, path) => sum + size(path), 0);
    console.log(`home page weight: ${total} bytes in ${parts.length} files`);
    expect(faces).toHaveLength(2);
    expect(files('scene').length).toBeGreaterThan(0);
    expect(total).toBeLessThan(300_000);
  });
});
