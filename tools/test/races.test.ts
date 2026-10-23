/**
 * The race checks (tools/src/races.ts; DECISIONS.md, 2026-10-22): the core races pass, and a bundle
 * that breaks each rule gets an error that names it. No quest step is gated by race: a race may
 * appear only inside a quest's talk variants (and on remarks and topics, which gate nothing).
 */
import type { Bundle } from '@game/kernel';
import { beforeAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { checkRaces } from '../src/races';

let core: Bundle;
beforeAll(() => {
  core = runCheck().assembled.bundle!;
});

const messages = (b: Bundle) => checkRaces(b, {}).map((i) => `${i.where}: ${i.message}`);

describe('the core races', () => {
  it('pass every race check', () => {
    expect(checkRaces(core, {})).toEqual([]);
  });

  it('wear their outfits from tier 1, one piece per place, none a tool a pocket lays', () => {
    for (const r of Object.values(core.races)) {
      expect((r.outfit ?? []).length, r.id).toBeGreaterThan(0);
      expect((r.outfit ?? []).length, r.id).toBeLessThanOrEqual(3);
    }
  });
});

describe('a race that breaks a rule', () => {
  it('a home attribute at 0', () => {
    const b = structuredClone(core);
    b.races['core/elf']!.attributes.spirit = 0;
    expect(messages(b)).toContainEqual(expect.stringContaining('race.home.1: the home attribute spirit is 0'));
  });

  it('two core races with one home pair', () => {
    const b = structuredClone(core);
    b.races['core/elf']!.home = ['senses', 'luck'];
    expect(messages(b).filter((m) => m.includes('the same home pair'))).toHaveLength(1);
  });

  it('a world nobody knows, a graded valley and no strong home', () => {
    const b = structuredClone(core);
    b.races['core/human']!.grades = { mars: 'normal', valley: 'weak' };
    const m = messages(b);
    expect(m).toContainEqual(expect.stringContaining('no world "mars"'));
    expect(m).toContainEqual(expect.stringContaining('the valley is neutral to every race'));
    expect(m).toContainEqual(expect.stringContaining('a race is strong at home'));
  });

  it('a map region in a world no race grades and the core does not name', () => {
    const b = structuredClone(core);
    b.map.regions = [{ id: 'moon', x: 0, y: 0, w: 4, h: 4, world: 'moon' }];
    expect(messages(b)).toContainEqual(expect.stringContaining('no race grades the world "moon"'));
  });

  it('two pieces for one place, and a tool a pocket lays on its ground', () => {
    const b = structuredClone(core);
    b.races['core/elf']!.outfit = [
      { item: 'core/light-cloak', qty: 1 },
      { item: 'core/work-clothes', qty: 1 },
      { item: 'core/basket', qty: 1 },
    ];
    const m = messages(b);
    expect(m).toContainEqual(expect.stringContaining('2 pieces for the top'));
    expect(m).toContainEqual(expect.stringContaining('core/basket is not worn'));
    b.races['core/elf']!.outfit = [{ item: 'core/walking-staff', qty: 1 }];
    expect(messages(b)).toContainEqual(expect.stringContaining('a tool a wake pocket lays on its ground'));
  });

  it('a race named on a quest step, a requirement, a dig spot or a shop', () => {
    const b = structuredClone(core);
    const step = b.quests['core/first-fire']!.steps[0] as unknown as Record<string, unknown>;
    step.when = { race: ['core/elf'] };
    (b.treasures['core/ruins-gate'] as unknown as Record<string, unknown>).race = 'core/skeleton';
    (b.shops['core/trader-shop'] as unknown as Record<string, unknown>).races = ['core/human'];
    const m = messages(b).filter((x) => x.includes('never names a race'));
    expect(m.map((x) => x.split(':')[0]).sort()).toEqual(['race', 'races', 'steps.0.when.race']);
  });

  it('a race on a line of a quest is no gate', () => {
    const b = structuredClone(core);
    b.quests['core/first-fire']!.talk = { ...(b.quests['core/first-fire']!.talk ?? {}), variants: [{ when: { race: ['core/elf'] }, offer: ['The wood knows you.'] }] };
    expect(messages(b)).toEqual([]);
  });
});
