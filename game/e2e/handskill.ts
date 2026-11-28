/**
 * Proves the moment of hand skill in a real browser (public #923): a hare is struck by a charged throw, and a stone that comes down
 * beside it takes nothing. On a phone on its side, 844 by 390 CSS px:
 *
 * - from each of the three wake pockets (north meadow, west bank, slid bank) the figure stands where it woke (the north meadow's wake
 *   stands among trees, so one step up, as the kernel's own test of the moment finds), a hare that nothing has startled stands within reach, and B is held a little past the
 *   charge time: the stone takes the hare (a carcass lies where it stood, one stone left the bag, the hit's moment played);
 * - on the west bank again, a tap on B throws the stone short: it lies on the ground where it came to rest, takes nothing, the miss's
 *   moment plays, the hare hears it come down and goes to ground; the figure lifts the stone again (it is in the bag once more) and
 *   the hare comes out again by its own hours.
 *
 * Every check waits on a condition, never on a fixed time. The screenshots go to the out-dir (default .scratch/e2e).
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, type Page } from './cdp';
import { PHONE } from './viewports';
import { type WakePocket, TAKE_GROUND, carveIn, seedQuery } from './wakes';

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

async function start(page: Page): Promise<void> {
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Human');
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


const place = (at: readonly number[], facing: string): string => `(() => { const g = window.__game, s = g.session; s.pos = [${at[0]}, ${at[1]}]; s.state.player.at = [${at[0]}, ${at[1]}]; s.facing = ${JSON.stringify(facing)}; g.world.bind(s); })()`;

const wild = `window.__game.world.wild`;
const player = `window.__game.session.state.player`;
const bag = `(${player}.bag['core/stone'] ?? 0)`;

/** What the page knows of the hare nearest the figure's wake tile: its spot, where it stands, its state and whether it is under. */
const hareNear = (at: readonly number[]): string => `(() => {
  const spots = window.__game.bundle.map.creatures.spots;
  const near = spots.map((s, i) => ({ i, s, d: Math.hypot(s.x - ${at[0]}, s.y - ${at[1]}) })).filter((x) => x.s.kind === 'core/hare').sort((p, q) => p.d - q.d)[0];
  return near.i;
})()`;
const hare = (spot: number) => `${wild}.state.animals.find((a) => a.spot === ${spot})`;

interface HareRead {
  at: [number, number];
  state: string;
  under: boolean;
  stepped: boolean;
}
const readHare = (spot: number) => `(() => { const a = ${hare(spot)}; return { at: [...a.c.at], state: a.c.state, under: !!a.c.under, stepped: a.stepped }; })()`;

/**
 * The step on from the wake tile where a full charge from the wake itself does not take the nearest hare: on the painted valley the
 * north meadow's line to its hare (4,1) runs through trees, and one step up (5,2) it is clear and 1.4 tiles off. The kernel's test of
 * the moment (kernel/test/hand-skill.test.ts) finds the same tile from the wake and its four neighbours.
 */
const STEP_ON: Partial<Record<WakePocket, [number, number]>> = { 'core/north-meadow': [0, -1] };

/** Facing along the longer axis toward a tile, as the figure would turn to it. */
const facingTo = (from: readonly number[], to: readonly number[]): string => {
  const dx = to[0]! - from[0]!;
  const dy = to[1]! - from[1]!;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
};

