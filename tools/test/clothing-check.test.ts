/**
 * The clothing wave's check rows (CLOTHING 6, 6.1, 7.7, 8 and 17; #769): a recipe's family is one its profession
 * declares and only a craft profession declares families; a recipe behind a gate is known from the start; a worn
 * piece never weighs more than what made it; a set runs from uncommon to rare and is one family of one class.
 * Each world is a copy of the core with a few files added or edited (equipment-check.test.ts's helpers).
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProfessionFile } from '@game/schema';
import { afterAll, describe, expect, it } from 'vitest';
import { type CheckResult, runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

type Edit = (root: string) => void;

function world(files: Record<string, object>, edits: Edit[] = []): CheckResult {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-clothing-'));
  roots.push(root);
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });
  for (const [rel, data] of Object.entries(files)) {
    const abs = join(root, 'extensions', 'tester', rel);
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
const at = (r: CheckResult, where: string) => errors(r).filter((i) => i.where === where).map((i) => i.message);
const anyWith = (r: CheckResult, text: string) => errors(r).filter((i) => i.message.includes(text));

const envelope = (type: string, name: string) => ({ format: 1, type, id: `tester/${name}`, title: name, creator: 'tester' });
const garment = (name: string, extra: object = {}) => ({
  id: `tester/${name}`,
  name,
  kind: 'material',
  rarity: 'uncommon',
  class: 'garment',
  tier: 2,
  sprite: 'core/base-kit:items/basket',
  weight: 1,
  wear: { slot: 'head' },
  ...extra,
});
/** A workshop recipe for one worn piece, from two reed cords (weight 2 in all). */
const recipe = (name: string, piece: object = {}, body: object = {}) => ({
  ...envelope('recipe', name),
  items: [garment(name, piece)],
  recipe: {
    station: 'workshop',
    active_ms: 6000,
    level: 4,
    inputs: [{ item: 'core/reed-cord', qty: 2 }],
    outputs: [{ item: `tester/${name}`, qty: 1, share_pct: 100 }],
    known: 'start',
    ...body,
  },
});
const set = (name: string) => ({ ...envelope('set', name), set: { id: `tester/${name}`, effect: 'craft_speed_pct', value: 2 } });

const ROWS = ['families', 'is known from the start, never found', 'never gains weight', 'belongs to no set', 'a set is one family of one class'];

describe('the clothing check rows', () => {
  it('the core raises none of them (regression guard)', () => {
    const r = world({});
    for (const row of ROWS) expect(anyWith(r, row)).toEqual([]);
  });

  it('a recipe family its profession declares passes; another one is refused', () => {
    const fine = world({ 'hood.json': recipe('hood', {}, { family: 'wear' }) });
    expect(at(fine, 'recipe.family')).toEqual([]);
    const r = world({ 'hood.json': recipe('hood', {}, { family: 'silk' }) });
    expect(at(r, 'recipe.family')).toEqual([
      '"silk" is not one of Handcraft\'s families (wear, tools): name a family its profession declares (CLOTHING 6)',
    ]);
  });

  it('only a craft profession declares families', () => {
    const r = world({}, [editCore<ProfessionFile>('professions/foraging.json', (f) => void (f.profession.families = ['berry']))]);
    expect(at(r, 'profession.families')).toEqual(['Foraging trains "gather": only a craft profession sorts its recipes into families (CLOTHING 6)']);
  });

  it('a recipe behind the combat gate is known from the start, never found', () => {
    const fine = world({ 'hood.json': recipe('hood', {}, { gate: 'combat' }) });
    expect(at(fine, 'recipe.gate')).toEqual([]);
    const r = world({ 'hood.json': recipe('hood', {}, { gate: 'combat', known: 'found' }) });
    expect(at(r, 'recipe.gate')).toEqual([
      'a recipe behind the combat gate is known from the start, never found: nothing in the world teaches a closed recipe (CLOTHING 6)',
    ]);
  });

  it('a worn piece never weighs more than its inputs', () => {
    expect(at(world({ 'hood.json': recipe('hood', { weight: 2 }) }), 'recipe.outputs.0')).toEqual([]);
    const r = world({ 'hood.json': recipe('hood', { weight: 3 }) });
    expect(at(r, 'recipe.outputs.0')).toEqual([
      'tester/hood is worn and weighs 3, more than its inputs (2): a made piece never gains weight (MATERIALS M7) (CLOTHING 7.7)',
    ]);
  });

  it('a set runs from uncommon to rare: a common or a legendary piece is refused', () => {
    const wear = (slot: string) => ({ slot, set: 'tester/kit' });
    const fine = world({
      'kit.json': set('kit'),
      'hood.json': recipe('hood', { wear: wear('head') }),
      'shoes.json': recipe('shoes', { wear: wear('feet') }),
    });
    expect(anyWith(fine, 'belongs to no set')).toEqual([]);
    expect(anyWith(fine, 'a set is one family of one class')).toEqual([]);
    const r = world({
      'kit.json': set('kit'),
      'hood.json': recipe('hood', { wear: wear('head'), rarity: 'common' }),
      'shoes.json': recipe('shoes', { wear: wear('feet'), rarity: 'legendary' }),
    });
    expect(at(r, 'items.tester/hood.wear.set')).toEqual(['a common piece belongs to no set: sets run from uncommon to rare (PROGRESSION 5.7) (CLOTHING 8)']);
    expect(at(r, 'items.tester/shoes.wear.set')).toEqual(['a legendary piece belongs to no set: sets run from uncommon to rare (PROGRESSION 5.7) (CLOTHING 8)']);
  });

  it('a set is one family of one class', () => {
    const wear = (slot: string) => ({ slot, set: 'tester/kit' });
    const r = world({
      'kit.json': set('kit'),
      'hood.json': recipe('hood', { wear: wear('head'), family: 'leather' }),
      'shoes.json': recipe('shoes', { wear: wear('feet'), family: 'reed' }),
    });
    expect(anyWith(r, 'a set is one family of one class').map((i) => i.message)).toEqual([
      'the set "tester/kit" mixes garment (leather) and garment (reed): a set is one family of one class (MATERIALS M8) (CLOTHING 8)',
    ]);
  });
});
