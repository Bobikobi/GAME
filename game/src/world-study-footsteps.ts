import type { StudyFoot } from './world-study-contact';

export const FOOTPRINT_LIFE_MS = 20_000;
export const FOOTPRINT_LIMIT = 64;
export const FOOTPRINT_ALPHA = [.8, .6, .4, .2] as const;
export interface StepFoot extends StudyFoot { foot: string }
export interface FootstepBody {
  x: number; y: number; dx: number; dy: number; mirrored: boolean;
  feet: readonly StepFoot[];
}
export interface StudyFootprint {
  id: number; x: number; y: number; angle: number; flipX: boolean; born: number;
}

/** Four fixed opacity levels, with removal at twenty active scene seconds. */
export function footprintAlpha(age: number): number {
  if (age >= FOOTPRINT_LIFE_MS) return 0;
  return FOOTPRINT_ALPHA[Math.max(0, Math.floor(age / (FOOTPRINT_LIFE_MS / 4)))]!;
}

/** A bounded trail made by real supporting-foot transitions, not elapsed timers. */
export class WorldStudyFootsteps {
  readonly marks: StudyFootprint[] = [];
  private previous = new Map<string, boolean>();
  private lastStamp = new Map<string, { x: number; y: number }>();
  private moving = false;
  private serial = 0;

  constructor(private readonly isSand: (x: number, y: number) => boolean) {}

  /** Review shortcuts relocate the body without a step or a connecting trail. */
  relocate(): void {
    this.previous.clear();
    this.lastStamp.clear();
    this.moving = false;
  }

  advance(now: number, body: FootstepBody): readonly StudyFootprint[] {
    while (this.marks.length && now - this.marks[0]!.born >= FOOTPRINT_LIFE_MS) this.marks.shift();
    const moving = Math.hypot(body.dx, body.dy) > .0001;
    if (moving) for (const foot of body.feet) {
      if (!foot.support || (this.moving && this.previous.get(foot.foot))) continue;
      const x = Math.round(body.x + foot.x), y = Math.round(body.y + foot.y);
      const last = this.lastStamp.get(foot.foot);
      if (last && Math.hypot(x - last.x, y - last.y) < 4) continue;
      // The drawing's toe faces up. Match the eight rendered body headings.
      const angle = Math.round(Math.atan2(body.dy, body.dx) / (Math.PI / 4)) * Math.PI / 4 + Math.PI / 2;
      const c = Math.cos(angle), s = Math.sin(angle);
      // Keep the entire 8x12 stamp inside sand, including rounded transition edges.
      const inside = [[0, 0], [-4, -3.6], [4, -3.6], [-4, 8.4], [4, 8.4]].every(([px, py]) => this.isSand(x + px! * c - py! * s, y + px! * s + py! * c));
      if (!inside) continue;
      this.marks.push({ id: ++this.serial, x, y, angle, flipX: (foot.foot === 'Right') !== body.mirrored, born: now });
      this.lastStamp.set(foot.foot, { x, y });
      if (this.marks.length > FOOTPRINT_LIMIT) this.marks.shift();
    }
    this.previous = new Map(body.feet.map(foot => [foot.foot, foot.support]));
    this.moving = moving;
    return this.marks;
  }
}
