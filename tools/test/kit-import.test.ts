import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { importSprite } from '../src/kit/import.js';
import { CORE_PALETTE, hexToRgb } from '../src/kit/palette.js';

type Pixel = readonly [number, number, number] | null;

const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'kit');
const outputDirectory = join(fixtureDirectory, 'out');

function originalSprite(): Pixel[] {
  const outline = hexToRgb(CORE_PALETTE[0] ?? '#000000');
  const green = hexToRgb(CORE_PALETTE[8] ?? '#000000');
  const light = hexToRgb(CORE_PALETTE[9] ?? '#000000');
  const earth = hexToRgb(CORE_PALETTE[13] ?? '#000000');
  const pixels: Pixel[] = [];
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 12; x += 1) {
      const distance = Math.abs(x * 2 - 11) + Math.abs(y * 2 - 11);
      if (distance > 12) pixels.push(null);
      else if (distance >= 10) pixels.push(outline);
      else if ((x + y) % 7 === 0) pixels.push(light);
      else if (y >= 8 && x >= 4 && x <= 7) pixels.push(earth);
      else pixels.push(green);
    }
  }
  return pixels;
}

function noisyUpscale(
  sprites: readonly Pixel[][],
  spriteWidth: number,
  spriteHeight: number,
  grid: number,
  canvasWidth: number,
  canvasHeight: number,
  positions: readonly (readonly [number, number])[],
  addNoise: boolean,
): Buffer {
  const image = new PNG({ width: canvasWidth, height: canvasHeight });
  let state = 0x13579bdf;
  const noise = (): number => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state % 25 - 12;
  };
  const clamp = (value: number): number => Math.max(0, Math.min(255, value));
  for (let y = 0; y < canvasHeight; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) {
      let color: readonly [number, number, number] = [255, 0, 255];
      for (let spriteIndex = 0; spriteIndex < sprites.length; spriteIndex += 1) {
        const position = positions[spriteIndex];
        const sprite = sprites[spriteIndex];
        if (position === undefined || sprite === undefined) continue;
        const logicalX = Math.floor((x - position[0]) / grid);
        const logicalY = Math.floor((y - position[1]) / grid);
        if (
          x >= position[0]
          && y >= position[1]
          && logicalX >= 0
          && logicalX < spriteWidth
          && logicalY >= 0
          && logicalY < spriteHeight
        ) {
          color = sprite[logicalY * spriteWidth + logicalX] ?? color;
        }
      }
      const offset = (y * canvasWidth + x) * 4;
      image.data[offset] = clamp(color[0] + (addNoise ? noise() : 0));
      image.data[offset + 1] = clamp(color[1] + (addNoise ? noise() : 0));
      image.data[offset + 2] = clamp(color[2] + (addNoise ? noise() : 0));
      image.data[offset + 3] = 255;
    }
  }
  return PNG.sync.write(image);
}

function decode(buffer: Buffer): PNG {
  return PNG.sync.read(buffer);
}

function decodedPixels(image: PNG): Pixel[] {
  const pixels: Pixel[] = [];
  for (let index = 0; index < image.width * image.height; index += 1) {
    const offset = index * 4;
    if (image.data[offset + 3] === 0) pixels.push(null);
    else pixels.push([
      image.data[offset] ?? 0,
      image.data[offset + 1] ?? 0,
      image.data[offset + 2] ?? 0,
    ]);
  }
  return pixels;
}

function majorityMask(source: readonly Pixel[], sourceWidth: number, sourceHeight: number, width: number, height: number): boolean[] {
  const result: boolean[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const left = x * sourceWidth / width;
      const right = (x + 1) * sourceWidth / width;
      const top = y * sourceHeight / height;
      const bottom = (y + 1) * sourceHeight / height;
      let opaque = 0;
      let total = 0;
      for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy += 1) {
        for (let sx = Math.floor(left); sx < Math.ceil(right); sx += 1) {
          const area = Math.max(0, Math.min(right, sx + 1) - Math.max(left, sx))
            * Math.max(0, Math.min(bottom, sy + 1) - Math.max(top, sy));
          total += area;
          if (source[sy * sourceWidth + sx] !== null) opaque += area;
        }
      }
      result.push(opaque >= total / 2);
    }
  }
  return result;
}

function stripFrame(variant: number): Pixel[] {
  const outline = hexToRgb(CORE_PALETTE[0] ?? '#000000');
  const fill = hexToRgb(CORE_PALETTE[7 + variant] ?? '#000000');
  const accent = hexToRgb(CORE_PALETTE[22 + variant] ?? '#000000');
  const pixels: Pixel[] = [];
  for (let y = 0; y < 14; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      const center = 4.5 + (variant - 1) * Math.max(0, 8 - y) * 0.08;
      const radius = y < 3 ? y + 1.5 : y > 11 ? 14 - y + 1.5 : 4.7;
      const inside = Math.abs(x - center) <= radius;
      if (!inside) pixels.push(null);
      else if (Math.abs(x - center) > radius - 1.1 || y === 0 || y === 13) pixels.push(outline);
      else if ((x + y + variant) % 6 === 0) pixels.push(accent);
      else pixels.push(fill);
    }
  }
  return pixels;
}

