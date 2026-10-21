/**
 * Redraw kit sprites with an image model and bring them back onto the kit's grid.
 *
 * DECISIONS 2026-10-18 "The art moves to 64 px per tile". A spec names each sprite: the stock
 * sprite it redraws, what it is, the grid, and the detail to spell out. The prompt's house style
 * lives here, so the spec is the only thing that changes between waves.
 *
 *   pnpm kit:gen <spec.json> [--only a,b] [--out dir] [--dry] [--reimport] [--timeout seconds]
 *
 * For each entry: the reference is enlarged onto flat magenta (a white ground keys out a white
 * beard), Codex's image generation redraws it on the subscription, and the importer brings the
 * picture back onto the grid in the core palette with no added outline (the drawing has its own).
 * A ground tile fills its square edge to edge, which the importer reads as background, so a tile
 * is cropped to its drawing, read on its own grid and voted to size. Every image appends its source to
 * `manifest.jsonl` (ASSET_PATH section 4, item 2), each result is kept under `out/` with the latest
 * at `<name>.png`, and `gallery.html` shows the latest of each
 * beside its reference, both at their size on a 3x phone.
 *
 * A tile with `"route": "grid"` is not drawn at all: Codex writes it as rows of palette letters at exactly
 * the asked size (`gengrid.ts`), so the grid is exact and the importer measures the seam instead of voting.
 *
 * A tile with `"route": "scatter"` is a ground: Codex writes only its small motifs (a tuft, a pebble, a ripple
 * dash) as grids, one call each, and `scatter.ts` places them with a seeded hash across tile edges and
 * bakes the variants as wrapping tiles, then measures the seam, the colours, the rows and the repeats.
 * `--only meadow_tuft` redraws one motif and keeps the others; `--reimport` bakes again from the last
 * motifs with no Codex call.
 *
 * A `ref` that is a PNG outside `content/kit/` is an outside reference (a screenshot, a photo): its entry
 * must carry `seen` (what the eye saw, confirmed before any name was given), `confirmed_by` and the
 * `palette` decision, and its prompt asks for the object in our style, not a copy. Procedure:
 * `docs/art/PROP_FROM_REF.md`.
 *
 * An entry's `ramps` names the shared ramps of palette v2 it draws in (`palette.ts`, DECISIONS 2026-10-21):
 * the importer snaps onto the 32 plus those ramps' steps, and the manifest line carries the names for the
 * sprite's kit entry. `"style": "rich"` asks for painterly pixel art and dithers between neighbouring
 * steps on import; with no `ramps` of its own it draws in every shared ramp.
 *
 * Nothing is written into `content/`: a result goes into the kit by hand, in a wave. `--dry` writes
 * the references and the prompts only; `--reimport` imports the last raw images again without
 * calling Codex. Each image costs one to two minutes and 14k to 37k Codex tokens (measured
 * 18.10), so run it in the background, one spec at a time.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PNG } from 'pngjs';

import { colourCount, gridPrompt, parseGrid, pngToGrid, renderGrid, seamWarnings } from './gengrid.js';
import { importSprite, nearestPaletteIndex } from './import.js';
import { CORE_PALETTE, CORE_RAMPS, type Rgb, hexToRgb, paletteWithRamps } from './palette.js';
import {
  type Motif, type ScatterEntry, motifPrompt, motifWarnings, parseMotif, renderMotif, scatterProblem, scatterTile, tileWarnings, variantsOf,
} from './scatter.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** The largest grid a spec may ask for: a 384x384 prop, six tiles a side at 64 px per tile (STYLE.md section 1). */
const MAX_SIDE = 384;

export interface GenEntry extends ScatterEntry {
  /** The result's file stem, lowercase like every kit file. */
  name: string;
  /** A core kit sprite id (`chars/elder`; a sheet gives its first frame) or a PNG path from the repo root. */
  ref: string;
  /** What it is, in the words the prompt repeats. */
  what: string;
  width: number;
  height: number;
  /** A `tile` fills its square edge to edge and repeats; a `sprite` stands on transparency. */
  kind?: 'sprite' | 'tile';
  /** How a tile is drawn: `image` (the default) through image generation, `grid` as a text grid of palette letters, `scatter` as small motifs a script scatters. */
  route?: 'image' | 'grid' | 'scatter';
  anchor?: 'center' | 'bottom';
  /** The detail to spell out. The model draws as many pixels as it is given things to draw. */
  detail?: string;
  /** Outside reference only: what the eye saw in the crop before any name was given (docs/art/PROP_FROM_REF.md, step 0a). */
  seen?: string;
  /** Outside reference only: who confirmed `seen` against the picture. */
  confirmed_by?: string;
  /** Outside reference only: the palette decision taken before the first call (step 0b): its hues fit the core ramps, it is restyled into them, or it draws in shared ramps named in `ramps` (`ramp-added`). */
  palette?: 'fits' | 'restyle' | 'ramp-added';
  /** The shared ramps of palette v2 this sprite draws in (ids from `CORE_RAMPS`, at most four, the first gives the outline): the importer allows the 32 plus their steps. */
  ramps?: string[];
  /** `rich` asks for painterly pixel art (hue shifts inside a surface, ambient light, texture) and dithers between neighbouring palette colours on import; with no `ramps` it draws in every shared ramp. Default `kit`. */
  style?: 'kit' | 'rich';
  /** PNG paths (repo root) attached after the reference as style examples; the prompt says to match their shading, hue shifts, texture and outline. */
  style_refs?: string[];
}

