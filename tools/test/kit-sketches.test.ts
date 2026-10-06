import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { generateSketches } from '../src/kit/sketches.js';
import { CORE_PALETTE, hexToRgb } from '../src/kit/palette.js';

interface ExpectedSprite {
  category: 'tiles' | 'items' | 'props' | 'chars';
  name: string;
  width: number;
  height: number;
  frameWidth: number;
}

const expected: readonly ExpectedSprite[] = [
  ...[
    'grass', 'grass_flowers', 'grove', 'forest', 'sand', 'path', 'cobble', 'ruin_floor',
    'rubble', 'bridge', 'bridge_broken',
  ].map((name) => ({ category: 'tiles' as const, name, width: 16, height: 16, frameWidth: 16 })),
  { category: 'tiles', name: 'water', width: 32, height: 16, frameWidth: 16 },
  ...[
    'herb', 'herb-tea', 'berry-mash', 'herb-stew', 'mushroom-skewer', 'pottery-shard',
    'old-coin', 'stone-idol', 'stew-scrap', 'basket', 'trowel',
  ].map((name) => ({ category: 'items' as const, name, width: 16, height: 16, frameWidth: 16 })),
  ...['herb_plant', 'bush_empty', 'campfire_unlit', 'sign', 'dig_spot', 'chest', 'shelf']
    .map((name) => ({ category: 'props' as const, name, width: 16, height: 16, frameWidth: 16 })),
  { category: 'props', name: 'market_stall', width: 32, height: 32, frameWidth: 32 },
  { category: 'props', name: 'ruin_pillar', width: 16, height: 32, frameWidth: 16 },
  { category: 'props', name: 'fog', width: 32, height: 32, frameWidth: 32 },
  { category: 'chars', name: 'player_down', width: 48, height: 24, frameWidth: 16 },
  { category: 'chars', name: 'player_up', width: 48, height: 24, frameWidth: 16 },
  { category: 'chars', name: 'player_left', width: 48, height: 24, frameWidth: 16 },
  { category: 'chars', name: 'elder', width: 16, height: 24, frameWidth: 16 },
];

const seamlessTerrain = new Set([
  'grass', 'grass_flowers', 'grove', 'forest', 'water', 'sand', 'path', 'cobble', 'ruin_floor',
]);
const paletteColors = new Set(CORE_PALETTE.map((color) => hexToRgb(color).join(',')));
let outputRoot = '';
let written: string[] = [];

function spritePath(sprite: ExpectedSprite): string {
  return join(outputRoot, 'content', 'kit', 'core', sprite.category, `${sprite.name}.png`);
}

function pixelOffset(image: PNG, x: number, y: number): number {
  return (y * image.width + x) * 4;
}

function samePixel(image: PNG, firstX: number, firstY: number, secondX: number, secondY: number): boolean {
  const first = pixelOffset(image, firstX, firstY);
  const second = pixelOffset(image, secondX, secondY);
  for (let channel = 0; channel < 4; channel += 1) {
    if (image.data[first + channel] !== image.data[second + channel]) return false;
  }
  return true;
}

beforeAll(() => {
  outputRoot = mkdtempSync(join(tmpdir(), 'kit-sketches-'));
  written = generateSketches(outputRoot);
});

afterAll(() => {
  rmSync(outputRoot, { recursive: true, force: true });
});

describe('generateSketches', () => {
  test('writes every requested sprite and the review sheet', () => {
    const expectedPaths = expected.map(spritePath);
    expectedPaths.push(join(outputRoot, 'tools', 'test', 'fixtures', 'kit', 'out', 'sketches-sheet.png'));
    expect(written.sort()).toEqual(expectedPaths.sort());
  });

  test.each(expected)('$category/$name has the requested dimensions and only core colors', (sprite) => {
    const image = PNG.sync.read(readFileSync(spritePath(sprite)));
    expect([image.width, image.height]).toEqual([sprite.width, sprite.height]);

    for (let index = 0; index < image.width * image.height; index += 1) {
      const offset = index * 4;
      const alpha = image.data[offset + 3];
      expect(alpha === 0 || alpha === 255).toBe(true);
      if (alpha === 255) {
        expect(paletteColors.has([
          image.data[offset] ?? 0,
          image.data[offset + 1] ?? 0,
          image.data[offset + 2] ?? 0,
        ].join(','))).toBe(true);
      }
    }
  });

  test.each(expected.filter((sprite) => seamlessTerrain.has(sprite.name)))(
    'tiles/$name is opaque and wraps calmly at each edge',
    (sprite) => {
      const image = PNG.sync.read(readFileSync(spritePath(sprite)));
      const frames = image.width / sprite.frameWidth;
      for (let frame = 0; frame < frames; frame += 1) {
        const left = frame * sprite.frameWidth;
        let verticalDifferences = 0;
        let horizontalDifferences = 0;
        for (let position = 0; position < 16; position += 1) {
          if (!samePixel(image, left, position, left + 15, position)) verticalDifferences += 1;
          if (!samePixel(image, left + position, 0, left + position, 15)) horizontalDifferences += 1;
        }
        expect(verticalDifferences).toBeLessThan(9);
        expect(horizontalDifferences).toBeLessThan(9);
      }
      for (let index = 0; index < image.width * image.height; index += 1) {
        expect(image.data[index * 4 + 3]).toBe(255);
      }
    },
  );

  test.each(expected.filter((sprite) => sprite.category !== 'tiles'))(
    '$category/$name has transparent corners in every frame',
    (sprite) => {
      const image = PNG.sync.read(readFileSync(spritePath(sprite)));
      const frames = image.width / sprite.frameWidth;
      for (let frame = 0; frame < frames; frame += 1) {
        const left = frame * sprite.frameWidth;
        const cornerAlphas = [
          image.data[pixelOffset(image, left, 0) + 3],
          image.data[pixelOffset(image, left + sprite.frameWidth - 1, 0) + 3],
          image.data[pixelOffset(image, left, image.height - 1) + 3],
          image.data[pixelOffset(image, left + sprite.frameWidth - 1, image.height - 1) + 3],
        ];
        expect(cornerAlphas).toEqual([0, 0, 0, 0]);
      }
    },
  );

  test.each(['player_down', 'player_up', 'player_left'])('%s puts feet on the bottom row', (name) => {
    const sprite = expected.find((candidate) => candidate.name === name);
    if (sprite === undefined) throw new Error(`Missing expected sprite ${name}`);
    const image = PNG.sync.read(readFileSync(spritePath(sprite)));
    for (let frame = 0; frame < 3; frame += 1) {
      let opaque = false;
      for (let x = frame * 16; x < (frame + 1) * 16; x += 1) {
        if (image.data[pixelOffset(image, x, 23) + 3] === 255) opaque = true;
      }
      expect(opaque).toBe(true);
    }
  });
});
