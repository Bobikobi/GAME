/**
 * The owner's kept pictures on their way into the full map (issue #664): the queue, and the camera record that the
 * promote step requires.
 *
 * A draft the owner kept (`review: keep`, `review_by` owner or elad) is a family of one picture or of many frames. The queue
 * names for each family where it stands and why: `camera check` (nobody has looked at it at the game's size, on the grass,
 * beside the character), `fix` (looked at and failed), `kit` (passed, not yet in the kit), `map` (in the kit, no place in the
 * map yet) or `done`. Families that are not a single prop picture wait for something else, and say what.
 *
 * The camera record is `tools/kit-gen/camera.jsonl`, append-only, one line per draft: the verdict, its reason, the still it was
 * made on and the hash of the reduced picture it was about. A changed reduction is a different picture and has no verdict, so
 * the check cannot be carried over by accident. Nothing in `tools/src/art` measures the angle (checked 2.11): a verdict is an
 * agent's eye on a still, recorded.
 *
 * Pure over its inputs; the disk is read in `promote-cli.ts`.
 */
import { createHash } from 'node:crypto';

import { PNG } from 'pngjs';

import type { Draft } from './drafts.js';
import { type Choice, OWNER_BY } from './library-reviews.js';
import { reduce } from './reduce.js';

export const CAMERA_FILE = 'tools/kit-gen/camera.jsonl';
export const PROMOTED_MANIFEST = 'tools/kit-gen/promote.manifest.jsonl';

/** A sprite of the kit that a kept picture takes the place of, or enters the set of. */
export const STEPS = ['camera check', 'fix', 'kit', 'map', 'done'] as const;
export type Step = (typeof STEPS)[number];

/** `ready` families are pictures of one thing that can go through the camera check as drawn. The others wait for what `why` says. */
export const BUCKETS = ['ready', 'cut', 'parameters', 'source', 'advanced'] as const;
export type Bucket = (typeof BUCKETS)[number];

/** The draft's name without its frame or variant number: `pro-bush-12` and `rock_mossy_3` are one family. */
export function familyOf(name: string): string {
  return name.replace(/[-_]?\d+$/u, '');
}

export interface BucketRule {
  bucket: Exclude<Bucket, 'ready'>;
  /** Tested against the family name. */
  match: RegExp;
  why: string;
}

/**
 * First rule that matches wins. The focus of 1.11 is the core (the map's design, the graphics, the 64 rich, the new map,
 * infrastructure): creatures, effects and combat motion are advanced topics and do not enter the map yet.
 */
export const BUCKET_RULES: readonly BucketRule[] = [
  { bucket: 'advanced', match: /^(cat|fox|dog)-/u, why: 'a creature: advanced, not built (focus of 1.11)' },
  { bucket: 'advanced', match: /^(hit-flash|slash|spell-swirl|vanish|rainsplash|campfire)(-|$)/u, why: 'an effect: advanced, not built (focus of 1.11)' },
  { bucket: 'advanced', match: /^(anim-chop|anim-sneak|sneak-v3|crouch-col|edit-crouch)/u, why: 'combat or work motion: advanced, not built (focus of 1.11)' },
  { bucket: 'source', match: /^kf-/u, why: 'a keyframe pair for an animation, not a prop' },
  { bucket: 'parameters', match: /^(human|char-v3)-/u, why: 'a figure: directions and frames come from PixelLab or Blender, and the angle of the 22.10 drawings is the figures stream (#634, #661)' },
  { bucket: 'parameters', match: /^anim-(oak-wind|wind)/u, why: 'wind frames of one picture: the frames go with their picture once it is in the kit' },
  { bucket: 'cut', match: /^(sheet-|props-|palette-|creatures$|oaks$)/u, why: 'a sheet of 400 by 400 with many pieces: cut the pieces, then each is a picture' },
  { bucket: 'cut', match: /-lock$/u, why: 'a locked sheet of several pieces (400 by 400): cut the pieces' },
  { bucket: 'source', match: /^city_skyline$/u, why: 'a skyline backdrop, not a prop of the map' },
  { bucket: 'source', match: /(-source|_ref)$|^(source|colourref)$/u, why: 'a reference or a source picture a design is drawn from, not a piece' },
];

