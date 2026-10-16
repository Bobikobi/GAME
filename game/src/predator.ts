/**
 * How a walking predator is drawn and heard, apart from the scene so it can be tested: where its
 * sprite stands on its round, the bank wolf's eyes, the moment it sees the player, the wolf drawn
 * running after the player while the kernel's hunt names it, and the music of a hunt. Display only:
 * every input is the kernel's state and clock, and nothing here decides a sight, a bite or a safe place.
 */
import { type Bundle, type Hazard, type State, type WorldView, headingOf, isSafe, lastDusk, predatorAt, windowOpen } from '@game/kernel';
import type { SongId } from './audio';

export type Spot = readonly [number, number];

/**
 * Between two rule tiles the sprite is linearly placed by the kernel's pace, so it reaches each
 * kernel position exactly on the tick that position changes. A step that would land after dawn is
 * never taken: the kernel keeps the predator on its tile until the window shuts, so the sprite
 * holds there too.
 */
export function predatorSpriteAt(b: Bundle, rule: Hazard, tick: number): [number, number] {
  const [tx, ty] = predatorAt(b, rule, tick);
  if (!rule.round || !windowOpen(b, rule, tick)) return [tx, ty];
  const into = (tick - lastDusk(b, tick)) % rule.pace;
  // the tick of the next step; in the last pace before dawn it is already day
  const stepAt = tick - into + rule.pace;
  if (!windowOpen(b, rule, stepAt)) return [tx, ty];
  const phase = into / rule.pace;
  const [nx, ny] = predatorAt(b, rule, stepAt);
  return [tx + (nx - tx) * phase, ty + (ny - ty) * phase];
}

/**
 * The bank wolf's eyes at night, the owner's pick of 2026-10-16 (still 3 of
 * docs/design/frames/2026-10-16-wolf-eyes.md): two eyes 2x2 game px, 2 px apart, steady at full
 * strength, in a soft glow of whole-pixel rings. The red is off the core palette by the owner's
 * exception to the style compass (DECISIONS.md): no other light, eye pair or prop takes it, so it
 * is written here and nowhere else.
 */
export const WOLF_EYES = {
  red: 0xff1744,
  size: 2,
  gap: 2,
  /** the steady glow: the red added as light at these strengths, in rings 1, 2 and 3 px out */
  halo: [0.4, 0.2, 0.08],
  /** the flare as the wolf sees the player: two rings wider, and every ring brighter */
  flare: [0.9, 0.65, 0.45, 0.28, 0.12],
} as const;

/**
 * A glow around the two eyes as a texture: its size, and each pixel it lights with the strength
 * of its ring, by the distance from the pixel's middle to the nearer eye. The eyes are left clear.
 */
export function glowPixels(rings: readonly number[]): { w: number; h: number; px: { x: number; y: number; a: number }[] } {
  const { size, gap } = WOLF_EYES;
  const r = rings.length;
  const w = 2 * size + gap + 2 * r;
  const h = size + 2 * r;
  const out = (v: number, lo: number) => Math.max(lo - v, 0, v - (lo + size));
  const px: { x: number; y: number; a: number }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(...[r, r + size + gap].map((ex) => Math.hypot(out(x + 0.5, ex), out(y + 0.5, r))));
      const ring = Math.ceil(d) - 1;
      if (d > 0 && ring < r) px.push({ x, y, a: rings[ring]! });
    }
  }
  return { w, h, px };
}

/**
 * The moment a predator sees the player, in game ms from the tick the hunt began (`chase.since`):
 * the eyes flare at full strength for `flareHold` and are back to their steady glow at `flare`, a
 * "!" stands over the predator until `bang`, and the wolf holds still for `hold` before it runs.
 */
export const SEEN = { flareHold: 300, flare: 900, bang: 1200, hold: 400 } as const;

