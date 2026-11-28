/**
 * The walk's rules with nothing drawn: how the body moves between tiles (NEXT 22), which tile it may enter,
 * what a tile it lands on tells the kernel, and what a player standing still owes it while a predator watches
 * or a hunt runs (P-5b). The 2D scene and the 3D door both walk by them. Pure apart from the GameSession it is handed, so the walk
 * can be played on the real map without a renderer (game/test/stealth-flow.test.ts).
 */
import { type Bundle, type Gait, type Hazard, type PublicState, type Tile, type makeWalkable, jumpRule, sees, setComplete, setPieces, stepRuleFor, windowOpen } from '@game/kernel';

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
  return !nodeStands(b, nodeAt, s, x, y);
}

/** Whether a plant or stone that is ready stands on the tile: the body does not enter it, walking or landing. */
function nodeStands(b: Bundle, nodeAt: ReadonlyMap<string, string>, s: Pick<GameSession, 'tick' | 'state'>, x: number, y: number): boolean {
  const node = nodeAt.get(`${x},${y}`);
  return !!node && b.instances[node]?.kind === 'resource' && (s.state.nodes[node]?.readyAt ?? 0) <= s.tick;
}

/** The eight ways a throw can go, by the drawn facing: the four axes and the four diagonals between them. */
const THROW_DIR: Readonly<Record<Facing8, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  up_left: [-1, -1],
  up_right: [1, -1],
  down_left: [-1, 1],
  down_right: [1, 1],
};

/** How far the aim tile of a throw is set from the feet: past any throw's reach, so the kernel's range and the ground decide where it lands. */
export const THROW_AIM_TILES = 8;

/** The way a figure drawn facing `look` throws: a step along an axis or a diagonal. */
export function throwDir(look: Facing8): readonly [number, number] {
  return THROW_DIR[look];
}

/**
 * The tile a throw is aimed at (DECISIONS 2026-11-22, loose stones, #831): out from the feet the way the figure is drawn facing,
 * along an axis or a diagonal, as far as the map reaches (at most `THROW_AIM_TILES`). The kernel clips the flight to the size's range;
 * the charged throw will move this tile's distance (the action's `power`), not its direction. Undefined at the map's edge, facing out.
 */
export function throwAim(b: Bundle, s: Pick<GameSession, 'pos' | 'facing'>, look?: Facing8): Tile | undefined {
  const [dx, dy] = THROW_DIR[look ?? s.facing];
  let last: Tile | undefined;
  for (let n = 1; n <= THROW_AIM_TILES; n++) {
    const x = s.pos[0] + dx * n;
    const y = s.pos[1] + dy * n;
    if (x < 0 || y < 0 || x >= b.map.width || y >= b.map.height) break;
    last = [x, y];
  }
  return last;
}

/**
 * The tile the jump key aims at (DECISIONS 2026-11-22, the jump and the fall): ahead, the way the player faces, one tile if a
 * foot can stand there, else two when the tile between is a gap of water. The line and the heights are the kernel's own
 * `jumpRule` (the very function `step` and G71's walk read), so the client never aims at a landing the kernel refuses by shape;
 * breath, the first minute and the rest are the kernel's to answer. Undefined when there is nothing to land on.
 */
