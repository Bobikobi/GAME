import type * as Phaser from 'phaser';
import { WorldStudyFootsteps, footprintAlpha, type FootstepBody } from './world-study-footsteps';

const url = new URL('../../docs/design/frames/rich-world-footprints-2026-10-29/footprint.png', import.meta.url).href;
const key = 'world-study-footprint';

export function preloadWorldStudyFootprints(scene: Phaser.Scene): void {
  scene.load.image(key, url);
}

export function createWorldStudyFootprints(scene: Phaser.Scene, isSand: (x: number, y: number) => boolean) {
  const trail = new WorldStudyFootsteps(isSand);
  const images = new Map<number, Phaser.GameObjects.Image>();
  let visible = true;
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    for (const image of images.values()) image.destroy();
    images.clear();
    trail.marks.length = 0;
  };
  scene.events.once('shutdown', destroy);
  return {
    trail,
    advance(now: number, body: FootstepBody) {
      if (destroyed) return;
      const marks = trail.advance(now, body);
      const active = new Set(marks.map(mark => mark.id));
      for (const [id, image] of images) if (!active.has(id)) { image.destroy(); images.delete(id); }
      for (const mark of marks) {
        let image = images.get(mark.id);
        if (!image) {
          image = scene.add.image(mark.x, mark.y, key).setOrigin(.5, .3).setDepth(2.25)
            .setRotation(mark.angle).setFlipX(mark.flipX);
          images.set(mark.id, image);
        }
        image.setAlpha(footprintAlpha(now - mark.born)).setVisible(visible);
      }
    },
    relocate() { trail.relocate(); },
    setVisible(enabled: boolean) { visible = enabled; for (const image of images.values()) image.setVisible(enabled); },
    get stats() { return { marks: trail.marks.length, images: images.size, visible }; },
    destroy,
  };
}
