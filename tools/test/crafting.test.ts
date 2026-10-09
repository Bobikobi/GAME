/**
 * The crafting grammar and its check (DECISIONS.md, 2026-10-09): classes and
 * tiers on items, recipe templates, the level bands, station tiers, one craft
 * profession per station, gated high tiers, the world's rarity budget and
 * the average try (DECISIONS.md, 2026-10-09: the crafting economy).
 * Each world is a copy of the core with a few files added, edited or removed.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CampFile, ParamsFile, ProfessionFile, ShopFile } from '@game/schema';
import { missOutcome, recipeProfession, recipeTier } from '@game/kernel';
import { afterAll, describe, expect, it } from 'vitest';
import { classFits } from '../src/assemble';
import { type CheckResult, runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

type Edit = (root: string) => void;

/** A copy of the core world plus the files of the creator "tester", with some core files edited. */
function world(files: Record<string, object>, edits: Edit[] = []): CheckResult {
  const root = mkdtempSync(join(tmpdir(), 'mistvale-crafting-'));
  roots.push(root);
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });
  for (const [rel, data] of Object.entries(files)) {
    const abs = rel.startsWith('core/') ? join(root, rel) : join(root, 'extensions', 'tester', rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(data, null, 2));
  }
  for (const edit of edits) edit(root);
  return runCheck(root);
}

function editCore<T>(rel: string, change: (data: T) => void): Edit {
  return (root) => {
    const abs = join(root, 'core', rel);
    const data = JSON.parse(readFileSync(abs, 'utf8')) as T;
    change(data);
    writeFileSync(abs, JSON.stringify(data, null, 2));
  };
}

function removeCore(...rels: string[]): Edit {
  return (root) => {
    for (const rel of rels) rmSync(join(root, 'core', rel));
  };
}

/** The core's workshop: its profession, the three parts that climb by upgrades, and what is made there. */
const CORE_WORKSHOP = [
  'professions/handcraft.json',
  'camp/work-stone.json',
  'camp/workbench.json',
  'camp/workshop.json',
  'recipes/stone-flakes.json',
  'recipes/stone-blade.json',
  'recipes/flint-trowel.json',
  'recipes/stone-trowel.json',
  'recipes/reed-cord.json',
  'recipes/woven-mat.json',
  'recipes/reed-basket.json',
  'recipes/fine-basket.json',
  'recipes/reed-hat.json',
  'recipes/reed-sandals.json',
  'recipes/lucky-charm.json',
  'templates/dye-cord.json',
];

const errors = (r: CheckResult) => r.issues.filter((i) => i.level === 'error');
const messages = (r: CheckResult) => errors(r).map((i) => i.message);

const envelope = (type: string, name: string, title = name) => ({ format: 1, type, id: `tester/${name}`, title, creator: 'tester' });
const item = (name: string, extra: object = {}) => ({
  id: `tester/${name}`,
  name,
  kind: 'material',
  rarity: 'common',
  class: 'plant',
  tier: 1,
  sprite: 'core/base-kit:items/herb',
  ...extra,
});
const items = (...list: object[]) => ({ ...envelope('items', 'items'), items: list });
const recipe = (name: string, body: object) => ({
  ...envelope('recipe', name),
  recipe: { station: 'fire', active_ms: 4000, level: 1, known: 'start', ...body },
});
const template = (name: string, body: object, title = name) => ({
  ...envelope('template', name, title),
  template: { station: 'fire', active_ms: 4000, level: 1, ...body },
});
const out = (name: string) => [{ item: `tester/${name}`, qty: 1, share_pct: 100 }];
const camp = (name: string, body: object) => ({
  ...envelope('camp', name),
  camp: { slot: 'workshop', inputs: [{ item: 'core/branch', qty: 2 }], active_ms: 3000, sprite: 'core/base-kit:props/chest', ...body },
});
/** A node in the one empty resource slot, giving `output`. */
const node = (output: object, body: object = {}) => ({
  ...envelope('resource', 'nodes'),
  items: [output],
  node: {
    output: (output as { id: string }).id,
    yield: 1,
    active_ms: 3000,
    respawn_ms: 60000,
    count: 2,
    sprite: 'core/base-kit:props/bush_berry',
    level: 1,
    place: { slot: 'core/west-glade' },
    ...body,
  },
});

