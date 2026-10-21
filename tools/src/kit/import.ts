import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

import { CORE_PALETTE, type Rgb, hexToRgb } from './palette.js';

export interface ImportOptions {
  width: number;
  height: number;
  frames?: number;
  anchor?: 'center' | 'bottom';
  palette: readonly string[];
  padding?: number;
  /**
   * Draw a one-pixel dark outline around each frame's silhouette (not under
   * the feet). Shrinking a big drawing loses its thin outlines; a character a
   * dozen pixels wide needs one back to read against the ground.
   */
  outline?: boolean;
  /**
   * EXPERIMENT (exp/rich-style): where a source colour sits between its two nearest palette colours,
   * alternate them in a 2x2 ordered pattern instead of snapping to one. Soft gradients in the drawing
   * survive the import as texture instead of becoming flat bands.
   */
  dither?: boolean;
}

export interface ImportResult {
  png: Buffer;
  grid: number;
  logical: [number, number];
  colors: number;
}

interface ImageData {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Component extends Box {
  id: number;
  size: number;
}

interface Cell {
  r: number;
  g: number;
  b: number;
  a: 0 | 255;
}

interface LogicalSprite {
  width: number;
  height: number;
  cells: Cell[];
}

const TRANSPARENT: Cell = { r: 0, g: 0, b: 0, a: 0 };

function decode(source: Buffer): ImageData {
  if (
    source.length >= 8
    && source[0] === 0x89
    && source[1] === 0x50
    && source[2] === 0x4e
    && source[3] === 0x47
  ) {
    const image = PNG.sync.read(source);
    return { width: image.width, height: image.height, data: image.data };
  }
  if (source.length >= 2 && source[0] === 0xff && source[1] === 0xd8) {
    const image = jpeg.decode(source, { formatAsRGBA: true, useTArray: true });
    return { width: image.width, height: image.height, data: image.data };
  }
  throw new Error('Unsupported image format: expected a PNG or JPEG');
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

function borderBackground(image: ImageData): readonly [number, number, number] {
  const channels: [number[], number[], number[]] = [[], [], []];
  const border = Math.min(8, Math.ceil(Math.min(image.width, image.height) / 2));
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (x >= border && x < image.width - border && y >= border && y < image.height - border) continue;
      const offset = (y * image.width + x) * 4;
      channels[0].push(image.data[offset] ?? 0);
      channels[1].push(image.data[offset + 1] ?? 0);
      channels[2].push(image.data[offset + 2] ?? 0);
    }
  }
  return [median(channels[0]), median(channels[1]), median(channels[2])];
}

function colorDistance(r: number, g: number, b: number, other: readonly [number, number, number]): number {
  return Math.hypot(r - other[0], g - other[1], b - other[2]);
}

function initialMask(image: ImageData, background: readonly [number, number, number]): Uint8Array {
  const borderDistances: number[] = [];
  const border = Math.min(8, Math.ceil(Math.min(image.width, image.height) / 2));
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (x >= border && x < image.width - border && y >= border && y < image.height - border) continue;
      const offset = (y * image.width + x) * 4;
      borderDistances.push(colorDistance(
        image.data[offset] ?? 0,
        image.data[offset + 1] ?? 0,
        image.data[offset + 2] ?? 0,
        background,
      ));
    }
  }
  borderDistances.sort((a, b) => a - b);
  const noisyBorder = borderDistances[Math.floor(borderDistances.length * 0.995)] ?? 0;
  const threshold = Math.min(100, Math.max(65, noisyBorder + 24));
  const mask = new Uint8Array(image.width * image.height);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const r = image.data[offset] ?? 0;
    const g = image.data[offset + 1] ?? 0;
    const b = image.data[offset + 2] ?? 0;
    const a = image.data[offset + 3] ?? 255;
    const magentaFringe = r > 170 && b > 170 && g < Math.min(r, b) * 0.62;
    if (a >= 128 && !magentaFringe && colorDistance(r, g, b, background) > threshold) mask[index] = 1;
  }
  return mask;
}

