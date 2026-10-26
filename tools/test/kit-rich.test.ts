/**
 * The whole game is rich (DECISIONS 2026-10-23): a sprite is drawn at 64 px per tile, the core kit's 16 px
 * sprites wait on a list that only shrinks, and every kit:gen spec of the repo draws in the rich style.
 */
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { parseSpec } from '../src/kit/gen';
import { applyInk } from '../src/kit/ink';
import { CORE_KIT, SIXTEEN_PX_LEFT, richProblem, staleLeft } from '../src/kit/rich';
import { CONTENT_DIR, REPO_ROOT } from '../src/load';

const core = (JSON.parse(readFileSync(join(CONTENT_DIR, 'kit/core/kit.json'), 'utf8')) as { kit: { sprites: Record<string, { density?: number }> } }).kit.sprites;
const first = SIXTEEN_PX_LEFT[0]!;

describe('the list of 16 px sprites still waiting', () => {
  it('is sorted, names each sprite once, and names only core sprites still at density 1', () => {
    expect([...SIXTEEN_PX_LEFT]).toEqual([...SIXTEEN_PX_LEFT].sort());
    expect(new Set(SIXTEEN_PX_LEFT).size).toBe(SIXTEEN_PX_LEFT.length);
    expect(staleLeft(core)).toEqual([]);
    for (const name of SIXTEEN_PX_LEFT) expect(core[name]?.density ?? 1, name).toBe(1);
  });

  it('holds every 16 px sprite of the core kit, so the kit of today passes as it is', () => {
    const sixteen = Object.entries(core).filter(([, s]) => (s.density ?? 1) === 1).map(([name]) => name);
    expect(sixteen.sort()).toEqual([...SIXTEEN_PX_LEFT]);
  });

  it('names a sprite the kit no longer holds as stale', () => {
    const { [first]: _gone, ...rest } = core;
    expect(staleLeft(rest)).toEqual([first]);
  });
});

describe('richProblem', () => {
  it('takes a 16 px sprite only from the core kit list', () => {
    expect(richProblem(CORE_KIT, first, {})).toBeUndefined();
    expect(richProblem(CORE_KIT, 'props/new_thing', {})).toMatch(/16 px per tile.*the whole game is rich/);
    expect(richProblem('creator/kit', first, { density: 1 })).toMatch(/16 px per tile/);
  });

  it('asks a listed sprite drawn at 64 to leave the list, and a rich sprite of the core kit to name its ramps', () => {
    expect(richProblem(CORE_KIT, first, { density: 4, ramps: ['grey'] })).toMatch(/take it off SIXTEEN_PX_LEFT/);
    expect(richProblem(CORE_KIT, 'items/new_thing', { density: 4 })).toMatch(/names no ramps/);
    expect(richProblem(CORE_KIT, 'items/new_thing', { density: 4, ramps: ['grey'] })).toBeUndefined();
    expect(richProblem('creator/kit', 'items/new_thing', { density: 4 })).toBeUndefined();
  });

  it('leaves a density of neither grid to the size rule', () => {
    expect(richProblem(CORE_KIT, 'items/new_thing', { density: 2 })).toBeUndefined();
  });
});

describe('the check, end to end', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-rich-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });

  const png = (file: string, w: number, h: number) => {
    const image = new PNG({ width: w, height: h });
    for (let i = 0; i < image.data.length; i += 4) image.data.set([0x4c, 0x9a, 0x3f, 255], i);
    // the ink edge (tools/src/kit/ink.ts) is held too, so the fixture carries it
    writeFileSync(join(root, 'kit', 'core', file), applyInk(PNG.sync.write(image), w));
  };
  png('props/rich_16.png', 16, 16);
  png('props/rich_64.png', 64, 64);
  png('props/rich_64_ramps.png', 64, 64);

  const kitPath = join(root, 'kit', 'core', 'kit.json');
  const kit = JSON.parse(readFileSync(kitPath, 'utf8')) as { kit: { sprites: Record<string, unknown> } };
  kit.kit.sprites['props/rich_16'] = { file: 'props/rich_16.png', w: 16, h: 16 };
  kit.kit.sprites['props/rich_64'] = { file: 'props/rich_64.png', w: 64, h: 64, density: 4 };
  kit.kit.sprites['props/rich_64_ramps'] = { file: 'props/rich_64_ramps.png', w: 64, h: 64, density: 4, ramps: ['green'] };
  writeFileSync(kitPath, JSON.stringify(kit, null, 2));

  const errors = runCheck(root).issues.filter((i) => i.level === 'error').map((i) => `${i.where}: ${i.message}`);

  it('refuses a new 16 px sprite and a rich one that names no ramps, and takes a rich one that does', () => {
    expect(errors.some((m) => m.startsWith('kit.sprites.props/rich_16:') && m.includes('the whole game is rich'))).toBe(true);
    expect(errors.some((m) => m.startsWith('kit.sprites.props/rich_64:') && m.includes('names no ramps'))).toBe(true);
    expect(errors.filter((m) => m.includes('rich_64_ramps'))).toEqual([]);
  });

  it('passes the kit of today with no rich error', () => {
    expect(errors.filter((m) => !m.includes('props/rich_') && (m.includes('the whole game is rich') || m.includes('SIXTEEN_PX_LEFT') || m.includes('names no ramps')))).toEqual([]);
  });
});

describe('every kit:gen spec of the repo', () => {
  it('parses, so a spec in the retired style fails here and not only when someone draws with it', () => {
    const dir = join(REPO_ROOT, 'tools/kit-gen');
    const specs = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(specs.length).toBeGreaterThan(0);
    for (const f of specs) expect(() => parseSpec(readFileSync(join(dir, f), 'utf8')), f).not.toThrow();
  });
});
