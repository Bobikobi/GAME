/**
 * A save from older content, brought to the content of today (DECISIONS.md, 2026-10-07: "A save from older
 * content is adapted by dropping ids that no longer exist"). The phone runs it on a save it loads, and the
 * server on a state it stored under a bundle it no longer runs, so a new version of the world never locks a
 * character out: `step` refuses a state whose `content` is not the bundle's tag.
 */
import type { Bundle } from './bundle';
import { preyKey, recordHuntBatches } from './hunt';
import { mulDiv } from './num';
import { appearSlots } from './reactions';
import { anchorId } from './wild/den';
import { relocationOf } from './relocate';
import { inRect, placeName } from './world';
import { KERNEL_VERSION, fitWorn, groundKey, mapFrame, migrateStoneState, type HuntStock, type State } from './state';
import { startRecipes } from './step';

/**
 * The state as today's content can play it: what still exists is kept, what left the content is dropped,
 * and the state takes the bundle's tag. Undefined when the character's race left the content: nothing can
 * stand in for it. Pure: returns a new object and leaves the input as it was.
 */
export function adaptState(bundle: Bundle, saved: State): State | undefined {
  const state = structuredClone(saved);
  const p = state.player;
  if (p.stones) {
    const book = (p.stones = migrateStoneState(p.stones));
    if (book.carry && bundle.params.liftables[book.carry]?.class !== 'arms') delete book.carry;
    book.returns = book.returns.filter(({ kind }) => !!bundle.params.liftables[kind]);
    for (const [key, pile] of Object.entries(book.placed)) {
      for (const kind of Object.keys(pile)) if (!bundle.params.liftables[kind]) delete pile[kind];
      if (Object.keys(pile).length === 0) delete book.placed[key];
    }
  }
  if (p.race !== '' && !bundle.races[p.race]) return undefined;
  // a wake pocket that left the content: the mist and the first task fall back to the map's spawn
  if (p.pocket !== '' && !bundle.pockets[p.pocket]) p.pocket = '';
  // saves from kernel 0.1 have no look, and a look can be withdrawn with its sprite
  if (typeof p.look !== 'number' || (p.look === 1 && p.race !== '' && !bundle.races[p.race]?.sprite_alt)) p.look = 0;
  const keepKeys = <T>(record: Record<string, T>, known: Record<string, unknown>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).filter(([k]) => k in known));
  p.bag = keepKeys(p.bag, bundle.items);
  if (p.huntStock) p.huntStock.bag = keepKeys(p.huntStock.bag, p.bag);
  p.wear = keepKeys(p.wear, bundle.items);
  p.made = keepKeys(p.made, bundle.recipes);
  p.quests = keepKeys(p.quests, bundle.quests);
  p.rep = keepKeys(p.rep, bundle.npcs);
  p.xp = keepKeys(p.xp, bundle.professions);
  p.journal = p.journal.filter((id) => id in bundle.items);
  p.recipes = p.recipes.filter((id) => id in bundle.recipes);
  // a recipe everyone starts with that came with this version is known at once
  if (p.race !== '') {
    // a recipe behind a closed gate is not handed out: it comes the first load after its gate opens
    const fresh = startRecipes(bundle).filter((id) => !p.recipes.includes(id));
    if (fresh.length > 0) p.recipes = [...p.recipes, ...fresh].sort();
  }
  // a race whose outfit came with this version: a save that never held an outfit piece gets it once. The journal
  // is the save's record of every item the character held, and a sale or a drop never takes an entry out, so a
  // piece sold or dropped is not handed out again by the next release (the second finding of the #490 review).
  // (the pocket's tools are never granted here: they lie on the ground by the wake)
  if (p.race !== '') {
    for (const stack of bundle.races[p.race]!.outfit ?? []) {
      if ((p.bag[stack.item] ?? 0) > 0 || p.journal.includes(stack.item)) continue;
      p.bag[stack.item] = stack.qty;
      if (!p.journal.includes(stack.item)) p.journal = [...p.journal, stack.item].sort();
    }
  }
  p.tries = keepKeys(p.tries, bundle.recipes);
  p.restored = p.restored.filter((id) => id in bundle.restores);
  p.camp = p.camp.filter((id) => id in bundle.camps);
  p.visited = p.visited.filter((id) => bundle.map.slots.some((s) => s.id === id));
  // a place that left the map is no place any more: it is neither seen nor counted (G63, G66)
  if (p.seen) p.seen = p.seen.filter((id) => placeName(bundle.map, id) !== undefined);
  if (p.explored) p.explored = p.explored.filter((id) => placeName(bundle.map, id) !== undefined);
  // what a searchable holds goes with it, and a row whose item left the content is dropped
  state.searched = Object.fromEntries(
    Object.entries(keepKeys(state.searched ?? {}, bundle.searchables)).map(([id, held]) => [id, { ...held, rows: held.rows.filter((item) => item in bundle.items) }]),
  );
  // the authored ground moved inside a larger map (gap M5): every saved tile moves with it, before the reach check below
  moveTiles(bundle, state);
  if (p.preyReturns) {
    const spots = new Set((bundle.map.creatures?.spots ?? []).map(preyKey));
    p.preyReturns = Object.fromEntries(Object.entries(p.preyReturns).filter(([key]) => spots.has(key)));
  }
  // a height layer may have walled the old tile off from every wake (G68): stand on the nearest tile a foot can reach, never a fall
  const stand = relocationOf(bundle, state);
  if (stand) p.at = stand;
  // a world that changed may have moved the hazards and the safe ground: nothing carries over
  p.outing = null;
  p.chase = null;
  p.fight ??= null;
  // a crossing under way whose passage or drawn event left the content puts in at the jetty it left
  if (p.aboard && !bundle.passages[p.aboard.passage]?.events[p.aboard.event]) p.aboard = null;
  // a node a reaction makes appear keeps its state under its own id, as long as the reaction stays
  state.nodes = keepKeys(state.nodes, { ...bundle.instances, ...Object.fromEntries(appearSlots(bundle)) });
  // `ice_grip` moved from feet to the new gloves place. An older save keeps the piece worn,
  // in its new place, instead of having it silently removed by the fit check below.
  const oldIceGrip = p.worn.feet === undefined ? undefined : bundle.items[p.worn.feet];
  if (oldIceGrip?.wear?.slot === 'hands' && oldIceGrip.wear.trait === 'ice_grip' && p.worn.hands === undefined) {
    p.worn.hands = p.worn.feet;
    delete p.worn.feet;
  }
  // a worn item that is gone, or no longer fits its place, comes off
  fitWorn(bundle, state);
  state.content = bundle.tag;
  state.kernel = KERNEL_VERSION;
  return state;
}