function connectedComponents(mask: Uint8Array, width: number, height: number): {
  labels: Int32Array;
  components: Component[];
} {
  const labels = new Int32Array(mask.length);
  const queue = new Int32Array(mask.length);
  const components: Component[] = [];
  let nextId = 1;

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || labels[start] !== 0) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = nextId;
    const firstX = start % width;
    const firstY = Math.floor(start / width);
    const component: Component = {
      id: nextId,
      size: 0,
      minX: firstX,
      maxX: firstX,
      minY: firstY,
      maxY: firstY,
    };

    while (head < tail) {
      const index = queue[head++] ?? 0;
      const x = index % width;
      const y = Math.floor(index / width);
      component.size += 1;
      component.minX = Math.min(component.minX, x);
      component.maxX = Math.max(component.maxX, x);
      component.minY = Math.min(component.minY, y);
      component.maxY = Math.max(component.maxY, y);

      const visit = (neighbor: number): void => {
        if (mask[neighbor] !== 0 && labels[neighbor] === 0) {
          labels[neighbor] = nextId;
          queue[tail++] = neighbor;
        }
      };
      if (x > 0) visit(index - 1);
      if (x + 1 < width) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y + 1 < height) visit(index + width);
    }
    components.push(component);
    nextId += 1;
  }
  return { labels, components };
}

function cleanMask(image: ImageData, rawMask: Uint8Array): {
  mask: Uint8Array;
  components: Component[];
} {
  const found = connectedComponents(rawMask, image.width, image.height);
  const minimum = image.width * image.height * 0.002;
  const keptComponents = found.components.filter((component) => component.size >= minimum);
  const keptIds = new Uint8Array(found.components.length + 1);
  for (const component of keptComponents) keptIds[component.id] = 1;
  const mask = new Uint8Array(rawMask.length);
  for (let index = 0; index < mask.length; index += 1) {
    if (keptIds[found.labels[index] ?? 0] !== 0) mask[index] = 1;
  }
  return { mask, components: keptComponents };
}

function unionBox(boxes: readonly Box[]): Box {
  if (boxes.length === 0) throw new Error('No foreground subject found');
  return boxes.reduce<Box>((result, box) => ({
    minX: Math.min(result.minX, box.minX),
    minY: Math.min(result.minY, box.minY),
    maxX: Math.max(result.maxX, box.maxX),
    maxY: Math.max(result.maxY, box.maxY),
  }), { ...boxes[0] as Box });
}

function subjectBoxes(components: readonly Component[], frames: number): Box[] {
  if (components.length === 0) throw new Error('No foreground subject found');
  if (frames === 1) return [unionBox(components)];

  const sorted = [...components].sort((a, b) => a.minX - b.minX || b.size - a.size);
  const groups: (Box & { size: number })[] = [];
  for (const component of sorted) {
    const overlapping = groups.filter(
      (group) => component.minX <= group.maxX && component.maxX >= group.minX,
    );
    if (overlapping.length === 0) {
      groups.push({ ...component });
      continue;
    }
    const target = overlapping[0];
    if (target === undefined) continue;
    target.minX = Math.min(target.minX, component.minX);
    target.maxX = Math.max(target.maxX, component.maxX);
    target.minY = Math.min(target.minY, component.minY);
    target.maxY = Math.max(target.maxY, component.maxY);
    target.size += component.size;
    for (const extra of overlapping.slice(1)) {
      target.minX = Math.min(target.minX, extra.minX);
      target.maxX = Math.max(target.maxX, extra.maxX);
      target.minY = Math.min(target.minY, extra.minY);
      target.maxY = Math.max(target.maxY, extra.maxY);
      target.size += extra.size;
      groups.splice(groups.indexOf(extra), 1);
    }
  }

  if (groups.length < frames) {
    throw new Error(`Expected ${frames} subjects, found ${groups.length}`);
  }
  return groups
    .sort((a, b) => b.size - a.size)
    .slice(0, frames)
    .sort((a, b) => a.minX - b.minX);
}

export function nearestPaletteIndex(
  r: number,
  g: number,
  b: number,
  palette: readonly (readonly [number, number, number])[],
): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < palette.length; index += 1) {
    const candidate = palette[index];
    if (candidate === undefined) continue;
    const meanRed = (r + candidate[0]) / 2;
    const red = r - candidate[0];
    const green = g - candidate[1];
    const blue = b - candidate[2];
    const distance = (2 + meanRed / 256) * red * red
      + 4 * green * green
      + (2 + (255 - meanRed) / 256) * blue * blue;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

function paletteLabels(
  image: ImageData,
  mask: Uint8Array,
  palette: readonly (readonly [number, number, number])[],
): Int16Array {
  const labels = new Int16Array(mask.length);
  labels.fill(-1);
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0) continue;
    const offset = index * 4;
    labels[index] = nearestPaletteIndex(
      image.data[offset] ?? 0,
      image.data[offset + 1] ?? 0,
      image.data[offset + 2] ?? 0,
      palette,
    );
  }
  return labels;
}

