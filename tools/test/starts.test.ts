/**
 * Wood, the starts and the rewards they get (DECISIONS.md, 2026-10-10): the core
 * content passes with no line, and a fixture that breaks each rule gets an error that names it.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';

describe('the core content', () => {
  it('passes with no line: trees give the wood, every start holds or finds an axe, Pell sells another', () => {
    const result = runCheck();
    // the richness lines are an advisory count (tools/src/richness.ts), not a defect of the content
    expect(result.issues.filter((i) => !i.where.startsWith('map.richness'))).toEqual([]);
    const b = result.assembled.bundle!;
    expect(b.resources['core/oak-trees']!.tool).toBe('axe');
    expect(Object.keys(b.starters).sort()).toEqual(['core/digger', 'core/explorer', 'core/forager']);
    const axe = (item: string) => b.items[item]?.tool?.kind === 'axe';
    const found = (id: string) => Object.values(b.treasures).some((t) => t.starter === id && t.finds.some((f) => axe(f.item)));
    expect(Object.values(b.starters).every((s) => (s.kit ?? []).some((k) => axe(k.item)) || found(s.id))).toBe(true);
  });
});

describe('a fixture that breaks each rule', () => {
  const root = mkdtempSync(join(tmpdir(), 'openfold-starts-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });

  const edit = (file: string, change: (json: Record<string, Record<string, unknown>>) => void) => {
    const path = join(root, 'core', file);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    change(json);
    writeFileSync(path, JSON.stringify(json, null, 2));
  };
  // a start with no axe, no shop that sells one, and a fire that asks for more logs than the valley's trees give
  edit('starters/forager.json', (j) => {
    j.starter!.kit = [{ item: 'core/basket', qty: 1 }];
  });
  edit('shops/trader-shop.json', (j) => {
    j.shop!.sells = (j.shop!.sells as { item: string }[]).filter((o) => o.item !== 'core/axe');
  });
  edit('camp/campfire.json', (j) => {
    j.camp!.inputs = [{ item: 'core/log', qty: 99 }];
  });
  // a start's own spot that can miss, one that asks for a tool its start lacks and lies off its road,
  // and a start that wakes in the forest with a kit twice the others' and a point more (no shop sells an axe, so a found axe prices nothing)
  edit('treasures/slid-bank.json', (j) => {
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
  edit('starters/digger.json', (j) => {
    j.starter!.wake = { x: 0, y: 0 };
    j.starter!.kit = [{ item: 'core/trowel', qty: 1 }, { item: 'core/basket', qty: 1 }];
    (j.starter!.attributes as unknown as Record<string, number>).stamina = 3;
  });
  // a pocket that shrinks when the first task is done
  edit('starters/explorer.json', (j) => {
    j.starter!.pocket = 9;
    j.starter!.pocket_grown = 6;
  });
  // a reward a kit repeats: Pell's herbs give a basket two kits hold, and the digger, whose kit holds Maru's trowel, gets a basket it holds too
  edit('quests/herbs-for-pell.json', (j) => {
    (j.quest!.reward as Record<string, unknown>).items = [{ item: 'core/basket', qty: 1 }];
  });
  edit('quests/three-fruits.json', (j) => {
    (j.quest!.reward as { items: { instead: string }[] }).items[0]!.instead = 'core/basket';
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

  it("a start's own spot that can miss", () => {
    const lines = text('gives its one find every time');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('slid-bank.json');
  });

  it("a start's own spot that asks for a tool the start does not wake with", () => {
    const lines = text('does not wake with one');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('bridge-glint.json');
  });

  it("a start's own spot out of its senses on the road to the bridge", () => {
    const lines = text('is out of the senses of "core/explorer"');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('bridge-glint.json');
  });

  it('a start that wakes where nobody can stand', () => {
    const lines = text('is not a tile to stand on');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('digger.json');
  });

  it('a pocket that is smaller once the first task is done', () => {
    const lines = text('is smaller than the pocket (9)');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('explorer.json');
  });

  it('a start worth more than one band over the poorest', () => {
    const lines = text('over the poorest start (30000 mg)');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('digger.json');
  });

  it('a start whose attributes add up to more than the others', () => {
    const lines = text('one attribute total');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('digger.json');
    expect(lines[0]!.message).toContain('add up to 7');
  });

  it('a dig that asks for a staff', () => {
    const lines = text('no work asks for a staff');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('ruins-gate.json');
  });

  it('a start with no axe in its kit', () => {
    const lines = text('this start holds no axe');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('forager.json');
  });

  it('a reward item a kit already holds, with nothing named in its place', () => {
    const lines = text('name an item for it in "instead"');
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.file.includes('herbs-for-pell.json'))).toBe(true);
  });

  it('an item in place of a reward that the same kit holds too', () => {
    const lines = text('holds "core/basket" too');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('three-fruits.json');
    expect(lines[0]!.message).toContain('core/digger');
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
