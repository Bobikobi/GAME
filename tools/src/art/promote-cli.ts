/**
 * pnpm art:promote queue [--reviews FILE] [--json]
 * pnpm art:promote still <draft id | name | family> ... [--height N | --width N | --like <kit sprite>] [--colours N] [--from raw|full] [--per-row N] --out FILE
 * pnpm art:promote verdict <draft id | name | family> ... pass|fail --reason TEXT --still FILE [same reduction flags] [--waits credits]
 *
 * The owner's kept pictures on their way into the full map (issue #664, `promote.ts`). `queue` says where each family stands
 * and why. `still` reduces drafts the clean way (no palette snap) and stands them on the kit's grass beside the adult human.
 * `verdict` records what the eye saw on that still, with the hash of the exact reduction, in `tools/kit-gen/camera.jsonl`.
 * Nothing here writes the kit; that step refuses a picture without a passing verdict on its exact reduction.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { PNG } from 'pngjs';

import { assetName, CACHE_DIR, type Draft, DraftIndex } from './drafts.js';
import { readReviews } from './library-reviews.js';
import {
  CAMERA_FILE, type CameraRecord, familyOf, MAX_MEAN_DE, ownerKept, parseCamera, PROMOTED_MANIFEST, promoteRefusal, type Promoted, queue, queueText,
  recordProblem, type ReduceSpec, reduceDraft, sha256, snapToPalette, VERDICTS,
} from './promote.js';
import { composeScene } from './promote-scene.js';
import { CORE_PALETTE, coreRamp } from '../kit/palette.js';
import { cropToAlpha, keyOut, DEFAULT_COLOURS } from './reduce.js';
import { ROOT } from './queue.js';
import { measureKits } from './scale.js';

const USAGE = [
  'Usage: pnpm art:promote queue [--reviews FILE] [--json]',
  '       pnpm art:promote still <draft id | name | family> ... [--height N | --width N | --like <kit sprite>] [--colours N] [--from raw|full] [--per-row N] --out FILE',
  '       pnpm art:promote verdict <draft id | name | family> ... pass|fail --reason TEXT --still FILE [same reduction flags] [--waits credits]',
  '       pnpm art:promote kit <draft id> --as props/name [--ramps id,id] [--dry]',
].join('\n');

const VALUE_FLAGS = ['--as', '--ramps', '--reviews', '--height', '--width', '--like', '--colours', '--from', '--per-row', '--out', '--reason', '--still', '--waits', '--by'];

export function parseArgs(argv: readonly string[]): { positional: string[]; values: Map<string, string>; flags: Set<string> } {
  const positional: string[] = [];
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] as string;
    if (!a.startsWith('--')) positional.push(a);
    else if (VALUE_FLAGS.includes(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value\n${USAGE}`);
      values.set(a, v);
      i += 1;
    } else if (a === '--json' || a === '--dry') flags.add(a);
    else throw new Error(`unknown option ${a}\n${USAGE}`);
  }
  return { positional, values, flags };
}

/** The main checkout's page folder when this runs in a worktree: the page and its `reviews.jsonl` live there. */
function reviewsPath(explicit: string | undefined): string | null {
  if (explicit !== undefined) return explicit;
  const own = join(ROOT, '.scratch/art-library/reviews.jsonl');
  if (existsSync(own)) return own;
  const common = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd: ROOT, encoding: 'utf8' });
  if (common.status !== 0) return null;
  const main = join(resolve(ROOT, common.stdout.trim()), '..', '.scratch/art-library/reviews.jsonl');
  return existsSync(main) ? main : null;
}

function readPromoted(root: string): Promoted[] {
  const path = join(root, PROMOTED_MANIFEST);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').flatMap((l) => {
    try {
      const v = JSON.parse(l) as { draft?: unknown; sprite?: unknown };
      return typeof v.draft === 'string' && typeof v.sprite === 'string' ? [{ draft: v.draft, sprite: v.sprite }] : [];
    } catch {
      return [];
    }
  });
}

