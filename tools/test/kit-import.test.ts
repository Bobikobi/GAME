import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { importSprite, paletteColourAt } from '../src/kit/import.js';
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

/** The cells of `originalSprite` the tests below paint over: a 4x4 square in the middle of its fill. */
const CENTRE = new Set(Array.from({ length: 16 }, (_, i) => (4 + Math.floor(i / 4)) * 12 + 4 + (i % 4)));

/** `originalSprite` with its centre painted `centre` (null leaves it open, the background showing through). */
function spriteWithCentre(centre: Pixel): Pixel[] {
  return originalSprite().map((pixel, index) => (CENTRE.has(index) ? centre : pixel));
}

/** The drawing came back cell for cell: every cell of `expected` in its colour, and each centre cell opaque. */
function expectDrawingWithSolidCentre(image: PNG, expected: readonly Pixel[]): void {
  const pixels = decodedPixels(image);
  expect([image.width, image.height]).toEqual([12, 12]);
  expect(pixels.filter((_, index) => !CENTRE.has(index))).toEqual(expected.filter((_, index) => !CENTRE.has(index)));
  expect(pixels.filter((pixel, index) => CENTRE.has(index) && pixel === null)).toEqual([]);
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
  test('dither alternates the two nearest colours only for a colour between them', () => {
    const palette = CORE_PALETTE.map(hexToRgb);
    const a = palette[2] ?? [0, 0, 0];
    const b = palette[3] ?? [0, 0, 0];
    const mid = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2), Math.round((a[2] + b[2]) / 2)] as const;
    const block = (r: number, g: number, bl: number, dither: boolean): Set<string> => new Set(
      [0, 1, 2, 3].map((i) => String(paletteColourAt(r, g, bl, i % 2, Math.floor(i / 2), palette, dither))),
    );
    expect(block(mid[0], mid[1], mid[2], true).size).toBe(2);
    expect(block(mid[0], mid[1], mid[2], false).size).toBe(1);
    expect(block(a[0], a[1], a[2], true)).toEqual(new Set([String(a)]));
  });

  test('recovers a noisy, exactly scaled palette sprite pixel for pixel', () => {
    const expected = originalSprite();
    const source = noisyUpscale([expected], 12, 12, 16, 400, 400, [[83, 97]], true);
    const result = importSprite(source, { width: 12, height: 12, palette: CORE_PALETTE });
    const image = decode(result.png);

    expect([image.width, image.height]).toEqual([12, 12]);
    expect(decodedPixels(image)).toEqual(expected);
    expect(result.grid).toBe(16);
  });

  // Background is what lies near the border's colour and reaches the picture's edge through such pixels
  // (DECISIONS.md, 2026-10-23: the rich sprites' holes). The pictures are on magenta, as kit:gen draws them.
  test('keeps a patch inside the drawing at distance 40 from the background', () => {
    const patch = [255, 40, 255] as const;
    const source = noisyUpscale([spriteWithCentre(patch)], 12, 12, 16, 400, 400, [[83, 97]], true);
    const result = importSprite(source, { width: 12, height: 12, palette: CORE_PALETTE });

    expectDrawingWithSolidCentre(decode(result.png), originalSprite());
    expect(result.grid).toBe(16);
  });

  test('clears an opening the drawing encloses where the background itself shows through', () => {
    const expected = spriteWithCentre(null);
    const source = noisyUpscale([expected], 12, 12, 16, 400, 400, [[83, 97]], true);
    const result = importSprite(source, { width: 12, height: 12, palette: CORE_PALETTE });

    expect(decodedPixels(decode(result.png))).toEqual(expected);
  });

  test('keeps a drawing that touches the picture\'s edge, its pale centre too', () => {
    const source = noisyUpscale([spriteWithCentre([255, 40, 255])], 12, 12, 16, 400, 400, [[0, 0]], true);
    const result = importSprite(source, { width: 12, height: 12, palette: CORE_PALETTE });

    expectDrawingWithSolidCentre(decode(result.png), originalSprite());
    expect(result.grid).toBe(16);
  });

  test('clears the background around the drawing as before, its near colours and magenta fringe too', () => {
    const expected = originalSprite();
    // the empty cells of the drawing's square, which reach the picture's edge, painted near the magenta
    // (distance 53, inside the threshold) and in its fringe (distance 98, outside it)
    const haloed = expected.map((pixel, index): Pixel => pixel ?? (index % 2 === 0 ? [230, 40, 230] : [200, 60, 200]));
    const source = noisyUpscale([haloed], 12, 12, 16, 400, 400, [[83, 97]], true);
    const result = importSprite(source, { width: 12, height: 12, palette: CORE_PALETTE });

    expect(decodedPixels(decode(result.png))).toEqual(expected);
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

describe('the background key and the glows the model paints on it', () => {
  const SIZE = 400;
  const GRID = 20;
  const AT: readonly [number, number] = [130, 110];
  const options = { width: 64, height: 64, palette: CORE_PALETTE, anchor: 'bottom' as const };

  /** A wedge of warm light on the background, a smooth gradient that touches the sprite's outline. */
  function withWedge(png: Buffer): Buffer {
    const image = decode(png);
    for (let y = 60; y < 170; y += 1) {
      for (let x = 60; x < 230; x += 1) {
        const o = (y * SIZE + x) * 4;
        const background = image.data[o] === 255 && image.data[o + 1] === 0 && image.data[o + 2] === 255;
        if (!background || x + y < 300) continue;
        image.data[o] = 232 - Math.floor(x / 12);
        image.data[o + 1] = 146 - Math.floor(y / 10);
        image.data[o + 2] = 96;
      }
    }
    return PNG.sync.write(image);
  }

  /** The 12x12 diamond with an orange upper half and a dark lower half, and an optional gap in its outline. */
  function orangeSprite(gap: boolean): Pixel[] {
    const outline = hexToRgb(CORE_PALETTE[0] ?? '#000000');
    const orange: Pixel = [230, 120, 50];
    return originalSprite().map((pixel, index) => {
      if (pixel === null) return null;
      const y = Math.floor(index / 12);
      if (gap && index === 12 + 5) return null;
      const isOutline = pixel[0] === outline[0] && pixel[1] === outline[1] && pixel[2] === outline[2];
      return isOutline || y >= 6 ? outline : orange;
    });
  }

  const upscale = (sprite: Pixel[]): Buffer => noisyUpscale([sprite], 12, 12, GRID, SIZE, SIZE, [AT], false);

  test('a glow that touches the background is dropped: the drawing imports as if it were not there', () => {
    const clean = upscale(originalSprite());
    const plain = importSprite(clean, options);
    const glowed = importSprite(withWedge(clean), options);
    expect(glowed.png.equals(plain.png)).toBe(true);
    expect(glowed.logical).toEqual(plain.logical);
  });

  test('a sprite with no glow is untouched by the key', () => {
    const noisy = noisyUpscale([originalSprite()], 12, 12, GRID, SIZE, SIZE, [AT], true);
    expect(importSprite(upscale(originalSprite()), options).logical).toEqual([12, 12]);
    expect(importSprite(noisy, options).logical).toEqual([12, 12]);
  });

  test('a smooth body behind a gap in the outline is not mistaken for a glow', () => {
    const whole = importSprite(upscale(orangeSprite(false)), options);
    const gapped = importSprite(upscale(orangeSprite(true)), options);
    const count = (png: Buffer): number => {
      const image = decode(png);
      let opaque = 0;
      for (let i = 0; i < image.width * image.height; i += 1) if (image.data[i * 4 + 3] === 255) opaque += 1;
      return opaque;
    };
    expect(count(gapped.png)).toBeGreaterThan(count(whole.png) * 0.9);
  });
});
