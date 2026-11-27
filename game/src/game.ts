/**
 * The Phaser game: the engine and the scenes. Loaded after the title is on the screen (main.ts), so the engine's code is not
 * fetched or run before the title, and the world builds behind it (DECISIONS 2026-11-27).
 */
import * as Phaser from 'phaser';
import { app } from './app';
import { showStats, watchPerf, type Perf } from './perf';
import { BootScene } from './scenes/boot';
import { RoomScene } from './scenes/room';
import { WorldScene } from './scenes/world';
import { bindDeviceCanvas, firstSize } from './view';

export function startGame(perf: Perf, query: string): void {
  const first = firstSize();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#1b1a2e',
    banner: false,
    // the canvas takes the device's pixels (view.ts) instead of the window's CSS pixels
    scale: { mode: Phaser.Scale.NONE, width: first.w, height: first.h },
    scene: [BootScene, WorldScene, RoomScene],
  });
  app.perf = perf;
  app.game = game;
  watchPerf(game, perf);
  if (new URLSearchParams(query).get('stats') === '1') showStats(game, perf);
  bindDeviceCanvas(game, document.getElementById('game')!);
}
