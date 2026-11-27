/**
 * The still water's field (look lane v10, 14.11): what the water layers (waterlayers-still.ts) read per ART pixel, taken once from the scene's water mask.
 * Pure array code, no Phaser: the tests run it on small pictures.
 *
 * Three distances in art pixels, each from a class of non-water:
 *   shore - the land that touches the frame's border (the bank), without the footprints of what stands in the water;
 *   thing - what is enclosed by water (an island, a rock, a post, a ruin's foot) and the footprints of rocks, snags and structures that stand in it;
 *   any   - the nearer of the two (the depth gradient reads this one).
 * Water that runs off the frame's edge has no bank there: the distance fields only look at pixels inside the frame, so toward an open edge the
 * water simply goes on deep, with no foam.
 */

/** one standing thing's footprint: its box in scene pixels and which of its pixels are opaque (row by row, w * h flags) */
export interface Footprint {
  x0: number;
  y0: number;
  w: number;
  h: number;
  opaque: Uint8Array;
}

export interface WaterField {
  /** the art grid */
  w: number;
  h: number;
  /** 1 where at least half of the art pixel's block of scene pixels is water */
  water: Uint8Array;
  dShore: Float32Array;
  dThing: Float32Array;
  dAny: Float32Array;
}

const INF = 1e9;

/** One row or column of the exact squared distance (Felzenszwalb and Huttenlocher): `f` the squared distances so far, written into `d`. */
function pass1d(f: Float64Array, d: Float64Array, n: number, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!;
  }
}

/** The distance in pixels from every pixel to the nearest pixel where `from` is 1; pixels where it is 1 read 0; with none, a large number everywhere. */
export function distanceTo(from: Uint8Array, w: number, h: number): Float32Array {
  const sq = new Float64Array(w * h);
  for (let i = 0; i < sq.length; i++) sq[i] = from[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = sq[y * w + x]!;
    pass1d(f, d, h, v, z);
    for (let y = 0; y < h; y++) sq[y * w + x] = d[y]!;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = sq[y * w + x]!;
    pass1d(f, d, w, v, z);
    for (let x = 0; x < w; x++) sq[y * w + x] = d[x]!;
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = sq[i]! >= INF / 2 ? 1e4 : Math.sqrt(sq[i]!);
  return out;
}

/** The 8-connected components of `mask`: a label per pixel (0 where the mask is 0) and how many there are. */
export function labelComponents(mask: Uint8Array, w: number, h: number): { label: Int32Array; count: number } {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let count = 0;
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || label[s]) continue;
    count++;
    let top = 0;
    stack[top++] = s;
    label[s] = count;
    while (top > 0) {
      const i = stack[--top]!;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mask[j] && !label[j]) {
            label[j] = count;
            stack[top++] = j;
          }
        }
      }
    }
  }
  return { label, count };
}

/**
 * The exporter leaves the outermost `edge` scene pixels of a frame without water in the bed, whatever lies there. Left as it is, that strip reads as a bank
 * along the whole frame (foam and a wet band drawn in a rectangle around the picture). Copy the nearest pixel inside the margin into it.
 */
export function fillEdge(mask: Uint8Array, w: number, h: number, edge: number): void {
  if (w <= 2 * edge || h <= 2 * edge) return;
  for (let y = 0; y < h; y++) {
    const yy = Math.min(h - 1 - edge, Math.max(edge, y));
    for (let x = 0; x < w; x++) {
      if (y >= edge && y < h - edge && x >= edge && x < w - edge) continue;
      mask[y * w + x] = mask[yy * w + Math.min(w - 1 - edge, Math.max(edge, x))]!;
    }
  }
}

/**
 * The field of a scene's water.
 * @param mask the water mask in scene pixels (1 = water), `sw` x `sh`
 * @param art scene pixels to the side of one art pixel
 * @param things the footprints of the rocks, snags and structures that stand in the water
 */
export function waterFieldOf(mask: Uint8Array, sw: number, sh: number, art: number, things: readonly Footprint[]): WaterField {
  const w = Math.floor(sw / art);
  const h = Math.floor(sh / art);
  const water = new Uint8Array(w * h);
  const half = (art * art) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let j = 0; j < art; j++) {
        const row = (y * art + j) * sw + x * art;
        for (let i = 0; i < art; i++) n += mask[row + i]!;
      }
      water[y * w + x] = n >= half ? 1 : 0;
    }
  }
  const footprint = new Uint8Array(w * h);
  for (const t of things) {
    for (let r = 0; r < t.h; r++) {
      const gy = t.y0 + r;
      if (gy < 0 || gy >= sh) continue;
      for (let c = 0; c < t.w; c++) {
        const gx = t.x0 + c;
        if (gx < 0 || gx >= sw || !t.opaque[r * t.w + c]) continue;
        const ax = Math.floor(gx / art);
        const ay = Math.floor(gy / art);
        if (ax < w && ay < h) footprint[ay * w + ax] = 1;
      }
    }
  }
  // non-water, with the footprints of what stands in the water counted as non-water
  const nw = new Uint8Array(w * h);
  for (let i = 0; i < nw.length; i++) nw[i] = !water[i] || footprint[i] ? 1 : 0;
  const { label, count } = labelComponents(nw, w, h);
  const border = new Uint8Array(count + 1);
  for (let x = 0; x < w; x++) {
    border[label[x]!] = 1;
    border[label[(h - 1) * w + x]!] = 1;
  }
  for (let y = 0; y < h; y++) {
    border[label[y * w]!] = 1;
    border[label[y * w + w - 1]!] = 1;
  }
  const shore = new Uint8Array(w * h);
  const thing = new Uint8Array(w * h);
  for (let i = 0; i < nw.length; i++) {
    if (!nw[i]) continue;
    if (border[label[i]!] && !footprint[i]) shore[i] = 1;
    else thing[i] = 1;
  }
  const any = new Uint8Array(w * h);
  for (let i = 0; i < any.length; i++) any[i] = shore[i] || thing[i] ? 1 : 0;
  return { w, h, water, dShore: distanceTo(shore, w, h), dThing: distanceTo(thing, w, h), dAny: distanceTo(any, w, h) };
}

