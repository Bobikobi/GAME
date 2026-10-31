/**
 * The wild's content rows (tools/src/wild.ts; CREATURE_BEHAVIOUR section 7, HUNT_FAMILIES section 8, HUNTING section 8):
 * the core as shipped passes, the white hart fixture passes, a kind without `behaviour` stays cosmetic, and each row
 * refuses a broken copy of the core with its own line. Each world is a copy of the core with some files edited.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { MapFile, ParamsFile } from '@game/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type CheckResult, runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';
import { nearestFlusherToBolt } from '../src/wild';

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

type Edit = (root: string) => void;
type Json = Record<string, unknown>;

function world(edits: Edit[] = [], files: Record<string, object> = {}): CheckResult {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-wild-'));
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

const kindsOf = (m: MapFile) => m.map.creatures!.kinds as unknown as Record<string, Json>;
/** A core kind with some fields replaced; `behaviour` and `group` merge one level down. */
const kind = (id: string, patch: Json, behaviour: Json = {}, group: Json = {}): Edit =>
  editCore<MapFile>('map.json', (m) => {
    const k = kindsOf(m)[id]!;
    const be = (k.behaviour ?? {}) as Json;
    kindsOf(m)[id] = { ...k, ...patch, behaviour: { ...be, ...behaviour, group: { ...(be.group as Json), ...group } } };
  });
const spots = (change: (s: { kind: string; x: number; y: number }[]) => void): Edit => editCore<MapFile>('map.json', (m) => change(m.map.creatures!.spots));
const wildParam = (key: string, value: number): Edit =>
  editCore<ParamsFile>('params.json', (p) => {
    (p.params.wild as unknown as Record<string, { value: number }>)[key]!.value = value;
  });

const HART = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'white-hart.json'), 'utf8')) as { kind: Json; spot: { kind: string; x: number; y: number }; items: object[] };
const HART_ID = 'tester/white-hart';
const HART_FILES = { 'items/hart-goods.json': { format: 1, type: 'items', id: 'tester/hart-goods', title: 'Hart goods', creator: 'tester', items: HART.items } };
/** The white hart in the core map, with its spot, and its goods as the tester's items. */
const hart = (patch: Json = {}, behaviour: Json = {}): Edit =>
  editCore<MapFile>('map.json', (m) => {
    const be = HART.kind.behaviour as Json;
    kindsOf(m)[HART_ID] = { ...HART.kind, ...patch, behaviour: { ...be, ...behaviour } };
    m.map.creatures!.spots.push(HART.spot);
  });

const lines = (r: CheckResult, level: 'error' | 'warning' = 'error') =>
  r.issues.filter((i) => i.level === level && (i.where.startsWith('map.creatures') || i.where.startsWith('params.wild'))).map((i) => `${i.where}: ${i.message}`);
const has = (r: CheckResult, where: string, part: string) => lines(r).some((l) => l.startsWith(`${where}: `) && l.includes(part));
/** The schema's own refusals of one behaviour field: no content row writes its line at the field itself. */
const schemaAt = (r: CheckResult, field: string) => r.issues.filter((i) => i.level === 'error' && i.where.endsWith(`.behaviour.${field}`));

const B = (id: string) => `map.creatures.kinds.${id}.behaviour`;
const HARE = 'core/hare';
const ROE = 'core/roe';
const CROW = 'core/crow';
const WOLF = 'core/wolf';

let core: CheckResult;
beforeAll(() => {
  core = world();
});

describe('the shipped content', () => {
  it('passes: the four wild kinds of the core (hare, roe, crow, wolf) carry behaviour and the check prints no wild line', () => {
    expect(lines(core)).toEqual([]);
    expect(lines(core, 'warning')).toEqual([]);
    const kinds = core.assembled.bundle!.map.creatures!.kinds;
    for (const id of [HARE, ROE, CROW, WOLF]) expect(kinds[id]!.behaviour, id).toBeDefined();
    expect(kinds[WOLF]!.hours).toEqual([20, 5]);
    expect(core.assembled.bundle!.values['core/roe-sinew']).toBeGreaterThan(0);
  });

  it('keeps a kind without behaviour cosmetic: no row reads the sparrow, though it sits by the square', () => {
    expect(core.assembled.bundle!.map.creatures!.kinds['core/sparrow']!.behaviour).toBeUndefined();
    expect(core.issues.filter((i) => i.message.includes('core/sparrow') || i.where.includes('core/sparrow'))).toEqual([]);
  });

  it('passes the white hart fixture, priced as a fifth source', () => {
    const r = world([hart()], HART_FILES);
    expect(lines(r)).toEqual([]);
    expect(r.assembled.bundle!.values['tester/hart-antler']).toBeGreaterThan(0);
  });
});

