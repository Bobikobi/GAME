/**
 * Plays the whole opening in a real browser, the way a player would: walking
 * tile by tile, the timing minigame, dialogue, menus. Once on a phone screen
 * with touch only (d-pad, A button, taps), once on a desktop with the keyboard.
 *
 *   pnpm build && pnpm e2e [out-dir]
 *   E2E_URL=https://<deployment> pnpm e2e    (play a deployed copy instead)
 *   E2E_VIDEO=<dir> pnpm e2e                (keep every frame, for a video of the run)
 *   E2E_QUERY=rich=none pnpm e2e            (extra query parameters for the game to read)
 *   E2E_UNTIL=bridge pnpm e2e               (stop right after that screenshot, as a pass)
 *   E2E_UNTIL=camp E2E_HOUR=21 pnpm e2e     (and move the game clock before that last shot)
 *
 * Serves game/dist itself, writes screenshots to out-dir (default .scratch/e2e)
 * and exits non-zero on the first step that fails or on any page error.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page, type Viewport } from './cdp';

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
  '.txt': 'text/plain',
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
      const addr = server.address();
      ok({ server, url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/` });
    });
  });
}

/** Helpers that live in the page, next to the game they read. */
const IN_PAGE = `
window.__e2eLog = [];
for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'click']) {
  window.addEventListener(type, (e) => {
    window.__e2eLog.push(type + ' ' + (e.target.className || e.target.tagName) + ' id=' + (e.pointerId ?? '') + ' t=' + Math.round(performance.now()));
    if (window.__e2eLog.length > 40) window.__e2eLog.shift();
  }, true);
}
window.__e2e = (() => {
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  const g = () => window.__game;
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  return {
    state() {
      const s = g().session, w = g().world, p = document.querySelector('.prompt');
      return { pos: [...s.pos], facing: s.facing, busy: s.busy, moving: !!w.move, blocking: g().ui.blocking,
        prompt: p && !p.hidden ? p.textContent.slice(1).trim() : '' };
    },
    player() { return g().session.state.player; },
    hour() {
      // tick 0 is noon (the kernel's hourOf)
      const s = g().session, day = g().bundle.params.day_length_ms;
      return Math.floor((((s.tick + Math.floor(day / 2)) % day) * 24) / day);
    },
    /** Moves the game clock forward to that hour of the day, for a dusk or night screenshot. */
    setHour(h) {
      const s = g().session, day = g().bundle.params.day_length_ms, q = Math.floor(day / 2);
      let t = s.tick - ((s.tick + q) % day) + Math.round((h / 24) * day);
      if (t < s.tick) t += day;
      s.tick = t;
    },
    slot(id) { return g().bundle.map.slots.find((s) => s.id === id); },
    prop(id) { const p = g().bundle.map.props.find((x) => x.id === id); return p && { x: p.x, y: p.y, w: p.w, h: p.h }; },
    /** True while the task glint stands over the tile; with no motion (?rich=none) nothing glints, so nothing to wait for. */
    glint(x, y) { return !g().rich?.motion || JSON.parse(g().world.glintKey || '[]').some((t) => t.x === x && t.y === y); },
    nodes(source) {
      const s = g().session;
      return Object.entries(g().bundle.instances).filter(([, i]) => i.source === source)
        .map(([id, i]) => ({ id, x: i.x, y: i.y, ready: (s.state.nodes[id]?.readyAt ?? 0) <= s.tick }));
    },
    /** Shortest walk to a tile from which a tile of rect is the one in front. */
    plan(rect) {
      const s = g().session, w = g().world;
      const goals = new Map();
      for (let x = rect.x; x < rect.x + rect.w; x++) for (let y = rect.y; y < rect.y + rect.h; y++) {
        for (const [d, [dx, dy]] of Object.entries(DIRS)) {
          const sx = x - dx, sy = y - dy;
          if (inRect(sx, sy, rect)) continue;
          const here = sx === s.pos[0] && sy === s.pos[1];
          if (here || w.canWalk(s, sx, sy)) goals.set(sx + ',' + sy, d);
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
    },
    /**
     * Lets go of a held direction in the frame its step starts, or the player turns.
     * Phaser asks for its next frame before this does, so this runs right after the
     * update that started the step and lets go before the next one: one tile per
     * press, however slow the frames are.
     */
    releaseOnStep(dir, touch) {
      const s = g().session, w = g().world, facing = s.facing, t0 = performance.now();
      const gen = (window.__e2eGen = (window.__e2eGen ?? 0) + 1);
      window.__e2eStepped = false;
      const look = () => {
        if (window.__e2eGen !== gen) return;
        if (w.move || s.facing !== facing) {
          window.__e2eStepped = true;
          if (touch) g().controls.setTouchDir(null);
          else window.dispatchEvent(new KeyboardEvent('keyup', { code: KEY[dir] }));
          return;
        }
        if (performance.now() - t0 < 1000) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
      return true;
    },
    soundState() {
      return g().sound ? g().sound.state() : null;
    },
    dialog() {
      const d = document.querySelector('.dialog');
      if (!d) return null;
      const o = d.querySelector('.dialog-options');
      return { text: d.querySelector('.dialog-text')?.textContent ?? '',
        options: o && !o.hidden ? [...o.querySelectorAll('button')].map((b) => b.textContent) : [] };
    },
  };
})();
true`;

