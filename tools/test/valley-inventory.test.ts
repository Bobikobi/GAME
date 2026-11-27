/** The valley inventory: one row per thing a player meets, its art state read from the kit (Track #899). */
import { describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { CLIP_VERBS, CLIP_VIEWS } from '@game/schema';
import type { Assembled } from '../src/assemble';
import { runCheck } from '../src/check';
import { artOf, buildInventory, checkLine, COUNTED, edgeCounts, renderJson, renderMarkdown, sfxIdsOf, STATES, summaryLine, type Row } from '../src/valley-inventory';

type Sprites = Assembled['kits'][string]['sprites'];

const sprite = (over: Record<string, unknown> = {}) => ({ file: 'x.png', w: 64, h: 64, frames: 1, density: 4, ...over });

const SPRITES: Sprites = {
  'props/tree': sprite(),
  'props/old': sprite({ density: 1, w: 16, h: 16 }),
  'chars/elf_down': sprite({ frames: 16, stride: { travel_mpx: 100, anchor: [8, 8] } }),
  'chars/elf_up': sprite({ frames: 16, stride: { travel_mpx: 100, anchor: [8, 8] } }),
  'chars/elf_left': sprite({ frames: 16, stride: { travel_mpx: 100, anchor: [8, 8] } }),
  'chars/elf_strike_front': sprite({ frames: 9, clip: { race: 'core/elf', view: 'front', verb: 'strike', frame_ms: 60, anchor: [8, 8] } }),
  'creatures/roe': sprite({ frames: 4 }),
  'tiles/grass': sprite(),
  'tiles/water': sprite(),
  'tiles/bank_e': sprite(),
  'tiles/bank_w': sprite(),
  'items/axe': sprite(),
} as unknown as Sprites;

const KITS = { 'core/base-kit': { dir: '/kit', rel: 'content/kit/core', sprites: SPRITES } } as unknown as Assembled['kits'];

const SFX = `export type SfxId = 'strike' | 'ghost';\nswitch (id) {\n case 'strike': return 1;\n}`;

/** A tiny valley: grass and water, two props (one rich, one 16 px), one that does not resolve, a roe, a hare with no art. */
function fixture(): Assembled {
  const bundle = {
    map: {
      id: 'core/world',
      width: 3,
      height: 2,
      legend: {
        '.': { sprite: 'core/base-kit:tiles/grass', solid: false, tag: 'meadow' },
        '~': { sprite: 'core/base-kit:tiles/water', solid: true, tag: 'water' },
      },
      ground: ['.~.', '.~.'],
      props: [
        { sprite: 'core/base-kit:props/tree', x: 0, y: 0, w: 1, h: 1, solid: true },
        { sprite: 'core/base-kit:props/old', x: 2, y: 0, w: 1, h: 1, solid: true, id: 'core/old-post' },
        { sprite: 'core/base-kit:props/ghost', x: 2, y: 1, w: 1, h: 1, solid: true },
      ],
      creatures: {
        kinds: { 'core/roe': { look: 'deer' }, 'core/hare': { look: 'rabbit', hunt: { drops: [{ item: 'core/fur', qty: 1, share_pct: 100 }] } } },
        spots: [
          { kind: 'core/roe', x: 0, y: 1 },
          { kind: 'core/hare', x: 1, y: 1 },
        ],
      },
      stones: { spots: [] },
      slots: [{ id: 'core/elder-house', kind: 'npc', x: 0, y: 0, w: 1, h: 1 }],
      cards: [{ id: 'c', ambience: { day: 'day', night: 'night' } }],
      plan: { regions: [{ id: 'core/bank', cover: { 'core/base-kit:props/tree': 10 } }] },
    },
    params: { liftables: {} },
    sprites: { 'core/base-kit:tiles/bank_e': {}, 'core/base-kit:tiles/bank_w': {} },
    instances: {},
    resources: {},
    treasures: {},
    searchables: {},
    recipes: { 'core/r': { outputs: [{ item: 'core/axe', qty: 1 }] } },
    shops: {},
    quests: { 'core/q': { id: 'core/q', type: 'riddle', giver: 'core/elder', file: 'content/core/quests/q.json', reward: {} } },
    expeditions: {},
    pockets: {},
    npcs: { 'core/elder': { sprite: 'core/base-kit:props/old', place: { slot: 'core/elder-house' } } },
    camps: {},
    restores: {},
    passages: {},
    races: { 'core/elf': { id: 'core/elf', sprite: 'core/base-kit:chars/elf_down' } },
    items: {
      'core/axe': { sprite: 'core/base-kit:items/axe', file: 'content/core/items/tools.json' },
      'core/fur': { sprite: 'core/base-kit:items/axe', file: 'content/core/items/goods.json' },
      'core/lost': { sprite: 'core/base-kit:items/axe', file: 'content/core/items/goods.json' },
    },
  } as unknown as Bundle;
  return { bundle, kits: KITS, issues: [], origin: { 'core/elder': 'content/core/npcs/elder.json', 'core/world': 'content/core/map.json' } };
}

const reads = { fileExists: () => true, sfxSource: SFX };
const byId = (rows: Row[], id: string): Row => rows.find((r) => r.id === id)!;

describe('artOf', () => {
  it('reads the state from the kit entry', () => {
    expect(artOf(KITS, 'core/base-kit:props/tree', reads).state).toBe('rich');
    expect(artOf(KITS, 'core/base-kit:props/old', reads).state).toBe('16px');
    expect(artOf(KITS, 'core/base-kit:chars/elf_strike_front', reads)).toMatchObject({ state: 'drawn clip', frames: 9 });
    expect(artOf(KITS, 'core/base-kit:chars/elf_down', reads)).toMatchObject({ state: 'drawn clip', frames: 16 });
  });
  it('says missing for a reference that does not resolve, and for a PNG that is not on disk', () => {
    expect(artOf(KITS, 'core/base-kit:props/ghost', reads).state).toBe('missing');
    expect(artOf(KITS, 'nokit:props/tree', reads).state).toBe('missing');
    expect(artOf(KITS, undefined, reads).state).toBe('missing');
    expect(artOf(KITS, 'core/base-kit:props/tree', { fileExists: () => false }).state).toBe('missing');
  });
});

describe('sfxIdsOf', () => {
  it('lists the type\'s ids and the ones playSfx has a case for', () => {
    const { ids, cased } = sfxIdsOf(SFX);
    expect(ids).toEqual(['strike', 'ghost']);
    expect([...cased]).toEqual(['strike']);
  });
});

describe('buildInventory on a synthetic valley', () => {
  const inv = buildInventory(fixture(), reads);

  it('puts every placed thing in a row with its tile and its state', () => {
    expect(byId(inv.rows, 'props/tree@0,0')).toMatchObject({ kind: 'prop', where: '0,0', state: 'rich' });
    expect(byId(inv.rows, 'core/old-post')).toMatchObject({ kind: 'prop', where: '2,0', state: '16px', source: 'content/core/map.json' });
    expect(byId(inv.rows, 'props/ghost@2,1').state).toBe('missing');
    expect(byId(inv.rows, 'core/base-kit:tiles/grass')).toMatchObject({ kind: 'tile', where: '4 tiles', state: 'rich' });
    expect(byId(inv.rows, 'core/elder')).toMatchObject({ kind: 'npc', where: '0,0', state: '16px', source: 'content/core/npcs/elder.json' });
  });

  it('lays the ground edges by the neighbour\'s tag, per side, as the world does', () => {
    // water at x=1: its bank pieces face the meadow on the east and west, two rows deep; the meadow has no path beside it, so no worn piece
    const edges = edgeCounts(fixture().bundle!);
    expect([...edges]).toEqual([['core/base-kit:tiles/bank_e', 2], ['core/base-kit:tiles/bank_w', 2]]);
    expect(byId(inv.rows, 'core/base-kit:tiles/bank_e')).toMatchObject({ kind: 'edge', where: '2 tile sides', state: 'rich' });
  });

  it('resolves a creature by its still, and says missing when it has none', () => {
    expect(byId(inv.rows, 'core/roe@0,1')).toMatchObject({ kind: 'creature', state: 'rich' });
    expect(byId(inv.rows, 'core/hare@1,1')).toMatchObject({ kind: 'creature', state: 'missing' });
  });

  it('has a row per verb, race and view for the figure: a clip with no sheet is code-drawn, one with a sheet is a drawn clip', () => {
    const clips = inv.rows.filter((r) => r.kind === 'figure clip' && r.id.startsWith('core/elf:') && !r.id.includes(':walk'));
    expect(clips).toHaveLength(CLIP_VERBS.length * CLIP_VIEWS.length);
    expect(byId(inv.rows, 'core/elf:strike:front')).toMatchObject({ state: 'drawn clip', frames: 9 });
    expect(byId(inv.rows, 'core/elf:strike:back').state).toBe('code-drawn');
    expect(inv.rows.filter((r) => r.id.startsWith('core/elf:walk:')).map((r) => r.state)).toEqual(['drawn clip', 'drawn clip', 'drawn clip']);
  });

  it('lists an item only when something gives, makes, sells or drops it, and names the way', () => {
    expect(byId(inv.rows, 'core/axe')).toMatchObject({ kind: 'item', where: 'carried', state: 'rich', note: expect.stringContaining('made') });
    expect(byId(inv.rows, 'core/fur').note).toContain('hunted');
    expect(inv.rows.some((r) => r.id === 'core/lost')).toBe(false);
    expect(inv.unsourced_items).toEqual(['core/lost']);
  });

  it('gives a quest the giver\'s tile and no art state to count', () => {
    expect(byId(inv.rows, 'core/q')).toMatchObject({ kind: 'quest', where: '0,0', state: 'n/a' });
  });

  it('marks a sound the type names but playSfx cannot play as missing, and the rest as n/a', () => {
    expect(byId(inv.rows, 'sfx:strike').state).toBe('n/a');
    expect(byId(inv.rows, 'sfx:ghost').state).toBe('missing');
    expect(byId(inv.rows, 'ambience:day').kind).toBe('sound');
  });

  it('counts only the rows with art, and the counts sum to the rows', () => {
    expect(inv.counts['n/a']).toBe(inv.rows.filter((r) => r.state === 'n/a').length);
    expect(STATES.reduce((n, s) => n + inv.counts[s]!, 0)).toBe(inv.rows.length);
    expect(summaryLine(inv)).toMatch(new RegExp(`^${inv.rows.length} rows \\(${COUNTED.reduce((n, s) => n + inv.counts[s]!, 0)} with art`));
    expect(checkLine(inv)).toContain('valley inventory:');
  });

  it('writes the same text twice: sorted, with no clock and no absolute path', () => {
    const again = buildInventory(fixture(), reads);
    expect(renderMarkdown(again)).toBe(renderMarkdown(inv));
    expect(renderJson(again)).toBe(renderJson(inv));
    expect(renderMarkdown(inv)).toMatch(/^<!-- GENERATED by `pnpm valley:inventory`/);
    expect(renderJson(inv)).not.toMatch(/\/home\/|\/mnt\//);
  });
});

describe('the real content', () => {
  const assembled = runCheck().assembled;
  const inv = buildInventory(assembled);

  it('has valid states, unique ids and counts that sum to the rows', () => {
    expect(inv.rows.length).toBeGreaterThan(0);
    for (const r of inv.rows) expect(STATES).toContain(r.state);
    expect(new Set(inv.rows.map((r) => `${r.kind}|${r.id}`)).size).toBe(inv.rows.length);
    expect(STATES.reduce((n, s) => n + inv.counts[s]!, 0)).toBe(inv.rows.length);
  });

  it('has a row for every placed prop, node, stone and creature spot of the map', () => {
    const b = assembled.bundle!;
    const kinds = (k: string) => inv.rows.filter((r) => r.kind === k).length;
    expect(kinds('prop')).toBe(b.map.props.length);
    expect(kinds('node') + kinds('dig spot')).toBe(Object.keys(b.instances).length);
    expect(kinds('stone')).toBe(b.map.stones?.spots.length ?? 0);
    expect(kinds('creature')).toBe(b.map.creatures?.spots.length ?? 0);
    expect(kinds('npc')).toBe(Object.keys(b.npcs).length);
    expect(kinds('quest')).toBe(Object.keys(b.quests).length);
  });

  it('holds the ground edges to the map: every edge sprite is one the kit has', () => {
    for (const ref of edgeCounts(assembled.bundle!).keys()) expect(assembled.bundle!.sprites[ref], ref).toBeDefined();
  });

  it('writes the same text twice', () => {
    expect(renderMarkdown(buildInventory(assembled))).toBe(renderMarkdown(inv));
  });
});