function edgeWeights(
  labels: Int16Array,
  width: number,
  boxes: readonly Box[],
): { horizontal: Float64Array; vertical: Float64Array } {
  const horizontal = new Float64Array(width + 1);
  let maxY = 0;
  for (const box of boxes) maxY = Math.max(maxY, box.maxY);
  const vertical = new Float64Array(maxY + 2);
  for (const box of boxes) {
    for (let y = box.minY; y <= box.maxY; y += 1) {
      for (let x = box.minX + 1; x <= box.maxX; x += 1) {
        const left = labels[y * width + x - 1] ?? -1;
        const right = labels[y * width + x] ?? -1;
        if (left !== right) horizontal[x] = (horizontal[x] ?? 0) + (left < 0 || right < 0 ? 2 : 1);
      }
    }
    for (let y = box.minY + 1; y <= box.maxY; y += 1) {
      for (let x = box.minX; x <= box.maxX; x += 1) {
        const above = labels[(y - 1) * width + x] ?? -1;
        const below = labels[y * width + x] ?? -1;
        if (above !== below) vertical[y] = (vertical[y] ?? 0) + (above < 0 || below < 0 ? 2 : 1);
      }
    }
  }
  return { horizontal, vertical };
}

function periodicScore(weights: Float64Array, period: number): { score: number; phase: number } {
  let total = 0;
  for (const weight of weights) total += weight;
  if (total === 0) return { score: 0, phase: 0 };
  let bestScore = -1;
  let bestPhase = 0;
  const radius = Math.min(3, Math.max(1, Math.floor(period / 5)));
  for (let phase = 0; phase < period; phase += 1) {
    let score = 0;
    for (let position = 0; position < weights.length; position += 1) {
      const weight = weights[position] ?? 0;
      if (weight === 0) continue;
      const residue = ((position - phase) % period + period) % period;
      const distance = Math.min(residue, period - residue);
      if (distance <= radius) score += weight * (radius + 1 - distance) / (radius + 1);
    }
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }
  const rawScore = bestScore / total;
  let chanceScore = 1 / period;
  for (let distance = 1; distance <= radius; distance += 1) {
    chanceScore += 2 * (radius + 1 - distance) / (radius + 1) / period;
  }
  return {
    score: Math.max(0, (rawScore - chanceScore) / (1 - chanceScore)),
    phase: bestPhase,
  };
}

function collectRunLengths(labels: Int16Array, width: number, boxes: readonly Box[]): number[] {
  const lengths: number[] = [];
  const addRuns = (values: number[]): void => {
    let start = 0;
    while (start < values.length) {
      let end = start + 1;
      while (end < values.length && values[end] === values[start]) end += 1;
      const length = end - start;
      if ((values[start] ?? -1) >= 0 && length >= 4 && length <= 256) lengths.push(length);
      start = end;
    }
  };
  for (const box of boxes) {
    for (let y = box.minY; y <= box.maxY; y += 1) {
      const values: number[] = [];
      for (let x = box.minX; x <= box.maxX; x += 1) values.push(labels[y * width + x] ?? -1);
      addRuns(values);
    }
    for (let x = box.minX; x <= box.maxX; x += 1) {
      const values: number[] = [];
      for (let y = box.minY; y <= box.maxY; y += 1) values.push(labels[y * width + x] ?? -1);
      addRuns(values);
    }
  }
  return lengths;
}

function runLengthScore(lengths: readonly number[], grid: number): number {
  let score = 0;
  let weightTotal = 0;
  let fundamental = 0;
  const tolerance = Math.max(2, grid * 0.12);
  for (const length of lengths) {
    const multiple = Math.max(1, Math.round(length / grid));
    const residual = Math.abs(length - multiple * grid);
    const weight = Math.sqrt(length);
    score += Math.exp(-(residual * residual) / (tolerance * tolerance)) * weight;
    weightTotal += weight;
    if (length >= grid * 0.65 && length <= grid * 1.35) fundamental += weight;
  }
  if (weightTotal === 0) return 0;
  return score / weightTotal + 0.12 * fundamental / weightTotal;
}

