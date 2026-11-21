/**
 * The recipes of the PixelLab route: what each job of a spec asks the API for, what it costs in generations, and what
 * is wrong with a spec before any money moves. Nothing here touches the network; a recipe builds a request body from
 * a job and an `Io` that resolves its pictures, and `plan` judges the job from the spec alone.
 *
 * Costs are in generations, and each says where its number comes from (`basis`): `measured` in the trial of 2.11
 * (docs/art/DRAWERS.md), `published` by the API's own description, or `unknown` until the first real call. An unknown
 * cost is never counted as zero: the dry run prints `?`, a live run needs `--max-generations`, and the ledger records
 * what the first call really cost so the next estimate reads it.
 *
 * Limits are those of the API's OpenAPI document of 2.11 (.scratch/trial/openapi.json).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type Json } from './payload.js';

export type RecipeName = 'grid' | 'fill' | 'keyframes' | 'motion' | 'skeleton' | 'effect' | 'character' | 'rotate' | 'rotations8' | 'faithful' | 'outfit';

export const RECIPE_NAMES: readonly RecipeName[] = ['grid', 'fill', 'keyframes', 'motion', 'skeleton', 'effect', 'character', 'rotate', 'rotations8', 'faithful', 'outfit'];

export interface JobSpec {
  id: string;
  recipe: RecipeName;
  inputs: Record<string, unknown>;
  /** The seed; without one the job's own key gives it, so a rerun of a new job draws the same picture. */
  seed?: number;
  /** Pins the job to an account index (a character belongs to the account that made it). */
  account?: number;
  /** Lets a `fill` start from a picture at a strength over 150 (see `INIT_STRENGTH_LIMIT`). */
  allow_strong_init?: boolean;
  note?: string;
}

export interface Spec {
  name: string;
  /** Where the pictures go; default `.scratch/pixellab/<name>`. */
  out?: string;
  /** The source label of the drafts push; default `pixellab-<name>`. */
  label?: string;
  provenance?: string;
  jobs: JobSpec[];
}

export type Basis = 'measured' | 'published' | 'unknown';

export interface Cost {
  /** Generations, or null when nothing says. */
  gens: number | null;
  basis: Basis;
  note: string;
}

/** A job reads another job's output: `@id` (its first file), `@id#2`, `@id#*` (all of them), `@id.character` (its character). */
export interface Ref {
  job: string;
  index: number | 'all';
  character: boolean;
}

