/**
 * Proves the jump and the fall on a phone on its side (DECISIONS 2026-11-22, #826), 844 by 390 CSS px, in a real browser:
 *
 * - the Jump button stands on the right of the screen, round, 48 px or more, clear of every other button and of the HUD;
 * - in the first minute after waking a tap on it is refused in the kernel's words and the player stays where they stood;
 * - after it, a tap jumps up one ledge of the valley (the town's face at x=21|22): the player stands on the higher tile and the
 *   drawing rode an arc above the ground (the code STAND-IN hop: the figure lifts, its feet and shadow keep the ground);
 * - a drop of two levels (the valley has none, so one digit of the height layer is raised in the page) lands, costs a fifth
 *   of the health cap and says so in the hurt cue's words;
 * - a drop of four levels is death by G33: the fall-down plays, the player wakes in town and walks again.
 *
 * Every check waits on a condition, never on a fixed time. The screenshots go to the out-dir (default .scratch/e2e).
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, type Page } from './cdp';
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

/** The town's face on row 4: level 0 at x=21, level 1 at x=22 (no crossing on that row). */
const LOW: [number, number] = [21, 4];
const HIGH: [number, number] = [22, 4];
/** Row 5 beside it, raised in the page to level 2, so a jump left from it drops two levels onto (21, 5). */
const TALL: [number, number] = [22, 5];
const BELOW: [number, number] = [21, 5];
/** Row 6, raised in the page to level 4, so a jump left from it drops four levels onto (21, 6): death. */
const DEEP: [number, number] = [22, 6];

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

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The buttons are round: two overlap when their centers are nearer than their two radii. */
const overlap = (a: Box, b: Box) => Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2)) < (a.w + b.w) / 2;