/** A PNG that is not a kit sprite: a picture from outside the game, drawn in our style rather than redrawn. */
export function isOutsideReference(ref: string): boolean {
  return extname(ref) === '.png' && !ref.startsWith('content/kit/');
}

export interface Raster {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
}

export interface ManifestLine {
  name: string;
  spec: string;
  ref: string;
  refSize: [number, number];
  kind: 'sprite' | 'tile';
  route?: 'image' | 'grid' | 'scatter' | 'motif';
  width: number;
  height: number;
  prompt: string;
  codex: { version: string; exit: number | null; seconds: number; tokens: number | null; log: string } | null;
  raw: string | null;
  out: string | null;
  grid: number | null;
  logical: [number, number] | null;
  colors: number | null;
  warnings: string[];
  error: string | null;
  at: string;
  /** A scatter tile: the seed it was placed from and the raw motif files it was made of. */
  seed?: string;
  motifs?: string[];
  /** The shared ramps the sprite was imported in, for its kit entry's `ramps`. */
  ramps?: string[];
}

export function parseSpec(text: string): GenEntry[] {
  const json: unknown = JSON.parse(text);
  const entries = (json as { entries?: unknown }).entries;
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('spec: "entries" must be a non-empty array');
  const seen = new Set<string>();
  return entries.map((raw: unknown, index) => {
    const entry = raw as Partial<GenEntry>;
    const where = `spec entries[${index}]`;
    if (typeof entry.name !== 'string' || !/^[a-z0-9_]+$/.test(entry.name)) throw new Error(`${where}.name must be lowercase letters, digits and _`);
    if (seen.has(entry.name)) throw new Error(`${where}.name "${entry.name}" appears twice`);
    seen.add(entry.name);
    if (typeof entry.ref !== 'string' || entry.ref === '') throw new Error(`${where}.ref must name a kit sprite or a PNG`);
    if (typeof entry.what !== 'string' || entry.what.trim() === '') throw new Error(`${where}.what must say what it is`);
    for (const side of ['width', 'height'] as const) {
      const value = entry[side];
      if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > MAX_SIDE) {
        throw new Error(`${where}.${side} must be an integer from 1 to ${MAX_SIDE}`);
      }
    }
    if (entry.kind !== undefined && entry.kind !== 'sprite' && entry.kind !== 'tile') throw new Error(`${where}.kind must be sprite or tile`);
    if (entry.route !== undefined && entry.route !== 'image' && entry.route !== 'grid' && entry.route !== 'scatter') throw new Error(`${where}.route must be image, grid or scatter`);
    if ((entry.route === 'grid' || entry.route === 'scatter') && entry.kind !== 'tile') throw new Error(`${where}.route ${entry.route} is for tiles: set kind to tile`);
    if (entry.route === 'scatter') {
      const problem = scatterProblem(entry as GenEntry);
      if (problem !== null) throw new Error(`${where}: ${problem}`);
    }
    if (entry.anchor !== undefined && entry.anchor !== 'center' && entry.anchor !== 'bottom') throw new Error(`${where}.anchor must be center or bottom`);
    if (entry.detail !== undefined && typeof entry.detail !== 'string') throw new Error(`${where}.detail must be text`);
    if (entry.style !== undefined && entry.style !== 'kit' && entry.style !== 'rich') throw new Error(`${where}.style must be kit or rich`);
    if (entry.ramps !== undefined) {
      const ids = CORE_RAMPS.map((r) => r.id);
      if (!Array.isArray(entry.ramps) || entry.ramps.length === 0 || entry.ramps.length > 4) throw new Error(`${where}.ramps names one to four shared ramps (${ids.join(', ')})`);
      for (const id of entry.ramps) if (!ids.includes(id as string)) throw new Error(`${where}.ramps: "${String(id)}" is not a shared ramp (${ids.join(', ')})`);
      if (new Set(entry.ramps).size !== entry.ramps.length) throw new Error(`${where}.ramps names a ramp twice`);
      if (isOutsideReference(entry.ref) && entry.palette !== 'ramp-added') throw new Error(`${where}: an outside reference that draws in ramps sets palette to ramp-added (step 0b)`);
    }
    if (entry.style_refs !== undefined && (!Array.isArray(entry.style_refs) || entry.style_refs.some((p) => typeof p !== 'string' || extname(p) !== '.png'))) throw new Error(`${where}.style_refs must be PNG paths`);
    if (isOutsideReference(entry.ref)) {
      if (typeof entry.seen !== 'string' || entry.seen.trim() === '') throw new Error(`${where}.seen must say what the eye saw in the outside reference, confirmed before any name (docs/art/PROP_FROM_REF.md step 0a)`);
      if (typeof entry.confirmed_by !== 'string' || entry.confirmed_by.trim() === '') throw new Error(`${where}.confirmed_by must name who confirmed "seen" against the picture (step 0a)`);
      if (entry.palette !== 'fits' && entry.palette !== 'restyle' && entry.palette !== 'ramp-added') throw new Error(`${where}.palette must be fits, restyle or ramp-added, decided before the first call (step 0b)`);
    }
    return entry as GenEntry;
  });
}

