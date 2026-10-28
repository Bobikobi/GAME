/**
 * Proves the shop you walk into, in a real browser, on a phone and on a desktop (NEXT section 5, frame C of
 * 2026-10-11): Pell's door is a tile on the map; pushing up into it from the step in front changes the scene to
 * a room, nothing opens at the door, the keeper is talked to across the counter, the trade opens from her
 * dialogue, a purchase inside takes exactly the price the content names, and walking out of the door puts the
 * valley back with the player on the doorstep facing out. The price is read from the bundle, never written here.
 * Every check waits on a condition, never a fixed time.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, byText, sleep, type Page, type Viewport } from './cdp';
import { TAKE_GROUND, carveIn, seedQuery } from './wakes';
import { FreeWalk } from './walk';

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

/** In a shop's room (scenes/room.ts): the tile in front of the counter, and the tile above the door. */
const IN_FRONT_OF_COUNTER: readonly [number, number] = [3, 5];
const ABOVE_DOOR: readonly [number, number] = [3, 7];

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
  await page.tapWhere(byText(selector, text, true), `${selector} "${text}"`, 10_000);
  await sleep(120);
}

/** In the page: what the game says about where the player is. */
const WHERE = `(() => {
  const g = window.__game, w = g.world, s = g.session, r = w.room;
  return {
    inside: !!(r && r.ready && !r.leaving),
    valleyShown: w.cameras.main.visible,
    pos: [...s.pos],
    facing: s.facing,
    room: r && r.ready ? { pos: [...r.pos], facing: r.facing } : null,
    covered: !!document.querySelector('.panel, .dialog'),
    prompt: (() => { const p = document.querySelector('.prompt'); return p && !p.hidden ? p.textContent.slice(1).trim() : ''; })(),
  };
})()`;

interface Where {
  inside: boolean;
  valleyShown: boolean;
  pos: [number, number];
  facing: string;
  room: { pos: [number, number]; facing: string } | null;
  covered: boolean;
  prompt: string;
}

