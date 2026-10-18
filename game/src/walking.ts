/**
 * The walk's rules with nothing drawn: which tile a step may enter, what a step that lands tells the
 * kernel, and what a player standing still owes it while a predator watches or a hunt runs (P-5b).
 * The 2D scene and the 3D door both walk by them. Pure apart from the Session it is handed, so the walk
 * can be played on the real map without a renderer (game/test/stealth-flow.test.ts).
 */
import { type Bundle, type Hazard, type Tile, type makeWalkable, sees, windowOpen } from '@game/kernel';

import type { Session } from './session';

type Walkable = ReturnType<typeof makeWalkable>;

/** The kernel's rule, and a plant or stone that is ready stands in the way. `nodeAt` holds each node and find by its tile, `x,y`. */
export function canEnter(b: Bundle, walkable: Walkable, nodeAt: ReadonlyMap<string, string>, s: Session, x: number, y: number): boolean {
  if (!walkable(x, y, s.state.player)) return false;
  const node = nodeAt.get(`${x},${y}`);
  return !(node && b.instances[node]?.kind === 'resource' && (s.state.nodes[node]?.readyAt ?? 0) <= s.tick);
}

/** The last frame of a step: the tile is the player's, and the kernel hears of it. A hazard there may hurt, and a fall moves the player to town. */
export function landStep(s: Session, to: Tile): void {
  s.pos = [to[0], to[1]];
  s.report(s.pos);
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
  frame(b: Bundle, s: Session, hazards: Iterable<{ rule?: Hazard }>, still: boolean, blocked: boolean): void {
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