export function parseRef(value: unknown): Ref | null {
  if (typeof value !== 'string' || !value.startsWith('@')) return null;
  const m = /^@([A-Za-z0-9_-]+)(?:#(\d+|\*)|\.(character))?$/.exec(value);
  if (m === null) return { job: value.slice(1), index: 0, character: false };
  return { job: m[1] as string, index: m[2] === '*' ? 'all' : m[2] === undefined ? 0 : Number(m[2]), character: m[3] === 'character' };
}

/* ---- what the API says about sizes and counts ---- */

/** The `image_size` that `/create-image-pixflux` takes at most. */
export const FILL_MAX = 400;
/** A fill from a picture over this strength copies the picture and ignores the prompt (2 generations lost on 2.11). */
export const INIT_STRENGTH_LIMIT = 150;
/** The API's strength when none is sent. */
export const INIT_STRENGTH_DEFAULT = 300;

/** How many pictures `/generate-image-v2` returns for a size (the API's table, by the longer side). */
export function gridVariants(maxSide: number): number {
  if (maxSide <= 32) return 64;
  if (maxSide <= 35) return 49;
  if (maxSide <= 41) return 36;
  if (maxSide <= 50) return 25;
  if (maxSide <= 64) return 16;
  if (maxSide <= 84) return 9;
  if (maxSide === 85) return 16;
  if (maxSide <= 170) return 4;
  return 1;
}

export type Size = { width: number; height: number };

export function pngSize(png: Buffer): Size | null {
  if (png.length < 24 || png.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/* ---- the context a recipe is judged in ---- */

export interface PlanContext {
  /** The folder the spec file is in: local pictures are relative to it. */
  base: string;
  jobs: ReadonlyMap<string, JobSpec>;
  /** What the ledger has measured for a recipe. */
  measured: (recipe: RecipeName) => number | null;
}

export interface Planned {
  job: JobSpec;
  refs: Ref[];
  /** The job whose character this job needs (so the account it must run on). */
  characterOf: string | null;
  cost: Cost;
  issues: string[];
  warnings: string[];
}

export type Base64Image = { type: 'base64'; base64: string; format: 'png' };

/** Resolves a job's pictures when its request is built. Reads files; the references have been produced by then. */
export interface Io {
  image: (value: unknown) => Base64Image;
  images: (value: unknown) => Base64Image[];
  size: (value: unknown) => Size;
  character: (value: unknown) => string;
  seed: number;
}

export type Flow = 'sync' | 'job' | 'character' | 'animation';

export interface Recipe {
  name: RecipeName;
  flow: Flow;
  path: string;
  /** In words for the docs and the dry run. */
  what: string;
  check: (job: JobSpec, ctx: PlanContext, c: Checker) => Cost;
  body: (job: JobSpec, io: Io) => Json;
}

/* ---- reading inputs ---- */

export class Checker {
  readonly issues: string[] = [];
  readonly warnings: string[] = [];
  readonly refs: Ref[] = [];
  characterOf: string | null = null;

  constructor(readonly job: JobSpec, readonly ctx: PlanContext) {}

  fail(message: string): void {
    this.issues.push(message);
  }

  warn(message: string): void {
    this.warnings.push(message);
  }

  get inputs(): Record<string, unknown> {
    return this.job.inputs;
  }

  string(key: string, required = true, max = Infinity): string | null {
    const v = this.inputs[key];
    if (v === undefined || v === null) {
      if (required) this.fail(`inputs.${key} is missing`);
      return null;
    }
    if (typeof v !== 'string' || v.trim() === '') {
      this.fail(`inputs.${key} must be a non-empty string`);
      return null;
    }
    if (v.length > max) this.fail(`inputs.${key} is ${v.length} characters, the API takes ${max}`);
    return v;
  }

  number(key: string, range: [number, number] | null = null, required = false): number | null {
    const v = this.inputs[key];
    if (v === undefined || v === null) {
      if (required) this.fail(`inputs.${key} is missing`);
      return null;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.fail(`inputs.${key} must be a number`);
      return null;
    }
    if (range !== null && (v < range[0] || v > range[1])) this.fail(`inputs.${key} is ${v}, the API takes ${range[0]} to ${range[1]}`);
    return v;
  }

  oneOf<T extends string>(key: string, values: readonly T[], fallback: T | null): T | null {
    const v = this.inputs[key];
    if (v === undefined || v === null) return fallback;
    if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) {
      this.fail(`inputs.${key} must be one of: ${values.join(', ')}`);
      return fallback;
    }
    return v as T;
  }

  /** A `{width, height}` or a single number for a square. */
  size(key: string, range: [number, number], required = true): Size | null {
    const v = this.inputs[key];
    if (v === undefined || v === null) {
      if (required) this.fail(`inputs.${key} is missing`);
      return null;
    }
    const size = typeof v === 'number' ? { width: v, height: v } : (v as Partial<Size>);
    if (!Number.isInteger(size.width) || !Number.isInteger(size.height)) {
      this.fail(`inputs.${key} must be a number or {width, height} in whole pixels`);
      return null;
    }
    const { width, height } = size as Size;
    if (width < range[0] || height < range[0] || width > range[1] || height > range[1]) this.fail(`inputs.${key} is ${width}x${height}, the API takes ${range[0]} to ${range[1]} on each side`);
    return { width, height };
  }

  /** A picture: a path relative to the spec, or a reference to another job's output. Returns its size when it is known now. */
  image(key: string, required = true): { ref: Ref | null; size: Size | null } | null {
    return this.pictureAt(`inputs.${key}`, this.inputs[key], required);
  }

  pictureAt(label: string, v: unknown, required = true): { ref: Ref | null; size: Size | null } | null {
    if (v === undefined || v === null) {
      if (required) this.fail(`${label} is missing`);
      return null;
    }
    if (typeof v !== 'string' || v === '') {
      this.fail(`${label} must be a path or an @job reference`);
      return null;
    }
    const ref = parseRef(v);
    if (ref !== null) {
      this.refs.push(ref);
      const target = this.ctx.jobs.get(ref.job);
      if (target === undefined) this.fail(`${label}: no job "${ref.job}" in this spec`);
      else if (ref.character) this.characterOf = ref.job;
      return { ref, size: null };
    }
    const path = resolve(this.ctx.base, v);
    if (!existsSync(path)) {
      this.fail(`${label}: ${v} is not on disk`);
      return null;
    }
    return { ref: null, size: pngSize(readFileSync(path)) };
  }

  /** A list of pictures. */
  imageList(key: string, required = true): { ref: Ref | null; size: Size | null }[] {
    const v = this.inputs[key];
    if (v === undefined || v === null) {
      if (required) this.fail(`inputs.${key} is missing`);
      return [];
    }
    const list = Array.isArray(v) ? v : [v];
    return list.flatMap((item, i) => {
      const one = this.pictureAt(`inputs.${key}[${i}]`, typeof item === 'object' && item !== null ? (item as { image?: unknown }).image : item);
      return one === null ? [] : [one];
    });
  }
}

const published = (gens: number, note: string): Cost => ({ gens, basis: 'published', note });
const measured = (gens: number, note: string): Cost => ({ gens, basis: 'measured', note });
const unknown = (note: string, ctx: PlanContext, recipe: RecipeName): Cost => {
  const seen = ctx.measured(recipe);
  return seen === null ? { gens: null, basis: 'unknown', note } : { gens: seen, basis: 'measured', note: `${note}; the ledger has measured ${seen}` };
};

const VIEWS = ['side', 'low top-down', 'high top-down'] as const;
const DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;
const OUTLINES = ['single color black outline', 'single color outline', 'selective outline', 'lineless'] as const;
const SHADINGS = ['flat shading', 'basic shading', 'medium shading', 'detailed shading', 'highly detailed shading'] as const;
const DETAILS = ['low detail', 'medium detail', 'highly detailed'] as const;

/** The camera the whole game is drawn at is "high top-down" in this API's words (the trial drew every piece so). */
const GAME_VIEW = 'high top-down';

function passthrough(inputs: Record<string, unknown>, keys: readonly string[]): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const k of keys) if (inputs[k] !== undefined && inputs[k] !== null) out[k] = inputs[k] as Json;
  return out;
}

