/** Boot: the bundle, the controls, the page UI, then the Phaser game. */
import type { Bundle } from '@game/kernel';
import { app } from './app';
import raw from './generated/bundle.json';
import { sound } from './audio';
import { RICH } from './config';
import { startPerf } from './perf';
import { applyDisplay } from './settings-apply';
import { Controls } from './input';
import { UI } from './ui/ui';
import './style.css';

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

app.bundle = raw as unknown as Bundle;
app.controls = new Controls();
app.ui = new UI(document.getElementById('ui')!);
app.sound = sound;
app.controls.onButton((b) => app.ui.handle(b));
app.controls.onButtonUp((b) => app.ui.handleUp(b));

const query = location.search;
const perf = startPerf(query, safeStorage());
applyDisplay(document.documentElement, perf.settings);
// the title first: it draws from the bundle alone, so it goes up before the engine is fetched; the engine and the world follow
// behind it (game.ts), and a start pressed before the world is ready waits on a "preparing the valley" bar (ui.ts `begin`)
app.ui.openTitle();
requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => void import('./game').then((m) => m.startGame(perf, query)), 0)));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) app.session?.save();
});
window.addEventListener('pagehide', () => app.session?.save());

// test and support hook: ?debug exposes the running game to the console, with the ?rich= groups it drew
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __game: typeof app }).__game = Object.assign(app, { rich: RICH });
}
