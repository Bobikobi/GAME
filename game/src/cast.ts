/**
 * The cast shadow the owner picked on 18.10 (STYLE section 4), as numbers rather than as
 * drawing calls: where the sun stands at a minute of the day, and how a sprite's own alpha
 * lies on the ground. Pure, so a test can pin the direction at any hour and the shape a
 * mask casts, with no scene, texture or clock of its own.
 *
 * A pixel z rows above the lowest solid row lands at (x + z*sx, feet + z*sy), in art pixels.
 * The caller draws the spans into a mask at one alpha, so where two casters overlap the
 * ground is no darker than under one.
 *
 * The sun stands south (the GK2 method B, DECISIONS 2026-10-21): the fronts of the standing
 * things take the light and the shadow falls away from the viewer, up-screen, behind the
 * caster. So `sy` is negative, and a thing that stands north covers the shadow its neighbour
 * casts. Morning leans left, evening right, noon straight back.
 *
 * The sun's numbers are data (`params.light.sun`): keyed hours with the shear right and down
 * in whole percent, the cast alpha and the length cap. A season is a change of data, not of
 * code. `SUN_TODAY` is the valley's table when a bundle carries none, and the one the tests
 * pin.
 */

/** A minute of the day, 0 to 1439. */
export type Minute = number;

/** One hour of the sun's shear: minutes of the day, and the shear in whole percent of the caster's height. */
export interface SunKey {
  at: Minute;
  /** positive leans right, negative left */
  right: number;
  /** positive toward the viewer; negative under the sun in the south (GK2 B), the shadow falling up-screen */
  down: number;
}

/** The sun's table: the cast alpha, the longest shadow, and the hours between them. */
export interface SunTable {
  /** the cast shadow's alpha, 0 to 1 */
  alpha: number;
  /** the longest the shadow may be, in heights of the caster */
  cap: number;
  keys: readonly SunKey[];
}

/** Where the sun stands: off at night, and its shear per art pixel of height by day. */
export interface Sun {
  up: boolean;
  /** art px to the right per art px of height; negative in the morning */
  sx: number;
  /** art px toward the viewer per art px of height; negative under the sun in the south, so the shadow falls away */
  sy: number;
  /** the shadow's length as a share of the caster's height, never past the table's cap */
  length: number;
  /** the cast shadow's alpha for this bundle */
  alpha: number;
}

/**
 * STYLE section 4 as decided: 0.8 to 1.1 of the height at 08:00 and 16:30, at most 12 art px
 * past the feet at noon, the sun in the south (GK2 B): the morning shadow up-left, the
 * evening up-right.
 */
export const SUN_TODAY: SunTable = {
  alpha: 0.3,
  cap: 1.1,
  keys: [
    { at: 6 * 60, right: -103, down: -39 },
    { at: 8 * 60, right: -86, down: -37 },
    { at: 10 * 60, right: -22, down: -16 },
    { at: 12 * 60, right: 0, down: -11 },
    { at: 14 * 60, right: 22, down: -16 },
    { at: 16 * 60, right: 86, down: -37 },
    { at: 16 * 60 + 30, right: 102, down: -41 },
    { at: 18 * 60, right: 103, down: -39 },
  ],
};

/** The decided contact line and ink (STYLE section 4); the cast alpha and cap come from the table. */
export const SHADOW = { contact: 0.45, ink: 0x1b1a2e } as const;

/** A run of solid pixels in one row, inclusive at both ends. */
export type Span = readonly [number, number];

/** One row of a mask: its solid runs, left to right. */
export type Row = readonly Span[];

/** A sprite's own alpha as rows of runs, at the grid it was drawn on. */
export interface Mask {
  w: number;
  h: number;
  /** one entry per row, empty where the sprite is clear */
  rows: readonly Row[];
  /** the lowest row with a solid pixel, or -1 for an empty mask */
  feet: number;
  /** the topmost row with a solid pixel, or -1 for an empty mask */
  top: number;
}

/** One run of the shadow, at the grid the mask was drawn on. */
export interface ShadowSpan {
  x: number;
  y: number;
  w: number;
}

