/**
 * Where the valley bites (G30-G35, DECISIONS.md 2026-10-10: health and
 * hazards): which tiles are safe, which props are hazards and when they act,
 * and the arithmetic of a chase. Pure functions of the bundle and the state;
 * step.ts does the changing.
 */
import type { Bundle, ExpeditionDef } from './bundle';
import { windowOpen as expeditionWindowOpen } from './expedition';
import { type Gait, noiseRadius } from './load';
import { idiv, mulDiv } from './num';
import { draw } from './rng';
import { OWN_FIRE, type State, fireBurns, isNight, lastDusk, nightEnds , type PublicState } from './state';
import type { Tile } from './step';
import { type Rect, type WorldView, findSlot, inRect, tagAt } from './world';

/** Same list as the schema's HAZARD_KINDS (a test keeps them equal); kept here so the kernel needs no runtime import. */
export const HAZARD_KINDS = ['predator', 'pit', 'trap', 'deep_water'] as const;
export type HazardKind = (typeof HAZARD_KINDS)[number];

export interface Hazard {
  id: string;
  kind: HazardKind;
  /** the hours it acts: "night" */
  window: readonly string[];
  /** its footprint */
  rect: Rect;
  /** a predator's reach, in tiles from its footprint */
  reach: number;
  /** the closed loop a predator walks after dark */
  round?: readonly Tile[];
  /** game milliseconds per tile of the round */
  pace: number;
  /** tiles ahead watched from the round */
  eyes: number;
}

const hazardCache = new WeakMap<Bundle, readonly Hazard[]>();

/** The hazard props of the map, in map order. A prop with no id is left out; the check refuses it. */
export function hazardsOf(bundle: Bundle): readonly Hazard[] {
  let list = hazardCache.get(bundle);
  if (!list) {
    list = bundle.map.props.flatMap((p) =>
      p.hazard && p.id !== undefined
        ? [
            {
              id: p.id,
              kind: p.hazard.kind,
              window: p.hazard.window,
              rect: { x: p.x, y: p.y, w: p.w, h: p.h },
              reach: p.hazard.reach ?? bundle.params.hazard.predator.reach,
              ...(p.hazard.round === undefined ? {} : { round: p.hazard.round.map(([x, y]) => [x, y] as Tile) }),
              pace: p.hazard.pace_ms ?? bundle.params.hazard.predator.pace_ms,
              eyes: p.hazard.eyes ?? bundle.params.hazard.predator.eyes,
            },
          ]
        : [],
    );
    hazardCache.set(bundle, list);
  }
  return list;
}

/** Every map tile in the Chebyshev watch of a predator's round: the tiles its eyes cover as it walks (G47). Static, so it holds by day as well. */
export function watchOf(bundle: Bundle, hazard: Hazard): readonly Tile[] {
  if (!hazard.round) return [];
  const watched = new Set<string>();
  const tiles: Tile[] = [];
  for (const [rx, ry] of hazard.round) {
    for (let y = Math.max(0, ry - hazard.eyes); y <= Math.min(bundle.map.height - 1, ry + hazard.eyes); y++) {
      for (let x = Math.max(0, rx - hazard.eyes); x <= Math.min(bundle.map.width - 1, rx + hazard.eyes); x++) {
        const at: Tile = [x, y];
        const key = tileKey(at);
        if (watched.has(key)) continue;
        watched.add(key);
        tiles.push(at);
      }
    }
  }
  return tiles;
}

const watchCache = new WeakMap<Bundle, ReadonlySet<string>>();

/** Whether a tile lies in the watch of any predator's round. */
export function watchedAt(bundle: Bundle, at: Tile): boolean {
  let watched = watchCache.get(bundle);
  if (!watched) {
    watched = new Set(hazardsOf(bundle).filter((h) => h.kind === 'predator').flatMap((h) => watchOf(bundle, h)).map(tileKey));
    watchCache.set(bundle, watched);
  }
  return watched.has(tileKey(at));
}

const coverCache = new WeakMap<Bundle, ReadonlySet<string>>();

const tileKey = ([x, y]: Tile): string => `${x},${y}`;

