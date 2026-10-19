/**
 * Ambient creatures that react to the player (DECISIONS 2026-10-19): the rules of
 * when one sits, bolts, stays away and comes back, with no Phaser in it, so a test
 * can run them tick by tick. Cosmetic only: the kernel never sees a creature, and
 * the scene draws them behind `RICH.motion`. Spots and kinds are the map's
 * `creatures` block; the drawing is `creatureart.ts`.
 *
 * Distances are in tiles and times in real milliseconds, like the other ambient life.
 */
import type { MapDef } from '@game/kernel';

type Creatures = NonNullable<MapDef['creatures']>;
export type CreatureKind = Creatures['kinds'][string];
export type Look = CreatureKind['look'];

/** How long after the player comes close a creature notices, ms. Well under the 300 ms the brief allows. */
export const REACT_MS = 120;
/** A creature that has left comes back only when the player is this many tiles beyond its alert distance. */
export const CLEAR_MARGIN = 1;

export type Phase = 'sitting' | 'fleeing' | 'fading' | 'away' | 'returning';

/** How long a creature takes to fade out of view when its hour ends, ms. */
export const FADE_MS = 1200;

/** Per look: how long it runs, how fast (tiles per second) and how long it takes to come back into view. */
const MOVES: Record<Look, { flee_ms: number; speed: number; back_ms: number }> = {
  bird: { flee_ms: 1600, speed: 4, back_ms: 700 },
  fish: { flee_ms: 360, speed: 6, back_ms: 600 },
  rabbit: { flee_ms: 900, speed: 6.5, back_ms: 500 },
  deer: { flee_ms: 2400, speed: 2.6, back_ms: 900 },
};

export interface Creature {
  readonly id: number;
  readonly kind: CreatureKind;
  readonly look: Look;
  /** the spot's tile */
  readonly sx: number;
  readonly sy: number;
  phase: Phase;
  /** ms in this phase */
  t: number;
  /** ms the player has been close while it sits (it reacts after REACT_MS) */
  alarm: number;
  /** a unit step away from the player, set when it leaves */
  dx: number;
  dy: number;
  /** tiles moved from the spot while it flees; held while it is away */
  run: number;
  /** it left because the player scared it (so it waits its time), not because its hour ended */
  fled: boolean;
}

export function makeCreatures(map: Pick<MapDef, 'creatures'>): Creature[] {
  const c = map.creatures;
  if (!c) return [];
  return c.spots.flatMap((s, id) => {
    const kind = c.kinds[s.kind];
    return kind ? [{ id, kind, look: kind.look, sx: s.x, sy: s.y, phase: 'sitting' as Phase, t: 0, alarm: 0, dx: 1, dy: 0, run: 0, fled: false }] : [];
  });
}

/** Whether a kind is out at this game hour; by default all day, never in the dark (night is the shade's 0..1). */
export function isOut(kind: CreatureKind, hour: number, night: number): boolean {
  if (kind.hours) return hour >= kind.hours[0] && hour < kind.hours[1];
  return night < 0.5;
}

export interface Watch {
  /** the player's feet in tiles (x right, y down), the tile centre of the tile the player stands on */
  x: number;
  y: number;
  /** walking or running (a still player alarms nothing that is already settled) */
  moving: boolean;
}

function distance(c: Creature, p: Watch): number {
  return Math.hypot(c.sx + 0.5 - p.x, c.sy + 0.5 - p.y);
}

/** Close enough and walking: this is what makes a creature go. */
export function startled(c: Creature, p: Watch): boolean {
  return p.moving && distance(c, p) <= c.kind.alert_tiles;
}

/**
 * Advance one creature by `dt` ms. `out` is whether its kind is out at this hour;
 * `blocked(x, y)` says whether a tile stops a runner on foot (forest, water), so a
 * rabbit that reaches the trees is gone into them.
 */