/** What a family waits for when it is not a single picture ready for the camera check. */
export function bucketOf(family: string): { bucket: Bucket; why: string } {
  for (const rule of BUCKET_RULES) if (rule.match.test(family)) return { bucket: rule.bucket, why: rule.why };
  return { bucket: 'ready', why: 'one picture of one thing' };
}

/* ---- the owner's keeps ---- */

/** The drafts the owner kept, his page choices laid over the index (`choices`, the page's `reviews.jsonl`) so the queue works before and after the landing. */
export function ownerKept(drafts: Iterable<Draft>, choices: ReadonlyMap<string, Choice>): Draft[] {
  const kept: Draft[] = [];
  for (const draft of drafts) {
    const choice = choices.get(draft.id);
    const state = choice === undefined ? { review: draft.review, by: draft.review_by } : { review: choice.review, by: 'owner' };
    if (state.review === 'keep' && OWNER_BY.includes(state.by ?? '')) kept.push(draft);
  }
  return kept.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }) || a.id.localeCompare(b.id));
}

/* ---- the snap to the named ramps ---- */

type Lab = readonly [number, number, number];

const hexRgb = (hex: string): [number, number, number] => [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];

/** CIE Lab (D65) of an sRGB colour: the distance the eye sees, so a hue that drifts counts and a step of light does not count double. */
export function labOf(r: number, g: number, b: number): Lab {
  const lin = (c: number): number => { const v = c / 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const xyz = [(0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047, 0.2126 * lr + 0.7152 * lg + 0.0722 * lb, (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883];
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(xyz[0] as number), f(xyz[1] as number), f(xyz[2] as number)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export interface Snapped {
  png: PNG;
  /** Mean Lab distance of the opaque pixels to the colour they were moved to; 0 when the picture was already in the palette. */
  meanDE: number;
  /** The largest distance any pixel moved. */
  maxDE: number;
  /** Opaque pixels that changed colour. */
  changed: number;
  colours: number;
}

/** The picture with every opaque pixel moved to the nearest colour of `palette` in Lab. Deterministic: ties go to the earlier colour. */
export function snapToPalette(src: PNG, palette: readonly string[]): Snapped {
  const rgbs = palette.map((h) => hexRgb(h.toLowerCase()));
  const labs = rgbs.map(([r, g, b]) => labOf(r, g, b));
  const out = new PNG({ width: src.width, height: src.height });
  const cache = new Map<number, { to: number; d: number }>();
  let sum = 0;
  let max = 0;
  let changed = 0;
  let opaque = 0;
  const used = new Set<number>();
  for (let i = 0; i < src.data.length; i += 4) {
    if ((src.data[i + 3] as number) === 0) continue;
    opaque += 1;
    const key = ((src.data[i] as number) << 16) | ((src.data[i + 1] as number) << 8) | (src.data[i + 2] as number);
    let hit = cache.get(key);
    if (hit === undefined) {
      const l = labOf(src.data[i] as number, src.data[i + 1] as number, src.data[i + 2] as number);
      let best = 0;
      let bestD = Infinity;
      for (const [n, p] of labs.entries()) {
        const d = Math.hypot(l[0] - p[0], l[1] - p[1], l[2] - p[2]);
        if (d < bestD) { bestD = d; best = n; }
      }
      hit = { to: best, d: bestD };
      cache.set(key, hit);
    }
    const [r, g, b] = rgbs[hit.to] as [number, number, number];
    out.data[i] = r;
    out.data[i + 1] = g;
    out.data[i + 2] = b;
    out.data[i + 3] = 255;
    used.add(hit.to);
    sum += hit.d;
    if (hit.d > max) max = hit.d;
    if (r !== src.data[i] || g !== src.data[i + 1] || b !== src.data[i + 2]) changed += 1;
  }
  return { png: out, meanDE: opaque === 0 ? 0 : sum / opaque, maxDE: max, changed, colours: used.size };
}

/** The most the snap may move a picture on average before the palette is called too far from the drawing (Lab dE; 2 is barely seen, 6 is a visible shift). */
export const MAX_MEAN_DE = 6;

/* ---- the camera record ---- */

export const VERDICTS = ['pass', 'fail'] as const;
export type CameraVerdict = (typeof VERDICTS)[number];

export interface ReduceSpec {
  /** The opaque box's height in art pixels (the picture is scaled by it); `width` instead when the height is not the long side. */
  height?: number;
  width?: number;
  colours: number;
  /** The canvas the reduced picture stands on, bottom-centred, as the kit sprite's `w` and `h`. */
  canvas?: [number, number];
}

export interface CameraRecord {
  id: string;
  name: string;
  verdict: CameraVerdict;
  /** What the eye saw: the angle, the shape of the shadow, what makes it match or not match the character. */
  reason: string;
  /** The still the verdict was made on, a path from the repository root. */
  still: string;
  /** The sha256 of the reduced picture (PNG bytes) the verdict is about. */
  picture: string;
  reduce: ReduceSpec;
  /** Which of the draft's files the reduction read: `full` (the original size) when it has one, else `raw`. */
  from?: 'raw' | 'full';
  /** What a failed picture waits for: `credits` when the fix is a paid PixelLab call nobody has approved, `rework` once it went back. */
  waits?: string;
  at: string;
  by: string;
}

export const MIN_REASON = 12;

/** The reduced picture bottom-centred on a transparent canvas (a kit sprite's `w` by `h`). */
export function onCanvas(png: PNG, w: number, h: number): PNG {
  if (png.width > w || png.height > h) throw new Error(`the reduced picture is ${png.width}x${png.height}, larger than the ${w}x${h} canvas`);
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, 0, 0, png.width, png.height, Math.floor((w - png.width) / 2), h - png.height);
  return out;
}

/** The draft's picture as the game would hold it: the clean reduction (no palette snap), then the canvas when there is one. */
export function reduceDraft(src: PNG, spec: ReduceSpec): PNG {
  const small = reduce(src, { colours: spec.colours, ...(spec.height === undefined ? {} : { height: spec.height }), ...(spec.width === undefined ? {} : { width: spec.width }) });
  return spec.canvas === undefined ? small : onCanvas(small, spec.canvas[0], spec.canvas[1]);
}

export function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Why a record is not a record, or null. */
export function recordProblem(r: Partial<CameraRecord>): string | null {
  if (typeof r.id !== 'string' || !/^[0-9a-f]{16}$/u.test(r.id)) return 'the id is not a draft id';
  if (!(VERDICTS as readonly string[]).includes(r.verdict ?? '')) return `the verdict is ${VERDICTS.join(' or ')}`;
  if (typeof r.reason !== 'string' || r.reason.trim().length < MIN_REASON) return `the reason says what the eye saw (at least ${MIN_REASON} characters)`;
  if (typeof r.still !== 'string' || r.still === '') return 'the still it was made on is missing';
  if (typeof r.picture !== 'string' || !/^[0-9a-f]{64}$/u.test(r.picture)) return 'the picture hash is missing';
  if (typeof r.by !== 'string' || r.by === '') return 'who looked is missing';
  return null;
}

/** The last valid line per draft; a line that is not a record is counted and skipped. */
export function parseCamera(text: string): { records: Map<string, CameraRecord>; skipped: number } {
  const records = new Map<string, CameraRecord>();
  let skipped = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    try {
      const r = JSON.parse(raw) as Partial<CameraRecord>;
      if (recordProblem(r) !== null) throw new Error('not a record');
      records.set(r.id as string, r as CameraRecord);
    } catch {
      skipped += 1;
    }
  }
  return { records, skipped };
}

/** Whether a draft may be promoted: a passing verdict on exactly this reduced picture. Returns the reason it may not, or null. */
export function promoteRefusal(record: CameraRecord | undefined, picture: string, stillExists: boolean): string | null {
  if (record === undefined) return 'no camera check is recorded for it: look at it on the grass beside the character, then record the verdict (pnpm art:promote verdict)';
  if (!stillExists) return `its camera check names a still that is not there (${record.still})`;
  if (record.picture !== picture) return 'the camera check was made on another reduction than this one: look at this one and record the verdict again';
  if (record.verdict !== 'pass') return `the camera check failed (${record.reason}): fix the picture first`;
  return null;
}

/* ---- the queue ---- */

export interface Promoted {
  /** The draft that went into the kit. */
  draft: string;
  /** The kit sprite it stands as, `props/rock_mossy`. */
  sprite: string;
}

export interface FamilyRow {
  family: string;
  count: number;
  bucket: Bucket;
  step: string;
  why: string;
  /** How many of the family's pictures stand at each step (ready families only). */
  at: Partial<Record<Step, number>>;
  ids: string[];
}

export interface QueueInput {
  kept: readonly Draft[];
  camera: ReadonlyMap<string, CameraRecord>;
  promoted: readonly Promoted[];
  /** The kit sprites that the map places, `props/rock_mossy`. */
  placed: ReadonlySet<string>;
}

export function stepOf(draft: Draft, input: Pick<QueueInput, 'camera' | 'promoted' | 'placed'>): { step: Step; why: string } {
  const promoted = input.promoted.find((p) => p.draft === draft.id);
  if (promoted !== undefined) {
    return input.placed.has(promoted.sprite) ? { step: 'done', why: `stands in the map as ${promoted.sprite}` } : { step: 'map', why: `is in the kit as ${promoted.sprite}, the map does not place it yet` };
  }
  const record = input.camera.get(draft.id);
  if (record === undefined) return { step: 'camera check', why: 'nobody has looked at it beside the character yet' };
  if (record.verdict === 'fail') return { step: 'fix', why: `${record.reason}${record.waits === undefined ? '' : ` (waiting for ${record.waits})`}` };
  return { step: 'kit', why: 'passed the camera check, not in the kit yet' };
}

export function queue(input: QueueInput): FamilyRow[] {
  const families = new Map<string, Draft[]>();
  for (const d of input.kept) families.set(familyOf(d.name), [...(families.get(familyOf(d.name)) ?? []), d]);
  const rows: FamilyRow[] = [];
  for (const [family, drafts] of families) {
    const { bucket, why } = bucketOf(family);
    const row: FamilyRow = { family, count: drafts.length, bucket, step: bucket === 'ready' ? '' : bucket, why, at: {}, ids: drafts.map((d) => d.id) };
    if (bucket === 'ready') {
      const whys = new Set<string>();
      for (const d of drafts) {
        const s = stepOf(d, input);
        row.at[s.step] = (row.at[s.step] ?? 0) + 1;
        whys.add(s.why);
      }
      // the family's step is the furthest back any picture stands
      row.step = STEPS.find((s) => (row.at[s] ?? 0) > 0) ?? 'done';
      row.why = [...whys].slice(0, 2).join('; ');
    }
    rows.push(row);
  }
  const order = (r: FamilyRow): number => (r.bucket === 'ready' ? STEPS.indexOf(r.step as Step) : STEPS.length + BUCKETS.indexOf(r.bucket));
  return rows.sort((a, b) => order(a) - order(b) || a.family.localeCompare(b.family));
}

const WORDS: Record<Bucket, string> = {
  ready: 'ready',
  cut: 'needs a cut',
  parameters: 'needs parameters',
  source: 'source only',
  advanced: 'held: advanced',
};

export function queueText(rows: readonly FamilyRow[]): string {
  const out: string[] = [];
  const total = rows.reduce((n, r) => n + r.count, 0);
  out.push(`${total} kept pictures in ${rows.length} families`);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.bucket === 'ready' ? r.step : WORDS[r.bucket], (counts.get(r.bucket === 'ready' ? r.step : WORDS[r.bucket]) ?? 0) + 1);
  out.push(`families by step: ${[...counts].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const r of rows) {
    const where = r.bucket === 'ready' ? r.step : WORDS[r.bucket];
    const spread = r.bucket === 'ready' && Object.keys(r.at).length > 1 ? ` (${Object.entries(r.at).map(([k, v]) => `${v} ${k}`).join(', ')})` : '';
    out.push(`${r.family.padEnd(34)} ${String(r.count).padStart(3)}  ${where.padEnd(16)}${spread} ${r.why}`);
  }
  return `${out.join('\n')}\n`;
}
