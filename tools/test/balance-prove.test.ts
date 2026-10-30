/**
 * The balance prover (NEXT 19 b): the curve's numbers, the rows over the
 * stand-in catalogue, and each invariant broken on purpose — a loop, an
 * experience leak, a cheesable wall, an unsolvable wall, a common thing with
 * two effects — so a row that cannot fail is caught too. The content's own
 * rows are read the way `pnpm check` reads them.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import type { ParamsBody } from '@game/schema';
import type { Catalogue, Piece, Wall } from '../src/balance/catalogue';
import { realCatalogue, vendorLoops } from '../src/balance/catalogue';
import { checkBalance } from '../src/balance/check';
import { hoursTenths, levelOf, masteryMs, scalePermille, stepMs } from '../src/balance/curve';
import { fixtureCatalogue } from '../src/balance/fixture';
import { type Proof, WIRED_ROWS, findCycle, prove, topBuilds } from '../src/balance/prove';
import { type Rules, ceilingOf } from '../src/balance/rules';
import { calmSnow, timeToZero } from '../src/balance/tables';
import { loadWorld } from '../src/balance/world';

let bundle: Bundle;
let params: ParamsBody;
let rules: Rules;
let cat: Catalogue;
let fixture: Proof;

const status = (p: Proof, id: string) => p.rows.find((r) => r.id === id)?.status;
const proveOnly = (c: Catalogue, r: Rules = rules) => prove(r, c, undefined, { top: false });

beforeAll(() => {
  ({ bundle, params, rules } = loadWorld());
  cat = fixtureCatalogue(rules);
  fixture = proveOnly(cat);
});

describe('the curve (PROGRESSION 3.2)', () => {
  it('t1 28 s, ratio 1.5: step 2 is 42 s, a school masters in 51.7 h at level 21', () => {
    expect(stepMs(28_000, 1500, 1)).toBe(28_000);
    expect(stepMs(28_000, 1500, 2)).toBe(42_000);
    expect(hoursTenths(masteryMs(rules))).toBe(517);
    expect(levelOf(rules, 0)).toBe(1);
    expect(levelOf(rules, masteryMs(rules) - 1)).toBe(rules.steps);
    expect(levelOf(rules, masteryMs(rules))).toBe(rules.steps + 1);
  });

  it('the 9.10 scale: each danger step is 1.5 times the last', () => {
    expect([0, 1, 2, 3].map((d) => scalePermille(1500, d))).toEqual([1000, 1500, 2250, 3375]);
  });

  it('the first 16 schools hold at least 800 hours; t1 outside its range is red', () => {
    expect(status(fixture, 'catalogue_hours_min')).toBe('pass');
    expect(fixture.hours.filter((h) => h.first)).toHaveLength(16);
    expect(fixture.hours.filter((h) => h.first).reduce((s, h) => s + h.tenths, 0)).toBeGreaterThanOrEqual(8000);
    expect(status(proveOnly(cat, { ...rules, t1Ms: rules.t1MaxMs + 1 }), 'curve_t1')).toBe('fail');
  });
});

describe('ceilings (4.7)', () => {
  it('rise with the band, and the raisers lift only the top band', () => {
    expect(status(fixture, 'ceilings')).toBe('pass');
    expect(ceilingOf(rules, 'work', 5, rules.raisersMax.work)).toBe(75);
    expect(ceilingOf(rules, 'work', 4, 2)).toBe(ceilingOf(rules, 'work', 4));
  });

  it('a ceiling that falls is red', () => {
    const falling = { ...rules, ceilings: { ...rules.ceilings, work: [25, 35, 30, 55, 65] } };
    expect(status(proveOnly(cat, falling), 'ceilings')).toBe('fail');
  });
});

describe('red line A: no loop', () => {
  it('the stand-in has none', () => {
    expect(findCycle(cat)).toBeUndefined();
    expect(status(fixture, 'effect_graph_acyclic')).toBe('pass');
  });

  it('a smith piece that raises smithing quality closes a loop and is red', () => {
    const loop: Piece = { id: 'hand.t3.rare.quality_smithing', slot: 'hand', tier: 3, rarity: 2, master: false, maker: 'smithing', effects: [{ kind: 'quality_smithing', cat: null, value: 1 }] };
    const broken = { ...cat, pieces: [...cat.pieces, loop] };
    expect(findCycle(broken)).toEqual(['quality_smithing', 'strength:smithing', 'quality_smithing']);
    expect(status(proveOnly(broken), 'effect_graph_acyclic')).toBe('fail');
  });

  it('at the vendor: a raw berry at 5,000 mg buys two, makes a mash and sells it at a profit (the loop the content once had)', () => {
    const shops = Object.fromEntries(Object.entries(bundle.shops).map(([id, s]) => [id, { ...s, sells: s.sells.map((o) => (o.item === 'core/berry' ? { ...o, price_mg: 5_000 } : o)) }]));
    const cheap: Bundle = { ...bundle, shops };
    const top = vendorLoops(cheap)[0]!;
    expect(top.what).toContain('core/berry-mash');
    expect([top.costMg, top.payMg, top.profitMg]).toEqual([10_000, 31_500, 21_500]);
    expect(status(prove(rules, realCatalogue(cheap, rules), cheap, { top: false }), 'loop_profit_max')).toBe('fail');
  });

  it('the content as shipped has no loop: a raw berry costs half the mash it makes', () => {
    expect(vendorLoops(bundle).filter((l) => l.profitMg > rules.loopProfitMaxMg)).toEqual([]);
    expect(status(prove(rules, realCatalogue(bundle, rules), bundle, { top: false }), 'loop_profit_max')).toBe('pass');
  });
});

describe('red line B: no experience but the mentor', () => {
  it('the group share is a second source and is red; the mentor alone passes', () => {
    expect(status(fixture, 'xp_sources')).toBe('fail');
    const mentorOnly = { ...cat, xpSources: cat.xpSources.filter((s) => s.source === 'mentor') };
    expect(status(proveOnly(mentorOnly), 'xp_sources')).toBe('pass');
  });

  it('a thing that carries experience is red', () => {
    const leak: Piece = { id: 'head.t2.rare.xp_bonus', slot: 'head', tier: 2, rarity: 2, master: false, effects: [{ kind: 'xp_bonus', cat: null, value: 5 }] };
    const mentorOnly = { ...cat, xpSources: cat.xpSources.filter((s) => s.source === 'mentor'), pieces: [...cat.pieces, leak] };
    const row = proveOnly(mentorOnly).rows.find((r) => r.id === 'xp_sources')!;
    expect(row.status).toBe('fail');
    expect(row.detail).toContain('xp_bonus');
  });
});

describe('rarity (5.7)', () => {
  it('the stand-in keeps common plain and each rarity within its effects', () => {
    expect(status(fixture, 'common_plain')).toBe('pass');
    expect(status(fixture, 'rarity_effects_max')).toBe('pass');
  });

  it('a common thing with two effects is red twice: not plain, and over its count', () => {
    const two: Piece = { id: 'feet.t1.common.two', slot: 'feet', tier: 1, rarity: 0, master: false, effects: [{ kind: 'move', cat: 'move', value: 3 }, { kind: 'carry', cat: 'carry', value: 3 }] };
    const p = proveOnly({ ...cat, pieces: [...cat.pieces, two] });
    expect(status(p, 'common_plain')).toBe('fail');
    expect(status(p, 'rarity_effects_max')).toBe('fail');
  });
});

describe('walls (BODY_CLOCKS 5-7)', () => {
  it('every stand-in wall has a witness that passes, and nothing two bands below passes', () => {
    for (const w of cat.walls) {
      expect(status(fixture, `wall_witness_required:${w.id}`), w.id).toBe('pass');
      expect(status(fixture, `wall_solvable:${w.id}`), w.id).toBe('pass');
      expect(status(fixture, `wall_not_cheesable:${w.id}`), w.id).toBe('pass');
    }
  });

  it('the worked example (4.7): band 3 loses 11% at the north pass and runs out of its clock, band 4 loses nothing', () => {
    const north = cat.walls.find((w) => w.id === 'north-pass')!;
    expect(proveOnly({ ...cat, walls: [north] }).walls[0]!.cheese.endPermille).toBe(890);
    expect(proveOnly({ ...cat, walls: [north] }, { ...rules, wallCheeseGap: 1 }).walls[0]!.cheese.endPermille).toBe(1000);
  });

  it('a wall of drain alone is cheesable from band 3 once grade 1 drains 10: it needs a clock or a requirement', () => {
    const north = cat.walls.find((w) => w.id === 'north-pass')!;
    const bare: Wall = { id: 'drain-only', band: north.band, conditions: north.conditions, grade: north.grade, lengthMin: north.lengthMin, by: north.by, ...(north.witness ? { witness: north.witness } : {}) };
    expect(status(proveOnly({ ...cat, walls: [bare] }), 'wall_not_cheesable:drain-only')).toBe('fail');
  });

  it('a short, mild wall at band 5 is cheesable from band 3 and red', () => {
    const north = cat.walls.find((w) => w.id === 'north-pass')!;
    const mild: Wall = { id: 'mild', band: 5, conditions: ['frost'], grade: 1, lengthMin: 60, by: 'move', witness: north.witness };
    expect(status(proveOnly({ ...cat, walls: [mild] }), 'wall_not_cheesable:mild')).toBe('fail');
  });

  it('deep snow and ice at band 3 for six game hours cannot be walked, even by its witness: red', () => {
    const feet = cat.pieces.find((p) => p.slot === 'feet' && p.tier === 3 && p.trait !== undefined)!;
    const hard: Wall = { id: 'hard', band: 3, conditions: ['deep_snow', 'ice'], grade: 3, lengthMin: 360, by: 'move', witness: { pieces: [feet.id], dishes: [] } };
    const p = proveOnly({ ...cat, walls: [hard] });
    expect(status(p, 'wall_solvable:hard')).toBe('fail');
    expect(status(p, 'wall_not_cheesable:hard')).toBe('pass');
  });

  it('a wall with no witness is red', () => {
    const bare: Wall = { id: 'bare', band: 4, conditions: ['ice'], grade: 3, lengthMin: 540, by: 'move' };
    expect(status(proveOnly({ ...cat, walls: [bare] }), 'wall_witness_required:bare')).toBe('fail');
  });

  it('the walk is bounded: dominance pruning walks a few states of a space of 10^22', () => {
    for (const c of fixture.counts) expect(c.walked, c.what).toBeLessThanOrEqual(rules.proofEnumMax);
    expect(fixture.counts.some((c) => c.full.length > 20)).toBe(true);
  });
});

describe('tables and the strongest builds', () => {
  it('an unanswered top grade empties the bar in one game hour; a new player dressed for calm snow never empties', () => {
    const grade = rules.gradeDrainPct.length - 1;
    const top = timeToZero(rules).find((t) => t.grade === grade && t.answer === 0)!;
    expect(top.bareMs).toBe(rules.gameHourMs);
    const snow = calmSnow(rules, cat);
    expect(snow[0]!.bareMs).toBe(10 * rules.gameHourMs);
    expect(snow.at(-1)!.remaining).toBe(0);
    expect(snow.at(-1)!.bareMs).toBeNull();
  });

  it('the top list is a warning, never a failure, and walks a bounded beam', () => {
    const t = topBuilds(rules, cat, 1);
    expect(t.top.length).toBeGreaterThan(0);
    expect(t.states).toBeLessThanOrEqual(rules.proofEnumMax);
    expect(t.ratioPermille).toBeGreaterThan(1000);
  });
});

describe('pnpm check', () => {
  it('the content passes every wired row', () => {
    expect(checkBalance(bundle, params)).toEqual([]);
    const content = prove(rules, realCatalogue(bundle, rules), bundle, { top: false });
    for (const id of WIRED_ROWS) expect(status(content, id), id).toBe('pass');
  });

  it('a falling ceiling in params is an error of `pnpm check`', () => {
    const balance = params.balance!;
    const broken: ParamsBody = { ...params, balance: { ...balance, ceilings: { ...balance.ceilings, sense: [1, 2, 1, 3, 4] } } };
    const issues = checkBalance(bundle, broken);
    expect(issues.map((i) => i.where)).toEqual(['balance.ceilings']);
    expect(issues[0]!.level).toBe('error');
  });
});
