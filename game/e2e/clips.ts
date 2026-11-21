/**
 * Proves the figure plays a kit clip by name in a real browser (#742, stage 1, bars B3 and B4). The fixture kit
 * (tools/test/fixtures/clips/kit.json, tests only, never content) gives the human a clip per verb and view; here three
 * of its sheets are drawn on a canvas in the page and put into the running client's kit table, as a kit loaded with the
 * game would be, with the race of the character that woke. Then, on the real scene's own code:
 *
 *  B3 frames advance: on the verbs dig and pickup the frame shown goes through the clip's frames in order, and the
 *     milliseconds a frame stays, measured on the wall clock, are the kit's number within one display frame.
 *  B4 speed per clip: the dig clip's frame time is doubled in the kit: its measured step doubles, the pickup clip's does not move.
 *  and a verb the kit has no clip for (fish) shows no clip at all: today's motion.
 *
 * Stage 2 (the real kit): first, for each race (Elf, Human, Skeleton), the four work verbs a valley action reaches (fell, quarry, fish,
 * pickup) are played on the real scene against the sheets the kit now holds, facing the viewer. Two bars each, read off the player's
 * own image: B3 the sheet's own frames advance (at least 3 distinct frame numbers of that sheet in two seconds of a looping action,
 * the walk's sheet never standing in for it), and the displayed figure (the opaque height of the sheet's first frame at the scale the
 * engine really drew it with, `fit` included) stands within 2 art pixels of the same race's walk. CLIPS_BREAK=<sheet name> removes one
 * sheet from the running page's kit table before those checks, as a kit.json without it would assemble: the bar must then fail.
 *
 * Every check waits on a condition, never a fixed time. No game/dist content is touched: the sheets exist only in the page.
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page } from './cdp';
import { TAKE_GROUND, carveIn, seedQuery } from './wakes';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(GAME_DIR, 'dist');
const FIXTURE = join(GAME_DIR, '..', 'tools', 'test', 'fixtures', 'clips', 'kit.json');
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e'));
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };

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

/** The clips this script plays: the work kind a beat is played as, the fixture sheet it should show, and the kit's own frame time. */
const PLAYS = [
  { kind: 'dig', sheet: 'chars/human_dig_front' },
  { kind: 'pick', sheet: 'chars/human_pickup_front' },
] as const;
const KIT = 'core/clip-fixture';
const TRIALS = 5;

