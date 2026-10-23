/**
 * Plays the whole opening in a real browser, the way a player would: walking
 * tile by tile, the timing minigame, dialogue, menus. One race per wake pocket,
 * each under a fixed seed (wakes.ts): the elf on the west bank on a phone screen
 * with touch only (d-pad, A button, taps), the human in the north meadow on a
 * desktop with the keyboard, and the skeleton on the slid bank on a desktop up
 * to the mended bridge. E2E_ONLY=phone|desktop|slid-bank plays one of them.
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
import { solveMinigame } from './minigame';
import { FreeWalk, OPPOSITE, VEC, type Dir } from './walk';
import { LUCKY_BOWL, type WakePocket, seedQuery } from './wakes';

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
      return { pos: [...s.pos], facing: s.facing, busy: s.busy, moving: !!w.body.moving, blocking: g().ui.blocking,
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
      window.__pays?.jumps.push({ from: s.tick, to: t });
      s.tick = t;
    },
    /**
     * Criterion 8 (OPENING_REVIEW): writes down every pay with the play clock (the session tick, in ms): a coin or an item gained,
     * a task changed, a place mended or a recipe learned, a box opened. A jump of the clock (setHour) is not a pay: it is kept
     * apart, and the time it skips counts as waiting.
     */
    paysOn() {
      const gen = (window.__paysGen = (window.__paysGen ?? 0) + 1);
      const rec = (window.__pays = { list: [{ t: g().session.tick, k: 'wake' }], jumps: [] });
      let prev = null, boxed = false;
      const frame = () => {
        if (window.__paysGen !== gen) return;
        const s = g().session, p = s.state.player;
        const mark = (k) => rec.list.push({ t: s.tick, k });
        const now = { gold: p.gold, bag: { ...p.bag }, quests: { ...p.quests }, n: p.restored.length + p.recipes.length + p.solved.length + p.visited.length };
        if (prev) {
          if (now.gold > prev.gold) mark('gold');
          for (const [k, v] of Object.entries(now.bag)) if (v > (prev.bag[k] ?? 0)) mark('bag ' + k);
          for (const [k, v] of Object.entries(now.quests)) if (prev.quests[k] !== v) mark('quest ' + k + ' ' + v);
          if (now.n > prev.n) mark('place or recipe');
        }
        const box = !!document.querySelector('.dialog');
        if (box && !boxed) mark('box');
        boxed = box;
        prev = now;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      return true;
    },
    paysOff() {
      window.__paysGen = (window.__paysGen ?? 0) + 1;
      return { ...window.__pays, end: g().session.tick };
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
    /** What the player's sprite shows: the sheet, the frame, whether it is mirrored, and whether a step is under way. */
    look() {
      const w = g().world, p = w.player;
      return { key: p.texture.key, frame: Number(p.frame.name), flip: p.flipX, moving: !!w.body.moving };
    },
    /** Starts or stops writing down what the player's sprite shows at every frame. */
    watchLook(on) {
      window.__lookGen = (window.__lookGen ?? 0) + 1;
      const gen = window.__lookGen;
      if (!on) return window.__looks ?? [];
      window.__looks = [];
      const tick = () => {
        if (window.__lookGen !== gen) return;
        window.__looks.push(this.look());
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return [];
    },
    working() { return g().world.working; },
    soundState() {
      return g().sound ? g().sound.state() : null;
    },
    soundLevel() {
      return g().sound.level();
    },
    setMuted(muted) {
      g().sound.setMuted(muted);
    },
    sfx(id) {
      g().sound.sfx(id);
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
interface SoundSnap {
  unlocked: boolean;
  muted: boolean;
  asked: Record<string, number>;
  counts: Record<string, number>;
  beds: Record<string, number>;
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
  /** how many A presses talkThrough made while a dialogue was open */
  talkPresses = 0;
  /** the free walk: the input is held until the feet stand on a tile, not pressed a tile at a time (NEXT 22 d) */
  private readonly walk: FreeWalk;
  constructor(
    readonly page: Page,
    readonly touch: boolean,
    readonly name: string,
  ) {
    this.walk = new FreeWalk(page, touch);
  }

  state(): Promise<State> {
    return this.page.eval<State>('__e2e.state()');
  }

  sound(): Promise<SoundSnap> {
    return this.page.eval<SoundSnap>('__e2e.soundState()');
  }

  /** Waits (the beds follow the player every quarter second) until a bed's level meets a test, and returns all levels. */
  async bedWhen(bed: 'fire' | 'stream' | 'dread', test: (level: number) => boolean, what: string): Promise<Record<string, number>> {
    const end = Date.now() + 8000;
    for (;;) {
      const { beds } = await this.sound();
      if (test(beds[bed] ?? 0)) return beds;
      if (Date.now() > end) throw new Error(`timed out waiting for ${what}: beds ${JSON.stringify(beds)}`);
      await sleep(100);
    }
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

  /** The A button: Enter on a keyboard, the round A on a phone. */
  async a(): Promise<void> {
    await this.settle();
    if (this.touch) await this.page.tap('.tbtn.a');
    else await this.page.press('Enter');
  }

  /**
   * One tile in a direction, or just a turn when the way is blocked, holding the input until the feet stand on
   * the tile and letting go there (NEXT 22 d). True when the player moved.
   */
  async step(dir: Dir): Promise<boolean> {
    await this.settle();
    const before = await this.state();
    const want: [number, number] = [before.pos[0] + VEC[dir][0], before.pos[1] + VEC[dir][1]];
    const open = await this.page.eval<boolean>(`__game.world.canWalk(__game.session, ${want[0]}, ${want[1]})`);
    if (!open) {
      // toward a wall the player does not yet face, the held input only turns it
      await this.walk.turnTo(dir, before.pos, `the ${dir} way out of ${before.pos.join(',')}`);
      return false;
    }
    // a box can open by itself under a walk (the night's warning): it holds the body where it stands, so it
    // is tapped away and the step taken again, twice at most; a box that is the test's own stops the step
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.walk.holdTo(want, `the ${dir} tile from ${(await this.state()).pos.join(',')}`);
      const after = (await this.state()).pos;
      if (after[0] !== before.pos[0] || after[1] !== before.pos[1]) return true;
      // the lantern warning is read where dark finds the player (pastDusk), not tapped away unread
      if (await this.lanternOpen()) {
        await this.readLantern(`the ${dir} tile from ${before.pos.join(',')}`);
        continue;
      }
      if (!(await this.walk.closeBox())) return false;
    }
    return false;
  }

  private async planTo(rect: Rect, what: string): Promise<Plan> {
    const plan = await this.page.eval<Plan | null>(`__e2e.plan(${JSON.stringify(rect)})`);
    if (!plan) throw new Error(`no way to reach ${what}`);
    return plan;
  }

  /** Walks a planned path; false at the first step that does not move the player. */
  private async follow(path: Dir[]): Promise<boolean> {
    // the tiles the plan named, counted from where the walk starts: the body holds toward a tile, not a distance
    let at = (await this.state()).pos;
    for (const d of path) {
      const next: [number, number] = [at[0] + VEC[d][0], at[1] + VEC[d][1]];
      const open = await this.page.eval<boolean>(`__game.world.canWalk(__game.session, ${next[0]}, ${next[1]})`);
      if (!open) return false;
      await this.walk.holdTo(next, `the ${d} tile of the way`);
      const now = (await this.state()).pos;
      if (now[0] !== next[0] || now[1] !== next[1]) return false;
      at = next;
    }
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
    // the action reads the tile in front of the feet, so the last turn faces what was walked to
    if (at.facing !== plan.face) await this.walk.turnTo(plan.face, plan.goal, what);
  }

  /** the lantern warning's lines, once dark has found the player on the way (pastDusk) */
  lantern: string[] = [];

  /**
   * Runs a step of the run that can meet 20:00. The game clock runs while the run plays, so a slow
   * machine can meet dark on the road: the lantern warning (G31) then opens and holds every step
   * (CI, 22.10). It is read where dark finds the player, as a player would, and the step runs again;
   * once only, and only that box at a dark hour: any other dialog, or a failure for another reason,
   * throws as it was.
   */
  async pastDusk(what: string, act: () => Promise<void>): Promise<void> {
    for (let readOnRoad = false; ; readOnRoad = true) {
      try {
        await act();
        return;
      } catch (err) {
        if (readOnRoad || !(await this.lanternOpen())) throw err;
        await this.readLantern(what);
      }
    }
  }

  /** Whether the box open now is the lantern warning, at a dark hour (G31). */
  private lanternOpen(): Promise<boolean> {
    return this.page.eval<boolean>("(__e2e.dialog()?.text ?? '').includes('lantern is lit') && (__e2e.hour() >= 20 || __e2e.hour() < 5)");
  }

  /**
   * Reads the lantern warning where dark found the player, as a player would, and keeps its lines for the
   * arch's check. A held walk (NEXT 22 d) meets it inside a step, where any other box that opened by itself
   * is tapped away; this one is read, so the night's one warning is never lost on the road.
   */
  private async readLantern(what: string): Promise<void> {
    this.lantern = await this.talkThrough();
    await this.idle('the lantern warning');
    console.log(`[${this.name}] dark came on the way to ${what}, at ${(await this.state()).pos.join(',')}: the lantern warning was read there`);
  }

  /** walkTo for a walk that can meet 20:00 on the road (pastDusk). */
  walkPastDusk(rect: Rect, what: string): Promise<void> {
    return this.pastDusk(what, () => this.walkTo(rect, what));
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
        for (let wait = 0; !d && wait < 20; wait++) {
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
          await this.page
            .waitFor('!!(document.activeElement && document.querySelector(".dialog-options")?.contains(document.activeElement))', 'option focus', 3000)
            .catch(() => undefined);
          for (let k = 0; k < want; k++) await this.page.press('ArrowDown');
          await this.page.press('Enter');
        }
        await sleep(300);
        return seen;
      }
      const fresh = await this.page.eval<{ text: string; options: string[] } | null>('__e2e.dialog()');
      if (fresh && fresh.options.length > 0) continue;
      this.talkPresses++;
      await this.a();
      await sleep(90);
    }
    throw new Error(`the dialogue never ended: ${seen.join(' / ')}`);
  }

  /** One step in a direction while writing down the sprite at every frame: the sheet must be that direction's, mirrored for right, and the legs must change. */
  async walkLook(dir: Dir): Promise<string> {
    const stem = dir === 'right' ? 'left' : dir;
    const back = ({ up: 'down', down: 'up', left: 'right', right: 'left' } as Record<Dir, Dir>)[dir];
    // A slow runner draws a 190 ms step in one or two frames, and the one it draws can be the landing (frame 1):
    // too few samples say nothing about the legs. Step back and try again before calling it a failure.
    for (let attempt = 1; ; attempt++) {
      await this.page.eval('__e2e.watchLook(true)');
      const moved = await this.step(dir);
      const looks = await this.page.eval<{ key: string; frame: number; flip: boolean; moving: boolean }[]>('__e2e.watchLook(false)');
      if (!moved) return `${dir}: blocked`;
      const striding = looks.filter((l) => l.moving);
      if (striding.length === 0) throw new Error(`no frame was drawn while stepping ${dir}`);
      for (const l of striding) {
        if (!l.key.endsWith(`_${stem}`) && !(dir === 'down' && /_down$|player$|woman$/.test(l.key))) throw new Error(`stepping ${dir} drew ${l.key}`);
        if (l.flip !== (dir === 'right')) throw new Error(`stepping ${dir} drew flip=${l.flip}`);
      }
      const frames = new Set(striding.map((l) => l.frame));
      // a leg frame (0 or 2) shows during the step; the feet-together frame (1) is where it lands
      if ([...frames].some((f) => f !== 1)) return `${dir}: ${striding[0]!.key.split('/').pop()}${dir === 'right' ? ' mirrored' : ''}, frames ${[...frames].sort().join('/')}`;
      if (striding.length >= 4 || attempt >= 4) throw new Error(`stepping ${dir} never lifted a leg: frames ${[...frames].join(',')} in ${striding.length} drawn`);
      await this.step(back);
    }
  }

  /** The work started by one press: no pop-up, no bar, the hands busy, and the node still standing. */
  async expectWorking(what: string): Promise<void> {
    await this.page.waitFor('__e2e.working()', `${what} to start by itself`, 3000);
    const pop = await this.page.eval<boolean>('!!document.querySelector(".minigame-layer, .minigame")');
    if (pop) throw new Error(`${what} opened a minigame`);
  }

  /** Solves any minigame (timing, strike, pick, snap) by waiting for data-cue="now". */
  async solveMinigame(): Promise<void> {
    await solveMinigame(this.page, this.touch);
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
        // a tree is felled, anything else gathered: the prompt must say which
        await this.expectPrompt(source === 'core/oak-trees' ? /^Fell tree/ : /^Gather /, n.id);
        await this.a();
        if (source === 'core/oak-trees') await this.expectWorking(`felling ${n.id}`);
        else await this.solveMinigame();
        await this.idle(`gathering ${n.id}`);
      }
    }
    const have = await this.bag(item);
    if (have < want) throw new Error(`only ${have} of ${want} ${item} after gathering`);
  }

  /**
   * Picks a task from an elder or a trader and confirms it. On a loaded machine the confirmation can be late,
   * or the quest already counted as taken by the time the test looks for it, so the confirmation is asked for
   * only while the quest is still not active, and a late one gets a second look before the run fails.
   */
  async acceptTask(pickTitle: string, quest: string): Promise<void> {
    await this.talkThrough(pickTitle);
    for (let tries = 0; tries < 2; tries++) {
      if ((await this.quest(quest)) === 'active') return;
      try {
        await this.talkThrough('I will do it');
        return;
      } catch (err) {
        if ((await this.quest(quest)) === 'active') return;
        if (tries === 1) throw err;
        await sleep(1000);
      }
    }
  }

  async quest(id: string): Promise<string | undefined> {
    return this.page.eval<string | undefined>(`__e2e.player().quests[${JSON.stringify(id)}]`);
  }
}