/** How strong the flare is `ms` after the hunt began, 0 to 1: none before it, none once it has faded. */
export function flareAt(ms: number): number {
  if (ms < 0 || ms >= SEEN.flare) return 0;
  if (ms < SEEN.flareHold) return 1;
  return (SEEN.flare - ms) / (SEEN.flare - SEEN.flareHold);
}

/** Whether the "!" stands over the predator `ms` after the hunt began. */
export function bangAt(ms: number): boolean {
  return ms >= 0 && ms < SEEN.bang;
}

/**
 * A wolf drawn off its round: running after the player while the kernel's hunt names it, then
 * back to its round. The kernel keeps the predator on its round all the while and bites by its own
 * clock; a run only draws the hunt.
 */
export interface Run {
  /** where it is drawn, in tiles */
  at: [number, number];
  /** the whole tile it walks to now, if it walks */
  to?: [number, number];
  /** the game tick it is drawn for */
  tick: number;
  /** on its way back to the round */
  home: boolean;
}

/** A wolf goes back to its round twice as fast as it walks it, so it catches up with the round it rejoins. */
export const HOME_SPEED = 2;

const STEPS: readonly Spot[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** The ground a drawn wolf runs on: where the player may walk, and never a safe place. */
export function huntGround(b: Bundle, s: State, walkable: (x: number, y: number, view: WorldView) => boolean): (x: number, y: number) => boolean {
  const { width, height } = b.map;
  const open = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) open[y * width + x] = walkable(x, y, s.player) && !isSafe(b, s, [x, y]) ? 1 : 0;
  }
  return (x, y) => x >= 0 && y >= 0 && x < width && y < height && open[y * width + x] === 1;
}

/**
 * The first step of a shortest four-way walk from `from` to a tile within `near` steps of `goal`,
 * over the tiles `walk` allows and the goal's own; undefined once there, or when no walk gets there.
 */