function assertPaletteImage(image: PNG): void {
  const palette = new Set(CORE_PALETTE.map((hex) => hexToRgb(hex).join(',')));
  for (let index = 0; index < image.width * image.height; index += 1) {
    const offset = index * 4;
    const alpha = image.data[offset + 3];
    expect(alpha === 0 || alpha === 255).toBe(true);
    if (alpha === 255) {
      expect(palette.has([
        image.data[offset] ?? 0,
        image.data[offset + 1] ?? 0,
        image.data[offset + 2] ?? 0,
      ].join(','))).toBe(true);
    }
  }
}

function nearestPreview(image: PNG, scale: number): Buffer {
  const preview = new PNG({ width: image.width * scale, height: image.height * scale });
  for (let y = 0; y < preview.height; y += 1) {
    for (let x = 0; x < preview.width; x += 1) {
      const sourceOffset = (Math.floor(y / scale) * image.width + Math.floor(x / scale)) * 4;
      const targetOffset = (y * preview.width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        preview.data[targetOffset + channel] = image.data[sourceOffset + channel] ?? 0;
      }
    }
  }
  return PNG.sync.write(preview);
}

describe('importSprite', () => {
  test('recovers a noisy, exactly scaled palette sprite pixel for pixel', () => {
    const expected = originalSprite();
    const source = noisyUpscale([expected], 12, 12, 16, 400, 400, [[83, 97]], true);
    const result = importSprite(source, { width: 12, height: 12, palette: CORE_PALETTE });
    const image = decode(result.png);

    expect([image.width, image.height]).toEqual([12, 12]);
    expect(decodedPixels(image)).toEqual(expected);
    expect(result.grid).toBe(16);
  });

  test('area-downscales a sprite while preserving its alpha shape', () => {
    const original = originalSprite();
    const source = noisyUpscale([original], 12, 12, 16, 400, 400, [[83, 97]], true);
    const result = importSprite(source, { width: 8, height: 8, palette: CORE_PALETTE });
    const image = decode(result.png);
    const expectedMask = majorityMask(original, 12, 12, 8, 8);
    const actualMask = decodedPixels(image).map((pixel) => pixel !== null);
    let matching = 0;
    for (let index = 0; index < expectedMask.length; index += 1) {
      if (expectedMask[index] === actualMask[index]) matching += 1;
    }

    expect([image.width, image.height]).toEqual([8, 8]);
    expect(matching / expectedMask.length).toBeGreaterThanOrEqual(0.7);
    assertPaletteImage(image);
  });

  test('imports a bottom-aligned three-frame strip at one common scale', () => {
    const frames = [stripFrame(0), stripFrame(1), stripFrame(2)];
    const source = noisyUpscale(frames, 10, 14, 16, 620, 320, [[50, 40], [230, 40], [410, 40]], false);
    const result = importSprite(source, {
      width: 16,
      height: 24,
      frames: 3,
      anchor: 'bottom',
      palette: CORE_PALETTE,
    });
    const image = decode(result.png);

    expect([image.width, image.height]).toEqual([48, 24]);
    for (let frame = 0; frame < 3; frame += 1) {
      let lowest = -1;
      for (let y = 0; y < 24; y += 1) {
        for (let x = frame * 16; x < (frame + 1) * 16; x += 1) {
          if (image.data[(y * image.width + x) * 4 + 3] === 255) lowest = y;
        }
      }
      expect(lowest).toBe(23);
    }
  });

  test.each([
    ['tree_oak', 32, 32, 'bottom', 0.25],
    ['bush_berry', 16, 16, 'center', 0.25],
    ['item_berry', 16, 16, 'center', 0.30],
    ['item_stone', 16, 16, 'center', 0.30],
  ] as const)('imports real fixture %s', (name, width, height, anchor, minimumCoverage) => {
    const result = importSprite(readFileSync(join(fixtureDirectory, `${name}.jpg`)), {
      width,
      height,
      anchor,
      palette: CORE_PALETTE,
    });
    const image = decode(result.png);
    let opaque = 0;
    for (let index = 0; index < width * height; index += 1) {
      if (image.data[index * 4 + 3] === 255) opaque += 1;
    }

    expect([image.width, image.height]).toEqual([width, height]);
    assertPaletteImage(image);
    expect(opaque / (width * height)).toBeGreaterThanOrEqual(minimumCoverage);
    expect([
      image.data[3],
      image.data[(width - 1) * 4 + 3],
      image.data[((height - 1) * width) * 4 + 3],
      image.data[(width * height - 1) * 4 + 3],
    ]).toEqual([0, 0, 0, 0]);
    expect(result.grid).toBeGreaterThanOrEqual(8);
    expect(result.grid).toBeLessThanOrEqual(32);

    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(join(outputDirectory, `${name}.png`), result.png);
    writeFileSync(join(outputDirectory, `${name}@8x.png`), nearestPreview(image, 8));
  });
});