type Dir = 'up' | 'down' | 'left' | 'right';
const ARROW: Record<Dir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const PAD_OFFSET: Record<Dir, [number, number]> = { up: [0, -48], down: [0, 48], left: [-48, 0], right: [48, 0] };
const VEC: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface State {
  pos: [number, number];
  facing: Dir;
  busy: boolean;
  moving: boolean;
  blocking: boolean;
  prompt: string;
}
interface Plan {
  path: Dir[];
  face: Dir;
  goal: [number, number];
}

/** Thrown by snap() right after the screenshot E2E_UNTIL names: the run ends there, as a pass. */
class Stop extends Error {}

/** One player, on one device. */
class Player {
  private shot = 0;
  constructor(
    readonly page: Page,
    readonly touch: boolean,
    readonly name: string,
  ) {}

  state(): Promise<State> {
    return this.page.eval<State>('__e2e.state()');
  }

  bag(item: string): Promise<number> {
    return this.page.eval<number>(`__e2e.player().bag[${JSON.stringify(item)}] ?? 0`);
  }

  private levelUpSeen = false;

  async snap(label: string): Promise<void> {
    this.shot++;
    const last = process.env.E2E_UNTIL === label;
    if (last && process.env.E2E_HOUR) {
      // E2E_HOUR=<h> with E2E_UNTIL: the clock moves before the last screenshot (dusk, night)
      await this.page.eval(`__e2e.setHour(${Number(process.env.E2E_HOUR)})`);
      await sleep(900);
    }
    await this.page.screenshot(join(OUT, `${this.name}-${String(this.shot).padStart(2, '0')}-${label}.png`));
    // E2E_UNTIL=<label> ends the run right after that screenshot, as a pass
    if (last) throw new Stop(label);
  }

  private async padCenter(): Promise<[number, number]> {
    return this.page.eval<[number, number]>(
      `(() => { const r = document.querySelector('.pad').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`,
    );
  }

