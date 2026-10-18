/**
 * A slot's fog (an empty community slot): the 32 px fog tile cut to the slot's rounded shape, thinned
 * toward its edge through an ordered 4x4 dither on game pixels, the way the night hole's edge steps.
 * Pure, so a test reads the very pixels the game bakes and a pale rectangle cannot come back unseen.
 */

/** How far a slot's fog reaches past the slot, and how far inside its edge it starts to thin, in px. */
export const FOG_FEATHER = 8;
/** The fog tile's side in px. */
export const FOG_TILE = 32;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/**
 * The fog of a `cols` x `rows` px slot as RGBA bytes, over the slot and FOG_FEATHER px past it on every
 * side (so `cols + 2 * FOG_FEATHER` wide). `tile` is the fog tile's RGBA bytes, `offset` shifts it so two
 * layers do not line up. A pixel is the tile's own, or clear: never a blend.
 */
export function fogPixels(tile: ArrayLike<number>, cols: number, rows: number, offset: number): Uint8ClampedArray<ArrayBuffer> {
  const pad = FOG_FEATHER;
  const w = cols + 2 * pad;
  const h = rows + 2 * pad;
  const out = new Uint8ClampedArray(4 * w * h);
  const hw = cols / 2;
  const hh = rows / 2;
  const r = Math.min(hw, hh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // signed distance to the slot's rounded rectangle, inside positive
      const dx = Math.abs(x + 0.5 - pad - hw) - (hw - r);
      const dy = Math.abs(y + 0.5 - pad - hh) - (hh - r);
      const d = r - (Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0));
      const keep = Math.min(1, Math.max(0, (d + pad) / (2 * pad)));
      if (keep <= BAYER[(y & 3) * 4 + (x & 3)]! / 16 + 1 / 32) continue;
      const t = 4 * (((y + offset) % FOG_TILE) * FOG_TILE + ((x + offset) % FOG_TILE));
      const o = 4 * (y * w + x);
      for (let k = 0; k < 4; k++) out[o + k] = tile[t + k]!;
    }
  }
  return out;
}
