/**
 * Proves the music by state in a real browser (audio/state.ts, audio/pieces-player.ts): no music file is fetched
 * and none plays on the title screen; after the first taps the routine is asked for and its file
 * fetched; the menu's switch flips the music to the synth and back without a reload; after dark outside the town
 * the night piece comes, and its file only then. No page error on the way. Every check waits on a condition.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page } from './cdp';
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
  '.ogg': 'audio/ogg',
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

/** The music files the page has asked the network for, by name. */
const MUSIC_FETCHED = `performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/music/')).map((n) => n.split('/').pop())`;
const SOUND = '__game.sound.state()';

interface Sound {
  song: string | null;
  source: 'real' | 'synth';
  playing: { state: string; source: string } | null;
  fetched: string[];
}

async function run(page: Page, url: string): Promise<void> {
  await page.goto(`${url}?debug&rich=none${seedQuery('core/west-bank')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  // the title screen: nothing of the music yet
  const before = await page.eval<string[]>(MUSIC_FETCHED);
  if (before.length > 0) throw new Error(`music fetched on the title screen: ${before.join(', ')}`);
  const title = await page.eval<Sound | null>(`window.__game.sound ? ${SOUND} : null`);
  // the world behind the title may ask for the routine already; nothing plays and nothing is fetched until a tap
  if (title && (title.playing !== null || title.fetched.length > 0)) throw new Error(`music playing on the title screen: ${JSON.stringify(title)}`);
  console.log('music: nothing fetched or playing on the title screen');

  // the first taps start the game; the routine is asked for and its file comes
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
  await page.waitFor(`${SOUND}.song === 'valley' && ${SOUND}.playing?.state === 'routine'`, 'the routine to be asked for', 10_000);
  await page.waitFor(`${MUSIC_FETCHED}.includes('routine.ogg')`, 'the routine file to be fetched', 10_000);
  const first = await page.eval<Sound>(SOUND);
  if (first.source !== 'real') throw new Error(`the default source is ${first.source}, not the real instruments`);
  if (first.fetched.length !== 1) throw new Error(`fetched more than the routine at the start: ${first.fetched.join(', ')}`);
  console.log(`music: the routine asked for after the taps, from ${first.playing?.source}; fetched ${first.fetched.join(', ')}`);

  // the opening's boxes are read through first: the menu opens over an empty screen
  for (let presses = 0; ; presses++) {
    if (await page.eval<boolean>('__game.ui.layers.length === 0')) break;
    if (presses > 80) throw new Error('the opening\'s boxes did not close');
    await page.press('Enter');
    await sleep(150);
  }

  // the switch in the menu: to the synth and back, the page never reloads
  await page.eval('window.__musicMark = 1');
  await page.eval(`__game.ui.handle('menu')`);
  await page.tap('.menu-list button', 'Music: real instruments');
  await page.waitFor(`${SOUND}.source === 'synth' && ${SOUND}.playing?.source === 'synth'`, 'the synth to take the routine', 5_000);
  await page.waitFor(`[...document.querySelectorAll('.menu-list button')].some((b) => b.textContent === 'Music: synth')`, 'the row to read synth', 5_000);
  const kept = await page.eval<string | null>(`localStorage.getItem('openfold.music.1')`);
  if (!kept?.includes('synth')) throw new Error(`the choice is not kept on the device: ${kept}`);
  await page.tap('.menu-list button', 'Music: synth');
  await page.waitFor(`${SOUND}.source === 'real' && ${SOUND}.playing?.source === 'real'`, 'the real instruments to come back', 10_000);
  if ((await page.eval<number | undefined>('window.__musicMark')) !== 1) throw new Error('the page reloaded at the switch');
  await page.press('Escape');
  console.log('music: the switch flipped to the synth and back without a reload, and is kept on the device');

  // after dark outside the town: the night piece, and its file only now
  if (await page.eval<boolean>(`__game.bundle.map.ground[__game.session.state.player.at[1]][__game.session.state.player.at[0]] === '='`)) {
    throw new Error('the wake is in town: this script needs it outside');
  }
  await page.eval(`(() => {
    const s = __game.session, day = __game.bundle.params.day_length_ms, q = Math.floor(day / 2);
    let t = s.tick - ((s.tick + q) % day) + Math.round((22 / 24) * day);
    if (t < s.tick) t += day;
    s.tick = t;
  })()`);
  await page.waitFor(`${SOUND}.song === 'night' && ${SOUND}.playing?.state === 'night'`, 'the night piece outside the town after dark', 10_000);
  await page.waitFor(`${MUSIC_FETCHED}.includes('night.ogg')`, 'the night file to be fetched', 10_000);
  console.log(`music: the night piece came outside the town after dark; fetched ${(await page.eval<Sound>(SOUND)).fetched.join(', ')}`);

  const bytes = await page.eval<{ name: string; bytes: number }[]>(`performance.getEntriesByType('resource').filter((e) => e.name.includes('/music/')).map((e) => ({ name: e.name.split('/').pop(), bytes: e.encodedBodySize }))`);
  console.log(`music: fetched after play began: ${bytes.map((b) => `${b.name} ${b.bytes} B`).join(', ')}`);
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
    console.log('music: passed');
  } catch (error) {
    await page.screenshot(join(OUT, 'music-failed.png')).catch(() => undefined);
    throw error;
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