  private async holdDir(dir: Dir): Promise<void> {
    if (!this.touch) return this.page.key(ARROW[dir], 'keyDown');
    const [cx, cy] = await this.padCenter();
    const [dx, dy] = PAD_OFFSET[dir];
    await this.page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx + dx, y: cy + dy, id: 1 }] });
  }

  private async releaseDir(dir: Dir): Promise<void> {
    if (!this.touch) return this.page.key(ARROW[dir], 'keyUp');
    await this.page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  /** The A button: Enter on a keyboard, the round A on a phone. */
  async a(): Promise<void> {
    await this.settle();
    if (this.touch) await this.page.tap('.tbtn.a');
    else await this.page.press('Enter');
  }

  /** One tile in a direction, or just a turn when the way is blocked. True when the player moved. */
  async step(dir: Dir): Promise<boolean> {
    await this.settle();
    const before = await this.state();
    const want: [number, number] = [before.pos[0] + VEC[dir][0], before.pos[1] + VEC[dir][1]];
    await this.press(dir);
    // software rendering can drop a hold whole (no frame saw the key down): while the player
    // has not moved and the tile ahead is open, press again, twice at most
    for (let tries = 0; tries < 2; tries++) {
      const at = (await this.state()).pos;
      if (at[0] !== before.pos[0] || at[1] !== before.pos[1]) break;
      const open = await this.page.eval<boolean>(`__game.world.canWalk(__game.session, ${want[0]}, ${want[1]})`);
      if (!open) break;
      await this.press(dir);
    }
    // a press should walk one tile; if it ever walks two, walk back to the one tile wanted
    for (let i = 0; i < 3; i++) {
      const at = (await this.state()).pos;
      const over = (at[0] - want[0]) * VEC[dir][0] + (at[1] - want[1]) * VEC[dir][1];
      if (over <= 0) break;
      await this.press(OPPOSITE[dir]);
    }
    const after = (await this.state()).pos;
    return after[0] !== before.pos[0] || after[1] !== before.pos[1];
  }

  private async press(dir: Dir): Promise<void> {
    // letting go from here, a poll after the step started, can leave the direction held
    // into a second step when frames are slow (CI renders in software), so the page lets go
    await this.page.eval(`__e2e.releaseOnStep(${JSON.stringify(dir)}, ${this.touch})`);
    await this.holdDir(dir);
    // a press toward a wall the player already faces neither turns nor steps
    await this.page.waitFor('window.__e2eStepped', 'the step to start', 600).catch(() => undefined);
    await this.releaseDir(dir);
    await this.page.waitFor('!__e2e.state().moving', 'the step to end', 3000);
  }

  private async planTo(rect: Rect, what: string): Promise<Plan> {
    const plan = await this.page.eval<Plan | null>(`__e2e.plan(${JSON.stringify(rect)})`);
    if (!plan) throw new Error(`no way to reach ${what}`);
    return plan;
  }

  /** Walks a planned path; false at the first step that does not move the player. */
  private async follow(path: Dir[]): Promise<boolean> {
    for (const d of path) if (!(await this.step(d))) return false;
    return true;
  }

  async walkTo(rect: Rect, what: string): Promise<void> {
    // a plan is the way as it stands when the walk starts: a bush or stone that grows back on it
    // closes it (picked bell bushes return after 90 s, mid-walk when frames are slow), so a step
    // that does not move the player plans again from where they stand, three times at most
    let plan = await this.planTo(rect, what);
    for (let again = 0; !(await this.follow(plan.path)) && again < 3; again++) plan = await this.planTo(rect, what);
    const at = await this.state();
    if (at.pos.join(',') !== plan.goal.join(',')) throw new Error(`walking to ${what} ended at ${at.pos.join(',')}, not ${plan.goal.join(',')}`);
    if (at.facing === plan.face) return;
    const v = VEC[plan.face];
    const open = (dx: number, dy: number) => this.page.eval<boolean>(`__game.world.canWalk(__game.session, ${at.pos[0] + dx}, ${at.pos[1] + dy})`);
    if (!(await open(v[0], v[1]))) {
      await this.step(plan.face); // blocked ahead: pressing toward it only turns
      return;
    }
    if (!(await open(-v[0], -v[1]))) throw new Error(`cannot turn toward ${what} at ${at.pos.join(',')}`);
    // open ahead: back up one tile and step forward again, which leaves the player facing it
    await this.step(OPPOSITE[plan.face]);
    await this.step(plan.face);
  }

  async expectPrompt(pattern: RegExp, what: string): Promise<void> {
    const st = await this.page.waitFor<State>(`(() => { const s = __e2e.state(); return s.prompt ? s : null; })()`, `a prompt for ${what}`, 3000);
    if (!pattern.test(st.prompt)) throw new Error(`expected a prompt like ${pattern} for ${what}, got "${st.prompt}"`);
  }

  /**
   * Reads through the dialogue on screen. With `pick`, reads until the options
   * appear and picks the one containing it; without, reads until no dialogue
   * is left (a reply can open the next one right away).
   */
  async talkThrough(pick?: string): Promise<string[]> {
    const seen: string[] = [];
    for (let i = 0; i < 80; i++) {
      let d = await this.page.eval<{ text: string; options: string[] } | null>('__e2e.dialog()');
      if (!d) {
        for (let wait = 0; !d && wait < 4; wait++) {
          await sleep(150);
          d = await this.page.eval<{ text: string; options: string[] } | null>('__e2e.dialog()');
        }
      }
      if (!d) {
        if (pick) throw new Error(`expected a choice "${pick}", but no dialogue is open`);
        await sleep(200);
        if (!(await this.page.eval('__e2e.dialog()'))) return seen;
        continue;
      }
      if (d.text && seen[seen.length - 1] !== d.text) seen.push(d.text);
      if (d.options.length > 0) {
        const want = pick ? d.options.findIndex((o) => o.includes(pick)) : -1;
        if (want < 0) {
          if (!pick) return seen;
          throw new Error(`no option "${pick ?? ''}" in [${d.options.join(' | ')}] after: ${seen.join(' / ')}`);
        }
        if (this.touch) await this.page.tap('.dialog-options button', d.options[want]);
        else {
          for (let k = 0; k < want; k++) await this.page.press('ArrowDown');
          await this.page.press('Enter');
        }
        await sleep(120);
        return seen;
      }
      await this.a();
      await sleep(90);
    }
    throw new Error(`the dialogue never ended: ${seen.join(' / ')}`);
  }

  /** Solves any minigame (timing, strike, pick, snap) by waiting for data-cue="now". */
  async solveMinigame(): Promise<void> {
    const start = Date.now();
    await this.page.waitFor('!!document.querySelector(".minigame[data-game]")', 'minigame to open', 5000);
    while (Date.now() - start < 30_000) {
      const open = await this.page.eval<boolean>('!!document.querySelector(".minigame[data-game]")');
      if (!open) break;

      const cue = await this.page.waitFor<string>(
        `(() => {
          const m = document.querySelector('.minigame[data-game]');
          if (!m) return 'closed';
          return m.getAttribute('data-cue') === 'now' ? 'now' : '';
        })()`,
        'data-cue="now"',
        10_000,
      ).catch(() => 'closed');

      if (cue === 'closed') break;
      if (cue === 'now') {
        if (this.touch) {
          await this.page.eval(`(() => {
            const l = document.querySelector('.minigame-layer');
            if (l) l.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          })()`);
        } else {
          await this.page.press('Enter');
        }
        await sleep(80);
      }
    }
    await this.page.waitFor('!document.querySelector(".minigame-layer")', 'minigame layer to close', 5000).catch(() => undefined);
  }

  /** A level brought a point: the window opens about 0.7 s after the jingle. Handle it before doing anything else. */
  async settle(): Promise<void> {
    if (!(await this.page.eval<boolean>('!!(__game.ui.levelUpOpen || document.querySelector(".levelup-layer"))'))) return;
    await this.page.waitFor('!!document.querySelector(".levelup-layer")', 'the level-up window', 3000);
    await this.handleLevelUp();
    // the page is busy for a moment after the window closes; a step held through that lag
    // lasts longer than one tile and walks two (seen on CI)
    await sleep(400);
  }

  /** Handles the level-up window if open: spends every point on the first open choice, then closes it. */
  async handleLevelUp(): Promise<boolean> {
    if (!(await this.page.eval<boolean>('!!document.querySelector(".levelup-layer")'))) return false;
    if (!this.levelUpSeen) {
      this.levelUpSeen = true;
      await this.snap('levelup');
    }
    for (let i = 0; i < 12; i++) {
      if (!(await this.page.eval<boolean>('!!document.querySelector(".levelup-layer")'))) return true;
      if (this.touch) {
        const choice = await this.page.eval<boolean>('!!document.querySelector(".levelup button.choice:not(:disabled)")');
        await this.page.tap(choice ? '.levelup button.choice:not(:disabled)' : '.levelup-actions button');
      } else {
        await this.page.press('Enter');
      }
      await sleep(150);
    }
    throw new Error('the level-up window never closed');
  }

  /** Waits for the current action to finish; dialogue it opens stays open. */
  async done(what: string, timeoutMs = 20_000): Promise<void> {
    await this.page.waitFor('(() => { const s = __e2e.state(); return !s.busy && !s.moving; })()', what, timeoutMs);
    await sleep(60);
  }

  /** Taps the button labelled `label` in the panel row that mentions `row`. */
  async tapInRow(row: string, label: string): Promise<void> {
    const at = await this.page.waitFor<[number, number]>(
      `(() => {
        for (const r of document.querySelectorAll('.panel .row')) {
          if (!r.textContent.includes(${JSON.stringify(row)})) continue;
          const b = [...r.querySelectorAll('button')].find((x) => x.textContent.includes(${JSON.stringify(label)}) && !x.disabled);
          if (!b) continue;
          b.scrollIntoView({ block: 'nearest' });
          const q = b.getBoundingClientRect();
          return [q.left + q.width / 2, q.top + q.height / 2];
        }
        return null;
      })()`,
      `"${label}" next to ${row}`,
    );
    await this.page.tapAt(at[0], at[1]);
  }

  async idle(what: string, timeoutMs = 20_000): Promise<void> {
    await this.page.waitFor('(() => { const s = __e2e.state(); return !s.busy && !s.moving; })()', what, timeoutMs);
    await sleep(150); // the story beats run first, then the level-up flag goes up
    await this.settle();
    await this.page.waitFor('(() => { const s = __e2e.state(); return !s.busy && !s.blocking && !s.moving; })()', what, timeoutMs);
  }

  /** Gathers from a resource's nodes until the bag holds `want` of its item. */
  async gather(source: string, item: string, want: number): Promise<void> {
    // a missed minigame can leave a node empty, so wait out a respawn (up to 90 s of game time) on a slow machine
    const deadline = Date.now() + 150_000;
    while (Date.now() < deadline && (await this.bag(item)) < want) {
      const nodes = await this.page.eval<{ id: string; x: number; y: number; ready: boolean }[]>(`__e2e.nodes(${JSON.stringify(source)})`);
      const ready = nodes.filter((n) => n.ready);
      if (ready.length === 0) {
        await sleep(3000);
        continue;
      }
      for (const n of ready) {
        if ((await this.bag(item)) >= want) return;
        await this.walkTo({ x: n.x, y: n.y, w: 1, h: 1 }, n.id);
        await this.expectPrompt(/^Gather/, n.id);
        await this.a();
        await this.solveMinigame();
        await this.idle(`gathering ${n.id}`);
      }
    }
    const have = await this.bag(item);
    if (have < want) throw new Error(`only ${have} of ${want} ${item} after gathering`);
  }

  async quest(id: string): Promise<string | undefined> {
    return this.page.eval<string | undefined>(`__e2e.player().quests[${JSON.stringify(id)}]`);
  }
}

