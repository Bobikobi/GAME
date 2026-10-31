/**
 * Frame D's measurables, read from the stylesheets (BRIEF "the windows in frame D", Measurable 1-3), so a window
 * that drops under a number fails here and nobody has to look:
 *   1. text contrast: every `color:` a window's CSS sets reads at 4.5:1 or more on the ground it is drawn on;
 *   2. tap targets: each button, tab, cell and input a window offers declares 44 px or more on a phone (390 wide);
 *   3. frame colours: what the frame is drawn in (line, corners, plaque, grain tile) is four roles only.
 * It reads CSS text and the committed grain tile, not a browser. What it cannot see is in the PR body: pixels as
 * rendered, a box sized by its content or by flex, the content area, the desktop layout and the load window.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { ANTIQUE_GOLD, UI_BLACKS } from '../src/kit/palette';
import { REPO_ROOT } from '../src/load';
import { GRAIN_PATH } from '../src/ui/grain';

const SRC = join(REPO_ROOT, 'game', 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const FILES = ['ui/theme.css', 'ui/kit.css', 'ui/tree.css', 'ui/settings.css', 'style.css'] as const;
const PHONE = 390;
/** Rules no code uses (grep game/src: no hit outside the stylesheet); they would fail 4.5:1 and draw nowhere. */
const WINDOW_ROOT = /(^|[\s(,])\.(panel|dialog|title-box|title-screen|levelup|signup|ui-window)\b/;
const UNUSED = ['.sig-carved'];

interface Rule {
  file: string;
  media: string;
  selectors: string[];
  decl: Record<string, string>; // the last value of each property in the rule
}

/** A small CSS reader: rules with their @media, comments dropped, selector lists split at top-level commas. */
function rules(file: string): Rule[] {
  const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  const walk = (s: string, media: string) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf('{', i);
      if (open < 0) break;
      let depth = 1;
      let k = open + 1;
      while (depth && k < s.length) {
        if (s[k] === '{') depth++;
        else if (s[k] === '}') depth--;
        k++;
      }
      const head = s.slice(i, open).trim();
      const body = s.slice(open + 1, k - 1);
      if (head.startsWith('@media')) walk(body, head);
      else if (!head.startsWith('@')) {
        const selectors: string[] = [];
        let level = 0;
        let cur = '';
        for (const ch of head) {
          if (ch === '(') level++;
          if (ch === ')') level--;
          if (ch === ',' && !level) (selectors.push(cur.replace(/\s+/g, ' ').trim()), (cur = ''));
          else cur += ch;
        }
        selectors.push(cur.replace(/\s+/g, ' ').trim());
        const decl: Record<string, string> = {};
        // a data URI holds ';' and ':' inside quotes, so split on ';' outside "..." only
        for (const d of body.match(/(?:[^;"]|"[^"]*")+/g) ?? []) {
          const c = d.indexOf(':');
          if (c > 0) decl[d.slice(0, c).trim()] = d.slice(c + 1).trim();
        }
        out.push({ file, media, selectors, decl });
      }
      i = k;
    }
  };
  walk(css, '');
  return out;
}

const ALL = FILES.flatMap(rules);

/** True when the rule applies at a 390 px phone. */
function onPhone(media: string): boolean {
  const min = /min-width:\s*(\d+)px/.exec(media);
  const max = /max-width:\s*(\d+)px/.exec(media);
  return (!min || Number(min[1]) <= PHONE) && (!max || Number(max[1]) >= PHONE);
}

/** The custom properties: :root, then the block that remaps the site's tokens inside a window. */
const vars: Record<string, string> = {};
for (const r of ALL) {
  if (r.selectors.some((s) => s === ':root' || s === '.panel' || s === '.dialog' || s === '.title-screen')) {
    for (const [k, v] of Object.entries(r.decl)) if (k.startsWith('--')) vars[k] = v;
  }
}

/** A colour value to hex through var() chains, or undefined when it is not a plain colour here. */
function hexOf(value: string | undefined, depth = 0): string | undefined {
  if (!value || depth > 6) return undefined;
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const m = /^var\((--[a-z0-9-]+)\)$/.exec(v);
  return m ? hexOf(vars[m[1]!], depth + 1) : undefined;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

/** The grounds a window's text can sit on: the black, the well, the grain's lightest fleck. */
const GROUNDS = ['--ui-black', '--ui-well', '--ui-raised'].map((n) => vars[n]!);

/** The window groups the stylesheets split into (the brief's windows, by the file that dresses them). */
const GROUP_OF: Record<string, string> = {
  'ui/theme.css': 'shared frame, buttons, tabs, dialogue, title',
  'ui/kit.css': 'bag, shop, stall, journal, map, outfit',
  'ui/tree.css': 'skill tree',
  'ui/settings.css': 'settings and controls',
  'style.css': 'panels, dialogue, title, sign-up, level-up',
};

describe('frame D, measured from the stylesheets', () => {
  it('reads at 4.5:1 or more: every colour a window sets, on the black, the well and the grain', () => {
    const lowest: Record<string, { c: number; at: string }> = {};
    let checked = 0;
    for (const r of ALL) {
      if (/^\s*(\.(hud|tracker|toast|meter|chip)\b|html|body)/.test(r.selectors[0]!) || UNUSED.includes(r.selectors[0]!)) continue; // the HUD has its own test; the page is not a window
      // style.css also dresses the page, banners and touch pads, drawn outside any window on the site's own tokens:
      // only its rules that name a window (or sit in a window's own sheet) are measured here
      if (r.file === 'style.css' && !r.selectors.some((x) => WINDOW_ROOT.test(x))) continue;
      const text = hexOf(r.decl['color']);
      if (!text) continue;
      // a rule that paints its own ground (a gold fill, a plate) is measured on that ground
      const own = hexOf(r.decl['background']) ?? hexOf(r.decl['background-color']);
      const grounds = own ? [own] : GROUNDS;
      for (const g of grounds) {
        const c = contrast(text, g);
        checked++;
        const group = GROUP_OF[r.file]!;
        if (!lowest[group] || c < lowest[group]!.c) lowest[group] = { c, at: `${r.selectors[0]} ${text} on ${g}` };
      }
    }
    expect(checked, 'the reader found the colours').toBeGreaterThan(40);
    for (const [group, { c, at }] of Object.entries(lowest)) expect(c, `${group}: ${at}`).toBeGreaterThanOrEqual(4.5);
  });

  /** What each window offers to tap: the selector as the CSS writes it, and the axes it must size (h = height, hw = both, w = width only: its height is the row's). */
  const TAPS: Record<string, [string, 'h' | 'hw' | 'w'][]> = {
    'shared (buttons, tabs, close, plus)': [
      ['.ui-btn', 'hw'], ['.ui-tab', 'h'], ['.kit-btn', 'h'], ['.btn.tab', 'hw'], ['.panel header .btn.close', 'hw'], ['.btn.plus', 'hw'],
      [':is(.panel, .dialog, .title-box) .btn:not(.tab, .option)', 'hw'],
    ],
    'bag and kit': [['.kit-slot', 'hw'], ['.kit-toggle button', 'hw'], ['.kit-filter', 'hw'], ['.kit-cell', 'h'], ['.panel.bag .btn:not(.tab):not(.close)', 'h'], ['.worn-row', 'h']],
    'shop and stall': [['.shop-item', 'h'], ['.shop-price input', 'hw']],
    'skill tree': [['.panel.bag .tree-schools .btn', 'h'], ['.panel.bag .tree-tools .btn', 'hw'], ['.tree-slot', 'h'], ['.tree-keys summary', 'h'], ['.tree-key', 'h'], ['.panel.bag .tree-key .tree-plus', 'w']],
    map: [['.map-row', 'h']],
    'settings and controls': [['.panel.settings .btn.set-opt', 'hw'], ['.panel.settings .btn.set-switch', 'hw']],
    'journal, level-up, races': [['.choice', 'h'], ['.choice-plus', 'hw']],
    dialogue: [['.dialog .dialog-options .btn.option', 'h']],
    'title and sign-up': [['input.name', 'h']],
  };

  /** The value a property resolves to for a selector on a phone: the last rule that names it and the property. */
  function sized(selector: string, prop: string): number {
    let value = 0;
    for (const r of ALL) {
      if (!onPhone(r.media) || !r.selectors.includes(selector)) continue;
      const m = /^(\d+(?:\.\d+)?)px$/.exec(r.decl[prop] ?? '');
      if (m) value = Number(m[1]);
    }
    return value;
  }

  it('gives every button, tab, cell and input 44 px or more on a phone', () => {
    let count = 0;
    for (const [window, taps] of Object.entries(TAPS)) {
      for (const [selector, axes] of taps) {
        if (axes !== 'w') {
          const h = Math.max(sized(selector, 'min-height'), sized(selector, 'height'));
          expect(h, `${window}: ${selector} height`).toBeGreaterThanOrEqual(44);
          count++;
        }
        if (axes !== 'h') {
          const w = Math.max(sized(selector, 'min-width'), sized(selector, 'width'));
          expect(w, `${window}: ${selector} width`).toBeGreaterThanOrEqual(44);
          count++;
        }
      }
    }
    expect(count, 'the list was read').toBeGreaterThan(40);
  });

  it('draws the frame in four roles only: the black, the well, the gold and the paper', () => {
    const roles: Record<string, string[]> = {
      black: ['#131220'],
      well: ['#0c0b12'],
      gold: [...ANTIQUE_GOLD.steps],
      paper: ['#f5f4ef', '#c6cad6'],
    };
    const role = (hex: string) => Object.keys(roles).find((k) => roles[k]!.includes(hex));
    const frame = ALL.filter((r) => r.file === 'ui/theme.css' && r.selectors.some((s) => /^\.ui-(window|plaque|rule|group)\b/.test(s)));
    expect(frame.length).toBeGreaterThan(3);
    const used = new Set<string>();
    for (const r of frame) {
      for (const [p, v] of Object.entries(r.decl)) {
        if (p.startsWith('--')) continue;
        for (const m of v.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
          const hex = hexOf(`var(${m[1]})`);
          if (hex) used.add(hex);
        }
      }
    }
    // the four engraved corners: the SVG's own colours are written %23rrggbb
    for (const name of ['tl', 'tr', 'bl', 'br']) for (const m of vars[`--ui-corner-${name}`]!.matchAll(/%23([0-9a-f]{6})/gi)) used.add(`#${m[1]!.toLowerCase()}`);
    // the grain tile, one role: the black and the well, a fleck of the raised one
    const png = PNG.sync.read(readFileSync(GRAIN_PATH));
    const grain = new Set<string>();
    for (let i = 0; i < png.data.length; i += 4) grain.add(`#${[0, 1, 2].map((k) => png.data[i + k]!.toString(16).padStart(2, '0')).join('')}`);
    for (const g of grain) expect([...UI_BLACKS, vars['--ui-raised']], `grain colour ${g}`).toContain(g);
    const found = new Set<string>();
    for (const hex of used) {
      expect(role(hex), `frame colour ${hex} is in no role`).toBeDefined();
      found.add(role(hex)!);
    }
    expect(found.size, `frame roles used: ${[...found].join(', ')}`).toBeLessThanOrEqual(4);
    expect(found.has('gold') && found.has('black')).toBe(true);
  });

  it('puts every window inside that frame', () => {
    const builders: [string, string][] = [
      ['ui/panels.ts', 'panel ui-window'], // bag, journal, map, menu, settings, controls, credits, feedback
      ['ui/dialog.ts', 'dialog ui-window'],
      ['ui/title.ts', 'title-box ui-window'],
      ['ui/signup.ts', 'signup ui-window'],
      ['ui/levelup.ts', 'levelup ui-window'],
    ];
    for (const [file, cls] of builders) expect(read(file), `${file} wears the frame`).toContain(cls);
  });
});