async function run(page: Page, url: string, viewport: Viewport, name: string): Promise<void> {
  const log = (msg: string) => console.log(`[${name}] ${msg}`);
  const shot = (what: string) => page.screenshot(join(OUT, `shop-interior-${name}-${what}.png`));
  const where = () => page.eval<Where>(WHERE);
  const walk = new FreeWalk(page, viewport.mobile);
  const a = async () => (viewport.mobile ? page.tap('.tbtn.a') : page.press('Enter'));

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
  await page.tap('.card.race', 'Human');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor(`!!window.__game?.session?.started`, 'the game', 30_000);
  // the name is cut at the bridge's stone, and this script is not about the stone: it is cut here
  await page.eval(carveIn('Counter'));
  await page.eval(TAKE_GROUND);
  for (let i = 0; i < 40; i++) {
    if (!(await page.eval<boolean>(`!!document.querySelector('.dialog')`))) break;
    await a();
    await sleep(220);
  }

  // what the content says: Pell's door, her shop, and the price of one basket
  const facts = await page.eval<{ door: [number, number]; title: string; price: number; basket: string }>(`(() => {
    const b = window.__game.bundle, npc = b.npcs['core/trader'], slot = b.map.slots.find((x) => x.id === npc.place.slot);
    const shop = b.shops[npc.shop];
    return { door: [slot.x, slot.y], title: shop.title, price: shop.sells.find((o) => o.item === 'core/basket').price_mg, basket: 'core/basket' };
  })()`);
  const step: [number, number] = [facts.door[0], facts.door[1] + 1];

  // on the step in front of the door, facing it, with gold enough: the walk from the camp is the opening's to prove
  await page.eval(`(() => {
    const g = window.__game, s = g.session;
    s.state.player.gold = 1000000;
    s.pos = [${step[0]}, ${step[1]}];
    s.facing = 'up';
    g.world.placePlayer(${step[0]}, ${step[1]});
  })()`);
  await page.waitFor(`(() => { const w = ${WHERE}; return w.prompt.startsWith('Enter ') ? w : null; })()`, 'the door prompt', 5000);
  let at = await where();
  if (at.inside || !at.valleyShown) throw new Error(`before the door the player is already inside: ${JSON.stringify(at)}`);
  if (!at.prompt.includes(facts.title)) throw new Error(`the door prompt is "${at.prompt}", not one naming "${facts.title}"`);
  if (at.covered) throw new Error('a panel or a box is open at the door: the trade opens from the dialogue, not from the door');
  await shot('door');
  log(`at the door of ${facts.title}: "${at.prompt}"`);

  // pushing up into the door changes the scene to the room
  await walk.pushUntil('up', `!!(window.__game.world.entering || window.__game.world.room)`, 'the door to open');
  await page.waitFor(`(() => { const w = ${WHERE}; return w.inside ? w : null; })()`, 'the room to open', 5000);
  await page.waitFor(`!window.__game.world.entering`, 'the fade into the room to end');
  await sleep(300); // the room fades in
  at = await where();
  if (at.valleyShown) throw new Error('the valley is still drawn while the player is inside the shop');
  if (at.covered) throw new Error('a panel or a box opened at the door');
  if (at.pos.join(',') !== step.join(',')) throw new Error(`the session left the doorstep: ${at.pos.join(',')}, not ${step.join(',')}`);
  await shot('inside');
  log('through the door: the scene is the room, the valley waits behind');

  // up the runner to the counter: Pell is talked to across it, and the trade opens from her dialogue
  await walk.holdTo(IN_FRONT_OF_COUNTER, 'the counter');
  await walk.turnTo('up', IN_FRONT_OF_COUNTER, 'the counter');
  at = await page.waitFor<Where>(`(() => { const w = ${WHERE}; return w.prompt.startsWith('Talk to ') ? w : null; })()`, 'the prompt at the counter', 5000);
  if (!at.prompt.includes('Pell')) throw new Error(`the counter prompt is "${at.prompt}", not one for Pell`);
  if (at.covered) throw new Error('something is open at the counter before the keeper was talked to');
  await a();
  for (let i = 0; i < 40; i++) {
    if (await page.eval<boolean>(`!!document.querySelector('.panel.shop')`)) break;
    const trading = await page.eval<boolean>(`[...document.querySelectorAll('.dialog-options button')].some((b) => b.textContent.includes('Trade') && b.getBoundingClientRect().width > 0)`);
    if (trading) await tap(page, '.dialog-options button', 'Trade');
    else await a();
    await sleep(200);
  }
  await page.waitFor(`!!document.querySelector('.panel.shop .row')`, 'the shop panel', 10_000);
  const title = await page.eval<string>(`document.querySelector('.panel.shop header')?.textContent ?? ''`);
  if (!title.includes(facts.title)) throw new Error(`the counter is titled "${title}", not "${facts.title}"`);
  log('the dialogue opened the trade');

  // a purchase inside: the gold falls by exactly the price in the content
  const gold = await page.eval<number>(`window.__game.session.state.player.gold`);
  const had = await page.eval<number>(`window.__game.session.state.player.bag[${JSON.stringify(facts.basket)}] ?? 0`);
  await page.tapWhere(
    `(() => {
      for (const r of document.querySelectorAll('.panel.shop .row')) {
        if (r.querySelector('b')?.textContent !== 'Basket') continue;
        const b = [...r.querySelectorAll('button')].find((x) => x.textContent.includes('Buy') && !x.disabled);
        if (b) return b;
      }
      return null;
    })()`,
    'Buy next to the basket',
  );
  await page.waitFor(`(window.__game.session.state.player.bag[${JSON.stringify(facts.basket)}] ?? 0) === ${had + 1}`, 'a basket in the bag', 5000);
  const paid = gold - (await page.eval<number>(`window.__game.session.state.player.gold`));
  if (paid !== facts.price) throw new Error(`the basket took ${paid} mg, the content says ${facts.price} mg`);
  await shot('bought');
  log(`bought a basket inside for ${paid} mg, the price in the content`);
  await page.tap('.panel header button', 'Close');
  await page.waitFor(`!document.querySelector('.panel.shop') && !document.querySelector('.dialog')`, 'the shop to close', 5000);

  // down the runner and out through the door: the valley is back, the player on the step, facing out
  await walk.holdTo(ABOVE_DOOR, 'the door');
  await walk.pushUntil('down', `!window.__game.world.room || window.__game.world.room.leaving`, 'the door to open');
  await page.waitFor(`!window.__game.world.room && !window.__game.world.entering`, 'the valley to come back', 5000);
  await sleep(400); // the valley fades in
  at = await where();
  if (at.inside || !at.valleyShown) throw new Error(`after the door the valley is not back: ${JSON.stringify(at)}`);
  if (at.pos.join(',') !== step.join(',') || at.facing !== 'down') throw new Error(`out at ${at.pos.join(',')} facing ${at.facing}, not on the step ${step.join(',')} facing out`);
  await shot('outside');
  log('out through the door: the valley is back and the player stands on the step, facing out');
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
        await run(page, remote ?? local?.url ?? '', viewport, name);
      } catch (error) {
        await page.screenshot(join(OUT, `shop-interior-${name}-failed.png`)).catch(() => undefined);
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      } finally {
        page.close();
        await sleep(300);
      }
      console.log(`shop-interior: ${name} passed`);
    }
  } finally {
    await browser.close().catch((error: unknown) => console.error(`shop-interior: closing Chrome: ${error instanceof Error ? error.message : error}`));
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
