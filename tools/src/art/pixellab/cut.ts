/**
 * Cuts a sheet drawn on a flat background into its pieces by connected components: a port of the trial's `cut.py`.
 * The background is the colour that most of the sheet's border has; a pixel is a piece when it differs from it by
 * more than `tolerance` (summed over the three channels) and is not transparent; pieces within `grow` pixels of each
 * other are one piece (a figure with a gap between its legs stays whole); a piece under `minArea` pixels is dropped
 * as a speck. Pieces come out in the order their first pixel is met, left to right, top to bottom.
 */
import { PNG } from 'pngjs';

export interface CutOptions {
  tolerance?: number;
  minArea?: number;
  grow?: number;
}

export function cutSheet(sheet: PNG, options: CutOptions = {}): PNG[] {
  const { tolerance = 26, minArea = 60, grow = 2 } = options;
  const { width: w, height: h, data } = sheet;
  const counts = new Map<number, number>();
  const edge = (x: number, y: number): void => {
    const i = (y * w + x) * 4;
    const k = ((data[i] as number) << 16) | ((data[i + 1] as number) << 8) | (data[i + 2] as number);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (let x = 0; x < w; x += 1) {
    edge(x, 0);
    edge(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    edge(0, y);
    edge(w - 1, y);
  }
  let bg = 0;
  let best = -1;
  for (const [k, n] of counts) {
    if (n > best || (n === best && k < bg)) {
      best = n;
      bg = k;
    }
  }
  const br = (bg >> 16) & 255;
  const bgreen = (bg >> 8) & 255;
  const bb = bg & 255;
  const fg = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p += 1) {
    const i = p * 4;
    const far = Math.abs((data[i] as number) - br) + Math.abs((data[i + 1] as number) - bgreen) + Math.abs((data[i + 2] as number) - bb) > tolerance;
    fg[p] = far && (data[i + 3] as number) > 0 ? 1 : 0;
  }
  const label = new Int32Array(w * h);
  const pieces: PNG[] = [];
  let n = 0;
  for (let start = 0; start < w * h; start += 1) {
    if (fg[start] === 0 || label[start] !== 0) continue;
    n += 1;
    label[start] = n;
    const stack = [start];
    const members: number[] = [];
    let top = h;
    let left = w;
    let bottom = 0;
    let right = 0;
    while (stack.length > 0) {
      const p = stack.pop() as number;
      members.push(p);
      const y = Math.floor(p / w);
      const x = p - y * w;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
      for (let dy = -grow; dy <= grow; dy += 1) {
        for (let dx = -grow; dx <= grow; dx += 1) {
          const v = y + dy;
          const u = x + dx;
          if (v < 0 || v >= h || u < 0 || u >= w) continue;
          const q = v * w + u;
          if (fg[q] === 1 && label[q] === 0) {
            label[q] = n;
            stack.push(q);
          }
        }
      }
    }
    if (members.length < minArea) continue;
    const out = new PNG({ width: right - left + 1, height: bottom - top + 1 });
    for (const p of members) {
      const y = Math.floor(p / w);
      const x = p - y * w;
      const from = p * 4;
      const to = ((y - top) * out.width + (x - left)) * 4;
      out.data[to] = data[from] as number;
      out.data[to + 1] = data[from + 1] as number;
      out.data[to + 2] = data[from + 2] as number;
      out.data[to + 3] = 255;
    }
    pieces.push(out);
  }
  return pieces;
}