function detectGrid(
  labels: Int16Array,
  imageWidth: number,
  boxes: readonly Box[],
): { grid: number; phaseX: number; phaseY: number } {
  const weights = edgeWeights(labels, imageWidth, boxes);
  const runs = collectRunLengths(labels, imageWidth, boxes);
  const candidates: { grid: number; score: number; phaseX: number; phaseY: number }[] = [];
  for (let grid = 4; grid <= 64; grid += 1) {
    const x = periodicScore(weights.horizontal, grid);
    const y = periodicScore(weights.vertical, grid);
    const periodic = (x.score + y.score) / 2;
    candidates.push({
      grid,
      score: runLengthScore(runs, grid) + periodic * 0.15,
      phaseX: x.phase,
      phaseY: y.phase,
    });
  }
  let maximum = 0;
  for (const candidate of candidates) maximum = Math.max(maximum, candidate.score);
  const scoreAt = (grid: number): number => candidates[grid - 4]?.score ?? 0;
  const chosen = candidates
    .filter((candidate) => {
      const halfScore = candidate.grid < 8
        ? 0
        : Math.max(scoreAt(Math.floor(candidate.grid / 2)), scoreAt(Math.ceil(candidate.grid / 2)));
      return candidate.score >= maximum * 0.6
        && candidate.score >= 0.38
        && candidate.score >= halfScore * 0.8;
    })
    .sort((a, b) => b.grid - a.grid)[0]
    ?? candidates.sort((a, b) => b.score - a.score || b.grid - a.grid)[0];
  if (chosen === undefined) throw new Error('Could not detect the art-pixel grid');
  return chosen;
}

function alignedOrigin(start: number, phase: number, grid: number): number {
  return start - ((start - phase) % grid + grid) % grid;
}

function cellMedian(values: number[]): number {
  return median(values);
}

function resampleLogical(
  image: ImageData,
  mask: Uint8Array,
  box: Box,
  grid: number,
  phaseX: number,
  phaseY: number,
): LogicalSprite {
  const originX = alignedOrigin(box.minX, phaseX, grid);
  const originY = alignedOrigin(box.minY, phaseY, grid);
  const columns = Math.ceil((box.maxX + 1 - originX) / grid);
  const rows = Math.ceil((box.maxY + 1 - originY) / grid);
  const cells: Cell[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const rs: number[] = [];
      const gs: number[] = [];
      const bs: number[] = [];
      let samples = 0;
      for (let y = originY + row * grid; y < originY + (row + 1) * grid; y += 1) {
        if (y < 0 || y >= image.height) continue;
        for (let x = originX + column * grid; x < originX + (column + 1) * grid; x += 1) {
          if (x < 0 || x >= image.width) continue;
          samples += 1;
          const index = y * image.width + x;
          if (mask[index] === 0) continue;
          const offset = index * 4;
          rs.push(image.data[offset] ?? 0);
          gs.push(image.data[offset + 1] ?? 0);
          bs.push(image.data[offset + 2] ?? 0);
        }
      }
      if (samples > 0 && rs.length >= samples / 2) {
        cells.push({ r: cellMedian(rs), g: cellMedian(gs), b: cellMedian(bs), a: 255 });
      } else {
        cells.push(TRANSPARENT);
      }
    }
  }
  return trimTransparent({ width: columns, height: rows, cells });
}

function trimTransparent(sprite: LogicalSprite): LogicalSprite {
  let minX = sprite.width;
  let minY = sprite.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      if (sprite.cells[y * sprite.width + x]?.a !== 255) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error('Subject disappeared while sampling its art-pixel grid');
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const cells: Cell[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      cells.push(sprite.cells[y * sprite.width + x] ?? TRANSPARENT);
    }
  }
  return { width, height, cells };
}

function overlap(from: number, to: number, cellFrom: number, cellTo: number): number {
  return Math.max(0, Math.min(to, cellTo) - Math.max(from, cellFrom));
}

/**
 * Shrink by area vote. The vote counts palette colours, not exact source
 * colours: a tunic drawn in five shades of tan must outvote one flat skin tone.
 */
