/**
 * An animal's coat: which of its kind's coats one creature wears, and the recolour that draws it, worked out
 * without Phaser so it can be tested. The coats of a kind are listed on its target in tools/anim/anim.json
 * ("coats"), each with a weight. A creature's coat comes from the server's keyed draw, `draw(seed, coatEntity(id), 0)`
 * (kernel/src/rng.ts; HUNT_FAMILIES 7): the world's seed is the server's alone (kernel publicState), so the server
 * picks the coat with coatOf when the creature appears and sends it with the creature, and every client draws the
 * coat it is sent, the same creature in the same coat on every screen. A coat changes no value, no weight and no
 * count; the hide carries it (DECISIONS 2026-10-30, "The hide carries the coat").
 *
 * Not wired yet: nothing spawns or draws the hare or the crow today, so nothing calls this module. The pull request
 * that steps animals draws the coat on the server, and a scene draws it with remapCoat on the shared ramps
 * (tools/src/kit/palette.ts CORE_RAMPS, carried to the client the way the bundle carries content). A coat table
 * belongs to a body's target, found from the creature's kind id (core/hare to the target hare, core/crow to crow),
 * never from the kind's look, which the crow shares with the sparrow; hare-pied is a coat's body, never a kind. When
 * the hide carries the coat, the tables move from anim.json into the content the server reads.
 *
 * The recolour is a pure step to step map, like richground's remapTone: a pixel at step i of ramp A becomes step
 * clamp(i + shift) of ramp B, or the step its own list names (a coat that keeps the shading of a white or a black
 * coat, or mixes two ramps, names each step), only opaque pixels change, only colours of the mapped ramps, never
 * from or to the ink outline, so every colour written is a palette colour, no body pixel melts into the outline,
 * and the frames of a sheet cannot swim. A pattern a map cannot make
 * (the white patches of a pied coat) comes from a second body ("body": another target), rendered with the
 * pattern painted on its colour map.
 */
/**
 * One ramp's place in a coat: either its pixels move to ramp `to`, `shift` steps lighter (+) or darker (-), or
 * `steps` names where each of its six steps goes, dark to light, as "ramp:step" (`"wood:2"`), null keeping it.
 */
export type CoatStep = { to: string; shift?: number } | { steps: readonly (string | null)[] };

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
 * The entity a creature's coat is drawn under, a prefix of its own beside the other keyed draws' (`group:`, `bolt:`;
 * CREATURE_BEHAVIOUR 5.1.2 rule 2): the server's draw is `draw(seed, coatEntity(id), 0)`.
 */
export const coatEntity = (creatureId: string | number): string => `coat:${creatureId}`;

/**
 * The coat a creature wears: a coat by weight, from the server's draw for it (an unsigned 32-bit number; see
 * coatEntity). The same draw gives the same coat; over many creatures each coat's share is its weight's share.
 * Undefined only for a kind with no coats.
 */
export function coatOf(coats: readonly Coat[], roll: number): Coat | undefined {
  const total = coats.reduce((sum, c) => sum + c.weight, 0);
  if (coats.length === 0 || !(total > 0)) return undefined;
  let x = ((roll >>> 0) / 4294967296) * total;
  for (const coat of coats) {
    x -= coat.weight;
    if (x < 0) return coat;
  }
  return coats[coats.length - 1];
}

const rgbOf = (hex: string): number => Number.parseInt(hex.slice(1), 16) >>> 0;

const rampOf = (ramps: Ramps, id: string): readonly string[] => {
  const ramp = ramps[id];
  if (ramp === undefined || ramp.length !== STEPS) throw new Error(`coat: "${id}" is not a shared ramp`);
  return ramp;
};

/** Where step i of a mapped ramp goes, as a colour; undefined when the step keeps its colour. */
function stepColour(step: CoatStep, i: number, ramps: Ramps): string | undefined {
  if ('steps' in step) {
    if (!Array.isArray(step.steps) || step.steps.length !== STEPS) throw new Error('coat: "steps" names all six steps');
    const name = step.steps[i];
    if (name === null || name === undefined) return undefined;
    const m = /^([a-z_]+):([0-5])$/.exec(name);
    if (m === null) throw new Error(`coat: "${name}" is not "ramp:step"`);
    return rampOf(ramps, m[1]!)[Number(m[2])];
  }
  return rampOf(ramps, step.to)[Math.min(STEPS - 1, Math.max(0, i + (step.shift ?? 0)))];
}

/**
 * The colour table of a coat's map: each mapped ramp's colours to their new colours. The ink is never in it, on
 * either side. Throws on a ramp the table does not know, on a colour two mapped ramps share (it could go two ways)
 * and on a step that lands on the ink (a body pixel drawn in the outline's colour melts into the outline).
 */
export function coatTable(map: Readonly<Record<string, CoatStep>>, ramps: Ramps): Map<number, number> {
  const table = new Map<number, number>();
  for (const [from, step] of Object.entries(map)) {
    const src = rampOf(ramps, from);
    for (let i = 0; i < STEPS; i += 1) {
      const a = rgbOf(src[i]!);
      if (a === COAT_INK) continue;
      if (table.has(a)) throw new Error(`coat: ${src[i]} is in two mapped ramps`);
      const to = stepColour(step, i, ramps);
      if (to === undefined) continue;
      if (rgbOf(to) === COAT_INK) throw new Error(`coat: ${from} step ${i} lands on the ink`);
      table.set(a, rgbOf(to));
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
