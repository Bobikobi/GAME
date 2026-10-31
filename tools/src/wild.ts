/**
 * The wild's content rows (docs/design/HUNTING.md sections 2, 8 and 12; CREATURE_BEHAVIOUR section 7; HUNT_FAMILIES
 * section 8): every rule about a kind's `behaviour` that reads only the content. A kind without `behaviour` is
 * cosmetic and none of these rows reads it.
 *
 * Left for later, with their targets:
 * - kernel tests of the pull requests that step animals, since each needs an animal stepped: a sleeper never a
 *   target; nothing writes another animal; a group that changes size only while nobody looks, by one member, once a
 *   period; the keyed-draw prefixes; a pack off the road to safety; a den anchor that never moves; a group draw read
 *   only by the server's spawner, and no client that reads the seed (CREATURE_BEHAVIOUR 7, the last row).
 * - the families as data, the rigs and the ladder: a way the family's style does not use; a member harder only by
 *   its drops; a family's mark dropped by another family; a body that is not the family's own body (here only one
 *   body a family is read); a looping clip under four poses (HUNT_FAMILIES 8).
 * - a silent kind with no drawn tell (CREATURE_BEHAVIOUR 7, row 4): no field holds the tell yet.
 * - the rows of HUNT_FAMILIES 3a, once their tools exist: a bait its family does not take; a call that draws a
 *   defender or a hunter; a companion's limits; a tree perch or a blind inside a predator's watch; a weir; a reed
 *   blind or a drive hedge off its ground; a tool strike outside the burst window; a player-set trap with harm.
 *
 * A kind's danger is its `hunt.danger`; a kind with no `hunt` is ambient and reads as danger 0.
 */
import { type Bundle, anchorId, boltCandidates, distanceTo, idiv, isSafeGround, regionOf, tagAt } from '@game/kernel';
import { GROUP_BAND_SIZES, GROUP_BANDS } from '@game/schema';
import type { Issue } from './load';

type Bands = readonly [number, number, number, number];

/** HUNTING section 8: no wild kind is laid this close to a town square, in tiles. */
export const TOWN_SQUARE_CLEAR = 12;
/** What a scavenger at danger 0 sleeps on, out of a defender's reach (CREATURE_BEHAVIOUR section 7). */
const SAFE_SLEEPS = ['tree', 'roof', 'rock', 'den'];

const sum = (bands: Bands) => bands[0] + bands[1] + bands[2] + bands[3];
const byId = <T>(entries: [string, T][]) => entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