describe('the temperament (CREATURE_BEHAVIOUR 7)', () => {
  it('refuses weights that do not sum to 100', () => {
    expect(has(world([kind(HARE, {}, { weights: { idle: 30, graze: 50, wander: 30 } })]), `${B(HARE)}.weights`, 'sum to 110')).toBe(true);
  });

  it('refuses through the schema a roam outside 6 to 14, an ear off the scale, a sight or an alarm over 12, an unknown flight', () => {
    // on the roe, which has no flush, so no content row reads these fields: the line is the schema's, at the field
    const cases: [string, number | string][] = [
      ['roam', 5],
      ['roam', 15],
      ['ear', 1],
      ['sight', 13],
      ['alarm', 13],
      ['flight', 'hop'],
    ];
    for (const [field, value] of cases) expect(schemaAt(world([kind(ROE, {}, { [field]: value })]), field).length, `${field} ${value}`).toBeGreaterThan(0);
    // the edges of the ranges pass
    const edge = world([kind(ROE, {}, { sight: 12, alarm: 12, roam: 14 })]);
    for (const field of ['sight', 'alarm', 'roam']) expect(schemaAt(edge, field), field).toEqual([]);
  });

  it('refuses a flier that sleeps in the water or in a den', () => {
    expect(has(world([kind(CROW, {}, { sleeps: 'water' })]), `${B(CROW)}.sleeps`, 'in the water')).toBe(true);
    expect(has(world([kind(CROW, {}, { sleeps: 'den' })]), `${B(CROW)}.sleeps`, 'in a den')).toBe(true);
  });

  it('refuses a habitat tag the map does not have, and the town on a wild kind', () => {
    expect(has(world([kind(ROE, {}, { habitat: ['meadow', 'interior'] })]), `${B(ROE)}.habitat`, 'no tile of the map is "interior"')).toBe(true);
    expect(has(world([kind(ROE, {}, { habitat: ['meadow', 'town'] })]), `${B(ROE)}.habitat`, 'never lives on the town')).toBe(true);
    // the crow is a town kind: its town habitat is its own ground
    expect(lines(core).some((l) => l.includes(CROW))).toBe(false);
  });

  it('refuses a scavenger at danger 0 that sleeps on the open ground', () => {
    expect(has(world([kind(ROE, {}, { carrion: true })]), `${B(ROE)}.sleeps`, 'a scavenger at danger 0')).toBe(true);
  });

  it('refuses an empty hours window and lets a night kind wrap midnight', () => {
    expect(has(world([kind(HARE, { hours: [6, 6] })]), `map.creatures.kinds.${HARE}.hours`, 'an empty window')).toBe(true);
    expect(lines(world([kind(HARE, { hours: [21, 4] })]))).toEqual([]);
  });

  it('refuses a fire_keep_night inside the fire\'s safe ring, and a town wall that shrinks at night', () => {
    const r = world([wildParam('fire_keep_night', 1), wildParam('town_keep_night', 1), wildParam('town_keep_day', 3)]);
    expect(has(r, 'params.wild.fire_keep_night', 'fire.safe_tiles + 1')).toBe(true);
    expect(has(r, 'params.wild.town_keep_night', 'town_keep_day')).toBe(true);
  });
});

