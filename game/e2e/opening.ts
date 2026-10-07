/**
 * Plays the whole opening in a real browser, the way a player would: walking
 * tile by tile, the timing minigame, dialogue, menus. Once on a phone screen
 * with touch only (d-pad, A button, taps), once on a desktop with the keyboard.
 *
 *   pnpm build && pnpm e2e [out-dir]
 *   E2E_URL=https://<deployment> pnpm e2e    (play a deployed copy instead)
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
  const g = () => window.__game;
  const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  return {
    state() {
      const s = g().session, w = g().world, p = document.querySelector('.prompt');
      return { pos: [...s.pos], facing: s.facing, busy: s.busy, moving: !!w.move, blocking: g().ui.blocking,
        prompt: p && !p.hidden ? p.textContent.slice(1).trim() : '' };
    },
    player() { return g().session.state.player; },
    slot(id) { return g().bundle.map.slots.find((s) => s.id === id); },
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
    await this.page.screenshot(join(OUT, `${this.name}-${String(this.shot).padStart(2, '0')}-${label}.png`));
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

  /** One tile in a direction, or just a turn when the way is blocked. */
  async step(dir: Dir): Promise<void> {
    await this.settle();
    const before = await this.state();
    await this.holdDir(dir);
    const end = Date.now() + 600;
    while (Date.now() < end) {
      const st = await this.state();
      if (st.moving || (st.facing === dir && before.facing !== dir && !st.moving)) break;
      await sleep(4);
    }
    await this.releaseDir(dir);
    await this.page.waitFor('!__e2e.state().moving', 'the step to end', 3000);
  }

  async walkTo(rect: Rect, what: string): Promise<void> {
    const plan = await this.page.eval<{ path: Dir[]; face: Dir; goal: [number, number] } | null>(`__e2e.plan(${JSON.stringify(rect)})`);
    if (!plan) throw new Error(`no way to reach ${what}`);
    for (const d of plan.path) await this.step(d);
    const at = await this.state();
    if (at.pos.join(',') !== plan.goal.join(',')) throw new Error(`walking to ${what} ended at ${at.pos.join(',')}, not ${plan.goal.join(',')}`);
    if (at.facing === plan.face) return;
    const v = VEC[plan.face];
    const open = (dx: number, dy: number) => this.page.eval<boolean>(`__game.world.canWalk(__game.session, ${at.pos[0] + dx}, ${at.pos[1] + dy})`);
    if (!(await open(v[0], v[1]))) return this.step(plan.face); // blocked ahead: pressing toward it only turns
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
    for (let round = 0; round < 8 && (await this.bag(item)) < want; round++) {
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
  const me = new Player(page, viewport.mobile, name);
  const log = (msg: string) => console.log(`[${name}] ${msg}`);
  try {
    await page.goto(`${url}?debug`);
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

    // 3. three stones, the first minigame
    // verify: after a stone node is gathered, the player can step onto its tile
    const stoneNodes = await page.eval<{ id: string; x: number; y: number; ready: boolean }[]>('__e2e.nodes("core/river-stones")');
    const firstStone = stoneNodes.find((n) => n.ready);
    if (!firstStone) throw new Error('no ready river-stones node found');
    await me.walkTo({ x: firstStone.x, y: firstStone.y, w: 1, h: 1 }, firstStone.id);
    await me.expectPrompt(/^Gather/, firstStone.id);
    await me.a();
    await me.solveMinigame();
    await me.idle(`gathering first ${firstStone.id}`);
    await me.settle();
    // the rule itself: a gathered node no longer blocks its tile
    await page.waitFor(`__game.world.canWalk(__game.session, ${firstStone.x}, ${firstStone.y})`, 'the gathered stone to open its tile', 5000);
    // then walk onto it, from wherever the player stands now
    const here = (await me.state()).pos;
    const toward = (Object.keys(VEC) as Dir[]).find((d) => here[0] + VEC[d][0] === firstStone.x && here[1] + VEC[d][1] === firstStone.y);
    if (!toward) throw new Error(`the player at [${here.join(', ')}] is not next to the stone at [${firstStone.x}, ${firstStone.y}]`);
    await me.step(toward);
    const onNode = await me.state();
    if (onNode.pos[0] !== firstStone.x || onNode.pos[1] !== firstStone.y) {
      throw new Error(`expected the player to step onto the gathered stone at [${firstStone.x}, ${firstStone.y}], got [${onNode.pos.join(', ')}] facing ${onNode.facing}`);
    }
    log(`stepped onto the gathered stone at [${firstStone.x}, ${firstStone.y}]`);
    await me.step(OPPOSITE[toward]);

    await me.gather('core/river-stones', 'core/stone', 3);
    log('gathered 3 stones');

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
    await me.snap('bridge');
    log('mended the bridge');

    // 5. a fire and the first meal
    await me.gather('core/fallen-branches', 'core/branch', 3);
    const fire = await page.eval<[number, number]>(`(() => { const c = __e2e.slot('core/camp'); return [c.x + 2, c.y + 2]; })()`);
    await me.walkTo({ x: fire[0], y: fire[1], w: 1, h: 1 }, 'the fire spot');
    await me.expectPrompt(/^Build: Campfire/, 'the fire spot');
    await me.a();
    await me.talkThrough('Build it');
    await me.done('building the fire');
    await me.idle('the fire');
    await me.gather('core/berry-bushes', 'core/berry', 2);
    await me.walkTo({ x: fire[0], y: fire[1], w: 1, h: 1 }, 'the campfire');
    await me.expectPrompt(/^Cook/, 'the campfire');
    await me.a();
    await page.waitFor(`!!document.querySelector('.panel.craft')`, 'the cooking panel');
    await me.snap('cook');
    await page.tap('.panel.craft .row button', 'Cook');
    await me.idle('cooking');
    if ((await me.quest('core/first-fire')) !== 'done') throw new Error('first-fire is not done');
    await me.snap('camp');
    log('built a fire and cooked');

    // 6. the town: the creators' signs
    const square = await page.eval<Rect>(`__e2e.slot('core/town-square')`);
    await me.walkTo({ x: square.x + 1, y: square.y + 1, w: 1, h: 1 }, 'the town square');
    await me.idle('arriving in town');
    if ((await me.quest('core/into-town')) !== 'done') throw new Error('into-town is not done');
    log('reached the town');

    // 7. bring three fruits
    const elder = await page.eval<[number, number]>(`(() => { const s = __e2e.slot('core/elder-house'); return [s.x + 1, s.y + 1]; })()`);
    await me.walkTo({ x: elder[0], y: elder[1], w: 1, h: 1 }, 'Elder Maru');
    await me.expectPrompt(/^Talk to Elder Maru/, 'the elder');
    await me.a();
    await me.talkThrough('Task:');
    await me.talkThrough('I will do it');
    await me.idle('accepting the task');
    if ((await me.quest('core/three-fruits')) !== 'active') throw new Error('three-fruits was not accepted');
    await me.gather('core/berry-bushes', 'core/berry', 3);
    await me.walkTo({ x: elder[0], y: elder[1], w: 1, h: 1 }, 'Elder Maru');
    await me.a();
    await me.talkThrough('Hand in');
    const thanks = await me.talkThrough();
    await me.idle('the thanks');
    if (!thanks.some((l) => l.includes('basket'))) throw new Error('the elder never mentions the basket');
    const p = await page.eval<{ gold: number; recipes: string[] }>('__e2e.player()');
    if (p.gold < 30_000) throw new Error(`gold is ${p.gold} mg after the quest`);
    if (!p.recipes.includes('core/herb-tea')) throw new Error('the herb-tea recipe was not learned');
    log(`handed in the fruits: ${p.gold} mg`);

    // 8. the first coins buy a basket or a trowel
    const tool = viewport.mobile ? 'Trowel' : 'Basket';
    const trader = await page.eval<[number, number]>(`(() => { const s = __e2e.slot('core/trader-stall'); return [s.x + 1, s.y]; })()`);
    await me.walkTo({ x: trader[0], y: trader[1], w: 1, h: 1 }, 'Pell');
    await me.expectPrompt(/^Talk to Pell/, 'the trader');
    await me.a();
    await me.talkThrough('Trade');
    await page.waitFor(`!!document.querySelector('.panel .row')`, 'the shop');
    await me.snap('shop');
    await me.tapInRow(tool, 'Buy');
    await page.waitFor(`(__e2e.player().bag['core/${tool.toLowerCase()}'] ?? 0) > 0`, `a ${tool} in the bag`, 3000);
    await page.tap('.panel header button', 'Close');
    await me.idle('closing the shop');
    log(`bought a ${tool}`);

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

    if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
  } catch (err) {
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
