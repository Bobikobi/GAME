/**
 * The map's animals stepped (HUNTING 1, BESTIARY 1, CREATURE_BEHAVIOUR 6): one animal at each spot of `map.creatures`,
 * thinking with the wild brain once every `wild.think_ms`, staggered by its id over the pulses of `wild.tick_ms`, while
 * it is one of the `wild.awake_max` nearest to the player within `wild.wake_tiles`. The rest are only their anchor:
 * nothing runs while nobody looks (REACTIONS 2), and an animal that thinks again after more than
 * `wild.catchup_max_steps` think steps settles in one step (`settle`) instead of replaying them.
 *
 * Where it runs (DECISIONS 2026-11-27, "The valley's animals are stepped by the kernel"): a pure step over a world value
 * the caller holds, the shape of the fight's tick (`fightTick`). Today the game holds it; the server takes it over with
 * the same function. The world is not part of the save: a world built afresh puts every animal at its anchor, which is
 * what a long absence gives anyway (`settle`). Integers only (rule R2); every draw is the public behaviour draw, keyed by
 * the valley day and the animal's own counter (rule R4), so the same animal walks another way the next day.
 */
import type { Bundle } from '../bundle';
import { type Gait, noiseRadius } from '../load';
import { idiv, mulDiv } from '../num';
import { type Seed, draw } from '../rng';
import { type PublicState, hourOf, valleyDay } from '../state';
import { walkableFor } from '../step';
import { tagAt } from '../world';
import { settle, think } from './brain';
import { anchorId } from './den';
import { seatOf } from './seat';
import { d2 } from './senses';
import { type Creature, type Flight, type GroupClass, type Tier, type Tile, type WildEvent, type WildKind, type WildView, THINK_MS, WILD } from './types';

/** One animal of the map: its spot, its kind and the brain's record of it. */
export interface WildAnimal {
  /** the index of its spot in `map.creatures.spots`: the id a take names (`stonePrey`) */
  spot: number;
  kind: string;
  c: Creature;
  /** game ms of its last think step; -1 before its first, and after a time it was not stepped is forgotten */
  last: number;
  /** stepped now: inside the wake ring, among the nearest `awake_max`, and not taken */
  stepped: boolean;
  /** where it stood when its last think began, and the tiles it entered in that think in order: what a view walks along */
  from: [number, number];
  path: [number, number][];
}

/** The map's animals and the stepping clock. Every field a JSON value. */
export interface WildWorld {
  /** the last pulse stepped (`wild.tick_ms` each); -1 before the first */
  pulse: number;
  animals: WildAnimal[];
  /** the ALERT tells made at the last think steps, heard by the others until `until` */
  noises: { at: [number, number]; r: number; until: number; by: number }[];
}

/** What the step reads of the player beside its state: how it moves now. */
export interface WildSense {
  /** the way the player faces, a unit step */
  face: Tile;
  gait: Gait | 'still';
  asleep: boolean;
}

/** The public key of the behaviour draw: not the world's secret seed (rule R4), the same for every client. */
const WILD_KEY: Seed = [0x77696c64, 0x76616c6c, 0x65790000, 0x00000001];

const TIERS: readonly Tier[] = ['flee', 'defend', 'hunt'];
const kinds = new WeakMap<Bundle, Map<string, WildKind | undefined>>();

/** What the brain reads of a map kind (`map.creatures.kinds`): its senses, beats, flight and group; none for a kind with no `behaviour`. */
export function wildKindOf(bundle: Bundle, id: string): WildKind | undefined {
  let cache = kinds.get(bundle);
  if (!cache) kinds.set(bundle, (cache = new Map()));
  if (cache.has(id)) return cache.get(id);
  const k = bundle.map.creatures?.kinds[id];
  const b = k?.behaviour;
  const kind: WildKind | undefined = k && b ? {
    id,
    tier: TIERS[Math.min(k.hunt?.danger ?? 0, 2)]!,
    sight: b.sight,
    ear: (b.ear === 2 || b.ear === -2 ? b.ear : 0),
    weights: { idle: b.weights.idle, graze: b.weights.graze, wander: b.weights.wander },
    roam: b.roam,
    flight: b.flight as Flight,
    group: b.group.class as GroupClass,
    bands: [b.group.bands[0]!, b.group.bands[1]!, b.group.bands[2]!, b.group.bands[3]!],
    alarm: b.alarm,
    looksBack: b.looks_back === true,
    ...(k.hours ? { hours: [k.hours[0]!, k.hours[1]!] as const } : {}),
    small: (k.hunt?.size ?? 'small') === 'small',
  } : undefined;
  cache.set(id, kind);
  return kind;
}