/** The kit sprites of the core kit that the map places (`props/rock_mossy`). */
function placedSprites(root: string): Set<string> {
  const text = readFileSync(join(root, 'content/core/map.json'), 'utf8');
  return new Set([...text.matchAll(/"sprite":\s*"core\/base-kit:([^"]+)"/gu)].map((m) => m[1] as string));
}

function readCamera(root: string): Map<string, CameraRecord> {
  const path = join(root, CAMERA_FILE);
  return parseCamera(existsSync(path) ? readFileSync(path, 'utf8') : '').records;
}

function loadKept(values: Map<string, string>, root: string): { kept: Draft[]; note: string } {
  const index = DraftIndex.open(join(root, 'tools/kit-gen/drafts.jsonl'));
  const path = reviewsPath(values.get('--reviews'));
  const known = new Set(index.drafts.keys());
  const read = path === null ? null : readReviews(path, known);
  const kept = ownerKept(index.drafts.values(), read?.choices ?? new Map());
  return { kept, note: path === null ? 'no reviews.jsonl found: only the index is read' : `reviews: ${path} (${read?.choices.size ?? 0} choices over the index)` };
}

export function queueCommand(values: Map<string, string>, flags: Set<string>, root = ROOT): string {
  const { kept, note } = loadKept(values, root);
  const rows = queue({ kept, camera: readCamera(root), promoted: readPromoted(root), placed: placedSprites(root) });
  if (flags.has('--json')) return `${JSON.stringify(rows, null, 2)}\n`;
  return `${note}\n${queueText(rows)}`;
}

/** Drafts named by id, by exact name or by family, among the owner's kept pictures. */
export function resolveDrafts(names: readonly string[], kept: readonly Draft[]): Draft[] {
  const out: Draft[] = [];
  for (const name of names) {
    const found = kept.filter((d) => d.id === name || d.name === name || familyOf(d.name) === name);
    if (found.length === 0) throw new Error(`"${name}" is no id, name or family of a picture the owner kept`);
    for (const d of found) if (!out.includes(d)) out.push(d);
  }
  return out;
}

/** The draft's picture from the local cache of the drafts store: `full` (the original size) when it has one, else `raw`. */
function readCached(id: string, from: 'raw' | 'full', root: string): PNG {
  const cache = root === ROOT ? CACHE_DIR : join(root, '.scratch/art-drafts');
  for (const kind of from === 'full' ? (['full', 'raw'] as const) : (['raw'] as const)) {
    const file = join(cache, assetName(id, kind));
    if (existsSync(file)) return PNG.sync.read(readFileSync(file));
  }
  throw new Error(`draft ${id}: its ${from} picture is not in ${cache}; run pnpm art:drafts fetch ${id}`);
}

function kitSprite(root: string, name: string): { w: number; h: number; scale?: number } {
  const kit = JSON.parse(readFileSync(join(root, 'content/kit/core/kit.json'), 'utf8')) as { kit: { sprites: Record<string, { w: number; h: number; scale?: number }> } };
  const s = kit.kit.sprites[name];
  if (s === undefined) throw new Error(`the core kit has no sprite ${name}`);
  return s;
}

/** The reduction a command asks for: a given size, the size of a namesake in the kit (`--like`), or the picture's own. */
export function specFrom(values: Map<string, string>, src: PNG, root = ROOT): { spec: ReduceSpec; from: 'raw' | 'full' } {
  const whole = (flag: string): number | undefined => {
    const v = values.get(flag);
    if (v === undefined) return undefined;
    if (!/^\d+$/u.test(v) || Number(v) < 1) throw new Error(`${flag} takes a whole number of 1 or more`);
    return Number(v);
  };
  const from = values.get('--from') ?? 'full';
  if (from !== 'raw' && from !== 'full') throw new Error('--from is raw or full');
  const spec: ReduceSpec = { colours: whole('--colours') ?? DEFAULT_COLOURS };
  const like = values.get('--like');
  const height = whole('--height');
  const width = whole('--width');
  if (like !== undefined) {
    const s = kitSprite(root, like);
    if (s.scale === undefined) throw new Error(`${like} declares no scale: give --height`);
    spec.height = Math.round(s.scale * measureKits(join(root, 'content/kit')).adultPx);
    spec.canvas = [s.w, s.h];
  } else if (height !== undefined) spec.height = height;
  else if (width !== undefined) spec.width = width;
  else {
    // no size asked: the picture stands as drawn (a Pro grid piece is already at the game's size)
    const box = cropToAlpha(keyOut(src).png);
    if (box === null) throw new Error('nothing is left of the picture after the key was cleared');
    spec.height = box.height;
  }
  return { spec, from };
}

interface Reduced { draft: Draft; spec: ReduceSpec; from: 'raw' | 'full'; picture: PNG }

/** Each draft reduced by its own spec: the size of a namesake is the same for all, "as drawn" is each picture's own. */
function loadForStill(names: readonly string[], values: Map<string, string>, root: string): Reduced[] {
  const { kept } = loadKept(values, root);
  return resolveDrafts(names, kept).map((draft) => {
    const from = specFrom(values, readCached(draft.id, 'full', root), root).from;
    const src = readCached(draft.id, from, root);
    const { spec } = specFrom(values, src, root);
    return { draft, spec, from, picture: reduceDraft(src, spec) };
  });
}

function writeStill(path: string, reduced: readonly PNG[], values: Map<string, string>, root: string): string {
  const kit = join(root, 'content/kit/core');
  const sheet = (file: string): PNG => PNG.sync.read(readFileSync(join(kit, file)));
  const human = sheet('chars/human_down.png');
  const standing = new PNG({ width: 128, height: 128 });
  PNG.bitblt(human, standing, human.width - 128, 0, 128, 128, 0, 0);
  const perRow = values.get('--per-row');
  const scene = composeScene({
    grass: ['tiles/grass.png', 'tiles/grass_1.png', 'tiles/grass_2.png', 'tiles/grass_3.png'].map(sheet),
    human: standing,
    items: reduced,
    ...(perRow === undefined ? {} : { perRow: Number(perRow) }),
  });
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, PNG.sync.write(scene.png));
  return `${scene.png.width}x${scene.png.height} (zoom ${scene.zoom}, ${scene.rows} row${scene.rows === 1 ? '' : 's'})`;
}