describe('classFits', () => {
  const classes = { 'x/stone-fruit': { id: 'x/stone-fruit', name: 'Stone fruit', base: 'plant' as const, creator: 'x', file: 'f' } };
  it('a base class takes its own items and the classes declared under it', () => {
    expect(classFits(classes, 'plant', 'plant')).toBe(true);
    expect(classFits(classes, 'x/stone-fruit', 'plant')).toBe(true);
    expect(classFits(classes, 'x/stone-fruit', 'wood')).toBe(false);
  });
  it('a declared class takes only its own items', () => {
    expect(classFits(classes, 'x/stone-fruit', 'x/stone-fruit')).toBe(true);
    expect(classFits(classes, 'plant', 'x/stone-fruit')).toBe(false);
    expect(classFits(classes, undefined, 'plant')).toBe(false);
  });
});

describe('a world that uses the grammar', () => {
  const result = world(
    {
      'items.json': {
        ...items(
          item('dried-herbs', { family: 'dried' }),
          item('rope', { class: 'fibre', tier: 2 }),
          item('sloe-jam', { class: 'meal', kind: 'food', food: { satiety: 10 } }),
        ),
        classes: [{ id: 'tester/stone-fruit', name: 'Stone fruit', base: 'plant' }],
      },
      'resources/sloes.json': node(item('sloe', { class: 'tester/stone-fruit', family: 'sloe', kind: 'food', food: { satiety: 3 } })),
      'templates/dried-herbs.json': template(
        'dry-herbs',
        { inputs: [{ class: 'plant', family: 'herb', min_tier: 1, qty: 2 }], outputs: out('dried-herbs') },
        'Dried herbs',
      ),
      'templates/herb-mix.json': template('herb-mix', {
        inputs: [
          { item: 'core/herb', qty: 1 },
          { class: 'plant', family: 'herb', min_tier: 1, qty: 2 },
        ],
        outputs: out('dried-herbs'),
      }),
      'templates/jam.json': template('jam', {
        inputs: [{ class: 'plant', family: 'sloe', min_tier: 1, qty: 3 }],
        outputs: out('sloe-jam'),
        miss: { keep_pct: 30 },
      }),
      'recipes/rope.json': recipe('rope', { level: 3, inputs: [{ item: 'tester/dried-herbs', qty: 2 }], outputs: out('rope') }),
    },
    [
      editCore<CampFile>('camp/campfire.json', (d) => {
        d.camp.tier = 2;
      }),
    ],
  );
  const b = result.assembled.bundle!;

  it('passes the check', () => {
    expect(errors(result)).toEqual([]);
  });

  it('expands a template into one known recipe per fitting item, in id order', () => {
    const made = Object.values(b.recipes).filter((r) => r.template === 'tester/dry-herbs');
    expect(made.map((r) => r.id)).toEqual(['tester/dry-herbs+core/herb', 'tester/dry-herbs+core/sunleaf']);
    const herb = b.recipes['tester/dry-herbs+core/herb']!;
    expect(herb.title).toBe('Dried herbs (Wild herb)');
    expect(herb.known).toBe('start');
    expect(herb.inputs).toEqual([{ item: 'core/herb', qty: 2 }]);
    expect(herb.file).toBe(result.assembled.origin['tester/dry-herbs']);
    expect(b.values['tester/dried-herbs']).toBeGreaterThan(0);
  });

  it('merges an item that fills a fixed input and a class input', () => {
    expect(b.recipes['tester/herb-mix+core/herb']!.inputs).toEqual([{ item: 'core/herb', qty: 3 }]);
    expect(b.recipes['tester/herb-mix+core/sunleaf']!.inputs).toEqual([
      { item: 'core/herb', qty: 1 },
      { item: 'core/sunleaf', qty: 2 },
    ]);
  });

  it('a base class takes the items of a class declared under it', () => {
    expect(b.classes['tester/stone-fruit']?.base).toBe('plant');
    expect(b.recipes['tester/jam+tester/sloe']?.inputs).toEqual([{ item: 'tester/sloe', qty: 3 }]);
  });

  it('names a template\'s recipes with "+", which no written id holds, so two never meet', () => {
    const made = Object.values(b.recipes).filter((r) => r.template);
    for (const r of made) expect(r.id).toMatch(/^[a-z0-9_-]+\/[a-z0-9_-]+(\+[a-z0-9_-]+\/[a-z0-9_-]+)+$/);
    for (const r of Object.values(b.recipes).filter((r) => !r.template)) expect(r.id).not.toContain('+');
  });

  it('gives a template\'s recipes its miss', () => {
    expect(b.recipes['tester/jam+tester/sloe']?.miss).toEqual({ keep_pct: 30 });
  });

  it('a tier-2 recipe passes at a tier-2 station and its work is weighed as hard', () => {
    // V(rope) = w * t / 1000 + 2 * V(dried herbs), with t = 4000 ms
    expect(b.values['tester/rope']! - 2 * b.values['tester/dried-herbs']!).toBe(b.params.effort_permille.hard * 4);
  });
});