const OUTFIT_FRAME_LIMITS: [number, number][] = [[64, 15], [80, 8], [256, 3]];

/** Motion on a stored character: 1 generation a direction at 64 px and 2 at 128 (measured on 2.11). */
function animationCost(job: JobSpec, ctx: PlanContext, c: Checker, perSize: Record<number, number>, label: string, recipe: RecipeName): Cost {
  const directions = Array.isArray(job.inputs['directions']) ? (job.inputs['directions'] as unknown[]).length : 1;
  let side = c.number('size', [16, 256]);
  if (side === null) {
    const via = c.characterOf === null ? undefined : ctx.jobs.get(c.characterOf);
    const size = via === undefined ? null : sizeOfCharacter(via);
    if (size !== null) side = size;
    else if (c.inputs['size'] === undefined) c.fail(`inputs.size is missing: the character's canvas side (${Object.keys(perSize).join(' or ')}) sets the price`);
  }
  if (side === null) return unknown(`${label}, canvas not given`, ctx, recipe);
  const per = perSize[side];
  if (per === undefined) return unknown(`${label} at ${side} px has not been priced (priced: ${Object.keys(perSize).join(', ')} px)`, ctx, recipe);
  return measured(per * directions, `${label}: ${per} a direction at ${side} px, ${directions} direction${directions === 1 ? '' : 's'}`);
}

