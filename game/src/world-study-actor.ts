import type * as Phaser from 'phaser';
import { WorldStudyGait, type GaitPose } from './world-study-gait';
import provenance from '../../docs/design/frames/rich-world-motion-2026-10-29/walk-metadata.json';

const urls = {
  down: new URL('../../docs/design/frames/rich-world-motion-2026-10-29/human-down.png', import.meta.url).href,
  up: new URL('../../docs/design/frames/rich-world-motion-2026-10-29/human-up.png', import.meta.url).href,
  left: new URL('../../docs/design/frames/rich-world-motion-2026-10-29/human-left.png', import.meta.url).href,
  'down-left': new URL('../../docs/design/frames/rich-world-motion-2026-10-29/human-down-left.png', import.meta.url).href,
  'up-left': new URL('../../docs/design/frames/rich-world-motion-2026-10-29/human-up-left.png', import.meta.url).href,
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

export class WorldStudyActorMotion extends WorldStudyGait {
  constructor() { super(provenance.sheets); }
}

/** Reuse reviewed 50-degree output at its native art size, with the authored ground anchor. */
export function createWorldStudyActor(scene: Phaser.Scene, x: number, y: number) {
  const motion = new WorldStudyActorMotion();
  const sprite = scene.add.sprite(x, y, key('down'), provenance.sheets.down.frames - 1)
    .setOrigin(provenance.frame.anchor[0]! / provenance.frame.width, provenance.frame.anchor[1]! / provenance.frame.height)
    .setScale(provenance.frame.scale).setDepth(y);
  let pose = motion.reset();
  const apply = (next: GaitPose) => {
    pose = next;
    sprite.setTexture(key(pose.sheet), pose.frame).setFlipX(pose.flipX).setDepth(sprite.y);
  };
  return {
    sprite,
    advance(dx: number, dy: number) { apply(motion.advance(dx, dy)); },
    reset() { apply(motion.reset()); },
    contacts() {
      return provenance.sheets[pose.sheet].feet[pose.frame]!.map(foot => ({ ...foot, x: pose.flipX ? -foot.x : foot.x }));
    },
  };
}
