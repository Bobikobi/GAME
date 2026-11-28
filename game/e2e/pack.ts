/**
 * Proves the pack a fall leaves in a real browser, on a phone on its side, 844 by 390 CSS px (public #922, kernel 0.43, G33 and G81):
 *
 * - a player on an outing that carries two berries jumps off a four-level drop (death by G33; one digit of the height layer is raised
 *   in the page, as jump.ts does, and the outing is set down in the page: the e2e proves the client's part, the kernel's own tests prove
 *   the gathering);
 * - the box after the fall says "You died." and "Your pack lies where you died.", and the bag has lost the berries;
 * - the pack is drawn on the tile where the body fell (scenes/packs.ts) and the figure, woken in town, walks back to it with the arrow key
 *   until the A button reads "Take your pack";
 * - A takes it whole: the berries are back in the bag, the pack is gone from the kernel and from the picture, and the toast says so.
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

/** Row 6, raised in the page to level 4, so a jump left from it drops four levels onto (21, 6): death. */
const DEEP: [number, number] = [22, 6];
const BERRY = 'core/berry';

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

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  const page = await browser.newPage(PHONE);
  const player = `window.__game.session.state.player`;
  try {
    await page.goto(`${remote ?? local?.url ?? ''}?debug&rich=none${seedQuery('core/west-bank')}`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
    await start(page);

    // an outing that brought two berries: they are in the bag and the outing's tally (the page's own state, as jump.ts raises the ledge)
    await page.eval(`(() => {
      const p = ${player};
      p.bag[${JSON.stringify(BERRY)}] = (p.bag[${JSON.stringify(BERRY)}] ?? 0) + 2;
      p.outing = { gained: { [${JSON.stringify(BERRY)}]: 2 }, solved: [], visited: [] };
    })()`);
    const berries0 = await page.eval<number>(`${player}.bag[${JSON.stringify(BERRY)}]`);

    // the drop of four levels, after the first minute
    await page.waitFor(`window.__game.session.tick >= 60000`, 'the first minute to pass', 60_000);
    const ledge = await page.eval<string>(`(() => {
      const rows = window.__game.bundle.map.levels;
      const y = ${DEEP[1]}, x = ${DEEP[0]};
      const was = rows[y];
      rows[y] = rows[y].slice(0, x) + '4' + rows[y].slice(x + 1);
      return was;
    })()`);
    await page.eval(place(DEEP, 'left'));
    await page.waitFor(`window.__game.session.tick >= ${player}.busyUntil`, 'the breath for a jump', 5000);
    await page.tap('.tbtn.jump');
    await page.waitFor(`window.__game.world.falling === true`, 'the fall-down to begin', 5000);
    await page.waitFor(`window.__game.world.falling === false && !window.__game.world.hop && !window.__game.world.hopAsked`, 'the fall-down to end and the player to wake', 30_000);

    // the box's words, read line by line with A as the stone's lines are
    const said: string[] = [];
    for (let i = 0; i < 8 && (await page.eval<boolean>(`!!document.querySelector('.dialog')`)); i++) {
      said.push(await page.eval<string>(`document.querySelector('.dialog')?.textContent ?? ''`));
      if (i === 0) await page.screenshot(join(OUT, 'pack-box.png'));
      await page.tap('.tbtn.a');
      await page.waitFor(`true`, 'a frame');
    }
    await page.waitFor(`!document.querySelector('.dialog')`, 'the wake lines to close', 10_000);
    const all = said.join(' | ');
    if (!all.includes('You died.')) throw new Error(`the box after the fall never said "You died.": ${all}`);
    if (!all.includes('Your pack lies where you died.')) throw new Error(`the box after the fall never said "Your pack lies where you died.": ${all}`);
    console.log(`pack: the box said "You died." and "Your pack lies where you died."`);

    // the kernel holds the pack where the body fell, with the berries; the bag has lost them
    const lying = await page.eval<{ id: number; at: [number, number]; items: Record<string, number> }[]>(`${player}.packs ?? []`);
    if (lying.length !== 1) throw new Error(`the fall left ${lying.length} packs, not one`);
    const pack = lying[0]!;
    if (pack.items[BERRY] !== 2 || Object.keys(pack.items).length !== 1) throw new Error(`the pack holds ${JSON.stringify(pack.items)}, not the two berries`);
    if (Math.abs(pack.at[0] - DEEP[0]) > 1 || Math.abs(pack.at[1] - DEEP[1]) > 1) throw new Error(`the pack lies at ${pack.at.join(',')}, far from where the body fell (${DEEP.join(',')})`);
    const berries1 = await page.eval<number>(`${player}.bag[${JSON.stringify(BERRY)}] ?? 0`);
    if (berries1 !== berries0 - 2) throw new Error(`the bag holds ${berries1} berries after the fall, not ${berries0 - 2}`);
    console.log(`pack: the fall left the two berries as a pack at ${pack.at.join(',')}; the bag went from ${berries0} to ${berries1}`);

    // the raised ledge was only the road to the fall: the ground is put back, so the pack is seen on the valley as it is
    await page.eval(`window.__game.bundle.map.levels[${DEEP[1]}] = ${JSON.stringify(ledge)}`);
    // the figure is set down two tiles west of it (the woken town is across the valley) and walks the rest on its own legs;
    // the mist over the unseen valley is hidden for the one still, so the picture shows the basket on the ground it lies on
    await page.eval(place([pack.at[0] - 2, pack.at[1]], 'right'));
    await page.waitFor(`window.__game.world.packs?.ids.includes(${pack.id})`, 'the pack to be drawn on its tile', 5000);
    await page.eval(`window.__game.world.veil.setVisible(false), 0`);
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot(join(OUT, 'pack-lying.png'));
    await page.eval(`window.__game.world.veil.setVisible(true), 0`);
    await page.key('ArrowRight', 'keyDown');
    await page.waitFor(`(document.querySelector('.prompt')?.textContent ?? '').includes('Take your pack')`, 'A to offer the pack', 10_000);
    await page.key('ArrowRight', 'keyUp');
    await page.waitFor(`window.__game.controls.vector()[0] === 0 && !window.__game.session.busy`, 'the walk to stop', 5000);
    await page.waitFor(`(document.querySelector('.prompt')?.textContent ?? '').includes('Take your pack')`, 'A to still offer the pack where the figure stopped', 5000);
    console.log(`pack: the pack is drawn on its tile and A reads "Take your pack"`);

    // A takes it whole
    await page.tap('.tbtn.a');
    await page.waitFor(`(${player}.packs ?? []).length === 0`, 'the pack to be taken', 10_000);
    const berries2 = await page.eval<number>(`${player}.bag[${JSON.stringify(BERRY)}] ?? 0`);
    if (berries2 !== berries0) throw new Error(`the bag holds ${berries2} berries after taking the pack, not ${berries0}`);
    await page.waitFor(`${toasts}.includes('You take your pack')`, 'the toast of taking the pack', 5000);
    await page.waitFor(`!window.__game.world.packs?.ids.includes(${pack.id})`, 'the pack to leave its tile', 5000);
    await page.screenshot(join(OUT, 'pack-taken.png'));
    console.log(`pack: A took the pack whole (${berries2} berries in the bag), the toast said so and the picture is gone`);

    if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    await page.screenshot(join(OUT, 'pack-failed.png')).catch(() => undefined);
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
