/**
 * The senses (DECISIONS.md, 2026-10-10: the starts): a find picked up by hand
 * lies half-buried in a soft glow, and while it shows a drifting line of
 * glints runs from the character's feet to it, as if the senses led the way.
 * The world scene fades the find in and out like any dig spot; the glow and
 * the trail follow it. With the motion group off the glints stand still.
 */
import * as Phaser from 'phaser';

/** The colours of the chosen stills: a warm gold glow, near-white glints. */
const GOLD = 0xffe28c;
const WHITE = 0xfffae6;
/** Glints on the trail. */
const GLINTS = 9;
/** How far the trail sways from the straight line, in pixels. */
const SWAY = 6;
/** One glint's walk from the feet to the find, in ms. */
const DRIFT_MS = 2400;
/** The find shows its head only: the rest stays in the ground. */
const SHOWN = 0.7;
/** A find this faint has no trail. */
const SHOWS = 0.2;

export function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('senses-glow')) return;
  const g = scene.add.graphics();
  // a soft ellipse, 31x19, brighter toward the middle
  for (let k = 15; k > 0; k--) g.fillStyle(GOLD, 0.75 * (1 - k / 16) ** 1.6 * 0.35).fillEllipse(15.5, 9.5, 2 * k, 1.2 * k);
  g.generateTexture('senses-glow', 31, 19);
  g.clear();
  // a glint, 5x5: a bright middle and four arms that fade
  g.fillStyle(WHITE, 1).fillRect(2, 2, 1, 1);
  g.fillStyle(WHITE, 0.8).fillRect(1, 2, 1, 1).fillRect(3, 2, 1, 1).fillRect(2, 1, 1, 1).fillRect(2, 3, 1, 1);
  g.fillStyle(WHITE, 0.35).fillRect(0, 2, 1, 1).fillRect(4, 2, 1, 1).fillRect(2, 0, 1, 1).fillRect(2, 4, 1, 1);
  g.generateTexture('senses-glint', 5, 5);
  g.destroy();
}

export class SensesFind {
  /** The find itself: the world scene sets its alpha as it does a dig spot's. */
  readonly find: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly glints: Phaser.GameObjects.Image[];
  private clock = 0;

  /**
   * @param x the find's centre in world pixels, bottom the bottom of its tile
   * @param sprite the found item's sprite
   * @param depth the dig spots' depth: the find lies on the ground
   * @param feet where the character stands, in world pixels
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    bottom: number,
    sprite: string,
    depth: number,
    private readonly feet: () => { x: number; y: number },
    private readonly motion: boolean,
  ) {
    makeTextures(scene);
    const y = bottom - 8;
    this.glow = scene.add.image(x, y, 'senses-glow').setDepth(depth).setAlpha(0);
    this.find = scene.add.image(x, y, sprite).setAngle(35).setDepth(depth + 0.1).setAlpha(0);
    this.find.setCrop(0, 0, this.find.width, Math.round(this.find.height * SHOWN));
    this.glints = Array.from({ length: GLINTS }, () => scene.add.image(x, y, 'senses-glint').setDepth(depth + 0.2).setAlpha(0));
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this));
  }

  private update(_time: number, delta: number): void {
    const shown = this.find.alpha;
    this.glow.setAlpha(shown);
    if (shown < SHOWS) {
      for (const glint of this.glints) glint.setAlpha(0);
      return;
    }
    if (this.motion) this.clock = (this.clock + delta) % DRIFT_MS;
    const { x: fx, y: fy } = this.feet();
    const tx = this.find.x;
    const ty = this.find.y;
    this.glints.forEach((glint, i) => {
      // each glint walks from the feet to the find and starts again; standing still, they are the chosen drawing
      const t = ((i + 1) / (GLINTS + 1) + this.clock / DRIFT_MS) % 1;
      const along = Math.sin(t * Math.PI * 2) * SWAY;
      glint
        .setPosition(Math.round(fx + (tx - fx) * t + along), Math.round(fy - 2 + (ty - fy + 2) * t))
        .setScale(i % 2 === 0 ? 0.8 : 1)
        .setAlpha(shown * (0.6 + 0.4 * t) * Math.min(1, t * 6, (1 - t) * 6));
    });
  }
}
