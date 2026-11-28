/**
 * The lean of a painted land's pieces, pure (no Phaser): which pieces lean, how far, and the sheared copies a leaning piece is drawn from. The mount (painted.ts) bakes them
 * at build from the whole sheet; a streamed land's exporter bakes the same frames into each unit's sheet with these same functions.
 */

export const LEANS = new Set(['fir', 'tree', 'oak', 'pine', 'bush', 'plant', 'flower']);
/**
 * Ground cover: the kinds a composition writes for what grows low. Whatever land's placed list holds one of them sways with the trees' gust and bends
 * from the figure; there is no setting per land and no list of places. (Grass painted into the ground plate is not an object and stays still.)
 */
export const GROUND_COVER = new Set(['grass', 'tuft', 'fern', 'plant', 'flower']);
/** the kinds the split writes for one tree each (private #44 H): most stand 80-110 art px, under the 120 of the old wood-mass pieces */
export const ONE_TREE = new Set(['oak', 'pine']);
/** stone and ground the land stands on: they stand in the morning fog, however tall (a cliff or a terrace was a 'rock' piece before the split) */
export const STONE = new Set(['rock', 'cliff', 'terrace']);
/** Whether a piece rises out of the morning and evening fog (painted.ts' fog mask): a tall piece (120 art px and up) that is not stone or low growth, and every single tree of the split. */
export function risesOutOfFog(kind: string, h: number): boolean {
  if (GROUND_COVER.has(kind) || STONE.has(kind)) return false;
  return ONE_TREE.has(kind) || h >= 120;
}
/**
 * How far up a piece's row stands for the fog (0 at the foot, 1 at the top). A wood-mass piece of 300 art px kept its back row of crowns over the fog's line (look.ts fogLetThrough clears from
 * 0.55 to 0.72 up); a single tree of the split is a third of that, so by its own height the evening fog lay over its whole crown, a veil (rule L6). The split's tree reaches the clear line at 30%
 * of its height instead: its trunk stands in the fog and its crown over it, as the old masses' crowns did (private #44 H, 26.11).
 */
export function fogUp(kind: string, h: number, r: number): number {
  const up = 1 - (r + 0.5) / h;
  return ONE_TREE.has(kind) ? Math.min(1, up / 0.45) : up;
}
/** the share of a piece's height, from its foot, that holds still while the crown bends */
export const HOLD_SHARE = 0.32;

/** The padding the sheet's frame had before low growth leaned (a tree's lean; none for a piece that stood still): its shadow is read from that frame, so it stays what it was. */
export const castPad = (kind: string, h: number): number => (!LEANS.has(kind) || h < 20 ? 0 : h >= 150 ? 3 : h >= 80 ? 2 : 1);

/** How far a piece of this height may lean at its top, in art px. */
export function leanOf(kind: string, h: number): number {
  // low growth leans in proportion to its height, as PR #510's tufts do (the tip goes about a tenth of the blade)
  if (GROUND_COVER.has(kind)) return h < 6 ? 0 : Math.min(5, Math.max(1, Math.round(h * 0.11)));
  if (!LEANS.has(kind) || h < 20) return 0;
  if (h >= 150) return 3;
  if (h >= 80) return 2;
  return 1;
}

/** what of a piece the lean reads: its size and kind, and whether it is a part of the wood's mass (which never leans) */
export interface LeanPiece {
  i: number;
  kind: string;
  w: number;
  h: number;
  masspart?: boolean;
}

/** a piece's lean, 0 for a part of the mass: neighbours cut at ground-line bands must not sway out of phase, so none leans (the whole mass leaned 3 px as one) */
export const pieceLean = (o: LeanPiece): number => (o.masspart ? 0 : leanOf(o.kind, o.h));

/** whether a leaning piece goes to the low sheet (no cast pad) or the tall one */
export const isLowLean = (o: LeanPiece): boolean => castPad(o.kind, o.h) === 0;

/** The frames of one wind sheet: every leaning piece of the kind asked (low or tall) at each of its leans, -lean to lean, in rows of `wide` px with a px between frames. */
export function windLayout<P extends LeanPiece>(pieces: readonly P[], low: boolean, wide: number): { place: { o: P; lean: number; k: number; x: number; y: number }[]; high: number } {
  let px = 0;
  let py = 0;
  let row = 0;
  const place: { o: P; lean: number; k: number; x: number; y: number }[] = [];
  for (const o of pieces) {
    const lean = pieceLean(o);
    if (lean > 0 && isLowLean(o) !== low) continue;
    for (let k = lean > 0 ? -lean : 1; k <= lean; k++) {
      const fw = o.w + 2 * lean;
      if (px + fw + 1 > wide) {
        px = 0;
        py += row + 1;
        row = 0;
      }
      place.push({ o, lean, k, x: px, y: py });
      px += fw + 1;
      row = Math.max(row, o.h);
    }
  }
  return { place, high: py + row + 1 };
}

/**
 * Copies a piece into a sheet at lean `k` (its crown bent k art px, the foot held): colour and relief, every pixel of the piece, its soft edge too, so the piece at rest is
 * the source's own pixels. `src` is read at (sx, sy) in a sheet `srcW` wide, `out` written at (x + lean, y) in one `outW` wide.
 */
export function leanCopy(srcC: Uint8ClampedArray, srcN: Uint8ClampedArray, srcW: number, sx: number, sy: number, w: number, h: number, lean: number, k: number, outC: Uint8ClampedArray, outN: Uint8ClampedArray, outW: number, x: number, y: number): void {
  // the piece's own opaque rows: the crown bends, the foot holds
  let top = -1;
  let foot = -1;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if ((srcC[((sy + r) * srcW + sx + c) * 4 + 3] ?? 0) < 128) continue;
      if (top < 0) top = r;
      foot = r;
      break;
    }
  }
  const span = Math.max(1, foot - top);
  for (let r = 0; r < h; r++) {
    const up = Math.max(0, Math.min(1, (foot - r) / span));
    const weight = Math.max(0, (up - HOLD_SHARE) / (1 - HOLD_SHARE));
    const by = Math.round(k * weight ** 1.3);
    for (let c = 0; c < w; c++) {
      const from = ((sy + r) * srcW + sx + c) * 4;
      const to = ((y + r) * outW + x + lean + by + c) * 4;
      for (let n = 0; n < 4; n++) outC[to + n] = srcC[from + n] ?? 0;
      for (let n = 0; n < 4; n++) outN[to + n] = srcN[from + n] ?? 0;
    }
  }
}

/** a flat relief (up, facing the viewer) for a sheet's empty pixels */
export function flatNormals(n: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 128;
    out[i + 1] = 128;
    out[i + 2] = 255;
    out[i + 3] = 255;
  }
  return out;
}
