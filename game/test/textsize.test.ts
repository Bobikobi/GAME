import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * G29 (docs/design/GAME_RULES.md): a player reads text at 16 px or more, dialogue at 18. The Field Kit has no
 * exception (owner, 23.10). This scan reads every stylesheet and every font size set in TypeScript under
 * game/src, and names file and line for each size that breaks the rule.
 *
 * Custom properties (`--x: 15px;`) are collected from every scanned sheet and resolved through var() chains and fallbacks.
 * Units: px as written; rem and em count as 16 px per unit (the root size is never changed in these sheets,
 * and em is read against the 16 px body, so a nested em is only a lower bound); clamp() is judged by its
 * floor (first argument). A size in any other unit (%, keywords, vw alone) fails as "cannot be checked".
 */

const SRC = join(__dirname, '..', 'src');
const MIN = 16;
const DIALOGUE_MIN = 18;
/** The big chart is a 480-unit SVG shown about 352 px wide on a 390 px phone: 22 units is 16 px there. */
const SVG_UNITS_MIN = 22;
const ROOT_PX = 16;

/** Text a player does not read. Key: `file:line`; the reason stays one line. */
const EXEMPT: Record<string, string> = {};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const files = walk(SRC);
const rel = (p: string) => relative(join(SRC, '..'), p);

interface Found {
  where: string;
  px: number | null;
  raw: string;
  selector: string;
}

/** Custom properties declared anywhere in the scanned CSS: name -> every value it is given. */
type Tokens = Map<string, string[]>;

export function collectTokens(texts: string[]): Tokens {
  const tokens: Tokens = new Map();
  for (const text of texts)
    for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) tokens.set(m[1]!, [...(tokens.get(m[1]!) ?? []), m[2]!.trim()]);
  return tokens;
}

/** The smallest size in a CSS value, in px, or null when it cannot be told. */
export function smallestPx(value: string, tokens: Tokens = new Map(), depth = 0): number | null {
  if (depth > 8) return null;
  const v = value.trim();
  // var(--x) or var(--x, fallback): every declaration of --x counts (the smallest wins); the fallback only when none exists
  const vr = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.*))?\)$/.exec(v);
  if (vr) {
    const decls = tokens.get(vr[1]!);
    const sources = decls ?? (vr[2] !== undefined ? [vr[2]] : []);
    const sizes = sources.map((d) => smallestPx(d, tokens, depth + 1));
    return sizes.length && sizes.every((n) => n !== null) ? Math.min(...(sizes as number[])) : null;
  }
  const clamp = /^clamp\(\s*([^,]+),/.exec(v);
  if (clamp) return smallestPx(clamp[1]!, tokens, depth + 1);
  const nums = [...v.matchAll(/(-?\d*\.?\d+)(px|rem|em)\b/g)].map((m) => Number(m[1]) * (m[2] === 'px' ? 1 : ROOT_PX));
  if (!nums.length) return null;
  if (/%|\b(?:small|medium|large|smaller|larger|x-small|xx-small)\b/.test(v)) return null;
  return Math.min(...nums);
}

