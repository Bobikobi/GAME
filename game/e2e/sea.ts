/**
 * Proves the crossing in a real phone-sized browser (docs/design/SEA_CROSSING.md): before Maru's coin the jetty offers
 * nothing and a boarding is refused, after it A offers the boat, the
 * walk waits while aboard, the card names the event from its sign on, the clock runs under the card so a segment's
 * sailing ends, and a crossing takes eight acts and puts the player in at the jetty. A wrong riddle turns the boat back
 * with the bag as it was. A phone on its side shows the same card with
 * its buttons clear of the controls. Everything waits on conditions; the drawn event is set after boarding, as the draw
 * itself is the kernel's test (kernel/test/sea.test.ts).
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page } from './cdp';
import { TAKE_GROUND, carveIn, seedQuery } from './wakes';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(GAME_DIR, 'dist');
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e'));
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

const BAY = 'core/bay-crossing';
const JETTY = [8, 35];
const GATE = 'core/a-coin-for-maru';

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

async function start(page: Page, url: string): Promise<void> {
  await page.goto(`${url}?debug&rich=none${seedQuery('core/west-bank')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Human');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the character to wake', 10_000);
  await page.eval(carveIn('Tess'));
  await page.eval(TAKE_GROUND);
  await clearDialog(page);
  // tick 0 is noon, inside the boat's hours; the walk to the jetty is the map's, this script is about the boat
  await page.eval(`(() => {
    const g = window.__game, s = g.session;
    s.pos = [${JETTY[0]}, ${JETTY[1]}];
    s.state.player.at = [${JETTY[0]}, ${JETTY[1]}];
    g.world.bind(s);
  })()`);
}

/** The town beat is behind the player: the boat is theirs from here. */
const openBoat = (page: Page) => page.eval(`void (window.__game.session.state.player.quests[${JSON.stringify(GATE)}] = 'done')`);

async function clearDialog(page: Page): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const open = await page.eval<boolean>(`!!document.querySelector('.dialog')`);
    if (!open) return;
    await page.press('Enter');
    await sleep(80);
  }
  throw new Error('a plain dialogue did not close');
}

const card = (page: Page) => page.eval<string>(`document.querySelector('.sea-card')?.hidden === false ? document.querySelector('.sea-card').textContent : ''`);

/** Sets the event of this crossing, after the boarding drew one. */
const draw = (page: Page, id: string) =>
  page.eval(`(() => {
    const g = window.__game, a = g.session.state.player.aboard;
    a.event = g.bundle.passages[${JSON.stringify(BAY)}].events.findIndex((e) => e.id === ${JSON.stringify(id)});
    g.ui.renderHud();
  })()`);

async function board(page: Page): Promise<void> {
  await page.waitFor(`(document.querySelector('.prompt')?.textContent ?? '').includes('Board: Across the bay')`, 'the jetty to offer the boat', 15_000);
  await page.tap('.tbtn.a');
  await page.waitFor(`!!window.__game.session.state.player.aboard`, 'the boat to leave', 5000);
  await clearDialog(page);
}

/** One act: the card's Sail on, then the segment's sailing to end. Returns once the card can sail again or the boat is in. */
async function sailOn(page: Page): Promise<void> {
  await page.tap('.sea-sail');
  await page.waitFor(
    `(() => { const s = window.__game.session; return !!document.querySelector('.dialog') || !s.state.player.aboard || !s.busy; })()`,
    'the segment to end',
    30_000,
  );
  await clearDialog(page);
}

