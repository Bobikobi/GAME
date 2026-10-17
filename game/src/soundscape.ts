/**
 * What the player's place sounds like (NEXT.md 4b): how loud the campfire, the stream, the
 * dread of the ruins and the crackle of a burning fire are from where they stand. Pure, from
 * the bundle, the state and a position in tiles; the world scene reads it every quarter second
 * and hands the levels to the sound bus.
 */
import { type Bundle, type State, campTile, fireBurns, hazardsOf, isNight, isSafe, tagAt, windowOpen } from '@game/kernel';
import { falloff, panFor } from './audio/spatial';

/** [near, far] in tiles: full volume inside near, silent beyond far. */
export const FIRE_RANGE = [1.5, 12] as const;
export const STREAM_RANGE = [3, 12] as const;
export const DREAD_RANGE = [0, 6] as const;
/** A burning fire crackles within six tiles of it, louder nearer, and not at all once it is out. */
export const CRACKLE_RANGE = [1.5, 6] as const;

export interface Scape {
  fire: { level: number; pan: number };
  stream: { level: number; pan: number };
  dread: { level: number; pan: number };
  crackle: { level: number; pan: number };
}

interface Spot {
  x: number;
  y: number;
}

const tilesCache = new WeakMap<Bundle, { water: Spot[]; ruin: Spot[] }>();

function tiles(b: Bundle): { water: Spot[]; ruin: Spot[] } {
  let found = tilesCache.get(b);
  if (!found) {
    found = { water: [], ruin: [] };
    for (let y = 0; y < b.map.height; y += 1) {
      for (let x = 0; x < b.map.width; x += 1) {
        const tag = tagAt(b.map, x, y);
        if (tag === 'water') found.water.push({ x, y });
        else if (tag === 'ruin') found.ruin.push({ x, y });
      }
    }
    tilesCache.set(b, found);
  }
  return found;
}

function nearest(spots: readonly Spot[], x: number, y: number): { distance: number; spot: Spot | undefined } {
  let best = Number.POSITIVE_INFINITY;
  let at: Spot | undefined;
  for (const s of spots) {
    const d = Math.hypot(s.x + 0.5 - x, s.y + 0.5 - y);
    if (d < best) {
      best = d;
      at = s;
    }
  }
  return { distance: best, spot: at };
}

/** The player's position (x, y in tiles, fractions allowed, the tile's centre at +0.5) to the bed levels. */
export function soundscape(b: Bundle, state: State, tick: number, x: number, y: number): Scape {
  const none = { level: 0, pan: 0 };
  const scape: Scape = { fire: none, stream: none, dread: none, crackle: none };

  // the campfire sounds only once it is built
  const fireBuilt = Object.entries(b.camps).some(([id, c]) => c.slot === 'fire' && state.player.camp.includes(id));
  const fire = fireBuilt ? campTile(b, 'fire') : undefined;
  if (fire) {
    const d = Math.hypot(fire[0] + 0.5 - x, fire[1] + 0.5 - y);
    scape.fire = { level: falloff(d, FIRE_RANGE[0], FIRE_RANGE[1]), pan: panFor(fire[0] + 0.5 - x, FIRE_RANGE[1]) };
  }

  const water = nearest(tiles(b).water, x, y);
  if (water.spot) {
    scape.stream = {
      level: falloff(water.distance, STREAM_RANGE[0], STREAM_RANGE[1]),
      pan: panFor(water.spot.x + 0.5 - x, STREAM_RANGE[1]),
    };
  }

  // dread: the ruins, and a predator's ground while it hunts; never on safe ground, softer by day
  const here: [number, number] = [Math.floor(x), Math.floor(y)];
  if (!isSafe(b, state, here)) {
    const ruin = nearest(tiles(b).ruin, x, y);
    let near = ruin.distance;
    for (const h of hazardsOf(b)) {
      if (h.kind !== 'predator' || !windowOpen(b, h, tick)) continue;
      const dx = Math.max(h.rect.x - x, 0, x - (h.rect.x + h.rect.w));
      const dy = Math.max(h.rect.y - y, 0, y - (h.rect.y + h.rect.h));
      near = Math.min(near, Math.max(0, Math.hypot(dx, dy) - h.reach));
    }
    const dusk = isNight(b, tick) ? 1 : 0.5;
    scape.dread = { level: falloff(near, DREAD_RANGE[0], DREAD_RANGE[1]) * dusk, pan: 0 };
  }

  // a fire prop crackles while the kernel says it burns, and silent once out: the nearest is heard
  for (const p of b.map.props) {
    if (p.fire !== true || p.id === undefined || !fireBurns(state, p.id, tick)) continue;
    const [cx, cy] = [p.x + p.w / 2, p.y + p.h / 2];
    const level = falloff(Math.hypot(cx - x, cy - y), CRACKLE_RANGE[0], CRACKLE_RANGE[1]);
    if (level > scape.crackle.level) scape.crackle = { level, pan: panFor(cx - x, CRACKLE_RANGE[1]) };
  }
  return scape;
}
