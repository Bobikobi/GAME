/** Loads every sprite the bundle names, then hands over to the world. */
import * as Phaser from 'phaser';
import { app } from '../app';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.on('progress', (v: number) => app.ui.loading(v));
    this.load.on('loaderror', (file: { key: string }) => console.warn(`could not load sprite ${file.key}`));
    for (const [ref, info] of Object.entries(app.bundle.sprites)) {
      if (info.frames > 1) this.load.spritesheet(ref, info.url, { frameWidth: info.w, frameHeight: info.h });
      else this.load.image(ref, info.url);
    }
  }

  create(): void {
    this.scene.start('world');
  }
}