export function checkWild(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const map = b.map;
  const file = origin[map.id] ?? 'content';
  const err = (where: string, message: string) => issues.push({ file, where, message, level: 'error' });
  const warn = (where: string, message: string) => issues.push({ file, where, message, level: 'warning' });
  const kinds = map.creatures?.kinds ?? {};
  const spots = map.creatures?.spots ?? [];

  // the tags of the whole map, and of each region (kernel regionOf: a map region, else the map's own), in scan order
  const tagCount = new Map<string, number>();
  const regionTags = new Map<string, Map<string, number>>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tag = tagAt(map, x, y);
      if (tag === undefined) continue;
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
      const region = regionOf(b, x, y);
      const counts = regionTags.get(region) ?? new Map<string, number>();
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
      regionTags.set(region, counts);
    }
  }
  const squares = map.slots.filter((s) => s.kind === 'area' && s.tag === 'town');
  const families = new Map<string, string[]>();

  for (const [id, k] of byId(Object.entries(kinds))) {
    const be = k.behaviour;
    if (!be) continue;
    const at = `map.creatures.kinds.${id}.behaviour`;
    const danger = k.hunt?.danger ?? 0;

    // CREATURE_BEHAVIOUR 7: the temperament
    const shares = be.weights.idle + be.weights.graze + be.weights.wander;
    if (shares !== 100) err(`${at}.weights`, `idle, graze and wander sum to ${shares}, they must sum to 100 (CREATURE_BEHAVIOUR 1)`);
    if (be.flight === 'fly' && (be.sleeps === 'water' || be.sleeps === 'den')) {
      err(`${at}.sleeps`, `a flier does not sleep ${be.sleeps === 'water' ? 'in the water' : 'in a den'}: tree, rock, reeds, roof or ground (CREATURE_BEHAVIOUR 1)`);
    }
    for (const tag of be.habitat) {
      if (!tagCount.get(tag)) err(`${at}.habitat`, `no tile of the map is "${tag}": a habitat names ground the map has (CREATURE_BEHAVIOUR 3)`);
    }
    if (be.habitat.includes('town') && be.town !== 'town_kind') {
      err(`${at}.habitat`, 'a wild kind never lives on the town: name town only on a town kind (CREATURE_BEHAVIOUR 2 and 3)');
    }
    if (be.carrion && danger === 0 && !SAFE_SLEEPS.includes(be.sleeps)) {
      err(`${at}.sleeps`, `a scavenger at danger 0 sleeps out of reach, on a tree, a roof, a rock or in a den, not on the ${be.sleeps} (CREATURE_BEHAVIOUR 5)`);
    }

    // CREATURE_BEHAVIOUR 5.1.1: the group
    const g = be.group;
    const rows: [string, Bands][] = [['bands', g.bands], ...Object.entries(g.season ?? {}).map(([s, r]): [string, Bands] => [`season.${s}`, r as Bands])];
    for (const [name, row] of rows) {
      const n = sum(row);
      if (n !== 100) err(`${at}.group.${name}`, `the band weights sum to ${n}, they must sum to 100 (CREATURE_BEHAVIOUR 5.1.1)`);
      if (g.class === 'solitary' && row[2] + row[3] > 0) {
        err(`${at}.group.${name}`, 'a solitary kind stands alone or, in its season, as a pair: no weight on small or large (CREATURE_BEHAVIOUR 5.1.1)');
      }
    }
    if (g.class === 'pack' && danger === 0) err(`${at}.group.class`, 'a pack is hunters or defenders: a kind at danger 0 is a herd, a flock or solitary (CREATURE_BEHAVIOUR 5.1.1)');
    if (g.class === 'flock' && be.flight !== 'fly' && be.alarm < 5) {
      err(`${at}.group.class`, 'a flock flies, or bursts as one with an alarm of 5 or more like the ground fowl (CREATURE_BEHAVIOUR 5.1.1)');
    }
    if (g.sentinel && g.class !== 'herd' && g.class !== 'flock') err(`${at}.group.sentinel`, 'only a herd or a flock keeps a sentinel (CREATURE_BEHAVIOUR 5.1.1)');

    // HUNT_FAMILIES 8: the flush, only out of a burrower's den at danger 0, never a protected kind
    if (be.flush) {
      const why = [
        be.flight !== 'burrow' ? `its flight is ${be.flight}, not burrow` : '',
        be.sleeps !== 'den' ? `it sleeps on ${be.sleeps}, not in a den` : '',
        danger > 0 ? `its danger is ${danger}` : '',
        k.protected ? 'it is protected' : '',
      ].filter((w) => w !== '');
      if (why.length > 0) err(`${at}.flush`, `no flush: ${why.join(', ')}; only a burrower in its den at danger 0 is flushed (HUNT_FAMILIES 3.1; HUNTING 10 and 11)`);
      else {
        // the flusher stands next to the mouth, diagonal included, beyond the burrower's sight of the nearest bolt hole
        const near = nearestFlusherToBolt(b);
        if (near <= be.sight * be.sight) {
          err(`${at}.flush`, `a flusher beside the mouth stands within sight ${be.sight} of a bolt hole (squared distance ${near}): raise wild.bolt_min_tiles or lower the sight (HUNT_FAMILIES 3.1)`);
        }
      }
    }

    const members = families.get(be.family) ?? [];
    members.push(id);
    families.set(be.family, members);

    // CREATURE_BEHAVIOUR 5.1.2 rule 6 and section 7: a band that no region of its habitat can hold is cut at the step; a
    // warning, not a refusal. The standing count is a region's, so the region with the most habitat tiles is the best
    // any band can find (the first in scan order on a tie); a map with no regions is one region.
    if (k.hunt) {
      let region = map.id;
      let ground = 0;
      for (const [id, counts] of regionTags) {
        const n = be.habitat.reduce((sum, tag) => sum + (counts.get(tag) ?? 0), 0);
        if (n > ground) [region, ground] = [id, n];
      }
      const standing = idiv(k.hunt.spawn.cap_per_1000 * ground, 1000);
      for (const [name, row] of rows) {
        const top = [3, 2, 1, 0].find((j) => row[j]! > 0);
        if (top !== undefined && GROUP_BAND_SIZES[top]![0] > standing) {
          warn(
            `${at}.group.${name}`,
            `weight on the ${GROUP_BANDS[top]} band (${GROUP_BAND_SIZES[top]![0]} or more) but no region of its habitat holds that many at its cap: the best, ${region}, has ${ground} habitat tiles and stands ${standing}, so the step will cut it (CREATURE_BEHAVIOUR 5.1.2 rule 6)`,
          );
        }
      }
    }
  }

  // HUNT_FAMILIES 7 and 8: one body a family, and a harder member never quicker to take
  for (const [family, ids] of byId([...families.entries()])) {
    const looks = new Map<string, number>();
    for (const id of ids) looks.set(kinds[id]!.look, (looks.get(kinds[id]!.look) ?? 0) + 1);
    if (looks.size > 1) {
      // the look most members wear is the family's body, and each member off it is named; on a tie no member is the
      // odd one by count, so every member is named
      const most = Math.max(...looks.values());
      const leaders = [...looks.entries()].filter(([, n]) => n === most);
      const body = leaders.length === 1 ? leaders[0]![0] : undefined;
      const all = ids.map((id) => `${id} is ${kinds[id]!.look}`).join(', ');
      for (const id of ids) {
        if (kinds[id]!.look === body) continue;
        err(`map.creatures.kinds.${id}.look`, `the ${family} share one body${body ? `, ${body}` : ''}: ${all} (HUNT_FAMILIES 7)`);
      }
    }
    const hunted = ids.filter((id) => kinds[id]!.hunt);
    for (const hi of hunted) {
      for (const lo of hunted) {
        const h = kinds[hi]!.hunt!;
        const l = kinds[lo]!.hunt!;
        if (h.tier > l.tier && h.take_s < l.take_s) {
          err(`map.creatures.kinds.${hi}.hunt.take_s`, `${hi} is tier ${h.tier} but taken in ${h.take_s} s, quicker than ${lo} at tier ${l.tier} in ${l.take_s} s: a harder member takes longer (HUNT_FAMILIES 4, LANDS 1)`);
        }
      }
    }
  }

  // the spots: a wild kind's anchors
  const anchors = new Map<string, number>();
  spots.forEach((s, i) => {
    const k = kinds[s.kind];
    const be = k?.behaviour;
    if (!k || !be) return;
    const where = `map.creatures.spots.${i}`;
    const danger = k.hunt?.danger ?? 0;
    // one anchor of a kind a tile: its id keys the group, bolt and quality draws and the found dens (kernel wild/den.ts)
    const anchor = anchorId(s.kind, s.x, s.y);
    const first = anchors.get(anchor);
    if (first === undefined) anchors.set(anchor, i);
    else err(where, `a second ${s.kind} anchor on ${s.x},${s.y}, after spot ${first}: one anchor of a kind a tile, since its id ${anchor} keys every draw (CREATURE_BEHAVIOUR 5.1.2 rule 2)`);
    if (danger === 2) err(where, `${s.kind} hunts the player (danger 2): no spot until the fight lands; the bank wolf stays the hazard on its round (HUNTING 2 and 8; G34, G35)`);
    if (be.town !== 'town_kind') {
      const square = squares.find((q) => distanceTo([s.x, s.y], q) <= TOWN_SQUARE_CLEAR);
      if (square) err(where, `${s.kind} at ${s.x},${s.y} is within ${TOWN_SQUARE_CLEAR} tiles of ${square.id}: a wild kind is laid farther out (HUNTING 8)`);
      else if (isSafeGround(b, [s.x, s.y], true)) err(where, `${s.kind} at ${s.x},${s.y} is on safe ground: a wild kind is laid in the open (HUNTING 8)`);
    }
    if (be.drinks && !waterWithin(b, s.x, s.y, be.roam)) {
      err(where, `${s.kind} drinks but no water or riverbank tile lies within its roam of ${be.roam} round ${s.x},${s.y} (CREATURE_BEHAVIOUR 4)`);
    }
    if (be.flight === 'burrow' && be.sleeps === 'den' && boltCandidates(b, [s.x, s.y], be.habitat).length === 0) {
      const { bolt_min_tiles: lo, bolt_max_tiles: hi } = b.params.wild;
      err(where, `${s.kind}'s den at ${s.x},${s.y} has no bolt hole: no open ${be.habitat.join(' or ')} tile ${lo} to ${hi} tiles away that it can run to from the mouth (HUNT_FAMILIES 3.1)`);
    }
  });
  return issues;
}