/** The farthest a stepped animal of the kind stands from its anchor: its roam, then a flight to past its sight. A take is held to it. */
export function wildReach(kind: WildKind): number {
  return kind.roam + kind.sight + WILD.fleeExtra;
}

/** The world as it is before anything was stepped: an animal at each spot whose kind has a `behaviour`, standing at its anchor. */
export function wildWorld(bundle: Bundle): WildWorld {
  const animals: WildAnimal[] = [];
  for (const [spot, s] of (bundle.map.creatures?.spots ?? []).entries()) {
    if (!wildKindOf(bundle, s.kind)) continue;
    const at: [number, number] = [s.x, s.y];
    animals.push({
      spot, kind: s.kind, last: -1, stepped: false, from: [s.x, s.y], path: [],
      c: { id: spot + 1, anchor: anchorId(s.kind, s.x, s.y), at, face: [0, 1], state: 'IDLE', since: 0, count: 0, left: 2, credit: 0, grade: 1, draws: 0 },
    });
  }
  return { pulse: -1, animals, noises: [] };
}

/** Whether an animal is on the map to be seen: stepped, not gone to ground, not at its night's rest (day kinds leave the map at night). */
export function wildShown(a: WildAnimal): boolean {
  return a.stepped && !a.c.under && a.c.state !== 'SLEEP';
}

/** Taken by the player and not yet back (`preyReturns`): off the map until then. */
function taken(bundle: Bundle, state: PublicState, a: WildAnimal, ms: number): boolean {
  const s = bundle.map.creatures!.spots[a.spot]!;
  return (state.player.preyReturns?.[anchorId(s.kind, s.x, s.y)] ?? 0) > ms;
}

/** The tiles an animal of a flight may stand on: the water for a swimmer, any tile for a bird in flight, else the ground it walks. */
function openFor(bundle: Bundle, state: PublicState, kind: WildKind, c: Creature, anchor: Tile): (x: number, y: number) => boolean {
  const map = bundle.map;
  const walk = walkableFor(bundle);
  const k = map.creatures!.kinds[kind.id]!;
  const avoidsTown = k.behaviour?.town === 'avoids';
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;
  if (kind.flight === 'swim') return (x, y) => inside(x, y) && tagAt(map, x, y) === 'water';
  if (kind.flight === 'fly' && c.state === 'FLEE') return inside;
  const perch = kind.flight === 'fly' && k.perch === 'tree';
  return (x, y) => {
    if (x === anchor[0] && y === anchor[1]) return true;
    if (!inside(x, y)) return false;
    const tag = tagAt(map, x, y);
    if (avoidsTown && tag === 'town') return false;
    if (perch && tag === 'grove') return true;
    return walk(x, y, state.player);
  };
}

/** The public behaviour draw for the map and the valley day: the same animal's two days do not walk alike (DECISIONS 2026-10-30). */
function randOf(day: number): WildView['rand'] {
  return (id, counter, n) => mulDiv(draw(WILD_KEY, `wild:${day}:${id}`, counter), n, 4_294_967_296);
}

/**
 * Steps the world up to game ms `ms`, pulse by pulse, and changes it in place: which animals are stepped is chosen at each
 * pulse (the nearest `awake_max` anchors within `wake_tiles` of the player, ties by spot), and each stepped animal thinks
 * on the pulses its id falls on. A gap of more than `catchup_max_steps` think steps is not replayed: the world steps one
 * round of pulses and every animal settles. Returns the brain's events of the steps taken, in order.
 */