/** The reference as the game draws it today: a kit sprite's first frame, or a whole PNG. */
export function loadReference(ref: string, root = ROOT): PNG {
  if (extname(ref) === '.png') return PNG.sync.read(readFileSync(join(root, ref)));
  const kit = JSON.parse(readFileSync(join(root, 'content/kit/core/kit.json'), 'utf8')) as {
    kit: { sprites: Record<string, { file: string; w: number; h: number }> };
  };
  const sprite = kit.kit.sprites[ref];
  if (sprite === undefined) throw new Error(`No core kit sprite "${ref}"`);
  const sheet = PNG.sync.read(readFileSync(join(root, 'content/kit/core', sprite.file)));
  const frame = new PNG({ width: sprite.w, height: sprite.h });
  PNG.bitblt(sheet, frame, 0, 0, sprite.w, sprite.h, 0, 0);
  return frame;
}

/** Enlarge with hard edges onto flat magenta, two art pixels of margin, about 400 px on the long side. */
export function enlargeOnMagenta(image: Raster): PNG {
  const scale = Math.max(4, Math.min(16, Math.floor(384 / Math.max(image.width, image.height))));
  const margin = 2;
  const out = new PNG({ width: (image.width + margin * 2) * scale, height: (image.height + margin * 2) * scale });
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const sx = Math.floor(x / scale) - margin;
      const sy = Math.floor(y / scale) - margin;
      const inside = sx >= 0 && sy >= 0 && sx < image.width && sy < image.height;
      const from = (sy * image.width + sx) * 4;
      const opaque = inside && (image.data[from + 3] ?? 0) >= 128;
      const to = (y * out.width + x) * 4;
      out.data[to] = opaque ? image.data[from] ?? 0 : 255;
      out.data[to + 1] = opaque ? image.data[from + 1] ?? 0 : 0;
      out.data[to + 2] = opaque ? image.data[from + 2] ?? 0 : 255;
      out.data[to + 3] = 255;
    }
  }
  return out;
}

export function buildPrompt(entry: GenEntry, reference: Raster, file: string): string {
  const grid = `${entry.width}x${entry.height}`;
  const detail = entry.detail === undefined || entry.detail.trim() === '' ? '' : `, with ${entry.detail.trim()}`;
  const kindLine = entry.kind === 'tile'
    ? `No outline: it is a ground texture that fills the whole ${grid} square edge to edge, centered on the magenta. Its left edge continues its right edge and its top continues its bottom, so it repeats without a seam.`
    : 'Thick dark navy outline one pixel wide.';
  const outside = isOutsideReference(entry.ref);
  const palette = entry.palette === 'restyle'
    ? 'its colours restyled into our limited palette ramps, the nearest ramps rather than the original hues'
    : entry.palette === 'ramp-added' ? `in our limited palette and its ${(entry.ramps ?? []).join(', ') || 'deeper'} ramps` : 'in our limited palette';
  return [
    outside
      ? `Use your image generation tool. The attached image is a reference from outside our game: ${entry.what}, ${reference.width}x${reference.height} pixels, seen as: ${(entry.seen ?? '').trim()}. It is shown enlarged on magenta.`
      : `Use your image generation tool. The attached image is a reference: ${entry.what}, ${reference.width}x${reference.height} pixels, from our top-down pixel-art game, shown enlarged on magenta.`,
    outside
      ? `Generate a NEW image of a ${entry.what} in the style of our top-down pixel-art game: the same object, shape and proportions, not a copy of the picture, top-down three-quarter view, ${palette}, drawn as pixel art ${entry.width} pixels wide and ${entry.height} pixels tall${detail}.`
      : `Generate a NEW image of the same ${entry.what} - same design, same colors, same top-down three-quarter view - redrawn as pixel art ${entry.width} pixels wide and ${entry.height} pixels tall, far more pixels than the reference${detail}.`,
    `Every pixel stays a crisp square of one flat color, no anti-aliasing, each one about 1/${entry.width} of the drawing's width: draw no smaller pixels than that.`,
    kindLine,
    entry.style === 'rich'
      ? 'Painterly pixel art: every surface shifts hue as it turns from light to shadow (warm lights, cool darks), with ambient light and colour bounced from neighbouring parts, visible material texture (wood grain, stone pores, cloth weave) drawn in pixels, and an outline whose colour follows the surface it borders rather than one flat dark line. Rich colour, as many shades as the object needs. Solid flat pure magenta #FF00FF background around it, no text, no shadow, no extra objects.'
      : 'Limited palette, two-tone shading, solid flat pure magenta #FF00FF background around it, no text, no shadow, no extra objects.',
    (entry.style_refs ?? []).length > 0
      ? `The ${entry.style_refs?.length === 1 ? 'other attached image shows' : 'other attached images show'} the drawing style to match: the same shading depth, hue shifts, texture and outline treatment.`
      : '',
    `The ${grid} drawing fills most of the image.`,
    `Do not process the image with code afterwards; just generate it and save it as ${file} in the current directory.`,
  ].join(' ');
}

