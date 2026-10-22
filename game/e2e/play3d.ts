/**
 * Plays the 3D door (/play3d/) in a real browser next to the classic game (/play/), on one origin, the way the site
 * serves them: a character made at /play/ loads at /play3d/, walks and gathers there under the kernel's rules, and
 * loads at /play/ again with what it did. Once on a phone screen with touch only, once on a desktop with the keyboard.
 *
 *   pnpm build && pnpm --filter game build:3d && pnpm e2e:3d [out-dir]
 *   E2E_ONLY=phone|desktop pnpm e2e:3d
 *
 * Serves game/dist at /play/ and game/dist-3d at /play3d/. Without a 3D build there is nothing to test and the run
 * is skipped as a pass: the 3D build is optional, and the classic game ships without it.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page, type Viewport } from './cdp';
import { TAKE_GROUND, seedQuery } from './wakes';
import { solveMinigame } from './minigame';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS: Record<string, string> = { '/play/': join(GAME_DIR, 'dist'), '/play3d/': join(GAME_DIR, 'dist-3d') };
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e3d'));

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

const RUNS: [string, Viewport][] = [
  ['phone', { width: 390, height: 844, mobile: true }],
  ['desktop', { width: 1440, height: 900, mobile: false }],
];

type Dir = 'up' | 'down' | 'left' | 'right';
const ARROW: Record<Dir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const PAD_OFFSET: Record<Dir, [number, number]> = { up: [0, -48], down: [0, 48], left: [-48, 0], right: [48, 0] };
const VEC: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const same = (a: Record<string, number>, b: Record<string, number>): boolean => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

interface Saved {
  race: string;
  pocket: string;
  name: string;
  look: number;
  pos: [number, number];
  bag: Record<string, number>;
  visited: string[];
}

/** What a page of either door says about the game in it, read from the save the two share. */
const READ_SAVE = `(() => {
  const g = window.__game;
  if (!g || !g.session || !g.session.started) return null;
  g.session.save();
  const p = g.session.state.player;
  return { race: p.race, pocket: p.pocket, name: p.name, look: p.look, pos: [...g.session.pos], bag: { ...p.bag }, visited: [...p.visited] };
})()`;

class Door {
  private shot = 0;
  constructor(
    readonly page: Page,
    readonly touch: boolean,
    readonly name: string,
  ) {}

  async snap(label: string): Promise<void> {
    this.shot++;
    await this.page.screenshot(join(OUT, `${this.name}-${String(this.shot).padStart(2, '0')}-${label}.png`));
  }

  save(): Promise<Saved | null> {
    return this.page.eval<Saved | null>(READ_SAVE);
  }

  /** Where the game says the player stands, and whether a step is under way. */
  state(): Promise<{ pos: [number, number]; moving: boolean; prompt: string }> {
    return this.page.eval(`(() => {
      const s = window.__game.session, w = window.__game.world, p = document.querySelector('.prompt');
      return { pos: [...s.pos], moving: !!w.move, prompt: p && !p.hidden ? p.textContent.slice(1).trim() : '' };
    })()`);
  }