function sizeOfCharacter(job: JobSpec): number | null {
  const v = job.inputs['size'] ?? job.inputs['image_size'];
  if (typeof v === 'number') return v;
  if (v !== null && typeof v === 'object') {
    const { width, height } = v as Partial<Size>;
    if (typeof width === 'number' && typeof height === 'number') return Math.max(width, height);
  }
  return null;
}

function character(job: JobSpec, c: Checker): { id: string } | null {
  const v = c.inputs['character'];
  if (typeof v !== 'string' || v === '') {
    c.fail('inputs.character is missing: an @job reference to a character job, or the id of a character with "account" pinned');
    return null;
  }
  const ref = parseRef(v);
  if (ref !== null) {
    c.refs.push(ref);
    if (c.ctx.jobs.get(ref.job)?.recipe !== 'character') c.fail(`inputs.character: "${ref.job}" is not a character job`);
    c.characterOf = ref.job;
  } else if (job.account === undefined) c.fail('inputs.character is a bare id: pin the job with "account" (a character belongs to the account that made it)');
  return { id: v };
}

export const RECIPES: Record<RecipeName, Recipe> = {
  grid: {
    name: 'grid',
    flow: 'job',
    path: '/generate-image-v2',
    what: 'Pro text to image: a grid of variants at one size (64 at 32 px, 16 at 64 px, 4 at 128 px), the level and the camera for everything drawn after it',
    check(job, ctx, c) {
      c.string('description', true, 2000);
      const cell = c.number('cell', [16, 688]);
      const size = c.size('size', [16, 792], cell === null);
      if (cell !== null && size !== null) c.fail('give "cell" or "size", not both');
      const side = size ?? (cell === null ? null : { width: cell, height: cell });
      if (side !== null && side.height > 688) c.fail(`inputs.size is ${side.width}x${side.height}: the Pro model takes 792 wide and 688 tall at most`);
      c.imageList('reference_images', false);
      c.image('style_image', false);
      if (side !== null) {
        const n = gridVariants(Math.max(side.width, side.height));
        const expected = typeof c.inputs['expect'] === 'number' ? c.inputs['expect'] : n;
        if (expected !== n) c.warn(`expect ${expected} variants, but the API returns ${n} at ${Math.max(side.width, side.height)} px`);
      }
      return measured(10, 'Pro model, a whole grid');
    },
    body(job, io) {
      const i = job.inputs;
      const cell = typeof i['cell'] === 'number' ? i['cell'] : null;
      const size = cell === null ? (i['size'] as Size) : { width: cell, height: cell };
      const refs = i['reference_images'] === undefined ? [] : (Array.isArray(i['reference_images']) ? i['reference_images'] : [i['reference_images']]);
      const body: Record<string, Json> = {
        description: i['description'] as string,
        image_size: { width: size.width, height: size.height },
        seed: io.seed,
        no_background: i['no_background'] === undefined ? true : (i['no_background'] as boolean),
      };
      if (refs.length > 0) {
        body['reference_images'] = refs.map((r) => {
          const image = typeof r === 'object' && r !== null ? (r as { image: unknown }).image : r;
          const usage = typeof r === 'object' && r !== null ? (r as { usage_description?: string }).usage_description : undefined;
          return { image: io.image(image), size: io.size(image), ...(usage === undefined ? {} : { usage_description: usage }) } as Json;
        });
      }
      if (i['style_image'] !== undefined) body['style_image'] = { image: io.image(i['style_image']), size: io.size(i['style_image']) } as Json;
      Object.assign(body, passthrough(i, ['style_options', 'target_palette']));
      return body;
    },
  },

  fill: {
    name: 'fill',
    flow: 'sync',
    path: '/create-image-pixflux',
    what: 'pixflux text to image up to 400x400, view, outline, shading and detail always set; with a Pro grid as init it fills a sheet for one generation',
    check(job, ctx, c) {
      c.string('description');
      c.size('size', [16, FILL_MAX]);
      c.oneOf('view', VIEWS, GAME_VIEW);
      c.oneOf('outline', OUTLINES, 'lineless');
      c.oneOf('shading', SHADINGS, 'detailed shading');
      c.oneOf('detail', DETAILS, 'highly detailed');
      c.oneOf('direction', DIRECTIONS, null);
      c.number('guidance', [1, 20]);
      const init = c.image('init_image', false);
      const strength = c.number('init_strength', [1, 999]);
      if (init !== null) {
        const effective = strength ?? INIT_STRENGTH_DEFAULT;
        if (effective > INIT_STRENGTH_LIMIT && job.allow_strong_init !== true) {
          c.fail(
            `init strength ${effective}${strength === null ? ' (the API default when none is sent)' : ''} is over ${INIT_STRENGTH_LIMIT}: at a high strength a fill copies its init picture and ignores the prompt `
            + '(2 generations lost on creature sheets, 2.11). It is meant for an init of the same family (a Pro grid of the same thing, strength 250 gave quantity for 1 generation). '
            + 'If that is the case, set "allow_strong_init": true on the job.',
          );
        }
      } else if (strength !== null) c.warn('init_strength without an init_image is ignored');
      c.image('color_image', false);
      return measured(1, 'pixflux, one picture');
    },
    body(job, io) {
      const i = job.inputs;
      const size = i['size'] as Size | number;
      const wh = typeof size === 'number' ? { width: size, height: size } : { width: size.width, height: size.height };
      const body: Record<string, Json> = {
        description: i['description'] as string,
        image_size: wh,
        view: (i['view'] as string | undefined) ?? GAME_VIEW,
        outline: (i['outline'] as string | undefined) ?? 'lineless',
        shading: (i['shading'] as string | undefined) ?? 'detailed shading',
        detail: (i['detail'] as string | undefined) ?? 'highly detailed',
        no_background: i['no_background'] === true,
        seed: io.seed,
      };
      if (typeof i['direction'] === 'string') body['direction'] = i['direction'];
      if (typeof i['negative'] === 'string') body['negative_description'] = i['negative'];
      if (typeof i['guidance'] === 'number') body['text_guidance_scale'] = i['guidance'];
      if (i['init_image'] !== undefined) {
        body['init_image'] = io.image(i['init_image']);
        body['init_image_strength'] = typeof i['init_strength'] === 'number' ? i['init_strength'] : INIT_STRENGTH_DEFAULT;
      }
      if (i['color_image'] !== undefined) body['color_image'] = io.image(i['color_image']);
      return body;
    },
  },

  keyframes: {
    name: 'keyframes',
    flow: 'job',
    path: '/animate-with-text-v3',
    what: 'animate with text between a first and a last frame, the strongest finding of the trial: a pose to a pose, 1 generation a move',
    check(job, ctx, c) {
      const first = c.image('first_frame');
      c.image('last_frame', false);
      c.string('action', true, 1000);
      const frames = c.number('frame_count', [4, 16]) ?? 8;
      if (first?.size != null) {
        if (first.size.width > 256 || first.size.height > 256) c.fail(`first_frame is ${first.size.width}x${first.size.height}: the API takes 256 on a side`);
        else if (first.size.width * first.size.height * frames > 524_288) c.fail(`${first.size.width}x${first.size.height} x ${frames} frames is over the API's budget of 524288 pixels`);
      }
      return measured(1, 'animate-with-text-v3, first and last frame');
    },
    body(job, io) {
      const i = job.inputs;
      const body: Record<string, Json> = {
        first_frame: io.image(i['first_frame']),
        action: i['action'] as string,
        frame_count: typeof i['frame_count'] === 'number' ? i['frame_count'] : 8,
        seed: io.seed,
        enhance_prompt: false,
      };
      if (i['last_frame'] !== undefined) body['last_frame'] = io.image(i['last_frame']);
      if (typeof i['no_background'] === 'boolean') body['no_background'] = i['no_background'];
      if (typeof i['drift_threshold'] === 'number') body['drift_threshold'] = i['drift_threshold'];
      return body;
    },
  },

  motion: {
    name: 'motion',
    flow: 'animation',
    path: '/animate-character',
    what: 'animate-character v3 on a stored character: one job a direction, frames kept on the character',
    check(job, ctx, c) {
      character(job, c);
      c.string('action');
      c.number('frame_count', [4, 16]);
      return animationCost(job, ctx, c, { 32: 1, 48: 1, 64: 1, 96: 2, 128: 2 }, 'motion', 'motion');
    },
    body(job, io) {
      const i = job.inputs;
      return {
        character_id: io.character(i['character']),
        mode: 'v3',
        action_description: i['action'] as string,
        frame_count: typeof i['frame_count'] === 'number' ? i['frame_count'] : 8,
        directions: Array.isArray(i['directions']) ? (i['directions'] as Json[]) : ['south'],
        seed: io.seed,
        ...(typeof i['animation_name'] === 'string' ? { animation_name: i['animation_name'] } : {}),
        ...(typeof i['keep_first_frame'] === 'boolean' ? { keep_first_frame: i['keep_first_frame'] } : {}),
      };
    },
  },

  skeleton: {
    name: 'skeleton',
    flow: 'animation',
    path: '/animate-character',
    what: 'animate-character skeleton-v3: a 3D motion posed onto the character, steadier identity and colours, minutes a direction',
    check(job, ctx, c) {
      character(job, c);
      if (c.inputs['template_animation_id'] === undefined) c.string('action');
      c.number('frame_count', [3, 15]);
      return animationCost(job, ctx, c, { 128: 3 }, 'skeleton-v3', 'skeleton');
    },
    body(job, io) {
      const i = job.inputs;
      return {
        character_id: io.character(i['character']),
        mode: 'skeleton-v3',
        ...(typeof i['action'] === 'string' ? { action_description: i['action'] } : {}),
        ...(typeof i['template_animation_id'] === 'string' ? { template_animation_id: i['template_animation_id'] } : {}),
        frame_count: typeof i['frame_count'] === 'number' ? i['frame_count'] : 8,
        directions: Array.isArray(i['directions']) ? (i['directions'] as Json[]) : ['south'],
        seed: io.seed,
        ...(typeof i['animation_name'] === 'string' ? { animation_name: i['animation_name'] } : {}),
      };
    },
  },

  effect: {
    name: 'effect',
    flow: 'job',
    path: '/vfx',
    what: 'the effects artist: a hit flash, a slash arc, a flame, as an animated sheet used as a layer',
    check(job, ctx, c) {
      c.string('description', true, 8000);
      const artist = c.oneOf('artist', ['lite', 'pro'] as const, 'lite');
      c.number('sprite_frames', [1, 32]);
      c.image('sprite', false);
      return artist === 'pro' ? measured(6, 'vfx, the pro artist') : measured(1, 'vfx, the lite artist');
    },
    body(job, io) {
      const i = job.inputs;
      return {
        description: i['description'] as string,
        artist: (i['artist'] as string | undefined) ?? 'lite',
        ...(i['sprite'] === undefined ? {} : { sprite: io.image(i['sprite']) }),
        ...(typeof i['sprite_frames'] === 'number' ? { sprite_frames: i['sprite_frames'] } : {}),
        ...(typeof i['name'] === 'string' ? { name: i['name'] } : {}),
      };
    },
  },

  character: {
    name: 'character',
    flow: 'character',
    path: '/create-character-v3',
    what: 'create-character-v3: a stored character with its rotations, bound to the account that makes it',
    check(job, ctx, c) {
      c.string('description', true, 2000);
      const reference = c.image('reference_image', false);
      c.oneOf('view', VIEWS, GAME_VIEW);
      const n = c.number('n_directions', [4, 8]);
      if (n !== null && n !== 4 && n !== 8) c.fail('inputs.n_directions must be 4 or 8');
      const declared = c.size('size', [32, 256], false);
      if (reference?.size != null && (reference.size.width > 256 || reference.size.height > 256)) c.fail(`reference_image is ${reference.size.width}x${reference.size.height}: the API takes 256 on a side`);
      const dims = reference?.size ?? declared;
      if (dims === null) return unknown('character, canvas not known yet', ctx, 'character');
      if (reference !== null) {
        // the API's description: reference mode costs ceil(w*h*8/65536); the trial's two matched it at a 128 px frame
        return published(Math.ceil((dims.width * dims.height * 8) / 65_536), `from the reference: ceil(${dims.width}x${dims.height}x8/65536)`);
      }
      const s = Math.max(dims.width, dims.height);
      return published(1 + Math.ceil((s * s * 8) / 65_536), `from scratch: 1 + ceil(${s}x${s}x8/65536); the trial's 2 matched it at 64 px`);
    },
    body(job, io) {
      const i = job.inputs;
      const body: Record<string, Json> = {
        description: i['description'] as string,
        n_directions: typeof i['n_directions'] === 'number' ? i['n_directions'] : 8,
        view: (i['view'] as string | undefined) ?? GAME_VIEW,
        seed: io.seed,
        no_background: true,
      };
      if (i['reference_image'] !== undefined) body['reference_image'] = io.image(i['reference_image']);
      else {
        const s = i['size'];
        body['image_size'] = typeof s === 'number' ? { width: s, height: s } : (s as Size);
      }
      Object.assign(body, passthrough(i, ['outline', 'detail', 'name', 'template_id']));
      return body;
    },
  },

  rotate: {
    name: 'rotate',
    flow: 'sync',
    path: '/rotate',
    what: 'rotate a picture from one camera view or direction to another (the camera fix); the views are side, low top-down and high top-down, there is no 50 degree setting, so the result is judged by eye in the scene',
    check(job, ctx, c) {
      c.image('from_image');
      const size = c.size('size', [16, 200]);
      c.oneOf('from_view', VIEWS, null);
      c.oneOf('to_view', VIEWS, null);
      c.oneOf('from_direction', DIRECTIONS, null);
      c.oneOf('to_direction', DIRECTIONS, null);
      if (c.inputs['from_view'] === undefined && c.inputs['to_view'] === undefined && c.inputs['from_direction'] === undefined && c.inputs['to_direction'] === undefined) c.fail('nothing to rotate: give from_view/to_view or from_direction/to_direction');
      if (size !== null && ![16, 32, 64, 128].some((s) => s === size.width && s === size.height)) c.warn('the API documents 16, 32, 64 and 128 px squares for /rotate; other sizes are allowed (16 to 200) but untried');
      return unknown('rotate has not been called yet', ctx, 'rotate');
    },
    body(job, io) {
      const i = job.inputs;
      const size = i['size'] as Size | number;
      return {
        from_image: io.image(i['from_image']),
        image_size: typeof size === 'number' ? { width: size, height: size } : { width: size.width, height: size.height },
        seed: io.seed,
        ...passthrough(i, ['from_view', 'to_view', 'from_direction', 'to_direction', 'image_guidance_scale']),
        ...(i['init_image'] === undefined ? {} : { init_image: io.image(i['init_image']), init_image_strength: typeof i['init_strength'] === 'number' ? i['init_strength'] : INIT_STRENGTH_DEFAULT }),
      };
    },
  },

  rotations8: {
    name: 'rotations8',
    flow: 'job',
    path: '/generate-8-rotations-v3',
    what: 'eight rotations of one picture (generate-8-rotations-v3), the picture facing south, up to 256 px',
    check(job, ctx, c) {
      const first = c.image('first_frame');
      c.string('description', false);
      if (first?.size != null && (first.size.width > 256 || first.size.height > 256)) c.fail(`first_frame is ${first.size.width}x${first.size.height}: the API takes 256 on a side`);
      return unknown('rotations8 has not been called yet', ctx, 'rotations8');
    },
    body(job, io) {
      const i = job.inputs;
      return {
        first_frame: io.image(i['first_frame']),
        seed: io.seed,
        ...(typeof i['description'] === 'string' ? { description: i['description'] } : {}),
        no_background: i['no_background'] !== false,
      };
    },
  },

  faithful: {
    name: 'faithful',
    flow: 'sync',
    path: '/image-to-pixelart',
    what: 'image to pixel art in faithful mode (fixer on): a drawing brought onto a pixel grid and kept as it is',
    check(job, ctx, c) {
      const image = c.image('image');
      c.size('output_size', [16, 512]);
      const declared = c.size('image_size', [16, 2048], false);
      if (declared === null && image !== null && image.size === null) c.fail('inputs.image_size is missing: it cannot be read from the picture (a reference or a file that is not a PNG)');
      c.number('init_image_strength', [0, 999]);
      c.number('guidance', [1, 20]);
      return unknown('image-to-pixelart has not been called yet', ctx, 'faithful');
    },
    body(job, io) {
      const i = job.inputs;
      const output = i['output_size'] as Size | number;
      return {
        image: io.image(i['image']),
        image_size: i['image_size'] === undefined ? io.size(i['image']) : (i['image_size'] as Json),
        output_size: typeof output === 'number' ? { width: output, height: output } : { width: output.width, height: output.height },
        fixer: true,
        init_image_strength: typeof i['init_image_strength'] === 'number' ? i['init_image_strength'] : 0,
        ...(typeof i['guidance'] === 'number' ? { text_guidance_scale: i['guidance'] } : {}),
        seed: io.seed,
      };
    },
  },

  outfit: {
    name: 'outfit',
    flow: 'job',
    path: '/transfer-outfit-v2',
    what: 'transfer-outfit-v2: the outfit of one picture put on every frame of an animation',
    check(job, ctx, c) {
      c.image('reference_image');
      const frames = c.imageList('frames');
      const size = c.size('size', [32, 256]);
      const all = frames.some((f) => f.ref?.index === 'all');
      if (!all && frames.length < 2) c.fail('inputs.frames needs 2 to 16 pictures (or one "@job#*")');
      if (!all && frames.length > 16) c.fail('inputs.frames has more than 16 pictures');
      if (size !== null && !all) {
        const side = Math.max(size.width, size.height);
        const cap = (OUTFIT_FRAME_LIMITS.find(([upTo]) => side <= upTo) ?? [0, 3])[1];
        if (frames.length > cap) c.fail(`${frames.length} frames at ${side} px: the API takes ${cap} at that size`);
      }
      return unknown('transfer-outfit-v2 has not been called yet', ctx, 'outfit');
    },
    body(job, io) {
      const i = job.inputs;
      const size = i['size'] as Size | number;
      return {
        reference_image: { image: io.image(i['reference_image']), size: io.size(i['reference_image']) } as Json,
        frames: io.images(i['frames']).map((image, n) => ({ image, size: io.size(Array.isArray(i['frames']) ? (i['frames'] as unknown[])[n] ?? i['frames'] : i['frames']) }) as Json),
        image_size: typeof size === 'number' ? { width: size, height: size } : { width: size.width, height: size.height },
        seed: io.seed,
        no_background: i['no_background'] === true,
        ...(typeof i['additional_instructions'] === 'string' ? { additional_instructions: i['additional_instructions'] } : {}),
        ...(i['target_palette'] === undefined ? {} : { target_palette: i['target_palette'] as Json }),
      };
    },
  },
};

/** Judges a job from the spec alone. */
export function plan(job: JobSpec, ctx: PlanContext): Planned {
  const recipe = RECIPES[job.recipe];
  const c = new Checker(job, ctx);
  if (!/^[A-Za-z0-9_-]+$/.test(job.id)) c.fail(`job id "${job.id}" may use letters, digits, - and _ only`);
  const cost = recipe.check(job, ctx, c);
  if (job.account !== undefined && (!Number.isInteger(job.account) || job.account < 0)) c.fail('"account" is an index in tools/kit-gen/pixellab/pool.json');
  return { job, refs: c.refs, characterOf: c.characterOf, cost, issues: c.issues, warnings: c.warnings };
}

/** A seed from the job's key, for a job that names none: the same new job draws the same picture on a rerun. */
export function seedFor(key: string): number {
  return createHash('sha256').update(key).digest().readUInt32BE(0) % 2_147_483_647;
}
