/**
 * pnpm anim sheets: the rendered walks of every target that ships (anim.json `ships`) into content/kit/core/chars/,
 * one sheet per view: the poses of the distance-locked walk in order, then the standing pose last
 * (`chars/<sheet>_down|up|left`, 128x128 frames at density 4, `stride` in the kit entry). It also writes
 * tools/anim/feet.json, the planted feet of each sheet by pose, which the game's foot-slide test plays back.
 * The clothed-width rule (anim.json `clothed_width`) is checked on the walk's widest rows and fails the step.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { CONTENT_DIR } from '../load.js';
import { ANIM_DIR, CACHE_DIR, type Settings, type View } from './clip.js';
import { INK_HEX } from '../kit/ink.js';
import { CORE_PALETTE, coreRamp, hexToRgb } from '../kit/palette.js';
import { SPECK_MAX } from '../kit/holes.js';
import { type ClipMeasures, type Stride, widestRow } from './measure.js';
import type { Picture } from './snap.js';

export const SHEET_DIR = join(CONTENT_DIR, 'kit', 'core', 'chars');
export const KIT_FILE = join(CONTENT_DIR, 'kit', 'core', 'kit.json');
export const FEET_FILE = join(ANIM_DIR, 'feet.json');
/** The most ramps a kit sprite may name (schema/src/index.ts). */
export const MAX_RAMPS = 4;

/** The candidate ramps that hold a colour the pictures draw beyond the core palette, in the candidates' order, at least one. */
export function rampsUsed(pictures: readonly Picture[], candidates: readonly string[]): string[] {
  const core = new Set(CORE_PALETTE.map((h) => h.toLowerCase()));
  const left = new Set<string>();
  for (const p of pictures) {
    for (let i = 0; i < p.data.length; i += 4) {
      if ((p.data[i + 3] ?? 0) === 0) continue;
      const hex = `#${[p.data[i], p.data[i + 1], p.data[i + 2]].map((c) => (c as number).toString(16).padStart(2, '0')).join('')}`;
      if (!core.has(hex)) left.add(hex);
    }
  }
  const out: string[] = [];
  for (const id of candidates) {
    const steps = coreRamp(id)?.steps.map((h) => h.toLowerCase()) ?? [];
    if (!steps.some((h) => left.has(h))) continue;
    out.push(id);
    for (const h of steps) left.delete(h);
  }
  return out.length > 0 ? out : [candidates[0] as string];
}

/**
 * Closes the small see-through pockets a render encloses between a limb and the body (the kit check calls an enclosed
 * region of at most `SPECK_MAX` px a speck and refuses it, tools/src/kit/holes.ts): each one is filled with the ink, as a
 * pocket between an arm and a coat reads in a drawing. A larger one is an opening and stays. Returns how many it filled.
 */
export function closeSpecks(strip: Picture, frameWidth: number): number {
  const frames = strip.width / frameWidth;
  const [ir, ig, ib] = hexToRgb(INK_HEX);
  let filled = 0;
  for (let f = 0; f < frames; f += 1) {
    const at = (x: number, y: number) => (y * strip.width + f * frameWidth + x) * 4;
    const clear = (x: number, y: number) => (strip.data[at(x, y) + 3] ?? 0) < 128;
    const seen = new Uint8Array(frameWidth * strip.height);
    const flood = (sx: number, sy: number): [number, number][] => {
      const out: [number, number][] = [];
      const stack: [number, number][] = [[sx, sy]];
      seen[sy * frameWidth + sx] = 1;
      while (stack.length > 0) {
        const [x, y] = stack.pop() as [number, number];
        out.push([x, y]);
        for (let ny = Math.max(0, y - 1); ny <= Math.min(strip.height - 1, y + 1); ny += 1) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(frameWidth - 1, x + 1); nx += 1) {
            if (seen[ny * frameWidth + nx] === 0 && clear(nx, ny)) {
              seen[ny * frameWidth + nx] = 1;
              stack.push([nx, ny]);
            }
          }
        }
      }
      return out;
    };
    // the outside: every see-through region that meets the frame's edge
    for (let x = 0; x < frameWidth; x += 1) for (const y of [0, strip.height - 1]) if (seen[y * frameWidth + x] === 0 && clear(x, y)) flood(x, y);
    for (let y = 0; y < strip.height; y += 1) for (const x of [0, frameWidth - 1]) if (seen[y * frameWidth + x] === 0 && clear(x, y)) flood(x, y);
    for (let y = 0; y < strip.height; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        if (seen[y * frameWidth + x] !== 0 || !clear(x, y)) continue;
        const pocket = flood(x, y);
        if (pocket.length > SPECK_MAX) continue;
        for (const [px, py] of pocket) strip.data.set([ir, ig, ib, 255], at(px, py));
        filled += 1;
      }
    }
  }
  return filled;
}

