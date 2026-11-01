/**
 * Wood and the starts (DECISIONS.md, 2026-10-09: no fallen branches, the
 * first fire is built from a felled tree, and each character begins its own
 * way; 2026-10-10: the axe and the starts; 2026-10-22: a start is a race,
 * chosen, in a wake pocket, drawn by the seed). No start ends at a wall: wood
 * comes only from felling, every pocket gives an axe before the first fire (on
 * its ground, or on a spot of its own), an axe that breaks can be bought
 * again, and the opening never asks for more logs than the valley's trees give
 * when the world is new. The starts are fair over every (race, pocket) pair:
 * the race's outfit with the pocket's own finds is worth about the same, every
 * pair reaches the bridge with its axe in about the same time, and a pocket's
 * own find shows on its road, within the senses of every race.
 */
import { type Bundle, type Rect, findSlot, makeWalkable, mulDivUp, near, senseReach } from '@game/kernel';
import type { Issue } from './load';
import { isTool, isWood } from './material';
import { openingQuests } from './play';

/** The richest (race, pocket) pair, outfit and the pocket's own finds, is worth at most this much more than the poorest (C1: one band of kit value). */
export const KIT_BAND_PCT = 25;
/** The slowest (race, pocket) pair reaches the bridge with its axe in at most this much more time than the fastest (C1: one band of effort). */
export const EFFORT_BAND_PCT = 50;
/** Tool kinds worn in the hand for what they help, that no dig asks for (a resource node may ask for a mined pick or hammer). */
const WORN_ONLY: ReadonlySet<string> = new Set(['staff', 'hammer', 'pick']);
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

/** What the race's outfit, worn from the first morning, adds to one worn effect (the set bonus left out: no outfit is a set). */
function outfitEffect(b: Bundle, race: Bundle['races'][string], effect: string): number {
  return (race.outfit ?? []).reduce((n, o) => n + (b.items[o.item]?.wear?.look ? 0 : (b.items[o.item]?.wear?.effects ?? []).filter((e) => e.effect === effect).reduce((m, e) => m + e.value, 0)), 0);
}

/** A timed action's time at perfect timing with a speed bonus in percent, as the kernel's duration (tier-1 tools add no speed). */
function timed(b: Bundle, activeMs: number, speedPct: number): number {
  return Math.max(b.params.t_min_ms, mulDivUp(activeMs, 1000, 1000 + 10 * speedPct));
}

/** Measured over every (race, pocket) pair: what each is worth and how long it takes to the first mending. For the check, a test and `pnpm check --json` readers. */
export interface StartMeasure {
  race: string;
  pocket: string;
  worth_mg: number;
  effort_ms?: number;
}

export function measureStarts(b: Bundle): StartMeasure[] {
  return pairs(b).map(([race, pocket]) => ({ race, pocket, worth_mg: pairWorth(b, race, pocket), effort_ms: pairEffort(b, race, pocket)?.ms }));
}

function pairs(b: Bundle): [string, string][] {
  return Object.keys(b.races)
    .sort()
    .flatMap((r) => Object.keys(b.pockets).sort().map((p) => [r, p] as [string, string]));
}

const ownSpots = (b: Bundle, pocket: string) => Object.values(b.treasures).filter((t) => t.pocket === pocket);

/** The race's outfit and what the pocket's own spots give (its ground tools among them). */
function pairWorth(b: Bundle, race: string, pocket: string): number {
  const outfit = (b.races[race]?.outfit ?? []).reduce((n, k) => n + worth(b, k.item) * k.qty, 0);
  return outfit + ownSpots(b, pocket).reduce((n, t) => n + worth(b, t.finds[0]?.item ?? ''), 0);
}

/** The first restoration of the shared opening (the bridge): where every start meets the shared road. */
function firstMend(b: Bundle): string | undefined {
  return Object.values(b.quests)
    .filter((q) => (q.requires ?? []).length === 0 && q.pocket === undefined && openingQuests(b).has(q.id))
    .flatMap((q) => q.steps.flatMap((st) => (st.kind === 'restore' ? [st.restore] : [])))[0];
}

/**
 * The walk and the work from the wake tile to the first mending: the pocket's ground tools picked up first, then its own
 * first task step by step (an own spot for a find, the nearest node for a bring), then the road. The race counts through
 * its outfit's worn speed; its agility widens timing windows and changes no time at perfect timing.
 */
