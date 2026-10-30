/**
 * An animal's coat: which of its kind's coats one creature wears, and the recolour that draws it, worked out
 * without Phaser so it can be tested. The coats of a kind are listed on its target in tools/anim/anim.json
 * ("coats"), each with a weight; a creature's coat comes from its id and a world number through a fixed hash, so
 * every client draws the same creature in the same coat, every time, and nothing is rolled. A coat is look only:
 * it changes no goods, no value and nothing the server counts.
 *
 * Not wired yet: the client does not draw the hare or the crow today, so no scene calls this module. When one
 * does, it passes the shared ramps (tools/src/kit/palette.ts CORE_RAMPS, carried to the client the way the bundle
 * carries content) and a world number every client can see: the state's rng seed is kept from the client
 * (kernel publicState), so it is not that seed.
 *
 * The recolour is a pure step to step map, like richground's remapTone: a pixel at step i of ramp A becomes step
 * clamp(i + shift) of ramp B, only opaque pixels change, only colours of the mapped ramps, never the ink outline,
 * so every colour written is a palette colour and the frames of a sheet cannot swim. A pattern a map cannot make
 * (the white patches of a pied coat) comes from a second body ("body": another target), rendered with the
 * pattern painted on its colour map.
 */
/** One ramp's place in a coat: its pixels move to ramp `to`, `shift` steps lighter (+) or darker (-). */
export interface CoatStep {
  to: string;
  shift?: number;
}

export interface Coat {
  id: string;
  name: string;
  /** the coat's share of its kind, against the sum of the kind's weights */
  weight: number;
  /** ramp id -> where its steps go; a ramp left out keeps its colours */
  map: Readonly<Record<string, CoatStep>>;
  /** another target whose sheets this coat is drawn on (a patterned body); the kind's own when left out */
  body?: string;
}

/** Shared ramps by id: six colours each, dark to light, as `#rrggbb`. */
export type Ramps = Readonly<Record<string, readonly string[]>>;

/** The one ink of the outline (tools/src/kit/ink.ts): never recoloured, though it is also the grey ramp's darkest step. */
export const COAT_INK = 0x1b1a2e;

/** Steps in a shared ramp. */
const STEPS = 6;

/**
 * A creature id as a 32-bit number: FNV-1a over the UTF-16 code units of its text form (offset basis 2166136261,
 * prime 16777619), so a numeric id and its text pick the same coat.
 */
export function idHash(creatureId: string | number): number {
  const text = String(creatureId);
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * The fixed 32-bit number a creature's coat is drawn from: its id's FNV-1a, mixed with the world number and run
 * through murmur3's 32-bit finaliser, all in Math.imul. Not richground's tile hash: that one multiplies in
 * doubles, exact only for small tile coordinates, and a 32-bit id would lose its low bits there.
 */
export function coatHash(creatureId: string | number, worldSeed: number): number {
  let h = (idHash(creatureId) ^ Math.imul(worldSeed | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The coat this creature wears: a coat by weight, through the fixed hash of its id and the world number. The same
 * id and number give the same coat on every client; over many ids each coat's share is its weight's share.
 * Undefined only for a kind with no coats.
 */
export function coatOf(coats: readonly Coat[], creatureId: string | number, worldSeed: number): Coat | undefined {
  const total = coats.reduce((sum, c) => sum + c.weight, 0);
  if (coats.length === 0 || !(total > 0)) return undefined;
  let x = (coatHash(creatureId, worldSeed) / 4294967296) * total;
  for (const coat of coats) {
    x -= coat.weight;
    if (x < 0) return coat;
  }
  return coats[coats.length - 1];
}

const rgbOf = (hex: string): number => Number.parseInt(hex.slice(1), 16) >>> 0;

/**
 * The colour table of a coat's map: each mapped ramp's six colours to their new colours. The ink is never in it.
 * Throws on a ramp the table does not know, and on a colour two mapped ramps share (it could go two ways).
 */
export function coatTable(map: Readonly<Record<string, CoatStep>>, ramps: Ramps): Map<number, number> {
  const table = new Map<number, number>();
  for (const [from, step] of Object.entries(map)) {
    const src = ramps[from];
    const dst = ramps[step.to];
    if (src === undefined || src.length !== STEPS) throw new Error(`coat: "${from}" is not a shared ramp`);
    if (dst === undefined || dst.length !== STEPS) throw new Error(`coat: "${step.to}" is not a shared ramp`);
    const shift = step.shift ?? 0;
    for (let i = 0; i < STEPS; i += 1) {
      const a = rgbOf(src[i]!);
      if (a === COAT_INK) continue;
      if (table.has(a)) throw new Error(`coat: ${src[i]} is in two mapped ramps`);
      table.set(a, rgbOf(dst[Math.min(STEPS - 1, Math.max(0, i + shift))]!));
    }
  }
  return table;
}

/** Recolours RGBA pixels in place for one coat's map: opaque pixels of the mapped ramps only, the ink untouched. */
export function remapCoat(data: Uint8ClampedArray | Uint8Array, map: Readonly<Record<string, CoatStep>>, ramps: Ramps): void {
  const table = coatTable(map, ramps);
  if (table.size === 0) return;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] !== 255) continue;
    const out = table.get(((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!) >>> 0);
    if (out === undefined) continue;
    data[i] = (out >>> 16) & 255;
    data[i + 1] = (out >>> 8) & 255;
    data[i + 2] = out & 255;
  }
}
