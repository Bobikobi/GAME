/**
 * The day's weather as the valley shows it (issue 581, NATURE section 4). The kernel draws the day's sky from
 * the player's region card; this reads it into a look: how heavy the cloud, how much rain, how long the banks
 * stay. Rain is drawn as the owner picked it on 21.10 (DECISIONS "Rain: the drops fall and land, and the wet
 * world shines", frame `2026-10-21-rain-both.png`): streaks in the air, and each drop's mark where it lands,
 * answering the ground under it. A fog day only keeps the existing banks longer; the fog's own look is not seen
 * yet (NATURE 11), so nothing new is drawn for it. Pure, so a test reads the very pixels the scene bakes.
 */
import type { RegionCardDef, WeatherName } from '@game/schema';

/**
 * The drop's colour, and its alpha from tail to head. The 21.10 pick was 2 px at `#c4ecf8`; on the rich grid at phone
 * size that read as snow, so a streak is long, thin and cooler (the manager's review of #629, beside a storm in a big
 * pixel game: long thin blue dashes, few of them).
 */
export const RAIN_RGB = 0xa4cdec;
export const RAIN_HEAD = 0.72;
export const RAIN_TAIL = 0.15;
/** A streak's length in art pixels, and how many pixels it falls for each one it leans with the wind. */
export const RAIN_LENGTH = 14;
export const RAIN_SLANT = 3;
/** Drops alive per square world unit at a card's full look: about 140 over a phone's view. */
export const RAIN_DENSITY = 0.007;
/** How fast a drop falls along its streak's own line, right and down with the wind, in world units a second. */
export const RAIN_FALL = 220;
/** A drop's life in the air and a mark's on the ground, ms. */
export const RAIN_LIFE = 300;
export const MARK_LIFE = 340;
/** The most drops alive at once, so a wide screen pays for no more than the eye reads. */
export const RAIN_MAX = 600;
/** Marks a second for every drop a second. Fewer, longer drops than the 21.10 stills, so a larger share of them lands in sight. */
export const LANDING_PER_DROP = 0.5;
/** The rain's light (NATURE 4, the Rain row): the day minus 30%, cool, `#275a99` at 15%. */
export const RAIN_WASH = { rgb: 0x275a99, alpha: 0.15, dim: 0.3 } as const;
/** A fog day keeps the banks across the view all day (NATURE 4, the Fog row), at least this share of their dawn weight. */
export const FOG_DAY_FLOOR = 0.35;

/** What a drop leaves where it lands (Rain B): stone a ring and a crown, water a flat ripple, grass a drop, sand a dimple. */
export type Landing = 'ring' | 'ripple' | 'drop' | 'dimple';
export const LANDINGS: readonly Landing[] = ['ring', 'ripple', 'drop', 'dimple'];

/**
 * The mark by ground tag. A tag absent here takes none: the grove's canopy holds its drop on the leaf, and a room
 * has a roof. The marks by prop kind (a wall's run, a roof's bead, the drop leaving a canopy) are the next step.
 */
export const LANDING: Readonly<Partial<Record<string, Landing>>> = {
  town: 'ring',
  ruin: 'ring',
  water: 'ripple',
  meadow: 'drop',
  path: 'dimple',
  riverbank: 'dimple',
};

export interface SkyLook {
  /** the sun is behind the weather: no shafts, and the day's cloud patches give way to one even light (21.10: 112 to 86 over the frame, no patches) */
  overcast: boolean;
  /** the rain's share of the decided look, 0 on a dry day */
  rain: number;
  /** the share of their dawn weight the banks keep all day, and how much of their weight the card gives them */
  fogFloor: number;
  fogScale: number;
  /** the rain's cool, dimmed light is on */
  wash: boolean;
}

/** The look of a day's sky over a region. No sky (an old server) and a clear day are the valley as it was. */
export function skyLook(sky: WeatherName | undefined, card: RegionCardDef | undefined): SkyLook {
  if (sky === 'rain') return { overcast: true, rain: (card?.look.rain ?? 1000) / 1000, fogFloor: 0, fogScale: 1, wash: true };
  if (sky === 'fog') return { overcast: true, rain: 0, fogFloor: FOG_DAY_FLOOR, fogScale: (card?.look.fog ?? 1000) / 1000, wash: false };
  return { overcast: false, rain: 0, fogFloor: 0, fogScale: 1, wash: false };
}

