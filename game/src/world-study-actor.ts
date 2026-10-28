import type * as Phaser from 'phaser';
import type { Dir } from './input';
import { facingFor } from './walking';
import provenance from '../../docs/design/frames/rich-world-character-2026-10-28/provenance.json';

const urls = {
  down: new URL('../../docs/design/frames/rich-world-character-2026-10-28/human_down.png', import.meta.url).href,
  up: new URL('../../docs/design/frames/rich-world-character-2026-10-28/human_up.png', import.meta.url).href,
  left: new URL('../../docs/design/frames/rich-world-character-2026-10-28/human_left.png', import.meta.url).href,
};
type Sheet = keyof typeof urls;
const key = (sheet: Sheet) => `world-study-human-${sheet}`;

export function preloadWorldStudyActor(scene: Phaser.Scene): void {
  for (const sheet of Object.keys(urls) as Sheet[]) {
    scene.load.spritesheet(key(sheet), urls[sheet], {
      frameWidth: provenance.frame.width, frameHeight: provenance.frame.height,
    });
  }
}

export interface WorldStudyActorPose {
  sheet: Sheet;
  frame: number;
  flipX: boolean;
}

/** Distance is actual movement after collision, in this fixture's art-pixel world units. */
export class WorldStudyActorMotion {
  private facing: Dir = 'down';
  private walked = 0;

  advance(dx: number, dy: number): WorldStudyActorPose {
    const distance = Math.hypot(dx, dy);
    const moving = distance > 0;
    if (moving) {
      this.walked += distance;
      this.facing = facingFor([dx, dy], this.facing);
    }
    const sheet = this.facing === 'right' ? 'left' : this.facing;
    const info = provenance.sheets[sheet];
    // Same nearest-pose rule as feat/races-in-game work.ts:poseFrame, at the recorded source commit.
    const frame = moving
      ? Math.floor(this.walked / (info.travelMpx / 1000) + .5) % (info.frames - 1)
      : info.frames - 1;
    return { sheet, frame, flipX: this.facing === 'right' };
  }

  /** A review shortcut relocates the body; it never becomes a walked stride. */
  reset(): WorldStudyActorPose {
    this.facing = 'down';
    this.walked = 0;
    return this.advance(0, 0);
  }
}

/** Reuse reviewed 50-degree output at its native art size, with the authored ground anchor. */
export function createWorldStudyActor(scene: Phaser.Scene, x: number, y: number) {
  const motion = new WorldStudyActorMotion();
  const sprite = scene.add.sprite(x, y, key('down'), provenance.sheets.down.frames - 1)
    .setOrigin(provenance.frame.anchor[0]! / provenance.frame.width, provenance.frame.anchor[1]! / provenance.frame.height)
    .setScale(provenance.frame.scale).setDepth(y);
  const apply = (pose: WorldStudyActorPose) => {
    sprite.setTexture(key(pose.sheet), pose.frame).setFlipX(pose.flipX).setDepth(sprite.y);
  };
  return {
    sprite,
    advance(dx: number, dy: number) { apply(motion.advance(dx, dy)); },
    reset() { apply(motion.reset()); },
  };
}