const LAYOUT = `(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const buttons = [...document.querySelectorAll('.touch .tbtn')].filter((b) => b.getBoundingClientRect().width > 0)
    .map((b) => ({ name: b.className.replace(' down', ''), ...box(b) }));
  const hud = [];
  for (const el of document.querySelectorAll('.top > .tracker, .hud .btn, .hud .chip, .hud .meter')) { const r = el.getBoundingClientRect(); if (r.height > 0) hud.push({ name: el.className, ...box(el) }); }
  return { buttons, hud };
})()`;

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
const where = `[...window.__game.session.pos]`;
const toasts = `(document.querySelector('.toasts')?.textContent ?? '')`;

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

    // the first minute: refused in the kernel's words, nothing moves
    await page.eval(place(LOW, 'right'));
    const early = await page.eval<number>(`window.__game.session.tick`);
    if (early >= 60_000) throw new Error(`the first-minute check ran late: the clock is at ${early} ms`);
    await page.tap('.tbtn.jump');
    await page.waitFor(`${toasts}.includes('only just woken')`, 'the first-minute refusal', 5000);
    const still = await page.eval<number[]>(where);
    if (still[0] !== LOW[0] || still[1] !== LOW[1]) throw new Error(`a refused jump moved the player to ${still.join(',')}`);
    console.log('jump: the first minute refuses the jump and the player stays');

    // the button: round, a thumb's size, on the right, clear of every button and the HUD
    const seen = await page.eval<{ buttons: (Box & { name: string })[]; hud: (Box & { name: string })[] }>(LAYOUT);
    const jump = seen.buttons.find((b) => b.name.includes('tbtn jump'));
    if (!jump) throw new Error(`no Jump button on a phone on its side: ${seen.buttons.map((b) => b.name).join(', ')}`);
    if (jump.w < 48 || jump.h < 48) throw new Error(`the Jump button is ${jump.w}x${jump.h}, under 48 px`);
    if (jump.x < PHONE.width / 2 || jump.x + jump.w > PHONE.width || jump.y < 0 || jump.y + jump.h > PHONE.height) throw new Error('the Jump button stands outside the right half of the screen');
    for (const other of seen.buttons) if (other !== jump && overlap(jump, other)) throw new Error(`the Jump button overlaps ${other.name}`);
    for (const part of seen.hud) {
      if (jump.x < part.x + part.w && part.x < jump.x + jump.w && jump.y < part.y + part.h && part.y < jump.y + jump.h) throw new Error(`the Jump button overlaps the HUD's ${part.name}`);
    }
    console.log(`jump: the button is ${Math.round(jump.w)} px at ${Math.round(jump.x)},${Math.round(jump.y)}, clear of ${seen.buttons.length - 1} buttons and ${seen.hud.length} HUD parts`);

    // past the minute: up one ledge, and the drawing rides an arc
    await page.waitFor(`window.__game.session.tick >= 60000`, 'the first minute to pass', 60_000);
    // two tiles short of the ledge, then walked to it with the arrow key: the walk's own report of the position is what the jump leaves from
    await page.eval(place([LOW[0] - 2, LOW[1]], 'down'));
    await page.key('ArrowRight', 'keyDown');
    await page.waitFor(`${where}[0] === ${LOW[0]}`, 'the walk to the foot of the ledge', 10_000);
    await page.key('ArrowRight', 'keyUp');
    await page.waitFor(`window.__game.controls.vector()[0] === 0 && !window.__game.session.busy`, 'the walk to stop', 5000);
    await page.waitFor(`window.__game.session.state.player.at[0] === ${LOW[0]} && window.__game.session.state.player.at[1] === ${LOW[1]}`, 'the kernel to hold the walked-to tile', 10_000);
    await page.eval(`(() => {
      window.__lifts = [];
      const sample = () => { window.__lifts.push(window.__game.world.lift); window.__liftTimer = requestAnimationFrame(sample); };
      sample();
    })()`);
    await page.tap('.tbtn.jump');
    await page.waitFor(`window.__lifts.some((v) => v > 0)`, 'the figure to rise on the hop', 5000);
    await page.screenshot(join(OUT, 'jump-air.png'));
    await page.waitFor(`(() => { const p = ${where}; return p[0] === ${HIGH[0]} && p[1] === ${HIGH[1]} && !window.__game.world.hop; })()`, 'the landing on the higher tile', 5000);
    const peak = await page.eval<number>(`Math.max(...window.__lifts)`);
    const after = await page.eval<number>(`window.__lifts[window.__lifts.length - 1]`);
    if (!(peak >= 10)) throw new Error(`the hop's arc peaked at ${peak} art px, under 10`);
    if (after !== 0) throw new Error(`the drawing is still ${after} px in the air after the landing`);
    await page.screenshot(join(OUT, 'jump-up.png'));
    console.log(`jump: up one ledge from ${LOW.join(',')} to ${HIGH.join(',')}, the arc peaked at ${peak} art px and the figure came down`);

    // a drop of two levels (the valley has none, so one digit of the height layer is raised in the page)
    await page.eval(`(() => {
      const rows = window.__game.bundle.map.levels;
      const y = ${TALL[1]}, x = ${TALL[0]};
      rows[y] = rows[y].slice(0, x) + '2' + rows[y].slice(x + 1);
    })()`);
    await page.eval(place(TALL, 'left'));
    const hp0 = await page.eval<number>(`window.__game.session.state.player.hp`);
    // the breath must hold a second jump: it refills (5 a second) from the first
    await page.waitFor(`window.__game.session.tick >= window.__game.session.state.player.busyUntil`, 'the first hop to end', 5000);
    await page.tap('.tbtn.jump');
    await page.waitFor(`(() => { const p = ${where}; return p[0] === ${BELOW[0]} && p[1] === ${BELOW[1]} && !window.__game.world.hop; })()`, 'the landing two levels below', 5000);
    await page.waitFor(`${toasts}.includes('You hit the ground hard')`, 'the hurt cue of the fall', 5000);
    const hp1 = await page.eval<number>(`window.__game.session.state.player.hp`);
    if (!(hp1 < hp0)) throw new Error(`a fall of two levels cost no health: ${hp0} to ${hp1}`);
    // the player woke at full health, so the cap is hp0: a fall of two levels takes a fifth of it (jump.fall_two_bp)
    if (hp0 - hp1 !== Math.floor((hp0 * 2000) / 10_000)) throw new Error(`the fall took ${hp0 - hp1} of ${hp0}, not a fifth`);
    await page.screenshot(join(OUT, 'jump-fall.png'));
    console.log(`jump: a drop of two levels cost ${(hp0 - hp1) / 1000} health (${hp0 / 1000} to ${hp1 / 1000}) and showed the hurt cue`);

    // a drop of four levels is death (G33): the hop lands, the fall-down plays, the figure wakes in town and can walk again
    await page.eval(`(() => {
      const rows = window.__game.bundle.map.levels;
      const y = ${DEEP[1]}, x = ${DEEP[0]};
      rows[y] = rows[y].slice(0, x) + '4' + rows[y].slice(x + 1);
    })()`);
    await page.waitFor(`window.__game.session.tick >= window.__game.session.state.player.busyUntil`, 'the landing to end', 5000);
    await page.eval(place(DEEP, 'left'));
    // the breath for a third hop: it refills a little each second
    await page.waitFor(`window.__game.session.state.player.hp > 0`, 'a living player', 2000);
    await page.tap('.tbtn.jump');
    await page.waitFor(`window.__game.world.falling === true`, 'the fall-down to begin', 5000);
    await page.waitFor(`window.__game.world.falling === false && !window.__game.world.hop && !window.__game.world.hopAsked`, 'the fall-down to end and the player to wake', 30_000);
    const woke = await page.eval<number[]>(where);
    if (Math.abs(woke[0]! - DEEP[0]) + Math.abs(woke[1]! - DEEP[1]) < 4) throw new Error(`a drop of four levels left the player at ${woke.join(',')}, not woken in town`);
    await page.screenshot(join(OUT, 'jump-death.png'));
    // the wake's own lines ("You died.") are read to their end with A, as the stone's lines are
    for (let i = 0; i < 8 && (await page.eval<boolean>(`!!document.querySelector('.dialog')`)); i++) {
      await page.tap('.tbtn.a');
      await page.waitFor(`true`, 'a frame');
    }
    await page.waitFor(`!document.querySelector('.dialog')`, 'the wake line to close', 10_000);
    await page.key('ArrowDown', 'keyDown');
    await page.waitFor(`(() => { const p = ${where}; return p[0] !== ${woke[0]} || p[1] !== ${woke[1]}; })()`, 'the player to walk again after waking', 10_000);
    await page.key('ArrowDown', 'keyUp');
    console.log(`jump: a drop of four levels was death: the fall-down played, the player woke at ${woke.join(',')} and walked again`);

    if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    await page.screenshot(join(OUT, 'jump-failed.png')).catch(() => undefined);
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