describe('the group (CREATURE_BEHAVIOUR 5.1.1, 5.1.2 rule 6)', () => {
  it('refuses band weights or a season row that do not sum to 100', () => {
    const r = world([kind(ROE, {}, {}, { bands: [0, 40, 50, 0], season: { winter: [0, 10, 50, 30] } })]);
    expect(has(r, `${B(ROE)}.group.bands`, 'sum to 90')).toBe(true);
    expect(has(r, `${B(ROE)}.group.season.winter`, 'sum to 90')).toBe(true);
  });

  it('refuses a pack at danger 0', () => {
    expect(has(world([kind(ROE, {}, {}, { class: 'pack' })]), `${B(ROE)}.group.class`, 'a pack is hunters or defenders')).toBe(true);
  });

  it('refuses a flock on the ground with an alarm under 5, and lets the ground fowl\'s alarm of 5 pass', () => {
    expect(has(world([kind(ROE, {}, {}, { class: 'flock' })]), `${B(ROE)}.group.class`, 'a flock flies')).toBe(true);
    expect(lines(world([kind(ROE, {}, { alarm: 5 }, { class: 'flock' })]))).toEqual([]);
  });

  it('refuses a solitary kind with weight on small or large, in its plain row or its season, and lets the spring pair pass', () => {
    const r = world([kind(HARE, {}, {}, { bands: [90, 0, 10, 0], season: { spring: [60, 20, 0, 20] } })]);
    expect(has(r, `${B(HARE)}.group.bands`, 'no weight on small or large')).toBe(true);
    expect(has(r, `${B(HARE)}.group.season.spring`, 'no weight on small or large')).toBe(true);
    expect(lines(core).some((l) => l.includes(HARE))).toBe(false);
  });

  it('refuses a sentinel on a kind that is not a herd or a flock', () => {
    expect(has(world([kind(HARE, {}, {}, { sentinel: true })]), `${B(HARE)}.group.sentinel`, 'only a herd or a flock')).toBe(true);
    expect(lines(world([kind(ROE, {}, {}, { sentinel: true })]))).toEqual([]);
  });

  it('warns, never refuses, a band its habitat cannot hold at its cap', () => {
    const r = world([kind(WOLF, {}, { habitat: ['riverbank'] })]);
    expect(lines(r)).toEqual([]);
    expect(lines(r, 'warning').some((l) => l.startsWith(`${B(WOLF)}.group.bands: `) && l.includes('the step will cut it'))).toBe(true);
  });

  it('reads what a band can hold region by region: two regions and the map\'s own rest each too small for the roe\'s winter herd', () => {
    // the whole map's 1010 meadow tiles stand 12 roe, but the west strip holds 219, the east 412 and the middle 379
    const regions = editCore<MapFile>('map.json', (m) => {
      m.map.regions = [
        { id: 'west', x: 0, y: 0, w: 16, h: 64 },
        { id: 'east', x: 47, y: 0, w: 17, h: 64 },
      ];
    });
    const r = world([regions]);
    expect(lines(r)).toEqual([]);
    const winter = lines(r, 'warning').filter((l) => l.startsWith(`${B(ROE)}.group.season.winter: `));
    expect(winter).toHaveLength(1);
    expect(winter[0]).toContain('the best, core/world/east, has 412 habitat tiles and stands 4, so the step will cut it');
    // the plain row's heaviest band is small, 3 or more, which the east strip holds
    expect(lines(r, 'warning').some((l) => l.startsWith(`${B(ROE)}.group.bands: `))).toBe(false);
    expect(lines(core, 'warning')).toEqual([]);
  });
});

describe('the line home (HUNT_FAMILIES 3.1 and 8)', () => {
  it('refuses a flush on a kind that is not a burrower in its den at danger 0, or is protected', () => {
    expect(has(world([kind(ROE, {}, { flush: true })]), `${B(ROE)}.flush`, 'its flight is ground, not burrow, it sleeps on ground, not in a den')).toBe(true);
    expect(has(world([kind(WOLF, {}, { flush: true, flight: 'burrow' })]), `${B(WOLF)}.flush`, 'its danger is 2')).toBe(true);
    expect(has(world([kind(HARE, { protected: true, hunt: undefined })]), `${B(HARE)}.flush`, 'it is protected')).toBe(true);
  });

  it('refuses a flushable kind that sees the bolt hole from beside the mouth', () => {
    const near = nearestFlusherToBolt(core.assembled.bundle!);
    expect(near).toBe(45);
    expect(lines(core).some((l) => l.includes(`${B(HARE)}.flush`))).toBe(false);
    expect(has(world([kind(HARE, {}, { sight: 7 })]), `${B(HARE)}.flush`, 'within sight 7 of a bolt hole')).toBe(true);
  });

  it('refuses a den with no bolt hole on open habitat 8 to 10 tiles out', () => {
    const r = world([kind(HARE, {}, { habitat: ['interior'] })]);
    for (const i of [13, 14]) expect(has(r, `map.creatures.spots.${i}`, 'has no bolt hole: no open interior tile 8 to 10 tiles away')).toBe(true);
  });

  it('refuses a den whose ring is open meadow the hare cannot reach: a ring of water round the mouth', () => {
    // spot 13 is the hare at 3,9; water on every tile 5 from it (Chebyshev) walls the mouth off from the whole ring
    const moat = editCore<MapFile>('map.json', (m) => {
      m.map.ground = m.map.ground.map((row, y) => [...row].map((c, x) => (Math.max(Math.abs(x - 3), Math.abs(y - 9)) === 5 ? '~' : c)).join(''));
    });
    const r = world([moat]);
    expect(has(r, 'map.creatures.spots.13', "core/hare's den at 3,9 has no bolt hole: no open meadow tile 8 to 10 tiles away that it can run to")).toBe(true);
    expect(lines(r).some((l) => l.startsWith('map.creatures.spots.14: '))).toBe(false);
  });

  it('refuses a bolt hole ring that runs inward', () => {
    expect(has(world([wildParam('bolt_min_tiles', 10), wildParam('bolt_max_tiles', 8)]), 'params.wild.bolt_min_tiles', 'at or under the second')).toBe(true);
  });
});

