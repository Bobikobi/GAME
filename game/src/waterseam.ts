/**
 * The seam band of a body of still water painted in two tones (private #44, the valley's lake, V5).
 *
 * Two frames of a joined block can paint the one lake apart: a light blue above, a deep teal below, met on a hard saw-edged cut. The engine's water layer already draws over the whole body, so the
 * fix lives here and never in the painting: where a light part of a body meets a dark part on a hard edge, the light water takes the dark tone's colour over a band, 100% at the cut and 0 at
 * `band` art pixels from it, so the two tones meet on one colour and the light shallows fade into the deep like the depth ramp's own. Like every pass of the still water it can only take light off:
 * the result is a per-channel multiplier (at most 1) the darks pass lays over the painting, so the painting's own ripples and shores stay, scaled, and nothing is made up.
 *
 * A hard edge is a light pixel with a dark one within `near` art pixels; a smooth depth gradient (a pond's shallows to its deep) spans many more, so it is left alone. A body with no such edge gets a
 * multiplier of 1 everywhere: the layer is unchanged for every land that has none.
 *
 * The painted cut also carries its own outline, a pixel or two of a brighter blue between the light class and the dark one, which the share by luma (toneAtScene) would leave out. Those pixels are drawn
 * down to the colour of the water beside them (`fixed` lists them, so the share takes them whole). A darker outline cannot be lifted: the layer can only take light off.
 */
import { distanceTo, labelComponents } from './waterfield';

export const SEAM = {
  /** encoded luma (Rec. 709 weights on the sRGB values, 0 to 1) from which a water pixel is light, and up to which it is dark */
  light: 0.42,
  dark: 0.37,
  /** a light pixel this close (art px) to a dark one is on a hard edge */
  near: 6,
  /** the dark water must differ from the light water's hue by this many degrees: a dark tone of the same hue is the body's depth (a stream's, a shadow's), not a second painting */
  hue: 12,
  /** the band's width in art pixels: the light water is fully the dark tone at the cut and untouched this far from it */
  band: 64,
  /** the box radius (art px) the cut's distance field is smoothed over, so the band's lines are round and not the cut's saw */
  round: 10,
  /** the box radius (art px) the dark tone is averaged over, and the radius the painting's local tone is averaged over to keep its own ripples */
  toneRadius: 14,
  /** the dark water the band fades to is read this far from the light water (art px): beyond the painted outline of the cut */
  toneFrom: 4,
  toneTo: 18,
  localRadius: 2,
  /** the cut's own outline (V5c): a water pixel this close (art px) to the cut that is brighter than the water 3 to `refRadius` px from it, in any channel, by more than `devFrom` (0 to 1; fully by `devTo`), is drawn down to the colour of that water */
  outline: 2,
  outlineLuma: 0.3,
  refRadius: 5,
  devFrom: 0.02,
  devTo: 0.05,
} as const;

/** a box blur of `src` (w x h) with clamped edges, radius `r`, run twice: close to a gaussian and cheap */
function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  let a = src;
  for (let pass = 0; pass < 2; pass++) {
    const t = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += a[y * w + Math.min(w - 1, Math.max(0, x))]!;
      for (let x = 0; x < w; x++) {
        t[y * w + x] = sum;
        sum += a[y * w + Math.min(w - 1, x + r + 1)]! - a[y * w + Math.max(0, x - r)]!;
      }
    }
    const o = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += t[Math.min(h - 1, Math.max(0, y)) * w + x]!;
      for (let y = 0; y < h; y++) {
        o[y * w + x] = sum;
        sum += t[Math.min(h - 1, y + r + 1) * w + x]! - t[Math.max(0, y - r) * w + x]!;
      }
    }
    const n = (2 * r + 1) * (2 * r + 1);
    for (let i = 0; i < o.length; i++) o[i] = o[i]! / n;
    a = o;
  }
  return a;
}

