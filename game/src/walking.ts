/**
 * The walk's rules with nothing drawn: how the body moves between tiles (NEXT 22), which tile it may enter,
 * what a tile it lands on tells the kernel, and what a player standing still owes it while a predator watches
 * or a hunt runs (P-5b). The 2D scene and the 3D door both walk by them. Pure apart from the GameSession it is handed, so the walk
 * can be played on the real map without a renderer (game/test/stealth-flow.test.ts).
 */
import { type Bundle, type Gait, type Hazard, type Tile, type makeWalkable, sees, stepRuleFor, windowOpen } from '@game/kernel';

import { DIRS, type Dir } from './input';
import type { GameSession } from './session-surface';

type Walkable = ReturnType<typeof makeWalkable>;

/**
 * The kernel's rule, a rock face's, and a plant or stone that is ready stands in the way. `nodeAt` holds each node and find by its tile, `x,y`.
 *
 * A step into a four-adjacent tile also asks the kernel's height rule (G68, `stepRuleFor`: built once per bundle, and the very function
 * `walkDistance` reads for the server's check), so a face between levels stops the body as a wall does and a crossing lets it by, and the
 * server never refuses a step the client took. `from` is the tile the body leaves: the player's own (`s.pos`) when none is given, which is what
 * one step asks, and the tile a search expands from when it asks tile by tile. A target that is not four-adjacent to `from` is no step and is
 * judged by its own tile alone.
 */
export function canEnter(
  b: Bundle,
  walkable: Walkable,
  nodeAt: ReadonlyMap<string, string>,
  s: Pick<GameSession, 'pos' | 'tick' | 'state'>,
  x: number,
  y: number,
  from: readonly [number, number] = s.pos,
): boolean {
  if (!walkable(x, y, s.state.player)) return false;
  if (Math.abs(x - from[0]) + Math.abs(y - from[1]) === 1 && !stepRuleFor(b)(from[0], from[1], x, y)) return false;
  const node = nodeAt.get(`${x},${y}`);
  return !(node && b.instances[node]?.kind === 'resource' && (s.state.nodes[node]?.readyAt ?? 0) <= s.tick);
}

/** The last frame of a step: the tile is the player's, and the kernel hears of it. A hazard there may hurt, and a fall moves the player to town. */
export function landStep(s: GameSession, to: Tile, gait: Gait = 'walk'): void {
  s.pos = [to[0], to[1]];
  s.report(s.pos, false, gait);
}

/** Art pixels per tile: the body's place is kept on the art's own grid (DECISIONS 2026-10-18, 64 px per tile). */
export const ART_PX = 64;
/** The body box at the feet, in art pixels and centred on the feet's centre: what meets a tile the walk refuses. */
export const BODY_BOX = { w: 28, h: 16 } as const;
/** The facing turns to the other axis only once the motion leads on it by this much, so a walk near 45 degrees does not flicker. */
export const TURN_LEAD = 1.25;
/** The longest piece a frame's motion is walked in, in art pixels: no wall is jumped, and a tile is entered one at a time. */
const PIECE = 8;

