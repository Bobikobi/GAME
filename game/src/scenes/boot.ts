/** Loads every sprite the bundle names, then hands over to the world. */
import * as Phaser from 'phaser';
import { app } from '../app';
import { bootSprites, type ClipSprites } from '../clips';
import { CHIMNEY_SMOKE, DRIFT_TEXTURE, driftOn } from '../drift';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.on('progress', (v: number) => app.ui.loading(v));
    this.load.on('loaderror', (file: { key: string }) => console.warn(`could not load sprite ${file.key}`));
    // the clips' sheets wait: the world loads the ones of the player's race (clips.ts `raceClips`)
    for (const [ref, info] of bootSprites(app.bundle.sprites as ClipSprites)) {
      if (info.frames > 1) this.load.spritesheet(ref, info.url, { frameWidth: info.w, frameHeight: info.h });
      else this.load.image(ref, info.url);
    }
    // the driver's sheet, only when `?drift=sheet` asks for it; a missing file leaves the kit's own smoke (world.ts checks the texture)
    if (driftOn(window.location.search)) this.load.spritesheet(DRIFT_TEXTURE, CHIMNEY_SMOKE.sheet.url, { frameWidth: CHIMNEY_SMOKE.sheet.cell[0], frameHeight: CHIMNEY_SMOKE.sheet.cell[1] });
  }

  create(): void {
    this.scene.start('world');
  }
}