async function run(page: Page, url: string): Promise<void> {
  await start(page, url);

  // ---- before Maru's coin the jetty offers nothing, and the kernel refuses a boarding sent anyway
  await sleep(500);
  if ((await page.eval<string>(`document.querySelector('.prompt')?.textContent ?? ''`)).includes('Board')) throw new Error('the boat is offered before Maru\'s coin');
  const refused = await page.eval<{ ok: boolean; error?: string }>(`window.__game.session.act({ t: 'board', passage: ${JSON.stringify(BAY)}, at: [${JETTY[0]}, ${JETTY[1]}] })`);
  if (refused.ok || refused.error !== 'Not yet.') throw new Error(`a boarding before Maru's coin was not refused: ${JSON.stringify(refused)}`);
  await openBoat(page);

  const bagBefore = await page.eval<Record<string, number>>(`({ ...window.__game.session.state.player.bag })`);

  // ---- a full crossing: eight acts, a tend answered twice, in at the jetty
  await board(page);
  await draw(page, 'core/gulls-over-a-shoal');
  const blocked = await page.eval<boolean>(`window.__game.ui.blocking`);
  if (!blocked) throw new Error('the walk does not wait while aboard');
  if ((await card(page)).includes('Gulls')) throw new Error('the card names the event before its sign');
  await page.screenshot(join(OUT, 'sea-01-aboard.png'));

  const t0 = await page.eval<number>(`window.__game.session.tick`);
  let acts = 0;
  let held = false;
  let signSeen = false;
  while (await page.eval<boolean>(`!!window.__game.session.state.player.aboard`)) {
    const text = await card(page);
    if (text.includes('Gulls') && !signSeen) {
      signSeen = true;
      await page.screenshot(join(OUT, 'sea-02-sign.png'));
    }
    if (await page.eval<boolean>(`[...document.querySelectorAll('.sea-answer')].some((b) => b.textContent.includes('Hold on'))`)) {
      await page.tap('.sea-answer', 'Hold on');
      await sleep(50);
      await clearDialog(page);
      held = true;
    }
    await sailOn(page);
    acts++;
    if (acts > 12) throw new Error('the crossing did not end in eight acts');
  }
  const seconds = ((await page.eval<number>(`window.__game.session.tick`)) - t0) / 1000;
  if (acts !== 8) throw new Error(`the crossing took ${acts} acts, not 8`);
  if (!signSeen) throw new Error('the sign never showed on the card');
  if (!held) throw new Error('the tend could not be answered');
  const at = await page.eval<number[]>(`[...window.__game.session.state.player.at]`);
  if (at[0] !== JETTY[0] || at[1] !== JETTY[1]) throw new Error(`the boat put in at ${at.join(',')}, not the jetty`);
  const fish = await page.eval<number>(`window.__game.session.state.player.bag['core/river-fish'] ?? 0`);
  if (fish !== (bagBefore['core/river-fish'] ?? 0) + 2) throw new Error(`the tend paid ${fish} fish`);
  if (await card(page)) throw new Error('the card stayed after the landing');
  if (seconds < 60 || seconds > 150) throw new Error(`a crossing took ${seconds.toFixed(0)} s of the game's clock, outside 60 to 150`);
  console.log(`sea: a crossing of ${acts} acts in ${seconds.toFixed(0)} s of the game's clock`);

  // ---- the walk comes back at the landing
  if (await page.eval<boolean>(`window.__game.ui.blocking`)) throw new Error('the walk stayed shut after the landing');

  // ---- a wrong riddle turns the boat back, the bag as it was
  const bag = await page.eval<string>(`JSON.stringify(window.__game.session.state.player.bag)`);
  await board(page);
  await draw(page, 'core/fog-bell');
  for (let i = 0; i < 8; i++) {
    if (await page.eval<boolean>(`document.querySelectorAll('.sea-answer').length > 0`)) break;
    await sailOn(page);
  }
  if (!(await card(page)).includes('The bell rings')) throw new Error(`the riddle's clue is not on the card: ${await card(page)}`);
  await page.screenshot(join(OUT, 'sea-03-riddle.png'));
  await page.tap('.sea-answer', 'Steer left');
  await page.waitFor(`!window.__game.session.state.player.aboard`, 'the boat to turn back', 5000);
  await clearDialog(page);
  if ((await page.eval<string>(`JSON.stringify(window.__game.session.state.player.bag)`)) !== bag) throw new Error('a miss touched the bag');
  await page.screenshot(join(OUT, 'sea-04-back.png'));
}

/** A phone on its side: the same card, its buttons clear of the controls. */
async function runLandscape(page: Page, url: string): Promise<void> {
  await start(page, url);
  await openBoat(page);
  await board(page);
  await draw(page, 'core/fog-bell');
  for (let i = 0; i < 8; i++) {
    if (await page.eval<boolean>(`document.querySelectorAll('.sea-answer').length > 0`)) break;
    await sailOn(page);
  }
  await page.screenshot(join(OUT, 'sea-05-landscape.png'));
  const clash = await page.eval<string[]>(`(() => {
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const acts = [...document.querySelectorAll('.sea-acts .btn')].map((b) => b.getBoundingClientRect());
    const card = document.querySelector('.sea-card').getBoundingClientRect();
    const out = [];
    if (card.top < 0 || card.bottom > innerHeight) out.push('the card leaves the screen: ' + Math.round(card.top) + '..' + Math.round(card.bottom));
    for (const t of document.querySelectorAll('.touch .tbtn')) {
      const r = t.getBoundingClientRect();
      if (r.width > 0 && acts.some((a) => hit(a, r))) out.push(t.className);
    }
    return out;
  })()`);
  if (clash.length > 0) throw new Error(`in landscape: ${clash.join('; ')}`);
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  // one page at a time: a page behind another does not draw
  const play = async (viewport: { width: number; height: number; mobile: boolean }, name: string, fn: (page: Page, url: string) => Promise<void>) => {
    const page = await browser.newPage(viewport);
    try {
      await fn(page, remote ?? local?.url ?? '');
    } catch (error) {
      await page.screenshot(join(OUT, `sea-failed-${name}.png`)).catch(() => undefined);
      throw error;
    } finally {
      page.close();
    }
  };
  try {
    await play({ width: 390, height: 844, mobile: true }, 'phone', run);
    await play({ width: 800, height: 360, mobile: true }, 'landscape', runLandscape);
  } finally {
    await browser.close();
    local?.server.close();
  }
  console.log(`sea screenshots in ${OUT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
