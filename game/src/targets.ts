/**
 * Where the main task points right now: the tiles the world scene marks with a glint, so the
 * next place to go reads from the map itself (G28, onboarding research phase 2). Pure, so the
 * rule can be tested without a scene.
 */
import { type Bundle, type Rect, type State, campTile, findSlot, hourOf, isNight, npcTile } from '@game/kernel';

import { activeQuests, questSteps, readyToHandIn } from './text';

export interface Target {
  /** tile coordinates; a slot gives its centre tile on its bottom row */
  x: number;
  y: number;
  /** the height of what stands there, in pixels, so the glint rises from its top */
  h: number;
}

/** At most this many, the nearest to the player first: a resource with many nodes must not fill the valley with sparks. */
export const MAX_TARGETS = 6;

export function questTargets(b: Bundle, s: State, tick: number): Target[] {
  const main = activeQuests(b, s)[0];
  if (!main) return [];
  const q = b.quests[main]!;
  if (readyToHandIn(b, s, main) && q.giver) {
    const t = npcTile(b, q.giver);
    return t ? [{ x: t[0], y: t[1], h: b.sprites[b.npcs[q.giver]?.sprite ?? '']?.h ?? 24 }] : [];
  }
  const i = questSteps(b, s, main).findIndex((st) => !st.done);
  const st = i >= 0 ? q.steps[i] : undefined;
  if (!st) return [];
  switch (st.kind) {
    case 'bring':
      return nearest(s, nodesGiving(b, s, tick, st.item));
    case 'restore': {
      const r = b.restores[st.restore];
      return r ? slotTarget(b, r.place.slot) : [];
    }
    case 'build': {
      const c = b.camps[st.camp];
      const t = c ? campTile(b, c.slot) : undefined;
      return t ? [{ x: t[0], y: t[1], h: 16 }] : [];
    }
    case 'visit':
      return slotTarget(b, st.slot);
    case 'riddle':
      return litAnswer(b, s, tick, st);
    default:
      // a find is found by its clue (sparks over the bushes would answer it for the player),
      // and a recipe is in the journal
      return [];
  }
}

type RiddleStep = Extract<Bundle['quests'][string]['steps'][number], { kind: 'riddle' }>;

/**
 * A riddle is the player's to solve by day. When its hour comes, a prop the riddle
 * cites that stands next to the answer lights it, the way a lantern lights the
 * ground below it: a dig answer from dusk (19:00) to dawn, a night visit at night.
 */
function litAnswer(b: Bundle, s: State, tick: number, st: RiddleStep): Target[] {
  const props = b.map.props.filter((p) => p.id !== undefined && st.props.includes(p.id));
  const lit = (r: Rect): boolean => props.some((p) => p.x <= r.x + r.w && r.x <= p.x + p.w && p.y <= r.y + r.h && r.y <= p.y + p.h);
  const a = st.answer;
  if (a.kind === 'dig') {
    const hour = hourOf(b, tick);
    if (hour < 19 && hour >= 5) return [];
    const spots: Target[] = [];
    for (const [id, inst] of Object.entries(b.instances)) {
      if (inst.kind !== 'treasure' || inst.source !== a.treasure) continue;
      if ((s.nodes[id]?.readyAt ?? 0) > tick || !lit({ x: inst.x, y: inst.y, w: 1, h: 1 })) continue;
      spots.push({ x: inst.x, y: inst.y, h: 16 });
    }
    return nearest(s, spots);
  }
  if (a.at !== 'night' || !isNight(b, tick)) return [];
  const slot = findSlot(b.map, a.slot);
  return slot && lit(slot) ? slotTarget(b, a.slot) : [];
}

/** The resource nodes that give the item and can be worked now (a regrowing node is only ground). */
function nodesGiving(b: Bundle, s: State, tick: number, item: string): Target[] {
  const out: Target[] = [];
  for (const [id, inst] of Object.entries(b.instances)) {
    if (inst.kind !== 'resource') continue;
    const r = b.resources[inst.source];
    if (!r || r.output !== item) continue;
    if ((s.nodes[id]?.readyAt ?? 0) > tick) continue;
    out.push({ x: inst.x, y: inst.y, h: b.sprites[r.sprite]?.h ?? 16 });
  }
  return out;
}

function nearest(s: State, targets: Target[]): Target[] {
  const [px, py] = s.player.at;
  const d = (t: Target): number => Math.abs(t.x - px) + Math.abs(t.y - py);
  return targets.sort((a, c) => d(a) - d(c) || a.y - c.y || a.x - c.x).slice(0, MAX_TARGETS);
}

function slotTarget(b: Bundle, slot: string): Target[] {
  const sl = findSlot(b.map, slot);
  return sl ? [{ x: sl.x + Math.floor(sl.w / 2), y: sl.y + sl.h - 1, h: 16 }] : [];
}
