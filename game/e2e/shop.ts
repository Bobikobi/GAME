/**
 * Proves the kit's Shop tab in a real browser, on a phone and on a desktop: an item goes into a
 * place with how many of it and the price of one, the place says both, the save carries them, a
 * reload brings them back, tapping the place opens it on what it holds, and "Take it off" empties
 * it and leaves it empty after another reload. Every check waits on a condition, never a fixed time.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page, type Viewport } from './cdp';
import { TAKE_GROUND, carveIn, seedQuery } from './wakes';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(GAME_DIR, 'dist');
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e'));
const SAVE_KEY = 'openfold.save.1';
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
  const at = await page.waitFor<{ x: number; y: number }>(
    `(() => {
      for (const el of document.querySelectorAll(${JSON.stringify(selector)})) {
        if (!el.textContent.includes(${JSON.stringify(text)})) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        el.scrollIntoView({ block: 'nearest' });
        const q = el.getBoundingClientRect();
        return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
      }
      return null;
    })()`,
    `${selector} "${text}"`,
    10_000,
  );
  await page.tapAt(at.x, at.y);
  await sleep(120);
}

const places = (page: Page) => page.eval<string[]>(`[...document.querySelectorAll('.shop-slot')].map((e) => e.textContent.trim())`);
const saved = (page: Page) => page.eval<Record<string, unknown>>(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}) ?? '{}')`);

async function openShop(page: Page): Promise<string[]> {
  await page.eval(`window.__game.ui.closeAll(); window.__game.ui.handle('bag')`);
  await page.waitFor(`!!document.querySelector('.panel .tabs')`, 'the kit');
  await tap(page, '.panel .tabs button', 'Shop');
  await page.waitFor(`document.querySelectorAll('.shop-slot').length === 6`, 'the six places');
  return places(page);
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
  // a new game with a fresh save
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
  await page.eval(carveIn('Stall'));
  // the pocket's tools lie on the ground by the wake: this script tests what comes later, so they are handed over
  await page.eval(TAKE_GROUND);
  for (let i = 0; i < 40; i++) {
    if (!(await page.eval<boolean>(`!!document.querySelector('.dialog')`))) break;
    if (viewport.mobile) await page.tap('.tbtn.a');
    else await page.press('Enter');
    await sleep(220);
  }

  // three of the thing the start carries, so a quantity above one can be offered
  const item = await page.eval<string>(`(() => {
    const s = window.__game.session, bag = s.state.player.bag;
    const id = Object.keys(bag)[0];
    bag[id] = 3;
    s.save();
    return id;
  })()`);
  const label = await page.eval<string>(`window.__game.bundle.items[${JSON.stringify(item)}].name`);
  log(`wakes with 3 of ${label}`);

  let s = await openShop(page);
  if (s.length !== 6) throw new Error(`the stall shows ${s.length} places`);
  if (!s.every((x) => x.includes('drop here'))) throw new Error(`a fresh stall is not empty: ${JSON.stringify(s)}`);

  // into the second place: how many, and the price of one
  await tap(page, '.shop-item', label);
  await tap(page, '.shop-slot', 'Stall 2');
  await page.waitFor(`!!document.querySelector('.shop-qty-input')`, 'the window with a quantity');
  const max = await page.eval<string>(`document.querySelector('.shop-qty-input').max`);
  if (max !== '3') throw new Error(`the window offers ${max} places, not the 3 carried`);
  await page.eval(`(() => {
    const q = document.querySelector('.shop-qty-input');
    q.value = '3';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    const p = document.querySelector('.shop-price-input');
    p.value = '17';
    p.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await tap(page, '.shop-price .actions button', 'Set price');
  await page.waitFor(`!document.querySelector('.shop-qty-input')`, 'the window to close');
  s = await places(page);
  if (!s[1]?.includes('×3') || !s[1]?.includes('17')) throw new Error(`the place does not read 3 at 17: ${JSON.stringify(s)}`);
  const file = await saved(page);
  const draft = file.stallDraft as { item: string; qty: number; price: number }[] | undefined;
  if (!draft?.[1] || draft[1].qty !== 3 || draft[1].price !== 17) throw new Error(`the save holds ${JSON.stringify(draft)}`);
  if ('stall' in file && file.stall !== undefined) throw new Error('a stall marker was written although none was placed');
  log('3 at 17 gold, in the save');

  // a reload brings it back
  await continueGame(page, url);
  s = await openShop(page);
  if (!s[1]?.includes('×3') || !s[1]?.includes('17')) throw new Error(`the place did not survive a reload: ${JSON.stringify(s)}`);
  log('still 3 at 17 after a reload');

  // the place opens on what it holds, and comes off
  await tap(page, '.shop-slot', label);
  await page.waitFor(`!!document.querySelector('.shop-qty-input')`, 'the window');
  const shown = await page.eval<string[]>(`[document.querySelector('.shop-qty-input').value, document.querySelector('.shop-price-input').value]`);
  if (shown[0] !== '3' || shown[1] !== '17') throw new Error(`the window opened on ${JSON.stringify(shown)}, not on the place`);
  await tap(page, '.shop-price .actions button', 'Take it off');
  await page.waitFor(`!document.querySelector('.shop-qty-input')`, 'the window to close');
  s = await places(page);
  if (!s[1]?.includes('drop here')) throw new Error(`the place did not empty: ${JSON.stringify(s)}`);
  if ('stallDraft' in (await saved(page))) throw new Error('an empty draft is still written to the save');
  log('taken off, and the field is gone from the save');

  // and it stays off
  await continueGame(page, url);
  s = await openShop(page);
  if (!s.every((x) => x.includes('drop here'))) throw new Error(`the emptied place came back: ${JSON.stringify(s)}`);
  log('empty after a second reload');

  // one of a thing in the bag: the window cannot offer five
  await page.eval(`(() => {
    const s = window.__game.session, bag = s.state.player.bag;
    for (const id of Object.keys(bag)) bag[id] = 1;
    s.save();
  })()`);
  await openShop(page);
  await tap(page, '.shop-item', label);
  await tap(page, '.shop-slot', 'Stall 2');
  await page.waitFor(`!!document.querySelector('.shop-qty-input')`, 'the window');
  await page.eval(`(() => {
    const q = document.querySelector('.shop-qty-input');
    q.value = '5';
    q.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await tap(page, '.shop-price .actions button', 'Set price');
  await page.waitFor(`!document.querySelector('.shop-qty-input')`, 'the window to close');
  const one = await saved(page);
  const capped = one.stallDraft as { item: string; qty: number }[] | undefined;
  if (capped?.[1]?.qty !== 1) throw new Error(`five asked for and one carried wrote ${JSON.stringify(capped?.[1])}`);
  log('five asked for, one carried: one offered');
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
        await page.screenshot(join(OUT, `shop-${name}-failed.png`)).catch(() => undefined);
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      } finally {
        page.close();
        // Chrome writes into its profile as it goes; a moment before the browser is closed keeps that write out of the profile's removal
        await sleep(300);
      }
      console.log(`shop: ${name} passed`);
    }
  } finally {
    // a failing profile removal must not hide the check that failed
    await browser.close().catch((error: unknown) => console.error(`shop: closing Chrome: ${error instanceof Error ? error.message : error}`));
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