export function stillCommand(names: readonly string[], values: Map<string, string>, root = ROOT): string {
  const out = values.get('--out');
  if (names.length === 0 || out === undefined) throw new Error(USAGE);
  const items = loadForStill(names, values, root);
  const size = writeStill(out, items.map((i) => i.picture), values, root);
  const lines = items.map((i, n) => `${n + 1}  ${i.draft.id}  ${i.draft.name}  ${i.picture.width}x${i.picture.height}`);
  return `${out}  ${size}\n${lines.join('\n')}\n`;
}

export function verdictCommand(args: readonly string[], values: Map<string, string>, root = ROOT): string {
  const word = args.at(-1);
  const names = args.slice(0, -1);
  if (!(VERDICTS as readonly string[]).includes(word ?? '') || names.length === 0) throw new Error(USAGE);
  const still = values.get('--still');
  const reason = values.get('--reason');
  if (still === undefined || reason === undefined) throw new Error(`a verdict needs its still and its reason\n${USAGE}`);
  if (!existsSync(resolve(root, still))) throw new Error(`the still ${still} does not exist: make it first (pnpm art:promote still)`);
  const items = loadForStill(names, values, root);
  const now = new Date().toISOString();
  const lines = items.map(({ draft: d, spec, from, picture }): CameraRecord => ({
    id: d.id, name: d.name, verdict: word as CameraRecord['verdict'], reason: reason.trim(), still, picture: sha256(PNG.sync.write(picture)),
    reduce: spec, from, ...(values.has('--waits') ? { waits: values.get('--waits') as string } : {}), at: now, by: values.get('--by') ?? 'builder',
  }));
  for (const l of lines) {
    const problem = recordProblem(l);
    if (problem !== null) throw new Error(`${l.id}: ${problem}`);
  }
  const path = join(root, CAMERA_FILE);
  const before = existsSync(path) ? readFileSync(path, 'utf8') : '';
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${before === '' || before.endsWith('\n') ? '' : '\n'}${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
  return `${lines.length} camera verdict${lines.length === 1 ? '' : 's'} (${word}) written to ${CAMERA_FILE}\n`;
}

export const RICH_FILE = 'tools/src/kit/rich.ts';

interface KitFile { kit: { ramps?: { id: string; steps: string[] }[]; sprites: Record<string, { file: string; w: number; h: number; frames?: number; density?: 1 | 4; ramps?: string[]; scale?: number; stride?: unknown; source?: { spec: string; manifest: string } }> } }

/** The steps of a ramp the kit may name: a shared ramp of palette v2, or one of the kit's own. */
function rampSteps(kit: KitFile, id: string): readonly string[] {
  const own = kit.kit.ramps?.find((r) => r.id === id);
  const steps = coreRamp(id)?.steps ?? own?.steps;
  if (steps === undefined) throw new Error(`"${id}" is neither a shared ramp nor one the core kit declares`);
  return steps;
}

/** The kit's text after one sprite is added or replaced; the file is JSON at two spaces. */
export function withSpriteEntry(text: string, name: string, sprite: KitFile['kit']['sprites'][string]): string {
  const kit = JSON.parse(text) as KitFile;
  kit.kit.sprites[name] = sprite;
  return `${JSON.stringify(kit, null, 2)}\n`;
}

/** The rich file's list text without a sprite that was waiting for its redraw. */
export function withoutWaiting(text: string, name: string): string {
  return text.replace(new RegExp(`^  '${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}',\n`, 'mu'), '');
}

/**
 * Put one kept picture into the core kit as a sprite: the clean reduction exactly as its camera check saw it, moved to the
 * palette the sprite may use (the core and its named ramps) when it is not in it, written with a provenance line. Refuses a
 * picture without a passing camera verdict on this exact reduction, and a snap that moves it too far.
 */
export function kitCommand(args: readonly string[], values: Map<string, string>, flags: Set<string>, root = ROOT): string {
  const [name] = args;
  const as = values.get('--as');
  if (name === undefined || args.length !== 1 || as === undefined || !/^(props|items)\/[a-z0-9_]+$/u.test(as)) throw new Error(USAGE);
  if (!/^[0-9a-f]{16}$/u.test(name)) throw new Error(`name the picture by its draft id (16 hex digits), not "${name}"`);
  const { kept } = loadKept(values, root);
  const [draft] = resolveDrafts([name], kept);
  if (draft === undefined) throw new Error(`${name} is no picture the owner kept`);
  const record = readCamera(root).get(draft.id);
  if (record === undefined) throw new Error(`${draft.id}: ${promoteRefusal(undefined, '', false)}`);
  const reduced = reduceDraft(readCached(draft.id, record.from ?? 'full', root), record.reduce);
  const refusal = promoteRefusal(record, sha256(PNG.sync.write(reduced)), existsSync(resolve(root, record.still)));
  if (refusal !== null) throw new Error(`${draft.id} (${draft.name}): ${refusal}`);

  const kitPath = join(root, 'content/kit/core/kit.json');
  const kitText = readFileSync(kitPath, 'utf8');
  const kit = JSON.parse(kitText) as KitFile;
  const namesake = kit.kit.sprites[as];
  if (namesake !== undefined && (namesake.frames ?? 1) > 1) throw new Error(`${as} is an animated sheet of ${namesake.frames} frames: a still picture cannot replace it`);
  if (namesake?.stride !== undefined) throw new Error(`${as} walks (it has a stride): a still picture cannot replace it`);
  const side = namesake === undefined || namesake.density === 4 ? 1 : 4;
  const canvas: [number, number] = namesake === undefined ? [reduced.width, reduced.height] : [namesake.w * side, namesake.h * side];
  if (namesake !== undefined && (reduced.width !== canvas[0] || reduced.height !== canvas[1])) {
    throw new Error(`${as} stands on a ${canvas[0]}x${canvas[1]} canvas and the camera check was made on ${reduced.width}x${reduced.height}: redo it with --like ${as}`);
  }
  if (reduced.width < 8 || reduced.height < 8 || reduced.width > 384 || reduced.height > 384) throw new Error(`a sprite is 8 to 384 px a side, this is ${reduced.width}x${reduced.height}`);

  const ramps = (values.get('--ramps') ?? '').split(',').filter((r) => r !== '');
  if (ramps.length > 4) throw new Error('a sprite names at most 4 ramps');
  const palette = [...CORE_PALETTE, ...ramps.flatMap((id) => rampSteps(kit, id))];
  const snapped = snapToPalette(reduced, palette);
  if (snapped.meanDE > MAX_MEAN_DE) {
    throw new Error(`the palette (the core${ramps.length === 0 ? '' : ` and ${ramps.join(', ')}`}) is too far from the drawing: it would move the picture by ${snapped.meanDE.toFixed(1)} (limit ${MAX_MEAN_DE}). Name ramps that hold its colours, or a new ramp does.`);
  }
  const adult = measureKits(join(root, 'content/kit')).adultPx;
  let top = reduced.height;
  let bottom = 0;
  for (let y = 0; y < reduced.height; y += 1) for (let x = 0; x < reduced.width; x += 1) if ((reduced.data[(y * reduced.width + x) * 4 + 3] as number) > 0) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  const scale = namesake?.scale ?? Math.round(((bottom - top + 1) / adult) * 100) / 100;

  const manifestPath = join(root, PROMOTED_MANIFEST);
  const before = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '';
  const number = before.split('\n').filter((l) => l.trim() !== '').length + 1;
  const sprite = {
    file: `${as}.png`, w: canvas[0], h: canvas[1], density: 4 as const,
    ...(ramps.length > 0 ? { ramps } : {}), scale, source: { spec: 'tools/kit-gen/drafts.jsonl', manifest: `${PROMOTED_MANIFEST}:${number}` },
  };
  const line = {
    sprite: as, draft: draft.id, name: draft.name, store: draft.stored === null ? null : `${draft.stored.repo}@${draft.stored.tag}`, route: draft.route, recipe: draft.recipe, seed: draft.seed,
    prompt: draft.prompt, owner_kept: true, camera: { verdict: record.verdict, reason: record.reason, still: record.still, picture: record.picture, by: record.by, at: record.at },
    reduce: record.reduce, snap: { ramps, mean_de: Math.round(snapped.meanDE * 100) / 100, max_de: Math.round(snapped.maxDE * 10) / 10, changed_px: snapped.changed, colours: snapped.colours },
    replaces: namesake === undefined ? null : { file: namesake.file, density: namesake.density ?? 1 }, promoted: 'a builder, on the owner\'s keep (issue #664)', at: new Date().toISOString(),
  };
  const summary = `${draft.name} ${draft.id} -> ${as} ${canvas[0]}x${canvas[1]}, scale ${scale}, ramps [${ramps.join(', ')}], snap mean dE ${snapped.meanDE.toFixed(2)} (max ${snapped.maxDE.toFixed(1)}, ${snapped.changed} px moved), ${namesake === undefined ? 'a new sprite' : 'takes the place of the namesake'}`;
  if (flags.has('--dry')) return `dry run, nothing written: ${summary}\n`;

  const target = join(root, 'content/kit/core', `${as}.png`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, PNG.sync.write(snapped.png));
  appendFileSync(manifestPath, `${before === '' || before.endsWith('\n') ? '' : '\n'}${JSON.stringify(line)}\n`);
  writeFileSync(kitPath, withSpriteEntry(kitText, as, sprite));
  const richPath = join(root, RICH_FILE);
  const rich = readFileSync(richPath, 'utf8');
  const lifted = withoutWaiting(rich, as);
  if (lifted !== rich) writeFileSync(richPath, lifted);
  return `${summary}${lifted !== rich ? `; ${as} is off SIXTEEN_PX_LEFT` : ''}\n`;
}

export function run(argv: readonly string[]): string {
  const [command, ...rest] = argv;
  const { positional, values, flags } = parseArgs(rest);
  switch (command) {
    case 'queue':
      return queueCommand(values, flags);
    case 'still':
      return stillCommand(positional, values);
    case 'verdict':
      return verdictCommand(positional, values);
    case 'kit':
      return kitCommand(positional, values, flags);
    default:
      throw new Error(USAGE);
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  try {
    process.stdout.write(run(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
