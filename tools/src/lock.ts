/**
 * The world lock (G59, docs/design/OPEN_WORLD.md; EXPERIENCE_AUDIT.md gap M6): the opening's legs and pays,
 * committed in content/world.lock.json beside the value anchor. A leg is the walk of one rung of the ladder
 * (GAME_RULES.md section 2), counted in steps, 4-way, under the kernel's own walk and height rules: from each
 * wake tile through the pocket's own first task to the bridge, then from the bridge to the fire, the town,
 * Maru's and Pell's first errands, the coin under the lantern and the arch. A pay is what the rung's quest
 * gives. A change that lengthens a leg, moves where it runs or changes a pay is refused; a deliberate one is
 * re-anchored with `pnpm world:lock`, with the owner's yes (the one-time exception of GAME_RULES section 6
 * covers the legs only, never the pays).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Bundle, type QuestDef, type Rect, campTile, findSlot, makeStepRule, makeWalkable, near } from '@game/kernel';
import { WORLD_LOCK_FILE, toRepoPath, type Issue } from './load';
import { openingQuests } from './play';

/** The ladder's shared rungs after the bridge, in the ladder's order (GAME_RULES.md section 2): the fire, the town, Maru or Pell, the coin, the arch. */
export const LADDER_QUESTS: readonly string[] = ['core/first-fire', 'core/into-town', 'core/three-fruits', 'core/herbs-for-pell', 'core/a-coin-for-maru', 'core/the-night-arch'];

/** The first mending, where every start meets the shared road. */
const BRIDGE_QUEST = 'core/fix-the-bridge';

export interface Leg {
  /** where the leg starts: a wake tile, a slot, or the last place of the rung before */
  from: string;
  /** the last place the leg walks to */
  to: string;
  steps: number;
}

export interface WorldLock {
  legs: Record<string, Leg>;
  pays: Record<string, unknown>;
}

type Tile = readonly [number, number];
interface Place {
  name: string;
  rect: Rect;
}

