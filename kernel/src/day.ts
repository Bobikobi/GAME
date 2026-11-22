/**
 * The valley's day (GAME_RULES G16, the ladder's session end and Day 2).
 *
 * A day is counted in the valley's own dawns (`valleyDay`), so it moves only while the game clock runs and never
 * with the calendar: a player who is away finds the valley at the hour they left it (G28). Each step folds what
 * it changed into a tally of the day (what was found, built and learned), and the first step past a dawn closes
 * that tally into `prev` for the day summary and opens an empty one. Pure and integer-only, like the rest of the
 * kernel: the tally is ids in the state, so a save keeps it and a replay rebuilds it.
 */
import type { Bundle } from './bundle';
import { resourceOf } from './reactions';
import { type DayLog, type PublicState, type State, valleyDay } from './state';

/** The most dawns one step tells: a step that crosses more (a tick jumped by a test or a replay) tells the last of them. */
export const MAX_DAWNS = 8;

/** One valley day begun: its number, and how many of the grove's plants that wait for the morning came back with it. */
export interface Dawn {
  day: number;
  /** nodes that wait for the dawn (`respawn_dawn`) and came back since the step before; carried by the last dawn a step tells */
  renewed: number;
}

/** How many things a day's lists hold in all. */
export function dayHolds(log: DayLog): number {
  return log.found.length + log.built.length + log.learned.length;
}

/**
 * The dawns between the step before (`from`) and this one (`s.tick`), told oldest first and at most `MAX_DAWNS`. The day
 * that was running closes into `player.day.prev` and an empty one opens; a step that crosses several dawns closes what
 * the player did before them once, and the days between hold nothing. Changes `s` in place. None when no dawn came.
 */
export function rollDay(b: Bundle, s: State, from: number): Dawn[] {
  const was = valleyDay(b, from);
  const now = valleyDay(b, s.tick);
  if (now <= was) return [];
  const p = s.player;
  const cur = p.day ?? { n: was, found: [], built: [], learned: [] };
  p.day = { n: now, found: [], built: [], learned: [], prev: { n: cur.n, found: cur.found, built: cur.built, learned: cur.learned } };
  let renewed = 0;
  for (const [id, node] of Object.entries(s.nodes)) {
    if (node.readyAt > from && node.readyAt <= s.tick && resourceOf(b, id)?.respawn_dawn === true) renewed += 1;
  }
  const first = Math.max(was + 1, now - MAX_DAWNS + 1);
  const dawns: Dawn[] = [];
  for (let day = first; day <= now; day++) dawns.push({ day, renewed: day === now ? renewed : 0 });
  return dawns;
}

const fresh = (now: readonly string[] | undefined, was: readonly string[] | undefined): string[] => (now ?? []).filter((x) => !(was ?? []).includes(x));

/**
 * Folds one step into the day's tally: the ids that are new in `after` against `before`. A find is an item met for the
 * first time (the journal) or a place brought home (`explored`, G33, G63); a build is a place mended or a camp part
 * raised; a thing learned is a recipe or a node of the tree. The wake itself (the race's outfit, the recipes everyone
 * starts with) is nobody's day: nothing is counted while `before` has no character. Changes `after` in place.
 */
export function tallyStep(b: Bundle, before: State, after: State): void {
  const p = after.player;
  const q = before.player;
  if (q.race === '') return;
  const found = [...fresh(p.journal, q.journal), ...fresh(p.explored, q.explored)];
  const built = [...fresh(p.restored, q.restored), ...fresh(p.camp, q.camp)];
  const learned = [...fresh(p.recipes, q.recipes), ...fresh(p.nodes, q.nodes)];
  if (found.length + built.length + learned.length === 0) return;
  const day = (p.day ??= { n: valleyDay(b, after.tick), found: [], built: [], learned: [] });
  day.found.push(...found);
  day.built.push(...built);
  day.learned.push(...learned);
}

/** The one thing waiting for the player's next visit: a task someone has for them, a task begun, or a place not walked yet. */
export type OpenDoor =
  | { kind: 'quest'; quest: string; giver: string | undefined; begun: boolean }
  | { kind: 'place'; id: string; name: string };

/**
 * The open door of a day summary (G16), picked from the quest state alone: first a task a character has for the
 * player and has not been taken (its requirements done, offered to this wake pocket), then a task begun and not done,
 * then a named place not yet entered. Each in id order, so the same state names the same door. None when nothing
 * waits (every task done and every place seen).
 */
export function openDoor(b: Bundle, s: PublicState): OpenDoor | undefined {
  const p = s.player;
  const ids = Object.keys(b.quests).sort();
  const offered = (q: { pocket?: string }) => q.pocket === undefined || q.pocket === p.pocket;
  for (const id of ids) {
    const q = b.quests[id]!;
    if (q.giver === undefined || p.quests[id] !== undefined || !offered(q)) continue;
    if ((q.requires ?? []).every((r) => p.quests[r] === 'done')) return { kind: 'quest', quest: id, giver: q.giver, begun: false };
  }
  for (const id of ids) {
    const q = b.quests[id]!;
    if (p.quests[id] === 'active' && offered(q)) return { kind: 'quest', quest: id, giver: q.giver, begun: true };
  }
  for (const slot of b.map.slots) {
    if (slot.kind === 'area' && slot.label !== undefined && !(p.seen ?? []).includes(slot.id)) return { kind: 'place', id: slot.id, name: slot.label };
  }
  return undefined;
}

/**
 * The day a summary tells (G16): the valley day that is running when it holds anything, else the day that ended before it
 * (a player who reaches the end of a session in the first minutes after a dawn), else none.
 */
export function summaryDay(s: PublicState): (DayLog & { n: number }) | undefined {
  const day = s.player.day;
  if (day === undefined) return undefined;
  if (dayHolds(day) > 0 || day.prev === undefined) return dayHolds(day) > 0 ? day : undefined;
  return dayHolds(day.prev) > 0 ? day.prev : undefined;
}
