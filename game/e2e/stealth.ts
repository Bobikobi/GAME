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
import { TAKE_GROUND, seedQuery } from './wakes';
import { solveMinigame } from './minigame';
import { FreeWalk, VEC, type Dir } from './walk';

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
interface Health {
  hp: number;
  falls: number;
  movedAt: number;
  since: number | null;
}

const IN_PAGE = `
window.__stealth = (() => {
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const g = () => window.__game;
  return {
    state() {
      const s = g().session;
      return { pos: [...s.pos], moving: !!g().world.body.moving, busy: s.busy, blocking: g().ui.blocking };
    },
    setHour(h) {
      const s = g().session, day = g().bundle.params.day_length_ms, q = Math.floor(day / 2);
      let t = s.tick - ((s.tick + q) % day) + Math.round((h / 24) * day);
      if (t < s.tick) t += day;
      s.tick = t;
    },
    prepare() {
      const s = g().session, params = g().bundle.params;
      s.state.player.quests['core/herbs-for-pell'] = 'done';
      s.state.player.quests['core/the-night-arch'] = 'done';
      s.state.player.camp = ['core/campfire'];
      if (!s.state.player.restored.includes('core/old-bridge')) s.state.player.restored.push('core/old-bridge');
      // Health far above anything the chase leg can bite away, so the run home
      // never races a fall (satietyAt never clamps it to the cap; eating would).
      const cap = (params.satiety_cap + params.per_point.stamina * s.state.player.attrs.stamina) * 1000;
      s.state.player.satiety = 10 * cap;
      s.state.player.satietyAt = s.tick;
      s.met.add('core/trader');
      s.pos = [34, 11];
      s.state.player.at = [34, 11];
      s.facing = 'right';
      g().world.bind(s);
      return { cap, bite: Math.floor((cap * params.hazard.predator.bite_pct) / 100), drain: params.satiety_drain_per_min };
    },
    health() {
      const p = g().session.state.player;
      return { hp: p.satiety, falls: p.falls, movedAt: p.movedAt, since: p.chase ? p.chase.since : null };
    },
    moveTo(x, y) {
      const s = g().session;
      s.pos = [x, y];
      s.state.player.at = [x, y];
      g().world.bind(s);
    },
    predator(at) { return g().world.predator('core/bank-wolf', at); },
    cover(x, y) {
      return g().bundle.map.props.some((p) => p.cover === true && x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
    },
    node() {
      return Object.entries(g().bundle.instances).filter(([, n]) => n.source === 'core/moon-reeds')
        .map(([id, n]) => ({ id, x: n.x, y: n.y }))[0];
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
  /** the free walk: the input is held until the feet stand on a tile, not pressed a tile at a time (NEXT 22 d) */
  private readonly walk: FreeWalk;

  constructor(readonly page: Page) {
    this.walk = new FreeWalk(page, false);
  }

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

  /** One tile in a direction, holding the input until the feet stand on it and letting go there (NEXT 22 d). */
  async step(dir: Dir): Promise<void> {
    await this.page.waitFor('!__stealth.state().busy && !__stealth.state().moving', 'the player to stand still', 10_000);
    if (await this.page.eval<boolean>('!!document.querySelector(".dialog")')) await this.clearPlainDialog();
    const before = await this.state();
    const want = [before.pos[0] + VEC[dir][0], before.pos[1] + VEC[dir][1]];
    // a box can open by itself under a walk here (the night's warning at dusk): it holds the body where it
    // stands, so it is tapped away and the step is taken again, twice at most
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.walk.holdTo(want, `the ${dir} tile from ${(await this.state()).pos.join(',')}`);
      const after = await this.state();
      if (after.pos[0] !== before.pos[0] || after.pos[1] !== before.pos[1]) return;
      if (await this.walk.closeBox()) continue;
      break;
    }
    const why = await this.page.eval(`(() => { const g = window.__game, b = g.world.body, s = g.session;
      return { feet: [b.x, b.y], tile: b.tile(), open: g.world.canWalk(s, ${want[0]}, ${want[1]}), paused: s.pauses, busy: s.busy, blocking: g.ui.blocking,
        layers: [...document.querySelectorAll('#ui > .layer')].map((e) => e.className) }; })()`);
    throw new Error(`${dir} step was blocked at ${before.pos.join(',')}: ${JSON.stringify(why)}`);
  }

  async walkTo(x: number, y: number, what: string): Promise<void> {
    const plan = await this.page.eval<Plan | null>(`__stealth.plan(${x}, ${y})`);
    if (!plan) throw new Error(`no route to ${what} at ${x},${y}`);
    for (const dir of plan.path) await this.step(dir);
    const at = (await this.state()).pos;
    if (at[0] !== x || at[1] !== y) throw new Error(`walk to ${what} ended at ${at.join(',')}`);
  }

  async solveMinigame(): Promise<void> {
    await solveMinigame(this.page, true, 'the moonreed minigame');
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
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Elf');
  await page.tap('input.name');
  await page.type('Tess');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the character to wake', 10_000);
  // the west bank's basket and axe lie on the ground by the wake: this script tests what comes later, so they are handed over
  await page.eval(TAKE_GROUND);
}

async function run(page: Page, url: string): Promise<void> {
  const me = new StealthPlayer(page);
  await page.goto(`${url}?debug&rich=none${seedQuery('core/west-bank')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await page.eval(IN_PAGE);
  await start(page);
  await me.clearPlainDialog();

  // The earlier quest and camp are setup; the stealth quest itself is accepted through Pell.
  const health = await page.eval<{ cap: number; bite: number; drain: number }>('__stealth.prepare()');
  await page.eval(`void __game.ui.talk('core/trader')`);
  await me.choose('The south bank');
  await me.choose('I will do it');
  await page.waitFor(`__game.session.state.player.quests['core/the-south-bank'] === 'active'`, 'Pell to give the south-bank quest');
  await page.waitFor('!__game.ui.blocking', 'Pell dialogue to close');

  // Begin the night from the built camp at the head of the bank road. Once the
  // wolf turns west along the far edge, take the covered bank road (x 12) down
  // to the waiting tile. The shortest walk goes down the meadow beside it, the
  // wolf's own column, and passed or not by the pace of the steps.
  await page.eval('__stealth.moveTo(18, 22); __stealth.setHour(21)');
  await me.walkTo(12, 19, 'the head of the bank road');
  await page.waitFor(`(() => {
    const p = __stealth.predator();
    return !!p && p.at[1] === 31 && p.heading[0] === -1;
  })()`, 'the wolf to turn west along the far edge', 20_000);
  for (let y = 20; y <= 33; y++) {
    await me.step('down');
    if (y >= 24 && y < 33 && !(await page.eval<boolean>(`__stealth.cover(12, ${y})`))) throw new Error(`the bank road is not cover at 12,${y}`);
  }
  if (!(await page.eval<boolean>('__stealth.cover(12, 33)'))) throw new Error('the waiting tile is not cover');
  if (await page.eval<boolean>('!!__game.session.state.player.chase')) throw new Error('the wolf began a chase on the covered approach');

  // Wait for the wolf on the west edge, looking north: its eyes face away
  // from the one-tile crossing to the moonreed.
  await page.waitFor<Predator>(`(() => {
    const p = __stealth.predator();
    return p && p.at[0] === 8 && p.at[1] === 30 && p.heading[0] === 0 && p.heading[1] === -1 ? p : null;
  })()`, 'the wolf eyes to face away', 20_000);
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
  const before = await page.eval<Health>('__stealth.health()');
  await me.step('left');
  await me.step('up');
  await page.waitFor('!!__game.session.state.player.chase', 'the wolf chase to start', 3000);
  const chased = await page.eval<Health>('__stealth.health()');
  const chasedAt = Date.now();
  await me.snap('chase');

  await me.walkTo(18, 22, 'the safe camp');
  const wallMs = Date.now() - chasedAt;
  if (await page.eval<boolean>('!!__game.session.state.player.chase')) throw new Error('the chase did not end in the camp');
  const home = await page.eval<Health>('__stealth.health()');
  console.log(
    `stealth chase: camp reached ${home.movedAt - (chased.since ?? home.movedAt)} game ms after the chase began (${wallMs} ms wall), ` +
      `health ${before.hp} -> ${home.hp} (a bite takes ${health.bite}, the cap is ${health.cap}, the drain is ${health.drain} a minute)`,
  );
  if (home.falls !== before.falls) throw new Error(`the chase ended in a fall: falls ${before.falls} -> ${home.falls}`);
  if (before.hp - home.hp < health.bite) throw new Error(`the chase never bit: health ${before.hp} -> ${home.hp}`);
  await me.snap('camp-safe');
  if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
}

async function play(browser: Browser, url: string): Promise<void> {
  const page = await browser.newPage({ width: 390, height: 844, mobile: true });
  try {
    await run(page, url);
  } catch (error) {
    await page.screenshot(join(OUT, 'stealth-failed.png')).catch(() => undefined);
    throw error;
  } finally {
    page.close();
  }
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  try {
    const browser = await Browser.launch();
    try {
      await play(browser, remote ?? local?.url ?? '');
    } finally {
      await browser.close();
    }
  } finally {
    local?.server.close();
  }
  console.log(`stealth screenshots in ${OUT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
