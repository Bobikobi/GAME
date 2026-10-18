/**
 * Wood and the starts (DECISIONS.md, 2026-10-09: no fallen branches, the
 * first fire is built from a felled tree, and each character begins its own
 * way; 2026-10-10: the axe and the starts, three starters). No start ends at a
 * wall: wood comes only from felling, every character holds an axe before the
 * first fire (in its kit, or found on a spot of its own), an axe that breaks
 * can be bought again, and the opening never asks for more logs than the
 * valley's trees give when the world is new. The starts are fair: every kit
 * with its own finds is worth about the same, every start reaches the bridge
 * with its axe in about the same time, and a start's own find shows on its
 * road, within its senses.
 */
import { type Bundle, type Rect, findSlot, makeWalkable, near, senseReach } from '@game/kernel';
import type { Issue } from './load';
import { isTool, isWood } from './material';
import { openingQuests } from './play';

/** The richest start, kit and own finds, is worth at most this much more than the poorest (C1: one band of kit value). */
export const KIT_BAND_PCT = 25;
/** The slowest start reaches the bridge with its axe in at most this much more time than the fastest (C1: one band of effort). */
export const EFFORT_BAND_PCT = 50;
/** One tile of walking, in ms: the client's step time. */
export const WALK_MS = 190;

type Tile = readonly [number, number];
const STEPS: readonly Tile[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** The shortest walk from a tile to one next to the rect, the bridge unmended; undefined when there is none. */
function walkTo(b: Bundle, from: Tile, to: Rect): Tile[] | undefined {
  const walkable = makeWalkable(b);
  const view = { restored: [] as string[], camp: [] as string[] };
  const { width, height } = b.map;
  const back = new Map<number, number>([[from[1] * width + from[0], -1]]);
  const queue: Tile[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    if (near(at, to)) {
      const path: Tile[] = [];
      for (let k = at[1] * width + at[0]; k >= 0; k = back.get(k)!) path.unshift([k % width, Math.floor(k / width)]);
      return path;
    }
    for (const [dx, dy] of STEPS) {
      const x = at[0] + dx;
      const y = at[1] + dy;
      if (x < 0 || y < 0 || x >= width || y >= height || back.has(y * width + x) || !walkable(x, y, view)) continue;
      back.set(y * width + x, at[1] * width + at[0]);
      queue.push([x, y]);
    }
  }
  return undefined;
}

/** What an item is worth to a start: its value, or the lowest price a shop sells it for. */
function worth(b: Bundle, item: string): number {
  const prices = Object.values(b.shops).flatMap((s) => s.sells.filter((o) => o.item === item).map((o) => o.price_mg));
  return b.values[item] ?? (prices.length > 0 ? Math.min(...prices) : 0);
}

export function checkStarts(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const at = (id: string) => origin[id] ?? 'content';
  const err = (file: string, where: string, message: string) => issues.push({ file, where, message, level: 'error' });

  // wood comes only from felling
  for (const r of Object.values(b.resources)) {
    if (isWood(b, r.output) && r.tool !== 'axe') {
      err(at(r.id), 'node.tool', `${r.output} is wood, and wood comes only from felling a tree: the node needs "tool": "axe"`);
    }
  }
  for (const t of Object.values(b.treasures)) {
    t.finds.forEach((f, i) => {
      if (isWood(b, f.item)) err(at(t.id), `dig.finds.${i}.item`, `${f.item} is wood, and wood comes only from felling a tree: digging never gives it`);
    });
  }

  // a staff is worn for what it helps: no work asks for one
  for (const r of Object.values(b.resources)) {
    if (r.tool === 'staff') err(at(r.id), 'node.tool', 'no work asks for a staff, it is worn for what it helps: a basket, a trowel or an axe');
  }
  for (const t of Object.values(b.treasures)) {
    if (t.tool === 'staff') err(at(t.id), 'dig.tool', 'no work asks for a staff, it is worn for what it helps: a trowel, or nothing for a find picked up by hand');
  }

  // a start's own spot: one find, always, once, with a tool its own kit holds, tier 1 like a kit
  const own = (starter: string) => Object.values(b.treasures).filter((t) => t.starter === starter);
  for (const t of Object.values(b.treasures)) {
    if (t.starter === undefined) continue;
    const s = b.starters[t.starter];
    if (t.finds.length !== 1 || t.finds[0]!.chance_pct !== 100) {
      err(at(t.id), 'dig.finds', "a start's own spot gives its one find every time: one find at 100%, or a miss would leave the start at a wall");
    }
    if (t.count !== 1) err(at(t.id), 'dig.count', "a start's own spot is one place: count 1");
    if (!Object.values(b.instances).some((inst) => inst.kind === 'treasure' && inst.source === t.id)) {
      err(at(t.id), 'dig.place', `the slot ${t.place.slot} has no tile for the spot (a spot stands where x + y is even, off the path): the start would never find it`);
    }
    if (t.tool && s && !(s.kit ?? []).some((k) => isTool(b, k.item, t.tool!))) {
      err(at(t.id), 'dig.tool', `the spot asks for a ${t.tool}, and the start "${t.starter}" does not wake with one: put it in the kit, or let the find be picked up by hand`);
    }
    t.finds.forEach((f, i) => {
      if ((b.items[f.item]?.tier ?? 1) > 1) err(at(t.id), `dig.finds.${i}.item`, `${f.item} is above tier 1: a start gives tier-1 things only (G41)`);
    });
  }
  for (const s of Object.values(b.starters)) {
    (s.kit ?? []).forEach((k, i) => {
      if ((b.items[k.item]?.tier ?? 1) > 1) err(at(s.id), `starter.kit.${i}.item`, `${k.item} is above tier 1: a kit holds tier-1 things only (G41)`);
    });
  }

  // one attribute total: every start spends the same points, the total most starts have
  const totals = new Map(Object.values(b.starters).map((s) => [s.id, Object.values(s.attributes).reduce((n, v) => n + v, 0)]));
  const counts = new Map<number, number>();
  for (const t of totals.values()) counts.set(t, (counts.get(t) ?? 0) + 1);
  const total = [...counts].sort(([x, n], [y, m]) => m - n || x - y)[0]?.[0];
  for (const [id, t] of totals) {
    if (t !== total) err(at(id), 'starter.attributes', `the attributes add up to ${t}, and the other starts' to ${total}: one attribute total`);
  }

  // where each character wakes
  const walkable = makeWalkable(b);
  const startOf = (s: Bundle['starters'][string]): Tile => (s.wake ? [s.wake.x, s.wake.y] : [b.map.spawn.x, b.map.spawn.y]);
  for (const s of Object.values(b.starters)) {
    const [x, y] = startOf(s);
    if (s.wake && !walkable(x, y, { restored: [], camp: [] })) err(at(s.id), 'starter.wake', `[${x}, ${y}] is not a tile to stand on: off the map, solid, or taken`);
    if ((s.pocket_grown ?? 7) < (s.pocket ?? 5)) err(at(s.id), 'starter.pocket_grown', `the pocket grown (${s.pocket_grown ?? 7} tiles) is smaller than the pocket (${s.pocket ?? 5}): the first task pushes the mist back, never in`);
  }

  // the kits are worth about the same, counting what each start finds on its own spots
  const value = new Map(
    Object.values(b.starters).map((s) => [
      s.id,
      (s.kit ?? []).reduce((n, k) => n + worth(b, k.item) * k.qty, 0) + own(s.id).reduce((n, t) => n + worth(b, t.finds[0]?.item ?? ''), 0),
    ]),
  );
  const poorest = Math.min(...value.values());
  for (const [id, v] of value) {
    if (poorest > 0 && v * 100 > poorest * (100 + KIT_BAND_PCT)) {
      err(at(id), 'starter.kit', `the start is worth ${v} mg with its own finds, more than ${KIT_BAND_PCT}% over the poorest start (${poorest} mg): one band of kit value`);
    }
  }

  const trees = Object.values(b.resources).filter((r) => r.tool === 'axe');
  if (trees.length === 0) return issues;

  // an axe wears out; Pell sells another, or the player is stuck
  const sold = Object.values(b.shops).some((s) => s.sells.some((o) => isTool(b, o.item, 'axe')));
  if (!sold) err(at(trees[0]!.id), 'node.tool', 'a tree needs an axe, and no shop sells one: a broken axe would end the game for the player');

  // every character holds an axe before the first fire: in the kit, or on a spot of its own
  for (const s of Object.values(b.starters)) {
    const inKit = (s.kit ?? []).some((k) => isTool(b, k.item, 'axe'));
    const found = own(s.id).some((t) => t.finds.some((f) => isTool(b, f.item, 'axe')));
    if (!inKit && !found) {
      err(at(s.id), 'starter.kit', 'this start holds no axe, and the first fire is built from a felled tree: put an axe in the kit, or on a spot of its own (no start ends at a wall)');
    }
  }

  // the opening asks for no more of an item a tree gives than the trees give grown, on a new valley
  const given = new Map<string, number>();
  for (const r of trees) given.set(r.output, (given.get(r.output) ?? 0) + r.yield * r.count);
  const asked = new Map<string, number>();
  const ask = (item: string, qty: number) => {
    if (given.has(item)) asked.set(item, (asked.get(item) ?? 0) + qty);
  };
  for (const id of openingQuests(b)) {
    for (const step of b.quests[id]?.steps ?? []) {
      if (step.kind === 'build') for (const s of b.camps[step.camp]?.inputs ?? []) ask(s.item, s.qty);
      if (step.kind === 'make') for (const s of b.recipes[step.recipe]?.inputs ?? []) ask(s.item, s.qty);
      if (step.kind === 'restore') for (const s of b.restores[step.restore]?.inputs ?? []) ask(s.item, s.qty);
    }
  }
  for (const [item, qty] of asked) {
    const have = given.get(item) ?? 0;
    if (qty > have) {
      err('content/core', 'opening', `the opening asks for ${qty} of ${item}, and the trees of a new valley give ${have}: more trees, or less to build`);
    }
  }

  // every start meets the shared road at its first mending (the bridge) in about the same time, its axe in hand
  const firstMend = Object.values(b.quests)
    .filter((q) => (q.requires ?? []).length === 0 && q.starter === undefined && openingQuests(b).has(q.id))
    .flatMap((q) => q.steps.flatMap((st) => (st.kind === 'restore' ? [st.restore] : [])))[0];
  const meet = firstMend ? findSlot(b.map, b.restores[firstMend]?.place.slot ?? '') : undefined;
  if (!meet) return issues;
  const effort = new Map<string, number>();
  for (const s of Object.values(b.starters)) {
    let here = startOf(s);
    let ms = 0;
    let tiles = 0;
    let lost = false;
    const go = (to: Rect): Tile[] | undefined => {
      const path = walkTo(b, here, to);
      if (!path) return undefined;
      tiles += path.length - 1;
      here = path[path.length - 1]!;
      return path;
    };
    // its own first task, step by step: an own spot for a find, the nearest node for a bring
    for (const q of Object.values(b.quests).filter((x) => x.starter === s.id)) {
      for (const st of q.steps) {
        if (st.kind === 'find') {
          const spot = Object.entries(b.instances).find(([, inst]) => inst.kind === 'treasure' && b.treasures[inst.source]?.starter === s.id && b.treasures[inst.source]!.finds.some((f) => f.item === st.item));
          if (!spot) continue;
          if (!go({ x: spot[1].x, y: spot[1].y, w: 1, h: 1 })) lost = true;
          ms += b.treasures[spot[1].source]!.active_ms;
        }
        if (st.kind === 'bring') {
          const nodes = Object.values(b.instances).filter((inst) => inst.kind === 'resource' && b.resources[inst.source]?.output === st.item);
          const paths = nodes.map((n) => ({ n, path: walkTo(b, here, { x: n.x, y: n.y, w: 1, h: 1 }) })).filter((p) => p.path);
          const best = paths.sort((x, y) => x.path!.length - y.path!.length)[0];
          if (!best) {
            lost = true;
            continue;
          }
          go({ x: best.n.x, y: best.n.y, w: 1, h: 1 });
          const r = b.resources[best.n.source]!;
          ms += Math.ceil(st.qty / r.yield) * r.active_ms;
        }
      }
    }
    const road = go(meet);
    if (lost || !road) {
      err(at(s.id), 'starter.wake', `from where this start wakes, its own first task or the ${b.restores[firstMend!]?.place.slot} cannot be walked to before anything is mended`);
      continue;
    }
    effort.set(s.id, ms + tiles * WALK_MS);
    // a start's own find shows on its road: within its senses of where it walks to the bridge
    const reach = senseReach(b, s.attributes.senses);
    const walked = walkTo(b, startOf(s), meet) ?? [];
    for (const t of own(s.id)) {
      for (const inst of Object.values(b.instances)) {
        if (inst.kind !== 'treasure' || inst.source !== t.id) continue;
        if (!walked.some(([x, y]) => Math.max(Math.abs(x - inst.x), Math.abs(y - inst.y)) <= reach)) {
          err(at(t.id), 'dig.place', `the spot at [${inst.x}, ${inst.y}] is out of the senses of "${s.id}" (${reach} tiles) all the way from where it wakes to the ${meet.id}: the start would never see it`);
        }
      }
    }
  }
  const fastest = Math.min(...effort.values());
  for (const [id, ms] of effort) {
    if (ms * 100 > fastest * (100 + EFFORT_BAND_PCT)) {
      err(at(id), 'starter.wake', `this start reaches the ${meet.id} with its axe after about ${Math.round(ms / 1000)} s of walking and work, more than ${EFFORT_BAND_PCT}% over the fastest start (${Math.round(fastest / 1000)} s): one band of effort`);
    }
  }
  return issues;
}