export function wildStep(bundle: Bundle, world: WildWorld, state: PublicState, sense: WildSense, ms: number): WildEvent[] {
  const w = bundle.params.wild;
  const tickMs = w.tick_ms;
  const round = idiv(w.think_ms, tickMs);
  const target = idiv(ms, tickMs);
  if (target <= world.pulse) return [];
  const longest = w.catchup_max_steps * round;
  if (world.pulse < 0 || target - world.pulse > longest) world.pulse = target - round;
  const events: WildEvent[] = [];
  const player = state.player.at;
  const noise = noiseRadius(bundle, sense.gait);
  const wake = w.wake_tiles * w.wake_tiles;
  const forget = w.catchup_max_steps * THINK_MS;
  for (let p = world.pulse + 1; p <= target; p++) {
    const now = p * tickMs;
    chooseStepped(bundle, world, state, now, player, wake, w.awake_max);
    world.noises = world.noises.filter((n) => n.until > now);
    const phase = p % round;
    const hour = hourOf(bundle, now);
    const rand = randOf(valleyDay(bundle, now));
    for (const a of world.animals) {
      if (!a.stepped || a.c.id % round !== phase) continue;
      const kind = wildKindOf(bundle, a.kind)!;
      const spot = seatOfAnimal(bundle, state, a);
      const anchorAt: Tile = [spot.x, spot.y];
      const view: WildView = {
        tick: now,
        hour,
        open: openFor(bundle, state, kind, a.c, anchorAt),
        blocks: (x, y) => {
          const tag = tagAt(bundle.map, x, y);
          return tag === undefined || (tag !== 'water' && !walkableFor(bundle)(x, y, state.player));
        },
        // tall grass and bushes are no tile tag yet: no cover, so sight is never cut short (HUNTING 3)
        cover: () => false,
        player: { at: player, face: sense.face, noise, asleep: sense.asleep },
        threats: [],
        noises: world.noises.filter((n) => n.by !== a.c.id).map((n) => ({ at: n.at, r: n.r })),
        anchorAt,
        kin: world.animals.filter((o) => o !== a && o.kind === a.kind && o.stepped).map((o) => o.c),
        pace: { walk: bundle.params.walk_step_ms, run: idiv(bundle.params.walk_step_ms, bundle.params.gait.run_div), sneak: bundle.params.walk_step_ms * bundle.params.gait.sneak_mul },
        rand,
      };
      a.from = [a.c.at[0], a.c.at[1]];
      if (a.last < 0 || now - a.last > forget) {
        settle(kind, a.c, view);
        a.path = [];
      } else {
        const out = think(kind, a.c, view);
        a.path = a.c.trail ?? [];
        events.push(...out.events);
        if (out.alarm) world.noises.push({ at: [a.c.at[0], a.c.at[1]], r: out.alarm, until: now + THINK_MS, by: a.c.id });
      }
      a.last = now;
    }
  }
  world.pulse = target;
  return events;
}

/**
 * The spot an animal lives at now, its seat (`seat.ts`). One that was taken and has a new seat is put there: it stands at the new
 * anchor, fresh and forgotten (`last` -1, no path), so it is drawn there at once and never walks across the valley from the old one.
 */
function seatOfAnimal(bundle: Bundle, state: PublicState, a: WildAnimal): { kind: string; x: number; y: number } {
  const s = seatOf(bundle, state, a.spot) ?? bundle.map.creatures!.spots[a.spot]!;
  const anchor = anchorId(s.kind, s.x, s.y);
  if (a.c.anchor !== anchor) {
    a.c = { id: a.c.id, anchor, at: [s.x, s.y], face: [0, 1], state: 'IDLE', since: 0, count: 0, left: 2, credit: 0, grade: a.c.grade, draws: a.c.draws };
    a.from = [s.x, s.y];
    a.path = [];
    a.last = -1;
  }
  return s;
}

/** Marks the stepped animals at a pulse; one that drops out is forgotten (`last` -1), so it settles when it is stepped again. */
function chooseStepped(bundle: Bundle, world: WildWorld, state: PublicState, now: number, player: Tile, wake: number, max: number): void {
  const near: { a: WildAnimal; d: number }[] = [];
  for (const a of world.animals) {
    const s = seatOfAnimal(bundle, state, a);
    const d = d2(player, [s.x, s.y]);
    if (d <= wake && !taken(bundle, state, a, now)) near.push({ a, d });
  }
  near.sort((x, y) => x.d - y.d || x.a.spot - y.a.spot);
  const on = new Set(near.slice(0, max).map((n) => n.a));
  for (const a of world.animals) {
    const stepped = on.has(a);
    if (!stepped && a.stepped) {
      a.last = -1;
      a.path = [];
    }
    a.stepped = stepped;
  }
}

/**
 * A stone coming down on the ground (#923): the crack of it is as loud as the noise that skips an animal straight to flight
 * (`WILD.loud`, the same sound a hit makes), heard by every animal within that radius and its ear at their next think. It lasts
 * one think step. `now` is the game ms of the throw.
 */
export function wildNoise(world: WildWorld, at: Tile, now: number): void {
  world.noises.push({ at: [at[0], at[1]], r: WILD.loud, until: now + THINK_MS, by: 0 });
}

/** The animal standing for a spot, or none. */
export function wildAnimal(world: WildWorld, spot: number): WildAnimal | undefined {
  return world.animals.find((a) => a.spot === spot);
}