describe('a world that wears, misses and builds over a part', () => {
  const garment = (name: string, wear: object, extra: object = {}) => item(name, { class: 'garment', wear, ...extra });
  const result = world({
    'items.json': items(
      garment('cap', { slot: 'head', effects: [{ effect: 'gather_speed_pct', value: 5 }], set: 'tester/field' }),
      garment('smock', {
        slot: 'top',
        effects: [
          { effect: 'gather_speed_pct', value: 3 },
          { effect: 'craft_speed_pct', value: 2 },
        ],
        set: 'tester/field',
      }),
      item('ring', { class: 'jewelry', wear: { slot: 'jewelry', effects: [{ effect: 'craft_chance_pct', value: 5 }] } }),
      garment('crown', { slot: 'head', look: true }, { premium_later: true }),
      item('plank', { class: 'wood', tier: 2 }),
      item('shavings', { class: 'wood' }),
    ),
    'recipes/cap.json': recipe('cap', { inputs: [{ item: 'core/herb', qty: 2 }], outputs: out('cap') }),
    'recipes/smock.json': recipe('smock', { inputs: [{ item: 'core/herb', qty: 3 }], outputs: out('smock') }),
    'recipes/ring.json': recipe('ring', { inputs: [{ item: 'core/stone', qty: 2 }], outputs: out('ring') }),
    'recipes/crown.json': recipe('crown', { inputs: [{ item: 'core/herb', qty: 4 }], outputs: out('crown') }),
    'recipes/shavings.json': recipe('shavings', { station: 'workshop', inputs: [{ item: 'core/branch', qty: 1 }], outputs: out('shavings') }),
    'recipes/plank.json': recipe('plank', {
      station: 'workshop',
      level: 3,
      inputs: [{ item: 'core/branch', qty: 4 }],
      outputs: out('plank'),
      miss: { keep_pct: 25 },
    }),
    'camp/bench.json': camp('bench', { provides: 'workshop' }),
    'camp/bench-2.json': camp('bench-2', { provides: 'workshop', tier: 2, upgrades: 'tester/bench' }),
  });
  const b = result.assembled.bundle!;

  it('passes the check', () => {
    expect(errors(result)).toEqual([]);
  });

  it('gives each station its craft profession; the craft verb is the one at the fire', () => {
    expect(b.stations).toEqual({ fire: 'core/cooking', workshop: 'core/handcraft' });
    expect(b.verbs.craft).toBe('core/cooking');
    // a creator's recipe at the workshop is gated and trained by the core's handcraft
    expect(recipeProfession(b, b.recipes['tester/plank']!)).toBe('core/handcraft');
    expect(recipeProfession(b, b.recipes['tester/cap']!)).toBe('core/cooking');
  });

  it('keeps the miss: a quarter of the inputs and nothing else', () => {
    expect(missOutcome(b, b.recipes['tester/plank']!)).toEqual({ keep: [{ item: 'core/branch', qty: 1 }] });
  });
});

