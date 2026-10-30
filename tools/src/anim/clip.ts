/**
 * Library motion to pixels (tools/anim/README.md): the settings (tools/anim/anim.json), the libraries
 * (tools/anim/libraries.json) and one config per clip (tools/anim/clips/<clip>.json), read, checked and turned into
 * the job the Blender script renders. Pure apart from the readers at the bottom.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../load.js';
import { rampSteps } from './snap.js';

export const ANIM_DIR = join(REPO_ROOT, 'tools', 'anim');
export const CLIPS_DIR = join(ANIM_DIR, 'clips');
/** Everything the tool writes: the unpacked libraries and the rendered clips. Ignored by git. */
export const CACHE_DIR = join(REPO_ROOT, 'tools', '.cache', 'anim');

export type View = 'down' | 'up' | 'left';
export const VIEWS: readonly View[] = ['down', 'up', 'left'];
export const MASKS = ['arm_l', 'arm_r'] as const;
export const PROPS = ['hatchet', 'pick', 'torch', 'trowel', 'crate', 'seedbag', 'sprig', 'berries'] as const;
/** fixed on the ground by the body */
export const SET_PIECES = ['herb', 'bush'] as const;
/** carried on the hips */
export const WORN_PARTS = ['pouch'] as const;
export type Pace = 'light' | 'steady' | 'heavy';

export interface Library {
  title: string;
  page: string;
  upload: string;
  bytes: number;
  sha256: string;
  licence: string;
  glb: string;
  licence_file: string;
  fps: number;
  /** action name -> length in frames */
  actions: Record<string, number>;
}

export interface Target {
  about: string;
  /** a repo path, or `$NAME` for a path from the environment */
  model: string;
  basket?: string;
  /** `native`: a body that carries its own actions (the four-legged wolf): played as they are, nothing retargeted */
  map: 'mixamo' | 'rig19' | 'native';
  /** native only: the body's own actions and their lengths in frames at `fps` */
  actions?: Record<string, number>;
  /** native only: the frames a second of those actions */
  fps?: number;
  /** native only: the four feet, `<side><end>` (LB, RB, LF, RF), to the bone whose tail is the sole */
  contacts?: Record<string, string>;
  elev: number;
  pxm: number;
  kz?: number;
  ramps: string[];
  metal: string;
  /** the ramp of leaves (set pieces, a picked sprig); green when left out */
  leaf?: string;
  credit?: string;
  colours?: Record<string, string>;
}

export interface Limits {
  palette_pct: number;
  foot_slide_px: number;
  silhouette_dev_pct: number;
  /** the most poses a second a distance-locked cycle may need at a game pace: each pose stays on screen two 60 Hz frames */
  poses_per_s_max: number;
}

export interface Settings {
  tile_px: number;
  fps: number;
  supersample: number;
  paces: Record<Pace, string>;
  limits: Limits;
  targets: Record<string, Target>;
}

/** The id of the pseudo-library that holds a native target's own actions. */
export const selfLibrary = (target: string): string => `self:${target}`;

/**
 * The libraries of libraries.json plus, for each native target, its own actions as `self:<target>`: a clip on
 * that body names it as its base, and the sampling code below needs nothing else to know about native bodies.
 */
export function withNative(libs: Record<string, Library>, settings: Settings): Record<string, Library> {
  const out = { ...libs };
  for (const [id, t] of Object.entries(settings.targets)) {
    if (t.map !== 'native') continue;
    out[selfLibrary(id)] = { title: `${id} (its own actions)`, page: '', upload: '', bytes: 0, sha256: '', licence: '', glb: '', licence_file: '', fps: t.fps ?? settings.fps, actions: t.actions ?? {} };
  }
  return out;
}

export interface Source {
  library: string;
  action: string;
}

