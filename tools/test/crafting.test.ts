/**
 * The crafting grammar and its check (DECISIONS.md, 2026-10-09): classes and
 * tiers on items, recipe templates, the level bands, station tiers, one craft
 * profession per station, gated high tiers and the world's rarity budget.
 * Each world is a copy of the core with a few files added or edited.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CampFile, ParamsFile, ProfessionFile, ShopFile } from '@game/schema';
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
  const root = mkdtempSync(join(tmpdir(), 'openfold-crafting-'));
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
      'templates/jam.json': template('jam', { inputs: [{ class: 'plant', family: 'sloe', min_tier: 1, qty: 3 }], outputs: out('sloe-jam') }),
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
    expect(made.map((r) => r.id)).toEqual(['tester/dry-herbs--core-herb', 'tester/dry-herbs--core-sunleaf']);
    const herb = b.recipes['tester/dry-herbs--core-herb']!;
    expect(herb.title).toBe('Dried herbs (Wild herb)');
    expect(herb.known).toBe('start');
    expect(herb.inputs).toEqual([{ item: 'core/herb', qty: 2 }]);
    expect(herb.file).toBe(result.assembled.origin['tester/dry-herbs']);
    expect(b.values['tester/dried-herbs']).toBeGreaterThan(0);
  });

  it('merges an item that fills a fixed input and a class input', () => {
    expect(b.recipes['tester/herb-mix--core-herb']!.inputs).toEqual([{ item: 'core/herb', qty: 3 }]);
    expect(b.recipes['tester/herb-mix--core-sunleaf']!.inputs).toEqual([
      { item: 'core/herb', qty: 1 },
      { item: 'core/sunleaf', qty: 2 },
    ]);
  });

  it('a base class takes the items of a class declared under it', () => {
    expect(b.classes['tester/stone-fruit']?.base).toBe('plant');
    expect(b.recipes['tester/jam--tester-sloe']?.inputs).toEqual([{ item: 'tester/sloe', qty: 3 }]);
  });

  it('a tier-2 recipe passes at a tier-2 station and its work is weighed as hard', () => {
    // V(rope) = w * t / 1000 + 2 * V(dried herbs), with t = 4000 ms
    expect(b.values['tester/rope']! - 2 * b.values['tester/dried-herbs']!).toBe(b.params.effort_permille.hard * 4);
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
  const result = world({
    'items.json': items(item('gem', { class: 'mineral', tier: 3 }), item('cord', { class: 'fibre', tier: 2 }), item('paste')),
    'recipes/leap.json': recipe('leap', { level: 6, inputs: [{ item: 'core/stone', qty: 1 }], outputs: out('gem') }),
    'recipes/early.json': recipe('early', { level: 3, inputs: [{ item: 'core/herb', qty: 1 }], outputs: out('paste') }),
    'recipes/cord.json': recipe('cord', { level: 3, inputs: [{ item: 'core/herb', qty: 1 }], outputs: out('cord') }),
    'recipes/bench.json': recipe('bench', { station: 'workshop', level: 1, inputs: [{ item: 'core/branch', qty: 1 }], outputs: out('paste') }),
    'recipes/forager.json': recipe('forager', { profession: 'core/foraging', inputs: [{ item: 'core/herb', qty: 1 }], outputs: out('paste') }),
    'recipes/nobody.json': recipe('nobody', { profession: 'tester/nobody', inputs: [{ item: 'core/herb', qty: 1 }], outputs: out('paste') }),
    'recipes/master.json': recipe('master', { level: 10, inputs: [{ item: 'tester/cord', qty: 1 }], outputs: out('gem') }),
  });
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
});
