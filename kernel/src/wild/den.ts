/**
 * A den's second mouth (docs/design/HUNT_FAMILIES.md section 3.1, the line home): where a burrower flushed out of
 * its den comes out. The mouth is the anchor, the kind's spot; the bolt hole is a second tile between
 * `wild.bolt_min_tiles` and `wild.bolt_max_tiles` from it by the squared distance, on the kind's habitat, open
 * ground the burrower can run to from the mouth. The server draws it with its own keyed entity, `bolt:<anchor id>`,
 * so no other draw on the anchor collides with it (CREATURE_BEHAVIOUR section 5.1.2). The draw is stable for a given
 * content only: the list is built from the bundle on every call, so a change near the den (a prop, a tile, the ring)
 * can reshape it and the same draw pick another tile. So the step that lays the anchor draws once and stores the tile
 * on it, and never draws again (HUNT_FAMILIES section 3.1; the line home's pull request). The content check asks the
 * same list, so a spot with no possible bolt hole never ships.
 *
 * Integers only, fixed orders: rings by the squared distance, nearest first, each ring clockwise from north. The
 * tile and the neighbour order N E S W are the wild brain's (`./types`, `./paths`). The walk also takes the height
 * rule (`makeStepRule`), which the brain's maps do not yet: they test each tile with `WildView.open` alone, so until
 * the brain's `open` takes the step rule too (the pull request that steps animals), its home map can cross a cliff
 * this walk does not.
 */
import type { Bundle } from '../bundle';
import { type Seed, draw } from '../rng';
import { makeStepRule, staticSolid, tagAt } from '../world';
import { NEIGHBOURS } from './paths';
import type { Tile } from './types';

/** A den's tile: the brain's `Tile`, named here because the brain's types are not yet exported from the kernel. */
export type DenTile = Tile;

/** 0 to 3: the quarter of the turn from north, clockwise, an offset lies in (y grows southward). */
function quarter(dx: number, dy: number): number {
  if (dx >= 0 && dy < 0) return 0;
  if (dx > 0 && dy >= 0) return 1;
  if (dx <= 0 && dy > 0) return 2;
  return 3;
}

/** Ring order: the squared distance first, then clockwise from north. Never 0 for two different offsets. */
export function ringOrder(a: DenTile, b: DenTile): number {
  const da = a[0] * a[0] + a[1] * a[1];
  const db = b[0] * b[0] + b[1] * b[1];
  if (da !== db) return da - db;
  const qa = quarter(a[0], a[1]);
  const qb = quarter(b[0], b[1]);
  if (qa !== qb) return qa - qb;
  // inside one quarter, clockwise on the screen is a positive cross product
  return b[0] * a[1] - a[0] * b[1];
}

/**
 * Every tile that may be the den's bolt hole, in ring order: within the squared ring of `wild.bolt_min_tiles` to
 * `wild.bolt_max_tiles` round the mouth, on one of `habitat`'s tags, not solid and not water, and reached from the
 * mouth on open ground by four-way steps the height rule allows, inside the ring's box (the burrower's ground flee
 * map). Empty when no tile qualifies, which the check refuses for a spot of a kind that sleeps in a den.
 */
export function boltCandidates(bundle: Bundle, mouth: DenTile, habitat: readonly string[]): DenTile[] {
  const map = bundle.map;
  const { bolt_min_tiles: lo, bolt_max_tiles: hi } = bundle.params.wild;
  const solid = staticSolid(map);
  const stepOk = makeStepRule(bundle);
  const [mx, my] = mouth;
  const open = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && Math.abs(x - mx) <= hi && Math.abs(y - my) <= hi && solid[y * map.width + x] === 0 && tagAt(map, x, y) !== 'water';
  const side = 2 * hi + 1;
  const seen = new Uint8Array(side * side);
  const key = (x: number, y: number) => (y - my + hi) * side + (x - mx + hi);
  const queue: DenTile[] = [[mx, my]];
  seen[key(mx, my)] = 1;
  const found: DenTile[] = [];
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head]!;
    const dx = x - mx;
    const dy = y - my;
    const d2 = dx * dx + dy * dy;
    if (d2 >= lo * lo && d2 <= hi * hi && habitat.includes(tagAt(map, x, y) ?? '')) found.push([dx, dy]);
    for (const [nx, ny] of NEIGHBOURS) {
      const tx = x + nx;
      const ty = y + ny;
      if (!open(tx, ty) || seen[key(tx, ty)] === 1 || !stepOk(x, y, tx, ty)) continue;
      seen[key(tx, ty)] = 1;
      queue.push([tx, ty]);
    }
  }
  return found.sort(ringOrder).map(([dx, dy]) => [mx + dx, my + dy] as const);
}

/**
 * The den's bolt hole: the candidate the keyed draw `bolt:<anchor id>` picks, counter 0. Server only: the seed never
 * leaves it (kernel review R4), and the tile reaches a client with the found den. Undefined when the spot has no
 * candidate (the check keeps such a spot out of the content).
 */
export function boltHole(bundle: Bundle, seed: Seed, anchorId: string, mouth: DenTile, habitat: readonly string[]): DenTile | undefined {
  const list = boltCandidates(bundle, mouth, habitat);
  if (list.length === 0) return undefined;
  return list[draw(seed, `bolt:${anchorId}`, 0) % list.length];
}

/**
 * The id of the anchor a spot stands for: `kind@x,y`, the key every draw and every found den uses. The check refuses
 * two spots of one kind with `behaviour` on one tile, so no two anchors share an id.
 */
export function anchorId(kind: string, x: number, y: number): string {
  return `${kind}@${x},${y}`;
}