/** the hue in degrees of an RGB colour (0 to 1 each) */
const hueOf = (r: number, g: number, b: number): number => {
  const h = (Math.atan2(1.7320508 * (g - b), 2 * r - g - b) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
};

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * The seam multiplier per art pixel: RGBA, the red, green and blue the share of the painting's colour the water keeps (255 = all of it), alpha 255. `plate` is RGBA at scene size, `water` the field's
 * mask (1 on water) at art size `w` x `h`. `seam` is how many pixels lie on a hard edge (0: the multiplier is 1 everywhere).
 */
export function seamPixels(plate: Uint8ClampedArray, sw: number, sh: number, art: number, water: Uint8Array, w: number, h: number): { rgba: Uint8ClampedArray; seam: number; fixed: Uint8Array } {
  const fixed = new Uint8Array(w * h);
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  const n = w * h;
  const col = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let r = 0;
      let g = 0;
      let b = 0;
      let c = 0;
      for (let j = 0; j < art && y * art + j < sh; j++) {
        for (let k = 0; k < art && x * art + k < sw; k++) {
          const p = ((y * art + j) * sw + x * art + k) * 4;
          r += plate[p]!;
          g += plate[p + 1]!;
          b += plate[p + 2]!;
          c++;
        }
      }
      if (!c) continue;
      col[0]![i] = r / c / 255;
      col[1]![i] = g / c / 255;
      col[2]![i] = b / c / 255;
    }
  }
  // the tone each pixel is judged by: its 3 x 3 neighbourhood on the water, so a single dark ripple does not make a dark pixel
  const wf = new Float32Array(n);
  for (let i = 0; i < n; i++) wf[i] = water[i] ? 1 : 0;
  const wb3 = blur(wf, w, h, 1);
  const lb = col.map((c) => {
    const m = new Float32Array(n);
    for (let i = 0; i < n; i++) m[i] = water[i] ? c[i]! : 0;
    return blur(m, w, h, 1);
  });
  const own = new Float32Array(n); // each art pixel's own luma: the blurred one only sorts the classes, it must not shade the cut's own pixels
  for (let i = 0; i < n; i++) own[i] = 0.2126 * col[0]![i]! + 0.7152 * col[1]![i]! + 0.0722 * col[2]![i]!;
  const isLight = new Uint8Array(n);
  const isDark = new Uint8Array(n);
  const hue = new Float32Array(n);
  let lx = 0;
  let ly = 0;
  for (let i = 0; i < n; i++) {
    if (!water[i] || wb3[i]! <= 0.05) continue;
    const y = (0.2126 * lb[0]![i]! + 0.7152 * lb[1]![i]! + 0.0722 * lb[2]![i]!) / wb3[i]!;
    hue[i] = hueOf(lb[0]![i]! / wb3[i]!, lb[1]![i]! / wb3[i]!, lb[2]![i]! / wb3[i]!);
    if (y >= SEAM.light) {
      isLight[i] = 1;
      lx += Math.cos((hue[i]! * Math.PI) / 180);
      ly += Math.sin((hue[i]! * Math.PI) / 180);
    } else if (y <= SEAM.dark) isDark[i] = 1;
  }
  if (!lx && !ly) return { rgba, seam: 0, fixed };
  // the dark water that counts is a different hue family from the light water
  const lightHue = (Math.atan2(ly, lx) * 180) / Math.PI;
  const apart = (hh: number): boolean => Math.abs(((hh - lightHue + 540) % 360) - 180) >= SEAM.hue;
  for (let i = 0; i < n; i++) {
    if (!isDark[i]) continue;
    if (!apart(hue[i]!)) isDark[i] = 0;
  }
  if (!isDark.some((v) => v === 1)) return { rgba, seam: 0, fixed };
  const toLight = distanceTo(isLight, w, h);
  const edge = new Uint8Array(n);
  let seam = 0;
  for (let i = 0; i < n; i++) {
    if (isDark[i] && toLight[i]! <= SEAM.near) {
      edge[i] = 1;
      seam++;
    }
  }
  if (!seam) return { rgba, seam: 0, fixed };
  // the distance to the cut, smoothed: the iso-lines of the raw distance copy the cut's zigzag over the whole band, the smoothed ones round off within a few pixels of it
  const raw = distanceTo(edge, w, h);
  const sm = blur(Float32Array.from(raw, (v) => Math.min(v, SEAM.band * 2)), w, h, SEAM.round);
  const toEdge = Float32Array.from(raw, (v, i) => Math.max(0, Math.min(v, sm[i]! - SEAM.round * 0.5)));
  // the dark tone near the cut: the colour of the dark water just beyond the cut's own outline (`toneFrom` to `toneTo` art pixels from the light water), averaged over a wide box (where none lies in reach, the mean of them all).
  // The cut's own dark pixels are the painting's outline, darker than the water they edge: they set where the band is, never what colour it fades to.
  const src = new Uint8Array(n);
  let sn = 0;
  for (let i = 0; i < n; i++) {
    if (isDark[i] && toLight[i]! >= SEAM.toneFrom && toLight[i]! <= SEAM.toneTo) {
      src[i] = 1;
      sn++;
    }
  }
  if (!sn) for (let i = 0; i < n; i++) if (edge[i]) src[i] = 1;
  const ef = new Float32Array(n);
  for (let i = 0; i < n; i++) ef[i] = src[i]!;
  const en = blur(ef, w, h, SEAM.toneRadius);
  const tone = [0, 1, 2].map((c) => {
    const m = new Float32Array(n);
    for (let i = 0; i < n; i++) m[i] = src[i] ? col[c]![i]! : 0;
    return blur(m, w, h, SEAM.toneRadius);
  });
  const mean = [0, 1, 2].map((c) => {
    let s = 0;
    let k = 0;
    for (let i = 0; i < n; i++) if (src[i]) {
      s += col[c]![i]!;
      k++;
    }
    return s / Math.max(1, k);
  });
  // the painting's own tone of the light water in a small box (the dark water beside it left out, so the cut does not mix into it): the multiplier is smooth and the painted ripples ride on top of it
  const lw = new Float32Array(n);
  for (let i = 0; i < n; i++) lw[i] = water[i] && own[i]! > SEAM.dark ? 1 : 0;
  const wl = blur(lw, w, h, SEAM.localRadius);
  const local = [0, 1, 2].map((c) => {
    const m = new Float32Array(n);
    for (let i = 0; i < n; i++) m[i] = lw[i] ? col[c]![i]! : 0;
    return blur(m, w, h, SEAM.localRadius);
  });
  for (let i = 0; i < n; i++) {
    if (!water[i] || own[i]! <= SEAM.dark) continue;
    const k = 1 - smooth(0, SEAM.band, toEdge[i]!);
    if (k <= 0) continue;
    for (let c = 0; c < 3; c++) {
      const t = en[i]! > 0.002 ? tone[c]![i]! / en[i]! : mean[c]!;
      const p = wl[i]! > 0.05 ? local[c]![i]! / wl[i]! : col[c]![i]!;
      const ratio = Math.min(1, t / Math.max(p, 0.004));
      rgba[i * 4 + c] = Math.round(255 * (1 + k * (ratio - 1)));
    }
  }
  // the cut's outline: what the multiplier left (the plate's colour times it) against the water 3 to refRadius px off the cut
  const res = [0, 1, 2].map((c) => Float32Array.from(col[c]!, (v, i) => v * (rgba[i * 4 + c]! / 255)));
  const zone = new Uint8Array(n);
  const rest = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!water[i]) continue;
    if (raw[i]! <= SEAM.outline) zone[i] = 1;
    else rest[i] = 1;
  }
  const rn = blur(rest, w, h, SEAM.refRadius);
  const ref = res.map((m) => {
    const t = new Float32Array(n);
    for (let i = 0; i < n; i++) t[i] = rest[i] ? m[i]! : 0;
    return blur(t, w, h, SEAM.refRadius);
  });
  for (let i = 0; i < n; i++) {
    if (!zone[i] || rn[i]! < 0.08) continue;
    const t = [0, 1, 2].map((c) => ref[c]![i]! / rn[i]!);
    const dev = Math.max(Math.abs(res[0]![i]! - t[0]!), Math.abs(res[1]![i]! - t[1]!), Math.abs(res[2]![i]! - t[2]!));
    const k = smooth(SEAM.devFrom, SEAM.devTo, dev);
    if (k <= 0) continue;
    for (let c = 0; c < 3; c++) {
      const own = res[c]![i]!;
      const target = own + k * (t[c]! - own);
      if (target < own) {
        rgba[i * 4 + c] = Math.round((rgba[i * 4 + c]! * target) / Math.max(own, 0.004));
        fixed[i] = 1;
      }
    }
  }
  return { rgba, seam, fixed };
}