/** The minute of the game day, 0 to 1439 (tick 0 is noon), as an in-page expression. */
const DAY_MINUTE = '(() => { const s = __game.session, day = __game.bundle.params.day_length_ms; return Math.floor((((s.tick + Math.floor(day / 2)) % day) * 1440) / day); })()';
/**
 * The latest stew hand-in that still leaves the walk to the hill, the dig and the walk back to Maru before 20:00:
 * those take about 40 game minutes on a laptop (19:00 to 19:39), so 19:10 leaves a slower machine a quarter more.
 */
const LATEST_HILL_MINUTE = 19 * 60 + 10;

/** OPENING_REVIEW criterion 8: the longest stretch of play clock between two pays, the clock's own jumps counted as waiting. */
const LONGEST_STRETCH_MS = 90_000;
async function stretches(page: Page, log: (msg: string) => void, who: string, until: string): Promise<{ ms: number; from: string; to: string }[]> {
  const r = await page.eval<{ list: { t: number; k: string }[]; jumps: { from: number; to: number }[]; end: number }>('__e2e.paysOff()');
  const gaps: { ms: number; from: string; to: string }[] = [];
  for (let i = 1; i < r.list.length; i++) gaps.push({ ms: r.list[i]!.t - r.list[i - 1]!.t, from: r.list[i - 1]!.k, to: r.list[i]!.k });
  const last = r.list[r.list.length - 1]!;
  gaps.push({ ms: r.end - last.t, from: last.k, to: until });
  gaps.sort((a, b) => b.ms - a.ms);
  const skipped = r.jumps.reduce((n, j) => n + (j.to - j.from), 0);
  log(`${who}: ${r.list.length} pays to ${until} in ${Math.round(r.end / 1000)} s of play clock, ${Math.round(skipped / 1000)} s of it skipped by the run`);
  for (const g of gaps.slice(0, 3)) log(`${who}: stretch ${(g.ms / 1000).toFixed(1)} s from "${g.from}" to "${g.to}"`);
  // reported, not thrown: the phone run is over the ceiling while the owner decides what to shorten (criterion 8)
  log(`${who}: criterion 8 ${gaps[0]!.ms <= LONGEST_STRETCH_MS ? 'PASS' : 'FAIL'}: the longest stretch is ${(gaps[0]!.ms / 1000).toFixed(1)} s against ${LONGEST_STRETCH_MS / 1000} s`);
  return gaps;
}