function scaleSprite(sprite: LogicalSprite, scale: number, palette: readonly Rgb[]): LogicalSprite {
  if (scale >= 1) return sprite;
  const width = Math.max(1, Math.floor(sprite.width * scale));
  const height = Math.max(1, Math.floor(sprite.height * scale));
  const cells: Cell[] = [];
  for (let y = 0; y < height; y += 1) {
    const sourceTop = y * sprite.height / height;
    const sourceBottom = (y + 1) * sprite.height / height;
    for (let x = 0; x < width; x += 1) {
      const sourceLeft = x * sprite.width / width;
      const sourceRight = (x + 1) * sprite.width / width;
      const weights = new Map<string, { weight: number; cell: Cell }>();
      let transparentWeight = 0;
      let totalWeight = 0;
      for (let sy = Math.floor(sourceTop); sy < Math.ceil(sourceBottom); sy += 1) {
        for (let sx = Math.floor(sourceLeft); sx < Math.ceil(sourceRight); sx += 1) {
          const weight = overlap(sourceLeft, sourceRight, sx, sx + 1)
            * overlap(sourceTop, sourceBottom, sy, sy + 1);
          if (weight <= 0) continue;
          totalWeight += weight;
          const cell = sprite.cells[sy * sprite.width + sx] ?? TRANSPARENT;
          if (cell.a === 0) {
            transparentWeight += weight;
          } else {
            const key = String(nearestPaletteIndex(cell.r, cell.g, cell.b, palette));
            const entry = weights.get(key);
            if (entry === undefined) weights.set(key, { weight, cell });
            else entry.weight += weight;
          }
        }
      }
      if (transparentWeight > totalWeight / 2) {
        cells.push(TRANSPARENT);
      } else {
        let best: { weight: number; cell: Cell } | undefined;
        for (const entry of weights.values()) {
          if (best === undefined || entry.weight > best.weight) best = entry;
        }
        cells.push(best?.cell ?? TRANSPARENT);
      }
    }
  }
  return { width, height, cells };
}

function validateOptions(options: ImportOptions): Required<Omit<ImportOptions, 'palette'>> {
  const dither = options.dither ?? false;
  const frames = options.frames ?? 1;
  const anchor = options.anchor ?? 'center';
  const padding = options.padding ?? 0;
  const outline = options.outline ?? false;
  if (!Number.isInteger(options.width) || options.width <= 0) throw new Error('width must be a positive integer');
  if (!Number.isInteger(options.height) || options.height <= 0) throw new Error('height must be a positive integer');
  if (!Number.isInteger(frames) || frames <= 0) throw new Error('frames must be a positive integer');
  if (!Number.isInteger(padding) || padding < 0) throw new Error('padding must be a non-negative integer');
  if (options.width <= padding * 2 || options.height <= padding * 2) throw new Error('padding leaves no output area');
  if (options.palette.length === 0) throw new Error('palette must contain at least one color');
  return { width: options.width, height: options.height, frames, anchor, padding, outline, dither };
}

const BAYER_2X2 = [0.2, 0.7, 0.95, 0.45] as const;

/** The palette colour for a source colour at (x, y): the nearest, or, with dither, one of the nearest two by an ordered pattern. */
function paletteColourAt(r: number, g: number, b: number, x: number, y: number, palette: readonly Rgb[], dither: boolean): Rgb | undefined {
  const first = nearestPaletteIndex(r, g, b, palette);
  const c1 = palette[first];
  if (!dither || c1 === undefined || palette.length < 2) return c1;
  let second = -1;
  let secondDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < palette.length; index += 1) {
    if (index === first) continue;
    const c = palette[index];
    if (c === undefined) continue;
    const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
    if (d < secondDistance) { secondDistance = d; second = index; }
  }
  const c2 = palette[second];
  if (c2 === undefined) return c1;
  // where the source sits on the segment c1 -> c2, 0 at c1 and 1 at c2
  const vx = c2[0] - c1[0];
  const vy = c2[1] - c1[1];
  const vz = c2[2] - c1[2];
  const length = vx * vx + vy * vy + vz * vz;
  if (length === 0) return c1;
  const t = Math.max(0, Math.min(1, ((r - c1[0]) * vx + (g - c1[1]) * vy + (b - c1[2]) * vz) / length));
  // only a real in-between colour dithers; a colour that is clearly one of the two stays flat
  if (t < 0.3 || t > 0.7) return t > 0.5 ? c2 : c1;
  const threshold = BAYER_2X2[(y % 2) * 2 + (x % 2)] ?? 0.5;
  return t > threshold ? c2 : c1;
}

