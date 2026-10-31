/**
 * The windows' theme. Begun as the kit's "B, canvas" (DECISIONS 2026-10-23); the colours widen with
 * frame D (DECISIONS 2026-10-28, "The windows' direction: black lacquer with antique gold"):
 * game/src/ui/theme.css holds every colour the windows wear, each one of UI_PALETTE (the 32 core
 * colours, the antique-gold ramp and the two deep blacks), with no scrims, gradients or rounded
 * corners. Frame D's leather grain is a small tiled picture in the UI's palette, not a gradient, so
 * the no-gradient rule stands. The Field Kit's own rules in kit.css name no colour but the theme's
 * tokens; each text token reads at 4.5:1 or more on the ground it is drawn on; and the game's body
 * face is Jersey 15, self-hosted with its licence. Frame D adds: the engraved corners are SVG in the
 * same palette; the grain tile is the one tools/src/ui/grain.ts draws; an item's name takes one of four
 * rarity colours; titles and group names are Cinzel, self-hosted like the home page's; the type comes
 * in four sizes, 22 / 18 / 16 / 27, none under G29's 16 px floor. The sprites stay on CORE_PALETTE.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { RARITIES, TREE_TINTS } from '@game/schema';
import { ANTIQUE_GOLD, CORE_PALETTE, UI_BLACKS, UI_PALETTE } from '../src/kit/palette';
import { rampProblems } from '../src/kit/ramps';
import { REPO_ROOT } from '../src/load';
import { GRAIN_PATH, GRAIN_SIZE, grainTile } from '../src/ui/grain';

const UI = join(REPO_ROOT, 'game', 'src', 'ui');
const theme = readFileSync(join(UI, 'theme.css'), 'utf8');
const kit = readFileSync(join(UI, 'kit.css'), 'utf8');
const tree = readFileSync(join(UI, 'tree.css'), 'utf8');
const style = readFileSync(join(REPO_ROOT, 'game', 'src', 'style.css'), 'utf8');

/** The tokens of theme.css's :root, name to hex. */
function tokens(): Record<string, string> {
  const root = /:root\s*\{([^}]*)\}/.exec(theme)?.[1] ?? '';
  return Object.fromEntries([...root.matchAll(/(--(?:kit|ui)-[a-z0-9-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1]!, m[2]!]));
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
    // the corner pieces are SVG inside a data URI, where # is written %23
    const corners = [...theme.matchAll(/%23([0-9a-fA-F]{3,8})\b/g)].map((m) => `#${m[1]!.toLowerCase()}`);
    expect(hexes.length).toBeGreaterThan(10);
    expect(corners.length, 'the four corners draw in the palette').toBeGreaterThan(3);
    hexes.push(...corners);
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
      ['--kit-on-gold', '--kit-brass'],
      ['--kit-ink', '--kit-tree-trunk'],
      ['--ui-black', '--ui-gold-5'],
      ['--ui-paper', '--ui-black'],
      ['--ui-paper-soft', '--ui-black'],
      ['--ui-paper-soft', '--ui-well'],
      ['--ui-gold-5', '--ui-black'],
      ['--ui-gold-6', '--ui-well'],
      ['--ui-warn', '--ui-black'],
      ...TREE_TINTS.map((tint): [string, string] => [`--kit-tree-${tint}-ink`, '--kit-plate']),
    ];
    for (const [text, ground] of pairs) {
      expect(t[text], text).toBeDefined();
      expect(t[ground], ground).toBeDefined();
      expect(contrast(t[text]!, t[ground]!), `${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("names an item in its rarity's colour, each readable on the black and the well", () => {
    const t = tokens();
    const palette = new Set(UI_PALETTE);
    for (const r of RARITIES) {
      const hex = t[`--ui-rarity-${r}`];
      expect(hex, r).toBeDefined();
      expect(palette.has(hex!), `${r} ${hex} is in UI_PALETTE`).toBe(true);
      expect(contrast(hex!, t['--ui-black']!), `${r} on the black`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex!, t['--ui-well']!), `${r} on the well`).toBeGreaterThanOrEqual(4.5);
      expect(theme).toMatch(new RegExp(`\\.rarity-${r} \\{\\s*color: var\\(--ui-rarity-${r}\\);`));
    }
    expect(new Set(RARITIES.map((r) => t[`--ui-rarity-${r}`])).size, 'four different colours').toBe(RARITIES.length);
  });

  it('dresses the HUD in frame D: the grain, a gold hairline lit along its length, the paper words, its colours named through the tokens', () => {
    // DECISIONS 2026-10-30 "The HUD wears frame D too": the HUD's rules in style.css, from its heading to the touch controls'
    const hud = style.split('/* ------------------------------------------------------------ HUD */')[1]?.split('/* ------------------------------------------------------------ touch */')[0] ?? '';
    expect(hud.length).toBeGreaterThan(1000);
    expect(hud, 'the HUD names its colours through the theme').not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|gradient\(/);
    // one rule dresses the meter, the chips, the tracker, the toasts and the HUD buttons
    const frame = /\n\.toast,\s*\.tracker,\s*\.meter,\s*\.chip,\s*\.hud \.btn \{([^}]*)\}/.exec(hud);
    expect(frame?.[1]).toMatch(/background:\s*var\(--hud-ground\) var\(--hud-grain\) repeat;/);
    expect(frame?.[1]).toMatch(/--hud-ground:\s*var\(--ui-black\);/);
    expect(frame?.[1]).toMatch(/--hud-grain:\s*var\(--ui-grain\);/);
    expect(frame?.[1], 'the clear 3 px border keeps the paper frame\'s size').toMatch(/border:\s*3px solid transparent;/);
    expect(frame?.[1]).toMatch(/border-image:\s*var\(--hud-line\) 3 \/ var\(--hud-edge\);/);
    expect(frame?.[1]).toMatch(/color:\s*var\(--ui-paper\);/);
    expect(hud).toMatch(/\.meter,\s*\.tracker,\s*\.hud \.btn \{\s*--hud-line:\s*var\(--ui-hud-line-bevel\);/);
    expect(hud).toMatch(/\.tracker-title \{\s*font-family:\s*var\(--ui-display\);/);
    // the edge is 3 device pixels at 1x, 2x and 3x, so the frame's outer unit is one device pixel
    expect(hud).toMatch(/--hud-edge:\s*3px;[\s\S]*min-resolution: 2dppx[\s\S]*--hud-edge:\s*1\.5px;[\s\S]*min-resolution: 3dppx[\s\S]*--hud-edge:\s*1px;/);
    // the edges: a 100-unit frame with a 1-unit line, the gold lit from step 6 at the top-left to step 3 at the
    // bottom-right (the owner, 30.10: "the gold is too thick and does not feel metallic"), the bevel step 1 inside it
    const svg = (name: string) => new RegExp(`--ui-hud-${name}: url\\("data:image/svg\\+xml,<svg [^"]*width='100' height='100'>(.*?)</svg>"\\);`).exec(theme)?.[1] ?? '';
    expect(svg('line')).toMatch(/stop-color='%23e8d4a2'[\s\S]*stop-color='%237a5f33'/);
    expect(svg('line')).toContain("d='M0 0H100V100H0Z M1 1V99H99V1Z'");
    expect(svg('line-bevel')).toContain("fill='%232a2114' fill-rule='evenodd' d='M1 1H99V99H1Z M2 2V98H98V2Z'");
    expect(svg('line-good')).toContain("fill='%2384c450'");
    expect(svg('line-warn')).toContain("fill='%23f6a07f'");
    // the pocket chart on a desktop wears the same ground and edge
    const map = /\n\.hud-map \{([^}]*)\}/.exec(kit)?.[1] ?? '';
    expect(map).toMatch(/background:\s*var\(--ui-black\) var\(--ui-grain\) repeat;/);
    expect(map).toMatch(/border-image:\s*var\(--ui-hud-line-bevel\) 3 \/ var\(--hud-edge\);/);
    // the HUD's meaning colours on the lacquer: the health fill, the dark's "soon", a toast's good and bad, the gold
    const t = tokens();
    for (const hex of ['#4c9a3f', '#eda83a', t['--ui-good']!, t['--ui-warn']!, t['--ui-gold-5']!, t['--ui-rarity-rare']!]) {
      expect(contrast(hex, t['--ui-black']!), `${hex} on the black`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex, t['--ui-raised']!), `${hex} on the grain's lightest fleck`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tiles the grain the generator draws, in the palette', () => {
    const png = PNG.sync.read(readFileSync(GRAIN_PATH));
    expect([png.width, png.height]).toEqual([GRAIN_SIZE, GRAIN_SIZE]);
    const hex = (i: number) => `#${[0, 1, 2].map((k) => png.data[i + k]!.toString(16).padStart(2, '0')).join('')}`;
    const drawn = grainTile();
    const palette = new Set(UI_PALETTE);
    for (let y = 0; y < GRAIN_SIZE; y++) {
      for (let x = 0; x < GRAIN_SIZE; x++) {
        const i = (y * GRAIN_SIZE + x) * 4;
        expect(png.data[i + 3]).toBe(255);
        expect(palette.has(hex(i))).toBe(true);
        if (hex(i) !== drawn[y]![x]) expect.fail(`grain.png differs from grainTile() at ${x},${y}: run tools/src/ui/grain.ts`);
      }
    }
    expect(theme).toMatch(/--ui-grain:\s*url\('\/ui\/grain\.png'\)/);
  });

  it('sets type in four sizes, none under 16 px, titles in self-hosted Cinzel', () => {
    const t = /:root\s*\{([^}]*)\}/.exec(theme)?.[1] ?? '';
    for (const [name, px] of [['--ui-title', 22], ['--ui-text', 18], ['--ui-group', 16], ['--ui-big', 27], ['--kit-text', 18], ['--kit-text-s', 16], ['--kit-text-l', 27]] as const) {
      expect(t, name).toMatch(new RegExp(`${name}:\\s*${px}px;`));
    }
    const fieldKit = kit.split('/* ------------------------------------------------------------ the map */')[0]!;
    // the windows' words; the HUD's (.hud, .tracker) keep their own sizes, so its band does not grow (DECISIONS 2026-10-30)
    for (const css of [theme, fieldKit, tree]) {
      for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (/^\s*\.(hud|tracker)\b/.test(rule[1]!.replace(/\/\*[\s\S]*?\*\//g, ''))) continue;
        for (const m of rule[2]!.matchAll(/font(?:-size)?:[^;]*?\b(\d+)px/g)) expect(Number(m[1]), `${rule[1]!.trim()} ${m[0]}`).toBeGreaterThanOrEqual(16);
      }
    }
    expect(theme).toMatch(/font-family:\s*'Cinzel';\s*src:\s*url\('\/fonts\/cinzel\/cinzel-latin\.woff2'\)/);
    const fonts = join(REPO_ROOT, 'game', 'public', 'fonts', 'cinzel');
    expect(existsSync(join(fonts, 'cinzel-latin.woff2'))).toBe(true);
    expect(readFileSync(join(fonts, 'OFL.txt'), 'utf8')).toMatch(/SIL Open Font License, Version 1\.1/);
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
