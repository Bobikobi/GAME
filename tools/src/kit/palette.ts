/**
 * The core palette: 32 colors, the shared colors every kit sprite may use (plus fully
 * transparent pixels). Ramps run dark to light. A copy lives in the core kit
 * file, and `pnpm check` fails when the two disagree.
 *
 * Palette v2 (DECISIONS 2026-10-21 "The palette deepens"): the 32 stay as they are, and the
 * world's shared ramps below are the depth. A sprite that names ramps (`ramps` in its kit entry,
 * `ramps` in a `kit:gen` spec) may also draw in their steps; one that names none uses the 32 only,
 * so every sprite drawn before this stays valid. A shared ramp needs no declaration in a kit
 * file; a kit's own `ramps` are for materials the shared set lacks.
 */
import type { RampLike } from './ramps.js';

export const CORE_PALETTE: readonly string[] = [
  // outline and greys
  '#1b1a2e', '#3a3554', '#5d6177', '#8f94a8', '#c6cad6', '#f5f4ef',
  // greens
  '#1f3d2b', '#2e6b3b', '#4c9a3f', '#84c450', '#c8e88a',
  // earth and wood
  '#3d2618', '#6e4226', '#9e6b3c', '#c99a5e', '#ebd3a2',
  // water and sky
  '#172a52', '#275a99', '#3f8fd1', '#7cc4ec', '#c4ecf8',
  // reds
  '#5e1c28', '#a8302f', '#e2533f', '#f6a07f',
  // orange and yellow
  '#b8661f', '#eda83a', '#f8de62',
  // skin
  '#d38c66', '#f3c7a0',
  // purples
  '#5b3373', '#9a5bb0',
];

/** A shared ramp: six steps dark to light, the hue moving (cool darks, warm lights), and what it is for. */
export interface CoreRamp extends RampLike {
  id: string;
  for: 'stone' | 'vegetation' | 'wood' | 'water' | 'cloth' | 'light' | 'skin';
  steps: readonly [string, string, string, string, string, string];
}

/**
 * The world's shared ramps, the depth of palette v2. Each passes the ramp rule of `ramps.ts`
 * (`kit-ramps.test.ts` holds it to that), and a ramp of a core family carries that family's core
 * colours as its own steps, so a sprite drawn in the core wood sits inside the `wood` ramp.
 * 46 colours beyond the core: 78 in all.
 */
export const CORE_RAMPS: readonly CoreRamp[] = [
  { id: 'grey', for: 'stone', steps: ['#1b1a2e', '#3a3554', '#5d6177', '#8f94a8', '#c6cad6', '#f5f4ef'] },
  { id: 'stone', for: 'stone', steps: ['#1e2230', '#333b4c', '#4a5668', '#6f7d8c', '#9aa7b0', '#d6ddd8'] },
  { id: 'green', for: 'vegetation', steps: ['#15301f', '#1f3d2b', '#2e6b3b', '#4c9a3f', '#84c450', '#c8e88a'] },
  { id: 'moss', for: 'vegetation', steps: ['#1b2a16', '#2f4722', '#4a6a2c', '#6f8d36', '#9cb24c', '#cfd36e'] },
  { id: 'rust', for: 'vegetation', steps: ['#4a1d10', '#7a2f14', '#a9481a', '#cf6a23', '#e9903a', '#f5b866'] },
  { id: 'wood', for: 'wood', steps: ['#2a1810', '#3d2618', '#6e4226', '#9e6b3c', '#c99a5e', '#ebd3a2'] },
  { id: 'bark', for: 'wood', steps: ['#1f1210', '#3f1e17', '#5e2e20', '#7f452a', '#a3633a', '#cc8e55'] },
  { id: 'water', for: 'water', steps: ['#0f1c3b', '#172a52', '#275a99', '#3f8fd1', '#7cc4ec', '#c4ecf8'] },
  { id: 'teal', for: 'water', steps: ['#122b2c', '#1c4a49', '#2a6c66', '#3f8f84', '#62b3a2', '#93d6c2'] },
  { id: 'red', for: 'cloth', steps: ['#3d1220', '#5e1c28', '#a8302f', '#e2533f', '#f6a07f', '#fbcaa6'] },
  { id: 'plum', for: 'cloth', steps: ['#241238', '#43204a', '#5b3373', '#7c4593', '#9a5bb0', '#c28bc9'] },
  { id: 'fire', for: 'light', steps: ['#6e2d14', '#b8661f', '#e08a2a', '#eda83a', '#f8de62', '#fff3a8'] },
  { id: 'skin', for: 'skin', steps: ['#5a3528', '#8a5540', '#b4764f', '#d38c66', '#f3c7a0', '#fae3c8'] },
];

/** The shared ramp with this id, if there is one. */
export function coreRamp(id: string): CoreRamp | undefined {
  return CORE_RAMPS.find((ramp) => ramp.id === id);
}

/**
 * Every colour a sprite may draw in once it names these shared ramps: the 32, then the steps of
 * each named ramp in order, each colour once. A name that is no shared ramp throws, as the spec
 * and the check refuse it first.
 */
export function paletteWithRamps(named: readonly string[]): readonly string[] {
  const colours = [...CORE_PALETTE];
  const seen = new Set(colours);
  for (const id of named) {
    const ramp = coreRamp(id);
    if (ramp === undefined) throw new Error(`"${id}" is not a shared ramp (${CORE_RAMPS.map((r) => r.id).join(', ')})`);
    for (const step of ramp.steps) {
      if (seen.has(step)) continue;
      seen.add(step);
      colours.push(step);
    }
  }
  return colours;
}

/** The whole of palette v2: the 32 and every shared ramp's steps, 78 colours. */
export const DEEP_PALETTE: readonly string[] = paletteWithRamps(CORE_RAMPS.map((ramp) => ramp.id));

/**
 * The windows' antique gold (DECISIONS 2026-10-28 "The windows' direction: black lacquer with
 * antique gold, frame D"): six steps for the one thin line, the titles and the plaque. It passes
 * the ramp rule (`ui-theme.test.ts` holds it to that). A UI colour only: no sprite draws in it.
 */
export const ANTIQUE_GOLD: RampLike = { id: 'antique_gold', steps: ['#2a2114', '#4d3c22', '#7a5f33', '#a6854a', '#c9a96a', '#e8d4a2'] };

/** Frame D's two deep blacks: behind the window, and the window's own ground under its grain. */
export const UI_BLACKS: readonly string[] = ['#0c0b12', '#131220'];

/**
 * Every colour the UI may draw in (game/src/ui/): the 32, the antique gold and the two blacks, 40.
 * The sprites stay on CORE_PALETTE and its ramps; nothing here reaches the kit check.
 */
export const UI_PALETTE: readonly string[] = [...CORE_PALETTE, ...ANTIQUE_GOLD.steps, ...UI_BLACKS];

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
