/**
 * The 3D door (DECISIONS.md, 2026-10-11): the same game as src/main.ts, drawn with three.js. The bundle, the controls,
 * the page UI, the sound and the save are the classic game's, so a character made at /play/ plays here and back.
 */
import type { Bundle } from '@game/kernel';
import { app } from '../app';
import { sound } from '../audio';
import { Controls } from '../input';
import { UI } from '../ui/ui';
import raw from '../generated/bundle.json';
import '../style.css';
import { World3D } from './world3d';

app.bundle = raw as unknown as Bundle;
app.controls = new Controls();
app.ui = new UI(document.getElementById('ui')!);
app.sound = sound;
app.controls.onButton((b) => app.ui.handle(b));

const canvas = document.getElementById('valley') as HTMLCanvasElement | null;
if (!canvas) throw new Error('no canvas');

World3D.create(app.bundle, canvas)
  .then((world) => {
    app.world = world;
    world.start();
    app.ui.worldReady();
    // test and support hook: ?debug exposes the running game to the console
    if (new URLSearchParams(location.search).has('debug')) {
      (window as unknown as { __game: typeof app; __world3d: World3D }).__game = app;
      (window as unknown as { __world3d: World3D }).__world3d = world;
    }
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    document.getElementById('ui')?.append(Object.assign(document.createElement('p'), { textContent: `The valley did not load: ${message}` }));
    console.error(err);
  });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) app.session?.save();
});
window.addEventListener('pagehide', () => app.session?.save());