/** what counts as a patch of painted water the bed missed: its blue, its least size and how much of its rim must lie on bed water */
export const MISSED = { blueOverRed: 80, blueOverGreen: 28, luma: 0.3, area: 900, rim: 0.2, grow: 3 } as const;

/**
 * Painted water the water bed missed. The exporter's bed is the walk map's water; where a frame's painting holds a flat patch of water the bed leaves out (the lake's pale wedge, a lobe of "land" that
 * the painting draws as blue water), the layer would treat the patch as a bank: foam drawn along its edge, no ripples, no depth, and the seam band stopped at it. A patch is a connected run of
 * water-blue plate pixels outside the bed that is at least `area` scene pixels and has `rim` of its rim on the bed's water: it joins the bed, grown by `grow` so its anti-aliased edge goes with it.
 * `mask` (1 = water) is changed in place; returns how many pixels were added.
 */
export function addMissedWater(mask: Uint8Array, plate: Uint8ClampedArray, sw: number, sh: number): number {
  const n = sw * sh;
  const cand = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (mask[i]) continue;
    const r = plate[i * 4]!;
    const g = plate[i * 4 + 1]!;
    const b = plate[i * 4 + 2]!;
    if (b - r >= MISSED.blueOverRed && b - g >= MISSED.blueOverGreen && (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 >= MISSED.luma) cand[i] = 1;
  }
  const { label, count } = labelComponents(cand, sw, sh);
  if (!count) return 0;
  const area = new Int32Array(count + 1);
  const rim = new Int32Array(count + 1);
  const wet = new Int32Array(count + 1);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const l = label[y * sw + x]!;
      if (!l) continue;
      area[l]!++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
        const j = yy * sw + xx;
        if (label[j] === l) continue;
        rim[l]!++;
        if (mask[j]) wet[l]!++;
      }
    }
  }
  const keep = new Uint8Array(count + 1);
  for (let l = 1; l <= count; l++) if (area[l]! >= MISSED.area && rim[l]! > 0 && wet[l]! / rim[l]! >= MISSED.rim) keep[l] = 1;
  const add = new Uint8Array(n);
  let added = 0;
  const g = MISSED.grow;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (!keep[label[y * sw + x]!]) continue;
      for (let dy = -g; dy <= g; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= sh) continue;
        for (let dx = -g; dx <= g; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < sw) add[yy * sw + xx] = 1;
        }
      }
    }
  }
  for (let i = 0; i < n; i++) if (add[i] && !mask[i]) {
    mask[i] = 1;
    added++;
  }
  return added;
}

