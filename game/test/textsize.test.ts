import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * G29 (docs/design/GAME_RULES.md): a player reads text at 16 px or more, dialogue at 18. This scan reads every
 * stylesheet under game/src and every font size set in TypeScript, and names file and line for each size that
 * breaks the rule. Custom properties resolve through var() chains and fallbacks; rem and em count 16 px;
 * clamp() is judged by its floor; a unit it cannot read fails as "cannot be checked".
 */

const SRC = join(__dirname, '..', 'src');
const MIN = 16;
const DIALOGUE_MIN = 18;
/** The chart is a 480-unit SVG shown about 352 px wide on a 390 px phone: 22 units is 16 px there. */
const SVG_UNITS_MIN = 22;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(SRC);
const rel = (p: string) => relative(join(SRC, '..'), p);

type Tokens = Map<string, string[]>;

function collectTokens(texts: string[]): Tokens {
  const tokens: Tokens = new Map();
  for (const text of texts)
    for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) tokens.set(m[1]!, [...(tokens.get(m[1]!) ?? []), m[2]!.trim()]);
  return tokens;
}

/** The smallest size in a CSS value, in px, or null when it cannot be told. */
function smallestPx(value: string, tokens: Tokens = new Map(), depth = 0): number | null {
  if (depth > 8) return null;
  const v = value.trim();
  const vr = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.*))?\)$/.exec(v);
  if (vr) {
    const sources = tokens.get(vr[1]!) ?? (vr[2] !== undefined ? [vr[2]] : []);
    const sizes = sources.map((d) => smallestPx(d, tokens, depth + 1));
    return sizes.length && sizes.every((n) => n !== null) ? Math.min(...(sizes as number[])) : null;
  }
  const clamp = /^clamp\(\s*([^,]+),/.exec(v);
  if (clamp) return smallestPx(clamp[1]!, tokens, depth + 1);
  const nums = [...v.matchAll(/(-?\d*\.?\d+)(px|rem|em)\b/g)].map((m) => Number(m[1]) * (m[2] === 'px' ? 1 : 16));
  if (!nums.length || /%/.test(v)) return null;
  return Math.min(...nums);
}

interface Found { where: string; px: number | null; raw: string; selector: string }

function cssSizes(text: string, name: string, tokens: Tokens): Found[] {
  const out: Found[] = [];
  let selector = '';
  text.split('\n').forEach((line, i) => {
    if (line.includes('{')) selector = line.split('{')[0]!.trim() || selector;
    const m = /^\s*font(-size)?\s*:\s*([^;]+);/.exec(line);
    // `font-size: 0` hides a button's own label (the close button draws its x in ::before at its own size)
    if (!m || m[2]!.trim() === 'inherit' || (m[1] && m[2]!.trim() === '0')) return;
    const value = m[2]!.trim();
    let px: number | null = null;
    if (m[1]) px = smallestPx(value, tokens);
    else
      for (const t of value.replace(/\/\s*[\d.]+(?:px|rem|em)?/, ' ').match(/var\([^)]*\)|clamp\([^)]*\)|\S+/g) ?? []) {
        const n = smallestPx(t, tokens);
        if (n !== null) {
          px = n;
          break;
        }
      }
    out.push({ where: `${name}:${i + 1}`, px, raw: line.trim(), selector });
  });
  return out;
}

const isDialogue = (selector: string) => /\.dialog(?:-text)?(?![\w-])/.test(selector);

describe('G29 text size', () => {
  const cssFiles = files.filter((f) => f.endsWith('.css'));
  const texts = cssFiles.map((f) => readFileSync(f, 'utf8'));
  const tokens = collectTokens(texts);
  const css = cssFiles.flatMap((f, i) => cssSizes(texts[i]!, rel(f), tokens));

  test('the scan sees the kit and the game sheets', () => {
    const names = new Set(css.map((c) => c.where.split(':')[0]));
    expect(names).toContain('src/ui/kit.css');
    expect(names).toContain('src/style.css');
    expect(css.length).toBeGreaterThan(100);
  });

  test('the reader: px, rem, clamp, tokens, shorthand', () => {
    const t = collectTokens([':root { --a: 15px; --b: var(--a); --c: 18px; }']);
    expect(smallestPx('13px')).toBe(13);
    expect(smallestPx('1rem')).toBe(16);
    expect(smallestPx('clamp(14px, 1.2vw + 6px, 20px)')).toBe(14);
    expect(smallestPx('120%')).toBeNull();
    expect(smallestPx('var(--b)', t)).toBe(15);
    expect(smallestPx('var(--c)', t)).toBe(18);
    expect(smallestPx('var(--none, 14px)', t)).toBe(14);
    const found = cssSizes('.dialog-text {\n  font: 400 var(--a) / 1 serif;\n}\n', 'x.css', t);
    expect(found).toMatchObject([{ where: 'x.css:2', px: 15 }]);
  });

  test('no stylesheet text is under 16 px, and dialogue is 18 or more', () => {
    const bad: string[] = [];
    for (const c of css) {
      if (c.px === null) bad.push(`${c.where}  cannot be checked: ${c.raw}`);
      else if (c.px < MIN) bad.push(`${c.where}  ${c.px}px is under ${MIN}: ${c.raw}  (${c.selector})`);
      else if (isDialogue(c.selector) && c.px < DIALOGUE_MIN) bad.push(`${c.where}  dialogue ${c.px}px is under ${DIALOGUE_MIN}: ${c.raw}  (${c.selector})`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test('no size set in TypeScript or inline is under the rule', () => {
    const bad: string[] = [];
    for (const f of files.filter((p) => p.endsWith('.ts'))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const where = `${rel(f)}:${i + 1}`;
        for (const m of line.matchAll(/font-size:\s*([^;"'`]+)/g)) {
          const px = smallestPx(m[1]!, tokens);
          if (px === null || px < MIN) bad.push(`${where}  inline ${m[1]!.trim()}`);
        }
        for (const m of line.matchAll(/fontSize\s*[:=]\s*['"`]?([\d.]+)(px|rem|em)?/g)) {
          if (Number(m[1]) * (m[2] === 'rem' || m[2] === 'em' ? 16 : 1) < MIN) bad.push(`${where}  fontSize ${m[1]}${m[2] ?? ''}`);
        }
        for (const m of line.matchAll(/font-size="([\d.]+)"/g)) {
          if (Number(m[1]) < SVG_UNITS_MIN) bad.push(`${where}  svg font-size ${m[1]} units is under ${SVG_UNITS_MIN}`);
        }
      });
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
