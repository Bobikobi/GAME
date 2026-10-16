/**
 * Proves Maru's hearth (NEXT 13b) in a real phone-sized browser: the Feed
 * button lights the hearth before dusk and keeps it through the night while
 * the clock is moved, the running-low warning opens once, the vigil is met at
 * dawn and handed in for the bandage recipe; a second character lets the fire
 * go out (after a reload that keeps it burning) and the vigil stays unmet.
 * Everything waits on conditions, never on time.
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

const HEARTH = 'core/elder-hearth';
const QUEST = 'core/the-long-night';
const LOG = 'core/log';
const FEED_LABEL = 'Feed the elder hearth';
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

interface Fire {
  lit: number;
  until: number;
}
interface Look {
  sprite: string;
  burning: boolean;
  alpha: number;
}

const IN_PAGE = `
window.__tend = (() => {
  const g = () => window.__game;
  const HEARTH = ${JSON.stringify(HEARTH)};
  const near = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) <= 1;
  // every dialogue box that shows the running-low warning, counted once per box
  window.__tendWarnings = 0;
  let box = null, counted = false;
  new MutationObserver(() => {
    const d = document.querySelector('.dialog');
    if (d !== box) { box = d; counted = false; }
    if (d && !counted && (d.textContent || '').includes(${JSON.stringify(WARNING)})) { counted = true; window.__tendWarnings++; }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  return {
    setHour(h) {
      const s = g().session, day = g().bundle.params.day_length_ms, q = Math.floor(day / 2);
      let t = s.tick - ((s.tick + q) % day) + Math.round((h / 24) * day);
      if (t < s.tick) t += day;
      s.tick = t;
    },
    hour() {
      const s = g().session, day = g().bundle.params.day_length_ms;
      return (((s.tick + Math.floor(day / 2)) % day) * 24) / day;
    },
    /** The earlier quests are setup: Maru's coin is found, the opening is behind, and Maru is met. */
    prepare(logs) {
      const p = g().session.state.player;
      for (const id of Object.keys(p.quests)) if (p.quests[id] === 'active') p.quests[id] = 'done';
      for (const id of ['core/fix-the-bridge', 'core/first-fire', 'core/into-town', 'core/a-coin-for-maru']) p.quests[id] = 'done';
      if (!p.restored.includes('core/old-bridge')) p.restored.push('core/old-bridge');
      p.satiety = 100000;
      p.bag[${JSON.stringify(LOG)}] = logs;
      g().session.met.add('core/elder');
    },
    /** A tile beside the hearth the player can stand on, beside Maru too when one is. */
    spot() {
      const s = g().session, w = g().world, b = g().bundle;
      const p = b.map.props.find((x) => x.id === HEARTH);
      const maru = b.map.slots.find((x) => x.id === b.npcs['core/elder'].place.slot);
      const m = [maru.x + Math.floor(maru.w / 2), maru.y + Math.floor(maru.h / 2)];
      const tiles = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const t = [p.x + dx, p.y + dy];
        if ((dx || dy) && w.canWalk(s, t[0], t[1])) tiles.push(t);
      }
      tiles.sort((a, c) => Number(near(c, m)) - Number(near(a, m)) || Math.abs(a[1] - p.y) - Math.abs(c[1] - p.y));
      const t = tiles[0];
      return { at: t, maru: near(t, m), facing: t[1] === p.y ? (t[0] < p.x ? 'right' : 'left') : t[1] < p.y ? 'down' : 'up', beside: [m[0] + 1, m[1] + 1] };
    },
    /** Quests that open by themselves on the way (the night arch after Maru's coin) are setup too: the tracker shows the vigil. */
    onlyTending() {
      const p = g().session.state.player;
      for (const id of Object.keys(p.quests)) if (id !== ${JSON.stringify(QUEST)} && p.quests[id] === 'active') p.quests[id] = 'done';
    },
    moveTo(x, y, facing) {
      const s = g().session;
      s.pos = [x, y];
      s.state.player.at = [x, y];
      if (facing) s.facing = facing;
      g().world.bind(s);
    },
    fire() { return g().session.state.player.fires[HEARTH] ?? null; },
    look() { return g().world.fireLook(HEARTH) ?? null; },
    logs() { return g().session.state.player.bag[${JSON.stringify(LOG)}] ?? 0; },
    tracker() { return [...document.querySelectorAll('.tracker-step')].map((e) => e.textContent).join(' | '); },
    prompt() { const p = document.querySelector('.prompt'); return p && !p.hidden ? p.textContent : ''; },
    toasts() { return [...document.querySelectorAll('.toast')].map((e) => e.textContent).join(' | '); },
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

  /** The options Maru offers once her lines are said; the box is left open. */
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

  fire(): Promise<Fire | null> {
    return this.page.eval<Fire | null>('__tend.fire()');
  }

  look(): Promise<Look | null> {
    return this.page.eval<Look | null>('__tend.look()');
  }

  logs(): Promise<number> {
    return this.page.eval<number>('__tend.logs()');
  }

  tracker(): Promise<string> {
    return this.page.eval<string>('__tend.tracker()');
  }

  /** What the journal (the tracker) still asks for: the logs to dawn, 0 once it asks for none. */
  async logsNeeded(): Promise<number> {
    const text = await this.tracker();
    const m = /fed to reach dawn: (\d+) more logs?/.exec(text);
    return m ? Number(m[1]) : 0;
  }

  /** One press of A on the hearth through the Feed button: one log leaves the bag, or the fire is full. */
  async feed(): Promise<'fed' | 'full'> {
    await this.idle('the world before a feed');
    await this.page.waitFor(`__tend.prompt().includes(${JSON.stringify(FEED_LABEL)})`, 'the Feed button by the hearth', 5000);
    const logs = await this.logs();
    const before = await this.fire();
    await this.page.press('Enter');
    const result = await this.page.waitFor<string>(
      `(() => {
        const f = __tend.fire();
        if (__tend.logs() === ${logs - 1} && f && f.until !== ${before?.until ?? -1}) return 'fed';
        if (__tend.toasts().includes('already full')) return 'full';
        return '';
      })()`,
      'the hearth to take a log or refuse it',
      5000,
    );
    if (result === 'full' && (await this.logs()) !== logs) throw new Error('a full fire still took a log');
    if (result === 'full' && (await this.fire())?.until !== before?.until) throw new Error('a full fire still changed its burn');
    if (result === 'full' && !/A log fits at \d+:\d\d\./.test(await this.page.eval<string>('__tend.toasts()'))) {
      throw new Error('the full toast does not say when a log fits');
    }
    if (result === 'full') await this.page.waitFor(`!__tend.toasts().includes('already full')`, 'the full toast to fade', 8000);
    return result as 'fed' | 'full';
  }

  /** Feed while the journal asks for logs, as a player would; `full` when the hearth refused a log that would not burn whole. */
  async feedAsAsked(): Promise<{ fed: number; full: boolean }> {
    let fed = 0;
    while ((await this.logsNeeded()) > 0) {
      if ((await this.feed()) === 'full') return { fed, full: true };
      fed++;
    }
    return { fed, full: false };
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
    `document.querySelector('.card.starter') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the starter cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.starter', 'Forager');
  await page.tap('input.name');
  await page.type(name);
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the character to wake', 10_000);
}

/** A new character with Maru's coin found, beside the hearth, the long night accepted from Maru. */
async function begin(page: Page, me: Tender, name: string, logs: number): Promise<{ at: [number, number]; facing: string; beside: [number, number] }> {
  await page.eval(IN_PAGE);
  await start(page, name);
  await me.clearPlainDialog();
  await page.eval(`__tend.prepare(${logs})`);
  const spot = await page.eval<{ at: [number, number]; maru: boolean; facing: string; beside: [number, number] }>('__tend.spot()');
  if (!spot.maru) throw new Error(`no tile beside both the hearth and Maru: ${JSON.stringify(spot)}`);
  await page.eval(`__tend.setHour(17); __tend.moveTo(${spot.at[0]}, ${spot.at[1]}, ${JSON.stringify(spot.facing)})`);
  await page.eval(`void __game.ui.talk('core/elder')`);
  await me.choose('Task: The long night');
  await me.choose('I will do it');
  await page.waitFor(`__game.session.state.player.quests[${JSON.stringify(QUEST)}] === 'active'`, 'Maru to give the long night');
  await me.idle('Maru dialogue to close');
  await page.eval('__tend.onlyTending()');
  return spot;
}

async function run(page: Page, url: string): Promise<void> {
  const me = new Tender(page);
  await page.goto(`${url}?debug&rich=none`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);

  // ---- pass 1: the hearth kept from before dusk to dawn
  await begin(page, me, 'Tess', 10);
  await page.waitFor(`__tend.tracker().includes('Keep the elder hearth burning until dawn - light it before dusk')`, 'the journal to ask to light the hearth', 5000);
  if ((await me.look())?.burning !== false) throw new Error('the cold hearth is drawn burning');
  // the Feed button shows only with wood in the bag: it goes with the logs and comes back with them
  await page.waitFor(`__tend.prompt().includes(${JSON.stringify(FEED_LABEL)})`, 'the Feed button beside the hearth', 5000);
  await page.eval(`__game.session.state.player.bag[${JSON.stringify(LOG)}] = 0`);
  await page.waitFor(`!__tend.prompt().includes("Feed")`, 'the Feed button to go with the wood', 5000);
  await page.eval(`__game.session.state.player.bag[${JSON.stringify(LOG)}] = 10`);

  await page.eval('__tend.setHour(19)');
  await me.snap('before-dusk-cold');
  if ((await me.feed()) !== 'fed') throw new Error('the cold hearth refused its first log');
  await page.waitFor(`/The elder hearth burns until \\d+:\\d\\d\\./.test(__tend.toasts())`, 'the fire event line', 5000);
  await page.waitFor('__tend.look() && __tend.look().burning', 'the flame to show while it burns', 5000);
  const lit = (await me.fire())!.lit;
  await page.waitFor(`__tend.tracker().includes('fed to reach dawn: 4 more logs')`, 'the journal to count four logs to dawn', 5000);
  // the cap holds three logs ahead of the clock: two more fit, each takes one log from the bag,
  // and the next press, still asked for by the journal, is refused with the log kept
  const first = await me.feedAsAsked();
  if (first.fed !== 2) throw new Error(`fed ${first.fed} more logs before the cap, not 2`);
  if (!first.full) throw new Error('the hearth at its cap was never refused a log');
  if ((await me.logs()) !== 7) throw new Error(`the bag holds ${await me.logs()} logs after three feeds, not 7`);
  await page.waitFor(
    `/fed to reach dawn: 2 more logs, the next at 21:\\d\\d/.test(__tend.tracker())`,
    'the journal to ask for two more logs and say when the next fits',
    5000,
  );
  await me.snap('lit-before-dusk');

  // the first log of the night burns down: at 00:40 the embers run low and the warning opens once
  await page.eval('__tend.setHour(2 / 3)');
  await page.waitFor('window.__tendWarnings === 1', 'the running-low warning', 10_000);
  await page.waitFor('__tend.look() && __tend.look().burning && __tend.look().alpha < 1', 'the embers to dim', 5000);
  await me.snap('running-low');
  await me.clearPlainDialog();
  const night = await me.feedAsAsked();
  if (night.fed !== 2 || night.full) throw new Error(`fed ${night.fed} logs to reach dawn after midnight (full: ${night.full}), not 2`);
  if ((await me.fire())!.lit !== lit) throw new Error('a top-up started a new burn');
  await page.waitFor(`__tend.tracker().includes('Bring it to Elder Maru')`, 'the vigil to hold with wood to dawn', 5000);
  await page.waitFor('__tend.look().alpha === 1', 'the flame to come back up', 5000);

  // running low again before dawn is the same burn: no second box
  await page.eval('__tend.setHour(4.75)');
  await page.waitFor('__tend.look() && __tend.look().alpha < 1', 'the embers to dim before dawn', 5000);
  const tickNow = await page.eval<number>('__game.session.tick');
  await page.waitFor(`__game.session.tick >= ${tickNow + 1500}`, 'two HUD beats to pass', 10_000);
  if ((await page.eval<number>('window.__tendWarnings')) !== 1) throw new Error('the warning opened twice in one burn');
  await page.eval('__tend.setHour(5.5)');
  await page.waitFor('__tend.look() && !__tend.look().burning', 'the burnt-out hearth after dawn', 5000);
  await page.waitFor(`__tend.tracker().includes('Bring it to Elder Maru')`, 'the vigil met at dawn', 5000);
  await me.snap('dawn-met');

  await page.eval(`void __game.ui.talk('core/elder')`);
  await me.choose('Hand in: The long night');
  await page.waitFor(`__game.session.state.player.quests[${JSON.stringify(QUEST)}] === 'done'`, 'Maru to take the long night');
  await page.waitFor(`__game.session.state.player.recipes.includes('core/bandage')`, 'the bandage recipe');
  await me.clearPlainDialog();
  await me.handleLevelUp();
  await me.clearPlainDialog();
  if ((await page.eval<number>('window.__tendWarnings')) !== 1) throw new Error('the warning count changed after the vigil');
  await me.snap('handed-in');

  // ---- pass 2: a new character lights the hearth, reloads, and lets it go out
  await page.goto(`${url}?debug&rich=none`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen again', 30_000);
  const spot = await begin(page, me, 'Wren', 3);
  if (await page.eval<boolean>(`__game.session.state.player.recipes.includes('core/bandage')`)) {
    throw new Error('a new character knows the bandage before the long night');
  }
  await page.eval('__tend.setHour(19)');
  if ((await me.feed()) !== 'fed') throw new Error('the second hearth refused its log');
  const kept = await me.fire();

  // the burn lives in the save: a reload finds the hearth still burning
  await page.goto(`${url}?debug&rich=none`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen after the reload', 30_000);
  await page.eval(IN_PAGE);
  await page.tap('.title-screen button', 'Continue');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the saved character to wake', 10_000);
  await me.clearPlainDialog();
  const back = await me.fire();
  if (!back || back.lit !== kept?.lit || back.until !== kept?.until) throw new Error(`the fire did not survive the reload: ${JSON.stringify({ kept, back })}`);
  await page.waitFor('__tend.look() && __tend.look().burning', 'the reloaded hearth to burn', 5000);
  await page.eval(`__tend.moveTo(${spot.at[0]}, ${spot.at[1]}, ${JSON.stringify(spot.facing)})`);

  await page.eval('__tend.setHour(22)');
  await page.waitFor('__tend.look() && !__tend.look().burning', 'the unfed hearth to go out', 5000);
  await page.waitFor(`__tend.tracker().includes('light it before dusk')`, 'the journal to ask for a new fire', 5000);
  await page.eval('__tend.setHour(5.5)');
  const dawnHour = await page.eval<number>('__tend.hour()');
  if (dawnHour < 5.5 || dawnHour > 6) throw new Error(`the clock is not at dawn: ${dawnHour}`);
  await page.waitFor(`__tend.tracker().includes('Keep the elder hearth burning until dawn')`, 'the journal at dawn', 5000);
  if ((await me.tracker()).includes('Bring it to')) throw new Error('a vigil that went out is met');
  const options = await me.optionsOf('core/elder');
  if (options.some((o) => o.includes('Hand in: The long night')) || !options.some((o) => o.includes('About: The long night'))) {
    throw new Error(`Maru takes a vigil that went out: ${options.join(' | ')}`);
  }
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
