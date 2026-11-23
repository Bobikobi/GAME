/**
 * Proves the loose stones on a phone on its side (DECISIONS 2026-11-22, #831), 844 by 390 CSS px, in a real browser:
 *
 * - standing on a spot's stone, A offers "Lift the stone" and puts it in the bag;
 * - B throws it the way the figure faces: the stone leaves the hand, rises on an arc, comes down at the kernel's touch tile, BOUNCES
 *   (it rises off the ground again after touching) and slides on to its rest tile, and is not drawn on that tile before it lands;
 * - the stone lies where it landed; it is lifted again from there, and a second one from another spot;
 * - two set down on one tile from the bag are a pile counted by number (2 pictures), taken apart with A a stone at a time;
 * - a figure with no might is refused a large stone in the kernel's words; with a point of might it lifts it, the stone rides over
 *   its head (the STAND-IN hold), the walk slows, and A sets it down.
 *
 * Every check waits on a condition, never on a fixed time. The screenshots go to the out-dir (default .scratch/e2e).
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, type Page } from './cdp';
import { T as TILE } from '../src/config';
import { PHONE } from './viewports';
import { TAKE_GROUND, carveIn, seedQuery } from './wakes';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(GAME_DIR, 'dist');
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e'));
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

/** Two small spots and a large one of the valley, on open meadow with a clear row to the right of the first. */
const THROWER: [number, number] = [24, 14];
const OTHER: [number, number] = [21, 17];
const LARGE: [number, number] = [20, 12];
/** A bare tile of the meadow for the pile. */
const PILE: [number, number] = [23, 16];

