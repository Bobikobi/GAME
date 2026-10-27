/**
 * Proves a trader's counter in a real browser, on a phone and on a desktop (DECISIONS 2026-10-22,
 * decision 51: a shop never shows one unsorted list). Pell's stall shows its stock in named groups,
 * every offer inside one, with the item drawn, its price and what it does; the strip of group names
 * jumps to a group; a buy from a group works. Two keepers the content does not have yet, an inn and a
 * workshop stall, are put into the page's bundle as test fixtures and open with no code of their own:
 * the inn shows its food and its medicine, and sells nothing back; the workshop shows a recipe, marked
 * as known once the player knows it. Every check waits on a condition, never a fixed time.
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
  await page.tapWhere(byText(selector, text, true), `${selector} "${text}"`, 10_000);
  await sleep(120);
}

/**
 * In the page: an inn and a workshop stall that the content does not have yet, as plain data in the
 * bundle the game runs (an npc with a shop, the shop, one recipe scrap). Both keepers stand on Pell's
 * place, so the same tile trades with all three.
 */
const FIXTURES = `(() => {
  const b = window.__game.bundle;
  const recipe = Object.keys(b.recipes).sort()[0];
  b.items['test/rope-scrap'] = { ...b.items['core/berry'], id: 'test/rope-scrap', name: 'How to twist rope', kind: 'fragment', food: undefined, fragment: { unlocks: recipe } };
  const meta = { creator: 'test', file: 'test.json' };
  b.shops['test/inn'] = { ...meta, id: 'test/inn', title: 'The inn', buys: false,
    sells: ['core/herb-tea', 'core/first-aid-kit', 'core/berry', 'core/berry-mash'].map((item) => ({ item, price_mg: 5000 })) };
  b.shops['test/workshop'] = { ...meta, id: 'test/workshop', title: 'The workshop stall', buys: false, sells: [{ item: 'test/rope-scrap', price_mg: 20000 }] };
  const pell = b.npcs['core/trader'];
  const keeper = (id, name, shop) => ({ ...pell, id, name, shop, topics: [], remarks: [], dialogue: { stranger: ['Have a look.'] } });
  b.npcs['test/innkeeper'] = keeper('test/innkeeper', 'Wenna', 'test/inn');
  b.npcs['test/workshop-keeper'] = keeper('test/workshop-keeper', 'Ketil', 'test/workshop');
  return recipe;
})()`;

/** In the page: the player stands on a tile Pell trades from, with gold enough for the counter. */
const AT_PELL = `(() => {
  const g = window.__game, s = g.session, b = g.bundle;
  s.state.player.gold = 1000000;
  const slot = b.map.slots.find((x) => x.id === b.npcs['core/trader'].place.slot);
  for (let r = 0; r < 4; r++)
    for (let dy = -r; dy <= r + slot.h; dy++)
      for (let dx = -r; dx <= r + slot.w; dx++) {
        const at = [slot.x + dx, slot.y + dy];
        if (s.check({ t: 'buy', npc: 'core/trader', item: 'core/basket', qty: 1, at }) === undefined) {
          s.pos = at;
          return at;
        }
      }
  return null;
})()`;

interface Counter {
  title: string;
  tabs: string[];
  jump: string[];
  groups: { name: string; rows: { name: string; price: string; line: string; drawn: boolean }[] }[];
  loose: number;
}

const COUNTER = `(() => {
  const p = document.querySelector('.panel.shop');
  if (!p) return null;
  const groups = [...p.querySelectorAll('.shop-group')].map((g) => ({
    name: g.querySelector('.shop-group-name')?.textContent ?? '',
    rows: [...g.querySelectorAll('.row')].map((r) => ({
      name: r.querySelector('b')?.textContent ?? '',
      price: r.querySelector('.price')?.textContent ?? '',
      line: r.querySelector('.grow .muted')?.textContent ?? '',
      drawn: !!r.querySelector('.sprite:not(.missing)'),
    })),
  }));
  return {
    title: p.querySelector('header h2, header')?.textContent ?? '',
    tabs: [...p.querySelectorAll('.tabs button')].map((b) => b.textContent),
    jump: [...p.querySelectorAll('.shop-jump button')].map((b) => b.textContent),
    groups,
    loose: [...p.querySelectorAll('.row')].filter((r) => !r.closest('.shop-group')).length,
  };
})()`;

