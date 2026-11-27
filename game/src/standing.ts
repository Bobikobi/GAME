/**
 * What stands up in a painted land, as one mask and a facing field (13.11, round four, figure presence #16, order 2: "her light lights what stands near her").
 *
 * A painted land's standing pieces (the wood's whole mass, trunks, rocks, snags, shelf objects) are pictures: they carry no normal of their own. The usual 2D form of the light on such a
 * thing is a per-pixel facing taken from its own silhouette: the pixels on the side toward the light take the light, the pixels on the far side take less. The silhouette is the union of
 * every standing piece's opaque pixels (`mask`); its outward direction is the (negated) gradient of that mask blurred over a few pixels, so a trunk's two sides point apart, a crown's rim
 * points out of the crown, and the middle of a thick stand, with nothing near to face, points nowhere (its facing is neutral). The field is `nx`, `ny`: the outward unit direction times how
 * near the pixel is to an edge, whole numbers of -127 to 127. Pure numbers, so a test pins them.
 */

export interface Standing {
  w: number;
  h: number;
  /** 1 where a standing piece has an opaque pixel */
  mask: Uint8Array;
  /** the outward direction of the silhouette at the pixel, times how near to an edge it lies (0 in the middle of a stand): -127 to 127 */
  nx: Int8Array;
  ny: Int8Array;
}

/** The blur's radius in art px (the facing field reaches about 2 x this deep from an edge), and the gradient that counts as a full edge. */
export const STANDING = { blur: 5, edge: 0.04 } as const;

/**
 * The share of the ground's light at the same distance that a standing pixel takes, by its facing step: away from the light, side on (and the middle of a stand: the ground's own share, so
 * a thick stand's inside is lit as round three lit it), toward it (a surface that faces a lamp takes more than the ground it stands on, the ground lying at a slant to it).
 */
export const FACE_SHARE = [0.55, 1, 1.3] as const;

/** A box blur of `src` (floats, `w` x `h`) with radius `r`, in place through `tmp`, edges clamped; yields every `slice` rows (columns) so a caller can spread it over frames. */
function* boxBlurSteps(src: Float32Array, tmp: Float32Array, w: number, h: number, r: number, slice: number): Generator<void, void, void> {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))]!;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / n;
      acc += src[row + Math.min(w - 1, x + r + 1)]! - src[row + Math.max(0, x - r)]!;
    }
    if (y % slice === slice - 1) yield;
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      src[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x]! - tmp[Math.max(0, y - r) * w + x]!;
    }
    if (x % slice === slice - 1) yield;
  }
}

/** The facing field of a mask (`w` x `h`, 1 where a standing piece is): the blurred mask's negated gradient, as the outward direction times how near an edge the pixel is. */
export function standingOf(mask: Uint8Array, w: number, h: number, cfg: { blur: number; edge: number } = STANDING): Standing {
  const out: { result?: Standing } = {};
  for (const _ of standingSteps(mask, w, h, out, cfg, Number.MAX_SAFE_INTEGER)) void _;
  return out.result!;
}

/** The planes standingSteps writes (nx, ny, zeroed by it) and the blurs work in (f, tmp), each w x h. */
export interface StandingBuffers {
  f: Float32Array;
  tmp: Float32Array;
  nx: Int8Array;
  ny: Int8Array;
}

/** Buffers for standingSteps to work in, handed again and again so a pass allocates nothing (a pass made 35 MB of garbage and a collection in the middle of a frame). */
/** standingOf in slices into `out.result`: the same work in the same order, a yield every `slice` rows or columns of a pass (the whole land's field was one 160 ms frame at each unit's arrival). With `buf` it works in the caller's buffers and allocates nothing. */
export function* standingSteps(mask: Uint8Array, w: number, h: number, out: { result?: Standing }, cfg: { blur: number; edge: number } = STANDING, slice = 32, buf?: StandingBuffers): Generator<void, void, void> {
  const f = buf?.f ?? new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0, i = y * w; x < w; x++, i++) f[i] = mask[i] ? 1 : 0;
    if (y % (slice * 4) === slice * 4 - 1) yield;
  }
  const tmp = buf?.tmp ?? new Float32Array(w * h);
  yield* boxBlurSteps(f, tmp, w, h, cfg.blur, slice);
  yield* boxBlurSteps(f, tmp, w, h, cfg.blur, slice);
  const nx = buf?.nx ?? new Int8Array(w * h);
  const ny = buf?.ny ?? new Int8Array(w * h);
  nx.fill(0, 0, w * h);
  ny.fill(0, 0, w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(w - 1, x + 1);
      const gx = (f[y * w + x1]! - f[y * w + x0]!) / (x1 - x0);
      const gy = (f[y1 * w + x]! - f[y0 * w + x]!) / (y1 - y0);
      const m = Math.hypot(gx, gy);
      if (m < 1e-6) continue;
      const e = Math.min(1, m / cfg.edge);
      // outward is down the gradient of the mask
      nx[i] = Math.round((-gx / m) * e * 127);
      ny[i] = Math.round((-gy / m) * e * 127);
    }
    if (y % slice === slice - 1) yield;
  }
  out.result = { w, h, mask, nx, ny };
}

