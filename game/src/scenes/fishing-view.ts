/**
 * Fishing in the 2D world, drawn in code with the world's palette (DECISIONS.md, 2026-10-25: fishing): dark fish
 * shapes under each spot that has fish, and, while a cast is on, a rod in the player's hand, an elastic line and a
 * red and white float. The minigame says which state the cast is in; fishing.ts says where everything is.
 */
import Phaser from 'phaser';
import { FISH_LOST_MS, FISH_REEL_MS, type Pt, floatAt, linePoints, sagAt, silhouettes } from '../fishing';
import type { FishPhase } from '../ui/games/shared';

export interface FishingColours {
  ink: number;
  paper: number;
  red: number;
  wood: number;
}

interface Cast {
  node: string;
  phase: FishPhase;
  since: number;
  /** a ring spreads from the float from this time */
  ringAt: number;
}

/** Fish shapes sit just over the water; the line and float over every figure. */
export class FishingView {
  private readonly under: Phaser.GameObjects.Graphics;
  private readonly over: Phaser.GameObjects.Graphics;
  private cast: Cast | null = null;

  constructor(
    scene: Phaser.Scene,
    depths: { under: number; over: number },
    private readonly colours: FishingColours,
  ) {
    this.under = scene.add.graphics().setDepth(depths.under);
    this.over = scene.add.graphics().setDepth(depths.over);
  }

  /** The minigame moved on: a new state starts its own clock. */
  phase(node: string, phase: FishPhase, now: number): void {
    const ring = phase === 'bite' || (this.cast?.phase === 'cast' && phase === 'wait');
    this.cast = { node, phase, since: now, ringAt: ring ? now : (this.cast?.ringAt ?? -1e9) };
  }

  /** Whether a cast is on now. */
  get casting(): boolean {
    return this.cast !== null;
  }

  /**
   * One frame. `spots` are the fishing spots in view that have fish, with their centre in px; `rod` is where the
   * rod leaves the hand and `toward` is +1 or -1 for the side the player faces.
   */
  draw(now: number, spots: readonly { id: string; at: Pt }[], hand: Pt, toward: number): void {
    const c = this.colours;
    const cast = this.cast;
    if (cast) {
      const ms = now - cast.since;
      if ((cast.phase === 'reel' && ms > FISH_REEL_MS) || (cast.phase === 'lost' && ms > FISH_LOST_MS)) this.cast = null;
    }
    const live = this.cast;
    const tip = { x: hand.x + toward * 9, y: hand.y - 11 };
    let float: ReturnType<typeof floatAt> | undefined;
    let spotAt: Pt | undefined;
    if (live) {
      spotAt = spots.find((s) => s.id === live.node)?.at;
      if (spotAt) float = floatAt(live.phase, now - live.since, tip, spotAt);
    }

    this.under.clear();
    spots.forEach((spot, n) => {
      const hooked = live && spot.id === live.node && (live.phase === 'bite' || live.phase === 'reel') ? float : undefined;
      for (const f of silhouettes(now, spot.at, 2, n + spot.id.length, hooked)) {
        // a body and a forked tail, pointing the way it swims: dark under the surface, never a sprite
        const hx = Math.cos(f.heading);
        const hy = Math.sin(f.heading);
        this.under.fillStyle(c.ink, 0.38);
        this.under.fillEllipse(f.x, f.y, 6 * Math.abs(hx) + 2.5 * Math.abs(hy), 2.5 * Math.abs(hx) + 5 * Math.abs(hy));
        const tx = f.x - hx * 3.5;
        const ty = f.y - hy * 3.5;
        this.under.fillTriangle(tx, ty, tx - hx * 2 - hy * 1.6, ty - hy * 2 + hx * 1.6, tx - hx * 2 + hy * 1.6, ty - hy * 2 - hx * 1.6);
      }
    });

    this.over.clear();
    if (!live || !float) return;
    // the rod: a short stick of wood held out over the water
    this.over.lineStyle(1, c.wood, 1).lineBetween(hand.x, hand.y, tip.x, tip.y);
    const sag = sagAt(live.phase, now - live.since);
    const pts = linePoints(tip, float, sag);
    this.over.lineStyle(1, c.ink, 0.85).beginPath();
    this.over.moveTo(pts[0]!.x, pts[0]!.y);
    for (const p of pts.slice(1)) this.over.lineTo(p.x, p.y);
    this.over.strokePath();
    // a ring spreads where the float lands and where the fish takes it
    const ringMs = now - live.ringAt;
    if (spotAt && ringMs >= 0 && ringMs < 600) {
      const k = ringMs / 600;
      this.over.lineStyle(1, c.paper, 0.8 * (1 - k)).strokeEllipse(spotAt.x, spotAt.y + 2, 4 + 10 * k, 2 + 4 * k);
    }
    // the float: red over white, half of it gone under on the bite
    const r = 2;
    this.over.fillStyle(c.paper, 1).fillCircle(float.x, float.y, r * (1 - 0.4 * float.dip));
    if (float.dip < 0.9) this.over.fillStyle(c.red, 1).fillRect(float.x - r, float.y - r, r * 2, r * (1 - float.dip));
  }
}