const STEPS: readonly Tile[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const one = (x: number, y: number): Rect => ({ x, y, w: 1, h: 1 });

/** The places a step can be met at: any one of them will do, and the walk takes the nearest. Empty when the step has no place (a make, a tend). */
function stepPlaces(b: Bundle, step: QuestDef['steps'][number], pocket?: string): Place[][] {
  const slot = (id: string): Place[] => {
    const s = findSlot(b.map, id);
    return s ? [{ name: id, rect: s }] : [];
  };
  const prop = (id: string): Place[] => {
    const p = b.map.props.find((x) => x.id === id);
    return p ? [{ name: id, rect: { x: p.x, y: p.y, w: p.w, h: p.h } }] : [];
  };
  const spots = (pick: (source: string) => boolean): Place[] =>
    Object.values(b.instances)
      .filter((i) => i.kind === 'treasure' && pick(i.source))
      .map((i) => ({ name: i.source, rect: one(i.x, i.y) }));
  const nodes = (item: string): Place[] =>
    Object.values(b.instances)
      .filter((i) => i.kind === 'resource' && b.resources[i.source]?.output === item)
      .map((i) => ({ name: i.source, rect: one(i.x, i.y) }));
  switch (step.kind) {
    case 'restore':
      return [slot(b.restores[step.restore]?.place.slot ?? '')];
    case 'build': {
      const camp = b.camps[step.camp];
      const t = camp && campTile(b, camp.slot);
      return [t ? [{ name: `${step.camp} at the camp's ${camp.slot}`, rect: one(t[0], t[1]) }] : []];
    }
    case 'visit':
      return [slot(step.slot)];
    case 'find': {
      // a spot that gives it (the pocket's own, for a pocket's task), else a node that grows it
      const dug = spots((s) => b.treasures[s]?.pocket === pocket && (b.treasures[s]?.finds ?? []).some((f) => f.item === step.item));
      return [dug.length > 0 ? dug : nodes(step.item)];
    }
    case 'bring':
      return [nodes(step.item)];
    case 'riddle': {
      const a = step.answer;
      const answer = a.kind === 'dig' ? spots((s) => s === a.treasure) : slot(a.slot);
      return [...step.props.map(prop), answer];
    }
    default:
      return [];
  }
}

/**
 * The shortest walk, 4-way, from any of the start tiles to a tile next to one of the places, under the kernel's walk
 * and height rules; undefined when there is none. Ties go to the start and the place listed first.
 */
function walk(b: Bundle, from: readonly Tile[], to: Place[], restored: string[], camp: string[]): { steps: number; at: Tile; place: Place } | undefined {
  const walkable = makeWalkable(b);
  const open = makeStepRule(b);
  const view = { restored, camp };
  const { width, height } = b.map;
  const dist = new Map<number, number>();
  const queue: Tile[] = [];
  for (const t of from) {
    const k = t[1] * width + t[0];
    if (!dist.has(k)) {
      dist.set(k, 0);
      queue.push(t);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    const d = dist.get(at[1] * width + at[0])!;
    const place = to.find((p) => near(at, p.rect));
    if (place) return { steps: d, at, place };
    for (const [dx, dy] of STEPS) {
      const x = at[0] + dx;
      const y = at[1] + dy;
      if (x < 0 || y < 0 || x >= width || y >= height || dist.has(y * width + x) || !walkable(x, y, view) || !open(at[0], at[1], x, y)) continue;
      dist.set(y * width + x, d + 1);
      queue.push([x, y]);
    }
  }
  return undefined;
}

/** The walkable tiles next to a place, in a stable order: where a leg that starts at it may set off. */
function around(b: Bundle, r: Rect, restored: string[], camp: string[]): Tile[] {
  const walkable = makeWalkable(b);
  const out: Tile[] = [];
  for (let y = r.y - 1; y <= r.y + r.h; y++) {
    for (let x = r.x - 1; x <= r.x + r.w; x++) if (walkable(x, y, { restored, camp })) out.push([x, y]);
  }
  return out;
}

/** Walk a leg through every placed step in order; undefined when a step has no place to stand by or none can be walked to. */
function walkSteps(b: Bundle, start: readonly Tile[], legs: Place[][], restored: string[], camp: string[]): { steps: number; last: Place } | undefined {
  let here = start;
  let steps = 0;
  let last: Place | undefined;
  for (const places of legs) {
    const w = walk(b, here, places, restored, camp);
    if (!w) return undefined;
    steps += w.steps;
    here = [w.at];
    last = w.place;
  }
  return last ? { steps, last } : undefined;
}

/** Every quest a quest needs before it, itself left out. */
function before(b: Bundle, id: string, seen = new Set<string>()): Set<string> {
  for (const r of b.quests[id]?.requires ?? []) {
    if (seen.has(r)) continue;
    seen.add(r);
    before(b, r, seen);
  }
  return seen;
}

/** What the quests before a rung have mended and built: the ground its leg walks on. */
function groundOf(b: Bundle, id: string): { restored: string[]; camp: string[] } {
  const done = [...before(b, id)].sort();
  const steps = done.flatMap((q) => b.quests[q]?.steps ?? []);
  return {
    restored: steps.flatMap((s) => (s.kind === 'restore' ? [s.restore] : [])),
    camp: steps.flatMap((s) => (s.kind === 'build' ? [s.camp] : [])),
  };
}

/** A pay as the lock holds it: the quest's reward, its keys sorted, so the file reads the same on every machine. */
function payOf(q: QuestDef): unknown {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v;
  return sort(q.reward);
}

/**
 * The opening as the content stands: each wake pocket's leg (the wake tile, the pocket's ground picked up, its own
 * first task, the bridge, the bridge unmended) and each shared rung's leg (from its giver, or from the last place of
 * the rung it follows, through its placed steps). A leg that cannot be walked has `steps` -1.
 */
export function measureLock(b: Bundle): WorldLock {
  const legs: Record<string, Leg> = {};
  const bridge = b.quests[BRIDGE_QUEST];
  const bridgePlaces = bridge ? bridge.steps.flatMap((s) => stepPlaces(b, s)) : [];
  for (const p of Object.values(b.pockets).sort((x, y) => x.id.localeCompare(y.id))) {
    const ground = p.ground.map((g) =>
      Object.values(b.instances)
        .filter((i) => i.kind === 'treasure' && b.treasures[i.source]?.pocket === p.id && b.treasures[i.source]!.tool === undefined && b.treasures[i.source]!.finds[0]?.item === g.item)
        .map((i) => ({ name: i.source, rect: one(i.x, i.y) })),
    );
    const own = Object.values(b.quests)
      .filter((q) => q.pocket === p.id)
      .sort((x, y) => x.id.localeCompare(y.id))
      .flatMap((q) => q.steps.flatMap((s) => stepPlaces(b, s, p.id)));
    const w = walkSteps(b, [[p.wake.x, p.wake.y]], [...ground, ...own, ...bridgePlaces], [], []);
    legs[p.id] = { from: `${p.id} wake [${p.wake.x}, ${p.wake.y}]`, to: w?.last.name ?? '-', steps: w?.steps ?? -1 };
  }
  const ends = new Map<string, Place>();
  const bridgeEnd = bridgePlaces[bridgePlaces.length - 1]?.[0];
  if (bridgeEnd) ends.set(BRIDGE_QUEST, bridgeEnd);
  for (const id of LADDER_QUESTS) {
    const q = b.quests[id];
    if (!q) continue;
    const { restored, camp } = groundOf(b, id);
    const giver = q.giver ? b.npcs[q.giver] : undefined;
    const giverSlot = giver ? findSlot(b.map, giver.place.slot) : undefined;
    const after = (q.requires ?? []).map((r) => ({ id: r, end: ends.get(r) })).find((r) => r.end);
    const start: Place | undefined = giverSlot ? { name: giver!.place.slot, rect: giverSlot } : after?.end;
    const placed = q.steps.flatMap((s) => stepPlaces(b, s));
    const w = start ? walkSteps(b, around(b, start.rect, restored, camp), placed, restored, camp) : undefined;
    if (w) ends.set(id, w.last);
    legs[id] = { from: start?.name ?? '-', to: w?.last.name ?? '-', steps: w?.steps ?? -1 };
  }
  const pays: Record<string, unknown> = {};
  const paid = [...new Set([...openingQuests(b), ...LADDER_QUESTS])].filter((id) => b.quests[id]).sort();
  for (const id of paid) pays[id] = payOf(b.quests[id]!);
  return { legs, pays };
}

/** The lock file's text for a bundle: what `pnpm world:lock` writes. */
export function lockText(b: Bundle): string {
  const { legs, pays } = measureLock(b);
  const note = 'The world lock (G59): the opening\'s legs in steps and its pays. Re-anchored only with the owner\'s yes, by "pnpm world:lock".';
  return `${JSON.stringify({ format: 1, note, legs, pays }, null, 2)}\n`;
}

export function writeLock(b: Bundle, file = WORLD_LOCK_FILE): WorldLock {
  writeFileSync(file, lockText(b));
  return measureLock(b);
}

/**
 * The check: every leg of the lock is walked again and every pay read again. A leg that is longer, that runs from or
 * to another place, that cannot be walked, or that the lock does not hold, and a pay that changed, are errors; a leg
 * that got shorter is a warning, since the lock should say so. `root` is the content folder; a test folder with no
 * lock of its own is not checked.
 */
export function checkLock(b: Bundle, origin: Record<string, string>, root?: string): Issue[] {
  const file = root ? join(root, 'world.lock.json') : WORLD_LOCK_FILE;
  const where = toRepoPath(file);
  if (!existsSync(file)) {
    return root ? [] : [{ file: where, where: '', message: 'no world lock yet: run "pnpm world:lock" and commit content/world.lock.json (G59)', level: 'warning' }];
  }
  const lock = JSON.parse(readFileSync(file, 'utf8')) as WorldLock;
  const now = measureLock(b);
  const issues: Issue[] = [];
  const at = (id: string) => origin[id] ?? where;
  const anchor = 'A deliberate change is re-anchored with "pnpm world:lock", with the owner\'s yes';
  const err = (id: string, at2: string, message: string) => issues.push({ file: at(id), where: at2, message: `${message} (G59, the opening never moves). ${anchor}.`, level: 'error' });
  for (const [id, leg] of Object.entries(now.legs)) {
    const was = lock.legs[id];
    if (!was) err(id, 'world lock', `the opening's leg ${id} is not in the world lock`);
    else if (leg.steps < 0) err(id, 'world lock', `the opening's leg ${id} (${was.from} to ${was.to}) can no longer be walked`);
    else if (leg.from !== was.from || leg.to !== was.to) err(id, 'world lock', `the opening's leg ${id} runs from ${leg.from} to ${leg.to}; the lock says from ${was.from} to ${was.to}`);
    else if (leg.steps > was.steps) err(id, 'world lock', `the opening's leg ${id} (${leg.from} to ${leg.to}) is ${leg.steps} steps; the lock says ${was.steps}`);
    else if (leg.steps < was.steps) {
      issues.push({ file: at(id), where: 'world lock', message: `the opening's leg ${id} (${leg.from} to ${leg.to}) got shorter, ${leg.steps} steps where the lock says ${was.steps}: re-anchor with "pnpm world:lock", with the owner's yes`, level: 'warning' });
    }
  }
  for (const id of Object.keys(lock.legs)) if (!now.legs[id]) err(id, 'world lock', `the opening's leg ${id} is in the world lock and no longer in the content`);
  for (const [id, pay] of Object.entries(now.pays)) {
    const was = lock.pays[id];
    if (was === undefined) err(id, 'quest.reward', `the opening's quest ${id} pays, and the world lock holds no pay for it`);
    else if (JSON.stringify(pay) !== JSON.stringify(was)) err(id, 'quest.reward', `the opening's quest ${id} pays ${JSON.stringify(pay)}; the lock says ${JSON.stringify(was)}, and no change moves a rung's payoff`);
  }
  for (const id of Object.keys(lock.pays)) if (!(id in now.pays)) err(id, 'quest.reward', `the opening's quest ${id} is in the world lock and no longer in the content`);
  return issues;
}
