/**
 * Danger read from the world (G64, issue 578): every area of the valley carries d, d follows the walk
 * from town, and each border where d rises has a cue near it and near every road that crosses it.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { runCheck } from '../src/check';
import { CUE_SPRITES, checkDanger, stepsFromTown } from '../src/danger';

let base: Bundle;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  base = found;
});

const text = (b: Bundle): string => checkDanger(b, {}).map((i) => `${i.level} ${i.message}`).join('\n');
const slot = (b: Bundle, id: string) => b.map.slots.find((s) => s.id === id)!;

describe('danger read from the world (G64)', () => {
  it('the shipped valley gives d to every area and passes', () => {
    for (const s of base.map.slots) if (s.kind === 'area') expect(s.danger, s.id).toBeTypeOf('number');
    expect(checkDanger(base, {})).toEqual([]);
  });

  it('walks from the town: a town tile is 0 steps and the road out counts up', () => {
    const steps = stepsFromTown(base);
    const at = (x: number, y: number) => steps.get(y * base.map.width + x);
    expect(at(26, 7)).toBe(0);
    expect(at(28, 13)).toBe(1);
  });

  it('names an area with no d, as a warning', () => {
    const b = structuredClone(base);
    delete slot(b, 'core/tangle').danger;
    expect(text(b)).toMatch(/^warning .*"core\/tangle" carries no danger level d/m);
  });

  it('refuses a d more than one off the band of its walk from town', () => {
    const b = structuredClone(base);
    slot(b, 'core/tangle-heart').danger = 4;
    expect(text(b)).toContain('"core/tangle-heart"');
    expect(text(b)).toContain('carries d 4');
  });

  it('lets the town and a safe slot sit at level 0, and no other near place either way', () => {
    const b = structuredClone(base);
    slot(b, 'core/arch-mouth').danger = 0;
    expect(text(b)).toBe('');
  });

  it('names a border where d rises with no cue near it', () => {
    const b = structuredClone(base);
    b.map.props = b.map.props.filter((p) => !CUE_SPRITES.includes(p.sprite) || !(p.x === 34 && p.y === 22));
    expect(text(b)).toMatch(/the border from d0 to d1 at \(36, (19|21)\) has no cue within 3 tiles/);
  });

  it('names a road out of the town with no cue near it, though its border has one elsewhere', () => {
    const b = structuredClone(base);
    b.map.props = b.map.props.filter((p) => !CUE_SPRITES.includes(p.sprite) || !(p.x === 30 && p.y === 14));
    expect(text(b)).toContain('the road crossing from d0 to d1 at (28, 13) has no cue within 3 tiles');
  });

  it('reads a d2 area beside d1 ground as a border of its own', () => {
    const b = structuredClone(base);
    slot(b, 'core/tangle-heart').danger = 2;
    b.map.props = b.map.props.filter((p) => !CUE_SPRITES.includes(p.sprite) || p.y < 40);
    expect(text(b)).toMatch(/the border from d1 to d2 at \(\d+, \d+\) has no cue/);
  });
});
