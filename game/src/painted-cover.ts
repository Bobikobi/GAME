/**
 * The cover's shade (12.11, the owner's note L8: a dense forest is darker, and every ray is felt more). Pure numbers, so a test pins them and the engine reads one rule for
 * every land (no setting per land). Round two (12.11, the manager's eye on the last stills: the sand of a beach and a lit meadow had gone grey in soft blobs, "no veil"):
 *
 * - the cover is the opaque pixels of the land's canopy pieces (`CANOPY` kinds: the trees; rocks, snags, walls, low growth and bushes are not a canopy);
 * - ground takes the cover's shade only under a canopy: canopy has to stand over it on at least `sides` of its four sides (left, right, above, below) within `span` art px
 *   (a figure's height, round 3: a fan of 1 : `fan` instead of one row, so a lone pixel of canopy on one row no longer cuts the glade's edge straight for 64 art px); sand, shore, water, open grass and bare rock have none, so they take none. The gate is a yes or a no, there is no ramp. The brief said three sides; measured on the column's lit glade
 *   (bar C2, 12.11 round 2) three sides at any span left 25 to 32 percent of the glade shaded (a nook of three trees borders open grass), four sides at 64 px leave 1.3 percent inside the glade's 12 px edge band;
 * - the sun's rays are thrown along the table's own sun, in the cast pass's convention (cast.ts: a pixel z rows above its foot lands at (z * sx, z * sy)): the ground at p is
 *   in the cover's shade when the cover lies at p - z * (sx, 1 + sy) for some z in [z0, z1], the crown's height. Where no cover lies on that line there is a gap the sun
 *   comes through, and the floor there is lit at the open ground's level; a gap narrower than about two cells closes (the cover grown by `grow` cells), so no speck of noise
 *   is a ray;
 * - everything is taken on a grid of `half` art px a cell, and the picture draws the cells as they are (no blur, no ramp): the edge of a patch is a step on the art pixel.
 */

export interface CoverCfg {
  /** art px a cell of the grid the shade is taken on */
  half: number;
  /** art px: canopy within this stretch on a side counts that side as covered (about a figure's height) */
  span: number;
  /** a side looks along a fan, not along one row: for every `fan` cells it goes out, the canopy it can see widens by one cell to each side (a 1 : fan wedge); 0 is a single row, as the first rule was.
   *  A single row made a lone canopy pixel on one row a cut straight across `span` (the lit glade's edge on the column of four, 13.11: 64 art px along a cell's side); a fan makes the edge slant with the canopy. */
  fan: number;
  /** how many of the four sides (0 to 4) must be covered for ground to be under a canopy; 0 takes the gate away (a test's lever) */
  sides: number;
  /** cells the cover is grown by before the rays are thrown (a gap of fewer than 2 * grow + 1 cells closes) */
  grow: number;
  /** art px: the lowest and the highest crown height a ray passes under, and the step between the samples */
  z0: number;
  z1: number;
  step: number;
  /** the cover's shade is the cast shadow's tint taken to the power `deep0 + deepElev * elev` (`coverDeep`): a wood's floor is darker than the lone shadow of a piece (the owner's note L8),
   *  and darkest under a high sun, where the crown shuts the most light out; a low sun already leaves the open ground dim, so the floor under it is not taken as far (bar K3: the frame's
   *  first percentile stays at 10 luma or more at every hour) */
  deep0: number;
  deepElev: number;
}

export const COVER: CoverCfg = { half: 2, span: 48, fan: 4, sides: 4, grow: 2, z0: 8, z1: 72, step: 4, deep0: 1, deepElev: 0.7 };

/** The power the cast shadow's tint is taken to for the cover's shade, at a sun of this elevation (the table's `elev`, 0 to 1). */
export function coverDeep(elev: number, cfg: CoverCfg = COVER): number {
  return cfg.deep0 + cfg.deepElev * elev;
}

/** The kinds of piece whose crown is a canopy (the painted land's firs and trees, and the split valley's oaks and pines: the dappled wood shadow, rule L8, valley look H3). Anything else a land stands up (rocks, snags, walls, bushes, low growth) casts its own shadow in the cast pass and shades no floor. */
export const CANOPY = new Set(['fir', 'tree', 'oak', 'pine']);

