/**
 * Where the valley bites (G30-G35, DECISIONS.md 2026-10-10: health and
 * hazards): which tiles are safe, which props are hazards and when they act,
 * and the arithmetic of a chase. Pure functions of the bundle and the state;
 * step.ts does the changing.
 */
import type { Bundle } from './bundle';
import { idiv, mulDiv } from './num';
import { draw } from './rng';
import { type State, isNight, lastDusk, nightEnds } from './state';
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

/** Whether a predator on its round sees a tile in its forward cone. Adjacent tiles are too close for cover. */
export function sees(bundle: Bundle, hazard: Hazard, tick: number, at: Tile): boolean {
  const pos = predatorAt(bundle, hazard, tick);
  const dx = at[0] - pos[0];
  const dy = at[1] - pos[1];
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) return true;
  if (coverAt(bundle, at)) return false;
  const [hx, hy] = headingOf(bundle, hazard, tick);
  const ahead = hx === 0 ? dy * hy : dx * hx;
  const side = Math.abs(hx === 0 ? dx : dy);
  return ahead >= 1 && ahead <= hazard.eyes && 2 * side <= ahead;
}

/** Whether the hazard acts at this tick. Outside its window it is harmless. */
export function windowOpen(bundle: Bundle, hazard: Hazard, tick: number): boolean {
  return hazard.window.includes('night') && isNight(bundle, tick);
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
 * Whether a tile is safe (G30): the town's cobbles, a slot marked safe, and the
 * camp's ground once a part of the camp stands. No hazard acts on a safe tile
 * and a chase ends there.
 */
export function isSafe(bundle: Bundle, state: State, at: Tile): boolean {
  return isSafeGround(bundle, at, state.player.camp.length > 0);
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
  const wake = bundle.starters[p.starter]?.wake ?? bundle.map.spawn;
  const spawn: Tile = [wake.x, wake.y];
  const slot = p.town === '' ? undefined : findSlot(bundle.map, p.town);
  if (!slot) return spawn;
  const tiles: Tile[] = [];
  for (let y = slot.y; y < slot.y + slot.h; y++) {
    for (let x = slot.x; x < slot.x + slot.w; x++) if (walkable(x, y, p)) tiles.push([x, y]);
  }
  return tiles.length === 0 ? spawn : tiles[draw(state.seed, 'fall', p.falls) % tiles.length]!;
}
