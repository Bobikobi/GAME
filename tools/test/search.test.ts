/**
 * The search checks (tools/src/search.ts; docs/design/SEARCH.md): the core's three searchables pass; a bundle or
 * a content folder that breaks a rule gets an error that names it. Every row is an item with a value, the prop a
 * searchable hangs on exists, and none stands within the opening's first-path area.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Bundle } from '@game/kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';
import { OPENING_MARGIN, checkSearch, nearOpening, openingRects } from '../src/search';

let core: Bundle;
beforeAll(() => {
  core = runCheck().assembled.bundle!;
});

const messages = (b: Bundle) => checkSearch(b, {}).map((i) => `${i.where}: ${i.message}`);

describe('the core searchables', () => {
  it('pass every search check, and the check reports nothing else about them', () => {
    expect(checkSearch(core, {})).toEqual([]);
    expect(runCheck().issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('stand beyond the margin of the opening: the road, every wake tile, the first tasks and the first mending', () => {
    const area = openingRects(core);
    expect(area.length).toBeGreaterThan(50);
    for (const p of Object.values(core.pockets)) expect(nearOpening({ x: p.wake.x, y: p.wake.y, w: 1, h: 1 }, area)).toBe(true);
    const bridge = core.map.slots.find((s) => s.id === core.restores['core/old-bridge']!.place.slot)!;
    expect(nearOpening(bridge, area)).toBe(true);
    for (const sr of Object.values(core.searchables)) {
      const prop = core.map.props.find((p) => p.id === sr.place.prop)!;
      expect(nearOpening(prop, area), sr.id).toBe(false);
    }
  });
});

describe('a searchable that breaks a rule', () => {
  it('a row whose item has no value', () => {
    const b = structuredClone(core);
    b.items['x/odd'] = { ...b.items['core/stone']!, id: 'x/odd' };
    b.searchables['core/hollow-log']!.rows.push({ item: 'x/odd', chance_pct: 5 });
    expect(messages(b)).toContainEqual(expect.stringContaining('search.rows.4.item: x/odd has no value'));
  });

  it('a prop within the margin of the road or of a wake tile', () => {
    const b = structuredClone(core);
    const prop = b.map.props.find((p) => p.id === 'core/hollow-log')!;
    prop.x = b.pockets['core/west-bank']!.wake.x + 1;
    prop.y = b.pockets['core/west-bank']!.wake.y;
    expect(messages(b)).toContainEqual(expect.stringContaining(`within ${OPENING_MARGIN} tiles of the opening's first path`));
    prop.x = 24;
    prop.y = 16;
    expect(messages(b)).toContainEqual(expect.stringContaining('SEARCH.md rule 9'));
  });
});

describe('a content folder that breaks a rule', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-search-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });

  const mapPath = join(root, 'core', 'map.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as { map: { props: Record<string, unknown>[] } };
  const prop = (id: string, extra: Record<string, unknown> = {}) => ({ id, sprite: 'core/base-kit:props/log_mossy', x: 41, y: 7, w: 1, h: 1, solid: true, ...extra });
  map.map.props.push(prop('core/test-a'), prop('core/test-sign', { x: 42, y: 7, sign: 'core/old-bridge' }));
  writeFileSync(mapPath, JSON.stringify(map, null, 2));

  const dir = join(root, 'extensions', 'tester', 'treasures');
  mkdirSync(dir, { recursive: true });
  const file = (name: string, body: Record<string, unknown>) =>
    writeFileSync(join(dir, `${name}.json`), JSON.stringify({ format: 1, type: 'treasure', id: `tester/${name}`, title: 'A test', creator: 'tester', ...body }));
  const search = (prop: string, item = 'core/berry') => ({ rows: [{ item, chance_pct: 10 }], place: { prop } });
  const dig = { hint: 'x', active_ms: 1000, respawn_ms: 60000, count: 1, level: 1, finds: [{ item: 'core/stone', chance_pct: 10, share_pct: 100 }], place: { slot: 'core/ruins-gate' } };
  file('good', { search: search('core/test-a') });
  file('twice', { search: search('core/test-a') });
  file('both', { dig, search: search('core/test-a', 'core/stone') });
  file('neither', {});
  file('no-prop', { search: search('core/nowhere') });
  file('sign', { search: search('core/test-sign') });
  file('no-item', { search: search('core/test-a', 'core/nothing') });

  const issues = runCheck(root).issues;
  const about = (name: string) => issues.filter((i) => i.file.includes(`${name}.json`)).map((i) => `${i.where}: ${i.message}`);

  it('a good searchable passes; a prop searched through two files, a missing prop and a missing item are told', () => {
    expect(about('good')).toEqual([]);
    expect(about('twice')).toContainEqual(expect.stringContaining('already searched through tester/good'));
    expect(about('no-prop')).toContainEqual(expect.stringContaining('no prop "core/nowhere" on the map'));
    expect(about('no-item')).toContainEqual(expect.stringContaining('no item "core/nothing" exists'));
  });

  it('a prop that already does something else (a sign) is refused', () => {
    expect(about('sign')).toContainEqual(expect.stringContaining('already does something else'));
  });

  it('a file with both dig and search, or with neither, is refused', () => {
    expect(about('both')).toContainEqual(expect.stringContaining('carries "dig"'));
    expect(about('neither')).toContainEqual(expect.stringContaining('carries "dig"'));
  });
});
