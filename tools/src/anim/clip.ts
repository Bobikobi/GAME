/**
 * Library motion to pixels (tools/anim/README.md): the settings (tools/anim/anim.json), the libraries
 * (tools/anim/libraries.json) and one config per clip (tools/anim/clips/<clip>.json), read, checked and turned into
 * the job the Blender script renders. Pure apart from the readers at the bottom.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INK_HEX } from '../kit/ink.js';
import { coreRamp } from '../kit/palette.js';
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

/** A body pack a race is built from (libraries.json `models`): an itch.io archive (`upload`, `unpack` prefixes) or one file by `url`. */
export interface ModelPack {
  title: string;
  page: string;
  upload?: string;
  url?: string;
  bytes: number;
  sha256: string;
  licence: string;
  licence_file?: string;
  /** archive folders unpacked whole, as they are named in the archive */
  unpack?: string[];
  /** the file a `url` pack is saved as */
  file?: string;
}

export interface Target {
  about: string;
  /** a repo path, or `$NAME` for a path from the environment; a race (`map: ual`) is built from tools/anim/races/<race>.json and has none */
  model?: string;
  basket?: string;
  /** `ual`: a race on the libraries' own skeleton; `native`: a body that carries its own actions (the four-legged wolf): played as they are, nothing retargeted */
  map: 'mixamo' | 'rig19' | 'ual' | 'native';
  /** map `ual`: the race file (tools/anim/races/<race>.json) and the body in it (`m`, `f`; a race with one body has `common` only) */
  race?: string;
  body?: string;
  /** the sheet this body is shipped as in content/kit (`chars/<sheet>_down|left|up`), once picked */
  ships?: { sheet: string; /** the walk clip the sheet is made of; `jog` when left out */ clip?: string; /** false: the clip carries its own head travel and the game drops the code bob for this sheet */ bob?: boolean };
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
  /** the coats one creature of this kind may wear, each by weight (game/src/coat.ts picks and draws them) */
  coats?: CoatSpec[];
}

/**
 * One coat of a kind: a pure step to step recolour of the sheets (a pixel at step i of a mapped ramp becomes step
 * clamp(i + shift, 0, 5) of ramp `to`, or the "ramp:step" its `steps` list names, null keeping it), so every colour
 * it writes is a palette colour; `body` names another target whose sheets it is drawn on, for a pattern a recolour
 * cannot make.
 */
export interface CoatSpec {
  id: string;
  name: string;
  weight: number;
  map: Record<string, { to: string; shift?: number } | { steps: (string | null)[] }>;
  body?: string;
}

export interface Limits {
  palette_pct: number;
  foot_slide_px: number;
  silhouette_dev_pct: number;
  /** the most poses a second a distance-locked cycle may need at a game pace: each pose stays on screen two 60 Hz frames */
  poses_per_s_max: number;
}

/** A clip's frame: the size and the point of the ground under the feet, in frame pixels. */
export interface Frame {
  size: [number, number];
  anchor: [number, number];
}

