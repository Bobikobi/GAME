/**
 * The shade under a tree's crown (rich wave 3c): a soft ellipse on the grass round the trunk's foot, the dark a real crown
 * keeps under it at noon (the owner's reference frames show it under every oak). It is the crown's ambient shade, not the cast
 * shadow (cast.ts): the cast shadow falls away from the sun, this one lies under the tree whatever the hour. A sprite's own
 * pixels cannot carry it (the kit holds no soft alpha, check.ts), so the scene lays one image under each tree and follows the
 * tree's state: a felled oak (its stump) and a sapling give none, a young tree gives a small one.
 */

/** The sprite names whose crown shades the ground, and how wide the shade is as a share of the sprite's drawn width. */
const SHADED: ReadonlyMap<string, number> = new Map([
  ['tree_oak', 0.78],
  ['young_tree', 0.7],
  ['fig_bush', 0.62],
  ['fig_bush_empty', 0.62],
]);

export const SHADE_KEY = 'fx-crownshade';
/** The shade's darkness at its heart, 0 to 1, before the hour's own light (the light layer sits over it). */
export const SHADE_ALPHA = 0.5;
/** Below every standing thing and the cast layers (2.5), above the ground and the flat props (2). */
export const SHADE_DEPTH = 2.4;

/** The share of the sprite's width the crown shade covers, or 0 for a texture that gives none. */
export function shadeShare(textureKey: string): number {
  return SHADED.get(textureKey.split('/').pop() ?? textureKey) ?? 0;
}

/** The shade's size for a tree drawn `width` wide (any unit): an ellipse under a third as tall as it is wide, its heart a little below the foot row (a tree's roots hide the half behind them, so the half in front is what shows). */
export function shadeBox(width: number, share: number): { w: number; h: number; lift: number } {
  const w = width * share;
  const h = w * 0.3;
  return { w, h, lift: -h * 0.2 };
}

/** The ellipse's pixels, RGBA: the ink colour, alpha falling from the heart to the rim in whole steps (the world is pixel art, no smooth gradient). */
export function shadePixels(w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const steps = 5;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const d = Math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2));
      if (d >= 1) continue;
      const a = Math.ceil((1 - d) ** 0.75 * steps) / steps;
      out.set([0x1b, 0x1a, 0x2e, Math.round(a * 255)], (y * w + x) * 4);
    }
  }
  return out;
}