describe('the spots (HUNTING 8, CREATURE_BEHAVIOUR 4)', () => {
  it('refuses a spot for a kind at danger 2 until the fight', () => {
    expect(has(world([spots((s) => s.push({ kind: WOLF, x: 44, y: 16 }))]), 'map.creatures.spots.34', 'hunts the player (danger 2)')).toBe(true);
  });

  it('refuses a wild spot within 12 tiles of the town square, or on safe ground', () => {
    expect(has(world([spots((s) => s.push({ kind: HARE, x: 20, y: 15 }))]), 'map.creatures.spots.34', 'within 12 tiles of core/town-square')).toBe(true);
    const safe = editCore<MapFile>('map.json', (m) => {
      m.map.slots.push({ id: 'core/test-safe', kind: 'area', x: 42, y: 14, w: 5, h: 5, safe: true } as MapFile['map']['slots'][number]);
    });
    expect(has(world([safe]), 'map.creatures.spots.14', 'on safe ground')).toBe(true);
  });

  it('refuses a drinker with no water within its roam', () => {
    expect(has(world([spots((s) => s.push({ kind: ROE, x: 44, y: 11 }))]), 'map.creatures.spots.34', 'drinks but no water')).toBe(true);
  });

  it('refuses a second anchor of one kind on one tile, since the anchor id keys every draw', () => {
    const r = world([spots((s) => s.push({ kind: HARE, x: 44, y: 16 }))]);
    expect(has(r, 'map.creatures.spots.34', 'a second core/hare anchor on 44,16, after spot 14')).toBe(true);
    expect(lines(r).some((l) => l.startsWith('map.creatures.spots.14: '))).toBe(false);
    // two kinds on one tile are two anchors with two ids
    expect(lines(world([spots((s) => s.push({ kind: ROE, x: 44, y: 16 }))])).some((l) => l.includes('a second'))).toBe(false);
  });
});

describe('the families (HUNT_FAMILIES 4, 7 and 8)', () => {
  it('names one of the eighteen families, through the schema', () => {
    expect(schemaAt(world([kind(HARE, {}, { family: 'rodents' })]), 'family').length).toBeGreaterThan(0);
  });

  it('refuses a family whose members wear two bodies; on a tie it names every member', () => {
    const r = world([hart({ look: 'bird' })], HART_FILES);
    expect(has(r, `map.creatures.kinds.${HART_ID}.look`, 'the deer share one body: core/roe is deer, tester/white-hart is bird')).toBe(true);
    expect(has(r, `map.creatures.kinds.${ROE}.look`, 'the deer share one body')).toBe(true);
  });

  it('names the member off the body most of its family wears, also when that member is the core\'s', () => {
    const elk = editCore<MapFile>('map.json', (m) => {
      kindsOf(m)['tester/elk'] = { ...HART.kind, hunt: undefined };
    });
    const r = world([hart(), elk, kind(ROE, { look: 'rabbit' })], HART_FILES);
    expect(has(r, `map.creatures.kinds.${ROE}.look`, 'the deer share one body, deer: core/roe is rabbit, tester/elk is deer, tester/white-hart is deer')).toBe(true);
    expect(lines(r).filter((l) => l.includes('share one body'))).toHaveLength(1);
  });

  it('refuses a harder member that is quicker to take', () => {
    const quick = { ...(HART.kind.hunt as Json), take_s: 60 };
    expect(has(world([hart({ hunt: quick })], HART_FILES), `map.creatures.kinds.${HART_ID}.hunt.take_s`, 'a harder member takes longer')).toBe(true);
  });
});