/** The shadow a mask casts at one sun: its runs, their bounds, and the contact run under the feet. */
export interface Shadow {
  spans: readonly ShadowSpan[];
  /** the leftmost shadow pixel, so the caller can lay the texture */
  minX: number;
  /** the rightmost shadow pixel */
  maxX: number;
  /** rows from the feet to the far edge, at least 1 when anything casts */
  height: number;
  /** the runs at the feet, for the contact line */
  contact: Row;
  /**
   * The feet row, in rows from the frame's bottom edge (negative: up). A sprite stands on its bottom edge, so its
   * lowest solid row is the row above that edge, -1 when nothing is clear below the feet. The shadow's row 0 is
   * laid on this row and the contact line on the row under it, so neither starts below what stands there.
   */
  base: number;
}

const DOWN: Sun = { up: false, sx: 0, sy: 0, length: 0, alpha: 0 };

/** Rounds half away from zero, so a shear left and a shear right mirror each other. */
function roundHalf(v: number): number {
  return v < 0 ? -Math.round(-v) : Math.round(v);
}

/** Reads `params.light.sun` into minutes and fractions, sorted; the valley's table when it is absent. */
export function sunTableOf(
  light: { alpha: number; cap: number; keys: { at: string; right: number; down: number }[] } | undefined,
): SunTable {
  if (!light) return SUN_TODAY;
  const keys = light.keys
    .map((k) => {
      const [h, m] = k.at.split(':').map(Number) as [number, number];
      return { at: h * 60 + m, right: k.right, down: k.down };
    })
    .sort((a, b) => a.at - b.at);
  return { alpha: light.alpha / 100, cap: light.cap / 100, keys };
}

/**
 * The sun at a minute of the day: the shear steps evenly between the two keys around it,
 * and the shadow never grows past the table's cap. Outside the first and the last key the
 * sun is down, so nothing casts from it; the night's own shadows come from a light's pool.
 */
export function sunAt(table: SunTable, minute: Minute): Sun {
  if (table.keys.length < 2) return DOWN;
  const first = table.keys[0]!;
  const last = table.keys[table.keys.length - 1]!;
  if (minute < first.at || minute >= last.at) return DOWN;
  let a = first;
  let b = last;
  for (let i = 0; i < table.keys.length - 1; i++) {
    const lo = table.keys[i]!;
    const hi = table.keys[i + 1]!;
    if (minute >= lo.at && minute <= hi.at) {
      a = lo;
      b = hi;
      break;
    }
  }
  const t = b.at === a.at ? 0 : (minute - a.at) / (b.at - a.at);
  let sx = (a.right + (b.right - a.right) * t) / 100;
  let sy = (a.down + (b.down - a.down) * t) / 100;
  let length = Math.hypot(sx, sy);
  if (length > table.cap && length > 0) {
    const k = table.cap / length;
    sx *= k;
    sy *= k;
    length = table.cap;
  }
  return { up: true, sx, sy, length, alpha: table.alpha };
}

/** A mask from one bit per pixel: 1 where the sprite is solid, 0 where it is clear. */
export function maskOfAlpha(alpha: Uint8Array, w: number, h: number): Mask {
  const rows: Row[] = [];
  let feet = -1;
  let top = -1;
  for (let y = 0; y < h; y++) {
    const row: Span[] = [];
    let x = 0;
    while (x < w) {
      while (x < w && (alpha[y * w + x] ?? 0) === 0) x++;
      if (x >= w) break;
      const start = x;
      while (x < w && (alpha[y * w + x] ?? 0) !== 0) x++;
      row.push([start, x - 1]);
    }
    rows.push(row);
    if (row.length > 0) {
      if (top < 0) top = y;
      feet = y;
    }
  }
  return { w, h, rows, feet, top };
}

/**
 * The shadow a mask casts at one sun: every solid run of every row above the feet, moved by
 * the run's height. Rows below the feet are clear by definition and cast nothing.
 */