const IN_PAGE = `
window.__clips = (() => {
  const g = () => window.__game;
  const world = g().world;
  const log = [];
  const drawn = [];
  let timer = 0;
  const own = world.showPlayer.bind(world);
  world.showPlayer = (k, frame, flip) => { log.push({ k, frame: Number(frame), t: performance.now() }); return own(k, frame, flip); };
  return {
    /** The fixture's sheets drawn on a canvas, one colour a frame, and listed in the running kit as the assembler would list them. */
    inject(entries, race) {
      const sprites = { ...g().bundle.sprites };
      for (const e of entries) {
        const cv = document.createElement('canvas');
        cv.width = e.w * e.frames;
        cv.height = e.h;
        const c = cv.getContext('2d');
        for (let i = 0; i < e.frames; i++) { c.fillStyle = 'hsl(' + i * 50 + ',70%,50%)'; c.fillRect(i * e.w, 0, e.w, e.h); }
        const tex = world.textures.addCanvas(e.key, cv);
        for (let i = 0; i < e.frames; i++) tex.add(i, 0, i * e.w, 0, e.w, e.h);
        sprites[e.key] = { url: '', w: e.w, h: e.h, frames: e.frames, density: 4, clip: { ...e.clip, race } };
      }
      g().bundle.sprites = sprites;
      return Object.keys(sprites).filter((k) => sprites[k].clip).length;
    },
    race() { return g().session.state.player.race; },
    /** One beat of a work on the real scene, the way the figure is told of it: facing down, the view the sheets are drawn for. */
    play(kind) {
      log.length = 0;
      drawn.length = 0;
      g().session.facing = 'down';
      const verb = { fell: 'fell', mine: 'quarry', dig: 'dig', fish: 'fish', pick: 'pickup' }[kind];
      world.playClip(verb);
      clearInterval(timer);
      // the sprite's own texture and frame, read straight off the player's image every 15 ms: what is on the screen, not what was asked of it
      timer = setInterval(() => drawn.push([world.player.texture.key, Number(world.player.frame.name)]), 15);
    },
    /** Drops one sheet from the running kit table (CLIPS_BREAK): a kit.json without it. */
    drop(key) { const sprites = { ...g().bundle.sprites }; delete sprites[key]; g().bundle.sprites = sprites; return key in g().bundle.sprites; },
    /** The opaque rows of one frame of a texture: the figure's height in the sheet's pixels. */
    rows(key, frame, w, h) {
      let top = -1, bottom = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((world.textures.getPixelAlpha(x, y, key, frame) ?? 0) > 0) { if (top < 0) top = y; bottom = y; break; }
      return top < 0 ? 0 : bottom - top + 1;
    },
    /** One real beat of a work facing the viewer, looping for ms: the frames of the sheet the player's image held and the scale it was drawn at. */
    real(kind, ms) {
      g().session.facing = 'down';
      const verb = { fell: 'fell', mine: 'quarry', dig: 'dig', fish: 'fish', pick: 'pickup' }[kind];
      const found = world.playClip(verb, ms);
      const rows = [];
      return new Promise((ok) => {
        const t0 = performance.now();
        const timer = setInterval(() => {
          rows.push([world.player.texture.key, Number(world.player.frame.name), world.player.scaleY]);
          if (performance.now() - t0 < ms) return;
          clearInterval(timer);
          const walkKey = world.playerFrame('down', 'walk').key;
          const walk = g().bundle.sprites[walkKey];
          ok({ found, rows, walkKey, walkFrames: walk.frames, walkDensity: walk.density, w: walk.w, h: walk.h });
        }, 15);
      });
    },
    over() { const done = !world.figure.active; if (done) clearInterval(timer); return done; },
    /** The frames of one sheet the player's own image held, in order, without repeats. */
    drawn(key) { return drawn.filter((r) => r[0] === key).map((r) => r[1]).filter((f, i, a) => i === 0 || f !== a[i - 1]); },
    set(key, ms) { g().bundle.sprites[key].clip.frame_ms = ms; },
    /** When each frame of one sheet was first shown, by the wall clock, in ms from the first. */
    seen(key) {
      const rows = log.filter((r) => r.k === key);
      const first = [];
      for (const r of rows) if (first[r.frame] === undefined) first[r.frame] = r.t;
      return { order: rows.map((r) => r.frame).filter((f, i, a) => i === 0 || f !== a[i - 1]), first: first.map((t) => t - first[0]) };
    },
    shown() { return log.map((r) => r.k); },
    /** The median gap between two animation frames the browser draws: the display frame this run can measure to. */
    display() {
      return new Promise((ok) => {
        const gaps = []; let last = performance.now(), n = 0;
        const tick = (t) => { gaps.push(t - last); last = t; if (++n < 40) requestAnimationFrame(tick); else ok(gaps.sort((a, b) => a - b)[20]); };
        requestAnimationFrame(tick);
      });
    },
  };
})();
true`;

