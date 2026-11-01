/**
 * The wild brain's data (HUNTING 2 to 4, CREATURE_BEHAVIOUR 1 and 5.1): what the brain reads of a kind,
 * what one live animal is, and what one think step sees of the world. Integers only (rule R2).
 *
 * Nothing here knows where an animal is stored. The caller builds a `WildView` for each think step, so
 * the same functions run on an animal kept in a player's own state today and on a shared world later.
 */
import { mulDiv } from '../num';
import { type Seed, draw } from '../rng';

export type WildState = 'SLEEP' | 'IDLE' | 'GRAZE' | 'WANDER' | 'ALERT' | 'FLEE' | 'DEFEND' | 'STALK' | 'CHASE' | 'RETURN';
/** How FLEE runs and ends (BEHAVIOUR 1: G F S C B). Swim and climb run as ground until a kind needs them. */
export type Flight = 'ground' | 'fly' | 'swim' | 'climb' | 'burrow';
/** How a group moves and flees (BEHAVIOUR 5.1.1). */
export type GroupClass = 'solitary' | 'herd' | 'flock' | 'pack';
/** What ALERT turns into, from the kind's danger 0, 1 or 2 (HUNTING 8). */
export type Tier = 'flee' | 'defend' | 'hunt';
export type Tile = readonly [number, number];

/** What the brain needs of a kind; the creature schema builds it from the kind's fields. */
export interface WildKind {
  id: string;
  tier: Tier;
  /** tiles (HUNTING 8) */
  sight: number;
  /** the HUNTING 3 scale */
  ear: -2 | 0 | 2;
  /** shares of 100 for the quiet state after IDLE (BEHAVIOUR 1) */
  weights: { idle: number; graze: number; wander: number };
  /** 6 to 14 tiles round the anchor (BEHAVIOUR 1) */
  roam: number;
  flight: Flight;
  group: GroupClass;
  /** solo, pair, small 3 to 4, large 5 to 12; sum 100 (BEHAVIOUR 5.1.1) */
  bands: readonly [number, number, number, number];
  /** 0 to 12, the noise of its ALERT tell (BEHAVIOUR 1) */
  alarm: number;
  looksBack: boolean;
  /** awake from the first hour up to the second; a window that wraps midnight has from > to */
  hours?: readonly [number, number];
  /** a small kind, for the tools that fit it */
  small: boolean;
}

/** One live animal. Integers only; every field a JSON value, so it can live in a saved state. */
export interface Creature {
  /** serial in its world; the stagger key is id % THINK_EVERY */
  id: number;
  /** the anchor's id, `kind@x,y` */
  anchor: string;
  at: [number, number];
  /** a unit step: [1,0] [-1,0] [0,1] or [0,-1] */
  face: [number, number];
  state: WildState;
  /** game ms it entered the state */
  since: number;
  /** the noticing count: think steps in a row it sensed something (HUNTING 3) */
  count: number;
  /** think steps left in the current beat: IDLE, GRAZE head-down, ALERT quiet, FLEE out of sight, the den stay */
  left: number;
  /** GRAZE: head-up steps left (0 while the head is down) */
  up?: number;
  /** GRAZE: head cycles left before the next quiet state */
  beats?: number;
  /** ALERT entered from FLEE's end by a kind that looks back: sight + 2, then WANDER */
  back?: boolean;
  /** WANDER and RETURN target */
  target?: [number, number];
  /** the tile of what it is alert to, flees from or stalks */
  src?: [number, number];
  /** the tile it was put up from (HUNTING 2, FLEE) */
  from?: [number, number];
  /** game ms until `from` is avoided */
  avoidUntil?: number;
  /** ms of movement not yet spent, so pace stays integer */
  credit: number;
  /** gone to ground: in its den or out of hours; not drawn and not sensed */
  under?: boolean;
  /** the tile it bolts from at its next think (the flush, a later pull request) */
  flushed?: [number, number];
  /** fixed when it appears (HUNTING 5), from the secret seed */
  grade: 1 | 2 | 3;
  /** the behaviour draw counter (rule R4) */
  draws: number;
}

/** A sound in the world other than the player's own: another kind's alarm, a strike. */
export interface Noise {
  at: Tile;
  r: number;
}