export function shadowOf(mask: Mask, sun: Sun): Shadow {
  if (!sun.up || mask.feet < 0) return { spans: [], minX: 0, maxX: -1, height: 0, contact: [], base: mask.feet - mask.h };
  const spans: ShadowSpan[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let height = 0;
  for (let y = 0; y <= mask.feet; y++) {
    const row = mask.rows[y];
    if (!row || row.length === 0) continue;
    const z = mask.feet - y;
    const dy = roundHalf(z * sun.sy);
    const dx = roundHalf(z * sun.sx);
    for (const [a, b] of row) {
      spans.push({ x: a + dx, y: dy, w: b - a + 1 });
      minX = Math.min(minX, a + dx);
      maxX = Math.max(maxX, b + dx);
      height = Math.max(height, dy + 1);
    }
  }
  return { spans, minX: spans.length > 0 ? minX : 0, maxX, height, contact: mask.rows[mask.feet] ?? [], base: mask.feet - mask.h };
}

/**
 * Where a caster stands on the layer's grid, from the bottom edge of its frame (`edge`, the row its origin sits on,
 * which is the tile's foot for a thing placed on a tile): the lowest row of the sprite, the row the shadow's row 0
 * is laid on, and the contact line's row. The first two are one row and the contact line is the row under it, so a
 * shadow meets the feet and never shows ground between them.
 */
export function footRows(edge: number, shadow: Pick<Shadow, 'base'>): { feet: number; shadow: number; contact: number } {
  const feet = edge + shadow.base;
  return { feet, shadow: feet, contact: feet + 1 };
}

/** A stable key for the sun's shear, so the scene can tell when the direction moved. */
export function sunKey(sun: Sun, precision = 64): string {
  return `${roundHalf(sun.sx * precision)}:${roundHalf(sun.sy * precision)}`;
}

/**
 * A sprite's alpha brought onto a coarser grid, one cell per `f` x `f` block of art pixels, solid when at
 * least a quarter of the block is. A density-4 sprite (64 art px a tile) casts on the shadow layer's grid this
 * way, at the size it is drawn: the mask of its own 64 px would lay a shadow four times too large.
 */
export function downsampleAlpha(alpha: Uint8Array, w: number, h: number, f: number): { alpha: Uint8Array; w: number; h: number } {
  const k = Math.max(1, Math.round(f));
  if (k === 1) return { alpha, w, h };
  const ow = Math.ceil(w / k);
  const oh = Math.ceil(h / k);
  const out = new Uint8Array(ow * oh);
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      let solid = 0;
      let all = 0;
      for (let y = oy * k; y < Math.min(h, (oy + 1) * k); y++) {
        for (let x = ox * k; x < Math.min(w, (ox + 1) * k); x++) {
          all++;
          if ((alpha[y * w + x] ?? 0) !== 0) solid++;
        }
      }
      out[oy * ow + ox] = solid > 0 && solid * 4 >= all ? 1 : 0;
    }
  }
  return { alpha: out, w: ow, h: oh };
}

/** The mask of a sprite drawn mirrored (`flipX`): every run reflected about the frame's middle, left to right again. */
export function mirrorMask(mask: Mask): Mask {
  const rows = mask.rows.map((row) => row.map(([a, b]) => [mask.w - 1 - b, mask.w - 1 - a] as Span).reverse());
  return { w: mask.w, h: mask.h, rows, feet: mask.feet, top: mask.top };
}

/**
 * The box a shadow's runs fill, counted like the runs from the frame's left edge and the feet: the corner a
 * moving caster's own texture is laid at, and the texture's size. An empty shadow is one clear pixel.
 */
export function shadowBox(shadow: Shadow): { x: number; y: number; w: number; h: number } {
  if (shadow.spans.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const s of shadow.spans) {
    x0 = Math.min(x0, s.x);
    x1 = Math.max(x1, s.x + s.w);
    y0 = Math.min(y0, s.y);
    y1 = Math.max(y1, s.y + 1);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Props that lie on the ground and cast no shadow, by sprite name. Plants are not here: a flower, a reed bed, a tuft
 * of tall grass and a herb stand up from the ground and carry their shadow like a stone does (wave 2b; the
 * ground-level volume wave 1 lacked, DECISIONS 2026-10-30).
 */
export const FLAT_PROPS: ReadonlySet<string> = new Set([
  'glow_mushrooms', 'mushrooms_small', 'mushroom_patch', 'rubble', 'pebbles', 'fallen_branches',
  'log_fallen', 'log_mossy', 'dig_spot', 'fog', 'fence', 'fence_post', 'campfire_lit', 'campfire_unlit',
]);

/** "props/grass_tall_b" -> "grass_tall": a drawn variant (_b, _c, _d) follows its base prop's rule, not its own. */
export function variantBase(name: string): string {
  return name.replace(/_[b-d]$/, '');
}

/** Whether the sprite behind a texture key casts a shadow: its base name, variant letter stripped, is not flat. */
export function castsShadow(key: string): boolean {
  const name = key.split('/').pop() ?? key;
  return !FLAT_PROPS.has(variantBase(name));
}