describe('worn items the check refuses', () => {
  const garment = (name: string, wear: object, extra: object = {}) => item(name, { class: 'garment', wear, ...extra });
  const result = world({
    'items.json': items(
      item('tunic', { class: 'garment' }),
      item('belt', { class: 'garment', wear: { slot: 'jewelry' } }),
      item('amulet', { class: 'jewelry', wear: { slot: 'head' } }),
      garment('glove', { slot: 'hand' }),
      item('pie', { class: 'meal', kind: 'food', food: { satiety: 3 }, wear: { slot: 'head' } }),
      garment('veil', { slot: 'head', look: true, effects: [{ effect: 'rare_find_pct', value: 2 }], set: 'tester/veils' }),
      garment('boots', {
        slot: 'feet',
        effects: [
          { effect: 'gather_speed_pct', value: 9 },
          { effect: 'gather_speed_pct', value: 1 },
        ],
      }),
      garment('hat', { slot: 'head', set: 'tester/lonely' }),
      garment('scarf', { slot: 'top', set: 'core/borrowed' }),
      garment('hood', { slot: 'head', set: 'tester/crowd' }),
      garment('helm', { slot: 'head', set: 'tester/crowd' }),
      item('badge', { class: 'jewelry', wear: { slot: 'jewelry', effects: [{ effect: 'craft_chance_pct', value: 1 }] }, premium_later: true }),
      item('pin', { premium_later: true }),
      item('tiara', { class: 'jewelry', wear: { slot: 'jewelry', look: true }, premium_later: true }),
    ),
  });
  const said = messages(result);

  it('a garment or jewelry piece that is not worn, or worn in the wrong place', () => {
    expect(said).toContain('a garment piece is worn: give it "wear" with its slot (G44)');
    expect(said).toContain('the jewelry places take items of class "jewelry"');
    expect(said).toContain('the head takes items of class "garment"');
    expect(said).toContain('the hand holds a tool: an item of kind "tool"');
    expect(said).toContain('a food is not worn');
  });
  it('a look with effects or a set', () => {
    expect(said).toContain('a look shows and counts for nothing: it has no effects (G44)');
    expect(said).toContain('a look belongs to no set');
  });
  it('an effect over the cap of its tier, or named twice', () => {
    expect(said).toContain('a tier 1 piece gives at most 5% (wear_effect_max_pct), not 9% (G44)');
    expect(said).toContain('gather_speed_pct is named twice: each effect once');
  });
  it('a set of one piece, of another creator, or that cannot be worn whole', () => {
    expect(said).toContain('the set "tester/lonely" has one piece: a set has two at least');
    expect(said).toContain('a set holds one creator\'s pieces: its id starts with "tester/"');
    expect(said).toContain('the set "tester/crowd" cannot be worn whole: too many pieces for the head (G44)');
  });
  it('the premium marker anywhere but on an obtainable look with no effect', () => {
    expect(said.filter((m) => m === 'only a look item with no effect may carry the premium marker (G39)')).toHaveLength(2);
    expect(said.some((m) => m.startsWith('a look with the premium marker stays obtainable in the game'))).toBe(true);
  });
});

describe('misses and camp upgrades the check refuses', () => {
  const result = world({
    'items.json': items(item('paste')),
    // a cheaper road makes the same paste, so what the greedy recipe's miss keeps is worth more than a paste
    'recipes/paste.json': recipe('paste', { inputs: [{ item: 'core/herb', qty: 1 }], outputs: out('paste') }),
    'recipes/greedy.json': recipe('greedy', {
      inputs: [{ item: 'core/herb', qty: 10 }],
      outputs: out('paste'),
      miss: { keep_pct: 90 },
    }),
    'camp/shed.json': camp('shed', { slot: 'storage', bag_bonus: 12, upgrades: 'core/campfire' }),
    'camp/chest.json': camp('chest', { slot: 'storage', bag_bonus: 5, upgrades: 'core/storage-chest' }),
    'camp/loop-a.json': camp('loop-a', { provides: 'workshop', upgrades: 'tester/loop-b' }),
    'camp/loop-b.json': camp('loop-b', { provides: 'workshop', upgrades: 'tester/loop-a' }),
    'camp/high.json': camp('high', { slot: 'shelf', bag_bonus: 2, tier: 2 }),
    'camp/low.json': camp('low', { slot: 'shelf', bag_bonus: 2, upgrades: 'tester/high' }),
    'camp/ghost.json': camp('ghost', { slot: 'shelf', bag_bonus: 2, upgrades: 'tester/none' }),
  });
  const said = messages(result);

  it('a miss worth as much as a success, when a cheaper road makes the same thing', () => {
    expect(said.some((m) => /^a miss leaves \d+ of value, no less than a success gives \(\d+\): a miss keeps a part \(G40\)$/.test(m))).toBe(true);
  });
  it('an upgrade in another slot, or that gives less than its base', () => {
    expect(said).toContain('an upgrade stands in the slot of the part it replaces: core/campfire is in "fire", this one in "storage"');
    expect(said).toContain('core/campfire provides a fire; an upgrade over it provides one too');
    expect(said).toContain('an upgrade keeps at least the bag bonus of core/storage-chest (10)');
    expect(said).toContain('an upgrade gives at least the tier of tester/high (2)');
  });
  it('upgrades that go round in a circle, or over a part that does not exist', () => {
    expect(said).toContain('the upgrades go round in a circle: one part has to stand first');
    expect(said).toContain('no camp part "tester/none"');
  });
});

