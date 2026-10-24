/** The hand as a check warning (tools/src/hands.ts): a breach prints a `!` line, never an error, and a clean world prints none. */
import type { Bundle } from '@game/kernel';
import { describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { checkHands } from '../src/hands';

type Q = { type?: string; requires?: string[]; pocket?: string };

/** Quests and two wake pockets: all the hand reads. */
function world(quests: Record<string, Q>): Bundle {
  return {
    quests: Object.fromEntries(Object.entries(quests).map(([id, q]) => [id, { id, file: `content/${id}.json`, steps: [], reward: { rep: 0 }, ...q }])),
    pockets: { a: { id: 'a', ground: [] }, b: { id: 'b', ground: [] } },
    items: {},
    resources: {},
    treasures: {},
    recipes: {},
    shops: {},
    expeditions: {},
    restores: {},
    camps: {},
  } as unknown as Bundle;
}

describe('the hand check', () => {
  it('warns once for two quests of one type that can be open at once, naming the pockets', () => {
    const issues = checkHands(world({ root: { type: 'skill' }, x: { type: 'riddle', requires: ['root'] }, y: { type: 'riddle', requires: ['root'] } }), {});
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: 'warning', file: 'content/y.json', where: 'quests.hand.y' });
    expect(issues[0]!.message).toContain('x and y (both riddle) can be open at once');
    expect(issues[0]!.message).toContain('every wake pocket');
  });

  it('names only the pocket the pair is open in', () => {
    const issues = checkHands(world({ x: { type: 'riddle', pocket: 'a' }, y: { type: 'riddle', pocket: 'a' } }), {});
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('(a)');
  });

  it('is silent for a world whose neighbours differ in type, and leaves a requires link to G17', () => {
    expect(checkHands(world({ x: { type: 'riddle' }, y: { type: 'skill', requires: ['x'] } }), {})).toEqual([]);
    expect(checkHands(world({ x: { type: 'riddle' }, y: { type: 'riddle', requires: ['x'] } }), {})).toEqual([]);
  });

  it('is part of pnpm check, as warnings only', () => {
    const { issues } = runCheck();
    const hand = issues.filter((i) => i.where.startsWith('quests.hand.'));
    expect(hand.every((i) => i.level === 'warning')).toBe(true);
  });
});