export interface CoverMasks {
  /** cells across and down */
  w: number;
  h: number;
  cfg: CoverCfg;
  /** 255 in a cell that lies under a canopy (the gate), 0 elsewhere */
  wood: Uint8Array;
  /** 1 where the cover (grown) stops a ray */
  ray: Uint8Array;
}

/** A piece that fills the picture (its box covers `MASS_FRAC` of the scene both ways): the painting's whole wood as one piece, which has no foot of its own to cast from. */
export const MASS_FRAC = 0.8;
export function isMass(o: { w: number; h: number }, scene: { width: number; height: number }): boolean {
  return o.w >= MASS_FRAC * scene.width && o.h >= MASS_FRAC * scene.height;
}

/** A piece of the mass: the whole wood or one of its parts cut by ground line (`masspart` in the land's manifest: the mass split so a piece never covers her where she stands in front of it).
 * Either way it throws no shadow of its own and leans no more than the whole did, and its crowns still count as cover. */
export function isMassPiece(o: { w: number; h: number; masspart?: boolean }, scene: { width: number; height: number }): boolean {
  return o.masspart === true || isMass(o, scene);
}

const FAR = 99;

/** Takes the cover (1 where a pixel is cover, `W` x `H` art px) onto the grid and reads its floor and its rays' stops. */
export function coverMasks(cover: Uint8Array, W: number, H: number, cfg: CoverCfg = COVER): CoverMasks {
  const k = cfg.half;
  const w = Math.ceil(W / k);
  const h = Math.ceil(H / k);
  const n = w * h;
  // a cell is cover when at least half of its art pixels are
  const solid = new Uint8Array(n);
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      let s = 0;
      let all = 0;
      for (let y = cy * k; y < Math.min(H, cy * k + k); y++) {
        for (let x = cx * k; x < Math.min(W, cx * k + k); x++) {
          all++;
          s += cover[y * W + x]!;
        }
      }
      solid[cy * w + cx] = s * 2 >= all ? 1 : 0;
    }
  }
  // the gate: how far the canopy is on each of the four sides; ground with the canopy within `span` on at least `sides` of them is under a canopy
  const span = cfg.span / k;
  const near = new Uint8Array(n);
  const q = cfg.fan;
  const mark = (dx: number, dy: number): void => {
    // d[i]: steps along (dx, dy) to the nearest canopy cell the side can see, the scan running against the direction so the cells ahead are done first. Along the axis one step
    // costs one; with a fan a jump of `q` steps may also move one cell across (a wedge of slope 1 : q)
    const d = new Uint8Array(n);
    const xs = dx > 0 ? -1 : 1;
    const ys = dy > 0 ? -1 : 1;
    const ahead = (x: number, y: number, k: number, c: number): number => {
      const px = x + dx * k + (dx === 0 ? c : 0);
      const py = y + dy * k + (dy === 0 ? c : 0);
      return px < 0 || px >= w || py < 0 || py >= h ? FAR : d[py * w + px]!;
    };
    const cell = (x: number, y: number): void => {
      const i = y * w + x;
      if (solid[i]) d[i] = 0;
      else {
        let best = ahead(x, y, 1, 0) + 1;
        if (q > 0) best = Math.min(best, ahead(x, y, q, -1) + q, ahead(x, y, q, 1) + q);
        d[i] = Math.min(FAR, best);
      }
      if (d[i]! <= span) near[i] = near[i]! + 1;
    };
    // the loop runs along the direction, so every cell a step or a jump ahead (and the cells beside them) is done first
    if (dx !== 0) for (let x = dx > 0 ? w - 1 : 0; x >= 0 && x < w; x += xs) for (let y = 0; y < h; y++) cell(x, y);
    else for (let y = dy > 0 ? h - 1 : 0; y >= 0 && y < h; y += ys) for (let x = 0; x < w; x++) cell(x, y);
  };
  mark(1, 0);
  mark(-1, 0);
  mark(0, 1);
  mark(0, -1);
  const wood = new Uint8Array(n);
  for (let i = 0; i < n; i++) wood[i] = !solid[i] && near[i]! >= cfg.sides ? 255 : 0;
  // the rays' stops: the cover grown by `grow` cells (a box, in two passes)
  const g = cfg.grow;
  const tmp = new Uint8Array(n);
  const ray = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let d = -g; d <= g && !v; d++) {
        const xx = x + d;
        if (xx >= 0 && xx < w) v = solid[y * w + xx]!;
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let d = -g; d <= g && !v; d++) {
        const yy = y + d;
        if (yy >= 0 && yy < h) v = tmp[yy * w + x]!;
      }
      ray[y * w + x] = v;
    }
  }
  return { w, h, cfg, wood, ray };
}