describe('templates the check refuses', () => {
  const result = world({
    'items.json': items(item('mash')),
    'templates/too-wide.json': template('too-wide', {
      inputs: [
        { class: 'plant', min_tier: 1, qty: 1 },
        { class: 'plant', min_tier: 1, qty: 1 },
      ],
      outputs: out('mash'),
    }),
    'templates/no-class.json': template('no-class', { inputs: [{ item: 'core/herb', qty: 1 }], outputs: out('mash') }),
    'templates/no-fit.json': template('no-fit', { inputs: [{ class: 'mineral', min_tier: 1, qty: 1 }], outputs: out('mash') }),
  });
  const said = messages(result);
  const b = result.assembled.bundle!;

  it('one that fits more combinations than the bound, and makes none of them', () => {
    expect(said.some((m) => /^fits \d+ combinations, more than template_max_recipes \(12\)/.test(m))).toBe(true);
    expect(Object.values(b.recipes).some((r) => r.template === 'tester/too-wide')).toBe(false);
  });

  it('one with no class input', () => {
    expect(said).toContain('no input names a class: write a recipe instead of a template');
  });

  it('one that nothing fits', () => {
    expect(said).toContain('no item of class "mineral" at tier 1 or above');
  });
});

describe('items the check refuses', () => {
  const result = world({
    'items.json': {
      ...items(
        { ...item('bare'), class: undefined, tier: undefined },
        item('lost', { class: 'tester/nothing' }),
        item('nail', { class: 'metal' }),
        item('spade', { kind: 'tool', tool: { kind: 'trowel', tier: 1, uses: 10 } }),
        item('rock', { class: 'tool' }),
        item('pick', { kind: 'tool', class: 'tool', tier: 2, tool: { kind: 'trowel', tier: 1, uses: 10 } }),
        item('gruel', { class: 'meal' }),
        item('star', { class: 'mineral', tier: 4 }),
      ),
      classes: [{ id: 'tester/ingot', name: 'Ingot', base: 'metal' }],
    },
  });
  const said = messages(result);

  it('an item with no class or tier', () => {
    expect(said).toContain('every item names a "class" and a "tier"; see "Classes and tiers" in docs/creators/README.md');
  });
  it('a class that does not exist', () => {
    expect(said.some((m) => m.startsWith('no class "tester/nothing"'))).toBe(true);
  });
  it('metal, before its discovery', () => {
    expect(said).toContain('metal waits for its discovery: no metal items yet (DECISIONS.md, 2026-10-09)');
    expect(said).toContain('metal waits for its discovery: no classes under it yet (DECISIONS.md, 2026-10-09)');
  });
  it('a tool outside the tool class, and the tool class outside tools', () => {
    expect(said).toContain('a tool is of class "tool"');
    expect(said).toContain('class "tool" is for items of kind "tool"');
  });
  it('a tool whose tier is not the tier of its tool', () => {
    expect(said).toContain('a tool has the tier of its "tool": 1');
  });
  it('a meal that is not food', () => {
    expect(said).toContain('a meal is eaten: class "meal" is for items of kind "food"');
  });
  it('a tier the world has not opened', () => {
    expect(said).toContain('tier 4 is not open yet: the world has tiers 1 to 3');
  });
});