export interface Clip {
  about: string;
  target: string;
  base: Source;
  /** the base action's frames to draw: a list, or `even` poses spread over the whole action */
  frames: number[] | { even: number };
  /** a second action for the masked bones; `frame` is a fixed frame, or `follow` for the base's phase */
  layer?: Source & { mask: string[]; frame: number | 'follow' };
  /**
   * one wrist along a curve through `points`: metres in body axes (x out on the IK side, y forward, z up) from the
   * shoulder, from the library's own wrist, or (`body`) from the floor under the body, where a point may also name a
   * worn part
   */
  ik?: { side: 'L' | 'R'; anchor: 'shoulder' | 'wrist' | 'body'; pole: number[]; points: (number[] | string)[]; floor?: number; t: number[] };
  /** `poses`: the poses that show it (a sprig appears once picked); every pose when left out */
  prop?: { kind: string; hand?: 'L' | 'R'; from?: 'hand' | 'ik'; haft?: 'radial' | 'fore'; poses?: number[] };
  /** set pieces on the ground: `at` is [x, y] metres in body axes on the IK side (the prop's hand without IK) */
  set?: { kind: string; at: number[]; size?: number }[];
  /** worn parts on the hips: `at` is [x, y, z] metres in body axes from the hips joint */
  worn?: { kind: string; at: number[] }[];
  basket?: boolean;
  frame: { size: [number, number]; anchor: [number, number] };
  views: View[];
  /** time per pose; left out, each pose lasts until the next sampled frame at the library's fps */
  ms?: number[];
  /** `gait: four-beat`: a quadruped's walk, whose four feet land one after another, evenly, hind and fore in turn */
  locomotion?: {
    playback: 'distance' | 'time';
    gait?: 'four-beat';
    /** the body's own pace, milliseconds a tile, in place of the player's three (a creature on its round or a chase) */
    pace_ms?: number;
  };
  ramps?: string[];
  limits?: Partial<Limits>;
}

export interface Sample {
  base: [string, number];
  layer_f?: number;
  t?: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);