/** The facing for a held direction: the axis the motion leads on, kept until the other one leads by `TURN_LEAD`. */
export function facingFor(input: readonly [number, number], current: Dir): Dir {
  const [x, y] = input;
  if (x === 0 && y === 0) return current;
  const [cx, cy] = DIRS[current];
  const along = x * cx + y * cy;
  const across = Math.abs(cx !== 0 ? y : x);
  if (along > 0 && along * TURN_LEAD >= across) return current;
  if (Math.abs(x) >= Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

/** The tile an action reaches: the one beside the feet's tile, the way the player faces. */
export function facedTile(s: Pick<GameSession, 'pos' | 'facing'>): [number, number] {
  const [fx, fy] = DIRS[s.facing];
  return [s.pos[0] + fx, s.pos[1] + fy];
}

/**
 * Whether the body's box may cross from the tile `from` into the tile (x, y), the two four-adjacent: a tile the walk refuses is a wall, and a
 * rock face between levels is one too, except across a crossing (`canEnter`, G68). The box asks once for each row or column of tiles it spans.
 */
export type Open = (x: number, y: number, from: readonly [number, number]) => boolean;

/**
 * The body walking freely over a world of tiles (NEXT 22 a): its feet at art-pixel precision, a velocity from
 * the held input at one tile per `walk_step_ms` whatever the angle, and a box at the feet that never overlaps a
 * tile the walk refuses or crosses a face it does not. The x and y of each piece are resolved apart, so the body slides along a wall; a box
 * has width, so it never cuts the corner between two refused tiles. The tile under the feet's centre is the
 * player's, and every tile the centre enters is told in order, each beside the one before (G56).
 */
export class Walker {
  /** the feet's centre, in art pixels */
  x = ART_PX / 2;
  y = ART_PX / 2;
  /** art pixels walked since the body was placed: the stride moves one leg per tile */
  walked = 0;
  /** whether the body moved in the last frame; standing still is a frame with no motion */
  moving = false;

  /** Stand in the middle of a tile. */
  place(tile: readonly [number, number]): void {
    this.x = tile[0] * ART_PX + ART_PX / 2;
    this.y = tile[1] * ART_PX + ART_PX / 2;
    this.moving = false;
  }

  /** The tile under the feet's centre. */
  tile(): [number, number] {
    return [Math.floor(this.x / ART_PX), Math.floor(this.y / ART_PX)];
  }

  /** The session moved the player elsewhere (a load, a fall, the server's tile taken back): the body stands there. True when it moved. */
  follow(pos: readonly [number, number]): boolean {
    const [tx, ty] = this.tile();
    if (tx === pos[0] && ty === pos[1]) return false;
    this.place(pos);
    return true;
  }

  /**
   * One frame of walking. `input` is the held direction (a length of 1 is full speed, more is cut to 1), `ms` the
   * frame, `stepMs` the time a tile takes at full speed, `open` the tiles the body may cross into. Returns the tiles
   * the feet's centre entered, in order.
   */
  frame(input: readonly [number, number], ms: number, stepMs: number, open: Open): [number, number][] {
    const entered: [number, number][] = [];
    const length = Math.hypot(input[0], input[1]);
    const x0 = this.x;
    const y0 = this.y;
    if (length > 0 && ms > 0) {
      // a frame longer than a tile takes (a slow machine, a tab coming back) walks one tile at most: a single
      // frame never carries the body through a tile, so the tile under the feet is a place a hand can stop on
      const reach = Math.min(ART_PX, (Math.min(1, length) * ART_PX * ms) / stepMs);
      const dx = (input[0] / length) * reach;
      const dy = (input[1] / length) * reach;
      const pieces = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / PIECE));
      let at = this.tile();
      const note = () => {
        const now = this.tile();
        if (now[0] === at[0] && now[1] === at[1]) return;
        at = now;
        entered.push(now);
      };
      for (let i = 0; i < pieces; i++) {
        const mx = dx / pieces;
        const my = dy / pieces;
        const gotX = this.slide(0, mx, open);
        note();
        const gotY = this.slide(1, my, open);
        note();
        // a straight walk that meets a corner is eased onto its lane, when the lane goes on
        if (my === 0 && gotX !== mx) this.toLane(1, Math.abs(mx - gotX), Math.sign(mx), open);
        if (mx === 0 && gotY !== my) this.toLane(0, Math.abs(my - gotY), Math.sign(my), open);
      }
    }
    const walked = Math.hypot(this.x - x0, this.y - y0);
    this.walked += walked;
    this.moving = walked > 0;
    return entered;
  }

  /** Move along one axis (0 is x) as far as the box may go, up to `d` art pixels. Returns how far it went. */
  private slide(axis: 0 | 1, d: number, open: Open): number {
    if (d === 0) return 0;
    const half = axis === 0 ? BODY_BOX.w / 2 : BODY_BOX.h / 2;
    const across = axis === 0 ? BODY_BOX.h / 2 : BODY_BOX.w / 2;
    const pos = axis === 0 ? this.x : this.y;
    const other = axis === 0 ? this.y : this.x;
    // a face is met on its own edge (G68): a line is entered from the one behind it, each of its tiles from the tile beside it in the line left,
    // and the tiles of the line lie side by side across the box, each from the one before it. Every pair is four-adjacent, whatever the frame's
    // length, so the box never crosses a refused edge and never straddles one
    const behind = d > 0 ? -1 : 1;
    const isOpen = (along: number, side: number) => (axis === 0 ? open(along, side, [along + behind, side]) : open(side, along, [side, along + behind]));
    const meets = (along: number, side: number) => (axis === 0 ? open(along, side, [along, side - 1]) : open(side, along, [side - 1, along]));
    // the lines of tiles the box spans across the motion
    const first = Math.floor((other - across) / ART_PX);
    const last = Math.ceil((other + across) / ART_PX) - 1;
    const blocked = (line: number) => {
      for (let side = first; side <= last; side++) if (!isOpen(line, side) || (side > first && !meets(line, side))) return true;
      return false;
    };
    let to = pos + d;
    if (d > 0) {
      // only the lines the leading edge enters now: a tile already overlapped never holds the body
      const from = Math.ceil((pos + half) / ART_PX) - 1;
      const reach = Math.ceil((to + half) / ART_PX) - 1;
      for (let line = from + 1; line <= reach; line++) {
        if (blocked(line)) {
          to = line * ART_PX - half;
          break;
        }
      }
    } else {
      const from = Math.floor((pos - half) / ART_PX);
      const reach = Math.floor((to - half) / ART_PX);
      for (let line = from - 1; line >= reach; line--) {
        if (blocked(line)) {
          to = (line + 1) * ART_PX + half;
          break;
        }
      }
    }
    // a box already against the wall stays where it is
    if ((d > 0 && to < pos) || (d < 0 && to > pos)) to = pos;
    if (axis === 0) this.x = to;
    else this.y = to;
    return to - pos;
  }

  /**
   * Ease the body across `axis` toward the middle of the line of tiles its feet stand in, by up to `budget` art
   * pixels, when the tile ahead in that line (the way `ahead` points along the other axis) is open.
   */
  private toLane(axis: 0 | 1, budget: number, ahead: number, open: Open): void {
    const [tx, ty] = this.tile();
    const next = axis === 1 ? open(tx + ahead, ty, [tx, ty]) : open(tx, ty + ahead, [tx, ty]);
    if (!next) return;
    const pos = axis === 0 ? this.x : this.y;
    const middle = (axis === 0 ? tx : ty) * ART_PX + ART_PX / 2;
    const step = Math.sign(middle - pos) * Math.min(budget, Math.abs(middle - pos));
    if (step === 0) return;
    this.slide(axis, step, open);
  }
}

