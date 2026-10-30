/**
 * The hunt ladder calculators (tools/src/balance/hunt-ladder.ts): the loader, the habitat counted on the map, the value
 * of a catch against the solver, difficulty and rarity, the tiers, the gaps, the pay cap in value units (HUNTING 9),
 * the experience audit, and the committed page against what the calculators print.
 */
import { readFileSync } from 'node:fs';
import { type Bundle, EFFORT_TIERS } from '@game/kernel';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type HuntParams,
  type KindRow,
  type Ladder,
  LADDER_FILE,
  MARKDOWN_FILE,
  XP_FILE,
  catchValue,
  craftChance,
  dailyYield,
  difficultyMatrix,
  dressMs,
  effortIndex,
  fmtRatio,
  goodValues,
  gradeShift,
  huntParams,
  ladderGaps,
  ladderOutputs,
  loadLadder,
  loopMs,
  noticeRow,
  onMap,
  payCap,
  payForCatch,
  rarityBonusMs,
  rarityRank,
  readLadder,
  standing,
  tagTiles,
  tierTable,
  toolFor,
  valuePerSecond,
  xpAudit,
  xpProposal,
} from '../src/balance/hunt-ladder';
import { thresholdsOf } from '../src/balance/curve';
import type { Rules } from '../src/balance/rules';
import { loadWorld } from '../src/balance/world';

let bundle: Bundle;
let rules: Rules;
let ladder: Ladder;
let p: HuntParams;
const raw = () => JSON.parse(readFileSync(LADDER_FILE, 'utf8')) as { tools: Record<string, unknown>[]; kinds: Record<string, unknown>[]; families: unknown[] };
const kind = (id: string): KindRow => ladder.kinds.find((k) => k.id === id)!;
const tool = (id: string) => ladder.tools.find((t) => t.id === id)!;

beforeAll(() => {
  ({ bundle, rules } = loadWorld());
  ladder = onMap(readLadder(), bundle.map);
  p = huntParams(bundle.params, ladder);
});