/** The banks' strength for the hour's fog curve under the day's look, 0 to 1. */
export function bankFog(fog: number, look: SkyLook): number {
  return Math.min(1, Math.max(fog, look.fogFloor) * look.fogScale);
}

/** Drops alive over a view of this many square world units. */
export function dropsAlive(area: number, rain: number): number {
  return Math.min(RAIN_MAX, Math.round(area * RAIN_DENSITY * rain));
}

/** Marks a second on the tiles of one landing in view, out of all the tiles the view holds. */
export function landingsPerSecond(alive: number, tiles: number, viewTiles: number): number {
  if (alive <= 0 || tiles <= 0 || viewTiles <= 0) return 0;
  return ((alive * 1000) / RAIN_LIFE) * LANDING_PER_DROP * Math.min(1, tiles / viewTiles);
}

/**
 * The colour a multiply layer draws the rain's light with: `rgb` laid over white at `alpha` for the lean, then
 * scaled so its luminance is the day less `dim`. Multiplied over the scene it is the day minus 30%, leaning cool;
 * the tint alone must not dim it further (measured: 65% of a clear noon before the scaling, 70% after).
 */
export function washRgb(w: { rgb: number; alpha: number; dim: number } = RAIN_WASH): number {
  const ch = (shift: number) => 255 * (1 - w.alpha) + ((w.rgb >> shift) & 0xff) * w.alpha;
  const scale = (255 * (1 - w.dim)) / (0.299 * ch(16) + 0.587 * ch(8) + 0.114 * ch(0));
  const out = (shift: number) => Math.round(ch(shift) * scale);
  return (out(16) << 16) | (out(8) << 8) | out(0);
}

export interface MarkPixel {
  x: number;
  y: number;
  rgb: number;
  a: number;
}

const INK = 0x1b1a2e;
/** A mark's pixels in whole art pixels: `h` the drop's head, `t` its tail, `r` a ring at 60%, `d` the dark of a dent. */
const INKS: Readonly<Record<string, { rgb: number; a: number }>> = {
  h: { rgb: RAIN_RGB, a: RAIN_HEAD },
  t: { rgb: RAIN_RGB, a: 0.55 },
  r: { rgb: RAIN_RGB, a: 0.6 },
  d: { rgb: INK, a: 0.45 },
};

const MARKS: Readonly<Record<Landing, readonly string[]>> = {
  // stone: a ring with its crown thrown up and a dark centre
  ring: ['..h..', '.rrr.', 'r.d.r', '.rrr.'],
  // water: a flat ripple, no crown
  ripple: ['.rrr.', 'r...r', '.rrr.'],
  // grass: a small crown thrown up out of the blades
  drop: ['h...h', '.t.t.', '..r..'],
  // sand and earth: a dimple and no shine
  dimple: ['.ddd.', 'ddddd', '.ddd.'],
};

function pixels(rows: readonly string[]): MarkPixel[] {
  const out: MarkPixel[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ink = INKS[row[x]!];
      if (ink) out.push({ x, y, ...ink });
    }
  });
  return out;
}

/** The streak's texture, tail up and left, head down and right along the line it falls: its size and pixels. */
export function streakPixels(): { w: number; h: number; px: MarkPixel[] } {
  const px: MarkPixel[] = [];
  for (let y = 0; y < RAIN_LENGTH; y++) {
    px.push({ x: Math.floor(y / RAIN_SLANT), y, rgb: RAIN_RGB, a: RAIN_TAIL + ((RAIN_HEAD - RAIN_TAIL) * y) / (RAIN_LENGTH - 1) });
  }
  return { w: Math.floor((RAIN_LENGTH - 1) / RAIN_SLANT) + 1, h: RAIN_LENGTH, px };
}

/** A landing's texture: its size and pixels. */
export function markPixels(kind: Landing): { w: number; h: number; px: MarkPixel[] } {
  const rows = MARKS[kind];
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length, px: pixels(rows) };
}