async function start(page: Page, race: string): Promise<void> {
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', race);
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the character to wake', 10_000);
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

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

/**
 * The measured frame time of one clip, on `trials` plays: the median over the plays of the time between the first and the last
 * frame the page showed, over the frames between them. A frame no tick landed on (the machine stalled for a whole frame time) is
 * not counted against the clip, but the frames seen must be in order, and `skipped` counts the ones missed.
 */
async function measure(page: Page, kind: string, key: string, frames: number, trials = TRIALS): Promise<{ step: number; skipped: number; texture: number[] }> {
  const steps: number[] = [];
  let skipped = 0;
  let texture: number[] = [];
  for (let i = 0; i < trials; i++) {
    await page.eval(`__clips.play(${JSON.stringify(kind)})`);
    await page.waitFor('__clips.over()', `the ${kind} clip to be over`, 30_000);
    const seen = await page.eval<{ order: number[]; first: number[] }>(`__clips.seen(${JSON.stringify(key)})`);
    const increasing = seen.order.every((f, j) => j === 0 || f > seen.order[j - 1]!);
    if (!increasing || seen.order.length < 3 || seen.order[0] !== 0) throw new Error(`${kind}: the frames shown were [${seen.order}], not an increasing run from 0 of ${frames} frames`);
    // and what the player's own image held while it played: the same frames, in order, straight off the sprite
    const held = await page.eval<number[]>(`__clips.drawn(${JSON.stringify(key)})`);
    if (held.length < 3 || !held.every((f, j) => j === 0 || f > held[j - 1]!) || held.some((f) => !seen.order.includes(f))) throw new Error(`${kind}: the sprite itself held frames [${held}], the tick showed [${seen.order}]`);
    texture = held;
    const a = seen.order[0]!;
    const b = seen.order[seen.order.length - 1]!;
    skipped += frames - seen.order.length;
    steps.push((seen.first[b]! - seen.first[a]!) / (b - a));
  }
  return { step: median(steps), skipped, texture };
}

const RACES = ['Elf', 'Human', 'Skeleton'] as const;
/** The work verbs a valley action reaches, by the work kind that plays them (clips.ts VERB_OF_AUTO), and the sheet name's verb. */
const WORK = [
  { kind: 'fell', verb: 'fell' },
  { kind: 'mine', verb: 'quarry' },
  { kind: 'fish', verb: 'fish' },
  { kind: 'pick', verb: 'pickup' },
] as const;
const LOOP_MS = 2000;
const SHOW_BAND = 2;

/** B3 and the size bar on the real kit, for the race that woke; returns the failures. */
async function realKit(page: Page, race: string): Promise<string[]> {
  const failures: string[] = [];
  const stem = race.toLowerCase();
  const broken = process.env.CLIPS_BREAK;
  if (broken) {
    await page.eval(`__clips.drop(${JSON.stringify(`core/base-kit:chars/${broken}`)})`);
    console.log(`clips: BROKEN on purpose, ${broken} removed from the running kit table`);
  }
  for (const w of WORK) {
    const key = `core/base-kit:chars/${stem}_${w.verb}_front`;
    const r = await page.eval<{ found: boolean; rows: [string, number, number][]; walkKey: string; walkFrames: number; walkDensity: number; w: number; h: number }>(`__clips.real(${JSON.stringify(w.kind)}, ${LOOP_MS})`);
    const own = r.rows.filter((x) => x[0] === key);
    const distinct = [...new Set(own.map((x) => x[1]))].sort((a, b) => a - b);
    const fallback = r.rows.filter((x) => x[0] === r.walkKey).length;
    const framesOk = distinct.length >= 3;
    console.log(`clips: ${framesOk ? 'PASS' : 'FAIL'} B3 ${race} ${w.verb}: ${distinct.length} distinct frames [${distinct}] of the sheet in ${LOOP_MS} ms (${fallback} samples of the walk sheet)`);
    if (!framesOk) {
      failures.push(`${race} ${w.verb} shows ${distinct.length} frames of its sheet`);
      continue;
    }
    // the displayed figure: the first frame of the sheet (the take's stance) at the scale the engine drew it with, against the walk's standing frame at its own
    const info = await page.eval<{ sheetRows: number; sheetDensity: number; walkRows: number }>(
      `({ sheetRows: __clips.rows(${JSON.stringify(key)}, 0, 128, 128), sheetDensity: __game.bundle.sprites[${JSON.stringify(key)}].density, walkRows: __clips.rows(${JSON.stringify(r.walkKey)}, ${r.walkFrames - 1}, ${r.w}, ${r.h}) })`,
    );
    const scale = own[0]![2];
    const shown = info.sheetRows * scale;
    const walk = info.walkRows / r.walkDensity;
    const sizeOk = Math.abs(shown - walk) <= SHOW_BAND;
    console.log(`clips: ${sizeOk ? 'PASS' : 'FAIL'} size ${race} ${w.verb}: displayed ${shown.toFixed(2)} px (${info.sheetRows} rows at scale ${scale.toFixed(4)}), the walk ${walk.toFixed(2)} px`);
    if (!sizeOk) failures.push(`${race} ${w.verb} is displayed ${shown.toFixed(1)} px tall, the walk ${walk.toFixed(1)}`);
  }
  return failures;
}

async function run(page: Page, url: string, race: string, first: boolean): Promise<void> {
  await page.goto(`${url}?debug&rich=none${seedQuery('core/west-bank')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await start(page, race);
  await readThrough(page);
  await page.eval(IN_PAGE);
  const real = await realKit(page, race);
  if (real.length > 0) throw new Error(`clips: ${real.join('; ')}`);
  // the stage 1 checks (fixture sheets, frame time as data) run once
  if (!first) return;

  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { kit: { sprites: Record<string, { w: number; h: number; frames: number; clip: Record<string, unknown> }> } };
  const entries = [...PLAYS.map((p) => p.sheet), 'chars/human_strike_front'].map((name) => ({ key: `${KIT}:${name}`, ...fixture.kit.sprites[name]! }));
  const raceId = await page.eval<string>('__clips.race()');
  const injected = await page.eval<number>(`__clips.inject(${JSON.stringify(entries)}, ${JSON.stringify(raceId)})`);
  const display = await page.eval<number>('__clips.display()');
  const tol = Math.max(display, 17);
  console.log(`clips: race ${raceId}, ${injected} clip sheets in the running kit, display frame ${display.toFixed(1)} ms (tolerance ${tol.toFixed(1)} ms)`);

  // a frame can only be seen as often as the page draws: the kit's times are the fixture's (140 ms for the dig), or three display
  // frames when the machine draws slower than that (software GL on a busy laptop), so every frame of a clip is drawn at least once
  const slow = Math.ceil((display * 3) / 10) * 10;
  const setTime = (sheet: string, ms: number) => page.eval(`__clips.set(${JSON.stringify(`${KIT}:${sheet}`)}, ${ms})`);
  const fixtureMs = (sheet: string) => fixture.kit.sprites[sheet]!.clip.frame_ms as number;
  for (const p of PLAYS) await setTime(p.sheet, Math.max(fixtureMs(p.sheet), slow));
  console.log(`clips: kit frame times set to ${PLAYS.map((p) => `${p.sheet} ${Math.max(fixtureMs(p.sheet), slow)} ms (fixture ${fixtureMs(p.sheet)})`).join(', ')}`);

  const failures: string[] = [];
  const check = (what: string, got: number, want: number): void => {
    const ok = Math.abs(got - want) <= tol;
    console.log(`clips: ${ok ? 'PASS' : 'FAIL'} ${what}: measured ${got.toFixed(1)} ms, kit ${want} ms`);
    if (!ok) failures.push(what);
  };

  // B3: each clip steps at its own kit number
  const kit = (name: string) =>
    page.eval<{ frame_ms: number; frames: number }>(`({ frame_ms: __game.bundle.sprites[${JSON.stringify(`${KIT}:${name}`)}].clip.frame_ms, frames: __game.bundle.sprites[${JSON.stringify(`${KIT}:${name}`)}].frames })`);
  const before: Record<string, number> = {};
  for (const p of PLAYS) {
    const k = await kit(p.sheet);
    const m = await measure(page, p.kind, `${KIT}:${p.sheet}`, k.frames);
    before[p.sheet] = m.step;
    check(`B3 ${p.kind} frames advance (${m.skipped} of ${k.frames * TRIALS} frames not drawn by a tick; the sprite itself held frames [${m.texture}] on the last play)`, m.step, k.frame_ms);
  }

  // B4: the dig clip's time doubled in the kit moves that clip's step and not the pickup clip's
  const dig = PLAYS[0]!;
  const pick = PLAYS[1]!;
  const digKit = await kit(dig.sheet);
  const pickKit = await kit(pick.sheet);
  await page.eval(`__clips.set(${JSON.stringify(`${KIT}:${dig.sheet}`)}, ${digKit.frame_ms * 2})`);
  const digAfter = (await measure(page, dig.kind, `${KIT}:${dig.sheet}`, digKit.frames)).step;
  const pickAfter = (await measure(page, pick.kind, `${KIT}:${pick.sheet}`, pickKit.frames)).step;
  check('B4 dig, its frame time doubled', digAfter, digKit.frame_ms * 2);
  check('B4 pickup, not touched', pickAfter, pickKit.frame_ms);
  console.log(`clips: dig step ${before[dig.sheet]!.toFixed(1)} -> ${digAfter.toFixed(1)} ms, pickup step ${before[pick.sheet]!.toFixed(1)} -> ${pickAfter.toFixed(1)} ms`);

  // a verb the fixture has no clip for shows none of the fixture's
  await page.eval(`__clips.play('fish')`);
  await sleep(1500);
  const shown = await page.eval<string[]>('__clips.shown()');
  const clipShown = shown.filter((k) => k.startsWith(KIT));
  console.log(`clips: ${clipShown.length === 0 ? 'PASS' : 'FAIL'} fish, the fixture has no clip for it: ${clipShown.length} fixture frames shown`);
  if (clipShown.length > 0) failures.push('fish shows a clip it has none of');

  mkdirSync(OUT, { recursive: true });
  if (failures.length > 0) throw new Error(`clips: ${failures.join('; ')}`);
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  try {
    for (const [i, race] of RACES.entries()) {
      const page = await browser.newPage({ width: 1440, height: 900, mobile: false });
      try {
        await run(page, remote ?? local?.url ?? '', race, i === 0);
      } finally {
        page.close();
      }
    }
    console.log('clips: passed');
  } finally {
    await browser.close();
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
