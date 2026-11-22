// The developers' home (#727, stage 1). Run after the site build, which writes web/dist.
// Bars: F3 (scripts and origins), F4 (contrast of both versions, the choice kept), and what the page prints is what the data says.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { HubData } from '@game/schema/hub';
import fixture from '../../schema/test/fixtures/hub-data.json';

const ROOT = join(import.meta.dirname, '../..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const html = read('web/dist/developers/index.html');
const css = read('web/src/styles/dev.css');
const tokens = read('design/tokens.css');
const builtData = join(ROOT, 'web/public/api/hub-data.json');
const hub = (existsSync(builtData) ? JSON.parse(readFileSync(builtData, 'utf8')) : fixture) as HubData;

// ---------------------------------------------------------------- contrast

const hex = Object.fromEntries([...tokens.matchAll(/--([a-z0-9]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1]!, m[2]!]));
const channel = (v: number): number => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const luminance = (c: string): number => 0.2126 * channel(parseInt(c.slice(1, 3), 16)) + 0.7152 * channel(parseInt(c.slice(3, 5), 16)) + 0.0722 * channel(parseInt(c.slice(5, 7), 16));
export const ratio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

/** The roles a theme block sets, resolved to palette hex: `--bg: var(--paper)` becomes the paper's hex. */
function roles(marker: string): Record<string, string> {
  const block = css.slice(css.indexOf(`/* THEME:${marker}`)).match(/\{([^}]*)\}/)![1]!;
  return Object.fromEntries([...block.matchAll(/--([a-z0-9]+):\s*var\(--([a-z0-9]+)\)/g)].map((m) => [m[1]!, hex[m[2]!]!]));
}
const THEMES = { day: roles('day'), night: roles('night') };
/** Text roles read on the ground; the chips and the label read ink on their own pale fill in both versions. */
const TEXT = ['fg', 'fg2', 'muted', 'alert'] as const;
const CHIPS = ['paper2', 'yellow', 'sky'] as const;

describe('contrast, day and night (F4)', () => {
  const rows = Object.entries(THEMES).flatMap(([theme, r]) => [
    ...TEXT.map((role) => ({ theme, pair: `${role} on bg`, ratio: ratio(r[role]!, r['bg']!), need: 4.5 })),
    ...CHIPS.map((fill) => ({ theme, pair: `ink on ${fill}`, ratio: ratio(hex['ink']!, hex[fill]!), need: 4.5 })),
    { theme, pair: 'accent (the meter bar) on bg', ratio: ratio(r['accent']!, r['bg']!), need: 3 },
    { theme, pair: 'fg (the control line) on bg', ratio: ratio(r['fg']!, r['bg']!), need: 3 },
    { theme, pair: 'line (the bar track) on bg', ratio: ratio(r['line']!, r['bg']!), need: 1 },
  ]);

  it('resolves every role of both versions to a palette colour', () => {
    for (const [theme, r] of Object.entries(THEMES)) for (const role of ['bg', 'fg', 'fg2', 'muted', 'line', 'accent', 'alert']) expect(r[role], `${theme} ${role}`).toMatch(/^#[0-9a-f]{6}$/);
  });
  it.each(rows)('$theme: $pair passes ($need)', ({ ratio: r, need }) => {
    expect(r).toBeGreaterThanOrEqual(need);
  });
  it('is the same night in the block a browser asking for dark gets without the script', () => {
    const asked = css.slice(css.indexOf('@media (prefers-color-scheme: dark)')).match(/:root:not\(\[data-theme\]\)\s*\{([^}]*)\}/)![1]!;
    const resolved = Object.fromEntries([...asked.matchAll(/--([a-z0-9]+):\s*var\(--([a-z0-9]+)\)/g)].map((m) => [m[1]!, hex[m[2]!]!]));
    expect(resolved).toEqual(THEMES.night);
  });
  it('reports the lowest ratios', () => {
    for (const theme of ['day', 'night']) {
      const text = rows.filter((r) => r.theme === theme && r.need === 4.5);
      const lowest = text.reduce((a, b) => (b.ratio < a.ratio ? b : a));
      console.log(`lowest text ratio, ${theme}: ${lowest.ratio.toFixed(2)} (${lowest.pair})`);
    }
  });
});

describe('the choice of version', () => {
  it('is read before the page paints, kept on the reader\'s device, and falls back to the browser\'s own preference', () => {
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!).find((s) => s.includes('loomvale-dev-theme'))!;
    expect(script).toBeDefined();
    expect(html.indexOf(script)).toBeLessThan(html.indexOf('<body'));
    expect(script).toContain("localStorage.getItem(key)");
    expect(script).toContain("localStorage.setItem(key, theme)");
    expect(script.match(/try \{/g)).toHaveLength(2);
    expect(script).toContain('prefers-color-scheme: dark');
  });
  it('shows the control only when the script can work it, and as a toggle', () => {
    expect(html).toMatch(/<button[^>]*id="theme"[^>]*aria-pressed="false"[^>]*hidden/);
  });
});