/**
 * The kernel strikes only on a move report. When moving eyes first acquire a player who is standing
 * still, that tile is reported once; a hunt then owns the reports until it ends, and while it runs a
 * player standing still is reported again twice a second, so its bites land on time.
 */
export class StandingReports {
  /** whether each walking predator saw the standing tile last frame, for a single report on the false-to-true edge */
  private readonly saw = new Map<string, boolean>();
  private sightTick = -1;
  /** the tick of the last report while a hunt runs */
  private chaseTick = 0;

  /** A new session is bound: no predator has seen it yet. */
  reset(): void {
    this.saw.clear();
    this.sightTick = -1;
  }

  /**
   * One frame, after the walk. `hazards` are the predators to watch with (those without a round are
   * skipped), `still` is true when no step and no fall is under way, `blocked` when a menu holds the world.
   */
  frame(b: Bundle, s: GameSession, hazards: Iterable<{ rule?: Hazard }>, still: boolean, blocked: boolean): void {
    for (const { rule } of hazards) {
      if (!rule?.round) continue;
      const watched = windowOpen(b, rule, s.tick) && sees(b, rule, s.tick, s.pos);
      const before = this.saw.get(rule.id) ?? false;
      const held = blocked || !still || s.state.player.chase !== null;
      if (watched && !before && !held && this.sightTick !== s.tick) {
        this.sightTick = s.tick;
        s.report(s.pos, true);
        // If that report began a chase, its standing-bite cadence starts on
        // the next tick change rather than reporting this same tick twice.
        this.chaseTick = s.tick;
      }
      // A blocked UI does not consume the edge: closing it while still seen
      // must let the predator notice the standing player.
      this.saw.set(rule.id, held && s.state.player.chase === null ? false : watched);
    }
    // a hunt bites by the clock: while one runs, a player standing still reports again twice a second
    if (s.state.player.chase && still && s.tick - this.chaseTick >= 500) {
      this.chaseTick = s.tick;
      s.report(s.pos, true);
    }
  }
}

