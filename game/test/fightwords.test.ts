import { describe, expect, it } from 'vitest';
import type { FightOutcome, FightOutcomeKind } from '@game/kernel';
import { FIGHT_WORD_MS, fightWordAt } from '../src/fightwords';

const outcome = (kind: FightOutcomeKind, number: number): FightOutcome => ({
  kind, number, at: [4, 5], move: 'attack', striker: { side: 'player', id: 'p' }, struck: { side: 'foe', id: 'wolf' },
});

describe('fight words', () => {
  it.each([
    ['attack', 4, '4', 1],
    ['critical', 8, 'CRIT 8', 1.25],
    ['guard', 3, 'BLOCK 3', 1],
    ['guard', 0, 'BLOCK 0', 1],
    ['miss', 0, 'MISS', 1],
    ['dodge', 0, 'DODGE', 1],
  ] as const)('renders %s with the number the kernel supplied', (kind, number, text, scale) => {
    expect(fightWordAt(outcome(kind, number), 0)).toMatchObject({ text, scale });
  });

  it('starts above the head, rises and fades, and expires at 600 ms', () => {
    const hit = outcome('attack', 4);
    expect(fightWordAt(hit, -1)).toBeUndefined();
    expect(fightWordAt(hit, 0)).toMatchObject({ offset: 4, alpha: 1 });
    expect(fightWordAt(hit, 300)).toMatchObject({ offset: 12, alpha: 0.5 });
    const last = fightWordAt(hit, 599)!;
    expect(last.offset).toBeGreaterThan(19);
    expect(last.alpha).toBeGreaterThan(0);
    expect(last.alpha).toBeLessThan(0.01);
    expect(FIGHT_WORD_MS).toBe(600);
    expect(fightWordAt(hit, 600)).toBeUndefined();
  });

  it('keeps room for a critical label and its outline between stacked words', () => {
    const crit = outcome('critical', 8);
    const newer = fightWordAt(crit, 150, 0)!;
    const sameAge = fightWordAt(crit, 150, 1)!;
    const older = fightWordAt(crit, 350, 1)!;
    const labelHeight = 16 * newer.scale + 2;
    expect(sameAge.offset - newer.offset).toBeGreaterThan(labelHeight);
    expect(older.offset - newer.offset).toBeGreaterThan(labelHeight);
  });
});