describe('recipes the check refuses', () => {
  const result = world(
    {
      'items.json': items(item('gem', { class: 'mineral', tier: 3 }), item('cord', { class: 'fibre', tier: 2 }), item('paste')),
      'recipes/leap.json': recipe('leap', { level: 6, inputs: [{ item: 'core/stone', qty: 1 }], outputs: out('gem') }),
      'recipes/early.json': recipe('early', { level: 3, inputs: [{ item: 'core/herb', qty: 1 }], outputs: out('paste') }),
      'recipes/cord.json': recipe('cord', { level: 3, inputs: [{ item: 'core/herb', qty: 1 }], outputs: out('cord') }),
      'recipes/bench.json': recipe('bench', { station: 'workshop', level: 1, inputs: [{ item: 'core/branch', qty: 1 }], outputs: out('paste') }),
      'recipes/forager.json': recipe('forager', { profession: 'core/foraging', inputs: [{ item: 'core/herb', qty: 1 }], outputs: out('paste') }),
      'recipes/nobody.json': recipe('nobody', { profession: 'tester/nobody', inputs: [{ item: 'core/herb', qty: 1 }], outputs: out('paste') }),
      'recipes/master.json': recipe('master', { level: 10, inputs: [{ item: 'tester/cord', qty: 1 }], outputs: out('gem') }),
    },
    // a world with no workshop, so the bench recipe stands at a station nothing provides and no profession works
    [removeCore(...CORE_WORKSHOP)],
  );
  const said = messages(result);

  it('one that climbs more than one tier', () => {
    expect(said).toContain('tester/gem is tier 3; a recipe climbs one tier at most, and its highest input is tier 1');
  });
  it('one whose level is outside its tier\'s band', () => {
    expect(said).toContain('a tier 1 recipe asks for a level from 1 to 2, not 3');
  });
  it('one with no station of its tier', () => {
    expect(said).toContain('a tier 2 recipe needs a fire of tier 2; the best camp part gives tier 1');
  });
  it('one at a station that nothing provides and no profession works', () => {
    expect(said).toContain('no profession works the workshop: name one in "profession"');
    expect(said).toContain('no camp part provides a workshop');
  });
  it('one gated by a profession that does not craft, or does not exist', () => {
    expect(said).toContain('Foraging trains "gather", not "craft"');
    expect(said).toContain('no profession "tester/nobody"');
  });
  it('one that asks for a level its profession never reaches', () => {
    expect(said).toContain('Cooking stops at level 9');
  });
});

describe('an average try the check refuses (CR-16)', () => {
  // Two tier-2 recipes at the core's workbench, each the only road to its output, so the output is worth
  // the hard work plus the inputs: V = 1000 * t / 1000 + 10 * V(stone) = t + 10000. A miss keeps half the
  // stones (craft_miss_keep_pct 50), 5000 of value, and a tier-2 try succeeds 8000 times in 10000:
  //   8000 * (t + 10000) + 2000 * 5000 >= 10000 * 10000 holds from t = 1250 ms.
  //   grit, 1249 ms: 8000 * 11249 + 2000 * 5000 = 99_992_000 < 100_000_000, an average try gives 9999.
  //   sand, 1250 ms: 8000 * 11250 + 2000 * 5000 = 100_000_000, on the line, passes.
  const stones = [{ item: 'core/stone', qty: 10 }];
  const result = world({
    'items.json': items(item('grit', { class: 'mineral', tier: 2 }), item('sand', { class: 'mineral', tier: 2 })),
    'recipes/grit.json': recipe('grit', { station: 'workshop', level: 3, active_ms: 1249, inputs: stones, outputs: out('grit') }),
    'recipes/sand.json': recipe('sand', { station: 'workshop', level: 3, active_ms: 1250, inputs: stones, outputs: out('sand') }),
  });
  const b = result.assembled.bundle!;

  it('starts from the numbers of the arithmetic', () => {
    expect(b.values['core/stone']).toBe(1000);
    expect(b.params.effort_permille.hard).toBe(1000);
    expect(b.params.craft_miss_keep_pct).toBe(50);
    expect(b.params.craft_chance_bp[1]).toBe(8000);
    expect(b.values['tester/grit']).toBe(11_249);
    expect(b.values['tester/sand']).toBe(11_250);
    expect(missOutcome(b, b.recipes['tester/grit']!)).toEqual({ keep: [{ item: 'core/stone', qty: 5 }] });
  });

  it('one a millisecond short of the line, and nothing else', () => {
    const found = errors(result);
    expect(found.map((i) => i.message)).toEqual([
      'a try gives 9999 of value on average for 10000 of inputs: a craft never loses value on average; give it more time or fewer inputs (DECISIONS.md, 2026-10-09: the crafting economy)',
    ]);
    expect(found[0]!.file).toMatch(/extensions\/tester\/recipes\/grit\.json$/);
    expect(found[0]!.where).toBe('recipe.outputs');
  });
});