/**
 * The eight facings a drawn body can show (the rig of 23.10): the four axes and the four diagonals between
 * them. The faced tile stays four-way (`facingFor`, `facedTile`); this is only what the body is drawn as.
 */
export type Facing8 = Dir | 'down_left' | 'down_right' | 'up_left' | 'up_right';

/** The eight facings by angle, clockwise from the right in steps of 45 degrees (y grows down the screen). */
const EIGHT: readonly Facing8[] = ['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'];

/**
 * How far past a sector's edge the motion leads before the drawn facing turns, in degrees: the four-way pick's
 * own lead (`TURN_LEAD`, 51.3 degrees off the axis against an edge at 45), so both picks hold alike.
 */
export const SECTOR_LEAD_DEG = (Math.atan(TURN_LEAD) * 180) / Math.PI - 45;

/**
 * The drawn facing for a held direction: the nearest of the eight to the motion's angle (sectors of 45
 * degrees), kept while the motion stays inside its sector widened by `SECTOR_LEAD_DEG`, so a walk along a
 * sector's edge does not flicker. No motion keeps the facing it had.
 */
export function facing8For(input: readonly [number, number], current: Facing8): Facing8 {
  const [x, y] = input;
  if (x === 0 && y === 0) return current;
  const deg = (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360;
  const held = EIGHT.indexOf(current) * 45;
  const off = Math.abs(((deg - held + 540) % 360) - 180);
  if (off <= 22.5 + SECTOR_LEAD_DEG) return current;
  return EIGHT[Math.round(deg / 45) % 8]!;
}

/** Whether a drawn facing agrees with the four-way facing: the same axis, or a diagonal that leans on it. */
export function agrees(look: Facing8, facing: Dir): boolean {
  return look === facing || look.split('_').includes(facing);
}

/**
 * The diagonal sheet a body is drawn from, and whether it is mirrored, or undefined to draw the four-way
 * facing as before. The rig draws five facings (down, down_left, left, up_left, up) and mirrors the right
 * side; a sheet is named after the look's down sheet with the facing in place of `down`
 * (`chars/forager_down_left`). A diagonal that does not lean on the four-way facing, or whose sheet the look
 * does not have yet, is not drawn.
 */
export function diagonalSheet(stem: string, look: Facing8, facing: Dir, has: (key: string) => boolean): { key: string; flip: boolean } | undefined {
  if (!look.includes('_') || !agrees(look, facing)) return undefined;
  const mirrored = look.endsWith('_right');
  const key = stem.replace(/_down$/, `_${mirrored ? look.replace(/_right$/, '_left') : look}`);
  return key !== stem && has(key) ? { key, flip: mirrored } : undefined;
}
