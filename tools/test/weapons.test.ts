/**
 * The weapon matrix report (tools/src/balance/weapons.ts): the source loads, the default variant passes every check
 * of WEAPON_MATRIX 13, every variant's WM-COUNT verdict reads as section 10 prints, the counts, the page's quoted
 * blocks against the print, the built recipes in the extended bands, the copied built values against the bundle, and
 * one fixture mutation per check family that fails with its own message.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type Built,
  PARAMS_FILE,
  VARIANTS,
  WEAPON_PAGE_FILE,
  WEAPON_SOURCE_FILE,
  type WeaponSource,
  type Variant,
  bandCounts,
  bandOf,
  builtFromWorld,
  builtRaw,
  loadSource,
  makeCtx,
  pageBlocks,
  readSource,
  weaponsOutputs,
} from '../src/balance/weapons';
import { loadWorld } from '../src/balance/world';

let built: Built;
let source: WeaponSource;
const raw = (): WeaponSource => JSON.parse(readFileSync(WEAPON_SOURCE_FILE, 'utf8')) as WeaponSource;
const run = (src: WeaponSource, variant: Variant = 'default', tables = false) => weaponsOutputs(loadSource(src), built, { variant, tables });
const anchored = (src: WeaponSource): string[] => Object.entries(src.params.built).filter(([, s]) => s.at.startsWith('content/core/params.json:')).map(([k]) => k);
/** The mutation's own message is among the errors (other checks may fail beside it). */
function expectError(src: WeaponSource, re: RegExp, variant: Variant = 'default'): void {
  const { errors } = run(src, variant);
  expect(errors.some((e) => re.test(e)), `no error matches ${re}\n${errors.join('\n')}`).toBe(true);
}

const VERDICT_LINES: Record<Variant, string> = {
  default: 'default: 70 / 337 (in the direction)',
  'stop-at-9': 'stop-at-9: 70 / 290 (T4-10 under 300: leaves the direction)',
  'no-crossbows': 'no-crossbows: 70 / 306 (in the direction)',
  'rate-10-3000': 'rate-10-3000: 70 / 337 (in the direction); 38 tier-10 hands repeat their tier-9 block',
  'all-to-10': 'all-to-10: 72 / 389 (T4-10 over 350: leaves the direction)',
  'freeze-at-5': "freeze-at-5: 70 / 337 (in the direction); 194 of 198 tier 6-10 hands repeat an earlier tier's block of their form",
};

beforeAll(() => {
  const { bundle, params } = loadWorld();
  built = builtFromWorld(bundle, params, readFileSync(PARAMS_FILE, 'utf8'));
  source = readSource();
});

describe('the source', () => {
  it('loads: 49 forms, 9 part rows, 6 ammunition rows, 44 hit ties, 14 built values (12 anchored in params.json)', () => {
    expect(source.forms).toHaveLength(49);
    expect(source.parts).toHaveLength(9);
    expect(source.ammo).toHaveLength(6);
    expect(source.params.matrix.hit_ties_open.pairs).toHaveLength(44);
    expect(Object.keys(source.params.built)).toHaveLength(14);
    expect(anchored(source)).toHaveLength(12);
  });

  it('refuses a form of an unknown class and a tie that is not a triple', () => {
    const bad = raw();
    bad.forms[0]!.class = 'wand';
    expect(() => loadSource(bad)).toThrow(/forms\[0\]\.class: unknown class wand/);
    const bad2 = raw();
    (bad2.params.matrix.hit_ties_open.pairs as unknown[]).push([1, 'a']);
    expect(() => loadSource(bad2)).toThrow(/hit_ties_open\.pairs\[44\]: is \[tier, a, b\]/);
  });

  it('reads the content: 22 built recipes, the Handcraft top at 9, the 12 anchored values in the bundle', () => {
    expect(built.recipes).toHaveLength(22);
    expect(built.tops.get('handcraft')).toBe(9);
    const ctx = makeCtx(source, 'default', built);
    for (const name of anchored(source)) {
      expect(JSON.stringify(builtRaw(ctx, name)), name).toBe(JSON.stringify(source.params.built[name]!.value));
      const line = Number(/:(\d+)/.exec(source.params.built[name]!.at)![1]);
      expect(built.lines[line - 1], `${name} at line ${line}`).toContain(`"${name}"`);
    }
  });
});

