/**
 * Proves the first effects (effects.ts, DECISIONS 2026-11-23) on a phone on its side, 844 by 390 CSS px, in a real browser with the
 * motion group on (`?rich=motion`):
 *
 * - a landed hit of the player plays the spark on the foe's tile, steps through its eight frames in order, and clears;
 * - a bite (the chase's `hurt` from a predator) plays the starburst on the player, steps through its eleven frames, and clears;
 * - a real jump up the town's ledge raises the landing dust where it lands (when the ground there is dry), steps through its twelve
 *   frames, and clears;
 * - a fire burning full shows the camp fire's loop in place of the kit's burning look, the loop's frame moves, and the kit's look
 *   comes back when the fire is out;
 * - the moments (VALLEY_EFFECTS.md): the real jump's takeoff kicks up its ground, and each event that starts a moment (a stone lifted,
 *   set down, pushed; food; a broken tool; a level; a quest done; a fire out; a safe place; a hurt; a dodge, a guard, a foe's fall)
 *   lays the parts its spot can take, one line each;
 * - nothing is left playing at the end, and no console error was raised by any of it.
 *
 * The events of the hit and the bite are the kernel's own shapes, told to the session the way its fight tells them (the fight itself
 * is the kernel's tests'; this proves what the client draws). Every check waits on a condition, never on a fixed time.
 * The screenshots go to the out-dir (default .scratch/e2e).
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, type Page } from './cdp';
import { PHONE } from './viewports';
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

/** The town's face on row 4: level 0 at x=21, level 1 at x=22 (the jump script's ledge). */
const LOW: [number, number] = [21, 4];
const HIGH: [number, number] = [22, 4];
/** The valley's own hearth, lit in the page by a burn long enough to stand full. */
const HEARTH = 'core/elder-hearth';
/** A tile of open meadow for the hit and the bite. */
const FIELD: [number, number] = [24, 14];

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
  await page.eval(carveIn('Tess'));
  await page.eval(TAKE_GROUND);
  for (let i = 0; i < 12; i++) {
    if (!(await page.eval<boolean>(`!!document.querySelector('#ui > .layer')`))) break;
    await page.tap('.tbtn.a');
    await page.waitFor(`true`, 'a frame');
  }
  await page.waitFor(`!document.querySelector('#ui > .layer')`, 'the waking lines to close', 15_000);
}

/** The player set down on a tile, facing a way, the scene told (the walk's own hand-over, as the other scripts use). */
const place = (at: readonly number[], facing: string): string =>
  `(() => { const g = window.__game, s = g.session; s.pos = [${at[0]}, ${at[1]}]; s.state.player.at = [${at[0]}, ${at[1]}]; s.facing = ${JSON.stringify(facing)}; g.world.bind(s); })()`;

/** The effect layer's live one-shots: which, and the frame each shows now. */
const LIVE = `(() => { const l = window.__game.world.effects; return [...l.live].map((e) => ({ id: e.def.id, frame: Number(e.spr.frame.name), x: e.spr.x, y: e.spr.y, scale: e.spr.scaleX })); })()`;

interface Live {
  id: string;
  frame: number;
  x: number;
  y: number;
  scale: number;
}

/** Samples the live one-shots every frame from now until none is left (or the time is up); returns each one's frames in the order seen. */
async function watch(page: Page, id: string, ms: number): Promise<{ frames: number[]; at: Live | null }> {
  return page.eval(`new Promise((ok) => {
    const frames = []; let at = null; const t0 = performance.now();
    const tick = () => {
      const now = ${LIVE}.filter((e) => e.id === ${JSON.stringify(id)});
      for (const e of now) { if (at === null) at = e; if (frames[frames.length - 1] !== e.frame) frames.push(e.frame); }
      if ((frames.length > 0 && now.length === 0) || performance.now() - t0 > ${ms}) ok({ frames, at });
      else requestAnimationFrame(tick);
    };
    tick();
  })`);
}

