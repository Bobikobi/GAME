/**
 * The senses (HUNTING 3): sight, hearing and the line between, as integer tests with no roll. Every
 * distance is a squared distance against a radius squared; no square root, no float.
 */
import { idivUp } from '../num';
import type { Creature, Tile, WildKind, WildView } from './types';
import { WILD } from './types';

/** The squared distance between two tiles. */
export function d2(a: Tile, b: Tile): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/**
 * Whether nothing between two tiles stops sight: an integer Bresenham line, both ends excluded. Traced
 * from the lower end (by y, then x), so the answer is the same in both directions.
 */
export function lineClear(view: Pick<WildView, 'blocks'>, a: Tile, b: Tile): boolean {
  const swap = b[1] < a[1] || (b[1] === a[1] && b[0] < a[0]);
  const [x0, y0] = swap ? b : a;
  const [x1, y1] = swap ? a : b;
  if (x0 === x1 && y0 === y1) return true;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    if (x === x1 && y === y1) return true;
    if (view.blocks(x, y)) return false;
  }
}

/** Whether a tile lies in the animal's front half: the facing and the offset make a product of 0 or more. */
export function inFront(c: Creature, to: Tile): boolean {
  return c.face[0] * (to[0] - c.at[0]) + c.face[1] * (to[1] - c.at[1]) >= 0;
}

/**
 * The sight radius toward a tile before the rear halving (owner question 5 default: cover and the
 * head-down beat first, floor 1, then halve behind). Asleep, a third of its sight all round.
 */
export function sightRadius(kind: WildKind, c: Creature, view: Pick<WildView, 'cover'>, to: Tile): number {
  if (c.state === 'SLEEP') return idivUp(kind.sight, 3);
  let s = kind.sight;
  if (c.state === 'GRAZE' && !c.up) s -= 2;
  if (c.state === 'ALERT' && c.back) s += WILD.backSight;
  if (view.cover(to[0], to[1])) s -= 2;
  return Math.max(1, s);
}

/** Whether the animal sees a tile; `r` is the radius that held. Within 2 tiles always, walls or not. */
export function seesTile(kind: WildKind, c: Creature, view: Pick<WildView, 'cover' | 'blocks'>, to: Tile): { r: number } | undefined {
  const s = sightRadius(kind, c, view, to);
  const r = c.state === 'SLEEP' || inFront(c, to) ? s : idivUp(s, 2);
  const dd = d2(c.at, to);
  if (dd <= 4) return { r };
  if (dd <= r * r && lineClear(view, c.at, to)) return { r };
  return undefined;
}

/** Sight of the player. A sleeper is not a player to an animal (BEHAVIOUR 2, question 7 default A). */
export function seesPlayer(kind: WildKind, c: Creature, view: WildView): { r: number } | undefined {
  const p = view.player;
  if (!p || p.asleep) return undefined;
  return seesTile(kind, c, view, p.at);
}

/** Hearing: a noise of radius `noise` at a tile is heard within noise + ear. Walls do not stop it. */
export function hearsNoise(kind: WildKind, c: Creature, at: Tile, noise: number): { r: number } | undefined {
  const r = noise + kind.ear;
  if (r <= 0) return undefined;
  return d2(c.at, at) <= r * r ? { r } : undefined;
}

/** What the animal notices this step: the tile, the radius that counts and the squared distance. */
export interface Notice {
  at: Tile;
  r: number;
  dd: number;
}

/**
 * The player by sight and by hearing on one shared count, with the larger radius of the senses that
 * fired (owner question 4 default); then each hunter it sees (question 1 default A). The most pressing
 * one wins: the lowest threshold, then the nearest, the player first.
 */
export function notices(kind: WildKind, c: Creature, view: WildView): Notice | undefined {
  let best: Notice | undefined;
  const consider = (n: Notice) => {
    if (!best) best = n;
    else {
      const a = threshold(n.dd, n.r);
      const b = threshold(best.dd, best.r);
      if (a < b || (a === b && n.dd < best.dd)) best = n;
    }
  };
  const p = view.player;
  if (p && !p.asleep) {
    const seen = seesPlayer(kind, c, view);
    const heard = hearsNoise(kind, c, p.at, p.noise);
    if (seen || heard) consider({ at: p.at, r: Math.max(seen?.r ?? 0, heard?.r ?? 0), dd: d2(c.at, p.at) });
  }
  for (const t of view.threats) {
    const seen = seesTile(kind, c, view, t);
    if (seen) consider({ at: t, r: seen.r, dd: d2(c.at, t) });
  }
  return best;
}

/** Sensed steps in a row needed to notice (HUNTING 3): 1 within 2 tiles, 2 in the inner half, 3 in the outer. */
export function threshold(dd: number, r: number): 1 | 2 | 3 {
  if (dd <= 4) return 1;
  if (4 * dd <= r * r) return 2;
  return 3;
}