/** Whether a tile carries non-solid cover from a predator's eyes. */
export function coverAt(bundle: Bundle, at: Tile): boolean {
  let covered = coverCache.get(bundle);
  if (!covered) {
    const found = new Set<string>();
    for (const p of bundle.map.props) {
      if (p.cover !== true) continue;
      for (let y = p.y; y < p.y + p.h; y++) {
        for (let x = p.x; x < p.x + p.w; x++) found.add(tileKey([x, y]));
      }
    }
    covered = found;
    coverCache.set(bundle, covered);
  }
  return covered.has(tileKey(at));
}

/** Where a predator stands: on its den while asleep, or on its deterministic round after dark. */
export function predatorAt(bundle: Bundle, hazard: Hazard, tick: number): Tile {
  if (!hazard.round) return [hazard.rect.x, hazard.rect.y];
  if (!windowOpen(bundle, hazard, tick)) return [hazard.round[0]![0], hazard.round[0]![1]];
  const index = idiv(tick - lastDusk(bundle, tick), hazard.pace) % hazard.round.length;
  const [x, y] = hazard.round[index]!;
  return [x, y];
}

/** The four-way unit step from a predator's current round tile to its next one. */
export function headingOf(bundle: Bundle, hazard: Hazard, tick: number): Tile {
  if (!hazard.round || !windowOpen(bundle, hazard, tick)) return [0, 0];
  const index = idiv(tick - lastDusk(bundle, tick), hazard.pace) % hazard.round.length;
  const here = hazard.round[index]!;
  const next = hazard.round[(index + 1) % hazard.round.length]!;
  return [Math.sign(next[0] - here[0]), Math.sign(next[1] - here[1])];
}

/**
 * How far ahead a predator turns its head at a player moving at a gait: its own eyes (the walk radius, 5 by default)
 * moved by what the gait adds to or takes from the shared noise table, so a run is heard at 8 and a sneak at 3.
 */
export function hearingOf(bundle: Bundle, hazard: Hazard, gait: Gait): number {
  return Math.max(1, hazard.eyes + noiseRadius(bundle, gait) - noiseRadius(bundle, 'walk'));
}

/** Whether a predator on its round sees a tile in its forward cone. Adjacent tiles are too close for cover. */
export function sees(bundle: Bundle, hazard: Hazard, tick: number, at: Tile, gait: Gait = 'walk'): boolean {
  const pos = predatorAt(bundle, hazard, tick);
  const dx = at[0] - pos[0];
  const dy = at[1] - pos[1];
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) return true;
  if (coverAt(bundle, at)) return false;
  const [hx, hy] = headingOf(bundle, hazard, tick);
  const ahead = hx === 0 ? dy * hy : dx * hx;
  const side = Math.abs(hx === 0 ? dx : dy);
  return ahead >= 1 && ahead <= hearingOf(bundle, hazard, gait) && 2 * side <= ahead;
}

/** Whether a hazard acts or an expedition is open at this tick. */
export function windowOpen(bundle: Bundle, timed: Hazard, tick: number): boolean;
export function windowOpen(bundle: Bundle, timed: ExpeditionDef, tick: number): boolean;
export function windowOpen(bundle: Bundle, timed: Hazard | ExpeditionDef, tick: number): boolean {
  if (!Array.isArray(timed.window)) return expeditionWindowOpen(bundle, timed as ExpeditionDef, tick);
  return timed.window.includes('night') && isNight(bundle, tick);
}

/** The first tick from `tick` on at which the hazard's window is shut (the tick itself when it already is). */
export function windowShuts(bundle: Bundle, hazard: Hazard, tick: number): number {
  return hazard.window.includes('night') ? nightEnds(bundle, tick) : tick;
}

/** How far a tile is from a rectangle in tiles, a diagonal step counting one (0 inside it). */
export function distanceTo(at: Tile, r: Rect): number {
  const dx = Math.max(r.x - at[0], 0, at[0] - (r.x + r.w - 1));
  const dy = Math.max(r.y - at[1], 0, at[1] - (r.y + r.h - 1));
  return Math.max(dx, dy);
}

/** Whether the ground under a tile is the town's cobbles. */
export function isTownTile(bundle: Bundle, at: Tile): boolean {
  return tagAt(bundle.map, at[0], at[1]) === 'town';
}

/**
 * The danger level d of the ground at a tile. Areas carry none yet (CR-38): it is 0 where ground is safe by itself
 * (the town and the safe slots) and 1 everywhere else, until the map fills it in. Every rule that reads d reads it here.
 */
