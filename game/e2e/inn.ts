/**
 * Proves the inn in a real browser, on a desktop first and on a phone: Wenna keeps the inn at the town's
 * edge, her counter sells the food and the first-aid kit (decision 32) and buys nothing back, her bed is
 * refused by day and taken from dusk, the night in it wakes the player at 05:00 with full health (G16, G32),
 * and Maru, home at dawn, is out on his round by mid-morning (decision 27). Every check waits on a
 * condition, never a fixed time.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page, type Viewport } from './cdp';
import { TAKE_GROUND, seedQuery } from './wakes';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(GAME_DIR, 'dist');
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e'));
const INN = 'core/innkeeper';
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

const IN_PAGE = `
window.__inn = (() => {
  const g = () => window.__game;
  return {
    setHour(h) {
      const s = g().session, day = g().bundle.params.day_length_ms, q = Math.floor(day / 2);
      let t = s.tick - ((s.tick + q) % day) + Math.round((h / 24) * day);
      if (t < s.tick) t += day;
      s.tick = t;
    },
    hour() {
      const s = g().session, day = g().bundle.params.day_length_ms;
      return (((s.tick + Math.floor(day / 2)) % day) * 24) / day;
    },
    /** Stands the player beside Wenna, on the first tile her counter answers from. */
    toInn() {
      const s = g().session, b = g().bundle, p = s.state.player;
      p.gold = Math.max(p.gold, 100000);
      const slot = b.map.slots.find((x) => x.id === b.npcs[${JSON.stringify(INN)}].place.slot);
      const c = [slot.x + Math.floor(slot.w / 2), slot.y + Math.floor(slot.h / 2)];
      for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [-1, 1], [1, 1], [0, -1]]) {
        const at = [c[0] + dx, c[1] + dy];
        if (s.check({ t: 'buy', npc: ${JSON.stringify(INN)}, item: 'core/berry', qty: 1, at }) !== undefined) continue;
        s.pos = [at[0], at[1]];
        p.at = [at[0], at[1]];
        g().world.bind(s);
        return at;
      }
      throw new Error('no tile beside the innkeeper');
    },
    /** Stands the player below Maru's hearth, for the dusk capture. */
    toHearth() {
      const s = g().session, b = g().bundle, p = s.state.player;
      const h = b.map.props.find((x) => x.kept);
      const at = [h.x, h.y + 1];
      s.pos = [at[0], at[1]];
      p.at = [at[0], at[1]];
      g().world.bind(s);
      return at;
    },
    hurt() { g().session.state.player.hp = 1000; },
    hp() { return g().session.state.player.hp; },
    toasts() { return [...document.querySelectorAll('.toast')].map((e) => e.textContent).join(' | '); },
    dialog() { const d = document.querySelector('.dialog'); return d ? d.textContent : ''; },
    /** Where the Phaser scene draws a walking keeper (the 2D map's walkers). */
    walker(id) { const w = (g().world.walkers || []).find((x) => x.id === id); return w ? w.at.join(',') : ''; },
    home(id) {
      const b = g().bundle, slot = b.map.slots.find((x) => x.id === b.npcs[id].place.slot);
      return [slot.x + Math.floor(slot.w / 2), slot.y + Math.floor(slot.h / 2)].join(',');
    },
  };
})();
`;

/** Taps a dialogue option, saying through every box before it; throws when other options stand instead. */
async function choose(page: Page, label: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const options = await page.eval<string[]>(`(() => {
      const d = document.querySelector('.dialog');
      return d ? [...d.querySelectorAll('.dialog-options button')].map((b) => b.textContent ?? '') : [];
    })()`);
    if (options.some((option) => option.includes(label))) {
      await page.tap('.dialog-options button', label);
      return;
    }
    if (options.length > 0) throw new Error(`dialogue offered ${options.join(' | ')}, not "${label}"`);
    if (await page.eval<boolean>('!!document.querySelector(".dialog")')) await page.press('Enter');
    await sleep(100);
  }
  throw new Error(`dialogue never offered "${label}"`);
}

/** Says through every open box until none is left. */
async function clear(page: Page): Promise<string[]> {
  const said: string[] = [];
  for (let i = 0; i < 40; i++) {
    const text = await page.eval<string>('__inn.dialog()');
    if (!text) break;
    said.push(text);
    await page.press('Enter');
    await sleep(150);
  }
  await page.waitFor('!__game.ui.blocking && !document.querySelector(".dialog")', 'the dialogue to close', 10_000);
  return said;
}

async function run(page: Page, url: string, viewport: Viewport, name: string): Promise<void> {
  const log = (msg: string) => console.log(`[${name}] ${msg}`);
  const shot = (what: string) => page.screenshot(join(OUT, `inn-${name}-${what}.png`));
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
  await page.tap('input.name');
  await page.type('Guest');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor(`!!window.__game?.session?.started`, 'the game', 30_000);
  await page.eval(TAKE_GROUND);
  await page.eval(IN_PAGE);
  await clear(page);

  // the day: Wenna at her counter, the food and the kit on it, nothing bought back, no bed yet
  await page.eval('__inn.setHour(14)');
  await page.eval('__inn.toInn()');
  await sleep(300);
  await page.eval(`void __game.ui.talk(${JSON.stringify(INN)})`);
  await page.waitFor(`__inn.dialog().includes('Wenna')`, 'Wenna to speak', 5000);
  await shot('meet');
  await choose(page, 'Trade');
  await page.waitFor(`!!document.querySelector('.panel.shop')`, 'the inn counter', 5000);
  const goods = await page.eval<string[]>(`[...document.querySelectorAll('.panel.shop .row b')].map((e) => e.textContent)`);
  for (const want of ['Herb tea', 'Berry mash', 'First-aid kit']) {
    if (!goods.some((g) => g.includes(want))) throw new Error(`the inn counter lacks ${want}: ${goods.join(', ')}`);
  }
  const tabs = await page.eval<string[]>(`[...document.querySelectorAll('.panel.shop .tabs button')].map((e) => e.textContent)`);
  if (tabs.some((t) => /sell/i.test(t))) throw new Error(`the inn buys things back: ${tabs.join(', ')}`);
  await shot('counter');
  const kits = await page.eval<number>(`__game.session.state.player.bag['core/first-aid-kit'] ?? 0`);
  await page.eval(`(() => {
    for (const row of document.querySelectorAll('.panel.shop .row')) {
      if (row.textContent.includes('First-aid kit')) { row.querySelector('button').click(); return; }
    }
  })()`);
  await page.waitFor(`(__game.session.state.player.bag['core/first-aid-kit'] ?? 0) === ${kits + 1}`, 'a first-aid kit from the inn', 5000);
  log(`the counter: ${goods.join(', ')}; a kit bought, nothing bought back`);
  await page.eval('__game.ui.closeAll()');
  await sleep(200);

  // Pell keeps the raw materials and the gear: no food on her counter
  const pell = await page.eval<string[]>(`__game.bundle.shops[__game.bundle.npcs['core/trader'].shop].sells.map((o) => o.item)`);
  if (pell.some((id) => ['core/berry', 'core/herb-tea', 'core/berry-mash', 'core/first-aid-kit'].includes(id))) {
    throw new Error(`Pell still sells food or the kit: ${pell.join(', ')}`);
  }

  // the bed by day: refused in the kernel's words, the clock untouched
  const before = await page.eval<number>('__game.session.tick');
  await page.eval(`void __game.ui.talk(${JSON.stringify(INN)})`);
  await choose(page, 'Sleep until dawn');
  await page.waitFor(`__inn.toasts().includes('The beds are for the night')`, 'the day refusal', 5000);
  if ((await page.eval<number>('__game.session.tick')) - before > 60_000) throw new Error('a refused bed moved the clock');
  log('the bed by day: refused');
  await sleep(400);

  // the bed at dusk: a night in it, awake at 05:00, health in full. On the way, Maru's hearth, lit while he is home
  await page.eval('__inn.setHour(19.5)');
  await page.eval('__inn.toHearth()');
  await sleep(800);
  await shot('hearth');
  await page.eval('__inn.toInn()');
  await sleep(300);
  await page.eval('__inn.hurt()');
  await page.eval(`void __game.ui.talk(${JSON.stringify(INN)})`);
  await choose(page, 'Sleep until dawn');
  await page.waitFor(`__inn.dialog().includes('You sleep')`, 'the night box', 5000);
  await shot('sleep');
  await clear(page);
  const hour = await page.eval<number>('__inn.hour()');
  if (hour < 5 || hour >= 5.5) throw new Error(`woke at ${hour.toFixed(2)}, not 05:00`);
  const hp = await page.eval<number>('__inn.hp()');
  if (hp <= 1000) throw new Error('slept hurt: health still 1000');
  await shot('dawn');
  log(`slept: awake at ${hour.toFixed(2)}, health ${hp}`);

  // Maru sees the dawn in at home, and walks his round by mid-morning
  const home = await page.eval<string>(`__inn.home('core/elder')`);
  await page.waitFor(`__inn.walker('core/elder') === ${JSON.stringify(home)}`, 'Maru at home at dawn', 5000);
  await page.eval('__inn.setHour(9)');
  await page.waitFor(`__inn.walker('core/elder') !== '' && __inn.walker('core/elder') !== ${JSON.stringify(home)}`, 'Maru out on his round at 09:00', 5000);
  log(`Maru at ${home} at dawn, at ${await page.eval<string>(`__inn.walker('core/elder')`)} at 09:00`);
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  try {
    // a PC game first: the desktop run comes before the phone's
    for (const [name, viewport] of [
      ['desktop', { width: 1440, height: 900, mobile: false }],
      ['phone', { width: 390, height: 844, mobile: true }],
    ] as [string, Viewport][]) {
      const page = await browser.newPage(viewport);
      try {
        await run(page, remote ?? local?.url ?? '', viewport, name);
      } catch (error) {
        await page.screenshot(join(OUT, `inn-${name}-failed.png`)).catch(() => undefined);
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      } finally {
        page.close();
        await sleep(300);
      }
      console.log(`inn: ${name} passed`);
    }
  } finally {
    await browser.close().catch((error: unknown) => console.error(`inn: closing Chrome: ${error instanceof Error ? error.message : error}`));
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