/** A rectangle of pixels, `x1` and `y1` not included. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The planes of a field, and the buffers a region pass works in (each at least the crop's width x height; `cmask` too). */
export interface RegionBuffers extends StandingBuffers {
  cmask: Uint8Array;
}

/**
 * The rectangles merged where their patches (grown by what a change reaches, and the crop's margin) would touch, so a pass works on a few clusters and not on one box that spans a land.
 */
export function clusterRects(rects: Rect[], w: number, h: number, cfg: { blur: number } = STANDING): Rect[] {
  const k = standingReach(cfg) + 2 * cfg.blur + 3;
  const out = rects.map((r) => ({ ...r }));
  const touch = (a: Rect, b: Rect): boolean => a.x0 - k < b.x1 + k && b.x0 - k < a.x1 + k && a.y0 - k < b.y1 + k && b.y0 - k < a.y1 + k;
  for (let i = 0; i < out.length; i++) {
    for (let j = out.length - 1; j > i; j--) {
      if (!touch(out[i]!, out[j]!)) continue;
      const a = out[i]!;
      const b = out.splice(j, 1)[0]!;
      out[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
      j = out.length;
    }
  }
  return out.map((r) => ({ x0: Math.max(0, r.x0), y0: Math.max(0, r.y0), x1: Math.min(w, r.x1), y1: Math.min(h, r.y1) }));
}

/** How far a changed mask pixel reaches in the field: two blurs of radius r (2r) and the gradient's neighbour (1). */
export const standingReach = (cfg: { blur: number } = STANDING): number => 2 * cfg.blur + 1;

/**
 * The field made again only where a change of the mask can reach (what changed is `dirty`, a rectangle of mask pixels): `dst` takes `prev`'s planes outside it, and inside it
 * (the rectangle grown by the reach) the facing of a crop of the mask a little wider, so the crop's clamped edge does not touch what is copied back. Without `prev` `dst` is left as it is outside the patch
 * (it must be zero there, or the whole mask is `dirty`). The values match the whole pass to rounding of its running sums, not bit for bit (a test holds the bound).
 */
export function* standingRegionSteps(
  mask: Uint8Array, w: number, h: number, dirty: Rect, prev: { nx: Int8Array; ny: Int8Array } | undefined, dst: { nx: Int8Array; ny: Int8Array },
  cfg: { blur: number; edge: number } = STANDING, slice = 32, buf?: RegionBuffers,
): Generator<void, void, void> {
  const reach = standingReach(cfg);
  const grow = (r: Rect, k: number): Rect => ({ x0: Math.max(0, r.x0 - k), y0: Math.max(0, r.y0 - k), x1: Math.min(w, r.x1 + k), y1: Math.min(h, r.y1 + k) });
  const d = grow(dirty, reach);
  const c = grow(d, 2 * cfg.blur + 3);
  const cw = c.x1 - c.x0;
  const ch = c.y1 - c.y0;
  if (prev && prev !== dst) {
    dst.nx.set(prev.nx);
    dst.ny.set(prev.ny);
    yield;
  }
  const cmask = buf?.cmask ?? new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    const from = (c.y0 + y) * w + c.x0;
    cmask.set(mask.subarray(from, from + cw), y * cw);
    if (y % (slice * 4) === slice * 4 - 1) yield;
  }
  const out: { result?: Standing } = {};
  yield* standingSteps(cmask, cw, ch, out, cfg, slice, buf);
  const { nx, ny } = out.result!;
  for (let y = d.y0; y < d.y1; y++) {
    const from = (y - c.y0) * cw + (d.x0 - c.x0);
    const to = y * w + d.x0;
    const n = d.x1 - d.x0;
    dst.nx.set(nx.subarray(from, from + n), to);
    dst.ny.set(ny.subarray(from, from + n), to);
    if (y % (slice * 4) === slice * 4 - 1) yield;
  }
}

/** The 4 x 4 ordered-dither threshold of the art pixel (x, y): 1/32 to 31/32. */
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]] as const;
export function bayerAt(x: number, y: number): number {
  return BAYER4[y & 3]![x & 3]! / 16 + 1 / 32;
}

/**
 * The facing step of a standing pixel to a light: 0 (facing away), 1 (side on, or the middle of a stand) or 2 (facing it), the continuous facing 0.5 + 0.5 x (outward . toward the light) cut at the
 * art pixel's ordered-dither threshold, so a trunk's lit side is a step and not a gradient. `(nx, ny)` the field's value, `(ux, uy)` the unit vector from the pixel to the light, `bay` bayerAt.
 */
export function facingStep(nx: number, ny: number, ux: number, uy: number, bay: number): 0 | 1 | 2 {
  const s = (nx * ux + ny * uy) / 127;
  return Math.min(2, Math.max(0, Math.floor((0.5 + 0.5 * s) * 2 + bay))) as 0 | 1 | 2;
}

/** The share of the ground's light a facing step keeps (FACE_SHARE). */
export function facingShare(step: 0 | 1 | 2): number {
  return FACE_SHARE[step];
}