describe('the core workshop', () => {
  const core = runCheck();
  const b = core.assembled.bundle!;
  const worth = (stacks: readonly { item: string; qty: number }[]) => stacks.reduce((n, s) => n + b.values[s.item]! * s.qty, 0);

  it('dyes cord with each berry: one recipe a berry, known from the start', () => {
    const made = Object.values(b.recipes).filter((r) => r.template === 'core/dye-cord');
    expect(made.map((r) => r.id)).toEqual(['core/dye-cord+core/bellberry', 'core/dye-cord+core/berry']);
    for (const r of made) {
      expect(r.known).toBe('start');
      expect(r.station).toBe('workshop');
      expect(r.inputs).toEqual([
        { item: r.id.split('+')[1], qty: 2 },
        { item: 'core/reed-cord', qty: 1 },
      ]);
      expect(r.outputs).toEqual([{ item: 'core/dyed-cord', qty: 1, share_pct: 100 }]);
    }
    // the cheaper berry sets the value: hard work for 4000 ms over its inputs
    expect(b.values['core/dyed-cord']).toBe(b.params.effort_permille.hard * 4 + Math.min(...made.map((r) => worth(r.inputs))));
  });

  it('every recipe pays back its inputs on an average try at its own level (CR-16)', () => {
    const chances = b.params.craft_chance_bp;
    for (const c of Object.values(b.recipes).filter((r) => r.id.startsWith('core/'))) {
      const chance = chances[Math.min(recipeTier(b, c), chances.length) - 1]!;
      const tried = chance * worth(c.outputs) + (10_000 - chance) * worth(missOutcome(b, c).keep);
      expect(tried, c.id).toBeGreaterThanOrEqual(10_000 * worth(c.inputs));
    }
    expect(messages(core).filter((m) => m.startsWith('a try gives'))).toEqual([]);
  });
});

describe('gates and the rarity budget', () => {
  const crystal = item('crystal', { class: 'mineral', tier: 3, rarity: 'rare' });
  const result = world({ 'resources/crystals.json': node(crystal, { count: 12, respawn_ms: 1000, active_ms: 15000 }) }, [
    editCore<ShopFile>('shops/trader-shop.json', (d) => {
      d.shop.sells.push({ item: 'tester/crystal', price_mg: 9_000_000 });
    }),
  ]);
  const said = messages(result);

  it('a tier-3 material from a node with no level gate and a fast respawn', () => {
    expect(said).toContain('tester/crystal is tier 3: its node needs level 6 or a respawn of at least 300000 ms');
  });
  it('a tier-3 thing in a shop', () => {
    expect(said).toContain('tester/crystal is tier 3: from tier 3 up a thing is found, made or earned, never sold');
  });
  it('rarity bonuses over the world budget, reported at the largest part', () => {
    const issue = errors(result).find((i) => i.message.startsWith('the rarity bonuses of the world add'));
    expect(issue?.file).toMatch(/extensions\/tester\/resources\/crystals\.json$/);
  });
});

describe('core rules the check refuses', () => {
  const result = world(
    {
      'core/professions/carpentry.json': {
        ...JSON.parse(readFileSync(join(CONTENT_DIR, 'core', 'professions', 'cooking.json'), 'utf8')),
        id: 'core/carpentry',
        title: 'Carpentry',
      },
    },
    [
      editCore<ParamsFile>('params.json', (d) => {
        d.params.tier_min_level = [2, 2];
        d.params.craft_chance_bp = [8000, 9000];
        d.params.wear_effect_max_pct = [8, 5];
      }),
      editCore<ProfessionFile>('professions/foraging.json', (d) => {
        d.profession.stations = ['workshop'];
      }),
    ],
  );
  const said = messages(result);

  it('level bands that do not start at 1, do not rise, or miss an open tier', () => {
    expect(said).toContain('tier 1 starts at level 1');
    expect(said).toContain('each tier starts at a higher level than the one before');
    expect(said).toContain('2 entries for 3 open tiers: every open tier needs one');
  });
  it('stations on a profession that does not craft', () => {
    expect(said).toContain('Foraging trains "gather": only a craft profession works stations');
  });
  it('one station worked by two professions', () => {
    expect(said.some((m) => /^the fire is already worked by core\/(carpentry|cooking)$/.test(m))).toBe(true);
  });
  it('a craft chance that rises with the tier, or a cap on worn effects that falls', () => {
    expect(said).toContain('the craft chance never rises with the tier');
    expect(said).toContain('the cap on a worn effect never falls with the tier');
  });
});