/**
 * The seam multiplier at scene resolution, RGBA like `seamPixels`'. An art cell that straddles the cut holds light and dark scene pixels; the cell's multiplier laid on all of them would take the dark ones
 * (already the dark tone) down a second time and draw a dark line along the whole cut. So each scene pixel keeps the share of its cell's multiplier that its own brightness says is light: a dark pixel
 * (encoded luma at most `SEAM.dark`) none of it, a light one (from `SEAM.light`) all of it. `grid` is the shader's art-cell offset in scene pixels (waterstill.ts STILL.grid).
 */
export function toneAtScene(art: Uint8ClampedArray, fixed: Uint8Array, w: number, plate: Uint8ClampedArray, sw: number, sh: number, cell: number, grid: { x: number; y: number }): Uint8ClampedArray {
  const out = new Uint8ClampedArray(sw * sh * 4).fill(255);
  const h = art.length / 4 / w;
  for (let y = 0; y < sh; y++) {
    const ay = Math.min(h - 1, Math.floor((y + grid.y) / cell));
    for (let x = 0; x < sw; x++) {
      const ax = Math.min(w - 1, Math.floor((x + grid.x) / cell));
      const p = (y * sw + x) * 4;
      const luma = (0.2126 * plate[p]! + 0.7152 * plate[p + 1]! + 0.0722 * plate[p + 2]!) / 255;
      // a cell whose outline pixel was drawn down (`fixed`) takes the multiplier on its middle tones too (a pixel between the dark and the light class is the outline's own blue)
      const share = fixed[ay * w + ax] ? Math.max(smooth(SEAM.dark, SEAM.light, luma), smooth(SEAM.outlineLuma, SEAM.dark, luma)) : smooth(SEAM.dark, SEAM.light, luma);
      if (share <= 0) continue;
      // the cell's own multiplier; a cell that averaged dark has none, yet a light pixel of the cut sits in it: it takes the strongest one of the cells around it
      let a = (ay * w + ax) * 4;
      if (art[a] === 255 && art[a + 1] === 255 && art[a + 2] === 255) {
        let best = 3 * 255;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const bx = ax + dx;
            const by = ay + dy;
            if (bx < 0 || by < 0 || bx >= w || by >= h) continue;
            const b = (by * w + bx) * 4;
            const sum = art[b]! + art[b + 1]! + art[b + 2]!;
            if (sum < best) {
              best = sum;
              a = b;
            }
          }
        }
        if (best === 3 * 255) continue;
      }
      for (let c = 0; c < 3; c++) out[p + c] = Math.round(255 - share * (255 - art[a + c]!));
    }
  }
  return out;
}