export function parseTokens(log: string): number | null {
  const match = /tokens used\s*\n\s*([\d,]+)/.exec(log);
  return match?.[1] === undefined ? null : Number(match[1].replaceAll(',', ''));
}

/** The image Codex saved: the file asked for, else the last PNG its log links to. */
export function findOutput(workdir: string, file: string, log: string, since: number): string | null {
  const asked = join(workdir, file);
  if (existsSync(asked) && statSync(asked).mtimeMs >= since) return asked;
  const linked = [...log.matchAll(/\]\((\/[^)\s]+\.png)\)/g)].map((m) => m[1] ?? '');
  for (const path of linked.reverse()) if (existsSync(path) && statSync(path).mtimeMs >= since) return path;
  return null;
}

/**
 * The model draws its own grid. Coarser than asked lost detail. Much finer is a fair
 * pixelisation when voted down. In between, from 1.15 to 2 times the grid, each art pixel of the
 * drawing lands across two of the grid's and small shapes break up.
 */
export function gridWarnings(logical: readonly [number, number], entry: Pick<GenEntry, 'width' | 'height'>): string[] {
  const [w, h] = logical;
  const ratios = [w / entry.width, h / entry.height];
  if (ratios.some((r) => r < 0.85)) {
    return [`drawn on a coarser grid: ${w}x${h} art pixels for ${entry.width}x${entry.height}; spell out more detail`];
  }
  if (ratios.some((r) => r > 1.15 && r < 2)) {
    return [`drawn on ${w}x${h}, between one and two times the grid: small shapes break up when voted to ${entry.width}x${entry.height}; draw it again with fewer, bigger details`];
  }
  return [];
}

function isMagenta(r: number, g: number, b: number): boolean {
  return r > 170 && b > 170 && g < Math.min(r, b) * 0.62;
}

/** First and last index whose share of drawing is at least half the strongest line's. */
function drawnSpan(counts: ArrayLike<number>): [number, number] {
  let top = 0;
  for (let i = 0; i < counts.length; i += 1) top = Math.max(top, counts[i] ?? 0);
  if (top === 0) throw new Error('The picture has nothing on its magenta');
  let first = 0;
  while ((counts[first] ?? 0) < top / 2) first += 1;
  let last = counts.length - 1;
  while ((counts[last] ?? 0) < top / 2) last -= 1;
  return [first, last];
}

/**
 * How many art pixels the drawing has along one side. The model's pixels are rarely a whole
 * number of image pixels, so each count is tried with its own pitch, and the count whose cell
 * borders sit on the most colour changes wins; half as many fits every other border just as well,
 * so the finest count that still fits is taken.
 */
function cellCount(changes: Float64Array, start: number, span: number, asked: number): number {
  const at = (p: number): number => {
    const i = Math.round(p);
    return Math.max(changes[i - 1] ?? 0, changes[i] ?? 0, changes[i + 1] ?? 0);
  };
  const scores: { n: number; score: number }[] = [];
  for (let n = Math.max(2, Math.floor(asked / 2)); n <= asked * 4 && span / n >= 3; n += 1) {
    let sum = 0;
    for (let k = 1; k < n; k += 1) sum += at(start + k * span / n);
    scores.push({ n, score: sum / (n - 1) });
  }
  const best = Math.max(0, ...scores.map((s) => s.score));
  // a side with no colour change at all (stripes) says nothing about its grid
  if (best === 0) return asked;
  return [...scores].reverse().find((s) => s.score >= best * 0.85)?.n ?? asked;
}

/** Resample a grid of palette indices by area: each new cell takes the index covering most of it. */
function voteResize(cells: Int16Array, n: number, m: number, width: number, height: number): Int16Array {
  if (n === width && m === height) return cells;
  const out = new Int16Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const votes = new Map<number, number>();
      const [x0, x1, y0, y1] = [x * n / width, (x + 1) * n / width, y * m / height, (y + 1) * m / height];
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy += 1) {
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx += 1) {
          const weight = (Math.min(x1, sx + 1) - Math.max(x0, sx)) * (Math.min(y1, sy + 1) - Math.max(y0, sy));
          const index = cells[sy * n + sx] ?? 0;
          if (weight > 0) votes.set(index, (votes.get(index) ?? 0) + weight);
        }
      }
      out[y * width + x] = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    }
  }
  return out;
}

