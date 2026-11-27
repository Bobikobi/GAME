/** Loads every sprite the bundle names, then hands over to the world. */
import * as Phaser from 'phaser';
import { app } from '../app';
import { bootSprites, type ClipSprites } from '../clips';
import { CHIMNEY_SMOKE, DRIFT_TEXTURE, driftOn } from '../drift';
import { EFFECTS, EFFECT_IDS } from '../effects';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    performance.mark('boot:loader');
    // the pictures are the first 60 percent of the bar; the world's build fills the rest (world.ts `drive`)
    this.load.on('progress', (v: number) => app.ui.loading(0.6 * v));
    this.load.on('loaderror', (file: { key: string }) => console.warn(`could not load sprite ${file.key}`));
    const early = app.painted?.early;
    // the clips' sheets wait: the world loads the ones of the player's race (clips.ts `raceClips`)
    for (const [ref, info] of bootSprites(app.bundle.sprites as ClipSprites)) {
      // a painted land's pictures are already on their way (early-fetch.ts): they are added in create
      if (early?.has(ref)) continue;
      if (info.frames > 1) this.load.spritesheet(ref, info.url, { frameWidth: info.w, frameHeight: info.h });
      else this.load.image(ref, info.url);
    }
    // the effects' sheets (effects.ts): one-shots and the camp fire's loop; a sheet that does not load plays nothing and the old look stays
    for (const id of EFFECT_IDS) this.load.spritesheet(EFFECTS[id].texture, EFFECTS[id].url, { frameWidth: EFFECTS[id].frame[0], frameHeight: EFFECTS[id].frame[1] });
    // the driver's sheet, only when `?drift=sheet` asks for it; a missing file leaves the kit's own smoke (world.ts checks the texture)
    if (driftOn(window.location.search)) this.load.spritesheet(DRIFT_TEXTURE, CHIMNEY_SMOKE.sheet.url, { frameWidth: CHIMNEY_SMOKE.sheet.cell[0], frameHeight: CHIMNEY_SMOKE.sheet.cell[1] });
  }

  create(): void {
    performance.mark('boot:loaded');
    const early = app.painted?.early;
    // a normal page has no painted land: the world starts at once
    if (!early) {
      this.scene.start('world');
      return;
    }
    // the painted land's pictures are textures before the world starts, one a frame (no frame carries two big uploads); a streamed land's units (keys `painted:<layer>@ux,uy`)
    // are not waited for: the world starts and its stream takes them as they land
    const steps: (() => Promise<void>)[] = [];
    for (const key of early.keys().filter((k) => !k.includes('@'))) {
      steps.push(async () => {
        const img = await early.get(key)!;
        if (!this.textures.exists(key)) this.textures.addImage(key, img);
      });
    }
    const next = (i: number): void => {
      if (i >= steps.length) {
        performance.mark('boot:textures');
        this.scene.start('world');
        return;
      }
      steps[i]!().then(
        () => this.time.delayedCall(0, () => next(i + 1)),
        (e: unknown) => {
          console.warn(`could not load sprites: ${String(e)}`);
          next(i + 1);
        },
      );
    };
    next(0);
  }
}
