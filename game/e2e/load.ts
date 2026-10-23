/**
 * Proves the load in a real browser, on a phone and on a desktop (DECISIONS.md, 2026-10-23: races, weight
 * and bags): the bag button reads "N / 12" and one coloured word, a thing picked up off the ground turns
 * Light into Steady, a satchel on the back raises the places to 24 (26 for a human, who packs well), a load
 * over the limit reads Heavy and says so once, and a heavy walk is slower than a light one. On the desktop
 * the same save then loads at /play3d/, whose bag button shows the same count and word.
 *
 *   pnpm build && pnpm e2e:load [out-dir]
 *
 * Serves game/dist at /play/ and, when it is built, game/dist-3d at /play3d/. Every check waits on a
 * condition, never a fixed time; the walk is timed against the page's own clock.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page, type Viewport } from './cdp';
import { seedQuery } from './wakes';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS: Record<string, string> = { '/play/': join(GAME_DIR, 'dist'), '/play3d/': join(GAME_DIR, 'dist-3d') };
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e'));
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

function serve(): Promise<{ server: Server; url: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')).replace(/^(\.\.[/\\])+/, '');
      const prefix = Object.keys(ROOTS).find((p) => path.startsWith(p));
      const root = prefix ? ROOTS[prefix]! : undefined;
      let file = root ? join(root, path.slice(prefix!.length)) : '';
      if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!root || !file.startsWith(root) || !existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      ok({ server, url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}` });
    });
  });
}

/**
 * Helpers that live in the page. The load's arithmetic is the kernel's (kernel/src/load.ts), restated only
 * to choose how much to put in the bag; every check reads the bag button, which the kernel paints.
 */
const IN_PAGE = `
window.__load = (() => {
  const g = () => window.__game;
  const st = () => g().session.state;
  const b = () => g().bundle;
  const weightOf = (id) => b().items[id]?.weight ?? 1;
  const weight = () => Object.entries(st().player.bag).reduce((n, [id, q]) => n + q * weightOf(id), 0);
  const body = (effect, fallback) => b().races[st().player.race]?.body?.effects.find((e) => e.effect === effect)?.value ?? fallback;
  const bonus = () => {
    const id = st().player.worn.back;
    const w = id ? b().items[id]?.wear : undefined;
    return w && !w.look ? (w.load_bonus ?? 0) : 0;
  };
  // the wake pockets lie in the valley, which grades no race: might counts as it stands
  const limit = () => b().params.load.base + b().params.per_point.might * st().player.attrs.might + bonus();
  const band = (w) => {
    const pace = Math.floor((w * body('pace_load_permille', 1000)) / 1000);
    if (pace * 1000 <= limit() * b().params.load.light_permille) return 'light';
    return pace <= limit() ? 'steady' : 'heavy';
  };
  /** Stones (3 each) and branches (1 each) into the bag until it weighs \`target\`. */
  const fillTo = (target) => {
    const bag = st().player.bag;
    const need = target - weight();
    if (need < 0) throw new Error('the bag already weighs ' + weight());
    const stones = Math.floor(need / 3);
    if (stones > 0) bag['core/stone'] = (bag['core/stone'] ?? 0) + stones;
    if (need - stones * 3 > 0) bag['core/branch'] = (bag['core/branch'] ?? 0) + need - stones * 3;
    g().session.save();
    return weight();
  };
  const chip = () => {
    const c = document.querySelector('.hud [data-load]');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return {
      count: c.querySelector('.load-count')?.textContent ?? '',
      word: c.querySelector('.load-word')?.textContent ?? '',
      band: c.dataset.band ?? '',
      title: c.title,
      shown: r.width > 0 && r.height > 0,
    };
  };
  return { weight, limit, band, fillTo, chip };
})();
`;

interface Chip {
  count: string;
  word: string;
  band: string;
  title: string;
  shown: boolean;
}

const chip = (page: Page) => page.eval<Chip | null>('window.__load.chip()');

