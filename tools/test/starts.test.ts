/**
 * Wood, the starts and the rewards they get (DECISIONS.md, 2026-10-10; 2026-10-22: a race in a wake pocket): the core
 * content passes with no line, and a fixture that breaks each rule gets an error that names it.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { isAdvisory } from '../src/art/scale';
import { CONTENT_DIR } from '../src/load';
import { EFFORT_BAND_PCT, KIT_BAND_PCT, measureStarts } from '../src/starts';

describe('the core content', () => {
  it('passes with no line: trees give the wood, every pocket lays or finds an axe, Pell sells another', () => {
    const result = runCheck();
    // the richness, hand and colour lines are advisory counts (tools/src/richness.ts, tools/src/colors.ts), not defects of the content
    // the scale lines of the sprites in known-short.json are the audit's open list: that list only shrinks, a short sprite not on it fails here
    expect(result.issues.filter((i) => !isAdvisory(i))).toEqual([]);
    const b = result.assembled.bundle!;
    expect(b.resources['core/oak-trees']!.tool).toBe('axe');
    expect(Object.keys(b.pockets).sort()).toEqual(['core/north-meadow', 'core/slid-bank', 'core/west-bank']);
    expect(Object.keys(b.races).sort()).toEqual(['core/elf', 'core/human', 'core/skeleton']);
    const axe = (item: string) => b.items[item]?.tool?.kind === 'axe';
    const found = (id: string) => Object.values(b.treasures).some((t) => t.pocket === id && t.finds.some((f) => axe(f.item)));
    expect(Object.values(b.pockets).every((p) => p.ground.some((k) => axe(k.item)) || found(p.id))).toBe(true);
  });

  it('measures every (race, pocket) pair inside the bands', () => {
    const b = runCheck().assembled.bundle!;
    const m = measureStarts(b);
    expect(m).toHaveLength(9);
    const worth = m.map((x) => x.worth_mg);
    const effort = m.map((x) => x.effort_ms!);
    expect(Math.max(...worth) * 100).toBeLessThanOrEqual(Math.min(...worth) * (100 + KIT_BAND_PCT));
    expect(Math.max(...effort) * 100).toBeLessThanOrEqual(Math.min(...effort) * (100 + EFFORT_BAND_PCT));
  });
});

describe('a fixture that breaks each rule', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-starts-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });

  const edit = (file: string, change: (json: Record<string, Record<string, unknown>>) => void) => {
    const path = join(root, 'core', file);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    change(json);
    writeFileSync(path, JSON.stringify(json, null, 2));
  };
  // a pocket with no axe on its ground or its spots, no shop that sells one, and a fire that asks for more logs than the valley's trees give
  edit('pockets/west-bank.json', (j) => {
    j.pocket!.ground = [{ item: 'core/basket', qty: 1 }];
  });
  rmSync(join(root, 'core', 'treasures', 'bank-axe.json'));
  edit('shops/trader-shop.json', (j) => {
    j.shop!.sells = (j.shop!.sells as { item: string }[]).filter((o) => o.item !== 'core/axe');
  });
  edit('camp/campfire.json', (j) => {
    j.camp!.inputs = [{ item: 'core/log', qty: 99 }];
  });
  // a pocket's own spot that can miss, one that asks for a tool its ground lacks and lies off its road,
  // a pocket that wakes in the forest, and a race a point over the total wearing a valued tier-2 piece
  edit('treasures/slid-bank-dig.json', (j) => {
    (j.dig!.finds as { chance_pct: number }[])[0]!.chance_pct = 50;
  });
  edit('treasures/bridge-glint.json', (j) => {
    j.dig!.tool = 'trowel';
  });
  // a dig that asks for a staff
  edit('treasures/ruins-gate.json', (j) => {
    j.dig!.tool = 'staff';
  });
  edit('map.json', (j) => {
    const slot = (j.map!.slots as { id: string; x: number; y: number }[]).find((sl) => sl.id === 'core/bridge-glint')!;
    [slot.x, slot.y] = [8, 32];
  });
  edit('pockets/slid-bank.json', (j) => {
    j.pocket!.wake = { x: 0, y: 0 };
  });
  edit('races/skeleton.json', (j) => {
    (j.race!.attributes as unknown as Record<string, number>).stamina = 5;
  });
  edit('races/human.json', (j) => {
    j.race!.outfit = [
      { item: 'core/work-clothes', qty: 1 },
      { item: 'core/work-hammer', qty: 1 },
      { item: 'core/reed-sandals', qty: 1 },
    ];
  });
  // a pocket that shrinks when the first task is done
  edit('pockets/north-meadow.json', (j) => {
    j.pocket!.pocket = 9;
    j.pocket!.pocket_grown = 6;
  });
  // a reward a pocket's ground lays: Pell's herbs give a basket the west bank lays, and Maru's trowel names the trowel itself in its place
  edit('quests/herbs-for-pell.json', (j) => {
    (j.quest!.reward as Record<string, unknown>).items = [{ item: 'core/basket', qty: 1 }];
  });
  edit('quests/three-fruits.json', (j) => {
    (j.quest!.reward as { items: { instead: string }[] }).items[0]!.instead = 'core/trowel';
  });
  // twigs from the ground: wood with no axe
  const ext = join(root, 'extensions', 'tester', 'resources');
  mkdirSync(ext, { recursive: true });
  writeFileSync(
    join(ext, 'twigs.json'),
    JSON.stringify({
      format: 1,
      type: 'resource',
      id: 'tester/twigs',
      title: 'Twigs',
      creator: 'tester',
      node: {
        output: 'core/branch',
        yield: 2,
        active_ms: 3000,
        respawn_ms: 40000,
        count: 2,
        sprite: 'core/base-kit:props/fallen_branches',
        level: 1,
        place: { slot: 'core/west-glade' },
      },
    }),
  );

  const result = runCheck(root);
  const text = (needle: string) => result.issues.filter((i) => i.message.includes(needle));

  it('wood from a node that needs no axe', () => {
    const lines = text('wood comes only from felling a tree');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.where).toBe('node.tool');
    expect(lines[0]!.file).toContain('twigs.json');
  });

  it("a pocket's own spot that can miss", () => {
    const lines = text('gives its one find every time');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('slid-bank-dig.json');
  });

  it("a pocket's own spot that asks for a tool its ground does not lay", () => {
    const lines = text('lays none on its ground');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('bridge-glint.json');
  });

  it("a pocket's own spot out of the fewest senses on the road to the bridge", () => {
    const lines = text('is out of the senses of the race with the fewest (1,');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('bridge-glint.json');
  });

  it('a pocket that wakes where nobody can stand', () => {
    const lines = text('is not a tile to stand on');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('slid-bank.json');
  });

  it('a pocket that is smaller once the first task is done', () => {
    const lines = text('is smaller than the pocket (9)');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('north-meadow.json');
  });

  it('a pair worth more than one band over the poorest', () => {
    const lines = text('over the poorest pair');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.message.startsWith('core/human in '))).toBe(true);
  });

  it('a race whose attributes add up to more than the total', () => {
    const lines = text('every race has exactly 7');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('skeleton.json');
    expect(lines[0]!.message).toContain('add up to 8');
  });

  it('an outfit piece above tier 1', () => {
    const lines = text('core/reed-sandals is above tier 1');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('human.json');
  });

  it('a dig that asks for a staff', () => {
    const lines = text('no work asks for a staff');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('ruins-gate.json');
  });

  it('a pocket with no axe on its ground or its spots', () => {
    const lines = text('this wake pocket gives no axe');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('west-bank.json');
  });

  it("a reward item a pocket's ground lays, with nothing named in its place", () => {
    const lines = text('name an item for it in "instead"');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('herbs-for-pell.json');
    expect(lines[0]!.message).toContain('core/west-bank');
  });

  it('an item in place of a reward that the same ground lays too', () => {
    const lines = text('lays "core/trowel" on the ground too');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('three-fruits.json');
    expect(lines[0]!.message).toContain('core/slid-bank');
  });

  it('a tree and no shop that sells an axe', () => {
    expect(text('no shop sells one')).toHaveLength(1);
  });

  it('an opening that asks for more logs than the trees give', () => {
    const lines = text('the opening asks for 99 of core/log');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.message).toContain('give 13');
  });
});