/** A fresh game woken in `pocket`, the ground's tools in the bag, the waking lines closed. */
async function woken(page: Page, base: string, pocket: WakePocket): Promise<void> {
  await page.goto(`${base}?debug&rich=none${seedQuery(pocket)}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  await start(page);
  // the stone comes from the ground: the figure lifts the nearest loose stone of the map into the bag (nothing is given at the start)
  const wake = await page.eval<[number, number]>(`[...window.__game.session.pos]`);
  const lie = await page.eval<[number, number]>(`(() => {
    const spots = window.__game.bundle.map.stones.spots.filter((s) => s.kind === 'core/stone');
    const s = spots.sort((p, q) => Math.hypot(p.x - ${wake[0]}, p.y - ${wake[1]}) - Math.hypot(q.x - ${wake[0]}, q.y - ${wake[1]}))[0];
    return [s.x, s.y];
  })()`);
  await page.eval(place(lie, 'down'));
  const had = await page.eval<number>(bag);
  await page.eval(`window.__game.world.liftStone('core/stone')`);
  await page.waitFor(`${bag} === ${had + 1}`, 'the stone lifted from the ground into the bag', 8000);
  await page.waitFor(`!window.__game.world.lifting && window.__game.session.state.player.busyUntil <= window.__game.session.tick`, 'the lift to end', 8000);
  await page.eval(place(wake, 'down'));
}

/**
 * The figure at its wake tile (or one step toward the hare when that is out of the throw's reach), facing the hare, the world stepped
 * afresh so the hare stands at its anchor and has not noticed anything. Returns the hare's spot and the tile the figure stands on.
 */
async function setUp(page: Page, pocket: WakePocket): Promise<{ spot: number; from: [number, number]; reach: number }> {
  const woke = await page.eval<[number, number]>(`[...window.__game.session.pos]`);
  const on = STEP_ON[pocket] ?? [0, 0];
  const wake: [number, number] = [woke[0] + on[0], woke[1] + on[1]];
  const spot = await page.eval<number>(hareNear(wake));
  const target = await page.eval<[number, number]>(`(() => { const s = window.__game.bundle.map.creatures.spots[${spot}]; return [s.x, s.y]; })()`);
  const reach = await page.eval<number>(`(() => { const l = window.__game.bundle.params.liftables[window.__game.bundle.params.hunt.throw_item]; return l.throw_range + l.roll + window.__game.bundle.params.hunt.hit_tiles; })()`);
  let from: [number, number] = [wake[0], wake[1]];
  if (Math.hypot(target[0] - wake[0], target[1] - wake[1]) > reach) from = [wake[0] + Math.sign(target[0] - wake[0]), wake[1] + Math.sign(target[1] - wake[1])];
  await page.eval(place(from, facingTo(from, target)));
  await page.eval(`${wild}.reset()`);
  await page.waitFor(`${hare(spot)}.stepped && !${hare(spot)}.c.under`, 'the hare to stand in the world', 10_000);
  return { spot, from, reach };
}

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const base = remote ?? local?.url ?? '';
  const browser = await Browser.launch();
  const page = await browser.newPage(PHONE);
  try {
    for (const pocket of ['core/north-meadow', 'core/west-bank', 'core/slid-bank'] as const) {
      await woken(page, base, pocket);
      const held = await page.eval<number>(`window.__game.bundle.params.stones.throw_charge_ms`);
      const stones = await page.eval<number>(bag);
      const { spot, from, reach } = await setUp(page, pocket);
      const at = await page.eval<HareRead>(readHare(spot));
      const dist = Math.hypot(at.at[0] - from[0], at.at[1] - from[1]);
      if (dist > reach) throw new Error(`${pocket}: the hare stands ${dist.toFixed(1)} tiles from ${from.join(',')}, past the reach ${reach}`);
      const mark = await page.eval<number>(`window.__game.world.effects.played.length`);
      await page.holdTap('.tbtn.b', held + 120);
      await page
        .waitFor(`(${player}.carcasses ?? []).length === 1`, 'the stone to take the hare', 8000)
        .catch(async (err: unknown) => {
          throw new Error(`${pocket}: ${err instanceof Error ? err.message : String(err)}: hare ${JSON.stringify(await page.eval<HareRead>(readHare(spot)))}, figure ${from.join(',')}, stones ${await page.eval<number>(bag)}`);
        });
      const carcass = await page.eval<{ kind: string; at: [number, number] }>(`${player}.carcasses[0]`);
      if (carcass.kind !== 'core/hare') throw new Error(`${pocket}: the stone took a ${carcass.kind}, not a hare`);
      if (Math.hypot(carcass.at[0] - at.at[0], carcass.at[1] - at.at[1]) > 1.5) throw new Error(`${pocket}: the carcass lies at ${carcass.at.join(',')}, the hare stood at ${at.at.join(',')}`);
      if ((await page.eval<number>(bag)) !== stones - 1) throw new Error(`${pocket}: the hit spent ${stones - (await page.eval<number>(bag))} stones, not one`);
      await page.waitFor(`window.__game.world.effects.played.slice(${mark}).some((m) => m.id === 'game-hit')`, 'the hit\'s moment', 5000);
      console.log(`handskill: ${pocket}: from ${from.join(',')} a full charge took the hare ${dist.toFixed(1)} tiles off (it stood at ${at.at.join(',')}, ${at.state}); the carcass lies at ${carcass.at.join(',')}`);
      await page.screenshot(join(OUT, `handskill-hit-${pocket.split('/')[1]}.png`));
    }

    // the miss, on the west bank: a tap throws short, the stone lies, the hare hears it and goes to ground, the stone is lifted again
    await woken(page, base, 'core/west-bank');
    const { spot, from } = await setUp(page, 'core/west-bank');
    const stones = await page.eval<number>(bag);
    const mark = await page.eval<number>(`window.__game.world.effects.played.length`);
    await page.holdTap('.tbtn.b', 40);
    await page.waitFor(`${bag} === ${stones - 1}`, 'the stone to leave the bag', 5000);
    await page.waitFor(`!window.__game.world.stones.busy`, 'the stone to come to rest', 8000);
    if (((await page.eval<{ length: number }>(`${player}.carcasses ?? []`)).length) !== 0) throw new Error('a short throw took the hare');
    // a thrown stone lies on its tile on loan (the kernel's `returns`, by tile) until it goes back to where it came from
    const lies = await page.eval<[number, number][]>(`(${player}.stones?.returns ?? []).filter((r) => r.kind === 'core/stone' && r.key).map((r) => r.key.split(',').map(Number))`);
    if (lies.length < 1) throw new Error(`the stone that missed lies nowhere: ${await page.eval<string>(`JSON.stringify(${player}.stones)`)}`);
    await page.waitFor(`window.__game.world.effects.played.slice(${mark}).some((m) => m.id === 'game-miss')`, 'the miss\'s moment', 5000);
    console.log(`handskill: a tap on B from ${from.join(',')} threw short, the stone lies at ${lies[0]!.join(',')} and took nothing`);
    await page
      .waitFor(`(() => { const a = ${hare(spot)}; return a.c.state === 'FLEE' || !!a.c.under; })()`, 'the hare to hear the stone and go', 10_000)
      .catch(async (err: unknown) => {
        throw new Error(`${err instanceof Error ? err.message : String(err)}: ${JSON.stringify(await page.eval<HareRead>(readHare(spot)))}`);
      });
    console.log(`handskill: the hare heard it come down: ${JSON.stringify(await page.eval<HareRead>(readHare(spot)))}`);
    // lifted again: the figure on the stone's tile, A
    await page.eval(place(lies[0]!, 'down'));
    await page.eval(`window.__game.world.liftStone('core/stone')`);
    await page.waitFor(`${bag} === ${stones}`, 'the stone back in the bag', 5000);
    console.log(`handskill: the stone was lifted again, ${stones} in the bag`);
    // and the hare comes back by its own hours: the figure far off, out of its hearing
    await page.eval(place([from[0], from[1] + 14], 'up'));
    await page
      .waitFor(`(() => { const a = ${hare(spot)}; return a.stepped && !a.c.under && a.c.state !== 'FLEE'; })()`, 'the hare to come out again', 120_000)
      .catch(async (err: unknown) => {
        throw new Error(`${err instanceof Error ? err.message : String(err)}: ${JSON.stringify(await page.eval<HareRead>(readHare(spot)))}`);
      });
    console.log(`handskill: the hare came back: ${JSON.stringify(await page.eval<HareRead>(readHare(spot)))}`);
    await page.screenshot(join(OUT, 'handskill-after.png'));
    if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    await page.screenshot(join(OUT, 'handskill-failed.png')).catch(() => undefined);
    throw err;
  } finally {
    page.close();
    await browser.close();
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
