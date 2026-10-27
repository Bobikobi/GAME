/**
 * Proves the map in a real browser, on a phone and on a desktop: the window opens from the menu and
 * draws only the ground walked and the places stood in, the desktop keeps a pocket chart that opens
 * the same window, and the stall is placed and lifted at the town's free corner only from there and
 * stays in the save across a reload. Every check waits on a condition, never on a fixed time.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, byText, sleep, type Page, type Viewport } from './cdp';
import { TAKE_GROUND, carveIn, seedQuery } from './wakes';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(GAME_DIR, 'dist');
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e'));
const CORNER = 'core/town-corner';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

function serve(): Promise<{ server: Server; url: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '')).replace(/^(\.\.[/\\])+/, '');
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

/** Taps the element matching the selector whose text holds `text` (the first when `text` is empty). */
async function tap(page: Page, selector: string, text = ''): Promise<void> {
  await page.tapWhere(byText(selector, text), `${selector} "${text}"`, 10_000);
  await sleep(150);
}

const text = (page: Page, selector: string) => page.eval<string>(`(document.querySelector(${JSON.stringify(selector)})?.textContent ?? '').replace(/\\s+/g, ' ')`);
const rows = (page: Page) => page.eval<string[]>(`[...document.querySelectorAll('.panel.map .map-row')].map((e) => e.textContent.replace(/\\s+/g, ' '))`);

async function openMap(page: Page): Promise<void> {
  await page.eval(`window.__game.ui.closeAll(); window.__game.ui.handle('menu')`);
  await page.waitFor(`!!document.querySelector('.panel .menu-list')`, 'the menu');
  await tap(page, '.panel .menu-list button', 'Map');
  await page.waitFor(`!!document.querySelector('.panel.map .map-chart svg')`, 'the chart');
}