  private async hold(dir: Dir): Promise<void> {
    if (!this.touch) return this.page.key(ARROW[dir], 'keyDown');
    const [cx, cy] = await this.page.eval<[number, number]>(
      `(() => { const r = document.querySelector('.pad').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`,
    );
    const [dx, dy] = PAD_OFFSET[dir];
    await this.page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx + dx, y: cy + dy, id: 1 }] });
  }

  private async release(dir: Dir): Promise<void> {
    if (!this.touch) return this.page.key(ARROW[dir], 'keyUp');
    await this.page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  /**
   * One tile in a direction: the page lets go in the frame the step starts, so a slow frame never walks two.
   * True when the player moved.
   */
  async step(dir: Dir): Promise<boolean> {
    const before = (await this.state()).pos;
    await this.page.eval(`(() => {
      const w = window.__game.world, s = window.__game.session, facing = s.facing, t0 = performance.now();
      const gen = (window.__e2eGen = (window.__e2eGen ?? 0) + 1);
      window.__e2eStepped = false;
      const look = () => {
        if (window.__e2eGen !== gen) return;
        if (w.move || s.facing !== facing) {
          window.__e2eStepped = true;
          if (${this.touch}) window.__game.controls.setTouchDir(null);
          else window.dispatchEvent(new KeyboardEvent('keyup', { code: ${JSON.stringify(ARROW[dir])} }));
          return;
        }
        if (performance.now() - t0 < 5000) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    })()`);
    await this.hold(dir);
    await this.page.waitFor('window.__e2eStepped', 'the step to start', 5000).catch(() => undefined);
    await this.release(dir);
    await this.page.waitFor('!window.__game.world.move', 'the step to end', 10_000);
    const after = (await this.state()).pos;
    return after[0] !== before[0] || after[1] !== before[1];
  }

  /** Walks to a tile from which the rect's tile is the one in front; the way is planned by the world's own walkable rule. */
  async walkTo(rect: { x: number; y: number; w: number; h: number }, what: string): Promise<void> {
    for (let again = 0; again < 3; again++) {
      const plan = await this.page.eval<{ path: Dir[]; face: Dir; goal: [number, number] } | null>(`(() => {
        const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const s = window.__game.session, w = window.__game.world, r = ${JSON.stringify(rect)};
        const inside = (x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
        const goals = new Map();
        for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) {
          for (const [d, [dx, dy]] of Object.entries(DIRS)) {
            const sx = x - dx, sy = y - dy;
            if (inside(sx, sy)) continue;
            if ((sx === s.pos[0] && sy === s.pos[1]) || w.canWalk(s, sx, sy)) goals.set(sx + ',' + sy, d);
          }
        }
        const start = s.pos[0] + ',' + s.pos[1];
        const prev = new Map([[start, null]]);
        const queue = [[s.pos[0], s.pos[1]]];
        while (queue.length) {
          const [x, y] = queue.shift();
          const k = x + ',' + y;
          if (goals.has(k)) {
            const path = [];
            for (let cur = k; prev.get(cur); cur = prev.get(cur)[0]) path.unshift(prev.get(cur)[1]);
            return { path, face: goals.get(k), goal: [x, y] };
          }
          for (const [d, [dx, dy]] of Object.entries(DIRS)) {
            const nx = x + dx, ny = y + dy, nk = nx + ',' + ny;
            if (prev.has(nk) || !w.canWalk(s, nx, ny)) continue;
            prev.set(nk, [k, d]);
            queue.push([nx, ny]);
          }
        }
        return null;
      })()`);
      if (!plan) throw new Error(`no way to reach ${what}`);
      let ok = true;
      for (const d of plan.path) {
        if (!(await this.step(d))) {
          console.log(`[${this.name}] step ${d} did not move from ${(await this.state()).pos.join(',')} on the way to ${what}: ${plan.path.join(' ')}`);
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      // turn toward the target: pressing toward a blocked tile only turns
      const at = (await this.state()).pos;
      const v = VEC[plan.face];
      const open = await this.page.eval<boolean>(`window.__game.world.canWalk(window.__game.session, ${at[0] + v[0]}, ${at[1] + v[1]})`);
      if (!open) await this.step(plan.face);
      else {
        // open ahead (a find lies on the ground): step off and back, which leaves the player facing it
        const back = (({ up: 'down', down: 'up', left: 'right', right: 'left' }) as Record<Dir, Dir>)[plan.face];
        await this.step(back);
        await this.step(plan.face);
      }
      return;
    }
    throw new Error(`could not walk to ${what}`);
  }

  async solveMinigame(): Promise<void> {
    const shown = await solveMinigame(this.page, this.touch);
    console.log(`[${this.name}] minigame: ${shown.join(' / ')}`);
  }

  /** The A button: Enter on a keyboard, the round A on a phone. */
  async a(): Promise<void> {
    if (this.touch) await this.page.tap('.tbtn.a');
    else await this.page.press('Enter');
  }

  /** Reads through whatever dialogue is open, with Enter or the A button, until none is. */
  async dismissDialogue(): Promise<void> {
    for (let i = 0; i < 60; i++) {
      await sleep(200);
      if (!(await this.page.eval<boolean>('!!document.querySelector(".dialog")'))) {
        await sleep(300);
        if (!(await this.page.eval<boolean>('!!document.querySelector(".dialog")'))) return;
      }
      await this.a();
    }
    throw new Error('a dialogue never closed');
  }
}

async function run(browser: Browser, base: string, viewport: Viewport, name: string): Promise<void> {
  const page = await browser.newPage(viewport);
  const me = new Door(page, viewport.mobile, name);
  const log = (msg: string) => console.log(`[${name}] ${msg}`);
  const check = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    log(`ok: ${msg}`);
  };
  try {
    // 1. a character made at the classic door
    await page.goto(`${base}/play/?debug${seedQuery(viewport.mobile ? 'core/west-bank' : 'core/north-meadow')}`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the classic title screen', 30_000);
    await page.tap('.title-screen button', 'New game');
    const ask = await page.waitFor<string>(
      `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
      'the race cards',
    );
    if (ask === 'ask') await page.tap('.title-screen button', 'Start a new game');
    await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards');
    await page.tap('.card.race', viewport.mobile ? 'Elf' : 'Human');
    if (!viewport.mobile) await page.tap('.look-toggle button', 'Female');
    await page.tap('input.name');
    await page.type('Tess');
    await page.tap('.title-screen button', 'Wake up');
    await page.waitFor('!!window.__game.session && window.__game.session.started', 'the game to start');
    await me.dismissDialogue();
    // the pocket's tools lie on the ground by the wake; handed over here, so the 3D door can fell with the west bank's axe
    await page.eval(TAKE_GROUND);
    const made = await me.save();
    if (!made) throw new Error('no save after waking up at /play/');
    log(`made at /play/: ${JSON.stringify(made)}`);

    // 2. the same character at the 3D door
    await page.goto(`${base}/play3d/?debug&lite`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the 3D title screen', 60_000);
    await me.snap('title3d');
    await page.tap('.title-screen button', 'Continue');
    await page.waitFor('!!window.__game.session && window.__game.session.started && window.__world3d.debug().hero', 'the 3D world with its character', 60_000);
    await sleep(800);
    const loaded = await me.save();
    check(!!loaded && loaded.race === made.race && loaded.pocket === made.pocket && loaded.name === made.name && loaded.look === made.look, 'the character made at /play/ loads at /play3d/');
    check(!!loaded && loaded.pos.join() === made.pos.join(), `it stands where it was saved (${made.pos.join(',')})`);
    await me.snap('wake3d');

    // 3. walk: one press is one tile, and the kernel's rule decides which tiles open
    const first = (await me.state()).pos;
    let moved = false;
    for (const d of ['up', 'right', 'left', 'down'] as Dir[]) {
      if (await me.step(d)) {
        const now = (await me.state()).pos;
        check(now[0] - first[0] === VEC[d][0] && now[1] - first[1] === VEC[d][1], `one press walks one tile ${d}`);
        moved = true;
        break;
      }
    }
    check(moved, 'the character walks in 3D');
    await me.snap('walked3d');

    // 4. gather: walk to a node, the prompt names it, A opens the minigame, the bag grows
    const target = await page.eval<{ id: string; x: number; y: number; source: string; item: string } | null>(`(() => {
      const g = window.__game, s = g.session, b = g.bundle;
      const near = (i) => Math.abs(i.x - s.pos[0]) + Math.abs(i.y - s.pos[1]);
      const nodes = Object.entries(b.instances)
        .filter(([id, i]) => i.kind === 'resource' && b.resources[i.source].game !== undefined && !b.resources[i.source].tool && (s.state.nodes[id]?.readyAt ?? 0) <= s.tick)
        .sort((x, y) => near(x[1]) - near(y[1]));
      const n = nodes[0];
      return n ? { id: n[0], x: n[1].x, y: n[1].y, source: n[1].source, item: b.resources[n[1].source].output } : null;
    })()`);
    if (!target) throw new Error('no node to gather without a tool');
    const had = await page.eval<number>(`window.__game.session.state.player.bag[${JSON.stringify(target.item)}] ?? 0`);
    const bagBefore = await page.eval<number>(`Object.values(window.__game.session.state.player.bag).reduce((a, n) => a + n, 0)`);
    await me.walkTo({ x: target.x, y: target.y, w: 1, h: 1 }, target.id);
    const st = await page.waitFor<{ prompt: string }>(`(() => { const p = document.querySelector('.prompt'); return p && !p.hidden && p.textContent.trim().length > 1 ? { prompt: p.textContent.slice(1).trim() } : null; })()`, 'a prompt at the node', 4000);
    check(/^(Gather|Pick|Fell|Dig|Strike|Snap)/i.test(st.prompt), `the prompt names the work: "${st.prompt}"`);
    await me.snap('node3d');
    await me.a();
    await me.solveMinigame();
    await page.waitFor('!window.__game.session.busy && !window.__game.ui.blocking', 'the work to end', 20_000);
    const got = await page.eval<number>(`window.__game.session.state.player.bag[${JSON.stringify(target.item)}] ?? 0`);
    // a missed try turns up something else, never nothing: the bag as a whole must have grown
    const total = await page.eval<number>(`Object.values(window.__game.session.state.player.bag).reduce((a, n) => a + n, 0)`);
    check(total > bagBefore, `the work ran under the kernel (${total - bagBefore} item(s) gained; ${target.item}: ${had} -> ${got})`);
    await me.snap('gathered3d');

    // 4b. work that runs by itself after one press: a character that carries an axe fells the nearest tree
    const tree = await page.eval<{ id: string; x: number; y: number; item: string } | null>(`(() => {
      const g = window.__game, s = g.session, b = g.bundle;
      if (!(s.state.player.bag['core/axe'] > 0)) return null;
      const near = (i) => Math.abs(i.x - s.pos[0]) + Math.abs(i.y - s.pos[1]);
      const nodes = Object.entries(b.instances)
        .filter(([id, i]) => i.kind === 'resource' && b.resources[i.source].tool === 'axe' && (s.state.nodes[id]?.readyAt ?? 0) <= s.tick)
        .sort((x, y) => near(x[1]) - near(y[1]));
      const n = nodes[0];
      return n ? { id: n[0], x: n[1].x, y: n[1].y, item: b.resources[n[1].source].output } : null;
    })()`);
    if (tree) {
      const wood = await page.eval<number>(`window.__game.session.state.player.bag[${JSON.stringify(tree.item)}] ?? 0`);
      await me.walkTo({ x: tree.x, y: tree.y, w: 1, h: 1 }, tree.id);
      await page.waitFor(`(() => { const p = document.querySelector('.prompt'); return p && !p.hidden && p.textContent.trim().length > 1; })()`, 'a prompt at the tree', 4000);
      await me.a();
      await page.waitFor('window.__game.session.busy', 'the felling to begin', 8000);
      check(true, 'one press starts the felling and the player is busy');
      await page.waitFor('!window.__game.session.busy', 'the felling to end', 30_000);
      const wood2 = await page.eval<number>(`window.__game.session.state.player.bag[${JSON.stringify(tree.item)}] ?? 0`);
      check(wood2 > wood, `the felling ran by itself (${tree.item}: ${wood} -> ${wood2})`);
      await me.snap('felled3d');
    } else console.log(`[${me.name}] no axe or no ready tree: felling not exercised`);

    // 5. back to the classic door with what was done
    const done3d = await me.save();
    if (!done3d) throw new Error('no save at /play3d/ after playing');
    await page.goto(`${base}/play/?debug`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the classic title screen again', 30_000);
    await page.tap('.title-screen button', 'Continue');
    await page.waitFor('!!window.__game.session && window.__game.session.started', 'the classic game to load the save');
    const back = await me.save();
    check(!!back && same(back.bag, done3d.bag) && back.pos.join() === done3d.pos.join() && back.name === made.name && back.race === made.race && back.pocket === made.pocket && back.look === made.look, `the 3D game saved to the same place: /play/ loads it and back (${JSON.stringify(done3d.bag)} / ${JSON.stringify(back?.bag)})`);
    await me.snap('back2d');

    if (page.errors.length > 0) throw new Error(`page errors: ${page.errors.join(' | ')}`);
    log('PASS');
  } finally {
    page.close();
  }
}

async function main(): Promise<void> {
  if (!existsSync(join(ROOTS['/play3d/']!, 'index.html'))) {
    console.log('no game/dist-3d: the 3D build is optional, so there is nothing to play. Skipped.');
    return;
  }
  if (!existsSync(join(ROOTS['/play/']!, 'index.html'))) throw new Error('no game/dist: run pnpm build first');
  mkdirSync(OUT, { recursive: true });
  const { server, url } = await serve();
  const browser = await Browser.launch();
  let failed = false;
  try {
    for (const [name, viewport] of RUNS) {
      if (process.env.E2E_ONLY && process.env.E2E_ONLY !== name) continue;
      try {
        await run(browser, url, viewport, name);
      } catch (err) {
        failed = true;
        console.error(`[${name}] ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) process.exit(1);
}

void main();