export interface TileResult {
  png: Buffer;
  /** The art pixels the drawing had before it was brought to the asked size. */
  logical: [number, number];
  colors: number;
}

/**
 * A ground tile fills its square, which the importer would read as background. It is cropped to
 * the drawing on the magenta, its own grid is found, each of its art pixels takes the palette
 * colour most of its middle snaps to, and the grid is voted to the asked size. Opaque edge to edge.
 */
export function importTile(source: Buffer, width: number, height: number, palette: readonly string[] = CORE_PALETTE): TileResult {
  const image = PNG.sync.read(source);
  const colors: Rgb[] = palette.map(hexToRgb);
  const nearest = new Map<number, number>();
  const labels = new Int16Array(image.width * image.height);
  const columns = new Float64Array(image.width);
  const rows = new Float64Array(image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const o = (y * image.width + x) * 4;
      const [r, g, b] = [image.data[o] ?? 0, image.data[o + 1] ?? 0, image.data[o + 2] ?? 0];
      if (isMagenta(r, g, b) || (image.data[o + 3] ?? 255) < 128) {
        labels[y * image.width + x] = -1;
        continue;
      }
      const key = (r << 16) | (g << 8) | b;
      let index = nearest.get(key);
      if (index === undefined) {
        index = nearestPaletteIndex(r, g, b, colors);
        nearest.set(key, index);
      }
      labels[y * image.width + x] = index;
      columns[x] = (columns[x] ?? 0) + 1;
      rows[y] = (rows[y] ?? 0) + 1;
    }
  }
  const [left, right] = drawnSpan(columns);
  const [top, bottom] = drawnSpan(rows);
  const across = new Float64Array(image.width + 1);
  const down = new Float64Array(image.height + 1);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const here = labels[y * image.width + x] ?? -1;
      if (x > left && here !== labels[y * image.width + x - 1]) across[x] = (across[x] ?? 0) + 1;
      if (y > top && here !== labels[(y - 1) * image.width + x]) down[y] = (down[y] ?? 0) + 1;
    }
  }
  const spanX = right - left + 1;
  const spanY = bottom - top + 1;
  const n = cellCount(across, left, spanX, width);
  const m = cellCount(down, top, spanY, height);
  const cells = new Int16Array(n * m);
  for (let cy = 0; cy < m; cy += 1) {
    for (let cx = 0; cx < n; cx += 1) {
      const votes = new Map<number, number>();
      const x0 = Math.floor(left + (cx + 0.25) * spanX / n);
      const y0 = Math.floor(top + (cy + 0.25) * spanY / m);
      const x1 = Math.max(x0 + 1, Math.ceil(left + (cx + 0.75) * spanX / n));
      const y1 = Math.max(y0 + 1, Math.ceil(top + (cy + 0.75) * spanY / m));
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const index = labels[y * image.width + x] ?? -1;
          if (index >= 0) votes.set(index, (votes.get(index) ?? 0) + 1);
        }
      }
      cells[cy * n + cx] = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    }
  }
  const sized = voteResize(cells, n, m, width, height);
  const out = new PNG({ width, height });
  for (let i = 0; i < width * height; i += 1) {
    const color = colors[sized[i] ?? 0] ?? [0, 0, 0];
    out.data.set([color[0], color[1], color[2], 255], i * 4);
  }
  return { png: PNG.sync.write(out), logical: [n, m], colors: new Set(sized).size };
}

interface Options {
  spec: string;
  out: string;
  only: Set<string> | null;
  dry: boolean;
  reimport: boolean;
  timeoutSeconds: number;
}

export function parseArgs(args: readonly string[]): Options {
  const spec = args[0];
  if (spec === undefined || spec.startsWith('--')) {
    throw new Error('Usage: gen.ts <spec.json> [--only a,b] [--out dir] [--dry] [--reimport] [--timeout seconds]');
  }
  const value = (flag: string): string | undefined => {
    const at = args.indexOf(flag);
    return at < 0 ? undefined : args[at + 1];
  };
  const only = value('--only');
  const timeout = args.includes('--timeout') ? value('--timeout') ?? '' : undefined;
  const timeoutSeconds = timeout === undefined ? 300 : Number(timeout);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error(`--timeout takes a positive number of seconds, not ${JSON.stringify(timeout)}`);
  }
  return {
    spec: resolve(spec),
    out: resolve(value('--out') ?? join(ROOT, '.scratch/kit-gen', basename(spec, '.json'))),
    only: only === undefined ? null : new Set(only.split(',')),
    dry: args.includes('--dry'),
    reimport: args.includes('--reimport'),
    timeoutSeconds,
  };
}

/** The kit's own tile as letters, so a grid prompt shows the style it continues. */
function referenceGrid(reference: Raster): readonly string[] | null {
  return reference.width === reference.height && reference.width <= 32 ? pngToGrid(reference) : null;
}

