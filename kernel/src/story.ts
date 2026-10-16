/**
 * Lines that wait for the world (docs/design/STORY.md section 5, GRUNT S-1).
 * A condition reads the state and changes nothing; of the remarks that hold
 * and have not been said, the highest priority wins, then the most specific,
 * then the first in the file (salience, as in Valve's dynamic dialogue).
 */
import type { WhenDef } from '@game/schema';

import type { Bundle } from './bundle';
import { type State, campBuilt, isNight } from './state';

/** Whether every condition `when` names holds, at `tick` for the time of day. */
export function holds(bundle: Bundle, state: State, when: WhenDef, tick: number = state.tick): boolean {
  const p = state.player;
  if (when.done && !when.done.every((q) => p.quests[q] === 'done')) return false;
  if (when.active && !when.active.every((q) => p.quests[q] === 'active')) return false;
  if (when.not_done && !when.not_done.every((q) => p.quests[q] !== 'done')) return false;
  if (when.restored && !when.restored.every((r) => p.restored.includes(r))) return false;
  if (when.built && !when.built.every((c) => campBuilt(bundle, state, c))) return false;
  if (when.has && !when.has.every((it) => (p.bag[it] ?? 0) > 0)) return false;
  if (when.visited && !when.visited.every((sl) => p.visited.includes(sl))) return false;
  if (when.time && (when.time === 'night') !== isNight(bundle, tick)) return false;
  return true;
}

/** How specific a condition is: one for each id it names, and one for a time of day. */
export function weight(when: WhenDef): number {
  const lists = [when.done, when.active, when.not_done, when.restored, when.built, when.has, when.visited];
  return lists.reduce((n, list) => n + (list?.length ?? 0), 0) + (when.time ? 1 : 0);
}

/** The key a heard remark is remembered by: "<npc id>#<index>". */
export function remarkKey(npcId: string, index: number): string {
  return `${npcId}#${index}`;
}

/** The remark a character says now, or undefined when none holds that was not said before. */
export function pickRemark(
  bundle: Bundle,
  state: State,
  npcId: string,
  heard: ReadonlySet<string>,
  tick: number = state.tick,
): { key: string; say: readonly string[] } | undefined {
  const remarks = bundle.npcs[npcId]?.remarks ?? [];
  let best: { key: string; say: readonly string[]; priority: number; weight: number } | undefined;
  remarks.forEach((r, i) => {
    const key = remarkKey(npcId, i);
    if (heard.has(key) || !holds(bundle, state, r.when, tick)) return;
    const priority = r.priority ?? 0;
    const w = weight(r.when);
    if (best && (best.priority > priority || (best.priority === priority && best.weight >= w))) return;
    best = { key, say: r.say, priority, weight: w };
  });
  return best && { key: best.key, say: best.say };
}

/**
 * What a quest's giver says at the hand-in: `talk.done_bitten` when a predator bit the player while
 * the quest was open and the content wrote that line, else `talk.done`; undefined when it has neither.
 */
export function doneLines(bundle: Bundle, state: State, questId: string): readonly string[] | undefined {
  const talk = bundle.quests[questId]?.talk;
  if (talk?.done_bitten && state.player.bitten?.includes(questId)) return talk.done_bitten;
  return talk?.done;
}