describe('the loader', () => {
  it('reads the committed tables: the rungs of HUNTING 5, the smoke bundle and the 3a rows, the first five kinds and a kind a family', () => {
    for (const id of ['stone', 'snare', 'smoke-bundle', 'sling', 'spear', 'bow', 'pit-trap']) expect(tool(id).status).not.toBe('proposed');
    expect(ladder.tools.filter((t) => t.source.includes('HUNT_FAMILIES 3a')).length).toBeGreaterThanOrEqual(30);
    for (const id of ['hare', 'carrion-crow', 'roe-deer', 'wolf', 'white-hart']) expect(kind(id).id).toBe(id);
    expect(new Set(ladder.kinds.map((k) => k.family)).size).toBe(ladder.families.length - 1);
  });

  it('throws on a bad row, naming where', () => {
    const bad = (edit: (r: ReturnType<typeof raw>) => void, msg: RegExp) => {
      const r = raw();
      edit(r);
      expect(() => loadLadder(r)).toThrow(msg);
    };
    bad((r) => (r.kinds[0]!.drops = [{ item: 'meat', qty: 1, share_pct: 60 }]), /kinds\.0\.drops: the shares must sum to 100/);
    bad((r) => (r.kinds[0]!.family = 'dragons'), /kinds\.0\.family: dragons is not a family/);
    bad((r) => (r.kinds[1]!.way_tools = { stalk: ['crossbow'] }), /kinds\.1\.way_tools\.stalk: crossbow is not a tool/);
    bad((r) => (r.kinds[0]!.take_s = 40.5), /kinds\.0\.take_s: must be a whole number/);
    bad((r) => (r.kinds[0]!.colour = 'sand'), /kinds\.0\.colour: is not a field of this row/);
    bad((r) => (r.kinds[0]!.group = [50, 0, 0, 0]), /kinds\.0\.group/);
    bad((r) => (r.kinds[3]!.after_fight = ['snare']), /kinds\.3\.after_fight: snare is not one of the kind's ways/);
    bad((r) => (r.tools[0]!.inputs = { 'core/unobtainium': 1 }), /tools\.0\.inputs\.core\/unobtainium/);
    bad((r) => (r.tools[0]!.status = 'someday'), /tools\.0\.status: must be one of/);
    bad((r) => (r.tools[0]!.ways = []), /tools\.0: a row that takes needs its ways and its sizes/);
    bad((r) => r.tools.push({ ...r.tools[0]! }), /is written twice/);
    bad((r) => (r.tools.find((t) => t.id === 'blunt-arrow')!.variant_of = 'catapult'), /variant_of: catapult is not a tool/);
    // a named tool that cannot serve its way would quietly close the way to every tool
    bad((r) => (r.kinds[1]!.way_tools = { stalk: ['snare'] }), /kinds\.1\.way_tools\.stalk: snare cannot serve the stalk way/);
    bad((r) => (r.kinds[0]!.drops = [{ item: 'meat', qty: 1, share_pct: 50 }, { item: 'meat', qty: 1, share_pct: 50 }]), /kinds\.0\.drops: a good is written twice/);
    // the habitat is a tag of the map; its tiles are counted, never typed
    bad((r) => (r.kinds[0]!.habitat_tag = 'swamp'), /kinds\.0\.habitat_tag: must be one of/);
    bad((r) => (r.kinds[0]!.habitat_tiles = 1010), /kinds\.0\.habitat_tiles: is not a field of this row/);
  });

  it('counts each kind\'s habitat on the map, solid tiles included, so a change of the map moves it', () => {
    const tiles = tagTiles(bundle.map);
    expect(kind('hare').habitat_tiles).toBe(tiles.meadow);
    expect(kind('carrion-crow').habitat_tiles).toBe(tiles.grove);
    expect(kind('white-hart').habitat_tiles).toBeNull();
    // every water tile is solid, and the trout still has its water
    const solidWater = bundle.map.ground.join('').split('').filter((ch) => bundle.map.legend[ch]?.tag === 'water' && bundle.map.legend[ch]?.solid).length;
    expect(solidWater).toBeGreaterThan(0);
    expect(kind('trout').habitat_tiles).toBeGreaterThanOrEqual(solidWater);
    // a map one meadow tile smaller: the hare's count follows it
    const y = bundle.map.ground.findIndex((row) => row.includes('.'));
    const ground = bundle.map.ground.map((row, i) => (i === y ? row.replace('.', ':') : row));
    const smaller = onMap(readLadder(), { ...bundle.map, ground });
    expect(smaller.kinds.find((k) => k.id === 'hare')!.habitat_tiles).toBe(tiles.meadow! - 1);
  });

  it('every content item a tool names exists in content', () => {
    for (const t of ladder.tools) for (const item of Object.keys(t.inputs)) if (item.startsWith('core/')) expect(bundle.items[item], `${t.id} ${item}`).toBeDefined();
  });
});

describe('the value of a catch', () => {
  it('effort index by tier: medium at tier 1, one up a tier, hard at most', () => {
    expect([1, 2, 3, 9].map(effortIndex)).toEqual([1, 2, 3, 3]);
  });

  it('dressing by size and the loop', () => {
    expect((['small', 'medium', 'large'] as const).map((s) => dressMs(s, p))).toEqual([9000, 18000, 36000]);
    expect(loopMs(kind('hare'), p)).toBe(49_000);
  });

  it('the per-good values are the solver\'s formula, and summed they are the catch within the rounding of the units', () => {
    for (const k of ladder.kinds) {
      const w = p.effort_permille[effortIndex(k.tier)]!;
      const t = loopMs(k, p);
      const b = rarityBonusMs(k, p);
      const goods = goodValues(k, p);
      for (const d of k.drops) expect(goods[d.item], `${k.id} ${d.item}`).toBe(Math.floor((d.share_pct * (w * t + 1000 * b)) / (100 * 1000 * d.qty)));
      const sum = k.drops.reduce((s, d) => s + goods[d.item]! * d.qty, 0);
      const units = k.drops.reduce((s, d) => s + d.qty, 0);
      expect(sum, k.id).toBeLessThanOrEqual(catchValue(k, p));
      expect(catchValue(k, p) - sum, k.id).toBeLessThan(units);
    }
  });

  it('value per second is the effort step of the tier', () => {
    for (const k of ladder.kinds) expect(valuePerSecond(k, p), k.id).toBe(p.effort_permille[effortIndex(k.tier)]);
  });

  it('a shop pays k * r * V / 1000', () => {
    expect(payForCatch(kind('hare'), p)).toBe(147_000);
    expect(payForCatch(kind('white-hart'), p)).toBe(930_000);
  });

  it('the rarity bonus is the solver\'s: only with spots, and capped by the budget', () => {
    const hare = kind('hare');
    expect(rarityBonusMs(hare, p)).toBe(0);
    expect(rarityBonusMs({ ...hare, rarity: 2 }, p)).toBe(p.rarity_bonus_ms[2]);
    const quick: KindRow = { ...hare, take_s: 1, rarity: 3 };
    // budget 100 permille of w * t = 600 * 10000 ms: 600 value-ms, under the legendary 1000
    expect(rarityBonusMs(quick, p)).toBe(Math.floor((p.rarity_budget_permille * 600 * 10_000) / 1_000_000));
    expect(rarityBonusMs(quick, p)).toBeLessThan(p.rarity_bonus_ms[3]!);
  });
});

describe('difficulty and rarity', () => {
  it('standing is at least 1 with any habitat, 0 with none, unknown without a tile count', () => {
    const hare = kind('hare');
    expect(standing({ ...hare, habitat_tiles: 1 })).toBe(1);
    expect(standing({ ...hare, habitat_tiles: 0 })).toBe(0);
    expect(standing(kind('white-hart'))).toBeNull();
    expect(standing(kind('carrion-crow'))).toBe(11);
  });

  it('the daily yield is standing over the refill, per 1000 tiles without a count', () => {
    expect(dailyYield(kind('wolf'))).toEqual({ num: 4, den: 3, per1000: false });
    expect(fmtRatio(5, 3)).toBe('1.67');
    expect(dailyYield(kind('white-hart'))).toEqual({ num: 12, den: 2, per1000: true });
  });

  it('the notice row is the gait\'s noise plus the ear', () => {
    expect(noticeRow(kind('hare'), p)).toEqual([4, 5, 7, 10]);
    expect(noticeRow(kind('carrion-crow'), p)).toEqual([2, 3, 5, 8]);
  });

  it('the rarity rank by cap over refill', () => {
    expect(['hare', 'white-hart', 'wild-boar', 'wolf'].map((id) => rarityRank(kind(id), p.rarity_rank_cuts))).toEqual([0, 1, 2, 3]);
  });

  it('the lowest tool and its grade shift', () => {
    expect(toolFor(kind('hare'), ladder.tools)).toMatchObject({ tool: { id: 'stone' }, gradeShift: 0 });
    // the stone takes small prey only (HUNTING 5): the roe's lowest is the snare at grade minus 1, the spear its first at grade 0
    expect(gradeShift(tool('stone'), kind('roe-deer'))).toBeUndefined();
    expect(toolFor(kind('roe-deer'), ladder.tools)).toMatchObject({ tool: { id: 'snare' }, gradeShift: -1 });
    expect(toolFor(kind('roe-deer'), ladder.tools, { atGrade0: true })?.tool.id).toBe('spear');
    // the crow's stalk names the sling, so the stone is not its tool
    expect(toolFor(kind('carrion-crow'), ladder.tools)?.tool.id).toBe('snare');
    // the hart is large: the bow is a grade short, the broad arrow (3a) takes it whole
    expect(gradeShift(tool('bow'), kind('white-hart'))).toBe(-1);
    expect(toolFor(kind('white-hart'), ladder.tools, { atGrade0: true })?.tool.id).toBe('broad-arrow');
    // an arrow larger than the animal is minus 1 too (9a)
    expect(gradeShift(tool('broad-arrow'), kind('ground-fowl'))).toBe(-1);
    // the foxes are the canids' take before the fight: a snare at the bait (BESTIARY_LANDS 3.1, 3.2)
    expect(toolFor(kind('silver-fox'), ladder.tools)).toMatchObject({ tool: { id: 'snare' }, gradeShift: 0 });
    expect(toolFor(kind('shade-fox'), ladder.tools)).toMatchObject({ tool: { id: 'snare' }, gradeShift: 0 });
    // the wolf waits for the fight; the boar's pit is a trap, so it stands before it
    expect(toolFor(kind('wolf'), ladder.tools)).toBeUndefined();
    expect(toolFor(kind('wolf'), ladder.tools, { afterFight: true })?.tool.id).toBe('pit-trap');
    expect(toolFor(kind('wild-boar'), ladder.tools)?.tool.id).toBe('pit-trap');
    // no strike on a defender before the fight: the adder's spear waits, its snare does not
    expect(toolFor(kind('dust-adder'), ladder.tools)?.tool.id).toBe('snare');
  });
});

/** The three matrices, pinned as the calculators compute them from the hunt pages; the readings they settle are listed in DECISIONS. */
describe('the pinned matrices', () => {
  it('matrix 1: the six tools of HUNTING 5 and the smoke bundle of HUNT_FAMILIES 3.1', () => {
    const pinned = [
      ['stone', 'T0', 3, true, false, 4, 1, 1],
      ['snare', 'T1', 0, false, true, 3, 1, 1],
      ['smoke-bundle', 'T2f', 1, false, false, 3, 1, 2],
      ['sling', 'T2', 6, true, false, 4, 1, 2],
      ['spear', 'T3', 4, true, false, 4, 2, 3],
      ['bow', 'T4', 8, true, false, 4, 3, 6],
      ['pit-trap', 'T5', 0, false, true, 5, 3, 6],
    ] as const;
    for (const [id, tier, range, unaware, passive, noise, craftTier, level] of pinned) {
      expect(tool(id), id).toMatchObject({ tier, range, unaware, passive, noise, craftTier, level });
    }
  });

  it('matrix 2: value per catch', () => {
    const rows = difficultyMatrix(ladder.kinds.slice(0, 5), ladder.tools, p);
    const pinned = [
      ['hare', 9000, 49000, 600, 29400, 600, 147000, { meat: 14700, hide: 11760, bone: 2940 }],
      ['carrion-crow', 9000, 39000, 600, 23400, 600, 117000, { feather: 23400 }],
      ['roe-deer', 18000, 108000, 600, 64800, 600, 324000, { meat: 9720, hide: 19440, bone: 6480, sinew: 4860 }],
      ['wolf', 18000, 168000, 1000, 168000, 1000, 840000, { hide: 84000, bone: 50400, meat: 33600 }],
      ['white-hart', 36000, 186000, 1000, 186000, 1000, 930000, { meat: 18600, hide: 46500, bone: 37200, sinew: 27900 }],
    ] as const;
    pinned.forEach(([id, dress, loop, w, value, perS, pay, goods], i) => {
      const r = rows[i]!;
      expect(r.id).toBe(id);
      expect([r.dress_ms, r.loop_ms, r.w, r.value, r.value_per_s, r.pay_mg]).toEqual([dress, loop, w, value, perS, pay]);
      expect(Object.fromEntries(r.goods.map((g) => [g.item, g.value]))).toEqual(goods);
    });
  });

  it('matrix 3: difficulty and rarity', () => {
    const rows = difficultyMatrix(ladder.kinds.slice(0, 5), ladder.tools, p);
    const pinned = [
      ['hare', [4, 5, 7, 10], 'stone', 0, 'stone', 11, [11, 1], 0, [100, 0, 0, 0]],
      ['carrion-crow', [2, 3, 5, 8], 'snare', 0, 'snare', 11, [11, 1], 0, [10, 50, 40, 0]],
      // the stone takes small prey only (HUNTING 5): the lowest is the snare (-1), the spear the first at 0
      ['roe-deer', [4, 5, 7, 10], 'snare', -1, 'spear', 11, [11, 1], 0, [0, 40, 60, 0]],
      // BEHAVIOUR 5.1.6 weights the wolf's pair: 30/60/10/0
      ['wolf', [4, 5, 7, 10], null, null, null, 4, [4, 3], 3, [30, 60, 10, 0]],
      // LANDS names only the bow for the hart's stalk, and the bow takes medium: the broad arrow (3a) takes it at 0
      ['white-hart', [4, 5, 7, 10], 'snare', -1, 'broad-arrow', null, [12, 2], 1, [0, 40, 60, 0]],
    ] as const;
    pinned.forEach(([id, notice, low, shift, g0, stand, daily, rank, group], i) => {
      const r = rows[i]!;
      expect(r.id).toBe(id);
      expect(r.notice).toEqual(notice);
      expect(r.lowest?.tool ?? null).toBe(low);
      expect(r.lowest?.shift ?? null).toBe(shift);
      expect(r.grade0?.tool ?? null).toBe(g0);
      expect(r.standing).toBe(stand);
      expect([r.daily.num, r.daily.den]).toEqual(daily);
      expect(r.rarity_rank).toBe(rank);
      expect(r.group).toEqual(group);
    });
  });
});

describe('the tiers', () => {
  it('reads the tier start, the craft chance by level and the value per second', () => {
    const t = tierTable(p, ladder.tools);
    expect(t.map((x) => x.min_level)).toEqual(bundle.params.tier_min_level);
    expect(t.map((x) => x.w)).toEqual([600, 800, 1000]);
    expect(t.map((x) => x.pay_per_s_mg)).toEqual([3000, 4000, 5000]);
    expect(t[0]!.chance_bp.every((c) => c === 10_000)).toBe(true);
    expect([craftChance(p, 2, 1), craftChance(p, 2, 3), craftChance(p, 3, 6), craftChance(p, 3, 1)]).toEqual([7000, 8000, 6500, 4000]);
    expect(t[1]!.tools).toContain('spear');
  });
});

describe('the gaps', () => {
  it('reports the families taken only after the fight and the one with no row, and no input from above its rung', () => {
    const gaps = ladderGaps(ladder);
    expect(gaps.filter((g) => g.what === 'input')).toEqual([]);
    // the canids are not a gap: the foxes are snared before the fight, though the wolf waits for it
    expect(gaps.filter((g) => g.what === 'family').map((g) => g.id)).toEqual(['raptors', 'horned-beasts', 'spiders', 'drakes']);
  });

  it('an input first had above the tool\'s rung is a gap', () => {
    const r = raw();
    r.tools.find((t) => t.id === 'sling')!.inputs = { 'core/reed-cord': 1, sinew: 1 };
    const l = loadLadder(r);
    l.materials['core/reed-cord'] = { rung: 3, source: 'test', proposed: false };
    const inputs = ladderGaps(l).filter((g) => g.what === 'input').map((g) => g.id);
    expect(inputs).toContain('sling');
    expect(inputs).toContain('snare');
  });
});

describe('the pay cap in value units (HUNTING 9)', () => {
  it('holds for every kind, and HUNTING 9\'s mg cap is 60 times under a tier-1 hunt', () => {
    const cap = payCap(ladder.kinds, p);
    expect(cap.every((c) => c.ok)).toBe(true);
    expect(cap.find((c) => c.id === 'hare')).toMatchObject({ base: 600, cap: 1000, capMg: 2450, payMg: 147_000, times: 60 });
    expect(cap.find((c) => c.id === 'wolf')!.times).toBe(100);
  });

  it('only a rarity bonus can pass it: the base rate is the tier\'s w, and a hard kind with a rare drop fails', () => {
    const [row] = payCap([{ ...kind('wolf'), rarity: 2 }], p);
    expect(row!.base).toBe(p.effort_permille[EFFORT_TIERS.length - 1]);
    expect(row!.withBonus).toBeGreaterThan(row!.cap);
    expect(row!.ok).toBe(false);
    const [easy] = payCap([{ ...kind('hare'), rarity: 2 }], p);
    expect(easy!.ok).toBe(true);
  });
});

describe('the experience audit', () => {
  it('reads the content\'s typed tables against the curve: handcraft level 2 is 4 s against 28 s, 14 percent', () => {
    const typed = bundle.professions['core/handcraft']!.xp_levels;
    const rows = xpAudit({ 'core/handcraft': typed }, rules.t1Ms, rules.ratioPermille);
    expect(rows).toHaveLength(typed.length);
    expect(rows[0]).toEqual({ profession: 'core/handcraft', level: 2, typed_ms: 4000, curve_ms: 28_000, ratio_permille: 142 });
    expect(rows[1]!.curve_ms).toBe(70_000);
    // below the curve at the start, over it at the top
    expect(rows[0]!.ratio_permille).toBeLessThan(1000);
    expect(rows.at(-1)!.ratio_permille).toBeGreaterThan(1000);
  });

  it('the proposal is the curve in whole seconds, rounded up, one threshold for each level from 2 to twenty (GROWTH 3.6)', () => {
    const levels: Record<string, number[]> = {};
    for (const id of Object.keys(bundle.professions)) levels[id] = bundle.professions[id]!.xp_levels;
    const steps = ladder.params.profession_levels - 1;
    expect(steps).toBe(19);
    const prop = xpProposal(levels, rules.t1Ms, rules.ratioPermille, steps);
    expect(prop.xp_levels).toHaveLength(steps);
    expect(prop.xp_levels.slice(0, 3)).toEqual([28, 70, 133]);
    const curve = thresholdsOf(rules.t1Ms, rules.ratioPermille, steps);
    prop.xp_levels.forEach((s, i) => {
      expect(s * 1000).toBeGreaterThanOrEqual(curve[i]!);
      expect(s * 1000 - curve[i]!).toBeLessThan(1000);
    });
    expect(prop.xp_levels.at(-1)!).toBeLessThanOrEqual(10_000_000);
  });
});

describe('the page', () => {
  it('the committed page and the proposed table equal what the calculators print (pnpm exec tsx tools/src/balance/hunt-ladder-cli.ts --write)', () => {
    const out = ladderOutputs(bundle, rules);
    expect(readFileSync(MARKDOWN_FILE, 'utf8')).toBe(out.markdown);
    expect(readFileSync(XP_FILE, 'utf8')).toBe(out.xpJson);
  });
});