function codexVersion(): string {
  const run = spawnSync('codex', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return run.status === 0 ? run.stdout.trim() : 'unknown';
}

/** Run Codex once in the work folder and find the file it wrote. The prompt goes before -i: -i takes every path that follows it. */
function askCodex(
  options: Options, version: string, name: string, stamp: string, prompt: string, images: readonly string[], expect: string,
): { codex: NonNullable<ManifestLine['codex']>; saved: string | null; error: string } {
  const workdir = join(options.out, 'work');
  const logPath = join(options.out, 'log', `${name}-${stamp}.txt`);
  const since = Date.now();
  const run = spawnSync('codex', ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', prompt, ...images], {
    cwd: workdir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutSeconds * 1000, maxBuffer: 64 * 1024 * 1024,
  });
  const log = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  writeFileSync(logPath, log);
  return {
    codex: {
      version, exit: run.status, seconds: Math.round((Date.now() - since) / 1000),
      tokens: parseTokens(log), log: logPath.replace(`${options.out}/`, ''),
    },
    saved: findOutput(workdir, expect, log, since),
    error: run.error === undefined ? 'Codex saved no image' : `Codex did not finish: ${run.error.message}`,
  };
}

function generateOne(entry: GenEntry, options: Options, version: string, earlier: readonly ManifestLine[]): ManifestLine {
  const kind = entry.kind ?? 'sprite';
  const reference = loadReference(entry.ref);
  const refPath = join(options.out, 'ref', `${entry.name}.png`);
  writeFileSync(refPath, PNG.sync.write(enlargeOnMagenta(reference)));
  writeFileSync(join(options.out, 'ref', `${entry.name}-1x.png`), PNG.sync.write(reference));
  const file = `${entry.name}.png`;
  const grid = entry.route === 'grid';
  const at = new Date().toISOString();
  const line: ManifestLine = {
    name: entry.name, spec: options.spec.replace(`${ROOT}/`, ''), ref: entry.ref, refSize: [reference.width, reference.height],
    kind, route: entry.route ?? 'image', width: entry.width, height: entry.height, prompt: entry.route === 'grid' ? gridPrompt({ what: entry.what, width: entry.width, height: entry.height, detail: entry.detail, reference: referenceGrid(reference), file: `${entry.name}.txt` }) : buildPrompt(entry, reference, file), codex: null,
    raw: null, out: null, grid: null, logical: null, colors: null, warnings: [], error: null, at,
  };
  if (options.dry) return line;

  if (options.reimport) {
    // the image is the one Codex drew last time, so its source is that run's
    const last = [...earlier].reverse().find((l) => l.name === entry.name && l.raw !== null);
    if (last === undefined) {
      line.error = 'No earlier image to import again';
      return line;
    }
    if (last.ref !== entry.ref) {
      line.error = `The last image was drawn from ${last.ref}, not ${entry.ref}: generate it again`;
      return line;
    }
    Object.assign(line, { prompt: last.prompt, codex: last.codex, raw: last.raw });
  } else {
    const stamp = at.replace(/[:.]/g, '-');
    // a text grid is written, not drawn: no picture goes in and no image tool is needed
    const styleRefs = (entry.style_refs ?? []).flatMap((p) => ['-i', join(ROOT, p)]);
    const asked = askCodex(options, version, entry.name, stamp, line.prompt, grid ? [] : ['-i', refPath, ...styleRefs], grid ? `${entry.name}.txt` : file);
    line.codex = asked.codex;
    const saved = asked.saved;
    if (saved === null) {
      line.error = asked.error;
      return line;
    }
    line.raw = `raw/${entry.name}-${stamp}.${grid ? 'txt' : 'png'}`;
    writeFileSync(join(options.out, line.raw), readFileSync(saved));
  }

  try {
    const raw = readFileSync(join(options.out, line.raw ?? ''));
    // each import keeps its own file, so every manifest line points at what it made
    const own = `out/${entry.name}-${at.replace(/[:.]/g, '-')}.png`;
    const outPath = join(options.out, own);
    if (grid) {
      const rows = parseGrid(readFileSync(join(options.out, line.raw ?? ''), 'utf8'), entry.width, entry.height);
      writeFileSync(outPath, PNG.sync.write(renderGrid(rows)));
      line.logical = [entry.width, entry.height];
      line.colors = colourCount(rows);
      line.warnings.push(...seamWarnings(rows));
    } else if (kind === 'tile') {
      const result = importTile(raw, entry.width, entry.height, importPalette(entry));
      writeFileSync(outPath, result.png);
      line.logical = result.logical;
      line.colors = result.colors;
      line.warnings.push(...gridWarnings(result.logical, entry));
    } else {
      const result = importSprite(raw, {
        width: entry.width, height: entry.height, anchor: entry.anchor ?? 'center',
        palette: importPalette(entry), dither: entry.style === 'rich',
      });
      writeFileSync(outPath, result.png);
      line.grid = result.grid;
      line.logical = result.logical;
      line.colors = result.colors;
      line.warnings.push(...gridWarnings(result.logical, entry));
    }
    writeFileSync(join(options.out, file), readFileSync(outPath));
    line.out = own;
    const ramps = importRamps(entry);
    if (ramps.length > 0) line.ramps = [...ramps];
  } catch (error) {
    line.error = `import: ${(error as Error).message}`;
  }
  return line;
}