/** The field as the water shader reads it, RGBA by art pixel: the three distances in quarter art pixels (63 art pixels at most), and 255 in alpha on water. */
export function fieldPixels(f: WaterField): Uint8ClampedArray {
  const out = new Uint8ClampedArray(f.w * f.h * 4);
  for (let i = 0; i < f.w * f.h; i++) {
    out[i * 4] = Math.min(255, Math.round(f.dShore[i]! * 4));
    out[i * 4 + 1] = Math.min(255, Math.round(f.dThing[i]! * 4));
    out[i * 4 + 2] = Math.min(255, Math.round(f.dAny[i]! * 4));
    out[i * 4 + 3] = f.water[i] ? 255 : 0;
  }
  return out;
}

/**
 * The painting's own brightness per art pixel, for the darks' floor: the mean over the pixel's block of the plate's colour as an encoded luma (Rec. 709 weights
 * on the sRGB values, 0 to 255) in the red channel. `plate` is RGBA at scene size.
 */
export function baseLumaPixels(plate: Uint8ClampedArray, sw: number, sh: number, art: number, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let j = 0; j < art; j++) {
        const yy = y * art + j;
        if (yy >= sh) break;
        for (let i = 0; i < art; i++) {
          const xx = x * art + i;
          if (xx >= sw) break;
          const k = (yy * sw + xx) * 4;
          sum += 0.2126 * plate[k]! + 0.7152 * plate[k + 1]! + 0.0722 * plate[k + 2]!;
          n++;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = n ? Math.round(sum / n) : 0;
      out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * The depth of a water body by its own geometry (order v11, 19.11): `rb` is the body's inscribed radius in art pixels (the 95th percentile of the distance from the land inside it). A marsh's
 * channel is shallow and a bay is deep, so the depth reaches its end over `reach` art pixels from the bank (a pond of radius 13 in 10, a bay of radius 50 in 40) and the ramp's strength is
 * `amp` times STILL.depth.deep (0.6 for a ditch to 1.3 for a sea). A land can say otherwise (scene.json water.slope, a factor on `amp`); the rule runs on any generated map.
 */
export const RAMP = { reachMin: 10, reachMax: 48, reachOf: 0.8, ampMin: 0.6, ampMax: 1.3, ampBase: 0.5, ampPer: 50 } as const;
export function rampOfRadius(rb: number): { reach: number; amp: number } {
  return { reach: Math.min(RAMP.reachMax, Math.max(RAMP.reachMin, RAMP.reachOf * rb)), amp: Math.min(RAMP.ampMax, Math.max(RAMP.ampMin, RAMP.ampBase + rb / RAMP.ampPer)) };
}

/**
 * The depth ramp's input per art pixel (round 13, rebuilt by order v11): R the depth 0..255 = the distance from the land mask (the shore and the islands, not what stands in the water; the
 * frame's edge is open water) blurred over 7 x 7 art pixels, smoothstepped from 2 art pixels to the body's own reach (`rampOfRadius`); G the body's strength, 0.5 + G / 255 as a factor (0.5 to 1.5);
 * A 255 on water. The shader cuts R into three bands and takes `deep * amp` L* off at the deep end.
 */
export function rampPixels(f: WaterField, slope = 1): Uint8ClampedArray {
  const dLand = distanceTo(Uint8Array.from(f.water, (v) => 1 - v), f.w, f.h); // the land mask's own: what stands in the water is not land
  const raw = Float32Array.from(dLand, (v, i) => (f.water[i] ? Math.min(v, 63) : 0));
  // each body takes its own radius: the 95th percentile of its distances
  const { label, count } = labelComponents(f.water, f.w, f.h);
  const radius: number[] = [0];
  for (let id = 1; id <= count; id++) {
    const dists: number[] = [];
    for (let i = 0; i < label.length; i++) if (label[i] === id) dists.push(raw[i]!);
    dists.sort((p, q) => p - q);
    radius.push(dists[Math.min(dists.length - 1, Math.floor(0.95 * dists.length))]!);
  }
  let d = raw;
  for (let pass = 0; pass < 2; pass++) {
    const o = new Float32Array(d.length);
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        let sum = 0;
        let n = 0;
        for (let j = -3; j <= 3; j++) {
          for (let i = -3; i <= 3; i++) {
            const k = Math.min(f.h - 1, Math.max(0, y + j)) * f.w + Math.min(f.w - 1, Math.max(0, x + i));
            if (f.water[k]) { sum += d[k]!; n++; }
          }
        }
        o[y * f.w + x] = n ? sum / n : 0;
      }
    }
    d = o;
  }
  const out = new Uint8ClampedArray(f.w * f.h * 4);
  for (let i = 0; i < d.length; i++) {
    if (!f.water[i]) continue;
    const { reach, amp } = rampOfRadius(radius[label[i]!]!);
    const t = Math.min(1, Math.max(0, (d[i]! - 2) / (reach - 2)));
    out[i * 4] = Math.round(255 * t * t * (3 - 2 * t));
    out[i * 4 + 1] = Math.round(255 * Math.min(1, Math.max(0, amp * slope - 0.5)));
    out[i * 4 + 3] = 255;
  }
  return out;
}