/** The problems of one clip config, in plain words; empty when it can be rendered. */
export function clipProblems(name: string, clip: Clip, libs: Record<string, Library>, settings: Settings): string[] {
  const out: string[] = [];
  const say = (text: string) => out.push(`${name}: ${text}`);
  if (typeof clip.about !== 'string' || clip.about.length === 0) say('"about" says in one line what the clip is');
  const target = settings.targets[clip.target];
  if (target === undefined) say(`target "${clip.target}" is not one of ${Object.keys(settings.targets).join(', ')}`);
  const length = (src: Source | undefined, what: string): number | undefined => {
    if (src === undefined) return undefined;
    const lib = libs[src.library];
    if (lib === undefined) {
      say(`${what} library "${src.library}" is not one of ${Object.keys(libs).join(', ')}`);
      return undefined;
    }
    const len = lib.actions[src.action];
    if (len === undefined) say(`${what} action "${src.action}" is not in ${src.library}`);
    return len;
  };
  const baseLen = length(clip.base, 'base');
  const native = target?.map === 'native';
  if (native) {
    if (clip.base.library !== selfLibrary(clip.target)) say(`a clip on the native target ${clip.target} takes its own actions: base library "${selfLibrary(clip.target)}"`);
    for (const part of ['layer', 'ik', 'prop', 'set', 'worn', 'basket'] as const) if (clip[part] !== undefined) say(`a native body has no ${part} (the actions are played as they are)`);
    const feet = Object.keys(target.contacts ?? {});
    if (feet.length !== 4 || !feet.every((f) => /^[LR][BF]$/.test(f)) || new Set(feet).size !== 4) say('a native target names its four feet LB, RB, LF, RF in "contacts"');
    if (target.actions === undefined || Object.keys(target.actions).length === 0) say('a native target lists its "actions" with their lengths in frames');
  } else if (clip.base.library.startsWith('self:')) {
    say(`the library "${clip.base.library}" belongs to a native target; ${clip.target} is not one`);
  }
  if (clip.locomotion?.gait !== undefined && (clip.locomotion.gait !== 'four-beat' || !native)) say('locomotion.gait is four-beat, and only a native (four-legged) target has one');
  let count = 0;
  if (Array.isArray(clip.frames)) {
    count = clip.frames.length;
    if (count === 0) say('"frames" is empty');
    for (const f of clip.frames) {
      if (!isNum(f) || f < 0 || (baseLen !== undefined && f > baseLen)) say(`frame ${String(f)} is outside the base action (0..${baseLen ?? '?'})`);
    }
  } else if (clip.frames && isInt(clip.frames.even) && clip.frames.even > 1) {
    count = clip.frames.even;
  } else {
    say('"frames" is a list of frames or { "even": n } with n > 1');
  }
  if (clip.layer !== undefined) {
    const layerLen = length(clip.layer, 'layer');
    for (const m of clip.layer.mask ?? []) if (!(MASKS as readonly string[]).includes(m)) say(`mask "${m}" is not one of ${MASKS.join(', ')}`);
    if ((clip.layer.mask ?? []).length === 0) say('a layer names at least one mask');
    const f = clip.layer.frame;
    if (f !== 'follow' && (!isNum(f) || f < 0 || (layerLen !== undefined && f > layerLen))) say(`layer frame ${String(f)} is outside the layer action`);
  }
  const worn = (clip.worn ?? []).map((w) => w.kind);
  for (const w of clip.worn ?? []) {
    if (!(WORN_PARTS as readonly string[]).includes(w.kind)) say(`worn "${w.kind}" is not one of ${WORN_PARTS.join(', ')}`);
    if (!Array.isArray(w.at) || w.at.length !== 3 || !w.at.every(isNum)) say(`worn ${w.kind}: at is three numbers (metres from the hips)`);
  }
  if (new Set(worn).size !== worn.length) say('each worn part once');
  for (const p of clip.set ?? []) {
    if (!(SET_PIECES as readonly string[]).includes(p.kind)) say(`set piece "${p.kind}" is not one of ${SET_PIECES.join(', ')}`);
    if (!Array.isArray(p.at) || p.at.length !== 2 || !p.at.every(isNum)) say(`set ${p.kind}: at is two numbers (metres, body axes: x out, y forward)`);
    if (p.size !== undefined && (!isNum(p.size) || p.size <= 0)) say(`set ${p.kind}: size is a positive number`);
  }
  if (clip.ik !== undefined) {
    const ik = clip.ik;
    if (ik.side !== 'L' && ik.side !== 'R') say('ik.side is L or R');
    if (ik.anchor !== 'shoulder' && ik.anchor !== 'wrist' && ik.anchor !== 'body') say('ik.anchor is shoulder, wrist or body');
    if (!Array.isArray(ik.pole) || ik.pole.length !== 3 || !ik.pole.every(isNum)) say('ik.pole is three numbers');
    const okPoint = (p: number[] | string) => (typeof p === 'string' ? ik.anchor === 'body' && worn.includes(p) : Array.isArray(p) && p.length === 3 && p.every(isNum));
    if (!Array.isArray(ik.points) || ik.points.length < 2 || !ik.points.every(okPoint)) {
      say('ik.points is two or more points of three numbers (metres, body axes: x out on the tool side, y forward, z up), or with anchor body the name of a worn part');
    }
    if (!Array.isArray(ik.t) || ik.t.length !== count || !ik.t.every((t) => isNum(t) && t >= 0 && t <= 1)) say(`ik.t is ${count} numbers from 0 to 1, one per frame`);
    if (ik.floor !== undefined && !isNum(ik.floor)) say('ik.floor is a number of metres');
  }
  if (clip.prop !== undefined) {
    if (!(PROPS as readonly string[]).includes(clip.prop.kind)) say(`prop "${clip.prop.kind}" is not one of ${PROPS.join(', ')}`);
    if (clip.prop.hand !== undefined && clip.prop.hand !== 'L' && clip.prop.hand !== 'R') say('prop.hand is L or R');
    if (clip.prop.from === 'ik' && clip.ik === undefined) say('a prop placed from the IK needs an ik section');
    if (clip.prop.poses !== undefined && (!Array.isArray(clip.prop.poses) || !clip.prop.poses.every((i) => isInt(i) && i >= 0 && i < count))) say(`prop.poses are pose numbers from 0 to ${count - 1}`);
  }
  const [w, h] = clip.frame?.size ?? [];
  const [ax, ay] = clip.frame?.anchor ?? [];
  if (!isInt(w) || !isInt(h) || w <= 0 || h <= 0) say('frame.size is two whole numbers of pixels');
  else if (!isNum(ax) || !isNum(ay) || ax < 0 || ay < 0 || ax > w || ay > h) say('frame.anchor (the feet) lies inside the frame');
  if (!Array.isArray(clip.views) || clip.views.length === 0 || !clip.views.every((v) => VIEWS.includes(v))) say(`views are some of ${VIEWS.join(', ')} (right is left mirrored)`);
  if (clip.ms !== undefined && (!Array.isArray(clip.ms) || clip.ms.length !== count || !clip.ms.every((m) => isInt(m) && m > 0))) say(`ms is ${count} whole positive numbers, one per pose`);
  for (const r of clip.ramps ?? []) if (rampSteps(r) === undefined) say(`ramp "${r}" is not a shared ramp or a span of one (<id>:<a>-<b>)`);
  if (clip.locomotion !== undefined) {
    if (clip.locomotion.playback !== 'distance' && clip.locomotion.playback !== 'time') say('locomotion.playback is distance or time');
    if (clip.locomotion.pace_ms !== undefined && (!isInt(clip.locomotion.pace_ms) || clip.locomotion.pace_ms <= 0)) say('locomotion.pace_ms is a whole number of milliseconds a tile');
    if (Array.isArray(clip.frames)) say('a locomotion clip spreads its poses evenly ({ "even": n }), so the cycle has one step per pose');
  }
  for (const key of Object.keys(clip.limits ?? {})) if (!(key in settings.limits)) say(`limit "${key}" is not one of ${Object.keys(settings.limits).join(', ')}`);
  return out;
}