/** Waits until the bag button reads a word (and, given, a count), and returns what it reads. */
async function chipReads(page: Page, word: string, count?: RegExp): Promise<Chip> {
  try {
    await page.waitFor(
      `(() => { const c = window.__load.chip(); return !!c && c.shown && c.word === ${JSON.stringify(word)}${count ? ` && ${count.toString()}.test(c.count)` : ''}; })()`,
      `the bag button to read ${word}${count ? ` and ${count}` : ''}`,
    );
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : error}; it reads ${JSON.stringify(await chip(page))}`, { cause: error });
  }
  return (await chip(page))!;
}

/**
 * Holds an arrow key along the longest open straight line from where the player stands and times the
 * tiles with the page's clock: the milliseconds a tile, from the second tile to the sixth.
 */
async function walkMs(page: Page): Promise<number> {
  const dir = await page.eval<{ key: string; run: number }>(`(() => {
    const s = window.__game.session, w = window.__game.world;
    const dirs = [['ArrowRight', 1, 0], ['ArrowLeft', -1, 0], ['ArrowDown', 0, 1], ['ArrowUp', 0, -1]];
    let best = { key: '', run: 0 };
    for (const [key, dx, dy] of dirs) {
      let run = 0;
      while (run < 12 && w.canWalk(s, s.pos[0] + dx * (run + 1), s.pos[1] + dy * (run + 1))) run++;
      if (run > best.run) best = { key, run };
    }
    return best;
  })()`);
  if (dir.run < 7) throw new Error(`no straight walk of 7 tiles from where the player stands (best ${dir.run})`);
  await page.waitFor('!window.__game.session.busy && !window.__game.ui.blocking && !window.__game.world.move', 'the player to be free to walk');
  await page.eval(`(() => {
    const w = (window.__walk = { times: [], last: window.__game.session.pos.join(','), on: true });
    const tick = () => {
      const p = window.__game.session.pos.join(',');
      if (p !== w.last) { w.last = p; w.times.push(performance.now()); }
      if (w.on) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })()`);
  await page.key(dir.key, 'keyDown');
  try {
    await page.waitFor('window.__walk.times.length >= 6', 'six tiles walked', 20_000);
  } finally {
    await page.key(dir.key, 'keyUp');
    await page.eval('window.__walk.on = false');
  }
  const times = await page.eval<number[]>('window.__walk.times');
  await page.waitFor('!window.__game.world.move', 'the walk to stop');
  return (times[5]! - times[1]!) / 4;
}

async function newGame(page: Page, base: string, viewport: Viewport, race: string): Promise<void> {
  await page.goto(`${base}/play/?debug`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.eval(`localStorage.clear()`);
  await page.goto(`${base}/play/?debug${seedQuery(viewport.mobile ? 'core/west-bank' : 'core/north-meadow')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.tap('.title-screen button', 'New game');
  const ask = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (ask === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards');
  await page.tap('.card.race', race);
  await page.tap('input.name');
  await page.type('Carrier');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor(`!!window.__game?.session?.started`, 'the game', 30_000);
  for (let i = 0; i < 40; i++) {
    if (!(await page.eval<boolean>(`!!document.querySelector('.dialog')`))) break;
    if (viewport.mobile) await page.tap('.tbtn.a');
    else await page.press('Enter');
    await sleep(220);
  }
  await page.eval(IN_PAGE);
}

async function run(page: Page, base: string, viewport: Viewport): Promise<void> {
  const log = (msg: string) => console.log(`[${viewport.mobile ? 'phone' : 'desktop'}] ${msg}`);
  // the phone wakes an elf, the desktop a human: the human packs two places more into any bag
  const race = viewport.mobile ? 'Elf' : 'Human';
  const satchelPlaces = viewport.mobile ? 24 : 26;
  await newGame(page, base, viewport, race);

  // 1. a new character: no bag on the back, 12 places, a light load
  let c = await chipReads(page, 'Light', /\/ 12$/);
  log(`wakes reading "${c.count} ${c.word}"`);
  if (!/Load \d+ of \d+/.test(c.title)) throw new Error(`the weight is not on demand in the title: "${c.title}"`);
  const light = await walkMs(page);
  log(`a light tile takes ${light.toFixed(0)} ms`);

  // 2. a thing picked up off the ground turns Light into Steady: the bag is filled to the last light weight,
  //    then the pocket's tool is picked up through the kernel, as the "Pick up" prompt does
  const ground = await page.eval<{ spot: string; item: string; at: [number, number] } | null>(`(() => {
    const g = window.__game, b = g.bundle, s = g.session, p = s.state.player;
    const lays = (b.pockets[p.pocket]?.ground ?? []).map((k) => k.item);
    for (const [id, i] of Object.entries(b.instances)) {
      const t = i.kind === 'treasure' ? b.treasures[i.source] : undefined;
      if (!t || t.pocket !== p.pocket || t.tool || !t.finds.every((f) => lays.includes(f.item))) continue;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const at = [i.x + dx, i.y + dy];
        if (g.world.canWalk(s, at[0], at[1])) return { spot: id, item: t.finds[0].item, at };
      }
    }
    return null;
  })()`);
  if (!ground) throw new Error('no ground spot by the wake to pick a tool up from');
  const target = await page.eval<number>(`(() => {
    const L = window.__load, each = window.__game.bundle.items[${JSON.stringify(ground.item)}].weight;
    let w = L.weight();
    while (L.band(w + 1) === 'light') w++;
    if (L.band(w + each) === 'light') throw new Error('one ' + ${JSON.stringify(ground.item)} + ' does not tip the load');
    return w;
  })()`);
  await page.eval(`window.__load.fillTo(${target})`);
  c = await chipReads(page, 'Light');
  const before = Number(c.count.split('/')[0]);
  const picked = await page.eval<{ ok: boolean; error?: string }>(`(() => {
    const s = window.__game.session;
    const r = s.act({ t: 'dig', spot: ${JSON.stringify(ground.spot)}, grade: 3, at: ${JSON.stringify(ground.at)} });
    s.pos = [...s.state.player.at];
    return r;
  })()`);
  if (!picked.ok) throw new Error(`picking up ${ground.item} was refused: ${picked.error}`);
  c = await chipReads(page, 'Steady', new RegExp(`^${before + 1} / 12$`));
  log(`picked up ${ground.item} at ${target} weight: "${c.count} ${c.word}"`);
  await page.waitFor('!window.__game.session.busy', 'the pick-up to end', 20_000);

  // 3. a satchel on the back: 24 places (26 for a human), and the satchel itself takes none
  const worn = await page.eval<{ ok: boolean; error?: string }>(`(() => {
    const s = window.__game.session;
    s.state.player.bag['core/satchel'] = 1;
    return s.act({ t: 'wear', item: 'core/satchel' });
  })()`);
  if (!worn.ok) throw new Error(`the satchel did not go on: ${worn.error}`);
  c = await chipReads(page, 'Steady', new RegExp(`^${before + 1} / ${satchelPlaces}$`));
  log(`a satchel on the back: "${c.count} ${c.word}"`);

  // 4. over the limit: Heavy, said once, and the walk slows
  await page.eval(`(() => {
    const L = window.__load;
    let w = L.weight();
    while (L.band(w) !== 'heavy') w++;
    L.fillTo(w);
  })()`);
  c = await chipReads(page, 'Heavy');
  await page.waitFor(`[...document.querySelectorAll('.toast-text')].some((t) => t.textContent.includes('Heavy going.'))`, 'the one line that says the load turned heavy');
  log(`over the limit: "${c.count} ${c.word}", and "Heavy going."`);
  const heavy = await walkMs(page);
  log(`a heavy tile takes ${heavy.toFixed(0)} ms`);
  // 230 against 170 ms a tile: a frame can only add to a step, so the heavy walk stays the slower by a margin
  if (heavy < 200 || heavy < light * 1.15) throw new Error(`a heavy tile took ${heavy.toFixed(0)} ms against ${light.toFixed(0)} ms light: the load does not slow the walk`);

  // 5. the same save at the 3D door: the bag button reads the same
  if (!viewport.mobile && existsSync(join(ROOTS['/play3d/']!, 'index.html'))) {
    await page.eval('window.__game.session.save()');
    const want = c.count;
    await page.goto(`${base}/play3d/?debug&lite`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the 3D title screen', 60_000);
    await page.tap('.title-screen button', 'Continue');
    await page.waitFor('!!window.__game.session && window.__game.session.started', 'the 3D game', 60_000);
    await page.eval(IN_PAGE);
    c = await chipReads(page, 'Heavy', new RegExp(`^${want}$`));
    log(`/play3d/ reads "${c.count} ${c.word}"`);
  } else if (!viewport.mobile) {
    log('no game/dist-3d: the 3D door is optional, so its bag button is not checked');
  }
  if (page.errors.length > 0) throw new Error(`page errors: ${page.errors.join(' | ')}`);
}

async function main(): Promise<void> {
  if (!existsSync(join(ROOTS['/play/']!, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const { server, url } = await serve();
  const browser = await Browser.launch();
  try {
    for (const [name, viewport] of [
      ['phone', { width: 390, height: 844, mobile: true }],
      ['desktop', { width: 1440, height: 900, mobile: false }],
    ] as [string, Viewport][]) {
      if (process.env.E2E_ONLY && process.env.E2E_ONLY !== name) continue;
      const page = await browser.newPage(viewport);
      try {
        await run(page, url, viewport);
      } catch (error) {
        await page.screenshot(join(OUT, `load-${name}-failed.png`)).catch(() => undefined);
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      } finally {
        page.close();
        await sleep(300);
      }
      console.log(`load: ${name} passed`);
    }
  } finally {
    await browser.close().catch((error: unknown) => console.error(`load: closing Chrome: ${error instanceof Error ? error.message : error}`));
    server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