/** The sample offsets (cells) of the rays at a sun: the cell at p - z * (sx, 1 + sy) for each crown height z, in cells. */
function offsets(cfg: CoverCfg, sx: number, sy: number): [number, number][] {
  const out: [number, number][] = [];
  for (let z = cfg.z0; z <= cfg.z1 + 1e-6; z += cfg.step) out.push([Math.round((z * sx) / cfg.half), Math.round((z * (1 + sy)) / cfg.half)]);
  return out;
}

/**
 * The wandering of the shade's edge (13.11, round four, bar G1): the cell (x, y) of the baked shade is read from the cell `(x + warpX, y + warpY)` of the shade as the rays and the gate made it.
 * The gate's edge (a distance) and the rays' union (steps of one crown height) both run straight along a cell's side for tens of art px, whatever the land. The offsets are two random walks
 * of whole cells, deterministic (a fixed seed, so the same on every machine and every land): the row's shift along the x axis changes by one cell every `WARP_BLOCK` rows, the column's shift
 * along y every `WARP_BLOCK` columns, never staying put from one block to the next and never straying more than `WARP_REACH` cells. So no edge runs along a cell's side for more than
 * `WARP_BLOCK` cells (6 art px), and the edge it leaves is a broken staircase of 2 art px steps, not a blur.
 */
export const WARP_BLOCK = 3;
export const WARP_REACH = 3;
const WARP_N = 1024;
function walk(seed: number): Int8Array {
  const t = new Int8Array(WARP_N);
  let v = 0;
  let s = seed >>> 0;
  for (let i = 0; i < WARP_N; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    let step = s >>> 31 ? 1 : -1;
    if (v + step > WARP_REACH || v + step < -WARP_REACH) step = -step;
    v += step;
    t[i] = v;
  }
  return t;
}
const WARP_X = walk(0x9e3779b9);
const WARP_Y = walk(0x7f4a7c15);
export function warpOf(x: number, y: number): [number, number] {
  return [WARP_X[Math.floor(y / WARP_BLOCK) % WARP_N]!, WARP_Y[Math.floor(x / WARP_BLOCK) % WARP_N]!];
}

/** The shade the cover puts on each cell (0 lit to 255 in the cover's shade) at a sun, written into the alpha of `out` (RGBA, `w * h * 4`, the colour channels set to 255 here). */
export function coverBake(m: CoverMasks, sx: number, sy: number, out: Uint8ClampedArray, warp: boolean = true): void {
  for (const _ of coverBakeSteps(m, sx, sy, out, warp)) void _;
}

/** coverBake in slices: the same work in the same order, a yield every few dozen rows, so a caller can spend a frame's budget and go on in the next (the bake was one 76 ms frame). */
export function* coverBakeSteps(m: CoverMasks, sx: number, sy: number, out: Uint8ClampedArray, warp: boolean = true): Generator<void, void, void> {
  const { w, h, wood, ray } = m;
  const off = offsets(m.cfg, sx, sy);
  const raw = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const wd = wood[i]!;
      if (wd === 0) continue;
      let shaded = 0;
      for (const [dx, dy] of off) {
        const xx = x - dx;
        const yy = y - dy;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h && ray[yy * w + xx]) {
          shaded = 1;
          break;
        }
        // beyond the picture's edge the wood goes on: the side the ray comes from is not clear sky
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) {
          shaded = 1;
          break;
        }
      }
      raw[i] = shaded ? wd : 0;
    }
    if (y % 48 === 47) yield;
  }
  const fin = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let a = raw[y * w + x]!;
      if (warp) {
        const [wx, wy] = warpOf(x, y);
        const sxx = Math.min(w - 1, Math.max(0, x + wx));
        const syy = Math.min(h - 1, Math.max(0, y + wy));
        a = raw[syy * w + sxx]!;
      }
      fin[y * w + x] = a;
    }
    if (y % 128 === 127) yield;
  }
  if (warp) yield* breakRunsSteps(fin, w, h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    out[o] = out[o + 1] = out[o + 2] = 255;
    out[o + 3] = fin[i]!;
  }
}

