/**
 * The equipment foundations' check rows (BUILD_SET 4, rows 2 to 6; CLOTHING 7.4, 7.5, 7.6, 11; DECISIONS.md,
 * 2026-11-01): the weapon gate, the shop by derived category, the teacher of a found recipe, the wear
 * requirement, worn attributes, garment traits and binding. Each world is a copy of the core with a few files
 * added or edited; the helpers are crafting.test.ts's.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ParamsFile, QuestFile, ShopFile } from '@game/schema';
import { afterAll, describe, expect, it } from 'vitest';
import { type CheckResult, runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

type Edit = (root: string) => void;

/** A copy of the core world plus the files of the creator "tester", with some core files edited. */
function world(files: Record<string, object>, edits: Edit[] = []): CheckResult {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-equipment-'));
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
/** The issues at one place, errors and warnings both. */
const at = (r: CheckResult, where: string) => r.issues.filter((i) => i.where === where);

const envelope = (type: string, name: string, title = name) => ({ format: 1, type, id: `tester/${name}`, title, creator: 'tester' });
const item = (name: string, extra: object = {}) => ({
  id: `tester/${name}`,
  name,
  kind: 'material',
  rarity: 'common',
  class: 'plant',
  tier: 1,
  sprite: 'core/base-kit:items/herb',
  weight: 1,
  ...extra,
});
const items = (...list: object[]) => ({ ...envelope('items', 'items'), items: list });
/** A worn work piece of class garment. */
const garment = (name: string, wear: object, extra: object = {}) => item(name, { class: 'garment', wear, ...extra });
const club = (extra: object = {}) =>
  item('club', { kind: 'tool', class: 'tool', wear: { slot: 'hand' }, weapon: { tempo: 'standard', windup_t: 4, reach: 1, harm: 100 }, ...extra });

const NEW_ROWS = ['waits for combat', 'a teacher', 'tier 1 only', 'wear requirement', 'attribute bonus', 'garment trait', 'binds', 'bind'];

describe('the equipment foundations', () => {
  it('the core raises none of the new rows (regression guard, passes before by design)', () => {
    const r = world({});
    for (const m of r.issues.map((i) => i.message)) {
      for (const row of NEW_ROWS) expect(m).not.toContain(row);
    }
  });

  it('a weapon-only hand gets the combat gate and not the missing-tool row', () => {
    const r = world({ 'items.json': items(club(), item('stick', { kind: 'tool', class: 'tool' })) });
    expect(at(r, 'items.tester/club.weapon').map((i) => i.message)).toEqual(['a weapon waits for combat: no weapon block yet (G35, G44)']);
    // the relaxed row still holds for a tool with neither block, and only for it
    const needs = errors(r).filter((i) => i.message.includes('a tool item needs'));
    expect(needs.map((i) => [i.where, i.message, i.file.endsWith('extensions/tester/items.json')])).toEqual([
      ['tool', 'a tool item needs "tool": { kind, tier }, and "uses" when it wears out', true],
    ]);
  });

  it('a tool with a weapon block is refused by the gate alone', () => {
    const r = world({ 'items.json': items(club({ tool: { kind: 'staff', tier: 1, uses: 100 } })) });
    expect(at(r, 'items.tester/club.weapon').map((i) => i.message)).toEqual(['a weapon waits for combat: no weapon block yet (G35, G44)']);
    expect(errors(r).filter((i) => i.message.includes('a tool item needs'))).toEqual([]);
  });

  it('a shop sells a tool at tier 1 only; tier 3 keeps its own row', () => {
    let n = 0;
    const r = world({}, [
      editCore<ShopFile>('shops/trader-shop.json', (f) => {
        n = f.shop.sells.length;
        f.shop.sells.push({ item: 'core/flint-trowel', price_mg: 90000 }, { item: 'core/stone-trowel', price_mg: 300000 });
      }),
    ]);
    const tier2 = at(r, `shop.sells.${n}`).map((i) => i.message);
    expect(tier2).toEqual([
      'core/flint-trowel is a tier 2 tool: a shop sells a tool, a weapon or ammunition at tier 1 only; a better one is made, found or earned (DECISIONS.md, 2026-10-09)',
    ]);
    const tier3 = at(r, `shop.sells.${n + 1}`).map((i) => i.message);
    expect(tier3).toEqual(['core/stone-trowel is tier 3: from tier 3 up a thing is found, made or earned, never sold']);
    // the satchel is a tier-2 worn piece, not a tool: the shop keeps it
    expect(messages(r).filter((m) => m.startsWith('core/satchel'))).toEqual([]);
  });

  it('a found recipe needs a teacher, and a scrap counts as one', () => {
    const teacher = 'a found recipe needs a teacher: no fragment\'s "unlocks" and no quest reward\'s "recipes" names it (DECISIONS.md, 2026-10-10)';
    const drop = (rel: string, id: string) =>
      editCore<QuestFile>(rel, (f) => {
        f.quest.reward.recipes = (f.quest.reward.recipes ?? []).filter((x) => x !== id);
        if (f.quest.reward.recipes.length === 0) delete f.quest.reward.recipes;
      });
    const tea = world({}, [drop('quests/a-coin-for-maru.json', 'core/herb-tea')]);
    const rows = errors(tea).filter((i) => i.message === teacher);
    expect(rows.map((i) => [i.where, i.file.endsWith('recipes/herb-tea.json')])).toEqual([['recipe.known', true]]);
    // the stew is still taught by the stew scrap at the ruins gate
    const stew = world({}, [drop('quests/herbs-for-pell.json', 'core/herb-stew')]);
    expect(messages(stew)).not.toContain(teacher);
  });

  it('refuses worn attributes until their reader, and caps them by tier', () => {
    const r = world({
      'items.json': items(garment('vest', { slot: 'top', attrs: { might: 3 } }, { tier: 2 }), garment('veil', { slot: 'head', look: true, attrs: { luck: 1 } })),
    });
    expect(at(r, 'items.tester/vest.wear.attrs').map((i) => i.message)).toEqual([
      'an attribute bonus waits for its reader: no verb reads worn attributes yet (PROGRESSION 5.6)',
    ]);
    expect(at(r, 'items.tester/vest.wear.attrs.might').map((i) => i.message)).toEqual(['a tier 2 piece gives at most 2 (attr_bonus_max), not 3 (PROGRESSION 5.6)']);
    expect(at(r, 'items.tester/veil.wear.attrs').map((i) => i.message)).toContain('a look shows and counts for nothing: no attribute bonus (G44)');
  });

  it('checks the wear requirement', () => {
    const nope = world({ 'items.json': items(garment('hood', { slot: 'head', req: { school: 'core/nope', level: 1 } })) });
    expect(at(nope, 'wear.req.school').map((i) => i.message)).toEqual(['no profession "core/nope"']);

    const r = world({
      'items.json': items(
        garment('hood', { slot: 'head', req: { school: 'core/digging', level: 3 } }, { tier: 2 }),
        garment('coat', { slot: 'top', req: { school: 'core/digging', level: 11 } }, { tier: 3, rarity: 'rare' }),
        garment('mask', { slot: 'head', look: true, req: { school: 'core/digging', level: 1 } }),
        garment('cap', { slot: 'head', req: { school: 'core/digging', level: 6 } }, { tier: 2 }),
      ),
    });
    expect(at(r, 'items.tester/hood.wear.req.level').map((i) => i.message)).toEqual([
      'a tier 2 piece asks level 6 (wear_req_level), not 3 (PROGRESSION 5.6)',
    ]);
    const high = at(r, 'items.tester/coat.wear.req.level');
    expect(high.map((i) => [i.level, i.message])).toEqual([
      ['warning', "level 11 is above Digging's top level 9: below it the piece counts as one tier above the wearer's own"],
    ]);
    expect(at(r, 'items.tester/mask.wear.req').map((i) => i.message)).toEqual(['a look has no wear requirement']);
    expect(r.issues.filter((i) => i.where.startsWith('items.tester/cap.wear.req'))).toEqual([]);
  });

  it('refuses a garment trait until its reader, and keeps each in its place', () => {
    const gate = 'a garment trait waits for its reader: no place condition is built yet (BODY_CLOCKS 9; G34)';
    const r = world({
      'items.json': items(
        garment('wrap', { slot: 'top', trait: 'cold_proof' }),
        garment('spikes', { slot: 'head', trait: 'ice_grip' }),
        item('charm', { class: 'jewelry', wear: { slot: 'jewelry', trait: 'cold_proof' } }),
        garment('shawl', { slot: 'top', look: true, trait: 'heat_ward' }),
      ),
    });
    expect(at(r, 'items.tester/wrap.wear.trait').map((i) => i.message)).toEqual([gate]);
    expect(at(r, 'items.tester/spikes.wear.trait').map((i) => i.message)).toEqual([gate, 'ice_grip goes on the feet, not the head (BODY_CLOCKS 6.1)']);
    expect(at(r, 'items.tester/charm.wear.trait').map((i) => i.message)).toContain('cold_proof goes on the top, back, head, not the jewelry (BODY_CLOCKS 6.1)');
    expect(at(r, 'items.tester/shawl.wear.trait').map((i) => i.message)).toContain('a look carries no trait');
  });

  it('lets only a look bind; power is never bound', () => {
    const power = 'only a look binds; power is never bound (EQUIPMENT 3.6)';
    const r = world(
      {
        'items.json': items(
          item('spade', { kind: 'tool', class: 'tool', tool: { kind: 'trowel', tier: 1, uses: 40 }, bind: 'character' }),
          garment('apron', { slot: 'top', effects: [{ effect: 'craft_speed_pct', value: 5 }] }, { bind: 'character' }),
          garment('crown', { slot: 'head', effects: [{ effect: 'rare_find_pct', value: 5 }] }, { bind: 'character', rarity: 'legendary' }),
          garment('veil', { slot: 'head', look: true }, { bind: 'character' }),
          garment('scarf', { slot: 'head', look: true }, { bind: 'account' }),
          garment('ribbon', { slot: 'head', look: true }, { bind: 'account', premium_later: true }),
          garment('smock', { slot: 'top' }, { bind: 'account' }),
          garment('hat', { slot: 'head', look: true }, { bind: 'none' }),
          item('reed', { bind: 'none' }),
          item('trowel', { kind: 'tool', class: 'tool', tool: { kind: 'trowel', tier: 1 }, bind: 'none' }),
          club({ bind: 'character' }),
        ),
      },
      [
        editCore<ShopFile>('shops/trader-shop.json', (f) => {
          f.shop.sells.push({ item: 'tester/scarf', price_mg: 30000 }, { item: 'tester/ribbon', price_mg: 30000 });
        }),
      ],
    );
    const bindRow = (name: string) => at(r, `items.tester/${name}.bind`).map((i) => i.message);
    expect(bindRow('spade')).toEqual([power]);
    expect(bindRow('apron')).toEqual([power]);
    // a legendary find with an effect is power too: a ceiling raiser cannot be told apart yet (owner question, default never)
    expect(bindRow('crown')).toEqual([power]);
    expect(bindRow('veil')).toEqual([]);
    expect(r.assembled.bundle?.items['tester/veil']?.bind).toBe('character');
    expect(bindRow('scarf')).toEqual(['the found copy trades (G39): a look bought with money is its own item, bound to the account; this one comes from the game']);
    expect(bindRow('ribbon')).toEqual(['the premium marker is on the copy found in the game, which trades (G39)']);
    expect(bindRow('smock')).toEqual([power]);
    for (const name of ['hat', 'reed', 'trowel']) {
      expect(bindRow(name)).toEqual([]);
      expect(r.assembled.bundle?.items[`tester/${name}`]?.bind).toBe('none');
    }
    expect(bindRow('club')).toEqual(['a weapon is never bound (WEAPONS 13; EQUIPMENT 3.6)']);
  });

  it('checks the three new params', () => {
    const r = world({}, [
      editCore<ParamsFile>('params.json', (f) => {
        f.params.attr_bonus_max = [1, 3, 2, 4, 6];
        f.params.wear_req_level = [2, 6, 11, 16, 21];
        f.params.attr_bonus_step.value = 9;
      }),
    ]);
    expect(at(r, 'params.attr_bonus_max.2').map((i) => i.message)).toEqual(['the largest attribute bonus never falls with the tier']);
    expect(at(r, 'params.wear_req_level.0').map((i) => i.message)).toEqual(['tier 1 asks level 1']);
    expect(at(r, 'params.attr_bonus_step').map((i) => i.message)).toEqual(['value 9 is outside [1, 4]']);
    const falls = world({}, [editCore<ParamsFile>('params.json', (f) => void (f.params.wear_req_level = [1, 6, 5, 16, 21]))]);
    expect(at(falls, 'params.wear_req_level.2').map((i) => i.message)).toEqual(['the wear requirement never falls with the tier']);
  });
});
