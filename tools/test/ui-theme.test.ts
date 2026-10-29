/**
 * The windows' theme. Begun as the kit's "B, canvas" (DECISIONS 2026-10-23); the colours widen with
 * frame D (DECISIONS 2026-10-28, "The windows' direction: black lacquer with antique gold"):
 * game/src/ui/theme.css holds every colour the windows wear, each one of UI_PALETTE (the 32 core
 * colours, the antique-gold ramp and the two deep blacks), with no scrims, gradients or rounded
 * corners. Frame D's leather grain is a small tiled picture in the UI's palette, not a gradient, so
 * the no-gradient rule stands. The Field Kit's own rules in kit.css name no colour but the theme's
 * tokens; each text token reads at 4.5:1 or more on the ground it is drawn on; and the game's body
 * face is Jersey 15, self-hosted with its licence. The sprites stay on CORE_PALETTE.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TREE_TINTS } from '@game/schema';
import { ANTIQUE_GOLD, CORE_PALETTE, UI_BLACKS, UI_PALETTE } from '../src/kit/palette';
import { rampProblems } from '../src/kit/ramps';
import { REPO_ROOT } from '../src/load';

const UI = join(REPO_ROOT, 'game', 'src', 'ui');
const theme = readFileSync(join(UI, 'theme.css'), 'utf8');
const kit = readFileSync(join(UI, 'kit.css'), 'utf8');
const tree = readFileSync(join(UI, 'tree.css'), 'utf8');
const style = readFileSync(join(REPO_ROOT, 'game', 'src', 'style.css'), 'utf8');

/** The tokens of theme.css's :root, name to hex. */
function tokens(): Record<string, string> {
  const root = /:root\s*\{([^}]*)\}/.exec(theme)?.[1] ?? '';
  return Object.fromEntries([...root.matchAll(/(--kit-[a-z-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1]!, m[2]!]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

describe('the kit theme', () => {
  it("adds frame D's antique gold and two blacks to the core for the UI only, the gold a true ramp", () => {
    expect(CORE_PALETTE).toHaveLength(32);
    expect(UI_PALETTE).toHaveLength(32 + 6 + 2);
    expect(new Set(UI_PALETTE).size, 'no colour twice').toBe(UI_PALETTE.length);
    for (const hex of [...ANTIQUE_GOLD.steps, ...UI_BLACKS]) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(CORE_PALETTE, `${hex} stays out of the sprites' palette`).not.toContain(hex);
    }
    expect(rampProblems(ANTIQUE_GOLD)).toEqual([]);
  });

  it('draws in UI-palette colours only, written as six-digit hex', () => {
    const palette = new Set(UI_PALETTE.map((c) => c.toLowerCase()));
    const hexes = [...theme.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    expect(hexes.length).toBeGreaterThan(10);
    for (const hex of hexes) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(palette.has(hex), `${hex} is not in UI_PALETTE`).toBe(true);
    }
  });

  it('has no scrims, gradients or rounded corners, here, in the Field Kit rules or on the skill tree', () => {
    const fieldKit = kit.split('/* ------------------------------------------------------------ the map */')[0]!;
    expect(fieldKit.length).toBeLessThan(kit.length);
    for (const css of [theme, fieldKit, tree]) {
      expect(css).not.toMatch(/rgba?\(|hsla?\(|gradient\(|border-radius:\s*[1-9]/);
    }
    expect(fieldKit, 'the Field Kit names its colours through the theme').not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(tree, 'the skill tree names its colours through the theme').not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("gives every school colour the content may name a fill and a name colour", () => {
    const t = tokens();
    for (const tint of TREE_TINTS) {
      expect(t[`--kit-tree-${tint}`], tint).toBeDefined();
      expect(t[`--kit-tree-${tint}-ink`], tint).toBeDefined();
      expect(tree).toContain(`.tint-${tint} {`);
    }
  });

  it('reads at 4.5:1 or more: each text on the ground it is drawn on', () => {
    const t = tokens();
    const pairs: [string, string][] = [
      ['--kit-ink', '--kit-canvas'],
      ['--kit-ink-soft', '--kit-canvas'],
      ['--kit-ink', '--kit-paper'],
      ['--kit-ink-soft', '--kit-paper'],
      ['--kit-warn', '--kit-paper'],
      ['--kit-warn', '--kit-canvas'],
      ['--kit-plate-ink', '--kit-plate'],
      ['--kit-plate-ink', '--kit-wood'],
      ['--kit-brass', '--kit-plate'],
      ['--kit-ink', '--kit-brass'],
      ['--kit-paper', '--kit-tree-trunk'],
      ...TREE_TINTS.map((tint): [string, string] => [`--kit-tree-${tint}-ink`, '--kit-plate']),
    ];
    for (const [text, ground] of pairs) {
      expect(t[text], text).toBeDefined();
      expect(t[ground], ground).toBeDefined();
      expect(contrast(t[text]!, t[ground]!), `${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('wears Jersey 15 everywhere in the game, self-hosted with its licence', () => {
    expect(style).toMatch(/@import\s+'\.\/ui\/theme\.css';/);
    expect(style).toMatch(/font-family:\s*'Jersey 15';\s*src:\s*url\('\/fonts\/jersey-15\/jersey-15-latin\.woff2'\)/);
    const root = /:root\s*\{([^}]*)\}/.exec(style)?.[1] ?? '';
    expect(root).toMatch(/--font:\s*'Jersey 15'/);
    expect(root).toMatch(/--font-body:\s*var\(--font\)/);
    const fonts = join(REPO_ROOT, 'game', 'public', 'fonts', 'jersey-15');
    expect(existsSync(join(fonts, 'jersey-15-latin.woff2'))).toBe(true);
    expect(readFileSync(join(fonts, 'OFL.txt'), 'utf8')).toMatch(/SIL Open Font License, Version 1\.1/);
  });
});