export interface Settings {
  tile_px: number;
  /** the one frame of the clips that leave `frame` out, and of a character sheet in content/kit at density 4 (tools/src/check.ts `sizeRule`) */
  frame: Frame;
  fps: number;
  supersample: number;
  paces: Record<Pace, string>;
  limits: Limits;
  /** the clothed-width rule: in `pairs` the first sheet's walk (the median widest row of its poses, down view) is at most `max_pct` of the second's; the human man is the reference of both elves, as in the picks */
  clothed_width: { max_pct: number; pairs: [string, string][] };
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
  /** left out: the settings' one frame, the size of a character sheet in the kit */
  frame?: Frame;
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

/**
 * The problems of a target's coats, in plain words; empty when they can be drawn: ids unique, a name, a positive whole
 * weight, each mapped ramp a shared ramp that the target (or the coat's body) draws in, whole or as a span of it, each
 * `to` a shared ramp and a whole shift from -5 to 5 (or six `steps`, each "ramp:step" of a shared ramp or null), no
 * step that lands on the ink (a body pixel in the outline's colour melts into the outline), a body that is another
 * target of anim.json.
 */
export function coatProblems(id: string, settings: Settings): string[] {
  const out: string[] = [];
  const target = settings.targets[id];
  const coats = target?.coats;
  if (target === undefined || coats === undefined) return out;
  const say = (text: string) => out.push(`${id} coats: ${text}`);
  if (!Array.isArray(coats) || coats.length === 0) {
    say('"coats" is a list of one coat or more');
    return out;
  }
  const ids = coats.map((c) => c.id);
  if (new Set(ids).size !== ids.length) say('each coat id once');
  for (const c of coats) {
    const name = typeof c.id === 'string' && c.id.length > 0 ? c.id : '?';
    if (name === '?') say('every coat has an id');
    if (typeof c.name !== 'string' || c.name.length === 0) say(`${name}: a name`);
    if (!isInt(c.weight) || c.weight <= 0) say(`${name}: weight is a positive whole number`);
    let ramps = target.ramps;
    if (c.body !== undefined) {
      const body = settings.targets[c.body];
      if (body === undefined || c.body === id) say(`${name}: body "${c.body}" is not another target of anim.json`);
      else ramps = body.ramps;
    }
    if (typeof c.map !== 'object' || c.map === null || Array.isArray(c.map)) {
      say(`${name}: map is an object of ramp -> { to, shift }`);
      continue;
    }
    for (const [from, step] of Object.entries(c.map)) {
      const src = coreRamp(from);
      if (src === undefined) say(`${name}: ramp "${from}" is not a shared ramp`);
      else if (!ramps.some((r) => rampSteps(r)?.id === from)) say(`${name}: ramp "${from}" is not one the body draws in (${ramps.join(', ')})`);
      const dest: (string | undefined)[] = [];
      if (step !== null && typeof step === 'object' && 'steps' in step) {
        if (!Array.isArray(step.steps) || step.steps.length !== 6) {
          say(`${name}: ${from} steps names all six steps, each "ramp:step" or null`);
          continue;
        }
        step.steps.forEach((entry, i) => {
          if (entry === null) return dest.push(undefined);
          const m = typeof entry === 'string' ? /^([a-z_]+):([0-5])$/.exec(entry) : null;
          const to = m === null ? undefined : coreRamp(m[1]!);
          if (m === null || to === undefined) say(`${name}: ${from} step ${i} goes to "${String(entry)}", not "ramp:step" of a shared ramp`);
          dest.push(to?.steps[Number(m?.[2])]);
        });
      } else {
        const to = typeof step?.to === 'string' ? coreRamp(step.to) : undefined;
        if (to === undefined) say(`${name}: ${from} goes to "${String(step?.to)}", not a shared ramp`);
        const shift = step?.shift ?? 0;
        if (!isInt(shift) || Math.abs(shift) > 5) say(`${name}: ${from} shift is a whole number from -5 to 5`);
        else for (let i = 0; i < 6; i += 1) dest.push(to?.steps[Math.min(5, Math.max(0, i + shift))]);
      }
      dest.forEach((hex, i) => {
        if (src !== undefined && hex !== undefined && src.steps[i] !== INK_HEX && hex.toLowerCase() === INK_HEX.toLowerCase()) say(`${name}: ${from} step ${i} lands on the ink`);
      });
    }
  }
  return out;
}

/** The problems of one clip config, in plain words; empty when it can be rendered. */
export function clipProblems(name: string, clip: Clip, libs: Record<string, Library>, settings: Settings): string[] {
  const out: string[] = [];
  const say = (text: string) => out.push(`${name}: ${text}`);
  if (typeof clip.about !== 'string' || clip.about.length === 0) say('"about" says in one line what the clip is');
  const target = settings.targets[clip.target];
  if (target === undefined) say(`target "${clip.target}" is not one of ${Object.keys(settings.targets).join(', ')}`);
  else out.push(...coatProblems(clip.target, settings));
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
  const [w, h] = frameOf(clip, settings).size;
  const [ax, ay] = frameOf(clip, settings).anchor;
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

/** The clip's frame: its own, or the settings' one. */
export function frameOf(clip: Clip, settings: Settings): Frame {
  return clip.frame ?? settings.frame;
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

export const MODELS_DIR = join(CACHE_DIR, 'models');
export const RACES_DIR = join(ANIM_DIR, 'races');

/** A race file merged for one body (`common` over nothing, then the body's part over it), with `$MODELS` made the fetched models folder. */
export function raceSpec(race: string, body: string | undefined, modelsDir = MODELS_DIR): Record<string, unknown> {
  const file = readJson<{ common?: Record<string, unknown>; bodies?: Record<string, Record<string, unknown>> }>(join(RACES_DIR, `${race}.json`));
  const part = body === undefined ? {} : file.bodies?.[body];
  if (part === undefined) throw new Error(`races/${race}.json has no body "${body}"`);
  const fill = (v: unknown): unknown =>
    typeof v === 'string' ? v.replace('$MODELS', modelsDir) : Array.isArray(v) ? v.map(fill) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v;
  return fill({ ...(file.common ?? {}), ...part }) as Record<string, unknown>;
}

/** The files a race is built from that are not on disk yet (the model folders `pnpm anim fetch` unpacks). */
export function missingModels(spec: Record<string, unknown>): string[] {
  const files = [...((spec.models as string[] | undefined) ?? []), ...(spec.pieces ? [(spec.pieces as { glb: string }).glb] : [])];
  return files.filter((f) => !existsSync(f));
}

export interface JobPaths {
  out: string;
  libs: string[];
  /** a Meshy or rig target's model file; a race has none */
  model?: string;
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
    target: target.map === 'rig19' ? `rig:${paths.model}` : target.map === 'ual' ? 'ual' : 'forager',
    target_path: paths.model,
    ...(target.map === 'ual' ? { race: raceSpec(target.race ?? '', target.body) } : {}),
    map: target.map,
    elev: target.elev,
    pxm: target.pxm,
    kz: target.kz ?? 1,
    frame: frameOf(clip, settings).size,
    anchor: frameOf(clip, settings).anchor,
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

export function readModels(): Record<string, ModelPack> {
  const { models } = readJson<{ models?: Record<string, ModelPack | string> }>(join(ANIM_DIR, 'libraries.json'));
  return Object.fromEntries(Object.entries(models ?? {}).filter((e): e is [string, ModelPack] => typeof e[1] !== 'string'));
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
