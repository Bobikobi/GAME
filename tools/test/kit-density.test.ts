/**
 * The two grids of the kit (NEXT 15, DECISIONS 2026-10-18): 16 art pixels per tile (density 1, the default)
 * and 64 (density 4). The check accepts each size at its density and refuses a mixed one; the bundle carries
 * the density to the client.
 */
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck, spriteSizeProblem } from '../src/check';
import { CONTENT_DIR } from '../src/load';

describe('spriteSizeProblem', () => {
  it('accepts every group at density 1, the default', () => {
    for (const [name, w, h] of [
      ['tiles/grass', 16, 16],
      ['items/axe', 16, 16],
      ['chars/pell', 16, 24],
      ['chars/pell_work_down', 32, 32],
      ['props/oak', 32, 48],
      ['props/big', 64, 64],
    ] as const) {
      expect(spriteSizeProblem(name, { w, h }), name).toBeUndefined();
    }
  });

  it('accepts every group at density 4', () => {
    for (const [name, w, h] of [
      ['tiles/grass', 64, 64],
      ['items/axe', 64, 64],
      ['chars/pell', 64, 96],
      ['chars/pell_work_down', 128, 128],
      ['props/oak', 128, 192],
      ['props/six_tiles', 384, 384],
    ] as const) {
      expect(spriteSizeProblem(name, { w, h, density: 4 }), name).toBeUndefined();
    }
  });

  it('refuses a size that belongs to the other density, and says which', () => {
    expect(spriteSizeProblem('tiles/grass', { w: 64, h: 64 })).toContain('set "density": 4');
    expect(spriteSizeProblem('chars/pell', { w: 16, h: 24, density: 4 })).toContain('set "density": 1');
    expect(spriteSizeProblem('chars/pell_work_down', { w: 32, h: 32, density: 4 })).toContain('density 1 size');
    expect(spriteSizeProblem('props/oak', { w: 128, h: 192 })).toBeDefined();
    expect(spriteSizeProblem('props/oak', { w: 65, h: 64, density: 4 })).toBeUndefined();
  });

  it('refuses a size of neither grid', () => {
    const problem = spriteSizeProblem('tiles/grass', { w: 32, h: 32, density: 4 });
    expect(problem).toContain('tiles are 64x64 at density 4');
    expect(problem).not.toContain('set "density"');
    expect(spriteSizeProblem('chars/pell', { w: 16, h: 16 })).toContain('character frames are 16x24 at density 1 (64x96 at density 4)');
  });
});

describe('density in a kit', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-density-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });

  const png = (name: string, w: number, h: number) => {
    const image = new PNG({ width: w, height: h });
    for (let i = 0; i < image.data.length; i += 4) image.data.set([0x4c, 0x9a, 0x3f, 255], i);
    writeFileSync(join(root, 'kit', 'core', 'tiles', name), PNG.sync.write(image));
  };
  png('dense_ok.png', 64, 64);
  png('dense_forgot.png', 64, 64);
  png('dense_item_wrong.png', 16, 16);

  const kitPath = join(root, 'kit', 'core', 'kit.json');
  const kit = JSON.parse(readFileSync(kitPath, 'utf8')) as { kit: { sprites: Record<string, unknown> } };
  kit.kit.sprites['tiles/dense_ok'] = { file: 'tiles/dense_ok.png', w: 64, h: 64, density: 4, ramps: ['green'] };
  kit.kit.sprites['tiles/dense_forgot'] = { file: 'tiles/dense_forgot.png', w: 64, h: 64 };
  kit.kit.sprites['tiles/dense_small'] = { file: 'tiles/dense_item_wrong.png', w: 16, h: 16, density: 4 };
  writeFileSync(kitPath, JSON.stringify(kit, null, 2));

  const result = runCheck(root);
  const errors = result.issues.filter((i) => i.level === 'error').map((i) => `${i.where}: ${i.message}`);

  it('takes the 64 grid at density 4 and refuses a mixed one', () => {
    expect(errors.filter((m) => m.includes('dense_ok'))).toEqual([]);
    expect(errors.some((m) => m.startsWith('kit.sprites.tiles/dense_forgot') && m.includes('set "density": 4'))).toBe(true);
    expect(errors.some((m) => m.startsWith('kit.sprites.tiles/dense_small') && m.includes('set "density": 1'))).toBe(true);
  });

  it('carries density into the bundle, 1 for a sprite that says nothing', () => {
    const sprites = result.assembled.bundle?.sprites ?? {};
    expect(sprites['core/base-kit:tiles/dense_ok']?.density).toBe(4);
    expect(sprites['core/base-kit:tiles/dense_forgot']?.density).toBe(1);
    const others = Object.entries(sprites).filter(([k]) => !k.includes('dense_'));
    expect(others.length).toBeGreaterThan(100);
    // every real sprite carries what its kit entry says, 1 where it says nothing (the rich wave landed density-4 picks);
    // every kit is read, the core's and each creator's, so a creator's own 64 px art is held to its own entry
    const declared: Record<string, { density?: number }> = {};
    for (const dir of readdirSync(join(CONTENT_DIR, 'kit'))) {
      const file = join(CONTENT_DIR, 'kit', dir, 'kit.json');
      if (!existsSync(file)) continue;
      const kit = JSON.parse(readFileSync(file, 'utf8')) as { id: string; kit: { sprites: Record<string, { density?: number }> } };
      for (const [path, entry] of Object.entries(kit.kit.sprites)) declared[`${kit.id}:${path}`] = entry;
    }
    for (const [k, s] of others) expect(s.density, k).toBe(declared[k]?.density ?? 1);
  });
});
