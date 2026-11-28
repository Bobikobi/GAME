/**
 * A quest shut by its content (`shut_until`): nobody offers it and nothing starts it, and a save that already took it
 * keeps it and can finish it. The world is the pixel valley (an engine rule), the quest the tangle, whose heart is a
 * visit; a shut copy of the bundle against the bundle as it ships.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Action, type Bundle, type State, inRect, findSlot, makeWalkable, near, newState, npcTile, openDoor, questShut, step, type Tile } from '@game/kernel';
import { loadPixelBundle } from '../../tools/test/helpers/world.js';

const TANGLE = 'core/the-tangle';
const HEART = 'core/tangle-heart';

let base: Bundle;

beforeAll(() => {
  base = loadPixelBundle();
});

/** The bundle with these quests shut until a named thing exists. */
function shut(ids: string[], b: Bundle = base): Bundle {
  const out = structuredClone(b);
  for (const id of ids) out.quests[id] = { ...out.quests[id]!, shut_until: 'a painted tangle (public #944)' };
  return out;
}

function begin(b: Bundle): State {
  const r = step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** Every quest the tangle requires done, by the save alone, so the tangle is the next the elder has. */
function ready(b: Bundle): State {
  const s = begin(b);
  const done = new Set<string>();
  const walk = (id: string) => {
    for (const r of b.quests[id]?.requires ?? []) {
      if (done.has(r)) continue;
      done.add(r);
      walk(r);
    }
  };
  walk(TANGLE);
  for (const id of done) s.player.quests[id] = 'done';
  return s;
}

/** A walkable tile within reach of a tile. */
function beside(b: Bundle, s: State, tile: Tile): Tile {
  const walkable = makeWalkable(b);
  for (let y = tile[1] - 1; y <= tile[1] + 1; y++) {
    for (let x = tile[0] - 1; x <= tile[0] + 1; x++) {
      if ((x !== tile[0] || y !== tile[1]) && walkable(x, y, s.player) && near([x, y], { x: tile[0], y: tile[1], w: 1, h: 1 })) return [x, y];
    }
  }
  throw new Error(`nowhere to stand beside ${tile.join(',')}`);
}

/** The player put beside the elder as if they had walked there. */
function atGiver(b: Bundle, s: State): { s: State; at: Tile } {
  const out = structuredClone(s);
  const at = beside(b, out, npcTile(b, b.quests[TANGLE]!.giver!)!);
  out.player.at = [...at];
  return { s: out, at };
}

const act = (b: Bundle, s: State, a: Action) => step(b, s, a, s.tick + 1000);

describe('a quest shut by its content', () => {
  test('is offered as it ships, and not once shut', () => {
    const open = atGiver(base, ready(base));
    expect(act(base, open.s, { t: 'accept', quest: TANGLE, at: open.at }).ok).toBe(true);

    const b = shut([TANGLE]);
    expect(questShut(b.quests[TANGLE]!)).toBe(true);
    expect(questShut(base.quests[TANGLE]!)).toBe(false);
    const closed = atGiver(b, ready(b));
    const r = act(b, closed.s, { t: 'accept', quest: TANGLE, at: closed.at });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('Nobody offers that task.');
  });

  test('is not the day summary\'s open door', () => {
    const b = shut([TANGLE]);
    const s = ready(b);
    // as it ships, the tangle is the first door when every other task is done; shut, it never is
    const rest = Object.keys(base.quests).filter((id) => id !== TANGLE && s.player.quests[id] === undefined);
    for (const id of rest) s.player.quests[id] = 'done';
    expect(openDoor(base, s)).toEqual(expect.objectContaining({ quest: TANGLE, begun: false }) as unknown);
    expect(openDoor(b, s)).not.toEqual(expect.objectContaining({ quest: TANGLE }) as unknown);
    const offered = Object.keys(base.quests).filter((id) => base.quests[id]!.giver && !s.player.quests[id] && (base.quests[id]!.requires ?? []).every((r) => s.player.quests[r] === 'done'));
    expect(offered).toContain(TANGLE);
  });

  test('is never started on its own when it has no giver', () => {
    const b = shut([TANGLE]);
    const { giver: _, ...rest } = b.quests[TANGLE]!;
    b.quests[TANGLE] = rest;
    const open = structuredClone(b);
    delete open.quests[TANGLE]!.shut_until;
    // any accepted quest runs the giver-less pass; the first the forager can take
    const s = ready(b);
    const first = Object.keys(b.quests)
      .sort()
      .find((id) => b.quests[id]!.giver && id !== TANGLE && !s.player.quests[id] && (b.quests[id]!.requires ?? []).every((r) => s.player.quests[r] === 'done') && (b.quests[id]!.pocket === undefined || b.quests[id]!.pocket === s.player.pocket));
    expect(first).toBeDefined();
    const place = (bb: Bundle) => {
      const out = structuredClone(s);
      const at = beside(bb, out, npcTile(bb, bb.quests[first!]!.giver!)!);
      out.player.at = [...at];
      return act(bb, out, { t: 'accept', quest: first!, at });
    };
    const opened = place(open);
    const kept = place(b);
    if (!opened.ok || !kept.ok) throw new Error('the first quest was refused');
    expect(opened.state.player.quests[TANGLE]).toBe('active');
    expect(kept.state.player.quests[TANGLE]).toBeUndefined();
  });

  test('a save that took it before it was shut keeps it and finishes it', () => {
    const b = shut([TANGLE]);
    const s = ready(b);
    s.player.quests[TANGLE] = 'active';
    // the heart visited, then handed in at the elder
    const heart = findSlot(b.map, HEART)!;
    const walkable = makeWalkable(b);
    let inside: Tile | undefined;
    for (let y = heart.y; y < heart.y + heart.h && !inside; y++) for (let x = heart.x; x < heart.x + heart.w && !inside; x++) if (walkable(x, y, s.player)) inside = [x, y];
    expect(inside && inRect(inside[0], inside[1], heart)).toBe(true);
    const there = structuredClone(s);
    there.player.at = [...inside!];
    const seen = act(b, there, { t: 'visit', slot: HEART, at: inside! });
    if (!seen.ok) throw new Error(`visit refused: ${seen.error}`);
    expect(seen.state.player.quests[TANGLE]).toBe('active');
    // the day summary names it as a task begun once nothing new waits before it
    const after = structuredClone(seen.state);
    for (const id of Object.keys(b.quests)) if (id !== TANGLE) after.player.quests[id] = 'done';
    expect(openDoor(b, after)).toEqual(expect.objectContaining({ quest: TANGLE, begun: true }) as unknown);
    const home = atGiver(b, seen.state);
    const r = act(b, home.s, { t: 'turnin', quest: TANGLE, at: home.at });
    if (!r.ok) throw new Error(`turn-in refused: ${r.error}`);
    expect(r.state.player.quests[TANGLE]).toBe('done');
    expect(r.events).toContainEqual({ e: 'quest', quest: TANGLE, state: 'done' });
  });
});