function serve(): Promise<{ server: Server; url: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')).replace(/^(\.\.[/\\])+/, '');
      let file = join(DIST, path);
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!file.startsWith(DIST) || !existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      ok({ server, url: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/` });
    });
  });
}

async function start(page: Page): Promise<void> {
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Elf');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the character to wake', 10_000);
  await page.eval(carveIn('Tess'));
  await page.eval(TAKE_GROUND);
  for (let i = 0; i < 12; i++) {
    if (!(await page.eval<boolean>(`!!document.querySelector('#ui > .layer')`))) break;
    await page.tap('.tbtn.a');
    await page.waitFor(`true`, 'a frame');
  }
  await page.waitFor(`!document.querySelector('#ui > .layer')`, 'the waking lines to close', 15_000);
}

/** The player set down on a tile, facing a way, the scene told (the walk's own hand-over, as the other scripts use). */
const place = (at: readonly number[], facing: string): string => `(() => { const g = window.__game, s = g.session; s.pos = [${at[0]}, ${at[1]}]; s.state.player.at = [${at[0]}, ${at[1]}]; s.facing = ${JSON.stringify(facing)}; g.world.bind(s); })()`;
const toasts = `(document.querySelector('.toasts')?.textContent ?? '')`;
const prompt = `(document.querySelector('.prompt')?.hidden ? '' : (document.querySelector('.prompt')?.textContent ?? ''))`;
const bag = `(window.__game.session.state.player.bag['core/stone'] ?? 0)`;
const ground = (t: readonly number[]) => `(window.__game.session.state.player.ground?.['${t[0]},${t[1]}']?.['core/stone'] ?? 0)`;
const drawn = (t: readonly number[]) => `(window.__game.world.stones?.countAt('${t[0]},${t[1]}') ?? 0)`;
const idle = `window.__game.session.tick >= window.__game.session.state.player.busyUntil`;

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  const page = await browser.newPage(PHONE);
  try {
    await page.goto(`${remote ?? local?.url ?? ''}?debug&rich=none${seedQuery('core/west-bank')}`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
    await start(page);

    const params = await page.eval<{ range: number; roll: number; ms: number; lift: number }>(
      `(() => { const p = window.__game.bundle.params.stones; return { range: p.small_range, roll: p.small_roll, ms: p.throw_ms, lift: p.lift_ms }; })()`,
    );
    const touch: [number, number] = [THROWER[0] + params.range, THROWER[1]];
    const rest: [number, number] = [touch[0] + params.roll, touch[1]];

    // A on a spot's stone lifts it into the bag
    await page.eval(place(THROWER, 'right'));
    await page.waitFor(`${prompt}.includes('Lift the stone')`, 'A to offer the stone', 5000);
    await page.tap('.tbtn.a');
    await page.waitFor(`${bag} === 1 && ${idle}`, 'the stone in the bag', 5000);
    console.log(`stones: A lifted the spot's stone at ${THROWER.join(',')} into the bag`);

    // B throws it. Two readings: the frames are sampled while it flies (they must show the stone off its resting tile until it lands, and
    // every frame must sit on the flight's own curve), and the flight's curve itself is read from the scene's own motion (its pure
    // function of time), a millisecond at a time - a loaded machine drops frames and cannot make a bounce lost from that curve.
    await page.eval(`(() => {
      window.__fx = [];
      window.__early = 0;
      window.__flight = null;
      const sample = () => {
        const w = window.__game.world, f = w.stones?.flying?.[0];
        if (f) {
          window.__flight ??= f;
          window.__fx.push({ x: f.image.x, lift: (f.shadow.y - 1 - f.image.y) });
          if (w.stones.countAt('${rest[0]},${rest[1]}') > 0) window.__early++;
        }
        window.__fxTimer = requestAnimationFrame(sample);
      };
      sample();
    })()`);
    await page.tap('.tbtn.b');
    await page.waitFor(`window.__fx.length > 0`, 'the stone to leave the hand', 5000);
    await page.screenshot(join(OUT, 'stones-air.png'));
    await page.waitFor(`${ground(rest)} === 1 && !window.__game.world.stones.busy`, 'the stone to land and stop', 5000);
    const early = await page.eval<number>(`window.__early`);
    if (early > 0) throw new Error(`the stone was drawn on its resting tile ${early} frames before it landed`);
    const arc = await page.eval<{ frames: number; off: number; peak: number; touchLift: number; bounce: number; slid: number; ms: number }>(`(() => {
      const f = window.__flight, T = ${TILE}, m = f.motion, ms = Math.ceil(m.ms);
      const curve = [];
      for (let t = 0; t <= ms; t++) { const p = m.at(t); curve.push({ x: p.x * T, lift: p.lift * T, touched: p.touched }); }
      // a frame that was drawn is on the curve (to a pixel): the scene draws the flight it was given
      let off = 0;
      for (const q of window.__fx) off = Math.max(off, Math.min(...curve.map((c) => Math.hypot(c.x - q.x, c.lift - q.lift))));
      const first = curve.findIndex((c) => c.touched);
      const after = curve.slice(first);
      // it rose again after the first touch: the lift came back under half a pixel at the touch, then went over 0.8 px
      const down = after.findIndex((c) => c.lift < 0.5);
      const bounce = down < 0 ? 0 : Math.max(...after.slice(down).map((c) => c.lift));
      return {
        frames: window.__fx.length,
        off,
        peak: Math.max(...curve.slice(0, first).map((c) => c.lift)),
        touchLift: first < 0 ? -1 : curve[first].lift,
        bounce,
        slid: after[after.length - 1].x - after[0].x,
        ms: m.ms,
      };
    })()`);
    // the arc: it rose, came down (lift back to ~0), rose again (a bounce), and slid on (x kept growing after the first touch)
    if (arc.frames < 2) throw new Error(`only ${arc.frames} frame(s) of the flight were seen`);
    if (arc.off > 1) throw new Error(`a drawn frame of the flight is ${arc.off.toFixed(1)} px off the flight's own curve`);
    if (!(arc.peak >= 4)) throw new Error(`the throw's arc peaked at ${arc.peak} px, under 4`);
    if (!(arc.touchLift < 0.5)) throw new Error(`the stone did not come down: ${arc.touchLift} px up at its first touch`);
    if (!(arc.bounce > 0.8)) throw new Error(`the stone came down and did not bounce: it rose ${arc.bounce.toFixed(1)} px after the touch`);
    if (!(arc.slid > 2)) throw new Error(`the stone did not slide on after touching: moved ${arc.slid} px`);
    console.log(`stones: thrown from ${THROWER.join(',')}, arc peak ${arc.peak.toFixed(1)} px, touched ${touch.join(',')}, bounced ${arc.bounce.toFixed(1)} px, slid ${arc.slid.toFixed(1)} px to ${rest.join(',')} (${arc.frames} frames seen)`);
    await page.screenshot(join(OUT, 'stones-landed.png'));
    if ((await page.eval<number>(drawn(rest))) !== 1) throw new Error('the landed stone is not drawn on its tile after the flight');

    // lift it again where it lies, and the second from another spot
    await page.eval(place(rest, 'right'));
    await page.waitFor(`${prompt}.includes('Lift the stone')`, 'A to offer the landed stone', 5000);
    await page.tap('.tbtn.a');
    await page.waitFor(`${bag} === 1 && ${ground(rest)} === 0 && ${idle}`, 'the landed stone in the bag', 5000);
    await page.eval(place(OTHER, 'right'));
    await page.waitFor(`${prompt}.includes('Lift the stone')`, 'A to offer the second spot stone', 5000);
    await page.tap('.tbtn.a');
    await page.waitFor(`${bag} === 2 && ${idle}`, 'both stones in the bag', 5000);

    // two set down on one tile from the bag are a pile counted by number
    await page.eval(place(PILE, 'down'));
    for (let n = 1; n <= 2; n++) {
      await page.tap('.tbtn.bag');
      // the item's detail covers the grid on a phone on its side, so the stone's cell is chosen with a click, not a thumb
      await page.waitFor(`[...document.querySelectorAll('.kit-cell')].some((c) => c.title.includes('River stone'))`, 'the stone in the bag');
      await page.eval(`[...document.querySelectorAll('.kit-cell')].find((c) => c.title.includes('River stone')).click()`);
      await page.tapWhere(`document.querySelector('[data-drop="core/stone"]')`, 'Put down');
      await page.waitFor(`${ground(PILE)} === ${n}`, `${n} stone(s) on the tile`, 5000);
      await page.waitFor(`${drawn(PILE)} === ${n}`, `${n} picture(s) for the pile`, 5000);
      await page.tap('.panel header button', 'Close');
      await page.waitFor(`!document.querySelector('#ui > .layer')`, 'the bag to close', 5000);
    }
    await page.screenshot(join(OUT, 'stones-pile.png'));
    console.log(`stones: two set down on ${PILE.join(',')} are a pile of 2, drawn as 2 stones`);
    await page.waitFor(`${prompt}.includes('Take a stone from the pile')`, 'A to offer taking the pile apart', 5000);
    await page.tap('.tbtn.a');
    await page.waitFor(`${ground(PILE)} === 1 && ${bag} === 1 && ${idle}`, 'the pile taken apart by one', 5000);
    await page.waitFor(`${drawn(PILE)} === 1`, 'one picture for the pile that is left', 5000);
    console.log('stones: A took one from the pile, one is left');

    // a large stone: refused with no might, lifted with a point of it, held over the head, set down by A
    await page.eval(place(LARGE, 'right'));
    await page.waitFor(`${prompt}.includes('Lift the large stone')`, 'A to offer the large stone', 5000);
    await page.tap('.tbtn.a');
    await page.waitFor(`${toasts}.includes('too heavy')`, 'the refusal for a figure with no might', 5000);
    const pace0 = await page.eval<number>(`window.__game.world.paceMs ?? 0`);
    await page.eval(`(() => { const p = window.__game.session.state.player; p.bag['core/stone'] = 0; p.attrs.might = 1; })()`);
    await page.waitFor(idle, 'the busy time to pass', 5000);
    await page.tap('.tbtn.a');
    await page.waitFor(`window.__game.session.state.player.stones?.carry === 'large' && !!window.__game.world.carryImg`, 'the large stone over the head', 5000);
    await page.waitFor(`window.__game.world.carryRise === 1`, 'the lift to finish', 5000);
    const carried = await page.eval<{ stone: number; feet: number; height: number }>(
      `(() => { const w = window.__game.world; return { stone: w.carryImg.y, feet: w.player.y, height: w.player.displayHeight }; })()`,
    );
    // the stone's foot is up past the middle of the figure, near its head: held over the head, not at the feet
    if (!(carried.stone < carried.feet - 0.4 * carried.height)) throw new Error(`the held stone is not over the head: its foot is at ${carried.stone}, the feet at ${carried.feet}, the figure ${carried.height} px tall`);
    // a step while carrying: the pace the walk reports is the kernel's, slower under the stone's weight
    await page.key('ArrowRight', 'keyDown');
    await page.waitFor(`window.__game.world.body.moving`, 'the walk to begin', 5000);
    const slow = await page.eval<number>(`window.__game.world.paceMs`);
    await page.key('ArrowRight', 'keyUp');
    await page.waitFor(`!window.__game.world.body.moving && window.__game.controls.vector()[0] === 0`, 'the walk to stop', 5000);
    if (!(pace0 === 0 || slow > pace0)) throw new Error(`the walk did not slow under the stone: ${pace0} then ${slow} ms a tile`);
    await page.screenshot(join(OUT, 'stones-carry.png'));
    console.log(`stones: no might: refused "too heavy"; with might the large stone rode over the head (STAND-IN), the walk step went ${pace0 || 'n/a'} to ${slow} ms a tile`);
    await page.waitFor(`${prompt}.includes('Set the stone down')`, 'A to offer setting the stone down', 5000);
    await page.tap('.tbtn.a');
    await page.waitFor(`!window.__game.session.state.player.stones?.carry && !window.__game.world.carryImg`, 'the stone to be set down', 5000);

    if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    await page.screenshot(join(OUT, 'stones-failed.png')).catch(() => undefined);
    throw err;
  } finally {
    page.close();
    await browser.close();
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