/** Whether a water or riverbank tile lies within `roam` of (x, y) by the squared distance. */
function waterWithin(b: Bundle, x: number, y: number, roam: number): boolean {
  for (let ty = Math.max(0, y - roam); ty <= Math.min(b.map.height - 1, y + roam); ty++) {
    for (let tx = Math.max(0, x - roam); tx <= Math.min(b.map.width - 1, x + roam); tx++) {
      const tag = tagAt(b.map, tx, ty);
      if ((tag === 'water' || tag === 'riverbank') && (tx - x) ** 2 + (ty - y) ** 2 <= roam * roam) return true;
    }
  }
  return false;
}

/** The least squared distance from a tile next to a den's mouth to any tile of the bolt hole ring (HUNT_FAMILIES 3.1). */
export function nearestFlusherToBolt(b: Bundle): number {
  const { bolt_min_tiles: lo, bolt_max_tiles: hi } = b.params.wild;
  let best = Number.MAX_SAFE_INTEGER;
  for (let by = -hi; by <= hi; by++) {
    for (let bx = -hi; bx <= hi; bx++) {
      const d = bx * bx + by * by;
      if (d < lo * lo || d > hi * hi) continue;
      for (let fy = -1; fy <= 1; fy++) {
        for (let fx = -1; fx <= 1; fx++) {
          if (fx === 0 && fy === 0) continue;
          best = Math.min(best, (bx - fx) ** 2 + (by - fy) ** 2);
        }
      }
    }
  }
  return best;
}
