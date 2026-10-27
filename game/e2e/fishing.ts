/**
 * Proves fishing in a real browser, on a phone and on a desktop (DECISIONS.md, 2026-10-25: fishing): with a rod,
 * standing on the bank by a fishing spot, the action says Fish; the cast goes through its states in order (the
 * float out, the wait, a nibble, the bite, the reel) and the world hears each of them; dark fish shapes are drawn
 * under the spot; the strike lands a river fish in the bag and trains fishing. Every check waits on a condition,
 * never a fixed time.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page, type Viewport } from './cdp';
import { solveMinigame } from './minigame';
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

const IN_PAGE = `
window.__fish = (() => {
  const g = () => window.__game;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const phases = [];
  const world = g().world;
  const own = world.fishPhase.bind(world);
  world.fishPhase = (node, phase) => { phases.push(phase); own(node, phase); };
  return {
    phases() { return phases; },
    dialog() { return !!document.querySelector('.dialog'); },
    prompt() { const p = document.querySelector('.prompt'); return p && !p.hidden ? p.textContent : ''; },
    /** A fishing spot with a bank tile beside it, and the way to face the water from there. */
    bank() {
      const s = g().session, b = g().bundle, w = g().world;
      for (const [id, i] of Object.entries(b.instances)) {
        if (i.source !== 'core/river-fish') continue;
        for (const [face, [dx, dy]] of Object.entries(DIRS)) {
          const at = [i.x - dx, i.y - dy];
          if (w.canWalk(s, at[0], at[1])) return { id, at, face };
        }
      }
      return null;
    },
    moveTo(x, y, facing) {
      const s = g().session;
      s.pos = [x, y];
      s.state.player.at = [x, y];
      s.facing = facing;
      g().world.bind(s);
    },
    /** How many fish shapes and how much line the world drew this frame. */
    drawn() {
      const f = g().world.fishing;
      return { under: f.under.commandBuffer.length, over: f.over.commandBuffer.length };
    },
  };
})();
true`;

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
  // the name is cut at the bridge's stone, and this script is not about the stone: it is cut here
  await page.eval(carveIn('Tess'));
  await page.eval(TAKE_GROUND);
}

/** Reads every box of the opening to its end. */
async function readThrough(page: Page): Promise<void> {
  const open = `document.querySelector('.dialog') ? 'box' : document.querySelector('.levelup-layer') ? 'level' : 'none'`;
  for (let presses = 0; presses < 40; presses++) {
    let now = await page.waitFor<string>(open, 'the opening', 10_000);
    if (now === 'none') {
      await sleep(300);
      now = await page.waitFor<string>(open, 'the opening', 10_000);
      if (now === 'none') return;
    }
    await page.press('Enter');
    await sleep(120);
  }
  throw new Error('the opening did not close');
}

async function run(page: Page, url: string, touch: boolean): Promise<void> {
  await page.goto(`${url}?debug&rich=none${seedQuery('core/west-bank')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await start(page);
  await readThrough(page);
  await page.eval(IN_PAGE);

  await page.eval(`__game.session.state.player.bag['core/fishing-rod'] = 1`);
  const spot = await page.eval<{ id: string; at: [number, number]; face: string } | null>('__fish.bank()');
  if (!spot) throw new Error('no bank tile beside a fishing spot');
  await page.eval(`__fish.moveTo(${spot.at[0]}, ${spot.at[1]}, ${JSON.stringify(spot.face)})`);
  await page.waitFor(`__fish.prompt().includes('Fish')`, 'the Fish button on the bank', 5000);
  await page.waitFor('__fish.drawn().under > 0', 'dark fish shapes under the spot', 5000);

  await page.press('Enter');
  await page.waitFor(`__fish.phases().includes('wait')`, 'the float to land', 5000);
  await page.waitFor('__fish.drawn().over > 0', 'the line and float drawn in the world', 5000);
  await page.screenshot(join(OUT, `fishing-${touch ? 'phone' : 'desktop'}-wait.png`));
  const shown = await solveMinigame(page, touch, 'the fishing minigame');
  const phases = await page.eval<string[]>('__fish.phases()');
  const order = ['cast', 'wait', 'nibble', 'bite', 'reel'];
  const seen = order.map((p) => phases.indexOf(p));
  if (seen.some((i) => i < 0) || seen.some((i, n) => n > 0 && i < seen[n - 1]!)) throw new Error(`the cast went ${phases.join(' > ')}, not ${order.join(' > ')}`);

  const after = await page.waitFor<{ fish: number; xp: number }>(
    `(() => { const p = __game.session.state.player; const fish = p.bag['core/river-fish'] ?? 0; return fish > 0 ? { fish, xp: p.xp['core/fishing'] ?? 0 } : null; })()`,
    'a river fish in the bag',
    10_000,
  );
  if (after.xp <= 0) throw new Error('the catch trained no fishing');
  console.log(`fishing: ${shown.join(' / ')}; ${after.fish} fish, ${after.xp} fishing xp`);
  if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
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
        await run(page, remote ?? local?.url ?? '', viewport.mobile);
      } catch (error) {
        await page.screenshot(join(OUT, `fishing-${name}-failed.png`)).catch(() => undefined);
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      } finally {
        page.close();
      }
      console.log(`fishing: ${name} passed`);
    }
  } finally {
    await browser.close();
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