export function dangerAt(bundle: Bundle, at: Tile): number {
  return isSafeGround(bundle, at, false) ? 0 : 1;
}

/** The tiles a fire on `at` makes safe while it burns: its own and the ring of `fire.safe_tiles` around it, inside the map. */
export function fireArea(bundle: Bundle, at: Tile): Tile[] {
  const reach = bundle.params.fire.safe_tiles;
  const tiles: Tile[] = [];
  for (let y = Math.max(0, at[1] - reach); y <= Math.min(bundle.map.height - 1, at[1] + reach); y++) {
    for (let x = Math.max(0, at[0] - reach); x <= Math.min(bundle.map.width - 1, at[0] + reach); x++) tiles.push([x, y]);
  }
  return tiles;
}

/**
 * Whether a tile is safe (G30): the town's cobbles, a slot marked safe, the
 * camp's ground once a part of the camp stands, and the ground around the
 * player's own fire while it burns. No hazard acts on a safe tile and a chase
 * ends there. `tick` is the moment asked about, the state's own by default.
 */
export function isSafe(bundle: Bundle, state: PublicState, at: Tile, tick: number = state.tick): boolean {
  if (isSafeGround(bundle, at, state.player.camp.length > 0)) return true;
  const own = state.player.own;
  return own != null && fireBurns(state, OWN_FIRE, tick) && Math.max(Math.abs(at[0] - own.at[0]), Math.abs(at[1] - own.at[1])) <= bundle.params.fire.safe_tiles;
}

/** The same, for a player whose camp does (or does not) stand: the content checks ask it with the camp built. */
export function isSafeGround(bundle: Bundle, at: Tile, campStands: boolean): boolean {
  if (isTownTile(bundle, at)) return true;
  if (campStands) {
    const camp = bundle.map.slots.find((s) => s.kind === 'camp');
    if (camp && inRect(at[0], at[1], camp)) return true;
  }
  return bundle.map.slots.some((s) => s.safe === true && inRect(at[0], at[1], s));
}

/** The town square nearest to a tile, which is the town a player on that tile is in. '' when the map has none. */
export function townAt(bundle: Bundle, at: Tile): string {
  let best = '';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const slot of bundle.map.slots) {
    if (slot.kind !== 'area' || slot.tag !== 'town') continue;
    const d = distanceTo(at, slot);
    if (d < bestDistance) {
      bestDistance = d;
      best = slot.id;
    }
  }
  return best;
}

/** How many bites a chase has made after `elapsedMs` (G34: a rule, not a roll): the first after catch_ms, then one every bite_ms. */
export function bitesAfter(bundle: Bundle, elapsedMs: number): number {
  const { catch_ms, bite_ms } = bundle.params.hazard.predator;
  return elapsedMs < catch_ms ? 0 : 1 + idiv(elapsedMs - catch_ms, bite_ms);
}

/** What one hit of a hazard takes, in milli-points of health, from a bar that holds `cap`. */
export function harmOf(bundle: Bundle, cap: number, kind: HazardKind): number {
  const pct = kind === 'predator' ? bundle.params.hazard.predator.bite_pct : bundle.params.hazard[kind].harm_pct;
  return mulDiv(cap, pct, 100);
}

/**
 * The tile a fallen player wakes on (G33): a random walkable tile inside the
 * town they were last in, drawn from the world's own stream, or where they
 * started when they have not yet been in one.
 */
export function reappearTile(
  bundle: Bundle,
  state: State,
  walkable: (x: number, y: number, view: WorldView) => boolean,
): Tile {
  const p = state.player;
  const wake = bundle.pockets[p.pocket]?.wake ?? bundle.map.spawn;
  const spawn: Tile = [wake.x, wake.y];
  const slot = p.town === '' ? undefined : findSlot(bundle.map, p.town);
  if (!slot) return spawn;
  const tiles: Tile[] = [];
  for (let y = slot.y; y < slot.y + slot.h; y++) {
    for (let x = slot.x; x < slot.x + slot.w; x++) if (walkable(x, y, p)) tiles.push([x, y]);
  }
  return tiles.length === 0 ? spawn : tiles[draw(state.seed, 'fall', p.falls) % tiles.length]!;
}
