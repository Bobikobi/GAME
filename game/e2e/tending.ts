/**
 * Proves a fire anywhere outside the town (NEXT 21b) in a real phone-sized browser: the long night is taken from
 * Maru, and the hearth by his door burns a whole first night without meeting it. Out past the last house a fire of
 * one's own is built from two logs, seen through its four flame stages while the clock is moved, fed through the
 * night, warned of once, and met at dawn; a build inside the bank wolf's round and during a chase is refused and
 * keeps the logs, and a chase that reaches the fire's ring ends there. A second character lets the fire go out after
 * a reload and the step stays unmet. Each flame stage is captured. Everything waits on conditions, never on time.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page } from './cdp';
import { TAKE_GROUND, seedQuery } from './wakes';

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

const QUEST = 'core/the-long-night';
const HEARTH = 'core/elder-hearth';
const LOG = 'core/log';
const BUILD = [27, 16];
const STAND = [28, 16];
const WOLF_STAND = [2, 19];
const OUTSIDE = [30, 16];
const WARNING = 'is burning low';

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

interface Own {
  at: [number, number];
  lit: number;
  until: number;
  log: number;
}
interface Look {
  sprite: string;
  burning: boolean;
  alpha: number;
  scale: number;
  stage: string;
}

const IN_PAGE = `
window.__tend = (() => {
  const g = () => window.__game;
  const OWN = 'own';
  const HEARTH = ${JSON.stringify(HEARTH)};
  const LOG = ${JSON.stringify(LOG)};
  const near = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) <= 1;
  // every dialogue box that shows the running-low warning, counted once per box
  window.__tendWarnings = 0;
  let box = null, counted = false;
  new MutationObserver(() => {
    const d = document.querySelector('.dialog');
    if (d !== box) { box = d; counted = false; }
    if (d && !counted && (d.textContent || '').includes(${JSON.stringify(WARNING)})) { counted = true; window.__tendWarnings++; }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  const act = (a) => {
    const s = g().session;
    const r = s.act(a);
    if (!r.ok) throw new Error(r.error);
    s.pos = [s.state.player.at[0], s.state.player.at[1]];
    g().world.bind(s);
    return r.events;
  };
  const wood = () => {
    const s = g().session, b = g().bundle;
    return Object.keys(s.state.player.bag).find((id) => (s.state.player.bag[id] ?? 0) > 0 && b.items[id]?.class === 'wood');
  };
  return {
    setHour(h) {
      const s = g().session, day = g().bundle.params.day_length_ms, q = Math.floor(day / 2);
      let t = s.tick - ((s.tick + q) % day) + Math.round((h / 24) * day);
      if (t < s.tick) t += day;
      this.setTick(t);
    },
    setTick(t) {
      const s = g().session;
      s.tick = t;
    },
    hour() {
      const s = g().session, day = g().bundle.params.day_length_ms;
      return (((s.tick + Math.floor(day / 2)) % day) * 24) / day;
    },
    /** The earlier quests are setup: Maru's berries are picked, his coin found and his stew cooked (the long night waits for it), the opening is behind, and Maru is met. */
    prepare(logs) {
      const p = g().session.state.player;
      for (const id of Object.keys(p.quests)) if (p.quests[id] === 'active') p.quests[id] = 'done';
      for (const id of ['core/fix-the-bridge', 'core/first-fire', 'core/into-town', 'core/three-fruits', 'core/a-coin-for-maru', 'core/herbs-for-pell', 'core/a-whole-one', 'core/something-warm']) p.quests[id] = 'done';
      if (!p.restored.includes('core/old-bridge')) p.restored.push('core/old-bridge');
      p.hp = 100000;
      p.bag[LOG] = logs;
      g().session.met.add('core/elder');
    },
    /** A walkable tile beside Maru, where the long night is taken and handed in. */
    maruSpot() {
      const s = g().session, w = g().world, b = g().bundle;
      const slot = b.map.slots.find((x) => x.id === b.npcs['core/elder'].place.slot);
      const m = [slot.x + Math.floor(slot.w / 2), slot.y + Math.floor(slot.h / 2)];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const t = [m[0] + dx, m[1] + dy];
        if ((dx || dy) && w.canWalk(s, t[0], t[1])) return t;
      }
      throw new Error('no tile beside Maru');
    },
    /** A walkable tile beside the hearth by Maru's door. */
    hearthSpot() {
      const s = g().session, w = g().world, b = g().bundle;
      const p = b.map.props.find((x) => x.id === HEARTH);
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        if (w.canWalk(s, p.x + dx, p.y + dy)) return [p.x + dx, p.y + dy];
      }
      throw new Error('no tile beside the hearth');
    },
    place(x, y, facing) {
      const s = g().session;
      s.pos = [x, y];
      s.state.player.at = [x, y];
      if (facing) s.facing = facing;
      g().world.bind(s);
    },
    /** Walk tile by tile through the kernel's own move action, the way a player leaves the town. */
    walkTo(x, y, facing) {
      const s = g().session, w = g().world, b = g().bundle;
      const key = (a, c) => a + ',' + c;
      const queue = [[s.pos[0], s.pos[1]]];
      const prev = new Map([[key(s.pos[0], s.pos[1]), null]]);
      let found = false;
      for (let i = 0; i < queue.length && !found; i++) {
        const [cx, cy] = queue[i];
        for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
          const nx = cx + dx, ny = cy + dy;
          if (prev.has(key(nx, ny)) || !w.canWalk(s, nx, ny)) continue;
          prev.set(key(nx, ny), [cx, cy]);
          if (nx === x && ny === y) { found = true; break; }
          queue.push([nx, ny]);
        }
      }
      if (!found) throw new Error('no walk from ' + s.pos.join(',') + ' to ' + x + ',' + y);
      const path = [];
      for (let at = [x, y]; at; at = prev.get(key(at[0], at[1]))) path.push(at);
      path.reverse();
      for (const t of path.slice(1)) {
        s.tick += 1;
        const r = s.act({ t: 'move', at: t });
        if (!r.ok) throw new Error('the walk was refused: ' + r.error);
        s.pos = [t[0], t[1]];
      }
      if (facing) s.facing = facing;
      g().world.bind(s);
      s.save();
    },
    own() { return g().session.state.player.own; },
    look() { return g().world.fireLook(OWN) ?? null; },
    stage() { const l = this.look(); return l ? l.stage : 'none'; },
    sees() { return g().world.sees({ x: ${BUILD[0]}, y: ${BUILD[1]}, w: 1, h: 1 }); },
    /** How far a tile is from the town's own ground, in tiles: the fire must stand six or more out (NEXT 21b). */
    townDistance(x, y) {
      const town = g().bundle.map.slots.filter((s) => s.kind === 'area' && s.tag === 'town');
      return Math.min(...town.map((s) => Math.max(s.x - x, 0, x - (s.x + s.w - 1), s.y - y, 0, y - (s.y + s.h - 1))));
    },
    logs() { return g().session.state.player.bag[LOG] ?? 0; },
    tracker() { return [...document.querySelectorAll('.tracker-step')].map((e) => e.textContent).join(' | '); },
    prompt() { const p = document.querySelector('.prompt'); return p && !p.hidden ? p.textContent : ''; },
    toasts() { return [...document.querySelectorAll('.toast')].map((e) => e.textContent).join(' | '); },
    /** Every word on the page that speaks of the fire, for the no-digit check at a stage. */
    fireText() {
      const d = document.querySelector('.dialog');
      return [this.tracker(), this.prompt(), this.toasts(), d ? d.textContent : ''].join(' | ');
    },
    warnings() { return window.__tendWarnings; },
    resetWarnings() { window.__tendWarnings = 0; },
    chase(on) {
      const s = g().session;
      s.state.player.chase = on ? { hazard: 'core/bank-wolf', since: s.tick, bites: 0 } : null;
    },
    chasing() { return g().session.state.player.chase !== null; },
    /** Feed a fire by hand from the bag, as the Feed button sends it. Returns the kernel's words. */
    feed(fire) {
      const s = g().session;
      const item = wood();
      if (!item) return 'no wood';
      const r = s.act({ t: 'feed', fire, item, at: s.pos });
      g().world.bind(s);
      return r.ok ? 'fed' : r.error;
    },
    /** Maru's own hearth keeps the first night: this changes nothing about the long night (NEXT 21b). */
    keepHearthToDawn(dawn) {
      const s = g().session;
      s.pos = this.hearthSpot();
      s.state.player.at = s.pos;
      this.setHour(19);
      for (let i = 0; i < 12 && ((s.state.player.fires[HEARTH] || {}).until || 0) < dawn; i++) {
        if (this.feed(HEARTH) !== 'fed') this.setHour(this.hour() + 1);
      }
      g().world.bind(s);
      return ((s.state.player.fires[HEARTH] || {}).until || 0) >= dawn;
    },
  };
})();
true`;

class Tender {
  private shot = 0;

  constructor(readonly page: Page) {}

  async snap(label: string): Promise<void> {
    this.shot++;
    await this.page.screenshot(join(OUT, `tending-${String(this.shot).padStart(2, '0')}-${label}.png`));
  }

  async clearPlainDialog(): Promise<void> {
    for (let i = 0; i < 30; i++) {
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
      if (options.length > 0) throw new Error(`dialogue offered ${options.join(' | ')}, not "${label}"`);
      if (await this.page.eval<boolean>('!!document.querySelector(".dialog")')) await this.page.press('Enter');
      await sleep(100);
    }
    throw new Error(`dialogue never offered "${label}"`);
  }

  /** The options Maru offers once his lines are said; the box is left open. */
  async optionsOf(npc: string): Promise<string[]> {
    await this.page.eval(`void __game.ui.talk(${JSON.stringify(npc)})`);
    for (let i = 0; i < 40; i++) {
      const options = await this.page.eval<string[]>(`(() => {
        const d = document.querySelector('.dialog');
        return d ? [...d.querySelectorAll('.dialog-options button')].map((b) => b.textContent ?? '') : [];
      })()`);
      if (options.length > 0) return options;
      if (await this.page.eval<boolean>('!!document.querySelector(".dialog")')) await this.page.press('Enter');
      await sleep(100);
    }
    throw new Error(`${npc} offered no options`);
  }

  async idle(what: string): Promise<void> {
    await this.page.waitFor('!__game.ui.blocking && !document.querySelector(".dialog")', what, 10_000);
  }

  own(): Promise<Own | null> {
    return this.page.eval<Own | null>('__tend.own()');
  }

  look(): Promise<Look | null> {
    return this.page.eval<Look | null>('__tend.look()');
  }

  stage(): Promise<string> {
    return this.page.eval<string>('__tend.stage()');
  }

  logs(): Promise<number> {
    return this.page.eval<number>('__tend.logs()');
  }

  tracker(): Promise<string> {
    return this.page.eval<string>('__tend.tracker()');
  }

  prompt(): Promise<string> {
    return this.page.eval<string>('__tend.prompt()');
  }

  toasts(): Promise<string> {
    return this.page.eval<string>('__tend.toasts()');
  }

  warnings(): Promise<number> {
    return this.page.eval<number>('__tend.warnings()');
  }

  hour(): Promise<number> {
    return this.page.eval<number>('__tend.hour()');
  }

  async setHour(h: number): Promise<void> {
    await this.page.eval(`__tend.setHour(${h})`);
  }

  async place(at: readonly number[], facing?: string): Promise<void> {
    await this.page.eval(`__tend.place(${at[0]}, ${at[1]}, ${facing ? JSON.stringify(facing) : 'null'})`);
  }

  async walkTo(at: readonly number[], facing?: string): Promise<void> {
    await this.page.eval(`__tend.walkTo(${at[0]}, ${at[1]}, ${facing ? JSON.stringify(facing) : 'null'})`);
  }

  /** Press Build a fire where it sits, and read what the kernel says: a fire built, or its words as a toast. */
  async build(): Promise<{ built: boolean; words: string }> {
    await this.idle('the world before a build');
    await this.page.waitFor(`__tend.prompt().includes('Build a fire')`, 'the Build a fire button', 5000);
    const logs = await this.logs();
    const seen = await this.toasts();
    await this.page.press('Enter');
    const outcome = await this.page.waitFor<string>(
      `(() => {
        if (__tend.logs() === ${logs - 2} && __tend.own()) return 'built';
        if (__tend.logs() === ${logs} && __tend.toasts() !== ${JSON.stringify(seen)} && __tend.toasts().length > 0) return 'refused';
        return '';
      })()`,
      'the fire to be built or refused',
      5000,
    );
    if (outcome === 'built') {
      await this.page.waitFor(`__tend.look() && __tend.look().burning`, 'the new flame to show', 5000);
      return { built: true, words: await this.toasts() };
    }
    const words = await this.toasts();
    if ((await this.logs()) !== logs) throw new Error('a refused build still took a log');
    await this.page.waitFor(`!__tend.toasts().includes(${JSON.stringify(words.split(' | ')[0] ?? '')})`, 'the refusal to fade', 8000);
    return { built: false, words };
  }

  /** One press of Feed on the fire of one's own: one log leaves the bag, or the fire is full. */
  async feed(): Promise<'fed' | 'full'> {
    await this.idle('the world before a feed');
    await this.page.waitFor(`__tend.prompt().includes('Feed the fire')`, 'the Feed button by the fire', 5000);
    const logs = await this.logs();
    const before = await this.own();
    await this.page.press('Enter');
    const result = await this.page.waitFor<string>(
      `(() => {
        const f = __tend.own();
        if (__tend.logs() === ${logs - 1} && f && f.until !== ${before?.until ?? -1}) return 'fed';
        if (__tend.toasts().includes('already full')) return 'full';
        return '';
      })()`,
      'the fire to take a log or refuse it',
      5000,
    );
    if (result === 'full' && (await this.logs()) !== logs) throw new Error('a full fire still took a log');
    if (result === 'full') await this.page.waitFor(`!__tend.toasts().includes('already full')`, 'the full toast to fade', 8000);
    return result as 'fed' | 'full';
  }

  /** Feed while a log still fits, up to the cap of three. */
  async feedFitting(): Promise<number> {
    let fed = 0;
    for (let i = 0; i < 4; i++) {
      if ((await this.feed()) !== 'fed') break;
      fed++;
    }
    return fed;
  }

  /** Feed while the journal asks for wood; a full fire says so and the clock is moved on an hour. */
  async holdToDawn(): Promise<number> {
    let fed = 0;
    for (let i = 0; i < 20 && (await this.tracker()).includes('it still needs wood'); i++) {
      if ((await this.feed()) === 'fed') fed++;
      else await this.setHour((await this.hour()) + 1);
    }
    await this.page.waitFor(`__tend.tracker().includes('it has the wood: wait for dawn')`, 'the journal to wait for dawn', 5000);
    return fed;
  }

  async handleLevelUp(): Promise<void> {
    for (let i = 0; i < 12 && (await this.page.eval<boolean>('!!document.querySelector(".levelup-layer")')); i++) {
      await this.page.press('Enter');
      await sleep(150);
    }
  }
}

async function start(page: Page, name: string): Promise<void> {
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Elf');
  await page.tap('input.name');
  await page.type(name);
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the character to wake', 10_000);
  // the west bank's basket and axe lie on the ground by the wake: this script tests what comes later, so they are handed over
  await page.eval(TAKE_GROUND);
}

/** A new character with the opening behind, beside Maru, the long night accepted from him. */
async function begin(page: Page, me: Tender, name: string, logs: number): Promise<void> {
  await page.eval(IN_PAGE);
  await start(page, name);
  await me.clearPlainDialog();
  await page.eval(`__tend.prepare(${logs}); __tend.setHour(17)`);
  await page.eval(`(() => { const t = __tend.maruSpot(); __tend.place(t[0], t[1]); })()`);
  await page.eval(`void __game.ui.talk('core/elder')`);
  await me.choose('The long night');
  await me.choose('I will do it');
  await page.waitFor(`__game.session.state.player.quests[${JSON.stringify(QUEST)}] === 'active'`, 'Maru to give the long night');
  await me.idle('Maru dialogue to close');
  const p = await page.eval<{ quests: Record<string, string> }>(`({ quests: __game.session.state.player.quests })`);
  for (const [id, state] of Object.entries(p.quests)) {
    if (id !== QUEST && state === 'active') await page.eval(`__game.session.state.player.quests[${JSON.stringify(id)}] = 'done'`);
  }
}

async function run(page: Page, url: string): Promise<void> {
  const me = new Tender(page);
  await page.goto(`${url}?debug&rich=none${seedQuery('core/west-bank')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);

  // ---- pass 1: a fire of one's own out in the wild meets the long night; Maru's hearth does not
  await begin(page, me, 'Tess', 16);
  await page.waitFor(`__tend.tracker().includes('Keep the fire burning until dawn - light it before dusk')`, 'the journal to ask for a fire of one\'s own', 5000);
  if ((await me.prompt()).includes('Build a fire')) throw new Error('Build a fire shows inside the town');

  // the hearth by Maru's door keeps the whole first night: the task is not met by it
  const dawn = await page.eval<boolean>('__tend.keepHearthToDawn(850000)');
  if (!dawn) throw new Error('the hearth did not burn the first night');
  await me.setHour(5.5);
  await page.waitFor(`!__tend.tracker().includes('Bring it to')`, 'the long night to stay unmet after the hearth', 5000);
  await me.snap('hearth-night-unmet');

  // a build inside the bank wolf's round is refused and keeps the logs
  await me.place(WOLF_STAND, 'right');
  await me.setHour(17);
  const watchLogs = await me.logs();
  const watch = await me.build();
  if (watch.built) throw new Error('a fire was built inside the wolf\'s round');
  if (!watch.words.includes('A wolf watches this ground. Not here.')) throw new Error(`the watch refusal is "${watch.words}"`);
  if ((await me.logs()) !== watchLogs) throw new Error('a build inside a round\'s watch took a log');
  await me.snap('wolf-watch-refused');

  // walk out past the last house, six tiles from the town, and build
  await page.eval(`(() => { const t = __tend.maruSpot(); __tend.place(t[0], t[1]); })()`);
  await me.setHour(19);
  await me.walkTo(STAND, 'left');
  const town = await page.eval<number>(`__tend.townDistance(${BUILD[0]}, ${BUILD[1]})`);
  if (town < 6) throw new Error(`the fire stands ${town} tiles from the town, not six or more`);
  const built = await me.build();
  if (!built.built) throw new Error(`the wild ground refused a fire: ${built.words}`);
  if ((await me.logs()) !== watchLogs - 2) throw new Error(`kindling took ${watchLogs - (await me.logs())} logs, not 2`);
  if (!(await me.page.eval<boolean>('__tend.sees()'))) throw new Error('the fire six tiles out of the town is not on the 390x844 screen');
  if ((await me.stage()) !== 'full') throw new Error(`the new fire is ${await me.stage()}, not full`);
  // the hearth's feed toasts fade before a stage is read: no old clock is caught in the capture
  await page.waitFor(`__tend.toasts().length === 0`, 'the older toasts to fade', 12_000);
  await me.snap('flame-full');

  // the flame dims through its stages, and no word about the fire carries a digit
  for (const [left, stage] of [[0.6, 'steady'], [0.45, 'low'], [0.25, 'embers']] as const) {
    const own = (await me.own())!;
    await page.eval(`__tend.setTick(${own.until - Math.round(own.log * left)})`);
    await page.waitFor(`__tend.stage() === ${JSON.stringify(stage)}`, `the ${stage} flame`, 5000);
    // the embers open the night's one warning (G31): it is read, then closed, so the stage itself is captured
    if (stage === 'embers') {
      await page.waitFor(`__tend.warnings() === 1`, 'the running-low warning once', 10_000);
      await me.clearPlainDialog();
    }
    const text = await page.eval<string>('__tend.fireText()');
    if (/\d/.test(text)) throw new Error(`a digit speaks of the fire at ${stage}: ${text}`);
    await me.snap(`flame-${stage}`);
  }
  if ((await me.warnings()) !== 1) throw new Error('the running-low warning did not open once at the embers');

  // the fire is topped up at once and burns into the night
  if ((await me.feedFitting()) !== 2) throw new Error('the embers did not take the two logs that fit');
  await me.setHour(21);
  await page.waitFor(`__tend.look() && __tend.look().burning`, 'the topped-up fire at 21:00', 5000);

  // a build during a chase is refused and keeps the logs; a chase that reaches the ring ends there.
  // Stepping out of the fire's light after dark opens the night's one warning (G31): the player closes it.
  await me.place(OUTSIDE);
  await sleep(600);
  await me.clearPlainDialog();
  await page.eval('__tend.chase(true)');
  const chaseLogs = await me.logs();
  const chased = await me.build();
  if (chased.built) throw new Error('a fire was built during a chase');
  if (!chased.words.includes('Not with the wolf at your heels.')) throw new Error(`the chase refusal is "${chased.words}"`);
  if ((await me.logs()) !== chaseLogs) throw new Error('a build during a chase took a log');
  await me.snap('chase-refused');
  await me.walkTo(STAND);
  if (await page.eval<boolean>('__tend.chasing()')) throw new Error('the chase did not end at the fire\'s ring');

  // fed through the night, the warning not repeated in the same burn
  const fed = await me.holdToDawn();
  if (fed === 0) throw new Error('the fire reached dawn without another log');
  if ((await me.warnings()) !== 1) throw new Error('the warning opened twice in one burn');
  await me.setHour(5.5);
  await page.waitFor(`__tend.tracker().includes('Bring it to Elder Maru')`, 'the long night met at dawn by the fire of one\'s own', 5000);
  await me.snap('dawn-met');

  await me.walkTo(await page.eval<[number, number]>('__tend.maruSpot()'));
  await page.eval(`void __game.ui.talk('core/elder')`);
  await me.choose('The long night');
  await page.waitFor(`__game.session.state.player.quests[${JSON.stringify(QUEST)}] === 'done'`, 'Maru to take the long night');
  await page.waitFor(`__game.session.state.player.recipes.includes('core/bandage')`, 'the bandage recipe');
  await me.clearPlainDialog();
  await me.handleLevelUp();
  await me.clearPlainDialog();
  if ((await me.warnings()) !== 1) throw new Error('the warning count changed after the vigil');
  await me.snap('handed-in');

  // ---- pass 2: a new character builds a fire, reloads, and lets it go out
  await page.goto(`${url}?debug&rich=none${seedQuery('core/west-bank')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen again', 30_000);
  await begin(page, me, 'Wren', 6);
  if (await page.eval<boolean>(`__game.session.state.player.recipes.includes('core/bandage')`)) {
    throw new Error('a new character knows the bandage before the long night');
  }
  await page.eval(`(() => { const t = __tend.maruSpot(); __tend.place(t[0], t[1]); })()`);
  await me.setHour(19);
  await me.walkTo(STAND, 'left');
  if (!(await me.build()).built) throw new Error('the second fire was refused in the wild');
  const kept = await me.own();

  // the burn lives in the save: a reload finds the fire of one's own still burning
  await page.goto(`${url}?debug&rich=none${seedQuery('core/west-bank')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen after the reload', 30_000);
  await page.eval(IN_PAGE);
  await page.tap('.title-screen button', 'Continue');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the saved character to wake', 10_000);
  await me.clearPlainDialog();
  const back = await me.own();
  if (!back || !kept || back.lit !== kept.lit || back.until !== kept.until || back.at.join() !== kept.at.join() || back.log !== kept.log) {
    throw new Error(`the fire did not survive the reload: ${JSON.stringify({ kept, back })}`);
  }
  await page.waitFor('__tend.look() && __tend.look().burning', 'the reloaded fire to burn', 5000);

  await me.setHour(22);
  // dark with the fire out opens the night's one warning (G31): the player closes it
  await sleep(600);
  await me.clearPlainDialog();
  await page.waitFor(`__tend.stage() === 'out'`, 'the unfed fire to go out', 5000);
  await page.waitFor(`__tend.tracker().includes('it went out, tonight is lost')`, 'the journal to tell the night lost', 5000);
  await me.setHour(5.5);
  await page.waitFor(`__tend.tracker().includes('it went out in the night')`, 'the day after to remember the lost night', 5000);
  if ((await me.tracker()).includes('Bring it to')) throw new Error('a vigil that went out is met');
  await page.eval(`(() => { const t = __tend.maruSpot(); __tend.place(t[0], t[1]); })()`);
  await sleep(600);
  await me.clearPlainDialog();
  const options = await me.optionsOf('core/elder');
  // the option is the title in every state; that the vigil gone out is not met is the tracker's check above
  if (!options.some((o) => o.includes('The long night'))) throw new Error(`Maru takes a vigil that went out: ${options.join(' | ')}`);
  await me.snap('went-out');
  await page.tap('.dialog-options button', 'Goodbye');
  await me.idle('Maru to say goodbye');
  if (await page.eval<string>(`__game.session.state.player.quests[${JSON.stringify(QUEST)}]`) !== 'active') throw new Error('the unmet vigil left the journal');
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
    await page.screenshot(join(OUT, 'tending-failed.png')).catch(() => undefined);
    throw error;
  } finally {
    page.close();
    await browser.close();
    local?.server.close();
  }
  console.log(`tending screenshots in ${OUT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
