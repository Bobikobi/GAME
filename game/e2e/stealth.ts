/**
 * Proves the south-bank stealth beat in a real phone-sized browser. The
 * opening has its own broad Player harness; this focused run stays small and
 * drives the same page API over CDP without changing opening.ts.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page } from './cdp';

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

type Dir = 'up' | 'down' | 'left' | 'right';
interface State {
  pos: [number, number];
  moving: boolean;
  busy: boolean;
  blocking: boolean;
}
interface Plan {
  path: Dir[];
}
interface Predator {
  at: [number, number];
  heading: [number, number];
  seesPlayer: boolean;
}

const KEY: Record<Dir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

const IN_PAGE = `
window.__stealth = (() => {
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  const g = () => window.__game;
  return {
    state() {
      const s = g().session;
      return { pos: [...s.pos], moving: !!g().world.move, busy: s.busy, blocking: g().ui.blocking };
    },
    setHour(h) {
      const s = g().session, day = g().bundle.params.day_length_ms, q = Math.floor(day / 2);
      let t = s.tick - ((s.tick + q) % day) + Math.round((h / 24) * day);
      if (t < s.tick) t += day;
      s.tick = t;
    },
    prepare() {
      const s = g().session;
      s.state.player.quests['core/herbs-for-pell'] = 'done';
      s.state.player.camp = ['core/campfire'];
      if (!s.state.player.restored.includes('core/old-bridge')) s.state.player.restored.push('core/old-bridge');
      s.state.player.satiety = 100000;
      s.met.add('core/trader');
      s.pos = [34, 11];
      s.state.player.at = [34, 11];
      s.facing = 'right';
      g().world.bind(s);
    },
    moveTo(x, y) {
      const s = g().session;
      s.pos = [x, y];
      s.state.player.at = [x, y];
      g().world.bind(s);
    },
    predator(at) { return g().world.predator('core/bank-wolf', at); },
    node() {
      return Object.entries(g().bundle.instances).filter(([, n]) => n.source === 'core/moon-reeds')
        .map(([id, n]) => ({ id, x: n.x, y: n.y }))[0];
    },
    releaseOnStep(dir) {
      const s = g().session, w = g().world, facing = s.facing, t0 = performance.now();
      const gen = (window.__stealthGen = (window.__stealthGen ?? 0) + 1);
      window.__stealthStepped = false;
      const look = () => {
        if (window.__stealthGen !== gen) return;
        if (w.move || s.facing !== facing) {
          window.__stealthStepped = true;
          window.dispatchEvent(new KeyboardEvent('keyup', { code: KEY[dir] }));
          return;
        }
        if (performance.now() - t0 < 1000) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    },
    plan(x0, y0) {
      const s = g().session, w = g().world;
      const start = s.pos[0] + ',' + s.pos[1], goal = x0 + ',' + y0;
      const prev = new Map([[start, null]]), queue = [[s.pos[0], s.pos[1]]];
      while (queue.length) {
        const [x, y] = queue.shift(), k = x + ',' + y;
        if (k === goal) {
          const path = [];
          for (let cur = k; prev.get(cur); cur = prev.get(cur)[0]) path.unshift(prev.get(cur)[1]);
          return { path };
        }
        for (const [d, [dx, dy]] of Object.entries(DIRS)) {
          const nx = x + dx, ny = y + dy, nk = nx + ',' + ny;
          if (prev.has(nk) || !w.canWalk(s, nx, ny)) continue;
          prev.set(nk, [k, d]);
          queue.push([nx, ny]);
        }
      }
      return null;
    },
  };
})();
true`;

class StealthPlayer {
  private shot = 0;

  constructor(readonly page: Page) {}

  state(): Promise<State> {
    return this.page.eval<State>('__stealth.state()');
  }

  async snap(label: string): Promise<void> {
    this.shot++;
    await this.page.screenshot(join(OUT, `stealth-${String(this.shot).padStart(2, '0')}-${label}.png`));
  }

  async clearPlainDialog(): Promise<void> {
    for (let i = 0; i < 20; i++) {
      const dialog = await this.page.eval<{ open: boolean; options: string[] }>(`(() => {
        const d = document.querySelector('.dialog');
        return { open: !!d, options: d ? [...d.querySelectorAll('.dialog-options button')].map((b) => b.textContent ?? '') : [] };
      })()`);
      if (!dialog.open) return;
      if (dialog.options.length > 0) throw new Error(`unexpected dialogue choice: ${dialog.options.join(' | ')}`);
      await this.page.press('Enter');
      await sleep(80);
    }
    throw new Error('plain dialogue did not close');
  }

  async choose(label: string): Promise<void> {
    for (let i = 0; i < 40; i++) {
      const options = await this.page.eval<string[]>(`(() => {
        const d = document.querySelector('.dialog');
        return d ? [...d.querySelectorAll('.dialog-options button')].map((b) => b.textContent ?? '') : [];
      })()`);
      const found = options.find((option) => option.includes(label));
      if (found) {
        await this.page.tap('.dialog-options button', label);
        return;
      }
      if (await this.page.eval<boolean>('!!document.querySelector(".dialog")')) await this.page.press('Enter');
      await sleep(100);
    }
    throw new Error(`dialogue never offered "${label}"`);
  }

  async step(dir: Dir): Promise<void> {
    await this.page.waitFor('!__stealth.state().busy && !__stealth.state().moving', 'the player to stand still', 10_000);
    if (await this.page.eval<boolean>('!!document.querySelector(".dialog")')) await this.clearPlainDialog();
    const before = await this.state();
    await this.page.eval(`__stealth.releaseOnStep(${JSON.stringify(dir)})`);
    await this.page.key(KEY[dir], 'keyDown');
    await this.page.waitFor('window.__stealthStepped', `the ${dir} step to start`, 1500).catch(() => undefined);
    await this.page.key(KEY[dir], 'keyUp');
    await this.page.waitFor('!__stealth.state().moving', `the ${dir} step to end`, 5000);
    const after = await this.state();
    if (after.pos[0] === before.pos[0] && after.pos[1] === before.pos[1]) throw new Error(`${dir} step was blocked at ${before.pos.join(',')}`);
  }

  async walkTo(x: number, y: number, what: string): Promise<void> {
    const plan = await this.page.eval<Plan | null>(`__stealth.plan(${x}, ${y})`);
    if (!plan) throw new Error(`no route to ${what} at ${x},${y}`);
    for (const dir of plan.path) await this.step(dir);
    const at = (await this.state()).pos;
    if (at[0] !== x || at[1] !== y) throw new Error(`walk to ${what} ended at ${at.join(',')}`);
  }

  async solveMinigame(): Promise<void> {
    await this.page.waitFor('!!document.querySelector(".minigame[data-game]")', 'the moonreed minigame', 5000);
    const end = Date.now() + 20_000;
    while (Date.now() < end && (await this.page.eval<boolean>('!!document.querySelector(".minigame[data-game]")'))) {
      const cue = await this.page.eval<boolean>('document.querySelector(".minigame[data-game]")?.getAttribute("data-cue") === "now"');
      if (cue) await this.page.press('Enter');
      await sleep(40);
    }
    await this.page.waitFor('!document.querySelector(".minigame-layer")', 'the moonreed minigame to close', 5000);
    await this.page.waitFor('!__stealth.state().busy && !__stealth.state().blocking', 'the moonreed gather to finish', 10_000);
  }

  async handleLevelUp(): Promise<void> {
    await sleep(800);
    for (let i = 0; i < 12 && (await this.page.eval<boolean>('!!document.querySelector(".levelup-layer")')); i++) {
      await this.page.press('Enter');
      await sleep(150);
    }
    if (await this.page.eval<boolean>('!!document.querySelector(".levelup-layer")')) throw new Error('the level-up window did not close');
    await this.page.waitFor('!__stealth.state().blocking', 'the world after the level-up', 3000);
  }
}

async function start(page: Page): Promise<void> {
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(
    `document.querySelector('.card.starter') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the starter cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.starter', 'Forager');
  await page.tap('input.name');
  await page.type('Tess');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the character to wake', 10_000);
}

async function run(page: Page, url: string): Promise<void> {
  const me = new StealthPlayer(page);
  await page.goto(`${url}?debug&rich=none`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.eval(IN_PAGE);
  await start(page);
  await me.clearPlainDialog();

  // The earlier quest and camp are setup; the stealth quest itself is accepted through Pell.
  await page.eval('__stealth.prepare()');
  await page.eval(`void __game.ui.talk('core/trader')`);
  await me.choose('Task: The south bank');
  await me.choose('I will do it');
  await page.waitFor(`__game.session.state.player.quests['core/the-south-bank'] === 'active'`, 'Pell to give the south-bank quest');
  await page.waitFor('!__game.ui.blocking', 'Pell dialogue to close');

  // Begin the night from the built camp, then take the covered bank road.
  await page.eval('__stealth.moveTo(18, 22); __stealth.setHour(21)');
  await me.walkTo(12, 33, 'the reed cover');
  const covered = await page.eval<boolean>(`__game.bundle.map.props.some((p) => p.cover === true && 12 >= p.x && 12 < p.x + p.w && 33 >= p.y && 33 < p.y + p.h)`);
  if (!covered) throw new Error('the waiting tile is not cover');
  if (await page.eval<boolean>('!!__game.session.state.player.chase')) throw new Error('the wolf began a chase on the covered approach');

  // Wait for the wolf on the west edge, looking north: its eyes face away
  // from the one-tile crossing to the moonreed.
  const away = await page.waitFor<Predator>(`(() => {
    const p = __stealth.predator();
    return p && p.at[0] === 8 && p.at[1] === 30 && p.heading[0] === 0 && p.heading[1] === -1 ? p : null;
  })()`, 'the wolf eyes to face away', 20_000);
  if (away.at[0] === 8 && away.at[1] === 24) throw new Error('the wolf is still on its den after dark');
  await me.snap('eyes-away');

  await me.step('left');
  const node = await page.eval<{ id: string; x: number; y: number }>('__stealth.node()');
  const at = (await me.state()).pos;
  if (Math.max(Math.abs(node.x - at[0]), Math.abs(node.y - at[1])) !== 1) throw new Error(`moonreed ${node.x},${node.y} is not beside the crossing at ${at.join(',')}`);
  await page.press('Enter');
  await me.solveMinigame();
  await me.handleLevelUp();
  if (await page.eval<boolean>('!!__game.session.state.player.chase')) throw new Error('the moonreed crossing started a chase');
  if ((await page.eval<number>(`__game.session.state.player.bag['core/moonreed'] ?? 0`)) < 1) throw new Error('the moonreed is not in the bag');
  await me.snap('moonreed');

  // Return to cover. As soon as the same open tile enters the real sight
  // predicate, step into it and let the ordinary move report start the chase.
  await me.step('right');
  await page.waitFor<Predator>(`(() => {
    const p = __stealth.predator([11, 32]);
    return p && p.seesPlayer ? p : null;
  })()`, 'the open tile to enter the wolf cone', 20_000).catch(async (error: unknown) => {
    const debug = await page.eval(`(() => { const s = __game.session; return { tick: s.tick, paused: s.paused, state: __stealth.state(), wolf: __stealth.predator(), target: __stealth.predator([11, 32]), chase: s.state.player.chase }; })()`);
    throw new Error(`${error instanceof Error ? error.message : error}: ${JSON.stringify(debug)}`);
  });
  await me.step('left');
  await me.step('up');
  await page.waitFor('!!__game.session.state.player.chase', 'the wolf chase to start', 3000);
  await me.snap('chase');

  await me.walkTo(18, 22, 'the safe camp');
  if (await page.eval<boolean>('!!__game.session.state.player.chase')) throw new Error('the chase did not end in the camp');
  await me.snap('camp-safe');
  if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  const page = await browser.newPage({ width: 390, height: 844, mobile: true });
  try {
    await run(page, remote ?? local?.url ?? '');
  } catch (error) {
    await page.screenshot(join(OUT, 'stealth-failed.png')).catch(() => undefined);
    throw error;
  } finally {
    page.close();
    await browser.close();
    local?.server.close();
  }
  console.log(`stealth screenshots in ${OUT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
