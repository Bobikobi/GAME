/**
 * The HD-2D look trial's stills (DECISIONS 2026-10-26): one world, frozen, drawn three ways by the look filter on
 * the world camera: 0 as the game draws it, A with the tilt-shift, B with the tilt-shift and the perspective.
 * Also the four measures of the brief. Not part of `pnpm e2e`. Usage:
 *   tsx game/e2e/look-stills.ts explore X,Y [X,Y ...]   one still of the world, no look, at each spot
 *   tsx game/e2e/look-stills.ts final X,Y [OUT]          the three stills, the measures and the frame times
 */
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page } from './cdp';
import { carveIn, seedQuery } from './wakes';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(GAME_DIR, 'dist');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };

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

/** The closer camera the owner picked (DECISIONS 2026-10-25): 4 * ceil(1.5 * base / 4); 12 on a 390x844 phone at 3x. */
const CLOSER_ZOOM = 12;
const HOUR = 12;

async function wake(page: Page, url: string, query: string): Promise<void> {
  await page.goto(`${url}?debug${seedQuery('core/slid-bank')}${query}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title', 30_000);
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Human');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started && !!window.__game.world', 'the character to wake', 30_000);
  await page.eval(carveIn('Tess'));
}

/** In the page: the hour set as the clock tests set it, the player put on a tile, and the closer camera. */
async function stage(page: Page, x: number, y: number): Promise<void> {
  await page.eval(`(() => {
    const g = window.__game, s = g.session, w = g.world, day = g.bundle.params.day_length_ms, q = Math.floor(day / 2);
    let t = s.tick - ((s.tick + q) % day) + Math.round((${HOUR} / 24) * day);
    if (t < s.tick) t += day;
    s.tick = t;
    s.state.player.satietyAt = Math.max(s.state.player.satietyAt, s.state.tick);
    w.placePlayer(${x}, ${y});
    w.baseZoom = ${CLOSER_ZOOM};
    w.cameras.main.setZoom(${CLOSER_ZOOM});
  })()`);
  await sleep(2500);
}

async function main(): Promise<void> {
  const [mode = '', ...rest] = process.argv.slice(2);
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  const local = await serve();
  const browser = await Browser.launch();
  const page = await browser.newPage({ width: 390, height: 844, mobile: true, scale: 3 });
  try {
    if (mode === 'explore') {
      const out = resolve(join(GAME_DIR, '..', '.scratch', 'hd2d', 'explore'));
      mkdirSync(out, { recursive: true });
      await wake(page, local.url, '');
      for (const spot of rest) {
        const [x, y] = spot.split(',').map(Number);
        await stage(page, x ?? 0, y ?? 0);
        await page.screenshot(join(out, `spot-${x}-${y}.png`));
        console.log(`spot ${x},${y}`);
      }
    } else {
      throw new Error(`unknown mode ${mode}`);
    }
    if (page.errors.length > 0) console.log(`page errors:\n${page.errors.join('\n')}`);
  } finally {
    page.close();
    await browser.close();
    local.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