describe('the default variant', () => {
  it('passes every check: WM-BLOCK, WM-CLAMP, WM-HITS, WM-TRY-SET, WM-BUILT and WM-COUNT included', () => {
    const report = run(source);
    expect(report.errors).toEqual([]);
    expect(report.notes.checksRun).toHaveLength(35);
    expect(report.notes.builtCompared).toBe(12);
    expect(report.notes.builtRecipes).toBe(22);
    expect(report.notes.hitTies).toBe(44);
    expect(report.notes.launcherPairs).toBe(732);
    expect(report.notes.taughtDups).toHaveLength(7);
    expect(report.notes.taughtDups[0]).toBe('bow-stave = club (workshop)');
  });

  it('counts 70 rows at tiers 1 to 3 and 337 at tiers 4 to 10, 407 in all, by class as the page states', () => {
    const report = run(source);
    expect(report.rows).toHaveLength(407);
    expect(bandCounts(report.counts)).toEqual([70, 337]);
    expect(report.counts.get('T1-3 hand')).toBe(52);
    expect(report.counts.get('T4-10 hand')).toBe(274);
    expect(report.text).toContain('T1-3: 52 hands + 8 parts + 10 ammunition = 70\nT4-10: 274 hands + 28 parts + 35 ammunition = 337\n');
    expect(report.text).toContain('band    blade  blunt  spear  staff    bow thrown  sling\nT1-3       11     11      5      9      2      8      6\nT4-10      68     44     36     32     41     25     28\n');
  });

  it('reads the hits of WEAPONS 4 at the built bare_base: T1 standard 10, T1 heavy 12, T2 standard 11, T3 standard 13 to 14', () => {
    const { text } = run(source);
    expect(text).toContain('matrix hands: T1 standard 10; T1 heavy 12; T2 standard 11; T3 standard 13 to 14; T3 bow, top shot 13');
    expect(text).toContain('bare hands 8 a hit: T1 exactly 2 hits (9 to 16 health); T2 6 to 8 hits (41 to 64 health); T3 20 to 30 hits (153 to 240 health)');
  });

  it('keeps every built recipe inside the extended Handcraft band of its output tier', () => {
    const ctx = makeCtx(source, 'default', built);
    for (const r of built.recipes) {
      const t = Math.max(1, ...r.outputs.map((o) => built.items.get(o) ?? 1));
      const [lo, hi] = bandOf(ctx, t, 'handcraft');
      expect(r.level >= lo && r.level <= hi, `${r.id}: tier ${t} level ${r.level} in ${lo}-${hi}`).toBe(true);
    }
  });
});

describe('the variants', () => {
  it('print their WM-COUNT verdicts as section 10 states', () => {
    const lines = run(source).variants;
    expect(lines.map((v) => v.line)).toEqual(VARIANTS.map((v) => VERDICT_LINES[v]));
  });

  it('default, no-crossbows and rate-10-3000 pass; stop-at-9 fails WM-COUNT alone', () => {
    expect(run(source, 'no-crossbows').errors).toEqual([]);
    expect(run(source, 'rate-10-3000').errors).toEqual([]);
    expect(run(source, 'stop-at-9').errors).toEqual(['WM-COUNT: variant stop-at-9: 70 / 290, T4-10 under 300: leaves the direction']);
  });

  it('all-to-10 leaves 12 new hit ties and the counts; freeze-at-5 leaves 20 new hit ties', () => {
    const tie = /^WM-BLOCK: tier \d+: \S+ matches or beats \S+ in hits at bare_base 8 \(not listed in hit_ties_open\)$/;
    const all = run(source, 'all-to-10').errors;
    expect(all).toHaveLength(13);
    expect(all.slice(0, 12).every((e) => tie.test(e))).toBe(true);
    expect(all[12]).toBe('WM-COUNT: variant all-to-10: 72 / 389, T4-10 over 350: leaves the direction');
    const frozen = run(source, 'freeze-at-5').errors;
    expect(frozen).toHaveLength(20);
    expect(frozen.every((e) => tie.test(e))).toBe(true);
  });
});

describe('the page', () => {
  it('quotes the report: every fenced text block of WEAPON_MATRIX.md is in the --tables print', () => {
    const blocks = pageBlocks(readFileSync(WEAPON_PAGE_FILE, 'utf8'));
    expect(blocks).toHaveLength(11);
    const { text } = run(source, 'default', true);
    for (const b of blocks) expect(text, b.split('\n')[0]).toContain(b);
    expect(text.endsWith('\n-- checks: 0 errors\n')).toBe(true);
  });
});