/** A prey cooldown's key (`anchorId`: `<kind>@<x>,<y>`) read back, or undefined when it is not one. */
function parsePreyKey(key: string): { kind: string; x: number; y: number } | undefined {
  const m = /^(.+)@(\d+),(\d+)$/.exec(key);
  return m ? { kind: m[1]!, x: Number(m[2]), y: Number(m[3]) } : undefined;
}

/**
 * Where a tile of the frame just before stands now, under a map that carries `remap`: the previous frame's slots, by
 * id. A tile inside one of them (the smallest that holds it, ties by the list's order) lands on the same share of
 * today's slot of that id, counted in whole tiles: (x - old.x) * new.w / old.w, rounded down, from new.x. A tile in
 * none moves with the nearest of them (four-way distance to its edge, ties by the list's order): the same step from
 * that slot's edge, from where the edge lies today. Integer-only, so every machine carries a save the same way.
 */
export function remapTile(bundle: Bundle, at: readonly [number, number]): [number, number] {
  const map = bundle.map;
  const today = new Map(map.slots.map((s) => [s.id, s]));
  const pairs = (map.remap?.slots ?? []).flatMap((old) => {
    const now = today.get(old.id);
    return now ? [{ old, now }] : [];
  });
  const clamp = (x: number, y: number): [number, number] => [Math.min(map.width - 1, Math.max(0, x)), Math.min(map.height - 1, Math.max(0, y))];
  if (pairs.length === 0) return clamp(at[0], at[1]);
  const [x, y] = at;
  let inside: (typeof pairs)[number] | undefined;
  for (const pair of pairs) {
    if (!inRect(x, y, pair.old)) continue;
    if (!inside || pair.old.w * pair.old.h < inside.old.w * inside.old.h) inside = pair;
  }
  // v lies inside the old slot here (a tile in it, or the nearest point of its edge), so the factor is never negative
  const share = (v: number, from: number, size: number, to: number, toSize: number): number => to + mulDiv(v - from, toSize, size);
  if (inside) {
    const { old, now } = inside;
    return clamp(share(x, old.x, old.w, now.x, now.w), share(y, old.y, old.h, now.y, now.h));
  }
  let near = pairs[0]!;
  let nearAt: [number, number] = [0, 0];
  let best = Infinity;
  for (const pair of pairs) {
    const ex = Math.min(pair.old.x + pair.old.w - 1, Math.max(pair.old.x, x));
    const ey = Math.min(pair.old.y + pair.old.h - 1, Math.max(pair.old.y, y));
    const d = Math.abs(x - ex) + Math.abs(y - ey);
    if (d < best) {
      best = d;
      near = pair;
      nearAt = [ex, ey];
    }
  }
  const { old, now } = near;
  return clamp(share(nearAt[0], old.x, old.w, now.x, now.w) + (x - nearAt[0]), share(nearAt[1], old.y, old.h, now.y, now.h) + (y - nearAt[1]));
}