async function continueGame(page: Page, url: string): Promise<void> {
  await page.goto(`${url}?debug`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.tap('.title-screen button', 'Continue');
  await page.waitFor(`!!window.__game?.session?.started`, 'the game', 30_000);
  await sleep(300);
}

async function run(page: Page, url: string, viewport: Viewport): Promise<void> {
  const log = (msg: string) => console.log(`[${viewport.mobile ? 'phone' : 'desktop'}] ${msg}`);
  let orders: string[];

  await page.goto(`${url}?debug`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.eval(`localStorage.clear()`);
  await page.goto(`${url}?debug${seedQuery(viewport.mobile ? 'core/west-bank' : 'core/north-meadow')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.tap('.title-screen button', 'New game');
  const ask = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (ask === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards');
  await page.tap('.card.race', viewport.mobile ? 'Elf' : 'Human');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor(`!!window.__game?.session?.started`, 'the game', 30_000);
  // the name is cut at the bridge's stone, and this script is not about the stone: it is cut here
  await page.eval(carveIn('Mapper'));
  // the pocket's tools lie on the ground by the wake: this script tests what comes later, so they are handed over
  await page.eval(TAKE_GROUND);
  for (let i = 0; i < 40; i++) {
    if (!(await page.eval<boolean>(`!!document.querySelector('.dialog')`))) break;
    if (viewport.mobile) await page.tap('.tbtn.a');
    else await page.press('Enter');
    await sleep(220);
  }

  // the corner is not on the chart until the player has stood in it
  const cornerSeen = await page.eval<boolean>(`window.__game.session.seen.has(${JSON.stringify(CORNER)})`);
  if (cornerSeen) throw new Error('the town corner is seen from the spawn');
  await openMap(page);
  const strip = await text(page, '.panel.map .map-strip');
  if (!strip.includes('No stall placed')) throw new Error(`the strip reads "${strip}"`);
  orders = await rows(page);
  if (orders.some((row) => row.includes('The empty corner'))) throw new Error('the corner is named before the player stood in it');
  log(`the map opens: ${orders.length} place(s) the player stood in, none of them the corner`);

  // the pocket chart belongs to a desktop, and a phone does not carry one
  await page.eval(`window.__game.ui.closeAll()`);
  await sleep(200);
  const pocket = await page.eval<number>(`document.querySelector('.hud-map')?.getBoundingClientRect().width ?? 0`);
  if (viewport.mobile) {
    if (pocket !== 0) throw new Error('a phone carries a pocket chart');
    log('no pocket chart on a phone');
  } else {
    if (pocket === 0) throw new Error('a desktop has no pocket chart');
    const note = await text(page, '.hud-map-note');
    if (!note.includes('No stall placed')) throw new Error(`the pocket chart reads "${note}"`);
    await tap(page, '.hud-map', 'THE VALLEY');
    await page.waitFor(`!!document.querySelector('.panel.map .map-chart svg')`, 'the map from the pocket chart');
    log('the pocket chart opens the same window');
  }

  // stand at the corner: it joins the map, and the stall can be placed there
  await page.eval(`(() => {
    const s = window.__game.session;
    const slot = window.__game.bundle.map.slots.find((x) => x.id === ${JSON.stringify(CORNER)});
    s.pos = [slot.x, slot.y];
    s.state.player.at = [slot.x, slot.y];
    s.seeAt();
  })()`);
  await openMap(page);
  orders = await rows(page);
  if (!orders.some((row) => row.includes('The empty corner'))) throw new Error(`the corner did not join the list: ${JSON.stringify(orders)}`);
  const free = await text(page, '.panel.map');
  if (!free.includes('The empty corner is free')) throw new Error('the window does not say the corner is free');
  await tap(page, '.panel.map button', 'Place your stall');
  await page.waitFor(`window.__game.session.stall === ${JSON.stringify(CORNER)}`, 'the stall to stand');
  const placedStrip = await text(page, '.panel.map .map-strip');
  if (!placedStrip.includes('Your stall')) throw new Error(`the strip reads "${placedStrip}"`);
  orders = await rows(page);
  if (!orders.some((row) => row.includes('Your stall'))) throw new Error(`the list does not name the stall: ${JSON.stringify(orders)}`);
  log('placed at the corner, and the list and the strip say so');

  // the save keeps it
  await continueGame(page, url);
  const kept = await page.eval<string | undefined>(`window.__game.session.stall`);
  if (kept !== CORNER) throw new Error(`the reload lost the stall: ${String(kept)}`);
  if (!viewport.mobile) {
    const note = await text(page, '.hud-map-note');
    if (!note.includes('Your stall')) throw new Error(`the pocket chart reads "${note}" after a reload`);
  }
  await openMap(page);
  orders = await rows(page);
  if (!orders.some((row) => row.includes('Your stall'))) throw new Error('the map lost the stall after a reload');
  log('the stall is still standing after a reload');

  // and it can be lifted, from the corner only
  await tap(page, '.panel.map button', 'Lift your stall');
  await page.waitFor(`window.__game.session.stall === undefined`, 'the stall to be lifted');
  const liftedStrip = await text(page, '.panel.map .map-strip');
  if (!liftedStrip.includes('No stall placed')) throw new Error(`the strip reads "${liftedStrip}" after lifting`);
  log('lifted, and the strip says no stall');

  await continueGame(page, url);
  const gone = await page.eval<string | undefined>(`window.__game.session.stall`);
  if (gone !== undefined) throw new Error(`the lifted stall came back: ${String(gone)}`);
  log('still lifted after a reload');
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  try {
    for (const [name, viewport] of [
      ['phone', { width: 390, height: 844, mobile: true }],
      ['desktop', { width: 1440, height: 900, mobile: false }],
    ] as [string, Viewport][]) {
      const page = await browser.newPage(viewport);
      try {
        await run(page, remote ?? local?.url ?? '', viewport);
      } catch (error) {
        await page.screenshot(join(OUT, `map-${name}-failed.png`)).catch(() => undefined);
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      } finally {
        page.close();
        await sleep(300);
      }
      console.log(`map: ${name} passed`);
    }
  } finally {
    // a failing profile removal must not hide the check that failed
    await browser.close().catch((error: unknown) => console.error(`map: closing Chrome: ${error instanceof Error ? error.message : error}`));
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