/** The base frames to draw. */
export function baseFrames(clip: Clip, libs: Record<string, Library>): number[] {
  if (Array.isArray(clip.frames)) return [...clip.frames];
  const len = libs[clip.base.library]?.actions[clip.base.action] ?? 0;
  const n = clip.frames.even;
  return Array.from({ length: n }, (_, i) => Math.round((len * i * 1000) / n) / 1000);
}

/** Time per pose: the clip's own, or until the next sampled frame at the library's fps (the last wraps to the end). */
export function poseMs(clip: Clip, libs: Record<string, Library>): number[] {
  if (clip.ms !== undefined) return [...clip.ms];
  const lib = libs[clip.base.library];
  const len = lib?.actions[clip.base.action] ?? 0;
  const fps = lib?.fps ?? 24;
  const fr = baseFrames(clip, libs);
  return fr.map((f, i) => Math.round(((i + 1 < fr.length ? (fr[i + 1] ?? len) : len) - f) * (1000 / fps)));
}

/** Source frames between two poses of a locomotion clip (its whole length over its poses). */
export function stepFrames(clip: Clip, libs: Record<string, Library>): number {
  const len = libs[clip.base.library]?.actions[clip.base.action] ?? 0;
  return len / baseFrames(clip, libs).length;
}

export function samples(clip: Clip, libs: Record<string, Library>): Sample[] {
  const fr = baseFrames(clip, libs);
  const baseLen = libs[clip.base.library]?.actions[clip.base.action] ?? 1;
  return fr.map((f, i) => {
    const s: Sample = { base: [clip.base.action, f] };
    if (clip.layer !== undefined) {
      const layerLen = libs[clip.layer.library]?.actions[clip.layer.action] ?? 1;
      s.layer_f = clip.layer.frame === 'follow' ? Math.round(((f * layerLen) / baseLen) * 100) / 100 : clip.layer.frame;
    }
    if (clip.ik !== undefined) s.t = clip.ik.t[i] ?? 0;
    return s;
  });
}

/** A target's model path: a repo path, or `$NAME` read from the environment (undefined when unset). */
export function modelPath(model: string, env: Record<string, string | undefined>): string | undefined {
  if (model.startsWith('$')) return env[model.slice(1)] || undefined;
  return join(REPO_ROOT, model);
}

export interface JobPaths {
  out: string;
  libs: string[];
  model: string;
  basket?: string;
  threads: number;
}