export const VIEWS: readonly View[] = ['down', 'up', 'left'];

const readPng = (path: string): Picture => {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
};
const writePng = (path: string, p: Picture) => {
  const png = new PNG({ width: p.width, height: p.height });
  png.data = Buffer.from(p.data);
  writeFileSync(path, PNG.sync.write(png));
};

/** What the game needs of a stride sheet's planted feet: per view, the travel per pose, the slope and each planted run. */
export interface FeetFile {
  about: string;
  sheets: Record<string, Partial<Record<View, { poses: number; travel: number; slope: number; plants: { foot: string; poses: number[]; ys: number[]; icpt: number }[] }>>>;
}

export interface SheetsResult {
  written: string[];
  problems: string[];
  widths: Record<string, number>;
}

/** The median of a list of numbers. */
const median = (xs: number[]): number => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

/**
 * The clothed width of a sheet: the widest row of the silhouette (outline included, in frame px) in each pose of the
 * walk, and the median of those over the cycle. The standing frame, last, is not counted: the stance of one frame
 * (a foot forward, an arm out) would stand for the body. Measured in the down view, as the picks were (DECISIONS.md).
 */
export function cycleWidth(strip: Picture, frames: number, w: number): number {
  const widths: number[] = [];
  for (let i = 0; i < frames - 1; i += 1) {
    const one: Picture = { width: w, height: strip.height, data: new Uint8Array(w * strip.height * 4) };
    for (let y = 0; y < strip.height; y += 1) one.data.set(strip.data.subarray((y * strip.width + i * w) * 4, (y * strip.width + (i + 1) * w) * 4), y * w * 4);
    widths.push(widestRow(one));
  }
  return median(widths);
}

/** The cycle width of a committed sheet. */
export function sheetWidth(path: string, w: number): number {
  const strip = readPng(path);
  return cycleWidth(strip, strip.width / w, w);
}

/** The clothed-width rule over the cycle widths: each pair's first sheet at most `max_pct` of the second's. */
export function widthProblems(widths: Record<string, number>, rule: Settings['clothed_width']): string[] {
  const out: string[] = [];
  for (const [narrow, wide] of rule.pairs) {
    const a = widths[`${narrow}_down`];
    const b = widths[`${wide}_down`];
    if (a === undefined || b === undefined) continue;
    if (a * 100 > b * rule.max_pct) out.push(`${narrow} is ${a} px wide through its walk, ${Math.round((100 * a) / b)}% of ${wide} (${b} px); the rule is at most ${rule.max_pct}%`);
  }
  return out;
}

