import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

// The clothing-sets art tools (tools/art/clothing): their bars and the head-wear layer are tested on synthetic figures by python's
// unittest; this file runs them, and checks the manifest of sets against the content it names.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(root, 'tools', 'art', 'clothing');

interface Piece { item: string; place: string; bars_places: string[]; ramp: string[]; accent_ramp?: string[] }
interface SetRow { id: string; order: number; wearable_today: boolean; description: string; pieces: Piece[]; use_view_clauses?: boolean; head_layer?: Record<string, string> }
interface Manifest { sets: SetRow[]; view_clauses: Record<string, string> }
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest;

const havePython = spawnSync('python3', ['-c', 'import numpy, PIL'], { encoding: 'utf8' }).status === 0;
if (!havePython) console.warn('clothing-art: python3 with numpy and Pillow is missing here, so the bar tests are SKIPPED');

describe('the bars and the head-wear layer', () => {
  test.skipIf(!havePython)('their unit tests pass', () => {
    const r = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', dir, '-p', 'test_*.py'], { encoding: 'utf8', cwd: root });
    expect(r.stderr + r.stdout).toMatch(/OK/);
    expect(r.status).toBe(0);
  });
});

describe('the manifest of sets', () => {
  test('sets come in order, each with pieces that name a wear place and a ramp of hex steps', () => {
    expect(manifest.sets.map((s) => s.order)).toEqual([1, 2, 3]);
    for (const s of manifest.sets) {
      expect(s.pieces.length).toBeGreaterThan(0);
      for (const p of s.pieces) {
        expect(p.bars_places.length).toBeGreaterThan(0);
        for (const h of [...p.ramp, ...(p.accent_ramp ?? [])]) expect(h).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  test('a description with its view clause fits the draw API (500 characters)', () => {
    for (const s of manifest.sets) {
      for (const v of ['front', 'back', 'left']) {
        const clause = s.use_view_clauses ? (manifest.view_clauses[v] ?? '') : '';
        expect((s.description + clause).length).toBeLessThanOrEqual(500);
      }
    }
  });

  test('a head-wear set names its hat drawing for every view, a set without head-wear names none', () => {
    for (const s of manifest.sets) {
      const hat = s.pieces.some((p) => p.bars_places.includes('head'));
      if (hat) expect(Object.keys(s.head_layer ?? {}).sort()).toEqual(['back', 'front', 'left']);
      else expect(s.head_layer).toBeUndefined();
    }
  });

  test('a set marked wearable today is a set in the content, with every piece an item there', () => {
    for (const s of manifest.sets.filter((x) => x.wearable_today)) {
      const file = join(root, 'content', s.id.replace('core/', 'core/sets/') + '.json');
      expect(existsSync(file), file).toBe(true);
      for (const p of s.pieces) {
        const recipe = join(root, 'content', p.item.replace('core/', 'core/recipes/') + '.json');
        expect(existsSync(recipe), recipe).toBe(true);
        expect(readFileSync(recipe, 'utf8')).toContain(`"set": "${s.id}"`);
      }
    }
  });
});
