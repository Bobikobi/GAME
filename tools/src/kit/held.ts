/**
 * A held object keeps its size (public #874, the owner 26.11: "the lifted stone shrank and grew"): a clip that draws an object in
 * the figure's hands shows that object at the size it has lying in the world, within 10%. Pure, so a test can run it on a made
 * picture; `heldProblems` reads the sheets.
 *
 * Sizes are in game pixels (world units): a sprite's pixels times the scale it is shown at, over its density. A clip sheet shows at
 * its `fit_permille` (game/src/kitart.ts baseScale); the large stone's picture shows at STONE_SCALE.large (game/src/stone-art.ts,
 * the one number the game and this check both read).
 *
 * Measuring: the object is the 8-connected body of pixels of its colour (a stone: the grey of the shared stone ramp, no ink, no hue) that touches the clip's hand
 * point; the same cut is made on the world picture, so both sides are measured by one rule. The size of a frame is the longer side of
 * that body's box. A hand or the body can hide part of the stone, which only makes it look smaller: so "too big" is held on every
 * frame, and "too small" on the clip's largest frame (a stone seen whole in at least one frame must be the world's size).
 */
import { join } from 'node:path';
import type { PNG } from 'pngjs';
import { STONE_SCALE } from '../../../game/src/stone-art';
import { readPng } from '../pngcache';

/** One kind of held object: the world picture it is (kit-relative sprite name), the scale that picture shows at, its name for a message, and the colour test that cuts it from the figure in a clip frame. */
export interface HeldObject {
  world: string;
  scale: number;
  label: string;
  body: (r: number, g: number, b: number) => boolean;
}

/** The grey of a stone: not ink-dark, nearly hueless (the stone ramp of palette v2 and the core greys). */
const stoneGrey = (r: number, g: number, b: number): boolean => Math.floor((r * 30 + g * 59 + b * 11) / 100) >= 45 && Math.max(r, g, b) - Math.min(r, g, b) <= 45;

/**
 * The clip verbs that draw an object into the hands. Lifting is general (the owner, 26.11): a carried object joins the check as one new row here, the world
 * picture it is and the colour that cuts it from the figure, and needs no other code. Today the one object is the large stone, drawn by `lift` and `carry`.
 */
export const HELD_OBJECTS: Readonly<Record<string, HeldObject>> = {
  lift: { world: 'items/stone', scale: STONE_SCALE.large, label: 'the large stone', body: stoneGrey },
  carry: { world: 'items/stone', scale: STONE_SCALE.large, label: 'the large stone', body: stoneGrey },
};

/** How far from the world's size a held object may be (a share of it). */
export const HELD_TOLERANCE = 0.1;

/** How far (sheet pixels) from the hand point a grey body may start and still be the held stone. */
const REACH = 14;
/** Fewer grey pixels than this are a speck, not a stone. */
const MIN_BODY = 12;

/** One frame's pixels: the whole sheet's data, the sheet's width, the frame's left edge and size. */
export interface FrameView {
  data: Uint8Array | Buffer;
  sheetW: number;
  x0: number;
  w: number;
  h: number;
}

/** The box and pixel count of the grey body in a frame that touches the point (within `reach`), the largest such; undefined when none. */
export function heldBody(f: FrameView, seed: readonly [number, number], reach = REACH, body: HeldObject['body'] = stoneGrey): { w: number; h: number; area: number } | undefined {
  const grey = new Uint8Array(f.w * f.h);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const i = (y * f.sheetW + f.x0 + x) * 4;
    if (f.data[i + 3]! >= 128 && body(f.data[i]!, f.data[i + 1]!, f.data[i + 2]!)) grey[y * f.w + x] = 1;
  }
  const seen = new Uint8Array(f.w * f.h);
  let best: { w: number; h: number; area: number } | undefined;
  const stack: number[] = [];
  for (let start = 0; start < grey.length; start++) {
    if (!grey[start] || seen[start]) continue;
    let minX = f.w;
    let maxX = 0;
    let minY = f.h;
    let maxY = 0;
    let area = 0;
    let near = false;
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const p = stack.pop()!;
      const x = p % f.w;
      const y = (p - x) / f.w;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (!near && Math.hypot(x - seed[0], y - seed[1]) <= reach) near = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= f.w || ny >= f.h) continue;
          const q = ny * f.w + nx;
          if (grey[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    if (near && area >= MIN_BODY && (best === undefined || area > best.area)) best = { w: maxX - minX + 1, h: maxY - minY + 1, area };
  }
  return best;
}

/** A stone's size in game pixels: the longer side of its body's box, at the scale the picture shows at over its density. */
export const sizeOf = (body: { w: number; h: number }, shown: number, density: number): number => (Math.max(body.w, body.h) * shown) / density;