export function importSprite(source: Buffer, options: ImportOptions): ImportResult {
  const settings = validateOptions(options);
  const image = decode(source);
  const background = borderBackground(image);
  const cleaned = cleanMask(image, initialMask(image, background));
  const boxes = subjectBoxes(cleaned.components, settings.frames);
  const palette = options.palette.map(hexToRgb);
  const labels = paletteLabels(image, cleaned.mask, palette);
  const detected = detectGrid(labels, image.width, boxes);
  const logicalSprites = boxes.map((box) => resampleLogical(
    image,
    cleaned.mask,
    box,
    detected.grid,
    detected.phaseX,
    detected.phaseY,
  ));

  // an outline needs a pixel of room on each side and above, never below the feet
  const ring = settings.outline ? 1 : 0;
  const availableWidth = settings.width - settings.padding * 2 - ring * 2;
  const availableHeight = settings.height - settings.padding * 2 - ring * (settings.anchor === 'bottom' ? 1 : 2);
  let scale = 1;
  for (const sprite of logicalSprites) {
    scale = Math.min(scale, availableWidth / sprite.width, availableHeight / sprite.height);
  }
  const sprites = logicalSprites.map((sprite) => scaleSprite(sprite, scale, palette));
  const output = new PNG({ width: settings.width * settings.frames, height: settings.height });
  output.data.fill(0);
  const usedColors = new Set<string>();

  for (let frame = 0; frame < sprites.length; frame += 1) {
    const sprite = sprites[frame];
    if (sprite === undefined) continue;
    const left = frame * settings.width + Math.floor((settings.width - sprite.width) / 2);
    const top = settings.anchor === 'bottom'
      ? settings.height - settings.padding - sprite.height
      : Math.floor((settings.height - sprite.height) / 2);
    for (let y = 0; y < sprite.height; y += 1) {
      for (let x = 0; x < sprite.width; x += 1) {
        const cell = sprite.cells[y * sprite.width + x] ?? TRANSPARENT;
        if (cell.a === 0) continue;
        const color = paletteColourAt(cell.r, cell.g, cell.b, x, y, palette, settings.dither);
        if (color === undefined) continue;
        const offset = ((top + y) * output.width + left + x) * 4;
        output.data[offset] = color[0];
        output.data[offset + 1] = color[1];
        output.data[offset + 2] = color[2];
        output.data[offset + 3] = 255;
        usedColors.add(`${color[0]},${color[1]},${color[2]}`);
      }
    }
  }
  if (settings.outline) drawOutline(output, settings.width, palette[0] ?? [0, 0, 0], usedColors);

  const first = logicalSprites[0];
  if (first === undefined) throw new Error('No foreground subject found');
  return {
    png: PNG.sync.write(output),
    grid: detected.grid,
    logical: [first.width, first.height],
    colors: usedColors.size,
  };
}

/** Paint every empty pixel that touches a frame's silhouette. */
function drawOutline(output: PNG, frameWidth: number, color: Rgb, usedColors: Set<string>): void {
  const { width, height, data } = output;
  const opaque = (x: number, y: number): boolean => data[(y * width + x) * 4 + 3] === 255;
  const ring: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (opaque(x, y)) continue;
      const frameLeft = Math.floor(x / frameWidth) * frameWidth;
      const touches =
        (x > frameLeft && opaque(x - 1, y)) ||
        (x < frameLeft + frameWidth - 1 && opaque(x + 1, y)) ||
        (y < height - 1 && opaque(x, y + 1)) ||
        (y > 0 && opaque(x, y - 1));
      if (touches) ring.push(y * width + x);
    }
  }
  for (const index of ring) {
    data[index * 4] = color[0];
    data[index * 4 + 1] = color[1];
    data[index * 4 + 2] = color[2];
    data[index * 4 + 3] = 255;
  }
  if (ring.length > 0) usedColors.add(`${color[0]},${color[1]},${color[2]}`);
}

function runCli(args: readonly string[]): void {
  const [input, output, widthText, heightText, framesText, anchorText, outlineText] = args;
  if (input === undefined || output === undefined || widthText === undefined || heightText === undefined) {
    throw new Error('Usage: import.ts <in> <out.png> <width> <height> [frames] [anchor] [outline]');
  }
  const anchor = anchorText === undefined ? undefined : anchorText;
  if (anchor !== undefined && anchor !== 'center' && anchor !== 'bottom') {
    throw new Error(`Invalid anchor: ${anchor}`);
  }
  const result = importSprite(readFileSync(input), {
    width: Number(widthText),
    height: Number(heightText),
    frames: framesText === undefined ? undefined : Number(framesText),
    anchor,
    palette: CORE_PALETTE,
    outline: outlineText === 'outline',
  });
  writeFileSync(output, result.png);
  process.stdout.write(`${JSON.stringify({ grid: result.grid, logical: result.logical, colors: result.colors })}\n`);
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) runCli(process.argv.slice(2));