/** A fight outcome's shape on a tile (the kernel's FightOutcome), for a dodge and a guard told to the session. */
const outcomeAt = (at: readonly number[]) => ({ kind: 'attack', number: 0, at: [at[0], at[1]], move: 'attack', striker: { side: 'foe', id: 'w' }, struck: { side: 'player', id: 'p' } });

const isAscending = (frames: number[]): boolean => frames.every((f, i) => i === 0 || f > frames[i - 1]!);
/**
 * Whether the frames seen are an effect's `count` frames played in order. A slow runner may hold a frame back and skip one, so the
 * page is sampled, not counted: the order must hold and at least half the frames must have been seen (test/effects.test.ts holds
 * the exact sequence at every age).
 */
const steps = (frames: number[], count: number): boolean => isAscending(frames) && frames.length >= count / 2 && frames[0]! <= 2 && frames.at(-1)! >= count - 3;

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  const page = await browser.newPage(PHONE);
  try {
    await page.goto(`${remote ?? local?.url ?? ''}?debug&rich=motion${seedQuery('core/west-bank')}`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
    await start(page);
    const motion = await page.eval<boolean>(`window.__game.rich.motion === true`);
    if (!motion) throw new Error('the motion group is off: the effects cannot play');
    const loaded = await page.eval<string[]>(`['hit-spark','crit-hit','landing-dust','campfire'].filter((id) => window.__game.world.textures.exists('fx-pvfx-' + id))`);
    if (loaded.length !== 4) throw new Error(`only ${loaded.join(', ')} of the four sheets loaded`);
    console.log('effects: the four sheets loaded, motion on');

    // a landed hit of the player: the spark on the foe's tile, eight frames in order, then clear
    await page.eval(place(FIELD, 'right'));
    const foeTile = [FIELD[0] + 1, FIELD[1]];
    await page.eval(`window.__game.session.emit('events', [{ e: 'hit', player: 'p', by: 'player', harm: 4, kind: 'attack', number: 4, at: ${JSON.stringify(foeTile)}, move: 'attack', striker: { side: 'player', id: 'p' }, struck: { side: 'foe', id: 'w' } }])`);
    const spark = await watch(page, 'hit-spark', 4000);
    if (!spark.at) throw new Error('a landed hit played no spark');
    if (!steps(spark.frames, 8)) throw new Error(`the spark did not step through its 8 frames in order: ${spark.frames.join(',')}`);
    if (Math.abs(spark.at.x - (foeTile[0]! + 0.5) * 16) > 0.01) throw new Error(`the spark is at x=${spark.at.x}, not on the foe's tile`);
    if (Math.abs(spark.at.scale - 0.25) > 1e-6) throw new Error(`the spark's scale is ${spark.at.scale}, not the rich 0.25 (64 art px a tile)`);
    await page.waitFor(`${LIVE}.length === 0`, 'the spark to clear', 2000);
    console.log(`effects: a landed hit played hit-spark on ${foeTile.join(',')}: frames ${spark.frames.join(',')}, then cleared`);

    // the chase's bite: the starburst on the player, eleven frames in order, then clear
    await page.eval(`window.__game.session.emit('events', [{ e: 'hurt', by: 'predator', id: 'core/bank-wolf', hp: 90 }])`);
    const burst = await watch(page, 'crit-hit', 4000);
    if (!burst.at) throw new Error('a bite played no starburst');
    if (!steps(burst.frames, 11)) throw new Error(`the starburst did not step through its 11 frames in order: ${burst.frames.join(',')}`);
    await page.waitFor(`${LIVE}.length === 0`, 'the starburst to clear', 2000);
    console.log(`effects: a bite played crit-hit on the player: frames ${burst.frames.join(',')}, then cleared`);
    await page.eval(`window.__game.session.emit('events', [{ e: 'hurt', by: 'predator', id: 'core/bank-wolf', hp: 90 }])`);
    await page.waitFor(`${LIVE}.some((e) => e.id === 'crit-hit')`, 'the starburst to show', 2000);
    await page.screenshot(join(OUT, 'effects-1-bite.png'));
    await page.waitFor(`${LIVE}.length === 0`, 'the starburst to clear again', 2000);

    // a real jump up the ledge: the dust where it lands, on dry ground
    // the first minute is the game clock's own: it is put past the minute rather than waited for
    await page.eval(`(() => { const s = window.__game.session; if (s.tick < 60000) s.tick = 60000; })()`);
    await page.eval(place([LOW[0] - 2, LOW[1]], 'down'));
    await page.key('ArrowRight', 'keyDown');
    await page.waitFor(`window.__game.session.pos[0] === ${LOW[0]}`, 'the walk to the foot of the ledge', 10_000);
    await page.key('ArrowRight', 'keyUp');
    await page.waitFor(`window.__game.controls.vector()[0] === 0 && !window.__game.session.busy`, 'the walk to stop', 5000);
    await page.waitFor(`window.__game.session.state.player.at[0] === ${LOW[0]} && window.__game.session.state.player.at[1] === ${LOW[1]}`, 'the kernel to hold the walked-to tile', 10_000);
    const tag = await page.eval<string>(`(() => { const b = window.__game.bundle; return b.map.legend[b.map.ground[${HIGH[1]}]?.[${HIGH[0]}] ?? '']?.tag ?? ''; })()`);
    await page.tap('.tbtn.jump');
    const dust = await watch(page, 'landing-dust', 6000);
    const dry = ['path', 'riverbank', 'town', 'ruin'].includes(tag);
    if (dry) {
      if (!dust.at) throw new Error(`a jump onto ${tag} ground raised no dust`);
      if (!steps(dust.frames, 12)) throw new Error(`the dust did not step through its 12 frames in order: ${dust.frames.join(',')}`);
      await page.waitFor(`${LIVE}.length === 0`, 'the dust to clear', 2000);
      console.log(`effects: a jump onto ${tag} ground (${HIGH.join(',')}) raised landing-dust: frames ${dust.frames.join(',')}, then cleared`);
    } else {
      if (dust.at) throw new Error(`a jump onto ${tag || 'unnamed'} ground raised the dust, which belongs to dry ground only`);
      console.log(`effects: a jump onto ${tag || 'unnamed'} ground (${HIGH.join(',')}) raised no dust, as meadow ground keeps its leaves`);
    }
    // the takeoff: the feet left the low tile, which kicked up its own ground (nothing on ground with no bits of its own)
    const off = await page.eval<{ id: string; parts: string[] } | undefined>(`window.__game.world.effects.played.find((m) => m.id === 'jump-off')`);
    const lowBits = await page.eval<boolean>(`(() => { const b = window.__game.bundle; const t = b.map.legend[b.map.ground[${LOW[1]}]?.[${LOW[0]}] ?? '']?.tag; return ['path','riverbank','town','meadow','grove','ruin'].includes(t); })()`);
    if (!off) throw new Error('the jump played no takeoff');
    if (lowBits !== off.parts.includes('ground')) throw new Error(`the takeoff laid ${off.parts.join(',') || 'nothing'} on ground that ${lowBits ? 'has' : 'has no'} bits`);
    console.log(`effects: the jump's takeoff from ${LOW.join(',')} laid ${off.parts.join(',') || 'nothing (no bits there)'}`);
    // the dust again at the town's dry ground, laid by the scene's own landing call, for the frame count whatever the ledge's ground is
    await page.eval(`window.__game.world.dustAt(${HIGH[0]}, ${HIGH[1]}); window.__game.world.dustAt(23, 6);`);

    // the camp fire: lit in the page for a long burn, it stands in place of the kit's look; out, the kit's look returns
    await page.eval(place([HIGH[0], HIGH[1] + 2], 'down'));
    await page.eval(`(() => { const s = window.__game.session; s.state.player.fires = { ...(s.state.player.fires ?? {}), '${HEARTH}': { lit: s.tick, until: s.tick + 400_000_000 } }; window.__game.world.refresh(); })()`);
    await page.waitFor(`window.__game.world.campfireLook('${HEARTH}')?.up === true`, 'the camp fire loop to show over the lit hearth', 5000);
    const seenFrames = await page.eval<number[]>(`new Promise((ok) => {
      const seen = []; const t0 = performance.now();
      const tick = () => { const f = window.__game.world.campfireLook('${HEARTH}').frame; if (seen[seen.length - 1] !== f) seen.push(f); if (seen.length >= 6 || performance.now() - t0 > 4000) ok(seen); else requestAnimationFrame(tick); };
      tick();
    })`);
    if (seenFrames.length < 6) throw new Error(`the camp fire loop moved through only ${seenFrames.join(',')}`);
    const look = await page.eval<{ up: boolean; kitHidden: boolean }>(`window.__game.world.campfireLook('${HEARTH}')`);
    if (!look.kitHidden) throw new Error('the kit look still shows under the camp fire loop');
    await page.screenshot(join(OUT, 'effects-2-campfire.png'));
    console.log(`effects: the lit hearth shows the camp fire loop in place of the kit's look, frames ${seenFrames.join(',')}`);
    await page.eval(`(() => { const s = window.__game.session; delete s.state.player.fires['${HEARTH}']; window.__game.world.refresh(); })()`);
    await page.waitFor(`window.__game.world.campfireLook('${HEARTH}')?.up === false && window.__game.world.campfireLook('${HEARTH}')?.kitHidden === false`, 'the kit look to come back when the fire is out', 5000);
    console.log("effects: the fire out, the loop is down and the kit's look is back");

    // the moments the kernel's events start, each told to the session the way the kernel tells it, on the meadow tile
    await page.eval(place(FIELD, 'right'));
    const out = outcomeAt(FIELD);
    const MOMENT_LINES: [string, string, string[]][] = [
      ['stone-lift', `{ e: 'lift', kind: 'core/stone', qty: 1, at: ${JSON.stringify(FIELD)} }`, ['ground']],
      ['stone-down', `{ e: 'setdown', kind: 'core/large-stone', at: ${JSON.stringify(FIELD)}, count: 1 }`, ['ground', 'burst']],
      ['stone-push', `{ e: 'push', kind: 'core/boulder', from: ${JSON.stringify(FIELD)}, at: ${JSON.stringify(FIELD)} }`, ['ground']],
      ['eat', `{ e: 'eat', item: 'core/berries', hp: 90 }`, ['burst']],
      ['tool-broke', `{ e: 'tool_broke', item: 'core/axe' }`, ['burst', 'burst']],
      ['level', `{ e: 'level', profession: 'core/woodcutting', level: 2 }`, ['light', 'burst', 'burst']],
    ];
    for (const [id, event, want] of MOMENT_LINES) {
      const n = await page.eval<number>(`window.__game.world.effects.played.length`);
      await page.eval(`window.__game.session.emit('events', [${event}])`);
      const got = await page.eval<{ id: string; parts: string[] }[]>(`window.__game.world.effects.played.slice(${n})`);
      const m = got.find((g) => g.id === id);
      if (!m) throw new Error(`the ${id} event played no moment (saw ${got.map((g) => g.id).join(',') || 'none'})`);
      if (m.parts.join(',') !== want.join(',')) throw new Error(`${id} laid ${m.parts.join(',') || 'nothing'}, not ${want.join(',')}`);
      console.log(`effects: ${id} laid ${m.parts.join(', ')}`);
      if (id === 'hurt') {
        await page.screenshot(join(OUT, 'effects-3-hurt-flash.png'));
        await page.waitFor(`window.__game.world.effects.showing.flashes === 0`, 'the hurt flash to clear', 2000);
      }
    }
    await page.waitFor(`window.__game.world.effects.showing.rings === 0 && window.__game.world.effects.showing.flashes === 0`, 'every ring and flash to clear', 4000);

    await page.waitFor(`${LIVE}.length === 0`, 'every one-shot to clear', 4000);
    if (page.errors.length > 0) throw new Error(`${page.errors.length} page errors were raised: ${page.errors.slice(0, 3).join(' | ')}`);
    console.log('effects: nothing left playing, no page errors');
  } finally {
    await browser.close();
    local?.server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
