/**
 * The races (DECISIONS.md, 2026-10-22): the race is chosen and the wake pocket is drawn by the seed;
 * the race gives a fixed profile of six attributes and its outfit; the world under the player grades
 * the race's two home attributes, never below 0; a format 1 save and a format 1 start still play; a
 * line may differ by race, a quest never does.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  ATTRIBUTES,
  type Bundle,
  LEGACY_STARTERS,
  STATE_FORMAT,
  type State,
  attrAt,
  loadLimit,
  gradeShift,
  holds,
  makeWalkable,
  legacyNodeId,
  migrateState,
  newState,
  pickRemark,
  spotOpen,
  step,
  talkLines,
  wakePocket,
  weight,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;

beforeAll(() => {
  b = loadBundle();
});

const RACES = ['core/elf', 'core/human', 'core/skeleton'];
const POCKETS = ['core/north-meadow', 'core/slid-bank', 'core/west-bank'];

function seedFor(bundle: Bundle, pocket: string): number {
  for (let seed = 1; seed < 10_000; seed++) if (wakePocket(bundle, seed) === pocket) return seed;
  throw new Error(`no seed wakes in ${pocket}`);
}

function started(race: string, pocket: string, bundle: Bundle = b): State {
  const r = step(bundle, newState(bundle, seedFor(bundle, pocket)), { t: 'start', race, name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('the three races', () => {
  test('have the profiles of the cast plan: six attributes, seven points, two home attributes each', () => {
    expect(Object.keys(b.races).sort()).toEqual(RACES);
    const profile = (id: string) => b.races[id]!.attributes;
    expect(profile('core/human')).toEqual({ might: 1, senses: 2, agility: 1, luck: 1, stamina: 1, spirit: 1 });
    expect(profile('core/elf')).toEqual({ might: 0, senses: 2, agility: 2, luck: 1, stamina: 0, spirit: 2 });
    // the skeleton's profile, stamina 4 and might 1 (DECISIONS.md, 2026-10-23: no flesh to tire)
    expect(profile('core/skeleton')).toEqual({ might: 1, senses: 1, agility: 0, luck: 1, stamina: 4, spirit: 0 });
    expect([...b.races['core/human']!.home].sort()).toEqual(['luck', 'senses']);
    expect([...b.races['core/elf']!.home].sort()).toEqual(['agility', 'spirit']);
    expect([...b.races['core/skeleton']!.home].sort()).toEqual(['might', 'stamina']);
    for (const r of Object.values(b.races)) {
      expect(Object.keys(r.attributes).sort(), r.id).toEqual([...ATTRIBUTES].sort());
      expect(Object.values(r.attributes).reduce((n, v) => n + v, 0), r.id).toBe(7);
    }
    // every attribute is one race's home attribute exactly once
    expect(Object.values(b.races).flatMap((r) => r.home).sort()).toEqual([...ATTRIBUTES].sort());
  });
});

describe('the wake pocket', () => {
  test('is drawn by the seed: the same seed wakes in the same pocket, and every pocket is drawn', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const p = wakePocket(b, seed);
      expect(wakePocket(b, seed)).toBe(p);
      seen.add(p);
    }
    expect([...seen].sort()).toEqual(POCKETS);
  });

  test('is not the race: the pocket a seed draws is the same for every race', () => {
    for (const seed of [1, 2, 3, 99]) {
      const pockets = RACES.map((race) => {
        const r = step(b, newState(b, seed), { t: 'start', race, name: 'Tester' }, 0);
        if (!r.ok) throw new Error(r.error);
        return r.state.player.pocket;
      });
      expect(new Set(pockets).size).toBe(1);
    }
  });
});

describe('start() for each of the nine (race, pocket) pairs', () => {
  for (const race of RACES) {
    for (const pocket of POCKETS) {
      test(`${race} in ${pocket}`, () => {
        const s = started(race, pocket);
        const p = s.player;
        const def = b.races[race]!;
        const wake = b.pockets[pocket]!.wake;
        expect(p.race).toBe(race);
        expect(p.pocket).toBe(pocket);
        expect(p.attrs).toEqual(def.attributes);
        expect(p.at).toEqual([wake.x, wake.y]);
        // the outfit is in the bag and worn from the first morning
        for (const o of def.outfit ?? []) {
          expect(p.bag[o.item], o.item).toBe(o.qty);
          const w = b.items[o.item]?.wear;
          if (w && !w.look) expect(Object.values(p.worn)).toContain(o.item);
        }
        // the pocket's tools are not in the bag: they lie by the wake tile, as the pocket's own spots
        const outfitItems = new Set((def.outfit ?? []).map((o) => o.item));
        for (const g of b.pockets[pocket]!.ground) if (!outfitItems.has(g.item)) expect(p.bag[g.item], g.item).toBeUndefined();
        const own = Object.entries(b.instances).filter(([, i]) => i.kind === 'treasure' && b.treasures[i.source]!.pocket !== undefined);
        expect(own.length).toBeGreaterThan(0);
        for (const [id, inst] of own) expect(spotOpen(b, s, id), id).toBe(b.treasures[inst.source]!.pocket === pocket);
        const ground = own.filter(([, i]) => b.treasures[i.source]!.pocket === pocket).map(([, i]) => b.treasures[i.source]!.finds[0]!.item);
        for (const g of b.pockets[pocket]!.ground) expect(ground, g.item).toContain(g.item);
        // the valley grades nobody
        for (const a of ATTRIBUTES) expect(attrAt(b, s, a)).toBe(p.attrs[a]);
      });
    }
  }

  test('is refused for an unknown race and a second time', () => {
    expect(step(b, newState(b, 1), { t: 'start', race: 'core/nobody', name: 'Tester' }, 0)).toEqual({ ok: false, error: 'Unknown character.' });
    const s = started('core/elf', 'core/west-bank');
    expect(step(b, s, { t: 'start', race: 'core/elf', name: 'Tester' }, 0).ok).toBe(false);
  });
});

describe('a format 1 start (a logged game replayed)', () => {
  test('names a starter: it plays as that race, in that pocket, with the old profile and the tools in the bag', () => {
    for (const [starter, now] of Object.entries(LEGACY_STARTERS)) {
      const r = step(b, newState(b, 7), { t: 'start', starter, name: 'Tester' }, 0);
      if (!r.ok) throw new Error(r.error);
      const p = r.state.player;
      expect(p.race, starter).toBe(now.race);
      expect(p.pocket, starter).toBe(now.pocket);
      expect(p.attrs, starter).toEqual(now.attrs);
      for (const g of b.pockets[now.pocket]!.ground) expect(p.bag[g.item], `${starter} ${g.item}`).toBe(g.qty);
      // the spots that lay those tools are spent
      for (const [id, inst] of Object.entries(b.instances)) {
        const d = inst.kind === 'treasure' ? b.treasures[inst.source] : undefined;
        if (d?.pocket === now.pocket && b.pockets[now.pocket]!.ground.some((g) => g.item === d.finds[0]?.item)) expect(spotOpen(b, r.state, id), id).toBe(false);
      }
    }
  });
});

describe('the grade', () => {
  /** The valley with one region, the north, that is strong for the elf and weak for the skeleton. */
  function graded(): Bundle {
    const g = structuredClone(b);
    g.map.regions = [{ id: 'north-edge', x: 0, y: 0, w: g.map.width, h: 12, world: 'north' }];
    g.races['core/elf']!.grades = { north: 'strong' };
    g.races['core/skeleton']!.grades = { north: 'weak' };
    return g;
  }

  test('is 0 everywhere today: the valley is neutral and the map names no region', () => {
    for (const race of RACES) {
      const s = started(race, 'core/north-meadow');
      for (const a of ATTRIBUTES) {
        expect(gradeShift(b, s, a, [0, 0])).toBe(0);
        expect(gradeShift(b, s, a, [b.map.width - 1, b.map.height - 1])).toBe(0);
      }
    }
  });

  test('lifts the home pair by one where the world is strong, and touches nothing else', () => {
    const g = graded();
    const s = started('core/elf', 'core/north-meadow', g); // the north meadow (7,6) lies in the region
    expect(attrAt(g, s, 'agility')).toBe(s.player.attrs.agility + 1);
    expect(attrAt(g, s, 'spirit')).toBe(s.player.attrs.spirit + 1);
    for (const a of ['might', 'senses', 'luck', 'stamina'] as const) expect(attrAt(g, s, a)).toBe(s.player.attrs[a]);
    const south = structuredClone(s);
    south.player.at = [9, 23];
    expect(attrAt(g, south, 'agility')).toBe(s.player.attrs.agility);
  });

  test('lowers the home pair by one where the world is weak, never below 0', () => {
    const g = graded();
    const s = started('core/skeleton', 'core/north-meadow', g);
    expect(attrAt(g, s, 'might')).toBe(0);
    expect(attrAt(g, s, 'stamina')).toBe(3);
    // the weight limit reads might as the grade leaves it
    expect(loadLimit(g, s)).toBe(g.params.load.base);
    s.player.attrs.stamina = 0;
    expect(attrAt(g, s, 'stamina')).toBe(0);
    // spending reads the base, against the one cap
    expect(s.player.attrs.might).toBe(1);
  });

  test('a step into another world tells each home attribute that moved', () => {
    const g = structuredClone(b);
    g.races['core/elf']!.grades = { north: 'strong' };
    const s = started('core/elf', 'core/north-meadow', g);
    const walkable = makeWalkable(g);
    const [x, y] = s.player.at;
    const next = ([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]).find(([nx, ny]) => walkable(nx, ny, s.player))!;
    // one tile of the north beside the wake
    g.map.regions = [{ id: 'north-edge', x: next[0], y: next[1], w: 1, h: 1, world: 'north' }];
    const r = step(g, s, { t: 'move', at: next }, 10_000);
    if (!r.ok) throw new Error(r.error);
    const grades = r.events.filter((e) => e.e === 'grade');
    expect(grades).toEqual([
      { e: 'grade', attr: 'agility', value: s.player.attrs.agility + 1 },
      { e: 'grade', attr: 'spirit', value: s.player.attrs.spirit + 1 },
    ]);
    const stay = step(g, r.state, { t: 'move', at: next }, 11_000);
    expect(stay.ok && stay.events.filter((e) => e.e === 'grade')).toEqual([]);
    const back = step(g, r.state, { t: 'move', at: [x, y] }, 12_000);
    expect(back.ok && back.events.filter((e) => e.e === 'grade').length).toBe(2);
  });
});