async function counter(page: Page): Promise<Counter> {
  return page.waitFor<Counter>(`(() => { const c = ${COUNTER}; return c && (c.groups.length || document.querySelector('.panel.shop .panel-body p')) ? c : null; })()`, 'the counter');
}

/** Talks to a keeper through the page's own dialog and picks Trade. */
async function trade(page: Page, viewport: Viewport, npc: string): Promise<Counter> {
  await page.eval(`window.__game.ui.closeAll(); void window.__game.ui.talk(${JSON.stringify(npc)})`);
  for (let i = 0; i < 40; i++) {
    if (await page.eval<boolean>(`!!document.querySelector('.panel.shop')`)) break;
    const trading = await page.eval<boolean>(`[...document.querySelectorAll('.dialog-options button')].some((b) => b.textContent.includes('Trade') && b.getBoundingClientRect().width > 0)`);
    if (trading) await tap(page, '.dialog-options button', 'Trade');
    else if (viewport.mobile) await page.tap('.tbtn.a');
    else await page.press('Enter');
    await sleep(200);
  }
  return counter(page);
}

function expectGroups(c: Counter, want: [string, string[]][], where: string): void {
  const got = c.groups.map((g) => [g.name, g.rows.map((r) => r.name)]);
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${where} shows ${JSON.stringify(got)}, not ${JSON.stringify(want)}`);
  if (c.loose) throw new Error(`${where} has ${c.loose} rows outside a group`);
  for (const g of c.groups)
    for (const r of g.rows) {
      if (!r.drawn) throw new Error(`${where}: ${r.name} is not drawn`);
      if (!/\d/.test(r.price)) throw new Error(`${where}: ${r.name} has no price`);
      if (!r.line) throw new Error(`${where}: ${r.name} does not say what it does`);
    }
}

async function run(page: Page, url: string, viewport: Viewport, name: string): Promise<void> {
  const log = (msg: string) => console.log(`[${name}] ${msg}`);
  const shot = (what: string) => page.screenshot(join(OUT, `shop-stock-${name}-${what}.png`));
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
    if (viewport.mobile) await page.tap('.tbtn.a');
    else await page.press('Enter');
    await sleep(220);
  }
  const recipe = await page.eval<string>(FIXTURES);
  const at = await page.eval<[number, number] | null>(AT_PELL);
  if (!at) throw new Error('no tile near Pell trades');
  log(`at Pell's counter from ${at.join(',')}`);

  // Pell's stall: the stock in named groups, every offer in one, drawn, priced and saying what it does
  let c = await trade(page, viewport, 'core/trader');
  if (!c.title.includes("Pell's stall")) throw new Error(`the counter is titled "${c.title}"`);
  expectGroups(
    c,
    [
      ['Tools', ['Basket', 'Trowel', 'Axe', 'Walking staff']],
      ['To wear', ['Satchel']],
      ['Food and drink', ['Redberry', 'Herb tea', 'Berry mash']],
      ['Medicine', ['First-aid kit']],
    ],
    "Pell's stall",
  );
  if (c.jump.length !== 4 || !c.jump[0]!.startsWith('Tools')) throw new Error(`the strip reads ${JSON.stringify(c.jump)}`);
  await shot('pell');
  log(`Pell: ${c.groups.map((g) => `${g.name} ${g.rows.length}`).join(', ')}`);

  // the strip jumps to a group, and a buy from it works
  await tap(page, '.shop-jump button', 'Medicine');
  // the strip scrolls smoothly: the group is in view once the scroll has come to rest, not as it passes by
  await page.waitFor(
    `(async () => {
      const s = document.querySelector('.shop-group[data-group="medicine"]'), b = document.querySelector('.panel.shop .panel-body');
      const top = b.scrollTop;
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      if (b.scrollTop !== top) return false;
      const r = s.getBoundingClientRect(), q = b.getBoundingClientRect();
      return r.top >= q.top - 2 && r.top < q.bottom - 40;
    })()`,
    'the medicine group in view, the scroll at rest',
    10_000,
  );
  // the jump scrolls smoothly: tap the row only once the list has come to rest, or the tap lands where the row was
  for (let i = 0, last = -1; i < 40; i++) {
    const top = await page.eval<number>(`document.querySelector('.panel.shop .panel-body').scrollTop`);
    if (top === last) break;
    last = top;
    await sleep(100);
  }
  const before = await page.eval<number>(`window.__game.session.state.player.bag['core/first-aid-kit'] ?? 0`);
  await tap(page, '.shop-group[data-group="medicine"] .row button', 'Buy');
  await page.waitFor(`(window.__game.session.state.player.bag['core/first-aid-kit'] ?? 0) === ${before + 1}`, 'a first-aid kit in the bag', 3000);
  await shot('pell-medicine');
  log('the strip jumps to Medicine, and the kit is bought from there');

  // the Sell tab is grouped the same way: a few finds of different kinds in the bag to sell
  await page.eval(`(() => {
    const g = window.__game, b = g.bundle, bag = g.session.state.player.bag;
    const sold = new Set(b.shops['core/trader-shop'].sells.map((o) => o.item));
    const seen = new Set();
    for (const id of Object.keys(b.values).sort()) {
      const it = b.items[id];
      if (!it || sold.has(id) || it.tool || seen.has(it.kind) || !(b.values[id] > 0)) continue;
      seen.add(it.kind);
      bag[id] = 2;
    }
  })()`);
  await tap(page, '.panel.shop .tabs button', 'Sell');
  c = await counter(page);
  if (c.loose || !c.groups.length) throw new Error(`the sell side shows ${JSON.stringify(c.groups.map((g) => g.name))} with ${c.loose} loose rows`);
  log(`Pell buys back: ${c.groups.map((g) => g.name).join(', ')}`);

  // a keeper added later as data: the inn, food and medicine, no sell side
  c = await trade(page, viewport, 'test/innkeeper');
  if (!c.title.includes('The inn')) throw new Error(`the inn is titled "${c.title}"`);
  expectGroups(
    c,
    [
      ['Food and drink', ['Herb tea', 'Redberry', 'Berry mash']],
      ['Medicine', ['First-aid kit']],
    ],
    'the inn',
  );
  if (c.tabs.join() !== 'Buy') throw new Error(`the inn shows the tabs ${JSON.stringify(c.tabs)}`);
  await shot('inn');
  log('the inn: food and drink, medicine, nothing bought back');

  // the workshop stall: a recipe, and one the player knows is marked and not sold twice
  c = await trade(page, viewport, 'test/workshop-keeper');
  expectGroups(c, [['Recipes', ['How to twist rope']]], 'the workshop stall');
  if (c.jump.length) throw new Error('a counter of one group shows the strip');
  await page.eval(`(() => { const p = window.__game.session.state.player; p.recipes = [...new Set([...p.recipes, ${JSON.stringify(recipe)}])]; })()`);
  await trade(page, viewport, 'test/workshop-keeper');
  const known = await page.eval<{ said: boolean; off: boolean }>(
    `(() => { const r = document.querySelector('.shop-group[data-group="recipe"] .row'); return { said: !!r.querySelector('[data-known]'), off: !!r.querySelector('button').disabled }; })()`,
  );
  if (!known.said || !known.off) throw new Error(`a known recipe reads ${JSON.stringify(known)}`);
  await shot('workshop');
  log('the workshop stall: a recipe, marked once known');
  await page.eval(`window.__game.ui.closeAll()`);
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
        await page.screenshot(join(OUT, `shop-stock-${name}-failed.png`)).catch(() => undefined);
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      } finally {
        page.close();
        await sleep(300);
      }
      console.log(`shop-stock: ${name} passed`);
    }
  } finally {
    await browser.close().catch((error: unknown) => console.error(`shop-stock: closing Chrome: ${error instanceof Error ? error.message : error}`));
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
