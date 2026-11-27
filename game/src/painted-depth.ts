/**
 * The figure's depth against the wood's mass, per pixel (13.11, round four, figure presence #16, order 5).
 *
 * The join of a wood hands over a foot-line map: for every pixel of the mass, the row of the foot of the tree that pixel belongs to (art px of the land). A figure stands in front of a
 * mass pixel when her foot row is below (greater than) that pixel's foot row, and behind it when it is above. The mass is drawn under her; the pixels that stand in front of her are drawn
 * again over her (a window of the mass's own sheet, cut to those pixels). Pure numbers here, so a test pins them.
 */

export interface FootLine {
  w: number;
  h: number;
  /** the foot row of each pixel of the land (0 = no mass there) */
  data: Uint16Array;
}

/** The map's picture is 8 bit RGB (a canvas reads 8 bits): red the high byte, green the low byte. */
export function decodeFootLine(rgba: ArrayLike<number>, w: number, h: number): Uint16Array {
  const out = new Uint16Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = ((rgba[i * 4]! << 8) | rgba[i * 4 + 1]!) & 0xffff;
  return out;
}

/** True when the decoded map holds the value the loader recorded at the probe pixel (the picture decoded exactly). */
export function footLineOk(fl: FootLine, probe: readonly [number, number, number]): boolean {
  return fl.data[probe[1] * fl.w + probe[0]] === probe[2];
}

export interface Rect {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

/** A pixel of the mass stands in front of a figure whose foot row is `row` when its own foot row is below hers. */
export function inFront(foot: number, row: number): boolean {
  return foot > row;
}

/** The sheet's pixels a window reads: colour and normal map (RGBA, `w` wide), the pieces' own place on it. */
export interface SheetPixels {
  w: number;
  colour: ArrayLike<number>;
  normal: ArrayLike<number>;
}

/**
 * One window of a piece onto the land, made as pixels: `outC` and `outN` are RGBA (`bw` x `bh`, row by row), the window's corner at (`bx`, `by`) in art px of the land, the piece's rectangle `rect` sitting
 * on the sheet at (`sx`, `sy`). A pixel keeps the piece's own colour and normal where it lies inside the piece's rectangle, has a foot row in front of `row`, and its own alpha; everywhere else it is
 * nothing (alpha 0). `see(x, y)` is how much of the pixel a see-through window takes (0..1), or nothing. Returns the count of pixels left with an alpha. `range` takes the foot rows between
 * which the cut stays the same: `lo` (the largest foot row not in front, -1 if none) to `hi` (the smallest in front, Infinity if none): a row from `lo` up to but not including `hi` cuts the same pixels.
 */
export function cutFront(outC: Uint8ClampedArray | Uint8Array, outN: Uint8ClampedArray | Uint8Array, bx: number, by: number, bw: number, bh: number, rect: Rect, sx: number, sy: number, src: SheetPixels, fl: FootLine, row: number, see?: (x: number, y: number) => number, range?: { lo: number; hi: number }): number {
  let n = 0;
  let lo = -1;
  let hi = Infinity;
  for (let j = 0; j < bh; j++) {
    const y = by + j;
    const inY = y >= rect.y0 && y < rect.y0 + rect.h && y >= 0 && y < fl.h;
    for (let i = 0; i < bw; i++) {
      const x = bx + i;
      const k = (j * bw + i) * 4;
      let a = 0;
      if (inY && x >= rect.x0 && x < rect.x0 + rect.w && x >= 0 && x < fl.w) {
        const foot = fl.data[y * fl.w + x]!;
        const f = ((sy + y - rect.y0) * src.w + sx + x - rect.x0) * 4;
        if (src.colour[f + 3]! > 0) {
          if (foot > row) { if (foot < hi) hi = foot; } else if (foot > lo) lo = foot;
        }
        if (inFront(foot, row)) a = src.colour[f + 3]!;
        if (a > 0) {
          if (see) a = Math.round(a * (1 - Math.min(1, Math.max(0, see(x, y)))));
          outC[k] = src.colour[f]!;
          outC[k + 1] = src.colour[f + 1]!;
          outC[k + 2] = src.colour[f + 2]!;
          outN[k] = src.normal[f]!;
          outN[k + 1] = src.normal[f + 1]!;
          outN[k + 2] = src.normal[f + 2]!;
          if (a > 0) n++;
        }
      }
      if (a === 0) {
        outC[k] = outC[k + 1] = outC[k + 2] = 0;
        outN[k] = outN[k + 1] = 128;
        outN[k + 2] = 255;
      }
      outC[k + 3] = a;
      outN[k + 3] = 255;
    }
  }
  if (range) {
    range.lo = lo;
    range.hi = hi;
  }
  return n;
}

/** The corner of a window `size` wide inside a piece's span `[lo, lo + len)`, as near `want` as the piece lets it be (the whole span when the piece is smaller). */
export function windowAt(want: number, lo: number, len: number, size: number): number {
  return Math.max(lo, Math.min(want, lo + len - size));
}

/**
 * The colour of a window premultiplied by its alpha, each channel rounded to the nearest level (`out` the same size as `src`, alpha copied). This is the rounding the canvas path gave the
 * front windows' textures (a canvas holds premultiplied pixels); the browser's own premultiply of a typed array floors, which differs by one level on a see-through fringe.
 */
export function premultiplyRound(src: ArrayLike<number>, out: Uint8Array | Uint8ClampedArray): void {
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3]!;
    out[i] = ((src[i]! * a + 127) / 255) | 0;
    out[i + 1] = ((src[i + 1]! * a + 127) / 255) | 0;
    out[i + 2] = ((src[i + 2]! * a + 127) / 255) | 0;
    out[i + 3] = a;
  }
}
