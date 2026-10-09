import { describe, expect, test } from 'vitest';

import { type Bundle, type State, campTile, findSlot, newState, npcTile } from '@game/kernel';
import { MAX_TARGETS, questTargets } from '../src/targets';
import { loadBundle } from '../../tools/test/helpers/world';

const bundle = loadBundle();
type Quest = Bundle['quests'][string];

/** A state whose only active task is `id`; whatever the fresh game opened is set aside as done. */
function withQuest(b: Bundle, id: string): State {
  const s = newState(b, 1);
  for (const k of Object.keys(s.player.quests)) s.player.quests[k] = 'done';
  s.player.quests[id] = 'active';
  return s;
}

/** The core quests whose first step is of `kind`. */
function firstStepOf(kind: string): string[] {
  return Object.keys(bundle.quests).filter((id) => bundle.quests[id]?.steps[0]?.kind === kind);
}

/** The ids of the resource nodes whose output is `item`. */
function nodesOf(b: Bundle, item: string): string[] {
  return Object.entries(b.instances)
    .filter(([, i]) => i.kind === 'resource' && b.resources[i.source]?.output === item)
    .map(([id]) => id);
}

/** The bundle with one more quest, bring one `item`, no giver: the core content has no bring step of its own. */
function withBring(item: string): { b: Bundle; id: string } {
  const id = 'test/bring';
  const base = Object.values(bundle.quests)[0]!;
  const q = { ...base, id, giver: undefined, steps: [{ kind: 'bring', item, qty: 1 }] } as unknown as Quest;
  return { b: { ...bundle, quests: { ...bundle.quests, [id]: q } }, id };
}

const item = Object.values(bundle.resources)
  .map((r) => r.output)
  .find((o) => nodesOf(bundle, o).length > 0)!;

function slotCentre(b: Bundle, slot: string): { x: number; y: number; h: number } {
  const sl = findSlot(b.map, slot)!;
  return { x: sl.x + Math.floor(sl.w / 2), y: sl.y + sl.h - 1, h: 16 };
}

describe('quest targets', () => {
  test('a bring step marks the nodes that give the item, nearest first, a few at most', () => {
    const { b, id } = withBring(item);
    const s = withQuest(b, id);
    const targets = questTargets(b, s, s.tick);
    const ids = nodesOf(b, item);
    expect(targets.length).toBe(Math.min(ids.length, MAX_TARGETS));
    for (const t of targets) {
      expect(ids.some((n) => b.instances[n]!.x === t.x && b.instances[n]!.y === t.y)).toBe(true);
      expect(t.h).toBeGreaterThan(0);
    }
    const [px, py] = s.player.at;
    const d = targets.map((t) => Math.abs(t.x - px) + Math.abs(t.y - py));
    expect([...d].sort((x, y) => x - y)).toEqual(d);
  });

  test('a regrowing node is not a target', () => {
    const { b, id } = withBring(item);
    const s = withQuest(b, id);
    const ids = nodesOf(b, item);
    const keep = ids[ids.length - 1]!;
    for (const n of ids) if (n !== keep) s.nodes[n] = { readyAt: s.tick + 1000, draws: 0 };
    const k = b.instances[keep]!;
    expect(questTargets(b, s, s.tick)).toEqual([{ x: k.x, y: k.y, h: expect.any(Number) }]);
    s.nodes[keep] = { readyAt: s.tick + 1000, draws: 0 };
    expect(questTargets(b, s, s.tick)).toEqual([]);
  });

  test('a find is found by its clue and a riddle by the player: nothing is marked', () => {
    const ids = [...firstStepOf('find'), ...firstStepOf('riddle')];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const s = withQuest(bundle, id);
      expect(questTargets(bundle, s, s.tick)).toEqual([]);
    }
  });

  test('the camp to build, the site to mend and the place to visit are marked', () => {
    let seen = 0;
    for (const id of [...firstStepOf('build'), ...firstStepOf('restore'), ...firstStepOf('visit')]) {
      const st = bundle.quests[id]!.steps[0]!;
      const s = withQuest(bundle, id);
      const want =
        st.kind === 'build'
          ? (([x, y]) => ({ x, y, h: 16 }))(campTile(bundle, bundle.camps[st.camp]!.slot)!)
          : st.kind === 'restore'
            ? slotCentre(bundle, bundle.restores[st.restore]!.place.slot)
            : st.kind === 'visit'
              ? slotCentre(bundle, st.slot)
              : undefined;
      expect(want).toBeDefined();
      expect(questTargets(bundle, s, s.tick)).toEqual([want]);
      seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });

  test('ready to hand in: the giver', () => {
    const id = firstStepOf('find').find((q) => bundle.quests[q]?.giver)!;
    const q = bundle.quests[id]!;
    const st = q.steps[0]!;
    expect(st.kind).toBe('find');
    if (st.kind !== 'find') return;
    const s = withQuest(bundle, id);
    s.player.bag[st.item] = 1;
    const t = npcTile(bundle, q.giver!)!;
    expect(questTargets(bundle, s, s.tick)).toEqual([{ x: t[0], y: t[1], h: expect.any(Number) }]);
  });

  test('no open task, no targets', () => {
    const s = newState(bundle, 1);
    for (const id of Object.keys(s.player.quests)) s.player.quests[id] = 'done';
    expect(questTargets(bundle, s, s.tick)).toEqual([]);
  });
});