describe('a format 1 save', () => {
  function oldSave(starter: string): State {
    const s = newState(b, 5) as unknown as { format: number; player: Record<string, unknown> & { attrs: Record<string, number> } };
    s.format = 1;
    delete s.player.race;
    delete s.player.pocket;
    s.player.starter = starter;
    s.player.attrs = { carry: 2, senses: 1, agility: 2, luck: 0, stamina: 1 };
    return s as unknown as State;
  }

  test('loads: carry is read as might, spirit starts at 0, the starter becomes its race and pocket', () => {
    const saved = oldSave('core/forager');
    const before = JSON.stringify(saved);
    const s = migrateState(saved);
    expect(JSON.stringify(saved)).toBe(before);
    expect(s.format).toBe(STATE_FORMAT);
    expect(s.player.attrs).toEqual({ might: 2, senses: 1, agility: 2, luck: 0, stamina: 1, spirit: 0 });
    expect(s.player.race).toBe('core/elf');
    expect(s.player.pocket).toBe('core/west-bank');
    expect('starter' in s.player).toBe(false);
    expect(migrateState(s)).toEqual(s);
  });

  test('a character not yet chosen stays unchosen', () => {
    const s = migrateState(oldSave(''));
    expect(s.player.race).toBe('');
    expect(s.player.pocket).toBe('');
  });

  test('a dug slid bank stays dug: the spot keeps its state under the renamed source', () => {
    const saved = oldSave('core/digger');
    saved.nodes = { 'core/slid-bank#0': { readyAt: 0, draws: 1 } };
    const s = migrateState(saved);
    expect(s.nodes).toEqual({ 'core/slid-bank-dig#0': { readyAt: 0, draws: 1 } });
    expect(spotOpen(b, s, 'core/slid-bank-dig#0')).toBe(false);
    expect(legacyNodeId('core/slid-bank#0')).toBe('core/slid-bank-dig#0');
    expect(legacyNodeId('core/bridge-glint#0')).toBe('core/bridge-glint#0');
    expect(b.instances['core/slid-bank-dig#0']).toBeDefined();
  });

  test('a logged starter start carries only its old kit, no race outfit', () => {
    const r = step(b, newState(b, 5), { t: 'start', starter: 'core/digger', name: 'Tester' }, 0);
    if (!r.ok) throw new Error(r.error);
    expect(Object.keys(r.state.player.bag)).toEqual(['core/trowel']);
    expect(Object.values(r.state.player.worn).filter((v) => v !== undefined && v !== null && v !== 'core/trowel')).toEqual([]);
  });

  test('plays on after the migration', () => {
    const s = migrateState(oldSave('core/digger'));
    expect(s.player.race).toBe('core/skeleton');
    expect(s.player.pocket).toBe('core/slid-bank');
    expect(step(b, s, { t: 'move', at: [...s.player.at] as [number, number] }, 1000).ok).toBe(true);
  });
});

