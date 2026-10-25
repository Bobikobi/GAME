import { expect, test } from 'vitest';
import { chooseShoreVariant, type ShoreMaterial, type ShoreVariant } from '../src/shore-material';

const variant = (id: string, motif = id, profile = 'half'): ShoreVariant => ({ id, motif, profile, mask: 12, texture: id });
const material = (variants: ShoreVariant[]): ShoreMaterial => ({ id: 'gravel', profile: 'half', variants, water: { bed: 'bed', surface: 'water', foam: 'foam', speed: 8, opacity: 0.4 } });

test('avoids a repeated motif including different images of the same motif', () => {
  const m = material([variant('stone-a', 'stone'), variant('stone-mirrored', 'stone'), variant('quiet')]);
  for (let x = -20; x < 20; x++) expect(chooseShoreVariant(m, 12, x, 3, ['stone'])?.variant.id).toBe('quiet');
});
test('does not use another shape or incompatible shore profile to hide a missing asset', () => {
  const m = material([variant('wrong', 'quiet', 'cliff')]);
  expect(chooseShoreVariant(m, 12, 0, 0)).toBeUndefined();
  expect(chooseShoreVariant(material([variant('north')]), 4, 0, 0)).toBeUndefined();
});
test('selection is stable across registration order and reports unavoidable repetition', () => {
  const a = variant('a'), b = variant('b');
  expect(chooseShoreVariant(material([a, b]), 12, -2, 7)).toEqual(chooseShoreVariant(material([b, a]), 12, -2, 7));
  expect(chooseShoreVariant(material([a]), 12, 0, 0, ['a'])?.repeatedMotif).toBe(true);
});
test('families retain their own water layers and cannot leak variants across materials', () => {
  const sand = { ...material([variant('sand')]), id: 'sand', water: { bed: 'sand-bed', surface: 'calm', foam: 'small-foam', speed: 2, opacity: .25 } };
  const rock = material([variant('rock')]);
  expect(chooseShoreVariant(sand, 12, 0, 0)?.variant.texture).toBe('sand');
  expect(chooseShoreVariant(rock, 12, 0, 0)?.variant.texture).toBe('rock');
  expect(sand.water.surface).toBe('calm');
});
