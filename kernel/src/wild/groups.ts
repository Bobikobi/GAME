/**
 * Groups (BEHAVIOUR 5.1, from the groups page of 30.10): who leads, how big a group is drawn, how a
 * member follows, who flees with whom, and where a scattered herd comes back together. Pure: a member
 * reads the others and never writes them; the size is the spawner's, applied by the caller.
 */
import { type Seed, draw, drawBasisPoints } from '../rng';
import { KernelError, idiv } from '../num';
import { ringTiles } from './paths';
import { d2 } from './senses';
import { type Creature, type Tile, type WildKind, type WildView, WILD, roll } from './types';

export type Band = 0 | 1 | 2 | 3;

/** The leader is the member with the lowest id; when it is taken the next lowest leads (5.1.3). */
export function leaderOf(members: readonly Creature[]): Creature {
  let lead = members[0];
  if (!lead) throw new KernelError('a group has at least one member');
  for (const m of members) if (m.id < lead.id) lead = m;
  return lead;
}

/** The band a basis-point draw (0 to 9999) lands in, by the four weights of 100 (5.1.2 rule 2). */
export function drawBand(bands: readonly [number, number, number, number], bp: number): Band {
  let acc = 0;
  for (let i = 0; i < 3; i++) {
    acc += bands[i]! * 100;
    if (bp < acc) return i as Band;
  }
  return 3;
}

/** The count inside a band from a second draw: 1; 2; 3 to 4; 5 to 12. */
export function sizeInBand(band: Band, r: number): number {
  if (band === 0) return 1;
  if (band === 1) return 2;
  if (band === 2) return 3 + (r % 2);
  return 5 + (r % 8);
}

const BAND_LOW = [1, 2, 3, 5] as const;
const BAND_TOP = [1, 2, 4, 12] as const;

/**
 * A group's target size: the band, then the count; a band the region's room cannot hold is drawn as
 * the largest band that can, at the most the room allows (5.1.2 rule 6). Never under 1.
 */
export function targetSize(kind: WildKind, bpBand: number, rCount: number, room: number): number {
  const drawn = drawBand(kind.bands, bpBand);
  let band = drawn;
  while (band > 0 && BAND_LOW[band] > room) band = (band - 1) as Band;
  const size = band === drawn ? sizeInBand(band, rCount) : BAND_TOP[band];
  return Math.max(1, Math.min(size, room));
}

/** One member gained or shed a period, never more (5.1.2 rule 4). */
export function refillStep(count: number, target: number): -1 | 0 | 1 {
  if (count < target) return 1;
  if (count > target) return -1;
  return 0;
}

/** The group period of a game day: floor(day / refill_d) (5.1.2 rule 1). */
export function groupPeriod(day: number, refillDays: number): number {
  return idiv(day, refillDays);
}

/**
 * The two server draws of a period: the band in basis points and the count, each on its own counter
 * of the anchor's `group:` entity, so no other rule keyed on the anchor collides (5.1.2 rule 2).
 */
export function groupDraws(seed: Seed, anchor: string, period: number): { bp: number; r: number } {
  return { bp: drawBasisPoints(seed, `group:${anchor}`, 2 * period), r: draw(seed, `group:${anchor}`, 2 * period + 1) };
}

/** Whether a tile is inside the square ring an animal keeps out of after a flight (HUNTING 2, FLEE). */
export function avoids(c: Creature, tick: number, t: Tile): boolean {
  if (!c.from || c.avoidUntil === undefined || tick >= c.avoidUntil) return false;
  return Math.max(Math.abs(t[0] - c.from[0]), Math.abs(t[1] - c.from[1])) <= WILD.avoidTiles;
}

/** How close a member keeps to the leader's target: a herd 3, a flock and a pack 2 (5.1.3). */
export function followReach(kind: WildKind): number {
  return kind.group === 'herd' ? 3 : 2;
}

/** A member's WANDER target: a free tile within its reach of the leader's target, or of the leader. */
export function followTarget(kind: WildKind, member: Creature, leader: Creature, view: WildView): Tile | undefined {
  const base = leader.target ?? leader.at;
  const choices = ringTiles(base, 0, followReach(kind)).filter(
    (t) => view.open(t[0], t[1]) && !(t[0] === leader.at[0] && t[1] === leader.at[1]) && !avoids(member, view.tick, t),
  );
  return choices.length ? choices[roll(member, view, choices.length)] : undefined;
}

/** The members within 8 tiles of one that flees: each enters FLEE at its own next think (question 10 default A). */
export function spreadFlee(fleeing: Creature, group: readonly Creature[]): Creature[] {
  return group.filter((m) => m.id !== fleeing.id && !m.under && d2(m.at, fleeing.at) <= WILD.spread * WILD.spread);
}

/**
 * Where a scattered member comes back to (5.1.3): a free tile within 3 of the anchor outside the
 * avoided ring; when the anchor lies inside the ring, the ring's edge nearest the anchor, to wait there.
 */
export function regroupTarget(c: Creature, view: WildView): Tile | undefined {
  const near = ringTiles(view.anchorAt, 0, 3).filter((t) => view.open(t[0], t[1]) && !avoids(c, view.tick, t));
  if (near.length) return near[roll(c, view, near.length)];
  if (!c.from) return undefined;
  let best: Tile | undefined;
  for (const t of ringTiles(c.from, WILD.avoidTiles + 1, WILD.avoidTiles + 1)) {
    if (!view.open(t[0], t[1])) continue;
    if (!best || d2(t, view.anchorAt) < d2(best, view.anchorAt)) best = t;
  }
  return best;
}

/** Whether a kind regroups at its anchor after a flight: herds, and flocks that run on the ground (5.1.3). */
export function regroups(kind: WildKind): boolean {
  return kind.group === 'herd' || (kind.group === 'flock' && kind.flight !== 'fly');
}