describe('when.race', () => {
  test('holds for a race in the list and weighs one', () => {
    const elf = started('core/elf', 'core/west-bank');
    expect(holds(b, elf, { race: ['core/elf'] })).toBe(true);
    expect(holds(b, elf, { race: ['core/human', 'core/skeleton'] })).toBe(false);
    expect(weight({ race: ['core/human', 'core/skeleton'] })).toBe(1);
  });

  test('picks the remark written for the race over the line for everyone', () => {
    const g = structuredClone(b);
    const npc = Object.keys(g.npcs).sort()[0]!;
    g.npcs[npc]!.remarks = [
      { when: {}, say: ['For everyone.'] },
      { when: { race: ['core/elf'] }, say: ['For the elf.'] },
      { when: { race: ['core/skeleton'] }, say: ['For the bones.'] },
    ];
    const say = (race: string) => pickRemark(g, started(race, 'core/west-bank', g), npc, new Set())?.say;
    expect(say('core/elf')).toEqual(['For the elf.']);
    expect(say('core/skeleton')).toEqual(['For the bones.']);
    expect(say('core/human')).toEqual(['For everyone.']);
  });

  test("picks a quest's talk variant by race, and the plain words for every other race", () => {
    const g = structuredClone(b);
    const id = Object.keys(g.quests).find((q) => g.quests[q]!.giver !== undefined)!;
    const q = g.quests[id]!;
    q.talk = { offer: ['Plain words.'], done: ['Thanks.'], variants: [{ when: { race: ['core/skeleton'] }, offer: ['Words for the bones.'] }] };
    const skeleton = started('core/skeleton', 'core/west-bank', g);
    const human = started('core/human', 'core/west-bank', g);
    expect(talkLines(g, skeleton, id, 'offer')).toEqual(['Words for the bones.']);
    expect(talkLines(g, human, id, 'offer')).toEqual(['Plain words.']);
    // a variant that does not name the part leaves it as written
    expect(talkLines(g, skeleton, id, 'done')).toEqual(['Thanks.']);
    expect(talkLines(g, skeleton, id, 'waiting')).toBeUndefined();
  });
});
