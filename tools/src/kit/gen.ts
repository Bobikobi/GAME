/**
 * Redraw kit sprites with an image model and bring them back onto the kit's grid.
 *
 * DECISIONS 2026-10-18 "The art moves to 32 px per tile". A spec names each sprite: the stock
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
 * Nothing is written into `content/`: a result goes into the kit by hand, in a wave. `--dry` writes
 * the references and the prompts only; `--reimport` imports the last raw images again without
 * calling Codex. Each image costs one to two minutes and 11k to 31k Codex tokens (measured
 * 18.10), so run it in the background, one spec at a time.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PNG } from 'pngjs';

import { importSprite, nearestPaletteIndex } from './import.js';
import { CORE_PALETTE, type Rgb, hexToRgb } from './palette.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** The largest grid a spec may ask for: a 128x128 prop at 32 px per tile. */
const MAX_SIDE = 128;

export interface GenEntry {
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
  anchor?: 'center' | 'bottom';
  /** The detail to spell out. The model draws as many pixels as it is given things to draw. */
  detail?: string;
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
    if (entry.anchor !== undefined && entry.anchor !== 'center' && entry.anchor !== 'bottom') throw new Error(`${where}.anchor must be center or bottom`);
    if (entry.detail !== undefined && typeof entry.detail !== 'string') throw new Error(`${where}.detail must be text`);
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
  return [
    `Use your image generation tool. The attached image is a reference: ${entry.what}, ${reference.width}x${reference.height} pixels, from our top-down pixel-art game, shown enlarged on magenta.`,
    `Generate a NEW image of the same ${entry.what} - same design, same colors, same top-down three-quarter view - redrawn as pixel art ${entry.width} pixels wide and ${entry.height} pixels tall, far more pixels than the reference${detail}.`,
    `Every pixel stays a crisp square of one flat color, no anti-aliasing, each one about 1/${entry.width} of the drawing's width: draw no smaller pixels than that.`,
    kindLine,
    'Limited palette, two-tone shading, solid flat pure magenta #FF00FF background around it, no text, no shadow, no extra objects.',
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

function parseArgs(args: readonly string[]): Options {
  const spec = args[0];
  if (spec === undefined || spec.startsWith('--')) {
    throw new Error('Usage: gen.ts <spec.json> [--only a,b] [--out dir] [--dry] [--reimport] [--timeout seconds]');
  }
  const value = (flag: string): string | undefined => {
    const at = args.indexOf(flag);
    return at < 0 ? undefined : args[at + 1];
  };
  const only = value('--only');
  return {
    spec: resolve(spec),
    out: resolve(value('--out') ?? join(ROOT, '.scratch/kit-gen', basename(spec, '.json'))),
    only: only === undefined ? null : new Set(only.split(',')),
    dry: args.includes('--dry'),
    reimport: args.includes('--reimport'),
    timeoutSeconds: Number(value('--timeout') ?? 300),
  };
}

function codexVersion(): string {
  const run = spawnSync('codex', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return run.status === 0 ? run.stdout.trim() : 'unknown';
}

function generateOne(entry: GenEntry, options: Options, version: string, earlier: readonly ManifestLine[]): ManifestLine {
  const kind = entry.kind ?? 'sprite';
  const reference = loadReference(entry.ref);
  const refPath = join(options.out, 'ref', `${entry.name}.png`);
  writeFileSync(refPath, PNG.sync.write(enlargeOnMagenta(reference)));
  writeFileSync(join(options.out, 'ref', `${entry.name}-1x.png`), PNG.sync.write(reference));
  const file = `${entry.name}.png`;
  const at = new Date().toISOString();
  const line: ManifestLine = {
    name: entry.name, spec: options.spec.replace(`${ROOT}/`, ''), ref: entry.ref, refSize: [reference.width, reference.height],
    kind, width: entry.width, height: entry.height, prompt: buildPrompt(entry, reference, file), codex: null,
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
    const workdir = join(options.out, 'work');
    const logPath = join(options.out, 'log', `${entry.name}-${stamp}.txt`);
    const since = Date.now();
    // the prompt goes before -i: -i takes every path that follows it
    const run = spawnSync('codex', ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', line.prompt, '-i', refPath], {
      cwd: workdir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeoutSeconds * 1000, maxBuffer: 64 * 1024 * 1024,
    });
    const log = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    writeFileSync(logPath, log);
    line.codex = {
      version, exit: run.status, seconds: Math.round((Date.now() - since) / 1000),
      tokens: parseTokens(log), log: logPath.replace(`${options.out}/`, ''),
    };
    const saved = findOutput(workdir, file, log, since);
    if (saved === null) {
      line.error = run.error === undefined ? 'Codex saved no image' : `Codex did not finish: ${run.error.message}`;
      return line;
    }
    line.raw = `raw/${entry.name}-${stamp}.png`;
    writeFileSync(join(options.out, line.raw), readFileSync(saved));
  }

  try {
    const raw = readFileSync(join(options.out, line.raw ?? ''));
    // each import keeps its own file, so every manifest line points at what it made
    const own = `out/${entry.name}-${at.replace(/[:.]/g, '-')}.png`;
    const outPath = join(options.out, own);
    if (kind === 'tile') {
      const result = importTile(raw, entry.width, entry.height);
      writeFileSync(outPath, result.png);
      line.logical = result.logical;
      line.colors = result.colors;
      line.warnings.push(...gridWarnings(result.logical, entry));
    } else {
      const result = importSprite(raw, {
        width: entry.width, height: entry.height, anchor: entry.anchor ?? 'center', palette: CORE_PALETTE,
      });
      writeFileSync(outPath, result.png);
      line.grid = result.grid;
      line.logical = result.logical;
      line.colors = result.colors;
      line.warnings.push(...gridWarnings(result.logical, entry));
    }
    writeFileSync(join(options.out, file), readFileSync(outPath));
    line.out = own;
  } catch (error) {
    line.error = `import: ${(error as Error).message}`;
  }
  return line;
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
    const raw = line.raw === null ? '' : `<a href="${line.raw}"><img class="raw" src="${line.raw}" alt="raw"></a>`;
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
  const entries = parseSpec(readFileSync(options.spec, 'utf8')).filter((e) => options.only === null || options.only.has(e.name));
  if (entries.length === 0) throw new Error('No spec entry matches --only');
  for (const dir of ['', 'ref', 'raw', 'log', 'work', 'out']) mkdirSync(join(options.out, dir), { recursive: true });
  const version = options.dry || options.reimport ? 'none' : codexVersion();
  const manifestPath = join(options.out, 'manifest.jsonl');
  const earlier = readManifest(manifestPath);
  let failed = 0;
  for (const entry of entries) {
    const line = generateOne(entry, options, version, earlier);
    if (!options.dry) appendFileSync(manifestPath, `${JSON.stringify(line)}\n`);
    if (line.error !== null) failed += 1;
    const said = options.dry ? line.prompt : line.error ?? [line.out, ...line.warnings].join(' - ');
    process.stdout.write(`${entry.name}: ${said}\n`);
  }
  if (!options.dry) {
    writeFileSync(join(options.out, 'gallery.html'), galleryHtml(readManifest(manifestPath)));
    process.stdout.write(`${join(options.out, 'gallery.html')}\n`);
  }
  if (failed > 0) process.exitCode = 1;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) runCli(process.argv.slice(2));