/** The world picture's size (game px) of an object, read once per picture. */
const worldSizes = new Map<string, number | undefined>();
function worldSize(png: PNG, w: number, h: number, density: number, held: HeldObject, key: string): number | undefined {
  if (worldSizes.has(key)) return worldSizes.get(key);
  // the middle of the picture is the seed: the world stone is one body there
  const body = heldBody({ data: png.data, sheetW: png.width, x0: 0, w, h }, [w / 2, h / 2], Math.max(w, h), held.body);
  const size = body ? sizeOf(body, held.scale, density) : undefined;
  worldSizes.set(key, size);
  return size;
}

export interface HeldRow {
  clip: string;
  verb: string;
  frame: number;
  /** the held object's size in the clip frame as a share of its size in the world; undefined when no stone was found in the frame */
  ratio: number | undefined;
}

type Sprite = { file: string; w: number; h: number; frames: number; density: number; clip?: { verb: string; fit_permille?: number; hand?: readonly (readonly [number, number])[] } };

/** The rows (clip, frame, ratio) of every clip of a kit that draws a held object, in name order. */
export function heldRows(dir: string, sprites: Readonly<Record<string, Sprite>>): HeldRow[] {
  const rows: HeldRow[] = [];
  for (const [name, s] of Object.entries(sprites).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const held = s.clip && HELD_OBJECTS[s.clip.verb];
    if (!s.clip || !held) continue;
    const ref = sprites[held.world];
    if (!ref) continue;
    const world = worldSize(readPng(join(dir, ref.file)), ref.w, ref.h, ref.density, held, `${dir}:${held.world}`);
    if (world === undefined) continue;
    const sheet = readPng(join(dir, s.file));
    const fit = (s.clip.fit_permille ?? 1000) / 1000;
    for (let f = 0; f < s.frames; f++) {
      const seed = s.clip.hand?.[f];
      const body = seed ? heldBody({ data: sheet.data, sheetW: sheet.width, x0: f * s.w, w: s.w, h: s.h }, seed, REACH, held.body) : undefined;
      rows.push({ clip: name, verb: s.clip.verb, frame: f, ratio: body ? sizeOf(body, fit, s.density) / world : undefined });
    }
  }
  return rows;
}

/**
 * The clips that wait for the art lane (their stone is not at the world's size and scaling the drawn pixels cannot mend it: the hands or
 * the body would be covered). Each is named with why. A name here that passes is refused, so the list only ever shrinks.
 */
const SKELETON_WHY = 'the skeleton draws its stone about half the world size (fit 0.562: 30 px where 63 px is the world size) and scaling its pixels 2.1x makes a stone wider than its ribcage: redraw at the world size and in a clean stone shape (the owner saw an odd shape in some frames, 26.11), art lane #793';
export const HELD_WAIVERS: Readonly<Record<string, string>> = Object.fromEntries(
  ['lift', 'carry'].flatMap((verb) => ['front', 'back', 'left'].map((view) => [`chars/skeleton_${verb}_${view}`, SKELETON_WHY] as const)),
);

/** The problems of a kit's held objects, one line per clip: the first frame too big, or the largest frame too small, with its ratio. */
export function heldProblems(rows: readonly HeldRow[], waivers: Readonly<Record<string, string>> = HELD_WAIVERS): { clip: string; message: string }[] {
  const out: { clip: string; message: string }[] = [];
  const byClip = new Map<string, HeldRow[]>();
  for (const r of rows) byClip.set(r.clip, [...(byClip.get(r.clip) ?? []), r]);
  const hi = 1 + HELD_TOLERANCE;
  const lo = 1 - HELD_TOLERANCE;
  const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;
  for (const [clip, frames] of byClip) {
    const seen = frames.filter((r): r is HeldRow & { ratio: number } => r.ratio !== undefined);
    const label = HELD_OBJECTS[frames[0]!.verb]?.label ?? 'the held object';
    let message: string | undefined;
    const big = seen.find((r) => r.ratio > hi);
    if (big) message = `frame ${big.frame} draws ${label} at ${pct(big.ratio)} of its size in the world (more than ${pct(hi)}): an object keeps its size (#874)`;
    else if (seen.length === 0) message = `no frame shows ${label} at its hand point, so its size cannot be held`;
    else {
      const top = seen.reduce((a, r) => (r.ratio > a.ratio ? r : a));
      if (top.ratio < lo) message = `its largest frame (${top.frame}) draws ${label} at ${pct(top.ratio)} of its size in the world (less than ${pct(lo)}): an object keeps its size (#874)`;
    }
    const waived = waivers[clip];
    if (message && waived === undefined) out.push({ clip, message });
    else if (!message && waived !== undefined) out.push({ clip, message: `is waived (${waived}) but holds the size now: take it off HELD_WAIVERS in tools/src/kit/held.ts` });
  }
  for (const clip of Object.keys(waivers)) if (!byClip.has(clip)) out.push({ clip, message: 'is waived in HELD_WAIVERS but draws no held object: take it off the list' });
  return out;
}