describe('a mutation fails its own check', () => {
  it('ids and family words', () => {
    const src = raw();
    src.forms[0]!.ids = { '1': 'Flint Knife' };
    expectError(src, /^Flint Knife: id or family word out of pattern \(schema\/src\/index\.ts:18, :117\)$/);
  });

  it('inputs known', () => {
    const src = raw();
    src.forms[0]!.early!['1'] = ['mithril', 'branch', 'reed-cord'];
    expectError(src, /^flint-knife: unknown inputs \['mithril'\]$/);
  });

  it('one-tier climb', () => {
    const src = raw();
    src.forms[0]!.early!['3'] = ['flint', 'branch', 'roe-hide'];
    expectError(src, /^fang-knife: tier 3 from a highest input of tier 1 \(climb, tools\/src\/check\.ts:421\)$/);
  });

  it('level in the band', () => {
    const src = raw();
    src.params.matrix.tier_min_level[2] = 2;
    expectError(src, /^\S+: level \d+ outside band 3-1$/);
  });

  it('Handcraft top', () => {
    const src = raw();
    src.params.matrix.tier_min_level = [1, 3, 10, 12, 14, 16, 18, 20, 20, 20];
    expectError(src, /^fang-knife: Handcraft stops at level 9 \(tools\/src\/check\.ts:429\)$/);
  });

  it('metal only by Smithing', () => {
    const src = raw();
    src.forms.find((f) => f.form === 'glaive')!.late = ['log', '@bar', 'sinew-cord'];
    expectError(src, /^bronze-glaive: takes metal \['bronze-bar'\] outside Smithing$/);
  });

  it('bows, staves and spears past tier 3 by Woodcraft', () => {
    const src = raw();
    src.forms.find((f) => f.form === 'glaive')!.make = ['woodcraft', 'smithing'];
    expectError(src, /^bronze-glaive: a bow, staff or spear past tier 3 is Woodcraft's$/);
  });

  it('share floor', () => {
    const src = raw();
    src.params.matrix.price.feel.snap = 300;
    expectError(src, /^flint-knife: price 325 under the share floor$/);
  });

  it('block field bounds', () => {
    const src = raw();
    src.params.matrix.noise.loud = 14;
    expectError(src, /^flint-hatchet: block \('quick', 7, 1, 12, None, None, 14\) out of the field bounds$/);
  });

  it('WM-GRID: the wind-up from bare_windup_t', () => {
    const src = raw();
    src.params.matrix.feels.quick.snap = 2;
    expectError(src, /^flint-knife: wind-up 2 outside bare_windup_t 3 to swing_quick_t 8$/);
  });

  it('harm under the cell', () => {
    const src = raw();
    src.params.matrix.price.feel.snap = -100;
    expectError(src, /^fang-knife: harm 68 over its cell 64$/);
  });

  it('launcher harm 0 or more', () => {
    const src = raw();
    src.params.matrix.price.noise.plain = 600;
    expectError(src, /^sling: launcher harm below 0$/);
  });

  it('sold only at tier 1', () => {
    const src = raw();
    src.forms[1]!.sold = true;
    expectError(src, /^tusk-dagger: sold at tier 2$/);
  });

  it('start only at tier 1', () => {
    const src = raw();
    src.forms[1]!.teach = 'start';
    expectError(src, /^tusk-dagger: start-known above tier 1$/);
  });

  it('one block per tier', () => {
    const src = raw();
    const cudgel = src.forms.find((f) => f.form === 'cudgel')!;
    cudgel.feel = 'snap';
    cudgel.noise = 'plain';
    expectError(src, /^tier 1: stone-cudgel and flint-knife share a block$/);
  });

  it('WM-BLOCK: a tie in hits not listed', () => {
    const src = raw();
    src.params.matrix.hit_ties_open.pairs.shift();
    expectError(src, /^WM-BLOCK: tier 1: flint-knife matches or beats flint-hatchet in hits at bare_base 8 \(not listed in hit_ties_open\)$/);
  });

  it('WM-BLOCK: a listed tie that no longer ties', () => {
    const src = raw();
    src.params.matrix.hit_ties_open.pairs.push([1, 'flint-hatchet', 'flint-knife']);
    expectError(src, /^WM-BLOCK: hit_ties_open lists tier 1 flint-hatchet over flint-knife, which no longer ties: drop it$/);
  });

  it('WM-CLAMP: the exception at caps 1000 and 1100', () => {
    const src = raw();
    src.params.matrix.clamp.cap_exception = [];
    expectError(src, /^WM-CLAMP: tier 1, power cap 1000: \S+ matches or beats \S+ after the clamp$/);
  });

  it("WM-HITS: the source's hand hits", () => {
    const src = raw();
    src.params.matrix.anchors.hands.t1_standard = [9, 9];
    expectError(src, /^WM-HITS: t1_standard hits 10 to 10 from the matrix, the source says \[9, 9\]$/);
  });

  it("WM-HITS: #598's bands in health", () => {
    const src = raw();
    src.params.matrix.anchors.band_health['2'] = [40, 64];
    expectError(src, /^WM-HITS: T2 band 6 to 8 bare-hand hits is 41 to 64 health at bare_base 8, not \[40, 64\]$/);
  });

  it('skeleton swap', () => {
    const src = raw();
    src.forms[0]!.early!['3'] = ['greenstone', 'bone-handle', 'roe-hide'];
    expectError(src, /^fang-knife: swaps 3 items from slate-knife \(skeleton\)$/);
  });

  it('tier gap in a row', () => {
    const src = raw();
    const shafts = src.parts.find((p) => p.part === 'arrow-shafts')!;
    src.parts.push({ ...shafts, tiers: [3, 3], ids: { '3': 'arrow-shafts' }, early: { '3': ['branch'] } });
    expectError(src, /^arrow-shafts: tier gap 1 to 3$/);
  });

  it('close rate at or over the bare hand', () => {
    const src = raw();
    src.params.matrix.price.feel.even = 400;
    expectError(src, /^quarterstaff: close rate under the bare hand$/);
  });

  it('WM-BLOCK: no dominance in harm', () => {
    const src = raw();
    src.params.matrix.price.noise.hushed = 0;
    expectError(src, /^WM-BLOCK: tier 2: tusk-dagger matches or beats slate-knife in harm$/);
  });

  it('teacher sizes and tiers', () => {
    const src = raw();
    src.teachers.cache!.max = 1;
    expectError(src, /^teacher cache: 4 entries, at most 1$/);
    const src2 = raw();
    src2.teachers['q-forge-4']!.tiers = [5, 5];
    expectError(src2, /^teacher q-forge-4: sword enters at tier 4, outside \[5, 5\]$/);
  });

  it('WM-TRY-SIZE', () => {
    const src = raw();
    src.forms[0]!.late = ['@bar', 'branch', 'reed-cord', 'roe-hide', 'hare-hide'];
    expectError(src, /^WM-TRY-SIZE: bronze-knife has 5 distinct inputs$/);
  });

  it('WM-TRY-SET', () => {
    const src = raw();
    src.forms[0]!.late = ['@bar', 'bone-handle'];
    expectError(src, /^WM-TRY-SET: bronze-knife, bronze-dagger share one input set at the forge$/);
  });

  it('every ammunition has a launcher, every launcher a shot', () => {
    const src = raw();
    src.forms = src.forms.filter((f) => f.ammo !== 'bolt');
    expectError(src, /^bronze-broad-bolts: no launcher of tier 4 or more fires it$/);
    const src2 = raw();
    src2.ammo = src2.ammo.filter((a) => a.class !== 'arrow');
    expectError(src2, /^bow: nothing to fire$/);
  });

  it('range with range_add at most 12', () => {
    const src = raw();
    src.ammo.find((a) => a.ammo === 'shot')!.range_add = 5;
    expectError(src, /^wolf-long-sling \+ shaped-stones: range over 12$/);
  });

  it('duals', () => {
    const src = raw();
    src.forms.find((f) => f.form === 'greatsword')!.dual = 6;
    expectError(src, /^duals \[\('greatsword', 6\), \('spear', 2\), \('bow', 3\), \('sling', 1\)\]: over dual_use_max or past tool\.tier 5$/);
  });

  it('Q-5 coverage per tier', () => {
    const src = raw();
    src.forms.find((f) => f.form === 'quarterstaff')!.tempo = 'quick';
    expectError(src, /^tier 1: Q-5 coverage fails \(\['heavy', 'quick'\], wind-ups \d+-\d+\)$/);
  });

  it('the first slice', () => {
    const src = raw();
    const rows = src.first_slice.rows;
    rows['flint-blade'] = rows['flint-knife']!;
    delete rows['flint-knife'];
    expectError(src, /^first slice flint-blade: no matrix row$/);
  });

  it('WM-BUILT: a copied value', () => {
    const src = raw();
    src.params.built.bare_base!.value = 9;
    expectError(src, /^WM-BUILT: bare_base: the source says 9, content says 8$/);
  });

  it('WM-BUILT: a copied bound and an anchor that names another line', () => {
    const src = raw();
    src.params.built.bare_base!.max = 20;
    expectError(src, /^WM-BUILT: bare_base: max 20 in the source, 16 in content$/);
    const src2 = raw();
    src2.params.built.bare_base!.at = 'content/core/params.json:1141';
    expectError(src2, /^WM-BUILT: bare_base: content\/core\/params\.json:1141 does not name it \(the line reads: .*\)$/);
  });

  it('WM-COUNT', () => {
    const src = raw();
    src.params.matrix.counts_target.tiers_1_3 = [71, 80];
    expectError(src, /^WM-COUNT: variant default: 70 \/ 337, T1-3 under 71: leaves the direction$/);
  });
});