/** The shared ramps an entry imports in: the ones it names, else every shared ramp for `rich`, else none. */
export function importRamps(entry: Pick<GenEntry, 'ramps' | 'style'>): readonly string[] {
  if (entry.ramps !== undefined) return entry.ramps;
  return entry.style === 'rich' ? CORE_RAMPS.map((r) => r.id) : [];
}

/** The colours the importer may snap onto for an entry: the 32, plus the steps of the ramps it imports in. */
export function importPalette(entry: Pick<GenEntry, 'ramps' | 'style'>): readonly string[] {
  return paletteWithRamps(importRamps(entry));
}

/** Does `--only` name this entry, or one of a scatter entry's motifs (`meadow_tuft`)? */
export function entryMatches(entry: GenEntry, only: ReadonlySet<string> | null): boolean {
  if (only === null || only.has(entry.name)) return true;
  return (entry.motifs ?? []).some((m) => only.has(`${entry.name}_${m.name}`));
}

/** The frame of the measure in STYLE.md section 3: a 1440x3120 phone at 64 px per tile. */
const PHONE_FRAME = { x: 23, y: 49 };

/**
 * A scatter ground: one manifest line per motif (drawn by Codex, or kept from the last run), then one per
 * baked variant. The variants cost no Codex time, so a seed or a spec change is a `--reimport`.
 */
function generateScatter(entry: GenEntry, options: Options, version: string, earlier: readonly ManifestLine[]): ManifestLine[] {
  const reference = loadReference(entry.ref);
  writeFileSync(join(options.out, 'ref', `${entry.name}-1x.png`), PNG.sync.write(reference));
  const at = new Date().toISOString();
  const stamp = at.replace(/[:.]/g, '-');
  const base = entry.base ?? 'c';
  const lines: ManifestLine[] = [];
  const motifs: Motif[] = [];
  const sources: string[] = [];
  const blank = (name: string, kind: 'sprite' | 'tile', route: 'motif' | 'scatter', width: number, height: number, prompt: string): ManifestLine => ({
    name, spec: options.spec.replace(`${ROOT}/`, ''), ref: entry.ref, refSize: [reference.width, reference.height],
    kind, route, width, height, prompt, codex: null, raw: null, out: null, grid: null, logical: null, colors: null,
    warnings: [], error: null, at,
  });
  for (const m of entry.motifs ?? []) {
    const name = `${entry.name}_${m.name}`;
    const line = blank(name, 'sprite', 'motif', m.width, m.height, motifPrompt({ what: m.what, width: m.width, height: m.height, detail: m.detail, base, file: `${name}.txt` }));
    lines.push(line);
    if (options.dry) continue;
    const redraw = !options.reimport && (options.only === null || options.only.has(entry.name) || options.only.has(name));
    if (redraw) {
      const asked = askCodex(options, version, name, stamp, line.prompt, [], `${name}.txt`);
      line.codex = asked.codex;
      if (asked.saved === null) {
        line.error = asked.error;
        continue;
      }
      line.raw = `raw/${name}-${stamp}.txt`;
      writeFileSync(join(options.out, line.raw), readFileSync(asked.saved));
    } else {
      const last = [...earlier].reverse().find((l) => l.name === name && l.out !== null && l.raw !== null);
      if (last === undefined) {
        line.error = 'No earlier motif to bake from: draw it first';
        continue;
      }
      Object.assign(line, { prompt: last.prompt, codex: last.codex, raw: last.raw });
    }
    try {
      const grid = parseMotif(readFileSync(join(options.out, line.raw ?? ''), 'utf8'), m.width, m.height);
      const own = `out/${name}-${stamp}.png`;
      writeFileSync(join(options.out, own), PNG.sync.write(renderMotif(grid)));
      writeFileSync(join(options.out, `${name}.png`), readFileSync(join(options.out, own)));
      line.out = own;
      line.logical = [m.width, m.height];
      line.colors = new Set([...grid.join('')].filter((ch) => ch !== '.')).size;
      line.warnings.push(...motifWarnings(grid));
      motifs.push({ name: m.name, weight: m.weight ?? 1, grid });
      sources.push(line.raw ?? '');
    } catch (error) {
      line.error = `import: ${(error as Error).message}`;
    }
  }
  if (options.dry || motifs.length !== (entry.motifs ?? []).length) return lines;

  const ground = {
    base, cell: entry.cell ?? 16, chance: entry.chance ?? 0.85, speckles: entry.speckles ?? [], tile: entry.width, motifs, seed: entry.name,
  };
  const variants = entry.variants ?? 4;
  const throws = variantsOf(ground, variants);
  const grids = throws.map(scatterTile);
  const warnings = tileWarnings(ground, variants, PHONE_FRAME);
  grids.forEach((grid, i) => {
    const name = `${entry.name}_${i + 1}`;
    const line = blank(name, 'tile', 'scatter', entry.width, entry.height, `scattered from ${sources.join(', ')}`);
    const own = `out/${name}-${stamp}.png`;
    writeFileSync(join(options.out, own), PNG.sync.write(renderGrid(grid)));
    writeFileSync(join(options.out, `${name}.png`), readFileSync(join(options.out, own)));
    Object.assign(line, {
      out: own, logical: [entry.width, entry.height], colors: colourCount(grid), seed: throws[i]?.seed, motifs: sources,
      warnings: i === 0 ? warnings : [],
    });
    lines.push(line);
  });
  return lines;
}