async function play(browser: Browser, url: string, viewport: Viewport, name: string): Promise<void> {
  const page = await browser.newPage(viewport);
  // E2E_VIDEO=<dir> keeps every frame of the run, for a video of the opening
  if (process.env.E2E_VIDEO) await page.record(join(process.env.E2E_VIDEO, name));
  const me = new Player(page, viewport.mobile, name);
  const log = (msg: string) => console.log(`[${name}] ${msg}`);
  try {
    // E2E_QUERY=a=1&b=2 rides behind ?debug: the static server drops the query, the game reads it
    const extra = process.env.E2E_QUERY ? `&${process.env.E2E_QUERY}` : '';
    await page.goto(`${url}?debug${extra}`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
    await page.eval(IN_PAGE);
    await me.snap('title');

    // 1. pick a character
    await page.tap('.title-screen button', 'New game');
    // a save from an earlier run asks first
    const ask = await page.waitFor<string>(
      `document.querySelector('.card.starter') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
      'the starter cards',
    );
    if (ask === 'ask') await page.tap('.title-screen button', 'Start a new game');
    await page.waitFor(`!!document.querySelector('.card.starter')`, 'the starter cards');
    await page.tap('.card.starter', viewport.mobile ? 'Forager' : 'Explorer');
    await page.tap('input.name');
    await page.type('Tess');
    await me.snap('choose');
    await page.tap('.title-screen button', 'Wake up');

    // 2. wake up by the broken bridge
    const intro = await me.talkThrough();
    if (!intro.some((l) => l.includes('bridge'))) throw new Error('the intro never mentions the bridge');
    await me.snap('wake');
    log('woke up by the river');

    // check audio state
    const audio = await page.eval<{ song: string | null; unlocked: boolean } | null>('__e2e.soundState()');
    if (!audio) throw new Error('no audio state');
    if (audio.song !== 'valley') throw new Error(`expected song "valley", got "${audio.song}"`);
    if (typeof audio.unlocked !== 'boolean') throw new Error(`invalid audio unlock state: ${audio.unlocked}`);
    log(`audio state verified: song=${audio.song}, unlocked=${audio.unlocked}`);

    // the first day starts at noon, so the first dusk falls inside the first session
    const noon = await page.eval<number>('__e2e.hour()');
    if (noon !== 12) throw new Error(`the first day starts at ${noon}:00, not at noon`);

    // 3. the keystone, the first minigame: one strike, taught in one line
    // verify: after the node is gathered, the player can step onto its tile
    const keyNodes = await page.eval<{ id: string; x: number; y: number; ready: boolean }[]>('__e2e.nodes("core/keystone")');
    const keystone = keyNodes.find((n) => n.ready);
    if (!keystone) throw new Error('no ready keystone node found');
    await me.walkTo({ x: keystone.x, y: keystone.y, w: 1, h: 1 }, keystone.id);
    await me.expectPrompt(/^Gather/, keystone.id);
    await me.a();
    await me.solveMinigame();
    await me.idle(`gathering ${keystone.id}`);
    await me.settle();
    // the rule itself: a gathered node no longer blocks its tile
    await page.waitFor(`__game.world.canWalk(__game.session, ${keystone.x}, ${keystone.y})`, 'the gathered keystone to open its tile', 5000);
    // then walk onto it, from wherever the player stands now
    const here = (await me.state()).pos;
    const toward = (Object.keys(VEC) as Dir[]).find((d) => here[0] + VEC[d][0] === keystone.x && here[1] + VEC[d][1] === keystone.y);
    if (!toward) throw new Error(`the player at [${here.join(', ')}] is not next to the keystone at [${keystone.x}, ${keystone.y}]`);
    await me.step(toward);
    const onNode = await me.state();
    if (onNode.pos[0] !== keystone.x || onNode.pos[1] !== keystone.y) {
      throw new Error(`expected the player to step onto the gathered keystone at [${keystone.x}, ${keystone.y}], got [${onNode.pos.join(', ')}] facing ${onNode.facing}`);
    }
    log(`stepped onto the gathered keystone at [${keystone.x}, ${keystone.y}]`);
    await me.step(OPPOSITE[toward]);

    // a miss leaves the keystone where it lies: a second try once it shows again
    await me.gather('core/keystone', 'core/keystone', 1);
    log('struck the keystone free');

    // 4. mend the bridge: the first restoration, level, journal entry and a sign with my name
    const bridge = await page.eval<Rect>(`__e2e.slot('core/old-bridge')`);
    await me.walkTo(bridge, 'the broken bridge');
    await me.expectPrompt(/^Mend/, 'the bridge');
    await me.a();
    await me.talkThrough('Mend it');
    await me.done('mending the bridge');
    const mended = await me.talkThrough();
    await me.idle('the bridge story');
    if (!mended.some((l) => l.includes('Mended by Tess'))) throw new Error(`no "Mended by Tess" after the bridge: ${mended.join(' / ')}`);
    if ((await me.quest('core/fix-the-bridge')) !== 'done') throw new Error('fix-the-bridge is not done');
    const journal = await page.eval<number>('__e2e.player().journal.length');
    if (journal < 1) throw new Error('no journal entry after the bridge');
    const purse = await page.eval<{ gold: number; recipes: string[] }>('__e2e.player()');
    if (purse.gold !== 30_000) throw new Error(`the bridge paid ${purse.gold} mg, not the price of one tool`);
    if (!purse.recipes.includes('core/mushroom-skewer')) throw new Error('the bridge did not teach the mushroom skewer');
    await me.snap('bridge');
    log('mended the bridge: 30000 mg and a recipe');

    // 5. dry wood: one log in the wet reeds, found by the senses and picked up by hand, no window
    const dry = (await page.eval<{ id: string; x: number; y: number; ready: boolean }[]>('__e2e.nodes("core/dry-log")'))[0];
    if (!dry) throw new Error('no dry log in the reeds');
    await me.walkTo({ x: dry.x, y: dry.y, w: 1, h: 1 }, 'the dry log');
    await me.expectPrompt(/^Dig here/, 'the dry log');
    await me.snap('reeds');
    await me.a();
    await sleep(300);
    if (await page.eval<boolean>('!!document.querySelector(".minigame[data-game]")')) throw new Error('a minigame opened for the dry log');
    await me.idle('picking up the dry log');
    if ((await me.bag('core/dry-log')) < 1) throw new Error('no dry log in the bag');
    const fire = await page.eval<[number, number]>(`(() => { const c = __e2e.slot('core/camp'); return [c.x + 2, c.y + 2]; })()`);
    await me.walkTo({ x: fire[0], y: fire[1], w: 1, h: 1 }, 'the fire spot');
    await me.expectPrompt(/^Build: Campfire/, 'the fire spot');
    await me.a();
    await me.talkThrough('Build it');
    await me.done('building the fire');
    await me.idle('the fire');
    if ((await me.quest('core/first-fire')) !== 'done') throw new Error('first-fire is not done');
    await me.snap('camp');
    log('found the dry log and built a fire');

    // 6. the town: the creators' signs
    const square = await page.eval<Rect>(`__e2e.slot('core/town-square')`);
    await me.walkTo({ x: square.x + 1, y: square.y + 1, w: 1, h: 1 }, 'the town square');
    await me.idle('arriving in town');
    if ((await me.quest('core/into-town')) !== 'done') throw new Error('into-town is not done');
    log('reached the town');

    // 7. Maru offers two tasks: the phone takes the coin (the trowel's road), the desktop the bells (the basket's)
    const first = viewport.mobile ? 'The coin under the lantern' : 'Where the bells rang';
    const elder = await page.eval<[number, number]>(`(() => { const s = __e2e.slot('core/elder-house'); return [s.x + 1, s.y + 1]; })()`);
    await me.walkTo({ x: elder[0], y: elder[1], w: 1, h: 1 }, 'Elder Maru');
    await me.expectPrompt(/^Talk to Elder Maru/, 'the elder');
    await me.a();
    await me.talkThrough(`Task: ${first}`);
    await me.talkThrough('I will do it');
    await me.idle('accepting the task');
    const taken = viewport.mobile ? 'core/a-coin-for-maru' : 'core/three-fruits';
    if ((await me.quest(taken)) !== 'active') throw new Error(`${taken} was not accepted`);
    const tracker = await page.eval<string>(`document.querySelector('.tracker')?.textContent ?? ''`);
    if (/\d+\/\d+/.test(tracker)) throw new Error(`the tracker counts instead of hinting: "${tracker}"`);

    // 8. the bridge's coins buy a basket or a trowel, and the stall says what each opens (G12)
    const tool = viewport.mobile ? 'Trowel' : 'Basket';
    const trader = await page.eval<[number, number]>(`(() => { const s = __e2e.slot('core/trader-stall'); return [s.x + 1, s.y]; })()`);
    await me.walkTo({ x: trader[0], y: trader[1], w: 1, h: 1 }, 'Pell');
    await me.expectPrompt(/^Talk to Pell/, 'the trader');
    await me.a();
    await me.talkThrough('Trade');
    await page.waitFor(`!!document.querySelector('.panel .row')`, 'the shop');
    const opens = await page.eval<string>(
      `(() => { for (const r of document.querySelectorAll('.panel .row')) if (r.querySelector('b')?.textContent === ${JSON.stringify(tool)}) return r.querySelector('[data-opens]')?.textContent ?? ''; return ''; })()`,
    );
    if (!opens.includes(first)) throw new Error(`the stall does not say the ${tool} opens "${first}": "${opens}"`);
    await me.snap('shop');
    await me.tapInRow(tool, 'Buy');
    await page.waitFor(`(__e2e.player().bag['core/${tool.toLowerCase()}'] ?? 0) > 0`, `a ${tool} in the bag`, 3000);
    await page.tap('.panel header button', 'Close');
    await me.idle('closing the shop');
    log(`bought a ${tool}: ${opens}`);

    // 9. a ruin in the mist at the edge of town, waiting for a creator
    const ruin = await page.eval<Rect>(`__e2e.slot('core/town-edge')`);
    await me.walkTo(ruin, 'the ruined house');
    await me.expectPrompt(/^(Look at|Read the sign)/, 'the ruined house');
    await me.snap('ruin');
    await me.a();
    const sign = await me.talkThrough('Open the creator guide');
    if (!sign.some((l) => l.includes('Awaiting restoration'))) throw new Error(`the ruin does not await restoration: ${sign.join(' / ')}`);
    const guide = await page.waitFor<string>(`document.querySelector('.panel .md')?.textContent ?? ''`, 'the creator guide');
    if (!guide.includes('Add a fruit in 10 minutes')) throw new Error('the creator guide did not open');
    await me.snap('guide');
    log('opened the creator guide from the ruin');
    await page.tap('.panel header button', 'Close');
    await me.idle('closing the guide');

    // 10. the trowel's road toward the first night (phone); the basket's road through the garden (desktop)
    if (viewport.mobile) {
      for (const id of ['core/marked-stone', 'core/town-lantern', 'core/hill-lantern']) {
        const prop = await page.eval<Rect>(`__e2e.prop(${JSON.stringify(id)})`);
        await me.walkTo(prop, id);
        await me.expectPrompt(/^Look at/, id);
        await me.a();
        const read = await me.talkThrough();
        await me.idle(`reading ${id}`);
        if (read.length === 0) throw new Error(`nothing to read on ${id}`);
      }
      await me.snap('stones');
      const spot = (await page.eval<{ id: string; x: number; y: number; ready: boolean }[]>('__e2e.nodes("core/lantern-foot")'))[0];
      if (!spot) throw new Error('no dig spot under the hill lantern');
      // at dusk the hill lantern lights the tile to dig
      const before = await page.eval<number>('__e2e.hour()');
      if (before >= 5 && before < 19) await page.eval('__e2e.setHour(19)');
      await page.waitFor(`__e2e.glint(${spot.x}, ${spot.y})`, 'the lantern to light the spot at dusk', 5000);
      for (let tries = 0; tries < 3 && (await me.bag('core/maru-coin')) < 1; tries++) {
        await page.waitFor('__e2e.nodes("core/lantern-foot")[0].ready', 'the spot under the lantern to be ready', 90_000);
        await me.walkTo({ x: spot.x, y: spot.y, w: 1, h: 1 }, 'the spot under the hill lantern');
        await me.expectPrompt(/^Dig here/, 'the spot under the hill lantern');
        if (tries === 0) await me.snap('dusk');
        await me.a();
        await me.solveMinigame();
        await me.idle('digging under the lantern');
      }
      if ((await me.bag('core/maru-coin')) < 1) throw new Error('no coin after three digs under the hill lantern');
      const solved = await page.eval<string[]>('__e2e.player().solved');
      if (!solved.includes('core/a-coin-for-maru#0')) throw new Error(`the riddle is not solved: [${solved.join(', ')}]`);
      await me.snap('riddle');
      await me.walkTo({ x: elder[0], y: elder[1], w: 1, h: 1 }, 'Elder Maru');
      await me.a();
      await me.talkThrough('Hand in');
      const coin = await me.talkThrough();
      await me.idle('handing in the coin');
      if ((await me.quest('core/a-coin-for-maru')) !== 'done') throw new Error('a-coin-for-maru is not done');
      if ((await me.bag('core/basket')) < 1) throw new Error('no basket after the coin');
      if (!coin.some((l) => l.includes('arch'))) throw new Error(`the elder never mentions the arch: ${coin.join(' / ')}`);
      if ((await me.quest('core/the-night-arch')) !== 'active') throw new Error('the-night-arch did not start');
      log('read the three stones, dug under the hill lantern at dusk, handed in the coin');

      // 11. the first night: the broken arch shows a way, and it leads to the threshold of the night ruins
      const mouth = await page.eval<Rect>(`__e2e.slot('core/arch-mouth')`);
      const threshold = await page.eval<Rect>(`__e2e.slot('core/night-threshold')`);
      // a walk to a place stops beside it, never through it, so the arch is entered only by the step below
      await me.walkTo(mouth, 'the broken arch');
      if (await page.eval<boolean>(`!!__e2e.plan(${JSON.stringify(threshold)})`)) throw new Error('the night ruins are open before the arch');
      const dark = await page.eval<number>('__e2e.hour()');
      if (dark >= 5 && dark < 20) await page.eval('__e2e.setHour(21)');
      const lit = { x: mouth.x + Math.floor(mouth.w / 2), y: mouth.y + mouth.h - 1 };
      await page.waitFor(`__e2e.glint(${lit.x}, ${lit.y})`, 'the arch to show its way at night', 5000);
      await me.snap('arch');
      await me.step((await me.state()).facing);
      const opened = await me.talkThrough();
      await me.idle('the arch opening');
      if (!opened.some((l) => l.includes('a way runs under it'))) throw new Error(`no word of the way under the arch: ${opened.join(' / ')}`);
      if ((await me.quest('core/the-night-arch')) !== 'done') throw new Error('the-night-arch is not done');
      const restored = await page.eval<string[]>('__e2e.player().restored');
      if (!restored.includes('core/arch-way')) throw new Error(`the arch way did not open: [${restored.join(', ')}]`);
      const stone = await page.eval<Rect>(`__e2e.prop('core/arch-stone')`);
      await me.walkTo(stone, 'the stone by the arch');
      await me.expectPrompt(/^Look at/, 'the stone by the arch');
      await me.a();
      const cut = await me.talkThrough();
      await me.idle('reading the stone by the arch');
      if (!cut.some((l) => l.includes('by night the way'))) throw new Error(`the stone by the arch says: ${cut.join(' / ')}`);
      await me.walkTo(threshold, 'the threshold of the night ruins');
      await me.step((await me.state()).facing);
      const below = await me.talkThrough();
      await me.idle('the threshold');
      if (!below.some((l) => l.includes('Not tonight'))) throw new Error(`no door left open at the threshold: ${below.join(' / ')}`);
      const visited = await page.eval<string[]>('__e2e.player().visited');
      if (!visited.includes('core/night-threshold')) throw new Error('the threshold was not reached');
      await me.snap('threshold');
      log(`walked under the arch at ${await page.eval<number>('__e2e.hour()')}:00 and reached the threshold of the night ruins`);
    } else {
      const hour = await page.eval<number>('__e2e.hour()');
      log(`game hour ${hour}:00 before the garden; the bell bushes open 5:00 to 20:00`);
      if (hour < 5 || hour >= 20) throw new Error(`the bell bushes are closed at ${hour}:00: the run took too long to reach the garden`);
      await me.gather('core/bell-bushes', 'core/bellberry', 1);
      await me.walkTo({ x: elder[0], y: elder[1], w: 1, h: 1 }, 'Elder Maru');
      await me.a();
      await me.talkThrough('Hand in');
      const thanks = await me.talkThrough();
      await me.idle('the thanks');
      if (!thanks.some((l) => l.includes('trowel'))) throw new Error('the elder never mentions the trowel');
      const p = await page.eval<{ gold: number; recipes: string[] }>('__e2e.player()');
      if (p.gold < 30_000) throw new Error(`gold is ${p.gold} mg after the quest`);
      if (!p.recipes.includes('core/herb-tea')) throw new Error('the herb-tea recipe was not learned');
      log(`found the bellberry and handed it in: ${p.gold} mg`);
      await me.walkTo({ x: trader[0], y: trader[1], w: 1, h: 1 }, 'Pell');
      await me.a();
      await me.talkThrough('Task:');
      await me.talkThrough('I will do it');
      await me.idle('accepting the herbs');
      if ((await me.quest('core/herbs-for-pell')) !== 'active') throw new Error('herbs-for-pell was not accepted');
      const clue = await page.eval<string>(`document.querySelector('.tracker')?.textContent ?? ''`);
      if (!clue.includes('mist is thin at noon')) throw new Error(`the tracker does not show the clue: "${clue}"`);
      log('accepted the herbs and saw the clue in the tracker');
    }

    if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
  } catch (err) {
    if (err instanceof Stop) {
      log(`stopped after the "${err.message}" screenshot (E2E_UNTIL)`);
      return;
    }
    await me.snap('failed').catch(() => undefined);
    const where = await page
      .eval<string>(`(() => {
        const a = document.querySelector('.tbtn.a')?.getBoundingClientRect();
        const hit = a ? document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2) : null;
        const before = { state: __e2e.state(), layers: [...document.querySelectorAll('#ui > .layer')].map((l) => l.className), bag: __e2e.player().bag,
          hit: hit ? hit.tagName + '.' + hit.className : null, focus: document.activeElement?.tagName + '.' + document.activeElement?.className };
        __game.ui.handle('a');
        return JSON.stringify({ ...before, afterA: [...document.querySelectorAll('#ui > .layer')].map((l) => l.className) });
      })()`)
      .catch(() => 'no state');
    console.error(`[${name}] ${where}`);
    console.error(`[${name}] input log:\n${(await page.eval<string[]>('window.__e2eLog').catch(() => [])).join('\n')}`);
    if (page.errors.length) console.error(`[${name}] page errors:\n${page.errors.join('\n')}`);
    throw err;
  } finally {
    page.close();
  }
}

const RUNS: [string, Viewport][] = [
  ['phone', { width: 390, height: 844, mobile: true }],
  ['desktop', { width: 1280, height: 800, mobile: false }],
];

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const url = remote ?? local?.url ?? '';
  const browser = await Browser.launch();
  const only = process.env.E2E_ONLY;
  try {
    for (const [name, viewport] of RUNS) {
      if (only && only !== name) continue;
      const t0 = Date.now();
      await play(browser, url, viewport, name);
      console.log(`[${name}] opening finished in ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  } finally {
    await browser.close();
    local?.server.close();
  }
  console.log(`screenshots in ${OUT}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
