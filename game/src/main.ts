/** Boot: the bundle, the controls, the page UI, then the Phaser game. */
import type { Bundle } from '@game/kernel';
import { app } from './app';
import raw from './generated/bundle.json';
import { sound } from './audio';
import { RICH } from './config';
import { startPerf } from './perf';
import { applyDisplay } from './settings-apply';
import { Controls } from './input';
import { kitAtlasOf } from './kit-atlas';
import { paintedQuery } from './trial';
import { UI } from './ui/ui';
import './style.css';

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// the boot's steps as marks a measure reads (game/e2e/stream.ts): where a phone's first minute goes
performance.mark('boot:main');
app.bundle = raw as unknown as Bundle;
app.controls = new Controls();
app.ui = new UI(document.getElementById('ui')!);
app.sound = sound;
app.controls.onButton((b) => app.ui.handle(b));
app.controls.onButtonUp((b) => app.ui.handleUp(b));

const query = location.search;

/**
 * The painted valley (painted.ts), the game's first place: every page mounts it (trial.ts). It comes from a dynamic import, so the painted code is its own file
 * fetched behind the title, and the mount comes before the engine starts (the scenes read `app.painted` and the bundle it adapts).
 */
async function mountTrial(): Promise<void> {
  // the private preview (`?preview`): the valley as it starts, a way out of its east lane, and the painted block beyond it; the light at the device's hour
  const preview = new URLSearchParams(query).has('preview');
  const { mountPainted, PREVIEW_QUERY } = await import('./painted');
  const mount = await mountPainted(app.bundle, preview ? `${query}&${PREVIEW_QUERY.slice(1)}` : paintedQuery(query));
  app.painted = mount;
  app.bundle = mount.bundle;
  performance.mark('boot:read');
}
const perf = startPerf(query, safeStorage());
applyDisplay(document.documentElement, perf.settings);
// the title first: it draws from the bundle alone, so it goes up before the engine is fetched; the engine and the world follow
// behind it (game.ts), and a start pressed before the world is ready waits on a "preparing the valley" bar (ui.ts `begin`)
app.ui.openTitle();
// the kit's atlas sheets start behind the title, beside the engine's download (kit-atlas.ts); the boot cuts them into the sprites' own textures
const atlas = kitAtlasOf(query);
requestAnimationFrame(() =>
  requestAnimationFrame(() =>
    setTimeout(
      () =>
        void mountTrial()
          .then(async () => {
            app.kitAtlas = await atlas;
          })
          .then(() => import('./game'))
          .then((m) => m.startGame(perf, query)),
      0,
    ),
  ),
);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) app.session?.save();
});
window.addEventListener('pagehide', () => app.session?.save());

// test and support hook: ?debug exposes the running game to the console, with the ?rich= groups it drew
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __game: typeof app }).__game = Object.assign(app, { rich: RICH });
}