/** The job the Blender script reads (tools/anim/blender/render.py): every path resolved, every default filled. */
export function job(name: string, clip: Clip, libs: Record<string, Library>, settings: Settings, paths: JobPaths): Record<string, unknown> {
  const target = settings.targets[clip.target];
  if (target === undefined) throw new Error(`${name}: no target ${clip.target}`);
  const out: Record<string, unknown> = {
    name,
    out: paths.out,
    libs: paths.libs,
    target: target.map === 'rig19' ? `rig:${paths.model}` : 'forager',
    target_path: paths.model,
    map: target.map,
    elev: target.elev,
    pxm: target.pxm,
    kz: target.kz ?? 1,
    frame: clip.frame.size,
    anchor: clip.frame.anchor,
    ss: settings.supersample,
    dirs: clip.views,
    samples: samples(clip, libs),
    threads: paths.threads,
    fps: settings.fps,
  };
  if (target.colours !== undefined) out.rig_colours = target.colours;
  if (target.map === 'native') out.contacts = target.contacts;
  if (clip.layer !== undefined) out.layer = { action: clip.layer.action, mask: clip.layer.mask, frame: clip.layer.frame === 'follow' ? 0 : clip.layer.frame };
  if (clip.ik !== undefined) out.ik = { side: clip.ik.side, anchor: clip.ik.anchor, pole: clip.ik.pole, points: clip.ik.points, ...(clip.ik.floor !== undefined ? { floor: clip.ik.floor } : {}) };
  if (clip.prop !== undefined) {
    out.prop = clip.prop.kind;
    out.prop_side = clip.prop.hand ?? 'R';
    if (clip.prop.from === 'ik') out.prop_from = 'ik';
    if (clip.prop.haft === 'fore') out.haft_from = 'fore';
    if (clip.prop.poses !== undefined) out.prop_poses = clip.prop.poses;
  }
  if (clip.set !== undefined) out.set = clip.set;
  if (clip.worn !== undefined) out.worn = clip.worn;
  if (clip.basket && paths.basket !== undefined) {
    out.basket = true;
    out.basket_path = paths.basket;
  }
  if (clip.locomotion !== undefined) {
    out.dense = { length: libs[clip.base.library]?.actions[clip.base.action] ?? 0, step: 1 };
  }
  return out;
}

// ------------------------------------------------------------------ readers

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

export function readSettings(): Settings {
  return readJson<Settings>(join(ANIM_DIR, 'anim.json'));
}

export function readLibraries(): Record<string, Library> {
  return readJson<{ libraries: Record<string, Library> }>(join(ANIM_DIR, 'libraries.json')).libraries;
}

export function clipNames(): string[] {
  if (!existsSync(CLIPS_DIR)) return [];
  return readdirSync(CLIPS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();
}

export function readClip(name: string): Clip {
  return readJson<Clip>(join(CLIPS_DIR, `${name}.json`));
}

/** The paces a clip is judged at: the player's three, or its own single pace (`locomotion.pace_ms`) for all three. */
export function clipPaces(clip: Clip, settings: Settings, players: Record<Pace, number>): Record<Pace, number> {
  const ms = clip.locomotion?.pace_ms;
  if (ms === undefined) return players;
  const own = (settings.tile_px * 1000) / ms;
  return { light: own, steady: own, heavy: own };
}

/** The game's paces in px a second at the tile size: one tile per step (content/core/params.json). */
export function paces(settings: Settings, params: unknown): Record<Pace, number> {
  const pick = (path: string): number => {
    let node: unknown = (params as { params?: unknown }).params ?? params;
    for (const key of path.split('.')) node = (node as Record<string, unknown> | undefined)?.[key];
    const value = (node as { value?: unknown } | undefined)?.value;
    if (!isNum(value)) throw new Error(`content/core/params.json has no number at ${path}`);
    return value;
  };
  const out = {} as Record<Pace, number>;
  for (const [pace, path] of Object.entries(settings.paces) as [Pace, string][]) out[pace] = (settings.tile_px * 1000) / pick(path);
  return out;
}
