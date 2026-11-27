/**
 * Proves the valley's animals live in a real browser (public #916): the kernel steps them in the running scene (`wildStep`), and an
 * animal moves away when the figure walks at it. On a phone on its side, 844 by 390 CSS px:
 *
 * - after the wake, the animals near the player are stepped and shown, at most the kernel's `wild.awake_max`;
 * - the figure waits 13 tiles south of the roe by the river (spot 15, 10,11), then is set down 5 tiles west of it on the bank and
 *   walks east at it with the arrow key: the roe takes flight (its state FLEE in the kernel's world), and once it has run it stands
 *   farther from the figure than when it took flight;
 * - when the roe's sheets are in the kit (the drawn animals, #914) its image is shown and moves with it; with none, nothing is drawn
 *   and that bar says so (a kind with no sheet draws nothing).
 *
 * Every check waits on a condition, never on a fixed time. The screenshots go to the out-dir (default .scratch/e2e).
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

/** The roe by the river (map spot 15, at 10,11); the figure waits 13 tiles south, out of its sight (8), then is set down 5 tiles
 * west on the bank, where nothing stands between them (the herbs at 10,20 and the river stones at 10,16 block the column south). */
const ROE_SPOT = 15;
const FROM: [number, number] = [10, 24];
const WEST: [number, number] = [5, 11];

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

/** The player set down on a tile, facing a way, the scene told (the walk's own hand-over, as the other scripts use). */
const place = (at: readonly number[], facing: string): string => `(() => { const g = window.__game, s = g.session; s.pos = [${at[0]}, ${at[1]}]; s.state.player.at = [${at[0]}, ${at[1]}]; s.facing = ${JSON.stringify(facing)}; g.world.bind(s); })()`;
const wild = `window.__game.world.wild`;
const roe = `${wild}.state.animals.find((a) => a.spot === ${ROE_SPOT})`;
const where = `[...window.__game.session.pos]`;
/** The roe's tile and state, the figure's tile, and the roe's image when one is drawn. */
const READ = `(() => {
  const a = ${roe}, p = ${where};
  const img = ${wild}.drawn.get(${ROE_SPOT})?.spr;
  return { at: [...a.c.at], state: a.c.state, stepped: a.stepped, player: p, img: img && img.visible ? [img.x, img.y] : null };
})()`;

interface Read {
  at: [number, number];
  state: string;
  stepped: boolean;
  player: [number, number];
  img: [number, number] | null;
}

const d = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);

async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  mkdirSync(OUT, { recursive: true });
  const local = remote ? null : await serve();
  const browser = await Browser.launch();
  const page = await browser.newPage(PHONE);
  try {
    await page.goto(`${remote ?? local?.url ?? ''}?debug&rich=none${seedQuery('core/west-bank')}`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
    await start(page);

    // the nearest are stepped, no more than the cap
    await page.eval(place(FROM, 'up'));
    await page.waitFor(`${roe}.stepped && ${roe}.last >= 0`, 'the roe to be stepped', 10_000);
    const counts = await page.eval<{ stepped: number; cap: number; shown: number }>(`({ stepped: ${wild}.state.animals.filter((a) => a.stepped).length, cap: window.__game.bundle.params.wild.awake_max, shown: ${wild}.shown().length })`);
    if (counts.stepped < 1 || counts.stepped > counts.cap) throw new Error(`${counts.stepped} animals stepped, the cap is ${counts.cap}`);
    const calm = await page.eval<Read>(READ);
    if (calm.state === 'FLEE') throw new Error(`the roe fled before the figure came: ${JSON.stringify(calm)}`);
    console.log(`wildlife: ${counts.stepped} animals stepped (cap ${counts.cap}), ${counts.shown} shown; the roe ${calm.state} at ${calm.at.join(',')}, the figure at ${calm.player.join(',')}`);
    await page.screenshot(join(OUT, 'wildlife-calm.png'));

    // set down west of it and walked east at it until the roe takes flight or the figure stands three tiles from it
    await page.eval(place(WEST, 'right'));
    await page.key('ArrowRight', 'keyDown');
    await page
      .waitFor(`(() => { const r = ${READ}; return r.state === 'FLEE' || Math.hypot(r.at[0] - r.player[0], r.at[1] - r.player[1]) <= 3; })()`, 'the figure to come up to the roe', 15_000)
      .catch(async (err: unknown) => {
        throw new Error(`${err instanceof Error ? err.message : String(err)}: ${JSON.stringify(await page.eval<Read>(READ))}`);
      });
    await page.key('ArrowRight', 'keyUp');
    await page.waitFor(`${roe}.c.state === 'FLEE'`, 'the roe to take flight', 15_000);
    const fled = await page.eval<Read>(READ);
    await page.screenshot(join(OUT, 'wildlife-flight.png'));
    await page.waitFor(`${roe}.c.state !== 'FLEE'`, 'the flight to end', 20_000);
    const after = await page.eval<Read>(READ);
    const near = d(fled.at, fled.player);
    const far = d(after.at, after.player);
    if (!(far >= near + 3)) throw new Error(`the roe took flight ${near.toFixed(1)} tiles from the figure and stands ${far.toFixed(1)} off after it: it did not move away`);
    console.log(`wildlife: the figure walked at the roe; it fled at ${near.toFixed(1)} tiles and stood ${far.toFixed(1)} tiles off after (${fled.at.join(',')} to ${after.at.join(',')})`);

    // drawn from its sheets when the kit has them, else nothing
    const sheets = await page.eval<number>(`Object.values(window.__game.bundle.sprites).filter((s) => s.creature_clip?.creature === 'core/roe').length`);
    if (sheets > 0) {
      if (!fled.img || !after.img) throw new Error(`the roe has ${sheets} sheets in the kit but no image was shown`);
      if (d(fled.img, after.img) < 16 * 2) throw new Error(`the roe's image moved ${d(fled.img, after.img).toFixed(1)} px in its flight, under two tiles`);
      console.log(`wildlife: the roe is drawn from its ${sheets} sheets and its image moved ${(d(fled.img, after.img) / 16).toFixed(1)} tiles`);
    } else {
      if (fled.img || after.img) throw new Error('the roe has no sheet in the kit and an image was drawn');
      console.log('wildlife: the roe has no sheet in the kit, so nothing is drawn (the drawn check waits for its sheets)');
    }
    await page.screenshot(join(OUT, 'wildlife-after.png'));
    if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    await page.screenshot(join(OUT, 'wildlife-failed.png')).catch(() => undefined);
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