/** One opening run: its device, the race it picks on the title, the pocket its seed wakes it in, and whether it ends at the bridge. */
interface Run {
  name: string;
  viewport: Viewport;
  race: string;
  pocket: WakePocket;
  toBridge?: boolean;
  /** The lucky digger: a seed whose first hall dig gives the whole bowl; the run ends at Maru's stew. Played only by name. */
  lucky?: boolean;
}

async function play(browser: Browser, url: string, run: Run): Promise<void> {
  const { name, viewport } = run;
  const page = await browser.newPage(viewport);
  // E2E_VIDEO=<dir> keeps every frame of the run, for a video of the opening
  if (process.env.E2E_VIDEO) await page.record(join(process.env.E2E_VIDEO, name));
  const me = new Player(page, viewport.mobile, name);
  const log = (msg: string) => console.log(`[${name}] ${msg}`);
  try {
    // E2E_QUERY=a=1&b=2 rides behind ?debug: the static server drops the query, the game reads it
    const extra = process.env.E2E_QUERY ? `&${process.env.E2E_QUERY}` : '';
    // the seed draws the wake pocket (DECISIONS.md, 2026-10-22): fixed, so the run wakes where it means to
    await page.goto(`${url}?debug${run.lucky ? `&seed=${LUCKY_BOWL.seed}` : seedQuery(run.pocket)}${extra}`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
    await page.eval(IN_PAGE);
    await me.snap('title');

    // 1. pick a race; where it wakes is the seed's draw, not a choice
    await page.tap('.title-screen button', 'New game');
    // a save from an earlier run asks first
    const ask = await page.waitFor<string>(
      `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
      'the race cards',
    );
    if (ask === 'ask') await page.tap('.title-screen button', 'Start a new game');
    await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards');
    const cards = await page.eval<number>(`document.querySelectorAll('.card.race').length`);
    if (cards !== 3) throw new Error(`${cards} race cards on the title, not three`);
    await page.tap('.card.race', run.race);
    // the skeleton is one figure: no look to pick
    const toggle = await page.eval<boolean>(`!document.querySelector('.look-toggle').hidden`);
    if (toggle !== (run.race !== 'Skeleton')) throw new Error(`the look toggle is ${toggle ? 'shown' : 'hidden'} for the ${run.race}`);
    await page.tap('input.name');
    await page.type('Tess');
    await me.snap('choose');
    await page.tap('.title-screen button', 'Wake up');

    // 2. wake up by the broken bridge
    const clicks0 = (await me.sound()).asked.click ?? 0;
    await page.eval('__e2e.paysOn()');
    const intro = await me.talkThrough();
    // criterion 7 (OPENING_REVIEW): the first box is one box of at most two lines of 80 characters, one tap to the first move
    const waking = (intro[0] ?? '').split('\n');
    if (intro.length !== 1 || waking.length > 2 || waking.some((l) => l.length > 80)) throw new Error(`the waking box is not one box of two short lines: ${JSON.stringify(intro)}`);
    if (!waking[0]?.includes('mist')) throw new Error(`the waking box does not open on the mist: ${JSON.stringify(intro)}`);
    if (me.talkPresses > 1) throw new Error(`${me.talkPresses} taps before the first move, not at most one`);
    // the bridge and its keystone come from the task tracker, not from the waking lines
    if ((await me.quest('core/fix-the-bridge')) !== 'active') throw new Error('the bridge task is not in the tracker at the wake');
    // 4b criterion: the click plays exactly once per advance of the dialogue
    const clicks = ((await me.sound()).asked.click ?? 0) - clicks0;
    if (clicks !== me.talkPresses) throw new Error(`${me.talkPresses} presses of A on the intro made ${clicks} clicks, not one each`);
    log(`dialogue click: ${clicks} clicks for ${me.talkPresses} advances`);
    const atBridge = await me.bedWhen('stream', (l) => l > 0.3, 'the stream heard from the riverbank where the player wakes');
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

    // 2a. the race picked, the pocket drawn; the pocket's tools lie on the ground by the wake, found by hand and not worn
    const who = await page.eval<{ race: string; pocket: string; worn: Record<string, string> }>('__e2e.player()');
    if (who.pocket !== run.pocket) throw new Error(`the seed woke the character in ${who.pocket}, not ${run.pocket}`);
    if (who.race !== `core/${run.race.toLowerCase()}`) throw new Error(`the character is ${who.race}, not the ${run.race}`);
    const ground = await page.eval<{ source: string; item: string }[]>(`(() => {
      const b = __game.bundle, p = __e2e.player().pocket, lays = (b.pockets[p]?.ground ?? []).map((k) => k.item);
      return Object.entries(b.treasures)
        .filter(([, t]) => t.pocket === p && !t.tool && t.finds.every((f) => lays.includes(f.item)))
        .map(([id, t]) => ({ source: id, item: t.finds[0].item }));
    })()`);
    const lays = await page.eval<number>(`(__game.bundle.pockets[__e2e.player().pocket]?.ground ?? []).length`);
    if (ground.length === 0 || ground.length !== lays) throw new Error(`${ground.length} spots lay the ${lays} tools of ${run.pocket}`);
    for (const g of ground) {
      if ((await me.bag(g.item)) !== 0) throw new Error(`${g.item} is in the bag at the wake: it should lie on the ground`);
      const [spot] = await page.eval<{ id: string; x: number; y: number }[]>(`__e2e.nodes(${JSON.stringify(g.source)})`);
      if (!spot) throw new Error(`no ${g.source} by the wake`);
      await me.walkTo({ x: spot.x, y: spot.y, w: 1, h: 1 }, g.source);
      await me.expectPrompt(/^Pick up/, g.source);
      await me.a();
      await me.idle(`picking up ${g.item}`);
      if ((await me.bag(g.item)) !== 1) throw new Error(`no ${g.item} in the bag after ${g.source}`);
      const worn = await page.eval<string[]>('Object.values(__e2e.player().worn)');
      if (worn.includes(g.item)) throw new Error(`${g.item} was put on: a found tool goes into the bag`);
    }
    await me.snap('ground');
    log(`${run.race} woke in ${run.pocket} and picked up ${ground.map((g) => g.item).join(' and ')}`);

    // 2b. each pocket its own first task: the west bank's herbs
    if (run.pocket === 'core/west-bank') {
      await me.gather('core/bank-herbs', 'core/herb', 2);
      if ((await me.quest('core/first-pickings')) !== 'done') throw new Error('first-pickings is not done');
      log('picked 2 herbs on the west bank');
    }

    // 2c. the north meadow's glint leads to an axe in the grass by the bridge, picked up by hand, before the keystone opens
    if (run.pocket === 'core/north-meadow') {
      const [glint] = await page.eval<{ id: string; x: number; y: number }[]>('__e2e.nodes("core/bridge-glint")');
      if (!glint) throw new Error('no glint by the bridge');
      await me.walkTo({ x: glint.x, y: glint.y, w: 1, h: 1 }, 'the glint by the bridge');
      await me.expectPrompt(/^Pick up/, 'the glint by the bridge');
      await me.snap('senses');
      await me.a();
      await me.idle('picking up the axe');
      if ((await me.bag('core/axe')) !== 1) throw new Error('no axe after the glint by the bridge');
      if ((await me.quest('core/glint-by-the-bridge')) !== 'done') throw new Error('glint-by-the-bridge is not done');
      log('picked up the axe by the bridge');
    }

    // 2d. the slid bank: the trowel found by the wake digs the axe out of the bank that slid
    if (run.pocket === 'core/slid-bank') {
      const [bank] = await page.eval<{ id: string; x: number; y: number }[]>('__e2e.nodes("core/slid-bank-dig")');
      if (!bank) throw new Error('no slid bank to dig');
      await me.walkTo({ x: bank.x, y: bank.y, w: 1, h: 1 }, 'the slid bank');
      await me.expectPrompt(/^Dig here/, 'the slid bank');
      await me.snap('slid-bank');
      await me.a();
      await me.expectWorking('digging the slid bank');
      await me.idle('digging the slid bank');
      if ((await me.bag('core/axe')) !== 1) throw new Error('no axe out of the slid bank');
      if ((await me.quest('core/buried-axe')) !== 'done') throw new Error('buried-axe is not done');
      log('dug the axe out of the slid bank');
    }

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

    // 4. mend the bridge: the first restoration, level, journal entry and the stone with my name
    const known = (await page.eval<{ recipes: string[] }>('__e2e.player()')).recipes.length;
    const bridge = await page.eval<Rect>(`__e2e.slot('core/old-bridge')`);
    await me.walkTo(bridge, 'the broken bridge');
    await me.expectPrompt(/^Mend/, 'the bridge');
    await me.a();
    await me.talkThrough('Mend it');
    await me.done('mending the bridge');
    const mended = await me.talkThrough();
    await me.idle('the bridge story');
    if (!mended.some((l) => l.includes('You cut Tess into the last line'))) throw new Error(`no cut name "Tess" after the bridge: ${mended.join(' / ')}`);
    if ((await me.quest('core/fix-the-bridge')) !== 'done') throw new Error('fix-the-bridge is not done');
    const journal = await page.eval<number>('__e2e.player().journal.length');
    if (journal < 1) throw new Error('no journal entry after the bridge');
    const purse = await page.eval<{ gold: number; recipes: string[] }>('__e2e.player()');
    if (purse.gold !== 30_000) throw new Error(`the bridge paid ${purse.gold} mg, not the price of one tool`);
    if (purse.recipes.length !== known) throw new Error('the purse under the stone taught a recipe: it holds gold only');
    await me.snap('bridge');
    log('mended the bridge: 30000 mg in the purse');
    // the slid bank's run ends here: the walk, the fire and the town are the same for every pocket and run twice above
    if (run.toBridge) {
      if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
      log('the slid bank run ends at the mended bridge');
      return;
    }

    // 4b. game feel: the four walks, one press fells a tree on its own, and a step away stops the work
    const walks: string[] = [];
    const room = await me.state();
    // a tile whose four neighbours are all open, so each direction can be walked and walked back
    const clear = await page.eval<[number, number] | null>(`(() => {
      const w = __game.world, s = __game.session, m = __game.bundle.map;
      let best = null, bestD = 1e9;
      for (let y = 1; y < m.height - 1; y++) for (let x = 1; x < m.width - 1; x++) {
        if (![[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => w.canWalk(s, x + dx, y + dy))) continue;
        const d = Math.abs(x - ${room.pos[0]}) + Math.abs(y - ${room.pos[1]});
        if (d < bestD) { bestD = d; best = [x, y]; }
      }
      return best;
    })()`);
    if (!clear) throw new Error('no open ground to show the four walks on');
    await me.walkTo({ x: clear[0], y: clear[1], w: 1, h: 1 }, 'open ground for the walk cycles');
    await me.step((await me.state()).facing); // the walk stops beside it, one step more stands on it
    const stood = (await me.state()).pos;
    if (stood.join(',') !== clear.join(',')) throw new Error(`wanted to stand on ${clear.join(',')} for the walks, stand on ${stood.join(',')}`);
    for (const d of ['left', 'right', 'up', 'down'] as Dir[]) {
      walks.push(await me.walkLook(d));
      await me.snap(`walk-${d}`);
    }
    log(`walk cycles: ${walks.join(' | ')}`);
    if (walks.some((w) => w.endsWith('blocked'))) throw new Error(`not all four walks could be drawn from ${room.pos.join(',')}: ${walks.join(' | ')}`);
    await me.snap('walk');
    const oaks = await page.eval<{ id: string; x: number; y: number; ready: boolean }[]>('__e2e.nodes("core/oak-trees")');
    const oak = oaks.find((n) => n.ready);
    if (!oak) throw new Error('no ready oak');
    const logs0 = await me.bag('core/log');
    await me.walkTo({ x: oak.x, y: oak.y, w: 1, h: 1 }, oak.id);
    await me.expectPrompt(/^Fell tree/, oak.id);
    await me.a();
    await me.expectWorking('the first swings');
    await sleep(1100);
    await me.snap('swing');
    // a step away: the work stops, nothing was cut, the tree stands ready
    const facing = (await me.state()).facing;
    const away = [OPPOSITE[facing], ...(Object.keys(VEC) as Dir[]).filter((d) => d !== facing && d !== OPPOSITE[facing])];
    let left = false;
    for (const d of away) {
      const here = (await me.state()).pos;
      const open = await page.eval<boolean>(`__game.world.canWalk(__game.session, ${here[0] + VEC[d][0]}, ${here[1] + VEC[d][1]})`);
      if (open && (await me.step(d))) {
        left = true;
        break;
      }
    }
    if (!left) throw new Error('no free tile to step away to from the tree');
    if (await page.eval<boolean>('__e2e.working()')) throw new Error('the work went on after a step away');
    if ((await me.bag('core/log')) !== logs0) throw new Error('a step away still cut logs');
    if (!(await page.eval<{ id: string; ready: boolean }[]>('__e2e.nodes("core/oak-trees")')).find((n) => n.ready && n.id === oak.id)) throw new Error('the tree is not ready after a step away');
    log('a step away stopped the felling: no logs, the tree still standing');
    // one press, no further input: the tree comes down and its logs are in the bag
    await me.walkTo({ x: oak.x, y: oak.y, w: 1, h: 1 }, oak.id);
    await me.expectPrompt(/^Fell tree/, oak.id);
    await me.a();
    await me.expectWorking('the felling');
    await page.waitFor(`__e2e.player().bag['core/log'] >= ${logs0 + 3}`, 'the tree to fall by itself', 15_000);
    await me.idle('the felling');
    if ((await me.bag('core/log')) !== logs0 + 3) throw new Error(`one tree gave ${(await me.bag('core/log')) - logs0} logs, not 3`);
    log('one press felled the tree by itself: 3 logs, no pop-up');

    // 5. a fire before dark, from a felled tree
    await me.gather('core/oak-trees', 'core/log', 2);
    const fire = await page.eval<[number, number]>(`(() => { const c = __e2e.slot('core/camp'); return [c.x + 2, c.y + 2]; })()`);
    await me.walkTo({ x: fire[0], y: fire[1], w: 1, h: 1 }, 'the fire spot');
    await me.expectPrompt(/^Build: Campfire/, 'the fire spot');
    await me.a();
    await me.talkThrough('Build it');
    await me.done('building the fire');
    await me.idle('the fire');
    if ((await me.quest('core/first-fire')) !== 'done') throw new Error('first-fire is not done');
    await me.snap('camp');
    log('felled a tree and built a fire');

    // 5b. sound by place (4b): the fire is loudest beside it, the output is real, and the mute silences it all
    const atFire = await me.bedWhen('fire', (l) => l > 0.9, 'the crackle beside the fire');
    const heardAtFire = await me.sound();
    log(`beds beside the fire: ${JSON.stringify(atFire)}`);
    if (heardAtFire.unlocked) {
      const heard = await page.waitFor<number>(`(() => { const l = __e2e.soundLevel(); return l > 0.0005 ? l : 0; })()`, 'sound leaving the speakers beside the fire', 6000);
      const before = (await me.sound()).counts.click ?? 0;
      await page.eval('__e2e.setMuted(true)');
      await sleep(400);
      const quiet = await page.eval<number>('__e2e.soundLevel()');
      await page.eval(`__e2e.sfx('click')`);
      const after = await me.sound();
      if (quiet > 0.0001) throw new Error(`muted, but the output is still ${quiet}`);
      if ((after.counts.click ?? 0) !== before) throw new Error('a click sounded while muted');
      await page.eval('__e2e.setMuted(false)');
      log(`mute: output ${heard.toFixed(4)} unmuted, ${quiet.toFixed(6)} muted, no effect sounded while muted`);
    } else {
      log('audio context is not running here: output level and mute measured on the state only');
      await page.eval('__e2e.setMuted(true)');
      await page.eval(`__e2e.sfx('click')`);
      if (((await me.sound()).counts.click ?? 0) !== 0) throw new Error('a click sounded while muted');
      await page.eval('__e2e.setMuted(false)');
    }

    // 6. the town: the creators' signs, and the real choice of the opening, whom to help first
    // the walk stops beside the square and one step enters it, since the word in town stops the walk
    const square = await page.eval<Rect>(`__e2e.slot('core/town-square')`);
    await me.walkTo(square, 'the town square');
    await me.step((await me.state()).facing);
    const town = await me.talkThrough();
    await me.idle('arriving in town');
    if ((await me.quest('core/into-town')) !== 'done') throw new Error('into-town is not done');
    if (!town.some((l) => l.includes('Whom you help first'))) throw new Error(`no word of whom to help first: ${town.join(' / ')}`);
    log('reached the town: Maru and Pell could use a hand');
    // 4b criterion: each source is quieter the farther you stand from it
    const inTown = await me.bedWhen('fire', (l) => l === 0, 'the fire out of earshot in town');
    if (!(atFire.fire! > inTown.fire!)) throw new Error('the fire is not quieter in town');
    await me.bedWhen('stream', (l) => l < atBridge.stream!, 'the stream quieter than at the bridge');
    log(`beds in town: ${JSON.stringify(inTown)}; fire ${atFire.fire} -> ${inTown.fire}`);

    // 7. whom to help first: the phone helps Maru (his bells, for his old trowel), the desktop helps Pell (her herbs, for a recipe and coin)
    const elder = await page.eval<[number, number]>(`(() => { const s = __e2e.slot('core/elder-house'); return [s.x + 1, s.y + 1]; })()`);
    const trader = await page.eval<[number, number]>(`(() => { const s = __e2e.slot('core/trader-stall'); return [s.x + 1, s.y]; })()`);
    const first = viewport.mobile ? 'Where the bells rang' : 'Herbs for Pell';
    if (viewport.mobile) {
      await me.walkTo({ x: elder[0], y: elder[1], w: 1, h: 1 }, 'Elder Maru');
      await me.expectPrompt(/^Talk to Elder Maru/, 'the elder');
    } else {
      await me.walkTo({ x: trader[0], y: trader[1], w: 1, h: 1 }, 'Pell');
      await me.expectPrompt(/^Talk to Pell/, 'the trader');
    }
    await me.a();
    await me.acceptTask(first, viewport.mobile ? 'core/three-fruits' : 'core/herbs-for-pell');
    await me.idle('accepting the task');
    const taken = viewport.mobile ? 'core/three-fruits' : 'core/herbs-for-pell';
    if ((await me.quest(taken)) !== 'active') throw new Error(`${taken} was not accepted`);
    const tracker = await page.eval<string>(`document.querySelector('.tracker')?.textContent ?? ''`);
    if (/\d+\/\d+/.test(tracker)) throw new Error(`the tracker counts instead of hinting: "${tracker}"`);
    if (!viewport.mobile && !tracker.includes('mist is thin at noon')) throw new Error(`the tracker does not show the clue: "${tracker}"`);
    log(`helps ${viewport.mobile ? 'Maru' : 'Pell'} first: ${first}`);

    // 8. the desktop spends the bridge's purse on a basket, and the stall says what it opens (G12)
    let paid = 0;
    if (!viewport.mobile) {
      await me.walkTo({ x: trader[0], y: trader[1], w: 1, h: 1 }, 'Pell');
      await me.expectPrompt(/^Talk to Pell/, 'the trader');
      await me.a();
      await me.talkThrough('Trade');
      await page.waitFor(`!!document.querySelector('.panel .row')`, 'the shop');
      const opens = await page.eval<string>(
        `(() => { for (const r of document.querySelectorAll('.panel .row')) if (r.querySelector('b')?.textContent === 'Basket') return r.querySelector('[data-opens]')?.textContent ?? ''; return ''; })()`,
      );
      // both neighbours' roads, since whom to help first is the player's
      for (const road of ['Herbs for Pell', 'Where the bells rang']) {
        if (!opens.includes(road)) throw new Error(`the stall does not say the basket opens "${road}": "${opens}"`);
      }
      await me.snap('shop');
      await me.tapInRow('Basket', 'Buy');
      await page.waitFor(`(__e2e.player().bag['core/basket'] ?? 0) > 0`, 'a basket in the bag', 3000);
      await page.tap('.panel header button', 'Close');
      await me.idle('closing the shop');
      paid = await page.eval<number>('__e2e.player().gold');
      log(`bought a basket: ${opens}`);
    }

    // 9. a ruin in the mist at the edge of town, waiting for a creator (no way into the developers' pages from the game: DECISIONS 2026-10-11)
    const ruin = await page.eval<Rect>(`__e2e.slot('core/town-edge')`);
    await me.walkTo(ruin, 'the ruined house');
    await me.expectPrompt(/^(Look at|Read the sign)/, 'the ruined house');
    await me.snap('ruin');
    await me.a();
    const sign = await me.talkThrough();
    if (!sign.some((l) => l.includes('Awaiting restoration'))) throw new Error(`the ruin does not await restoration: ${sign.join(' / ')}`);
    if (await page.eval<boolean>(`!!document.querySelector('.dialog-options button')`)) throw new Error('the ruin sign offers an option');
    await me.snap('ruin-sign');
    log('read the ruin sign: it awaits restoration, with no guide');

    // 10. Maru's bells, then his coin by the trowel's road toward the first night (phone); Pell's herbs (desktop)
    if (viewport.mobile) {
      const hour = await page.eval<number>('__e2e.hour()');
      if (hour < 5 || hour >= 20) throw new Error(`the bell bushes are closed at ${hour}:00: the run took too long to reach the garden`);
      await me.gather('core/bell-bushes', 'core/bellberry', 1);
      await me.walkTo({ x: elder[0], y: elder[1], w: 1, h: 1 }, 'Elder Maru');
      await me.a();
      await me.talkThrough('Where the bells rang');
      const thanks = await me.talkThrough();
      await me.idle('the thanks');
      if (!thanks.some((l) => l.includes('a tool of mine'))) throw new Error(`the elder never gives a tool of his: ${thanks.join(' / ')}`);
      if ((await me.bag('core/trowel')) < 1) throw new Error('no trowel from Maru');
      log('handed in the bellberry: Maru gave his old trowel');
      await me.walkTo({ x: elder[0], y: elder[1], w: 1, h: 1 }, 'Elder Maru');
      await me.expectPrompt(/^Talk to Elder Maru/, 'the elder');
      await me.a();
      await me.acceptTask('The coin under the lantern', 'core/a-coin-for-maru');
      await me.idle('accepting the coin');
      if ((await me.quest('core/a-coin-for-maru')) !== 'active') throw new Error('a-coin-for-maru was not accepted');
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
      // the wait for dusk is filled by Pell's herbs, open from noon (OPENING_REVIEW Q2): take them, pick one, hand it in
      await me.walkTo({ x: trader[0], y: trader[1], w: 1, h: 1 }, 'Pell');
      await me.expectPrompt(/^Talk to Pell/, 'the trader');
      await me.a();
      await me.acceptTask('Herbs for Pell', 'core/herbs-for-pell');
      await me.idle('accepting the herbs');
      if ((await me.quest('core/herbs-for-pell')) !== 'active') throw new Error('herbs-for-pell was not accepted');
      await me.gather('core/sun-herbs', 'core/sunleaf', 1);
      await me.walkTo({ x: trader[0], y: trader[1], w: 1, h: 1 }, 'Pell');
      await me.a();
      await me.talkThrough('Herbs for Pell');
      await me.talkThrough();
      await me.idle('handing in the herbs');
      if ((await me.quest('core/herbs-for-pell')) !== 'done') throw new Error('herbs-for-pell is not done');
      log('helped Pell as well: the herbs and the stew while the day runs out');
      // the afternoon is played, not skipped (criterion 8): Pell's whole bowl, a gamble in the collapsed hall, then Maru's stew,
      // whose mushrooms open when the grove cools at 17:00
      await me.walkTo({ x: trader[0], y: trader[1], w: 1, h: 1 }, 'Pell');
      await me.expectPrompt(/^Talk to Pell/, 'the trader');
      await me.a();
      await me.acceptTask('A whole one', 'core/a-whole-one');
      await me.idle('accepting the bowl');
      if ((await me.quest('core/a-whole-one')) !== 'active') throw new Error('a-whole-one was not accepted');
      let digs = 0;
      const hallBy = Date.now() + 300_000;
      while ((await me.bag('core/whole-bowl')) < 1) {
        if (Date.now() > hallBy) throw new Error(`no whole bowl after ${digs} digs in the collapsed hall`);
        if ((await me.bag('core/trowel')) < 1) throw new Error(`the trowel wore out after ${digs} digs in the collapsed hall`);
        const ready = (await page.eval<{ id: string; x: number; y: number; ready: boolean }[]>('__e2e.nodes("core/ruins-hall")'))
          .filter((n) => n.ready && (!run.lucky || n.id === LUCKY_BOWL.spot));
        if (ready.length === 0) {
          await sleep(1000);
          continue;
        }
        const n = ready[0]!;
        await me.walkTo({ x: n.x, y: n.y, w: 1, h: 1 }, n.id);
        await me.expectPrompt(/^Dig here/, n.id);
        await me.a();
        await me.expectWorking(`digging ${n.id}`);
        await me.idle(`digging ${n.id}`);
        digs += 1;
      }
      if (run.lucky && digs !== 1) throw new Error(`the lucky seed took ${digs} digs for the bowl, not one`);
      await me.walkTo({ x: trader[0], y: trader[1], w: 1, h: 1 }, 'Pell');
      await me.a();
      await me.talkThrough('A whole one');
      const bowl = await me.talkThrough();
      await me.idle('handing in the bowl');
      if ((await me.quest('core/a-whole-one')) !== 'done') throw new Error('a-whole-one is not done');
      if ((await me.bag('core/reed-basket')) < 1) throw new Error('no reed basket from Pell');
      if (!bowl.some((l) => l.includes('A reed basket'))) throw new Error(`Pell's done line does not name the basket: ${bowl.join(' / ')}`);
      log(`dug the collapsed hall ${digs} times for a whole bowl: Pell gave a reed basket`);
      await me.walkTo({ x: elder[0], y: elder[1], w: 1, h: 1 }, 'Elder Maru');
      await me.expectPrompt(/^Talk to Elder Maru/, 'the elder');
      await me.a();
      await me.acceptTask('Something warm for the night', 'core/something-warm');
      await me.idle('accepting the stew');
      if ((await me.quest('core/something-warm')) !== 'active') throw new Error('something-warm was not accepted');
      const fireAt = await page.eval<[number, number]>(`(() => { const c = __e2e.slot('core/camp'); return [c.x + 2, c.y + 2]; })()`);
      const basketWorn = await page.eval<number>(`__e2e.player().wear['core/reed-basket'] ?? 0`);
      for (let tries = 0; tries < 3 && !(await page.eval<boolean>(`(__e2e.player().made['core/herb-stew'] ?? 0) > 0`)); tries++) {
        await me.gather('core/berry-bushes', 'core/berry', 1);
        await me.gather('core/wild-herbs', 'core/herb', 2);
        if ((await me.bag('core/mushroom')) < 2) {
          // the grove opens its mushrooms at 17:00: the player waits beside it, and the wait counts
          await me.walkPastDusk(await page.eval<Rect>(`__e2e.slot('core/forest-mushrooms')`), 'the grove');
          await page.waitFor('__e2e.hour() >= 17 || __e2e.hour() < 5', 'the grove to cool at 17:00', 300_000);
          await me.gather('core/forest-mushrooms', 'core/mushroom', 2);
        }
        await me.walkPastDusk({ x: fireAt[0], y: fireAt[1], w: 1, h: 1 }, 'the fire');
        await me.expectPrompt(/^Cook at the/, 'the fire');
        await me.a();
        await page.waitFor(`!!document.querySelector('.panel .row')`, 'the cooking panel');
        await me.tapInRow('Herb stew', 'Cook');
        await me.idle('cooking the stew');
      }
      if (!(await page.eval<boolean>(`(__e2e.player().made['core/herb-stew'] ?? 0) > 0`))) throw new Error('no herb stew after three tries');
      if ((await page.eval<number>(`__e2e.player().wear['core/reed-basket'] ?? 0`)) <= basketWorn) throw new Error("Pell's reed basket was not used for the stew");
      const branches = await me.bag('core/branch');
      await me.walkPastDusk({ x: elder[0], y: elder[1], w: 1, h: 1 }, 'Elder Maru');
      await me.a();
      await me.talkThrough('Something warm for the night');
      const warm = await me.talkThrough();
      await me.idle('handing in the stew');
      if ((await me.quest('core/something-warm')) !== 'done') throw new Error('something-warm is not done');
      if ((await me.bag('core/branch')) !== branches + 2) throw new Error('no dry branches from Maru');
      if (!warm.some((l) => l.includes('a fire of your own'))) throw new Error(`Maru's done line does not point to the night: ${warm.join(' / ')}`);
      log(`cooked a herb stew for Maru at ${await page.eval<number>('__e2e.hour()')}:00: dry branches, and the long night opens`);
      // the lucky digger reaches the grove earliest: its wait is the longest the fillers leave (criterion 8); the rest is the phone run's
      if (run.lucky) {
        await stretches(page, log, name, "Maru's stew");
        if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
        return;
      }
      // the hill is dug at dusk and left before dark, when the night hunts on it. A slow machine can hand in the stew too late
      // for that (CI, 22.10: the stew at 19:3x, dark on the road to the hill, a fall at the dig): then the player stays in town
      // for the next dusk, as a player would. The jump is a skip of the run, counted as waiting (criterion 8)
      const stewAt = await page.eval<number>(DAY_MINUTE);
      if (stewAt >= LATEST_HILL_MINUTE || stewAt < 5 * 60) {
        await page.eval('__e2e.setHour(19)');
        log(`the stew came at ${Math.floor(stewAt / 60)}:${String(stewAt % 60).padStart(2, '0')}, too late to dig before dark: the player waits in town for the next dusk`);
      }
      // at dusk the hill lantern lights the tile to dig: the player waits beside it, and the wait counts.
      // From the stew on, every step that can meet 20:00 on a slow machine reads the lantern warning where it opens (pastDusk)
      await me.walkPastDusk({ x: spot.x, y: spot.y, w: 1, h: 1 }, 'the spot under the hill lantern');
      await page.waitFor('__e2e.hour() >= 19 || __e2e.hour() < 5', 'dusk at 19:00', 300_000);
      await page.waitFor(`__e2e.glint(${spot.x}, ${spot.y})`, 'the lantern to light the spot at dusk', 5000);
      for (let tries = 0; tries < 3 && (await me.bag('core/maru-coin')) < 1; tries++) {
        await page.waitFor('__e2e.nodes("core/lantern-foot")[0].ready', 'the spot under the lantern to be ready', 90_000);
        await me.pastDusk('the spot under the hill lantern', async () => {
          await me.walkTo({ x: spot.x, y: spot.y, w: 1, h: 1 }, 'the spot under the hill lantern');
          await me.expectPrompt(/^Dig here/, 'the spot under the hill lantern');
        });
        if (tries === 0) await me.snap('dusk');
        await me.a();
        await me.expectWorking('digging under the lantern');
        await me.pastDusk('the end of the dig', () => me.idle('digging under the lantern'));
      }
      if ((await me.bag('core/maru-coin')) < 1) throw new Error('no coin after three digs under the hill lantern');
      const solved = await page.eval<string[]>('__e2e.player().solved');
      if (!solved.includes('core/a-coin-for-maru#0')) throw new Error(`the riddle is not solved: [${solved.join(', ')}]`);
      await me.snap('riddle');
      await me.walkPastDusk({ x: elder[0], y: elder[1], w: 1, h: 1 }, 'Elder Maru');
      const unpaid = await page.eval<number>('__e2e.player().gold');
      await me.a();
      await me.talkThrough('The coin under the lantern');
      const coin = await me.talkThrough();
      await me.idle('handing in the coin');
      if ((await me.quest('core/a-coin-for-maru')) !== 'done') throw new Error('a-coin-for-maru is not done');
      // the coin pays gold and the herb tea, and no basket: every start holds one by now
      const coinPaid = (await page.eval<number>('__e2e.player().gold')) - unpaid;
      if (coinPaid !== 20_000) throw new Error(`the coin paid ${coinPaid} mg, not 20000`);
      if ((await me.bag('core/basket')) !== 1) throw new Error('a second basket after the coin');
      if (!(await page.eval<string[]>('__e2e.player().recipes')).includes('core/herb-tea')) throw new Error('the herb-tea recipe was not learned');
      if (!coin.some((l) => l.includes('arch'))) throw new Error(`the elder never mentions the arch: ${coin.join(' / ')}`);
      if ((await me.quest('core/the-night-arch')) !== 'active') throw new Error('the-night-arch did not start');
      log('read the three stones, dug under the hill lantern, handed in the coin');

      // 11. the first night: the broken arch shows a way, and it leads to the threshold of the night ruins
      const mouth = await page.eval<Rect>(`__e2e.slot('core/arch-mouth')`);
      const threshold = await page.eval<Rect>(`__e2e.slot('core/night-threshold')`);
      // a walk to a place stops beside it, never through it, so the arch is entered only by the step below.
      // A slow machine can meet 20:00 before the arch: the lantern warning was then read on the road (pastDusk)
      await me.walkPastDusk(mouth, 'the broken arch');
      let lantern = me.lantern;
      if (await page.eval<boolean>(`!!__e2e.plan(${JSON.stringify(threshold)})`)) throw new Error('the night ruins are open before the arch');
      // dark comes at 20:00; the player waits for it at the arch, and the wait counts (criterion 8)
      await page.waitFor('__e2e.hour() >= 20 || __e2e.hour() < 5', 'dark at 20:00', 300_000);
      // dark finds the player outside a safe place: the lantern is lit, with its one box a night (G31)
      if (lantern.length === 0) {
        await page.waitFor('!!__e2e.dialog()', 'the lantern warning', 5000);
        lantern = await me.talkThrough();
        await me.idle('the lantern warning');
      }
      if (!lantern.some((l) => l.includes('lantern is lit'))) throw new Error(`no lantern warning at dark: ${lantern.join(' / ')}`);
      const lit = { x: mouth.x + Math.floor(mouth.w / 2), y: mouth.y + mouth.h - 1 };
      await page.waitFor(`__e2e.glint(${lit.x}, ${lit.y})`, 'the arch to show its way at night', 5000);
      await me.snap('arch');
      await me.step((await me.state()).facing);
      const opened = await me.talkThrough();
      await me.idle('the arch opening');
      if (!opened.some((l) => l.includes('way runs under it'))) throw new Error(`no word of the way under the arch: ${opened.join(' / ')}`);
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
      // the one-time development review follows the last words; skip it, as a player may
      await page.waitFor(`!!document.querySelector('.panel.review')`, 'the development review', 5000);
      await page.eval(`[...document.querySelectorAll('.panel.review .btn')].find((b) => b.textContent === 'Skip').click()`);
      await me.idle('the threshold');
      if (!below.some((l) => l.includes('Not tonight'))) throw new Error(`no door left open at the threshold: ${below.join(' / ')}`);
      const visited = await page.eval<string[]>('__e2e.player().visited');
      if (!visited.includes('core/night-threshold')) throw new Error('the threshold was not reached');
      await me.snap('threshold');
      log(`walked under the arch at ${await page.eval<number>('__e2e.hour()')}:00 and reached the threshold of the night ruins`);
      await stretches(page, log, name, 'the threshold');

      // 12. the threshold is safe and the night hunts one step past it (P-5c): the pit, then the wolf, then a fall.
      // The safe threshold has just closed the outing, so the fall takes nothing back: the bag and the quests stay.
      const kept = await page.eval<string>('JSON.stringify({ bag: __e2e.player().bag, quests: __e2e.player().quests })');
      if ((await me.state()).pos[0] !== 36) await me.step('left');
      if (!(await me.step('down'))) throw new Error('no step past the threshold');
      await page.waitFor('__e2e.player().falls > 0', 'the fall in the night ruins', 15_000);
      await page.waitFor('!!__e2e.dialog()', 'the fall box', 5000);
      const fell = await me.talkThrough();
      await me.idle('the fall');
      await page.waitFor('!__game.world.falling', 'the wake in town', 5000);
      const calls = await page.eval<string>(`document.querySelector('.toasts')?.textContent ?? ''`);
      if (calls.includes('Run for a safe place')) throw new Error(`a call to run still shows after the fall: "${calls}"`);
      if (!fell.some((l) => l.includes('Everything went dark'))) throw new Error(`no fall box: ${fell.join(' / ')}`);
      if (!fell.some((l) => l.includes('nothing is lost'))) throw new Error(`the fall box names a loss after a safe threshold: ${fell.join(' / ')}`);
      const woke = (await me.state()).pos;
      const cobble = await page.eval<boolean>(`__game.bundle.map.ground[${woke[1]}][${woke[0]}] === '='`);
      if (!cobble) throw new Error(`woke at (${woke[0]}, ${woke[1]}), not in town`);
      if ((await page.eval<string>('JSON.stringify({ bag: __e2e.player().bag, quests: __e2e.player().quests })')) !== kept) throw new Error('the fall changed the bag or the quests');
      if ((await me.bag('core/basket')) !== 1) throw new Error('the basket went with the fall');
      await me.snap('fall');
      log(`stepped past the threshold at night, fell, and woke in town at (${woke[0]}, ${woke[1]}) with the bag whole`);
    } else {
      const hour = await page.eval<number>('__e2e.hour()');
      log(`game hour ${hour}:00 before the sun bank; sunleaf opens 12:00 to 20:00`);
      if (hour < 12 || hour >= 20) throw new Error(`the sunleaf is closed at ${hour}:00: the run took too long to reach the bank`);
      await me.gather('core/sun-herbs', 'core/sunleaf', 1);
      // the walk back to town can meet 20:00 on a slow machine (pastDusk)
      await me.walkPastDusk({ x: trader[0], y: trader[1], w: 1, h: 1 }, 'Pell');
      await me.a();
      await me.talkThrough('Herbs for Pell');
      await me.talkThrough();
      await me.idle('handing in the herbs');
      if ((await me.quest('core/herbs-for-pell')) !== 'done') throw new Error('herbs-for-pell is not done');
      const p = await page.eval<{ gold: number; recipes: string[] }>('__e2e.player()');
      if (p.gold !== paid + 30_000) throw new Error(`gold is ${p.gold} mg after the herbs, not ${paid + 30_000}`);
      if (!p.recipes.includes('core/herb-stew')) throw new Error('the herb-stew recipe was not learned');
      log(`handed the sunleaf to Pell: the herb stew and ${p.gold} mg`);
      await stretches(page, log, name, "Pell's hand-in");
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

const RUNS: Run[] = [
  { name: 'phone', viewport: { width: 390, height: 844, mobile: true }, race: 'Elf', pocket: 'core/west-bank' },
  { name: 'desktop', viewport: { width: 1280, height: 800, mobile: false }, race: 'Human', pocket: 'core/north-meadow' },
  { name: 'slid-bank', viewport: { width: 1280, height: 800, mobile: false }, race: 'Skeleton', pocket: 'core/slid-bank', toBridge: true },
  // E2E_ONLY=phone-lucky: the phone run on the lucky-bowl seed, to the stew
  { name: 'phone-lucky', viewport: { width: 390, height: 844, mobile: true }, race: 'Elf', pocket: LUCKY_BOWL.pocket, lucky: true },
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
    for (const run of RUNS) {
      if (only ? only !== run.name : run.lucky) continue;
      const t0 = Date.now();
      await play(browser, url, run);
      console.log(`[${run.name}] opening finished in ${Math.round((Date.now() - t0) / 1000)} s`);
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