function pairEffort(b: Bundle, raceId: string, pocketId: string): { ms: number; lost: boolean } | undefined {
  const race = b.races[raceId];
  const p = b.pockets[pocketId];
  const mend = firstMend(b);
  const meet = mend ? findSlot(b.map, b.restores[mend]?.place.slot ?? '') : undefined;
  if (!race || !p || !meet) return undefined;
  let here: Tile = [p.wake.x, p.wake.y];
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
  const spotOf = (item: string) =>
    Object.values(b.instances).find((inst) => inst.kind === 'treasure' && b.treasures[inst.source]?.pocket === pocketId && b.treasures[inst.source]!.finds.some((f) => f.item === item));
  const dig = outfitEffect(b, race, 'dig_speed_pct');
  const gather = outfitEffect(b, race, 'gather_speed_pct');
  for (const g of p.ground) {
    const spot = spotOf(g.item);
    if (!spot) continue;
    if (!go({ x: spot.x, y: spot.y, w: 1, h: 1 })) lost = true;
    ms += timed(b, b.treasures[spot.source]!.active_ms, dig);
  }
  for (const q of Object.values(b.quests).filter((x) => x.pocket === pocketId)) {
    for (const st of q.steps) {
      if (st.kind === 'find') {
        const spot = spotOf(st.item);
        if (!spot) continue;
        if (!go({ x: spot.x, y: spot.y, w: 1, h: 1 })) lost = true;
        ms += timed(b, b.treasures[spot.source]!.active_ms, dig);
      }
      if (st.kind === 'bring') {
        const nodes = Object.values(b.instances).filter((inst) => inst.kind === 'resource' && b.resources[inst.source]?.output === st.item);
        const paths = nodes.map((n) => ({ n, path: walkTo(b, here, { x: n.x, y: n.y, w: 1, h: 1 }) })).filter((x) => x.path);
        const best = paths.sort((x, y) => x.path!.length - y.path!.length)[0];
        if (!best) {
          lost = true;
          continue;
        }
        go({ x: best.n.x, y: best.n.y, w: 1, h: 1 });
        const r = b.resources[best.n.source]!;
        ms += Math.ceil(st.qty / r.yield) * timed(b, r.active_ms, gather);
      }
    }
  }
  if (!go(meet)) lost = true;
  return { ms: ms + tiles * WALK_MS, lost };
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

  // a staff, a hammer and a pick are worn for what they help: no dig asks for one. On a resource node only the staff
  // stays refused: a pick or a hammer there is mined work, which check.ts checkNodeTools reads (QUARRYING 2, 16 row 1)
  for (const r of Object.values(b.resources)) {
    if (r.tool === 'staff') err(at(r.id), 'node.tool', 'no work asks for a staff, it is worn for what it helps: a basket, an axe or a rod, or a pick, a hammer or a trowel with work: "mine"');
  }
  for (const t of Object.values(b.treasures)) {
    if (t.tool && WORN_ONLY.has(t.tool)) err(at(t.id), 'dig.tool', `no work asks for a ${t.tool}, it is worn for what it helps: a trowel, or nothing for a find picked up by hand`);
  }

  // a wake pocket's own spot: one find, always, once, with a tool its own ground lays, tier 1 like a start
  for (const t of Object.values(b.treasures)) {
    if (t.pocket === undefined) continue;
    const p = b.pockets[t.pocket];
    if (t.finds.length !== 1 || t.finds[0]!.chance_pct !== 100) {
      err(at(t.id), 'dig.finds', "a wake pocket's own spot gives its one find every time: one find at 100%, or a miss would leave the start at a wall");
    }
    if (t.count !== 1) err(at(t.id), 'dig.count', "a wake pocket's own spot is one place: count 1");
    if (!Object.values(b.instances).some((inst) => inst.kind === 'treasure' && inst.source === t.id)) {
      err(at(t.id), 'dig.place', `the slot ${t.place.slot} has no tile for the spot (a spot stands where x + y is even, off the path): the start would never find it`);
    }
    if (t.tool && p && !p.ground.some((g) => isTool(b, g.item, t.tool!))) {
      err(at(t.id), 'dig.tool', `the spot asks for a ${t.tool}, and the wake pocket "${t.pocket}" lays none on its ground: put one on the ground, or let the find be picked up by hand`);
    }
    t.finds.forEach((f, i) => {
      if ((b.items[f.item]?.tier ?? 1) > 1) err(at(t.id), `dig.finds.${i}.item`, `${f.item} is above tier 1: a start gives tier-1 things only (G41)`);
    });
  }
  for (const p of Object.values(b.pockets)) {
    p.ground.forEach((g, i) => {
      if ((b.items[g.item]?.tier ?? 1) > 1) err(at(p.id), `pocket.ground.${i}.item`, `${g.item} is above tier 1: the ground of a wake pocket holds tier-1 things only (G41)`);
      // the ground is found, never handed over: one of the pocket's own spots, picked up by hand, gives it
      const laid = ownSpots(b, p.id).some((t) => t.tool === undefined && t.finds[0]?.item === g.item);
      if (!laid) err(at(p.id), `pocket.ground.${i}.item`, `nothing lays ${g.item} by the wake tile: give the pocket a spot of its own ("pocket": "${p.id}", no tool) whose one find is it`);
    });
  }

  // where each character wakes
  const walkable = makeWalkable(b);
  for (const p of Object.values(b.pockets)) {
    const { x, y } = p.wake;
    if (!walkable(x, y, { restored: [], camp: [] })) err(at(p.id), 'pocket.wake', `[${x}, ${y}] is not a tile to stand on: off the map, solid, or taken`);
    if ((p.pocket_grown ?? 7) < (p.pocket ?? 5)) err(at(p.id), 'pocket.pocket_grown', `the pocket grown (${p.pocket_grown ?? 7} tiles) is smaller than the pocket (${p.pocket ?? 5}): the first task pushes the mist back, never in`);
  }

  // every (race, pocket) pair is worth about the same: the race's outfit and what the pocket's own spots give
  const value = new Map(pairs(b).map(([r, p]) => [`${r} in ${p}`, { v: pairWorth(b, r, p), file: at(p) }]));
  const poorest = Math.min(...[...value.values()].map((x) => x.v));
  for (const [pair, { v, file }] of value) {
    if (poorest > 0 && v * 100 > poorest * (100 + KIT_BAND_PCT)) {
      err(file, 'pocket.ground', `${pair} is worth ${v} mg with its outfit and own finds, more than ${KIT_BAND_PCT}% over the poorest pair (${poorest} mg): one band of kit value`);
    }
  }

  const trees = Object.values(b.resources).filter((r) => r.tool === 'axe');
  if (trees.length === 0) return issues;

  // an axe wears out; Pell sells another, or the player is stuck
  const sold = Object.values(b.shops).some((s) => s.sells.some((o) => isTool(b, o.item, 'axe')));
  if (!sold) err(at(trees[0]!.id), 'node.tool', 'a tree needs an axe, and no shop sells one: a broken axe would end the game for the player');

  // every pocket gives an axe before the first fire: on its ground, or on a spot of its own (the race never decides it)
  for (const p of Object.values(b.pockets)) {
    const onGround = p.ground.some((k) => isTool(b, k.item, 'axe'));
    const found = ownSpots(b, p.id).some((t) => t.finds.some((f) => isTool(b, f.item, 'axe')));
    if (!onGround && !found) {
      err(at(p.id), 'pocket.ground', 'this wake pocket gives no axe, and the first fire is built from a felled tree: lay an axe on its ground, or on a spot of its own (no start ends at a wall)');
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

  // every pair meets the shared road at its first mending (the bridge) in about the same time, its axe in hand
  const mend = firstMend(b);
  const meet = mend ? findSlot(b.map, b.restores[mend]?.place.slot ?? '') : undefined;
  if (!meet) return issues;
  const effort = new Map<string, { ms: number; file: string }>();
  for (const [r, pid] of pairs(b)) {
    const e = pairEffort(b, r, pid);
    if (!e) continue;
    if (e.lost) {
      err(at(pid), 'pocket.wake', `from where this pocket wakes, its own first task or the ${meet.id} cannot be walked to before anything is mended`);
      continue;
    }
    effort.set(`${r} in ${pid}`, { ms: e.ms, file: at(pid) });
  }
  // a pocket's own find shows on its road: within the senses of every race (the lowest decides) of where it walks to the bridge
  const senses = Math.min(...Object.values(b.races).map((r) => r.attributes.senses));
  if (Number.isFinite(senses)) {
    const reach = senseReach(b, senses);
    for (const p of Object.values(b.pockets)) {
      const walked = walkTo(b, [p.wake.x, p.wake.y], meet);
      if (!walked) continue; // no road at all: reported above as a start that cannot walk to the bridge
      for (const t of ownSpots(b, p.id)) {
        for (const inst of Object.values(b.instances)) {
          if (inst.kind !== 'treasure' || inst.source !== t.id) continue;
          if (!walked.some(([x, y]) => Math.max(Math.abs(x - inst.x), Math.abs(y - inst.y)) <= reach)) {
            err(at(t.id), 'dig.place', `the spot at [${inst.x}, ${inst.y}] is out of the senses of the race with the fewest (${senses}, ${reach} tiles) all the way from "${p.id}" to the ${meet.id}: that start would never see it`);
          }
        }
      }
    }
  }
  const fastest = Math.min(...[...effort.values()].map((x) => x.ms));
  for (const [pair, { ms, file }] of effort) {
    if (ms * 100 > fastest * (100 + EFFORT_BAND_PCT)) {
      err(file, 'pocket.wake', `${pair} reaches the ${meet.id} with its axe after about ${Math.round(ms / 1000)} s of walking and work, more than ${EFFORT_BAND_PCT}% over the fastest pair (${Math.round(fastest / 1000)} s): one band of effort`);
    }
  }
  return issues;
}