/**
 * A state of an earlier map frame has its tiles carried into the map's frame, once: the player, the fire they
 * kindled, the carcasses, the snares, the prey's cooldowns, the stones and what lies dropped on the ground. A map
 * moved inside a larger one (`moved`) shifts every tile by one step, a tile that falls outside pulled to its nearest
 * edge; a map redrawn (`remap`) carries each tile slot by slot (`remapTile`). The reach check after it puts the
 * character on the nearest foot-reachable tile. The state then takes the map's frame, so a later change of content
 * never carries it again. A state of a later frame than the map's (a server rolled back) is left as it is.
 */
function moveTiles(bundle: Bundle, state: State): void {
  const frame = mapFrame(bundle);
  if (frame <= 1) return;
  const from = state.frame ?? 1;
  if (from >= frame) return;
  const moved = bundle.map.moved;
  const remap = bundle.map.remap;
  state.frame = frame;
  if (!moved && !remap) return;
  const { width, height } = bundle.map;
  const shift = remap
    ? (at: [number, number]): [number, number] => remapTile(bundle, at)
    : (at: [number, number]): [number, number] => [
        Math.min(width - 1, Math.max(0, at[0] + moved!.dx)),
        Math.min(height - 1, Math.max(0, at[1] + moved!.dy)),
      ];
  const p = state.player;
  p.at = shift(p.at);
  if (p.own) p.own.at = shift(p.own.at);
  for (const carcass of p.carcasses ?? []) carcass.at = shift(carcass.at);
  for (const snare of p.snares ?? []) snare.at = shift(snare.at);
  if (p.preyReturns && moved && !remap) {
    const returns = p.preyReturns;
    p.preyReturns = {};
    // Use today's spots and their earlier coordinates to preserve their cooldowns.
    for (const spot of bundle.map.creatures?.spots ?? []) {
      const until = returns[preyKey({ ...spot, x: spot.x - moved.dx, y: spot.y - moved.dy })];
      if (until !== undefined) p.preyReturns[preyKey(spot)] = until;
    }
  } else if (p.preyReturns) {
    // a redrawn map's spots are new: a cooldown follows its spot when the spot's carried tile is a spot of the same kind today, else it ends
    const returns = p.preyReturns;
    p.preyReturns = {};
    const spots = new Set((bundle.map.creatures?.spots ?? []).map(preyKey));
    for (const [key, until] of Object.entries(returns)) {
      const old = parsePreyKey(key);
      if (!old) continue;
      const [x, y] = shift([old.x, old.y]);
      const now = anchorId(old.kind, x, y);
      if (spots.has(now)) p.preyReturns[now] = Math.max(p.preyReturns[now] ?? 0, until);
    }
  }
  if (p.stones) {
    const placed: typeof p.stones.placed = {};
    for (const [key, pile] of Object.entries(p.stones.placed)) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      const target = (placed[groundKey(shift([x, y]))] ??= {});
      for (const [kind, count] of Object.entries(pile)) target[kind] = (target[kind] ?? 0) + count;
    }
    p.stones.placed = placed;
    // a redrawn map's stone spots are a new list: an index emptied on the old one names some other spot now, so every spot lies full again
    if (remap) p.stones.taken = {};
    for (const loan of p.stones.returns) {
      if (loan.key === '') continue;
      const [x, y] = loan.key.split(',').map(Number) as [number, number];
      loan.key = groundKey(shift([x, y]));
    }
  }
  if (p.ground) {
    const dropped: Record<string, Record<string, number>> = {};
    const huntGround: Record<string, HuntStock> = {};
    for (const [key, items] of Object.entries(p.ground)) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      const key2 = groundKey(shift([x, y]));
      dropped[key2] = { ...dropped[key2] };
      for (const [item, qty] of Object.entries(items)) dropped[key2][item] = (dropped[key2][item] ?? 0) + qty;
      for (const [item, batches] of Object.entries(p.huntStock?.ground[key] ?? {})) {
        recordHuntBatches((huntGround[key2] ??= {}), item, batches);
      }
    }
    p.ground = dropped;
    if (p.huntStock) p.huntStock.ground = huntGround;
  }
}