/** The longest stretch of the shade's edge that may follow one cell's side: 3 cells, 6 art px, under the brief's 8 (bar G1). */
export const RUN_MAX = 3;

/**
 * Breaks every straight stretch of the shade's edge longer than `RUN_MAX` cells (13.11, round four, G1): the warp breaks most, but two offsets that cancel (a slanted edge and a walk that climbs
 * the other way) leave a straight run now and then. Along such a run every second or third cell (the stretch in between 2 or 3, taken from a hash of the place, so no teeth are regular) is taken out
 * of the shade: the edge there steps back one cell. Only ever takes shade away, never adds it, so nothing spills beyond the gate; passes repeat until no run is left (a cell taken out can lengthen a
 * neighbour's run by one; the passes are bounded).
 */
export function breakRuns(m: Uint8Array, w: number, h: number): void {
  for (const _ of breakRunsSteps(m, w, h)) void _;
}

/** breakRuns in slices: the same passes in the same order, a yield every 48 lines. */
export function* breakRunsSteps(m: Uint8Array, w: number, h: number): Generator<void, void, void> {
  const hash = (x: number, y: number): number => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  // one line of cells (a row for the horizontal edges, a column for the vertical): the cells where the edge lies, then each run of them longer than RUN_MAX is notched
  const line = (len: number, isEdge: (i: number) => boolean, cut: (i: number) => void, key: (i: number) => number): number => {
    let changed = 0;
    let i = 0;
    while (i < len) {
      if (!isEdge(i)) {
        i++;
        continue;
      }
      let j = i;
      while (j < len && isEdge(j)) j++;
      if (j - i > RUN_MAX) {
        // notches every 2 or 3 cells along the run, the first one after the first stretch
        let at = i + 2 + (hash(key(i), i) & 1);
        while (at < j) {
          cut(at);
          changed++;
          at += 3 + (hash(key(at), at) & 1);
        }
      }
      i = j;
    }
    return changed;
  };
  for (let pass = 0; pass < 6; pass++) {
    let changed = 0;
    for (const dir of [1, -1]) {
      for (let y = 0; y < h - 1; y++) {
        changed += line(
          w,
          (x) => (dir === 1 ? m[y * w + x]! > 0 && m[(y + 1) * w + x] === 0 : m[y * w + x] === 0 && m[(y + 1) * w + x]! > 0),
          (x) => {
            m[(dir === 1 ? y : y + 1) * w + x] = 0;
          },
          () => y,
        );
        if (y % 48 === 47) yield;
      }
      for (let x = 0; x < w - 1; x++) {
        changed += line(
          h,
          (y) => (dir === 1 ? m[y * w + x]! > 0 && m[y * w + x + 1] === 0 : m[y * w + x] === 0 && m[y * w + x + 1]! > 0),
          (y) => {
            m[y * w + (dir === 1 ? x : x + 1)] = 0;
          },
          () => x,
        );
        if (x % 48 === 47) yield;
      }
    }
    if (!changed) return;
  }
}

/** The same shade at one art pixel (0 to 1), softened over the cells round it as the picture's blur softens a patch: what the figure's shadow weakens by. */
export function coverAt(m: CoverMasks, ax: number, ay: number, sx: number, sy: number): number {
  const k = m.cfg.half;
  const cx = Math.floor(ax / k);
  const cy = Math.floor(ay / k);
  const off = offsets(m.cfg, sx, sy);
  let sum = 0;
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      n++;
      if (x < 0 || x >= m.w || y < 0 || y >= m.h) continue;
      const wd = m.wood[y * m.w + x]!;
      if (wd === 0) continue;
      let shaded = 0;
      for (const [ox, oy] of off) {
        const xx = x - ox;
        const yy = y - oy;
        if (xx < 0 || xx >= m.w || yy < 0 || yy >= m.h || m.ray[yy * m.w + xx]) {
          shaded = 1;
          break;
        }
      }
      sum += shaded * (wd / 255);
    }
  }
  return sum / n;
}