function readManifest(path: string): ManifestLine[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as ManifestLine);
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/**
 * The latest image of each name beside its reference. CSS pixels are device pixels on a desktop
 * screen, so the reference at 6 per art pixel and the result at 3 are both their size on a 3x phone.
 */
export function galleryHtml(lines: readonly ManifestLine[]): string {
  const latest = new Map<string, ManifestLine>();
  for (const line of lines) latest.set(line.name, line);
  const rows = [...latest.values()].map((line) => {
    const refImg = `<img src="ref/${line.name}-1x.png" alt="" style="width:${line.refSize[0] * 6}px">`;
    const result = line.out === null
      ? `<p class="bad">${escapeHtml(line.error ?? 'not generated yet')}</p>`
      : line.kind === 'tile'
        ? `<div class="tiles" style="width:${line.width * 9}px;height:${line.height * 9}px;background-image:url('${line.out}');background-size:${line.width * 3}px"></div>`
        : `<img src="${line.out}" alt="" style="width:${line.width * 3}px">`;
    const facts = [
      `${line.width}x${line.height} ${line.kind} from ${line.ref}`,
      line.logical === null ? null : `drawn ${line.logical[0]}x${line.logical[1]}`,
      line.grid === null ? null : `grid ${line.grid}`,
      line.colors === null ? null : `${line.colors} colours`,
      line.codex === null ? null : `${line.codex.seconds} s, ${line.codex.tokens ?? '?'} tokens`,
    ].filter((fact) => fact !== null).join(' · ');
    const warnings = line.warnings.map((w) => `<p class="warn">${escapeHtml(w)}</p>`).join('');
    const raw = line.raw === null ? '' : line.raw.endsWith('.txt') ? `<a href="${line.raw}">letters</a>` : `<a href="${line.raw}"><img class="raw" src="${line.raw}" alt="raw"></a>`;
    return `<section><h2>${escapeHtml(line.name)}</h2><p>${escapeHtml(facts)}</p>${warnings}<div class="row">${refImg}${result}${raw}</div></section>`;
  });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>kit:gen gallery</title>
<style>
body { background: #2e6b3b; color: #f5f4ef; font: 14px system-ui, sans-serif; margin: 16px; }
section { margin-bottom: 24px; } h2 { margin: 0 0 4px; font-size: 16px; } p { margin: 2px 0; }
.row { display: flex; gap: 24px; align-items: flex-end; flex-wrap: wrap; margin-top: 8px; }
img, .tiles { image-rendering: pixelated; } .raw { width: 160px; image-rendering: auto; }
.warn { color: #f8de62; } .bad { color: #f6a07f; }
</style></head><body>
<p>Left: the reference as the game draws it today (6 device pixels per art pixel on a 3x phone). Middle: the redraw at 3, the same size on screen; a tile is repeated 3x3. Right: Codex's picture.</p>
${rows.join('\n')}
</body></html>
`;
}

function runCli(args: readonly string[]): void {
  const options = parseArgs(args);
  const entries = parseSpec(readFileSync(options.spec, 'utf8')).filter((e) => entryMatches(e, options.only));
  if (entries.length === 0) throw new Error('No spec entry matches --only');
  for (const dir of ['', 'ref', 'raw', 'log', 'work', 'out']) mkdirSync(join(options.out, dir), { recursive: true });
  const version = options.dry || options.reimport ? 'none' : codexVersion();
  const manifestPath = join(options.out, 'manifest.jsonl');
  const earlier = readManifest(manifestPath);
  let failed = 0;
  for (const entry of entries) {
    for (const line of entry.route === 'scatter' ? generateScatter(entry, options, version, earlier) : [generateOne(entry, options, version, earlier)]) {
      if (!options.dry) appendFileSync(manifestPath, `${JSON.stringify(line)}\n`);
      if (line.error !== null) failed += 1;
      const said = options.dry ? line.prompt : line.error ?? [line.out, ...line.warnings].join(' - ');
      process.stdout.write(`${line.name}: ${said}\n`);
    }
  }
  if (!options.dry) {
    writeFileSync(join(options.out, 'gallery.html'), galleryHtml(readManifest(manifestPath)));
    process.stdout.write(`${join(options.out, 'gallery.html')}\n`);
  }
  if (failed > 0) process.exitCode = 1;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) runCli(process.argv.slice(2));