/** What one think step sees of the world; built by the caller, read only. */
export interface WildView {
  /** game ms of this think step */
  tick: number;
  /** the hour of the game day, 0 to 23 */
  hour: number;
  /** walkable for this kind's flight */
  open(x: number, y: number): boolean;
  /** stops sight (a solid or dense tile) */
  blocks(x: number, y: number): boolean;
  /** tall grass or a bush */
  cover(x: number, y: number): boolean;
  /** the player; `noise` is the radius of its gait (HUNTING 4) */
  player?: { at: Tile; face: Tile; noise: number; asleep: boolean };
  /** hunters this animal can see, read as threats like a player (BEHAVIOUR 2, question 1 default A) */
  threats: readonly Tile[];
  /** sounds besides the player's gait */
  noises: readonly Noise[];
  /** the anchor's tile */
  anchorAt: Tile;
  /** the group's leader; undefined when this animal leads or is alone */
  leader?: Creature;
  /** the other members of its group, read and never written */
  kin: readonly Creature[];
  /** ms a tile: walk_step_ms, divided by run_div, times sneak_mul (190 / 95 / 380 in the core) */
  pace: { walk: number; run: number; sneak: number };
  /** this animal was struck this step */
  hit?: boolean;
  /** the fight is built: until then a defender bluffs and no hunter stalks (HUNTING 11, question 1) */
  fight?: boolean;
  /** a public draw in [0, n) for the animal `id` at its own counter (rule R4) */
  rand(id: number, counter: number, n: number): number;
}

export type WildEvent =
  | { e: 'alert'; id: number }
  | { e: 'flee'; id: number }
  | { e: 'calm'; id: number }
  | { e: 'home'; id: number }
  | { e: 'out'; id: number };

export interface ThinkOut {
  events: WildEvent[];
  /** the noise of an ALERT tell made this step, heard by others at their next think */
  alarm?: number;
  /** where a FLEE started this step */
  fledFrom?: Tile;
}

/** Server ticks of 100 ms between two thinks of one animal (HUNTING 1, COMBAT 4.9 tick_ms 100). */
export const THINK_EVERY = 8;
/** Game ms of one think step: a "step" in HUNTING 2 (owner question 6 default). */
export const THINK_MS = 800;

/**
 * The numbers of HUNTING 2 to 4 and BEHAVIOUR 5.1 that are not a kind's own. Four of them have a row in
 * the core's params: `walkNoise` is `gait.noise_walk`, and since the creature schema `avoidSteps` is
 * `wild.flee_avoid_steps`, `denStay` `wild.den_stay_steps` and `spread` `wild.spread_tiles` (and
 * `THINK_EVERY` above is `wild.think_ticks`). The pull request that steps animals builds this object from params,
 * with a `wild` row for each number it reads that has none yet; `leash` and `giveUp` take the fight's
 * own rows (COMBAT 4.9) when the fight lands.
 */
export const WILD = {
  /** a noise this loud, or a hit, skips straight to the tier's state (HUNTING 2, ALERT) */
  loud: 8,
  /** gait.noise_walk: the den stay listens for a walk (BEHAVIOUR 5.1, the line home) */
  walkNoise: 5,
  /** ALERT: sensed steps after entry before the tier's state (HUNTING 3) */
  alertMore: 3,
  /** ALERT: blank steps before IDLE */
  alertQuiet: 4,
  /** FLEE ends this far past its sight */
  fleeExtra: 4,
  /** FLEE ends after this many steps out of sense */
  fleeLost: 8,
  /** think steps the put-up tile is avoided (HUNTING 2, FLEE) */
  avoidSteps: 60,
  /** tiles round the put-up tile that WANDER and the regroup keep out of (proposed) */
  avoidTiles: 4,
  /** a looking-back kind's ALERT after FLEE: steps, and the sight it gains */
  backSteps: 2,
  backSight: 2,
  /** steps a burrower stays in its den once nobody is within a walk's hearing */
  denStay: 8,
  /** a group member within this many tiles follows another into ALERT or FLEE */
  spread: 8,
  /** STALK holds when the player faces it within this many tiles for 2 steps */
  stalkFaced: 4,
  /** STALK turns to CHASE this close */
  stalkClose: 3,
  /** CHASE: tiles from the anchor before it goes home (`leash_tiles`) */
  leash: 7,
  /** CHASE: steps out of sense before it gives up (`give_up_t` 50 ticks, rounded up to steps) */
  giveUp: 7,
} as const;

/**
 * The public behaviour draw: a key that is not the world's secret seed (the plan derives it from the
 * content tag), so a client holding only its public state predicts the same path. The entity is
 * `wild:<id>` and the counter the animal's own `draws`, so nothing else can shift it (rule R4).
 */
export function keyedRand(key: Seed): WildView['rand'] {
  return (id, counter, n) => mulDiv(draw(key, `wild:${id}`, counter), n, 4_294_967_296);
}

/** A behaviour draw in [0, n) for this animal; it advances the animal's own counter (rule R4). */
export function roll(c: Creature, view: Pick<WildView, 'rand'>, n: number): number {
  const r = view.rand(c.id, c.draws, n);
  c.draws += 1;
  return r;
}

/** Whether a kind is awake at an hour; a window with from > to wraps midnight (the wolf's 20 to 05). */
export function awake(kind: WildKind, hour: number): boolean {
  if (!kind.hours) return true;
  const [from, to] = kind.hours;
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}
