/** Boot: the bundle, the controls, the page UI, then the Phaser game. */
import * as Phaser from 'phaser';
import type { Bundle } from '@game/kernel';
import { app } from './app';
import raw from './generated/bundle.json';
import { sound } from './audio';
import { RICH } from './config';
import { Controls } from './input';
import { BootScene } from './scenes/boot';
import { RoomScene } from './scenes/room';
import { WorldScene } from './scenes/world';
import { UI } from './ui/ui';
import { bindDeviceCanvas, firstSize } from './view';
import './style.css';

app.bundle = raw as unknown as Bundle;
app.controls = new Controls();
app.ui = new UI(document.getElementById('ui')!);
app.sound = sound;
app.controls.onButton((b) => app.ui.handle(b));

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

bindDeviceCanvas(game, document.getElementById('game')!);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) app.session?.save();
});
window.addEventListener('pagehide', () => app.session?.save());

// test and support hook: ?debug exposes the running game to the console, with the ?rich= groups it drew
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __game: typeof app }).__game = Object.assign(app, { rich: RICH });
}