export function jumpTarget(
  b: Bundle,
  walkable: Walkable,
  nodeAt: ReadonlyMap<string, string>,
  s: Pick<GameSession, 'pos' | 'tick' | 'state' | 'facing'>,
): Tile | undefined {
  const rule = jumpRule(b);
  const [dx, dy] = DIRS[s.facing];
  for (const len of [1, 2]) {
    const to: Tile = [s.pos[0] + dx * len, s.pos[1] + dy * len];
    if (!rule([s.pos[0], s.pos[1]], to).ok) continue;
    if (!walkable(to[0], to[1], s.state.player) || nodeStands(b, nodeAt, s, to[0], to[1])) continue;
    return to;
  }
  return undefined;
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

/** A round blocker at art-pixel precision, in the world's art pixels: a tree's trunk foot (a painted land's `feet`). The tiles stay the walk's refusals for walls, cliffs and water; a disc refuses only the ground it covers, so a wood's crowns stay open and the body passes between trunks. */
export interface Disc {
  x: number;
  y: number;
  r: number;
}

/** How far (art px) the figure's drawn feet stand under the body's point: the world draws the sprite's foot half a tile under it (world.ts drawBody, T / 2 world px). */
export const FOOT_DRAWN = ART_PX / 2;

/**
 * A painted land's trunk discs in the world's art px, from its `feet` ([x, y, r] in scene px, at the painted trunk's foot) and the land's tile origin. Each disc is kept where the body's point stands
 * when the drawn feet stand on the trunk's foot, FOOT_DRAWN over it: a disc at the drawn foot itself stopped a walk north half a tile short of the bark and let a walk south tread over the trunk's foot
 * (private #44 H1w, the trunk bars' frames).
 */
export function trunkDiscsOf(feet: readonly (readonly [number, number, number])[], x0: number, y0: number): Disc[] {
  return feet.map(([x, y, r]) => ({ x: x0 * ART_PX + x, y: y0 * ART_PX + y - FOOT_DRAWN, r }));
}

/**
 * Push the body's box (centre `x`, `y`, `BODY_BOX`) out of every disc it overlaps, along the line from the disc's centre to the box's nearest point. Returns the new centre. Pure: the walker and its test both use it.
 */
export function pushOutOfDiscs(x: number, y: number, discs: readonly Disc[]): [number, number] {
  const [px, py] = resolveDiscs(x, y, discs);
  return [px, py];
}

/** The push-out and the first disc that caused it. */
function resolveDiscs(x: number, y: number, discs: readonly Disc[]): [number, number, Disc?] {
  const hw = BODY_BOX.w / 2;
  const hh = BODY_BOX.h / 2;
  let px = x;
  let py = y;
  let hit: Disc | undefined;
  for (const d of discs) {
    if (Math.abs(d.x - px) > hw + d.r || Math.abs(d.y - py) > hh + d.r) continue;
    const nx = Math.min(px + hw, Math.max(px - hw, d.x));
    const ny = Math.min(py + hh, Math.max(py - hh, d.y));
    let vx = nx - d.x;
    let vy = ny - d.y;
    const dist = Math.hypot(vx, vy);
    if (dist >= d.r) continue;
    hit ??= d;
    if (dist === 0) {
      // the disc's centre lies inside the box: leave by the nearer face
      const left = d.x - (px - hw);
      const right = px + hw - d.x;
      const up = d.y - (py - hh);
      const down = py + hh - d.y;
      const least = Math.min(left, right, up, down);
      vx = least === left ? 1 : least === right ? -1 : 0;
      vy = least === up ? 1 : least === down ? -1 : 0;
      if (vx !== 0) px += vx * (least + d.r);
      else py += vy * (least + d.r);
      continue;
    }
    px += (vx / dist) * (d.r - dist);
    py += (vy / dist) * (d.r - dist);
  }
  return [px, py, hit];
}

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
  frame(input: readonly [number, number], ms: number, stepMs: number, open: Open, discs: readonly Disc[] = []): [number, number][] {
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
      const note = (now = this.tile()) => {
        while (now[0] !== at[0] || now[1] !== at[1]) {
          const across = Math.sign(now[0] - at[0]);
          at = across ? [at[0] + across, at[1]] : [at[0], at[1] + Math.sign(now[1] - at[1])];
          entered.push(at);
        }
      };
      for (let i = 0; i < pieces; i++) {
        const mx = dx / pieces;
        const my = dy / pieces;
        const before = discs.length ? ([this.x, this.y] as const) : undefined;
        const gotX = this.slide(0, mx, open);
        const afterX = this.tile();
        const gotY = this.slide(1, my, open);
        const afterY = before ? ([this.x, this.y] as const) : undefined;
        // Report the path taken. A sideways step around a trunk replaces the piece's forward attempt.
        const rounded = before && this.shove(discs, open, before, [mx, my], note);
        if (!rounded) {
          note(afterX);
          const [tx, ty] = this.tile();
          if (afterY && Math.abs(tx - afterX[0]) + Math.abs(ty - afterX[1]) > 1) {
            // The push-out crossed a tile corner. Report the Y step and the checked axes of the correction.
            const { x, y } = this;
            [this.x, this.y] = afterY;
            note();
            const across = this.slideTo(x, y, open, 0) ?? this.slideTo(x, y, open, 1);
            if (across) note(across);
          }
        }
        note();
        if (rounded) continue;
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

  /** Push out of a trunk if the tiles allow it. True if a sideways step replaced the stalled piece. */
  private shove(
    discs: readonly Disc[],
    open: Open,
    before: readonly [number, number],
    [mx, my]: readonly [number, number],
    note: (tile: [number, number]) => void,
  ): boolean {
    const [nx, ny, hit] = resolveDiscs(this.x, this.y, discs);
    if (!hit || (nx === this.x && ny === this.y)) return false;
    const hw = BODY_BOX.w / 2;
    const hh = BODY_BOX.h / 2;
    const x0 = Math.floor((nx - hw) / ART_PX);
    const x1 = Math.floor((nx + hw - 1e-6) / ART_PX);
    const y0 = Math.floor((ny - hh) / ART_PX);
    const y1 = Math.floor((ny + hh - 1e-6) / ART_PX);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (!open(tx, ty, [Math.floor(this.x / ART_PX), Math.floor(this.y / ART_PX)])) return false;
    this.x = nx;
    this.y = ny;

    const reach = Math.hypot(mx, my);
    const moved = Math.hypot(nx - before[0], ny - before[1]);
    // Keep the natural push-out when it already gives the body useful motion, including an oblique slide.
    if (moved >= reach / 4) return false;
    // The perpendicular points clockwise in screen space from the input. On dead centre, take that side.
    const sideX = -my;
    const sideY = mx;
    const offset = (before[0] - hit.x) * sideX + (before[1] - hit.y) * sideY;
    const side = offset < -1e-6 * reach ? -1 : 1;

    // Spend at most the piece's reach from where it began, checking both axes before reporting either. The offset's
    // side first; when a refused tile or another trunk stands there, the other side (a body pressed between two
    // trunks in a grove still has a way round the one ahead: public #919, the load walk at 3,14)
    const [x, y] = before;
    for (const s of [side, -side]) {
      this.x = x;
      this.y = y;
      const across = this.slideTo(x + s * sideX, y + s * sideY, open, 0);
      const [sx, sy] = resolveDiscs(this.x, this.y, discs);
      if (across && Math.hypot(sx - this.x, sy - this.y) <= 1e-6) {
        note(across);
        return true;
      }
    }
    this.x = nx;
    this.y = ny;
    return false;
  }

  /** An all-or-nothing move over checked tile edges. Return the tile reached between the two axes. */
  private slideTo(x: number, y: number, open: Open, first: 0 | 1): [number, number] | undefined {
    const startX = this.x;
    const startY = this.y;
    const step = [x - startX, y - startY] as const;
    const second = first === 0 ? 1 : 0;
    this.slide(first, step[first], open);
    const across = this.tile();
    this.slide(second, step[second], open);
    if (this.x === x && this.y === y) return across;
    this.x = startX;
    this.y = startY;
    return undefined;
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

/**
 * The sheet a worn clothing set is drawn on (public #772): when every piece of a set is worn and the kit holds that set's
 * drawing for this race and view (`chars/human_down` -> `chars/human_reed-walker_down`), the set's sheet; otherwise the
 * stem as it is, the bare figure. Sets are read in id order, so two complete sets always give the same sheet.
 */
/**
 * Whether `?sets=1` asks for the clothing sets drawn whole on the 35-degree figure (default: off). The set sheets are
 * the new figure and the race sheets are still the old art, so in the public game a worn set would swap the look.
 * On when the race art on the 35-degree figure lands.
 */
export function setSheetsOn(query: string): boolean {
  return new URLSearchParams(query).get('sets') === '1';
}

export function wornSetSheet(bundle: Bundle, state: PublicState, stem: string, has: (key: string) => boolean, query: string): string {
  if (!setSheetsOn(query)) return stem;
  for (const id of Object.keys(setPieces(bundle)).sort()) {
    if (!setComplete(bundle, state, id)) continue;
    const key = stem.replace(/_down$/, `_${id.slice(id.indexOf('/') + 1)}_down`);
    if (key !== stem && has(key)) return key;
  }
  return stem;
}