function cssSizes(file: string, tokens: Tokens): Found[] {
  const out: Found[] = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  let selector = '';
  lines.forEach((line, i) => {
    if (line.includes('{')) selector = line.split('{')[0]!.trim() || selector;
    else if (/^\s*[^\s@/*].*,\s*$/.test(line) && !line.includes(':')) selector = line.trim();
    const m = /^\s*font(-size)?\s*:\s*([^;]+);/.exec(line);
    if (!m) return;
    const value = m[2]!.trim();
    if (value === 'inherit') return;
    let px: number | null;
    if (m[1]) px = smallestPx(value, tokens);
    else {
      // the `font` shorthand: the size is the token that reads as a length (before any /line-height);
      // a var() that resolves to a family or weight is not the size
      const cands = value.replace(/\/\s*[\d.]+(?:px|rem|em)?/, ' ').match(/var\([^)]*\)|clamp\([^)]*\)|[^\s]+/g) ?? [];
      px = null;
      for (const t of cands) {
        const n = smallestPx(t, tokens);
        if (n !== null) {
          px = n;
          break;
        }
      }
    }
    out.push({ where: `${rel(file)}:${i + 1}`, px, raw: line.trim(), selector });
  });
  return out;
}

/** Selectors whose text is a character speaking. */
const isDialogue = (selector: string) => /\.dialog(?:-text)?(?![\w-])/.test(selector);

describe('G29 text size', () => {
  const cssFiles = files.filter((f) => f.endsWith('.css'));
  const tokens = collectTokens(cssFiles.map((f) => readFileSync(f, 'utf8')));
  const css = cssFiles.flatMap((f) => cssSizes(f, tokens));

  test('the scan sees the kit and the game sheets', () => {
    const names = new Set(css.map((c) => c.where.split(':')[0]));
    expect(names).toContain('src/ui/kit.css');
    expect(names).toContain('src/style.css');
    expect(css.length).toBeGreaterThan(100);
  });

  test('size reader: px, rem, em, clamp and shorthand', () => {
    expect(smallestPx('13px')).toBe(13);
    expect(smallestPx('1rem')).toBe(16);
    expect(smallestPx('0.75em')).toBe(12);
    expect(smallestPx('clamp(14px, 1.2vw + 6px, 20px)')).toBe(14);
    expect(smallestPx('120%')).toBeNull();
  });

  test('size reader: custom properties, chains and fallbacks', () => {
    const t = collectTokens([':root { --a: 15px; --b: var(--a); --ok: 18px; --a2: 20px; }\n.x { --a2: 14px; }']);
    expect(smallestPx('var(--a)', t)).toBe(15);
    expect(smallestPx('var(--b)', t)).toBe(15);
    expect(smallestPx('var(--ok)', t)).toBe(18);
    expect(smallestPx('var(--a2)', t)).toBe(14); // declared twice: the smaller counts
    expect(smallestPx('var(--missing, 14px)', t)).toBe(14);
    expect(smallestPx('var(--missing)', t)).toBeNull();
  });

  test('a font-size through a token under 16 is reported with file and line', () => {
    const t = collectTokens(['--kit-text-s: 15px;']);
    const dir = mkdtempSync(join(tmpdir(), 'g29-'));
    const f = join(dir, 'x.css');
    writeFileSync(f, '.a {\n  font-size: var(--kit-text-s);\n}\n.b {\n  font: 400 var(--nope) / 1 serif;\n}\n');
    const found = cssSizes(f, t);
    expect(found.map((c) => [c.where.endsWith('x.css:2') || c.where.endsWith('x.css:5'), c.px])).toEqual([
      [true, 15],
      [true, null],
    ]);
  });

  test('no stylesheet text is under 16 px, and dialogue is 18 or more', () => {
    const bad: string[] = [];
    for (const c of css) {
      if (EXEMPT[c.where]) continue;
      if (c.px === null) bad.push(`${c.where}  cannot be checked: ${c.raw}`);
      else if (c.px < MIN) bad.push(`${c.where}  ${c.px}px is under ${MIN}: ${c.raw}  (${c.selector})`);
      else if (isDialogue(c.selector) && c.px < DIALOGUE_MIN) bad.push(`${c.where}  dialogue ${c.px}px is under ${DIALOGUE_MIN}: ${c.raw}  (${c.selector})`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test('no size is set in TypeScript or inline below the rule', () => {
    const bad: string[] = [];
    for (const f of files.filter((p) => p.endsWith('.ts'))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const where = `${rel(f)}:${i + 1}`;
        if (EXEMPT[where]) return;
        // DOM / Phaser text: font-size: Npx in a style string, fontSize: 'Npx' or fontSize: N
        for (const m of line.matchAll(/font-size:\s*([^;"'`]+)/g)) {
          const px = smallestPx(m[1]!);
          if (px === null || px < MIN) bad.push(`${where}  inline ${m[1]!.trim()}`);
        }
        for (const m of line.matchAll(/fontSize\s*[:=]\s*['"`]?([\d.]+)(px|rem|em)?/g)) {
          const px = Number(m[1]) * (m[2] === 'rem' || m[2] === 'em' ? ROOT_PX : 1);
          if (px < MIN) bad.push(`${where}  fontSize ${m[1]}${m[2] ?? ''}`);
        }
        // SVG text on the chart is in viewBox units
        for (const m of line.matchAll(/font-size="([\d.]+)"/g)) {
          if (Number(m[1]) < SVG_UNITS_MIN) bad.push(`${where}  svg font-size ${m[1]} units is under ${SVG_UNITS_MIN} (16 px on a phone)`);
        }
      });
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test('every exemption points at a real line', () => {
    for (const key of Object.keys(EXEMPT)) {
      const [file, line] = key.split(':') as [string, string];
      const text = readFileSync(join(SRC, '..', file), 'utf8').split('\n')[Number(line) - 1];
      expect(text, key).toMatch(/font/);
    }
  });
});
