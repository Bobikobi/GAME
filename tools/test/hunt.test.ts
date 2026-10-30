/**
 * The hunt foundations in the check (docs/design/HUNTING.md sections 5-10; DECISIONS.md, "The hunt foundations"): a hunted kind's
 * drops, shares, tier and spawn cap, a protected kind, a grade's twin, a sold good, and a template that asks for a
 * grade. Each world is a copy of the core with the hare given hunt fields and a tester's goods.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { MapFile, ParamsFile, ShopFile } from '@game/schema';
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
  const root = mkdtempSync(join(tmpdir(), 'loomvale-hunt-'));
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
/** The error messages about the hare's hunt, the tester's files or a shop. */
const ours = (r: CheckResult) =>
  errors(r)
    .filter((i) => i.where.includes('core/hare') || i.file.includes('tester') || i.where.startsWith('shop.') || i.where.startsWith('items.tester'))
    .map((i) => `${i.where}: ${i.message}`);

const envelope = (type: string, name: string, title = name) => ({ format: 1, type, id: `tester/${name}`, title, creator: 'tester' });
const item = (name: string, cls: string, extra: object = {}) => ({
  id: `tester/${name}`,
  name,
  kind: 'material',
  rarity: 'common',
  class: cls,
  tier: 1,
  sprite: 'core/base-kit:items/herb',
  weight: 1,
  ...extra,
});
const GOODS = {
  'items/hare-goods.json': {
    ...envelope('items', 'hare-goods'),
    items: [
      item('hare-meat', 'core/meat', { kind: 'food', food: { satiety: 5 } }),
      item('hare-hide', 'core/hide'),
      item('hare-hide-fine', 'core/hide', { grade: { of: 'tester/hare-hide', step: 2 } }),
      item('hare-bone', 'core/bone'),
    ],
  },
};
const HUNT = {
  size: 'small',
  tier: 1,
  danger: 0,
  take_s: 40,
  drops: [
    { item: 'tester/hare-meat', qty: 2, share_pct: 50 },
    { item: 'tester/hare-hide', qty: 1, share_pct: 40 },
    { item: 'tester/hare-bone', qty: 1, share_pct: 10 },
  ],
  spawn: { cap_per_1000: 12, refill_d: 1 },
};
type Kinds = Record<string, Record<string, unknown>>;
/** The hare given these hunt fields (and any other field), in the core map. */
const hare = (hunt: object | undefined, extra: object = {}): Edit =>
  editCore<MapFile>('map.json', (m) => {
    const kinds = m.map.creatures!.kinds as unknown as Kinds;
    kinds['core/hare'] = { ...kinds['core/hare'], ...(hunt ? { hunt } : {}), ...extra };
  });

describe('a hunted kind', () => {
  it('drops plain goods under its tier with shares of 100, and the value table prices them', () => {
    const r = world(GOODS, [hare(HUNT)]);
    expect(ours(r)).toEqual([]);
    const values = r.assembled.bundle!.values;
    expect(values['tester/hare-hide']).toBeGreaterThan(0);
    expect(values['tester/hare-hide-fine']).toBe(values['tester/hare-hide']);
    expect(values['tester/hare-meat']).toBeGreaterThan(0);
  });

  it('refuses shares that do not sum to 100', () => {
    const drops = HUNT.drops.map((d, i) => (i === 0 ? { ...d, share_pct: 40 } : d));
    expect(ours(world(GOODS, [hare({ ...HUNT, drops })]))).toContain('map.creatures.kinds.core/hare.hunt.drops: shares sum to 90, they must sum to 100');
  });

  it('refuses a drop that is no item, no good, a grade, or above its tier', () => {
    const r = world(
      {
        ...GOODS,
        'items/odd.json': { ...envelope('items', 'odd'), items: [item('leaf', 'plant'), item('big-bone', 'core/bone', { tier: 3 })] },
      },
      [
        hare({
          ...HUNT,
          drops: [
            { item: 'tester/nothing', qty: 1, share_pct: 20 },
            { item: 'tester/leaf', qty: 1, share_pct: 20 },
            { item: 'tester/hare-hide-fine', qty: 1, share_pct: 20 },
            { item: 'tester/big-bone', qty: 1, share_pct: 20 },
            { item: 'tester/hare-meat', qty: 1, share_pct: 20 },
          ],
        }),
      ],
    );
    const found = ours(r);
    expect(found).toContain('map.creatures.kinds.core/hare.hunt.drops.0.item: no item "tester/nothing"');
    expect(found.some((m) => m.startsWith('map.creatures.kinds.core/hare.hunt.drops.1.item') && m.includes('is not a good'))).toBe(true);
    expect(found.some((m) => m.startsWith('map.creatures.kinds.core/hare.hunt.drops.2.item') && m.includes('is a finer grade'))).toBe(true);
    expect(found).toContain('map.creatures.kinds.core/hare.hunt.drops.3.item: tester/big-bone is tier 3, above the animal\'s tier 1');
  });

  it('drops each good once: two items of one goods class are refused', () => {
    const r = world({ ...GOODS, 'items/odd.json': { ...envelope('items', 'odd'), items: [item('knuckle', 'core/bone')] } }, [
      hare({
        ...HUNT,
        drops: [
          { item: 'tester/hare-meat', qty: 1, share_pct: 60 },
          { item: 'tester/hare-bone', qty: 1, share_pct: 20 },
          { item: 'tester/knuckle', qty: 1, share_pct: 20 },
        ],
      }),
    ]);
    expect(ours(r)).toEqual(['map.creatures.kinds.core/hare.hunt.drops.2.item: tester/knuckle is a second bone: each good once (HUNTING 6)']);
  });

  it('holds a part of the dressing inside the action cap, and the meat before the rest', () => {
    const r = world(GOODS, [
      hare(HUNT),
      editCore<ParamsFile>('params.json', (p) => {
        p.params.hunt.dress_step_ms.value = 4000;
        p.params.hunt.hide_spoil_d.value = 2;
      }),
    ]);
    const found = errors(r).map((i) => `${i.where}: ${i.message}`);
    expect(found).toContain('params.hunt.dress_step_ms: a part of the dressing is 6 steps and one action: keep 6 x dress_step_ms within max_action_ms (G43)');
    expect(found).toContain('params.hunt.meat_spoil_d: the meat goes before the rest: keep meat_spoil_d at or under hide_spoil_d (HUNTING 6)');
  });

  it('is never protected, and holds the spawn cap of its danger', () => {
    expect(ours(world(GOODS, [hare(HUNT, { protected: true })]))).toContain(
      'map.creatures.kinds.core/hare.hunt: a protected creature is never dressed: drop "hunt" or "protected" (HUNTING 10)',
    );
    expect(ours(world(GOODS, [hare({ ...HUNT, spawn: { cap_per_1000: 13, refill_d: 1 } })]))).toContain(
      'map.creatures.kinds.core/hare.hunt.spawn.cap_per_1000: at most 12 per 1000 habitat tiles at danger 0 (HUNTING 8), not 13',
    );
    expect(ours(world(GOODS, [hare({ ...HUNT, danger: 2, spawn: { cap_per_1000: 5, refill_d: 3 } })]))).toContain(
      'map.creatures.kinds.core/hare.hunt.danger: a small animal does not hunt the player: danger 2 is medium or large (HUNTING 8)',
    );
  });

  it('leaves a protected ambient kind alone', () => {
    expect(ours(world({}, [hare(undefined, { protected: true })]))).toEqual([]);
  });
});