export function stepCreature(c: Creature, dt: number, p: Watch, out: boolean, blocked: (x: number, y: number) => boolean = () => false): void {
  const mv = MOVES[c.look];
  c.t += dt;
  switch (c.phase) {
    case 'sitting': {
      if (!out) return leave(c, 'fading');
      c.alarm = startled(c, p) ? c.alarm + dt : 0;
      if (c.alarm >= REACT_MS) bolt(c, p);
      return;
    }
    case 'fleeing': {
      c.run = (Math.min(c.t, mv.flee_ms) / 1000) * mv.speed;
      const x = Math.floor(c.sx + 0.5 + c.dx * c.run);
      const y = Math.floor(c.sy + 0.5 + c.dy * c.run);
      const stopped = c.look !== 'bird' && c.look !== 'fish' && blocked(x, y);
      if (c.t >= mv.flee_ms || stopped) {
        leave(c, 'away');
        c.fled = true;
      }
      return;
    }
    case 'fading': {
      if (c.t >= FADE_MS) {
        leave(c, 'away');
        c.fled = false;
      }
      return;
    }
    case 'away': {
      if ((!c.fled || c.t >= c.kind.return_s * 1000) && out && distance(c, p) > c.kind.alert_tiles + CLEAR_MARGIN) {
        c.phase = 'returning';
        c.t = 0;
      }
      return;
    }
    case 'returning': {
      if (!out) return leave(c, 'fading');
      if (startled(c, p)) return bolt(c, p);
      if (c.t >= mv.back_ms) {
        c.phase = 'sitting';
        c.t = 0;
        c.alarm = 0;
        c.run = 0;
      }
      return;
    }
  }
}

function leave(c: Creature, phase: Phase): void {
  c.phase = phase;
  c.t = 0;
  c.alarm = 0;
}

/** Fish keep to the river's line (north or south); the rest go straight away from the player. */
function bolt(c: Creature, p: Watch): void {
  let dx = c.sx + 0.5 - p.x;
  let dy = c.sy + 0.5 - p.y;
  if (c.look === 'fish') {
    dy = dy === 0 ? (c.id % 2 === 0 ? 1 : -1) : dy;
    dx = 0;
  }
  const len = Math.hypot(dx, dy);
  if (len < 0.01) {
    dx = c.id % 2 === 0 ? 1 : -1;
    dy = 0;
  } else {
    dx /= len;
    dy /= len;
  }
  c.dx = dx;
  c.dy = dy;
  c.phase = 'fleeing';
  c.t = 0;
  c.alarm = 0;
  c.run = 0;
}

export interface Pose {
  /** offset from the spot's tile centre, tiles */
  ox: number;
  oy: number;
  /** a pose name for the art: 'sit' (two idle frames), 'move' (stride or wing frames), 'rise' */
  pose: 'sit' | 'move';
  alpha: number;
  /** faces left */
  flip: boolean;
}

/** What to draw now: where it is, how opaque, which pose. Pure, so it can be tested and drawn the same. */
export function poseOf(c: Creature): Pose {
  const mv = MOVES[c.look];
  const flip = c.dx < 0;
  switch (c.phase) {
    case 'sitting':
      return { ox: 0, oy: 0, pose: 'sit', alpha: 1, flip };
    case 'fleeing': {
      const rise = c.look === 'bird' ? -(c.run * 0.55 + 0.04 * c.run * c.run) : 0;
      // a bird is gone off the ground at once; the others fade out over their last quarter
      const left = 1 - c.t / mv.flee_ms;
      const alpha = c.look === 'bird' ? Math.max(0, Math.min(1, left * 2.5)) : Math.max(0, Math.min(1, left * 4));
      return { ox: c.dx * c.run, oy: c.dy * c.run + rise, pose: 'move', alpha, flip };
    }
    case 'fading':
      return { ox: 0, oy: 0, pose: 'sit', alpha: Math.max(0, 1 - c.t / FADE_MS), flip };
    case 'away':
      return { ox: 0, oy: 0, pose: 'sit', alpha: 0, flip };
    case 'returning': {
      const k = Math.min(1, c.t / mv.back_ms);
      // a bird lands from above; the rest come into view where they sat
      return { ox: 0, oy: c.look === 'bird' ? -1.6 * (1 - k) : 0, pose: c.look === 'bird' && k < 1 ? 'move' : 'sit', alpha: k, flip };
    }
  }
}
