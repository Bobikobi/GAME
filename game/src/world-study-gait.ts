/** The study's screen-plane movement and the rendered walk share one cycle phase. */
export type WalkView = 'down' | 'up' | 'left' | 'down-left' | 'up-left';
export type WalkFacing = WalkView | 'right' | 'down-right' | 'up-right';
export interface GaitSheet { frames: number; cycleDistanceMpx: number }
export interface GaitPose { sheet: WalkView; frame: number; flipX: boolean; phase: number }

const facings: readonly WalkFacing[] = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];

export class WorldStudyGait {
  private facing: WalkFacing = 'down';
  private phase = 0;

  constructor(private readonly sheets: Record<WalkView, GaitSheet>) {}

  advance(dx: number, dy: number): GaitPose {
    const distance = Math.hypot(dx, dy);
    if (distance > 0) {
      const angle = Math.atan2(dy, dx);
      const currentAngle = facings.indexOf(this.facing) * Math.PI / 4;
      const difference = Math.atan2(Math.sin(angle - currentAngle), Math.cos(angle - currentAngle));
      // A small boundary margin prevents two views flickering under pointer input.
      if (Math.abs(difference) > Math.PI / 8 + .03) this.facing = facings[(Math.round(angle * 4 / Math.PI) + 8) % 8]!;
    }
    const flipX = this.facing.includes('right');
    const sheet = this.facing.replace('right', 'left') as WalkView;
    const info = this.sheets[sheet];
    if (distance > 0) this.phase = (this.phase + distance * 1000 / info.cycleDistanceMpx) % 1;
    const walking = info.frames - 1;
    return { sheet, frame: distance > 0 ? Math.round(this.phase * walking) % walking : walking, flipX, phase: this.phase };
  }

  reset(): GaitPose {
    this.facing = 'down';
    this.phase = 0;
    return this.advance(0, 0);
  }
}