export function firstStep(from: Spot, goal: Spot, near: number, walk: (x: number, y: number) => boolean): [number, number] | undefined {
  const within = (x: number, y: number) => Math.abs(x - goal[0]) + Math.abs(y - goal[1]) <= near;
  if (within(from[0], from[1])) return undefined;
  const seen = new Set<string>([`${from[0]},${from[1]}`]);
  // each tile in the queue carries the first step of the walk that reached it
  const queue: { x: number; y: number; first: [number, number] }[] = [];
  const visit = (x: number, y: number, first: [number, number] | undefined): [number, number] | undefined => {
    const k = `${x},${y}`;
    if (seen.has(k) || !(walk(x, y) || (x === goal[0] && y === goal[1]))) return undefined;
    seen.add(k);
    const step = first ?? [x, y];
    if (within(x, y)) return step;
    queue.push({ x, y, first: step });
    return undefined;
  };
  for (const [dx, dy] of STEPS) {
    const found = visit(from[0] + dx, from[1] + dy, undefined);
    if (found) return found;
  }
  for (let head = 0; head < queue.length; head++) {
    const t = queue[head]!;
    for (const [dx, dy] of STEPS) {
      const found = visit(t.x + dx, t.y + dy, t.first);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Moves a run on to `tick` at `msPerTile`: straight to the tile it walks to, then one tile at a
 * time where `next` leads, until the time is spent or `next` has nowhere to go; then it waits. A
 * run drawn between two tiles first settles on the nearer one.
 */
export function runOn(run: Run, tick: number, msPerTile: number, next: (at: Spot) => [number, number] | undefined): Run {
  let budget = Math.max(0, tick - run.tick) / msPerTile;
  let at: [number, number] = [run.at[0], run.at[1]];
  const whole = Number.isInteger(at[0]) && Number.isInteger(at[1]);
  let to: [number, number] | undefined = run.to ?? (whole ? undefined : [Math.round(at[0]), Math.round(at[1])]);
  for (let guard = 0; guard < 64 && budget > 0; guard++) {
    if (!to) {
      to = next(at);
      if (!to || (to[0] === at[0] && to[1] === at[1])) {
        to = undefined;
        break;
      }
    }
    const d = Math.abs(to[0] - at[0]) + Math.abs(to[1] - at[1]);
    if (d <= budget) {
      at = [to[0], to[1]];
      budget -= d;
      to = undefined;
    } else {
      at = [at[0] + ((to[0] - at[0]) * budget) / d, at[1] + ((to[1] - at[1]) * budget) / d];
      budget = 0;
    }
  }
  return { at, ...(to ? { to } : {}), tick, home: run.home };
}

/**
 * Moves a run home: it walks where `next` leads while the round is drawn more than a tile away,
 * and goes straight to where the round is drawn (`round`) once it is near, or when no walk leads
 * back. Undefined once it is there: the round draws the wolf again.
 */
export function homeOn(run: Run, tick: number, msPerTile: number, round: Spot, next: (at: Spot) => [number, number] | undefined): Run | undefined {
  if (Math.max(Math.abs(run.at[0] - round[0]), Math.abs(run.at[1] - round[1])) > 1) {
    const walked = runOn(run, tick, msPerTile, next);
    if (walked.to || walked.at[0] !== run.at[0] || walked.at[1] !== run.at[1]) return walked;
  }
  const budget = Math.max(0, tick - run.tick) / msPerTile;
  const dx = round[0] - run.at[0];
  const dy = round[1] - run.at[1];
  const d = Math.hypot(dx, dy);
  if (d <= budget) return undefined;
  return { at: [run.at[0] + (dx * budget) / d, run.at[1] + (dy * budget) / d], tick, home: true };
}

/**
 * Where a walking wolf is drawn at `tick`, and which way it faces, from the kernel's state and the
 * run drawn the frame before: on its round; while the kernel's hunt names it, running after the
 * player once the moment it saw them is over, at its pace over `walk` until it stands beside them;
 * and once the hunt is over, however it ended, back to its round. `run` is what to pass next frame.
 */
export function wolfDrawn(
  b: Bundle,
  rule: Hazard,
  s: State,
  tick: number,
  last: Run | undefined,
  walk: (x: number, y: number) => boolean,
): { at: Spot; heading: Spot; run?: Run } {
  const round = predatorSpriteAt(b, rule, tick);
  const chase = s.player.chase;
  if (chase !== null && chase.hazard === rule.id) {
    const goal = s.player.at;
    const run: Run = last ? { ...last, home: false } : { at: [round[0], round[1]], tick, home: false };
    const from = Math.max(run.tick, chase.since + SEEN.hold);
    const next = tick > from ? runOn({ ...run, tick: from }, tick, rule.pace, (t) => firstStep(t, goal, 1, walk)) : { ...run, tick };
    return { at: next.at, heading: runHeading(next, goal), run: next };
  }
  if (last) {
    const tile = predatorAt(b, rule, tick);
    const next = homeOn({ ...last, home: true }, tick, rule.pace / HOME_SPEED, round, (t) => firstStep(t, tile, 0, walk));
    if (next) return { at: next.at, heading: runHeading(next, round), run: next };
  }
  return { at: round, heading: headingOf(b, rule, tick) };
}

/** Which way a run faces, four-way: where it walks, else toward what it waits by. */
export function runHeading(run: Run, toward: Spot): [number, number] {
  const [tx, ty] = run.to ?? toward;
  const dx = tx - run.at[0];
  const dy = ty - run.at[1];
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return [0, 1];
  return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
}

/** The music for the hunt and the hour: the hunt's own from the moment one begins, then the night's or the day's. */
export function huntSong(chased: boolean, night: boolean): SongId {
  return chased ? 'chase' : night ? 'night' : 'valley';
}

/** How long a song takes to give way to the next, in ms: a hunt cuts in at once, its end eases back, dusk and dawn take their time. */
export function songFade(from: SongId | undefined, to: SongId): number {
  if (to === 'chase') return 250;
  if (from === 'chase') return 2500;
  return 4000;
}