// ---------------------------------------------------------------- F3: what loads

describe('what the page loads (F3)', () => {
  it('has the Web Analytics pair and one small script, nothing else', () => {
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts).toEqual(['<script>', '<script defer src="/_vercel/insights/script.js">', '<script>']);
  });
  it('fetches nothing from another origin: no external script, style, font, image or import', () => {
    // the canonical link names this page, it loads nothing
    const loaded = [...html.matchAll(/<(?:script|link|img|source|iframe)\b(?![^>]*rel="canonical")[^>]*\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]!);
    expect(loaded.length).toBeGreaterThan(3);
    for (const url of loaded) expect(url, url).toMatch(/^\/(?!\/)|^#|^\.\//);
    expect(html).not.toMatch(/<(?:img|iframe|video|audio|source)\b/);
    expect(css).not.toMatch(/url\(\s*['"]?(?:https?:)?\/\//);
    expect(css).not.toMatch(/@import\s+(?:url\()?['"]?https?:/);
  });
  it('has no style attribute', () => {
    expect(html).not.toMatch(/\sstyle="/);
  });
  it('leaves the site\'s home page as it was: the analytics pair and the desktop key-art loader only', () => {
    const home = read('web/dist/index.html');
    const own = home.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '').replace(/<script>\s*window\.va =[\s\S]*?<\/script>/, '').replace('<script defer src="/_vercel/insights/script.js"></script>', '');
    expect((own.match(/<script\b[^>]*>/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(home).not.toContain('/developers/');
  });
  it('is linked from the developer area, which the game never links to', () => {
    expect(read('web/dist/hub/index.html')).toContain('href="/developers/"');
  });
});

// ---------------------------------------------------------------- what the page says

describe('what the page prints is what the data says', () => {
  const text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  it('prints the meter from the data file, and no page file carries the numbers', () => {
    const world = JSON.parse(read('.github/dev-area.json')).world as { drawn: number; whole: number; next: string };
    expect(hub.world).toBeDefined();
    const w = hub.world!;
    expect(text).toContain(`<b>${w.drawn.toLocaleString('en-US')}</b>`);
    expect(text).toContain(`<b>${w.whole.toLocaleString('en-US')}</b>`);
    expect(text).toContain(w.next);
    if (existsSync(builtData)) expect([w.drawn, w.whole]).toEqual([world.drawn, world.whole]);
    for (const file of ['web/src/pages/developers/index.astro', 'web/src/layouts/Dev.astro', 'web/src/data/dev.ts']) expect(read(file), file).not.toMatch(/2,?280/);
  });
  it('lists every open pull request of the data once, with its link and its maker', () => {
    expect(hub.feed!.length).toBeGreaterThan(0);
    for (const item of hub.feed!) {
      expect(text.split(`href="${item.url}"`).length - 1, `#${item.number}`).toBe(1);
      expect(text).toContain(`PR #${item.number}`);
    }
    const team = hub.feed!.filter((i) => i.maker === 'team').length;
    expect(text.split('Development team').length - 1).toBe(team);
    for (const item of hub.feed!.filter((i) => i.maker === 'person')) expect(text).toContain(`<b>${item.author}</b>`);
  });
  it('has no agent mark, no money, no ranks and no tab for a page that does not exist', () => {
    expect(text.toLowerCase()).not.toMatch(/\bagent\b|\$|€|rank|leaderboard|<nav aria-label="Developer area"/);
    expect(text).not.toMatch(/Tasks|Points|Ideas/);
  });
  it('names the file of every gap it shows, and links it', () => {
    for (const g of hub.gaps ?? []) {
      expect(text).toContain(`<code>${g.id}</code>`);
      expect(text).toContain(`href="${g.url}"`);
    }
  });
  it('has one h1 and text of 16 px or more in its own sheet', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    // the size of a `font:` shorthand is the length before its line height; `font-size:` stands alone; `var(--t-s)` is 16 below
    const sizes = [...css.matchAll(/font:[^;]*?(\d+)px\s*\/|font-size:\s*(\d+)px/g)].map((m) => Number(m[1] ?? m[2]));
    expect(sizes.length).toBeGreaterThanOrEqual(5);
    for (const px of sizes) expect(px).toBeGreaterThanOrEqual(16);
    expect(css).toMatch(/--t-s:\s*16px/);
  });
});