/** Builds the sheets from the casts under tools/.cache/anim/cast/ and updates the kit and the feet file. */
export function buildSheets(settings: Settings, write = true): SheetsResult {
  const result: SheetsResult = { written: [], problems: [], widths: {} };
  const kit = JSON.parse(readFileSync(KIT_FILE, 'utf8')) as { kit: { sprites: Record<string, Record<string, unknown>> } };
  const feet: FeetFile = {
    about: 'The planted feet of every walk sheet in content/kit/core/chars, written by `pnpm anim sheets` from the render (never by hand). The game test plays the real walker and the real pose rule against it and measures how far a planted foot is from the ground.',
    sheets: {},
  };
  const [fw, fh] = settings.frame.size;
  const pending: [string, Picture][] = [];
  for (const [id, target] of Object.entries(settings.targets)) {
    if (target.ships === undefined) continue;
    const { sheet } = target.ships;
    const clip = target.ships.clip ?? 'jog';
    const walk = join(CACHE_DIR, 'cast', id, clip);
    const stand = join(CACHE_DIR, 'cast', id, 'stand');
    if (!existsSync(join(walk, `${clip}.json`)) || !existsSync(join(stand, 'stand.json'))) {
      result.problems.push(`${id}: not rendered (pnpm anim render ${clip} stand --target ${id})`);
      continue;
    }
    const info = JSON.parse(readFileSync(join(walk, `${clip}.json`), 'utf8')) as { poses: number; ramps: string[] };
    const measures = JSON.parse(readFileSync(join(walk, 'measures.json'), 'utf8')) as ClipMeasures;
    if (measures.problems.length > 0) result.problems.push(`${id}: ${clip} has open problems (${measures.problems.length}), first: ${measures.problems[0]}`);
    feet.sheets[sheet] = {};
    const strips: Partial<Record<View, { strip: Picture; frames: number; travel: number; slope: number; plants: Stride['plants'] }>> = {};
    for (const view of VIEWS) {
      const m = measures.views[view];
      if (m?.stride === undefined) {
        result.problems.push(`${id}: no stride measured in the ${view} view`);
        continue;
      }
      const frames = info.poses + 1;
      const strip: Picture = { width: fw * frames, height: fh, data: new Uint8Array(fw * frames * fh * 4) };
      for (let i = 0; i < frames; i += 1) {
        const file = i < info.poses ? join(walk, 'sprites', `${clip}_${view}_${String(i).padStart(2, '0')}.png`) : join(stand, 'sprites', `stand_${view}_00.png`);
        const sprite = readPng(file);
        if (sprite.width !== fw || sprite.height !== fh) {
          result.problems.push(`${file} is ${sprite.width}x${sprite.height}, the frame is ${fw}x${fh}`);
          continue;
        }
        for (let y = 0; y < fh; y += 1) strip.data.set(sprite.data.subarray(y * fw * 4, (y + 1) * fw * 4), (y * strip.width + i * fw) * 4);
      }
      closeSpecks(strip, fw);
      strips[view] = { strip, frames, travel: m.stride.travelPerPose, slope: m.stride.slope, plants: m.stride.plants };
    }
    // the ramps the sheet names: those of the target that hold a colour it draws beyond the core palette
    const named = rampsUsed(Object.values(strips).map((v) => v.strip), info.ramps);
    if (named.length > MAX_RAMPS) result.problems.push(`${id}: the sheet draws in ${named.length} ramps (${named.join(', ')}), a sprite names at most ${MAX_RAMPS}`);
    for (const view of VIEWS) {
      const v = strips[view];
      if (v === undefined) continue;
      const name = `${sheet}_${view}`;
      pending.push([join(SHEET_DIR, `${name}.png`), v.strip]);
      result.written.push(join(SHEET_DIR, `${name}.png`));
      kit.kit.sprites[`chars/${name}`] = {
        file: `chars/${name}.png`,
        w: fw,
        h: fh,
        frames: v.frames,
        density: 4,
        ramps: named,
        stride: { travel_mpx: Math.round(v.travel * 1000), anchor: [...settings.frame.anchor] },
      };
      feet.sheets[sheet]![view] = { poses: info.poses, travel: v.travel, slope: v.slope, plants: v.plants };
      result.widths[name] = cycleWidth(v.strip, v.frames, fw);
    }
  }
  result.problems.push(...widthProblems(result.widths, settings.clothed_width));
  if (write && result.problems.length === 0) {
    mkdirSync(SHEET_DIR, { recursive: true });
    for (const [path, strip] of pending) writePng(path, strip);
    writeFileSync(KIT_FILE, `${JSON.stringify(kit, null, 2)}\n`);
    writeFileSync(FEET_FILE, `${JSON.stringify(feet, null, 1)}\n`);
  }
  return result;
}

/** The credit lines of the characters the game ships (CREDITS.md "Characters"): one per race, from the target's `credit`, so a model's licence is never left out. */
export function characterCredits(settings: Settings): string[] {
  const byRace = new Map<string, Set<string>>();
  for (const target of Object.values(settings.targets)) {
    if (target.ships === undefined) continue;
    const race = target.ships.sheet.replace(/_w$/, '');
    if (target.credit === undefined) throw new Error(`the target of the sheet ${target.ships.sheet} ships without a credit in anim.json`);
    byRace.set(race, (byRace.get(race) ?? new Set()).add(target.credit));
  }
  return [...byRace.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([race, credits]) => [...credits].map((c) => `- ${race[0]!.toUpperCase()}${race.slice(1)}: ${c}.`));
}