describe('a grade of a good', () => {
  it('points at a plain item that exists and keeps its class, kind and tier, once per step', () => {
    const r = world(
      {
        'items/grades.json': {
          ...envelope('items', 'grades'),
          items: [
            item('hide', 'core/hide'),
            item('hide-fine', 'core/hide', { grade: { of: 'tester/hide', step: 2 } }),
            item('hide-fine-too', 'core/hide', { grade: { of: 'tester/hide', step: 2 } }),
            item('hide-true', 'core/bone', { grade: { of: 'tester/hide', step: 3 } }),
            item('ghost-fine', 'core/hide', { grade: { of: 'tester/ghost', step: 2 } }),
            item('fine-of-fine', 'core/hide', { grade: { of: 'tester/hide-fine', step: 3 } }),
          ],
        },
      },
      [],
    );
    const found = ours(r);
    expect(found).toContain('items.tester/hide-fine-too.grade.step: tester/hide-fine is already grade 2 of tester/hide');
    expect(found).toContain("items.tester/hide-true.grade: a grade keeps the plain good's class, kind and tier (tester/hide)");
    expect(found).toContain('items.tester/ghost-fine.grade.of: no item "tester/ghost"');
    expect(found).toContain('items.tester/fine-of-fine.grade.of: tester/hide-fine is a grade itself: point at the plain good');
  });

  it('is what a template with min_grade takes, and nothing plainer', () => {
    const r = world(
      {
        ...GOODS,
        'templates/fine-work.json': {
          ...envelope('template', 'fine-work'),
          items: [item('fine-thing', 'core/hide', { tier: 2 })],
          template: {
            station: 'fire',
            active_ms: 4000,
            level: 1,
            inputs: [{ class: 'core/hide', min_tier: 1, min_grade: 2, qty: 1 }],
            outputs: [{ item: 'tester/fine-thing', qty: 1, share_pct: 100 }],
          },
        },
      },
      [hare(HUNT)],
    );
    const made = Object.values(r.assembled.bundle!.recipes).filter((c) => c.template === 'tester/fine-work');
    expect(made.map((c) => c.inputs.map((s) => s.item))).toEqual([['tester/hare-hide-fine']]);
    // the grade is valued inside the solver's rounds, so the recipe it feeds has a value and prints no issue
    expect(r.assembled.bundle!.values['tester/fine-thing']).toBeGreaterThan(0);
    // (the template's level and station rows are the tier-2 recipe's own business, not the grade's)
    expect(ours(r).filter((m) => m.includes('value') || m.includes('no way to get'))).toEqual([]);
  });
});

describe('no good of the hunt carries a price', () => {
  it('refuses a shop that sells one', () => {
    const r = world(GOODS, [
      hare(HUNT),
      editCore<ShopFile>('shops/trader-shop.json', (s) => {
        s.shop.sells.push({ item: 'tester/hare-hide', price_mg: 1000 });
      }),
    ]);
    const sold = ours(r).filter((m) => /^shop\.sells\.\d+: tester\/hare-hide is sold: no good of the hunt carries a price \(HUNTING 9\)$/.test(m));
    expect(sold).toHaveLength(1);
  });

  it('prints nothing new for the core as it stands', () => {
    const r = runCheck();
    const hunt = (w: string) =>
      (w.startsWith('map.creatures.kinds.') && w.includes('.hunt')) || /^items\.[^:]+\.grade/.test(w) || w.startsWith('shop.sells.') || w.startsWith('params.hunt');
    expect(errors(r).filter((i) => hunt(i.where) || i.message.includes('HUNTING') || i.message.includes('grade'))).toEqual([]);
  });
});
