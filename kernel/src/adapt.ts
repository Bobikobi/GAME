/**
 * A save from older content, brought to the content of today (DECISIONS.md, 2026-10-07: "A save from older
 * content is adapted by dropping ids that no longer exist"). The phone runs it on a save it loads, and the
 * server on a state it stored under a bundle it no longer runs, so a new version of the world never locks a
 * character out: `step` refuses a state whose `content` is not the bundle's tag.
 */
import type { Bundle } from './bundle';
import { appearSlots } from './reactions';
import { relocationOf } from './relocate';
import { placeName } from './world';
import { KERNEL_VERSION, fitWorn, groundKey, mapFrame, type State } from './state';

/**
 * The state as today's content can play it: what still exists is kept, what left the content is dropped,
 * and the state takes the bundle's tag. Undefined when the character's race left the content: nothing can
 * stand in for it. Pure: returns a new object and leaves the input as it was.
 */
export function adaptState(bundle: Bundle, saved: State): State | undefined {
  const state = structuredClone(saved);
  const p = state.player;
  if (p.race !== '' && !bundle.races[p.race]) return undefined;
  // a wake pocket that left the content: the mist and the first task fall back to the map's spawn
  if (p.pocket !== '' && !bundle.pockets[p.pocket]) p.pocket = '';
  // saves from kernel 0.1 have no look, and a look can be withdrawn with its sprite
  if (typeof p.look !== 'number' || (p.look === 1 && p.race !== '' && !bundle.races[p.race]?.sprite_alt)) p.look = 0;
  const keepKeys = <T>(record: Record<string, T>, known: Record<string, unknown>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).filter(([k]) => k in known));
  p.bag = keepKeys(p.bag, bundle.items);
  p.wear = keepKeys(p.wear, bundle.items);
  p.made = keepKeys(p.made, bundle.recipes);
  p.quests = keepKeys(p.quests, bundle.quests);
  p.rep = keepKeys(p.rep, bundle.npcs);
  p.xp = keepKeys(p.xp, bundle.professions);
  p.journal = p.journal.filter((id) => id in bundle.items);
  p.recipes = p.recipes.filter((id) => id in bundle.recipes);
  // a recipe everyone starts with that came with this version is known at once
  if (p.race !== '') {
    const fresh = Object.keys(bundle.recipes).filter((id) => bundle.recipes[id]!.known === 'start' && !p.recipes.includes(id));
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
  // a height layer may have walled the old tile off from every wake (G68): stand on the nearest tile a foot can reach, never a fall
  const stand = relocationOf(bundle, state);
  if (stand) p.at = stand;
  // a world that changed may have moved the hazards and the safe ground: nothing carries over
  p.outing = null;
  p.chase = null;
  // a node a reaction makes appear keeps its state under its own id, as long as the reaction stays
  state.nodes = keepKeys(state.nodes, { ...bundle.instances, ...Object.fromEntries(appearSlots(bundle)) });
  // a worn item that is gone, or no longer fits its place, comes off
  fitWorn(bundle, state);
  state.content = bundle.tag;
  state.kernel = KERNEL_VERSION;
  return state;
}

/**
 * A state of an earlier map frame has its tiles shifted by the map's `moved`, once: the player, the fire they
 * kindled, the carcasses and what lies dropped on the ground. A tile that falls outside the map is pulled to its
 * nearest edge (the reach check after it puts the character on the nearest foot-reachable tile). The state then
 * takes the map's frame, so a later change of content never shifts it again. A state of a later frame than the
 * map's (a server rolled back) is left as it is.
 */
function moveTiles(bundle: Bundle, state: State): void {
  const frame = mapFrame(bundle);
  if (frame <= 1) return;
  const from = state.frame ?? 1;
  if (from >= frame) return;
  const moved = bundle.map.moved;
  state.frame = frame;
  if (!moved) return;
  const { width, height } = bundle.map;
  const shift = (at: [number, number]): [number, number] => [
    Math.min(width - 1, Math.max(0, at[0] + moved.dx)),
    Math.min(height - 1, Math.max(0, at[1] + moved.dy)),
  ];
  const p = state.player;
  p.at = shift(p.at);
  if (p.own) p.own.at = shift(p.own.at);
  for (const carcass of p.carcasses ?? []) carcass.at = shift(carcass.at);
  if (p.ground) {
    const dropped: Record<string, Record<string, number>> = {};
    for (const [key, items] of Object.entries(p.ground)) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      const key2 = groundKey(shift([x, y]));
      dropped[key2] = { ...dropped[key2] };
      for (const [item, qty] of Object.entries(items)) dropped[key2][item] = (dropped[key2][item] ?? 0) + qty;
    }
    p.ground = dropped;
  }
}
