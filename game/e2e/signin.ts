/**
 * Plays the sign-in in a real browser against the fake server (game/test/fake-server.ts and
 * game/test/fake-auth.ts): the title's sign-in screen, Google's fake OAuth round, the neutral age screen
 * with its under-age refusal that keeps the demo open, the email link, the fresh notice of the opening
 * handover (NEXT 18 d), and a game that lives on the server - the start goes over the wire, and a reload
 * continues the same character from the server's state.
 *
 * The run builds its own copy of the game with an empty VITE_GAME_SERVER, so every wire call goes to the
 * same origin the fake serves: the release build names the same URL when the game sits next to the
 * server. The other e2e runs keep playing the demo build in game/dist, untouched.
 *
 *   pnpm build && pnpm e2e [out-dir]
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Bundle } from '@game/kernel';

import { Browser, type Page } from './cdp';
import { FakeAuthServer } from '../test/fake-auth';
import { loadBundle } from '../../tools/test/helpers/world';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(GAME_DIR, '..', '.scratch', 'e2e'));
// in .scratch (git and linter ignore it, and the site's copy of game/dist never sees it)
const SIGNIN_DIST = join(GAME_DIR, '..', '.scratch', 'signin-dist');

// 1 June 2026: a fixed "today" for the age gate, so 2015 is under the consent age and 2000 is not
const NOW = Date.UTC(2026, 5, 1);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

/** The game with the server URL baked in: an empty VITE_GAME_SERVER names the game's own origin. */
function buildSignInDist(): void {
  // through pnpm: vite is the game package's own, not on the PATH a runner starts the e2e with
  execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', SIGNIN_DIST], {
    cwd: GAME_DIR,
    env: { ...process.env, VITE_GAME_SERVER: '' },
    stdio: 'inherit',
  });
}

/** One server: the fake sign-in and the game wire, then the built game itself. */
function serve(auth: FakeAuthServer): Promise<{ server: Server; url: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      void auth
        .handle(req, res, url)
        .then((handled) => {
          if (handled) return;
          const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
          let file = join(SIGNIN_DIST, path);
          if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
          if (!file.startsWith(SIGNIN_DIST) || !existsSync(file)) {
            res.writeHead(404).end('not found');
            return;
          }
          res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
          createReadStream(file).pipe(res);
        })
        .catch((error: unknown) => {
          console.error(error);
          res.writeHead(500).end();
        });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      ok({ server, url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/` });
    });
  });
}

function assert(condition: boolean, what: string): void {
  if (!condition) throw new Error(`expected ${what}`);
}

/** The buttons the title shows now, in order. */
const titleButtons = (page: Page) => page.eval<string[]>(`[...document.querySelectorAll('.title-screen button')].map((b) => b.textContent.trim())`);

/** The game's session, once the world is on screen. */
const sessionOf = (page: Page) =>
  page.eval<{ race: string; name: string; remote: boolean; pos: [number, number] }>(`(() => {
    const s = window.__game.session;
    return { race: s.state.player.race, name: s.state.player.name, remote: 'version' in s, pos: [s.pos[0], s.pos[1]] };
  })()`);

/** Fill the neutral age screen: the date fields and the one-account yes, as the form reads them. */
async function fillSignup(page: Page, name: string, year: string): Promise<void> {
  await page.tap('.panel.signup input.name');
  await page.type(name);
  await page.eval(`(() => {
    const set = (q, v) => { const el = document.querySelector(q); el.value = v; el.dispatchEvent(new Event('change')); };
    set('select[aria-label="Day"]', '7');
    set('select[aria-label="Month"]', '5');
    document.querySelector('input[aria-label="Year"]').value = ${JSON.stringify(year)};
    document.querySelector('.panel.signup input[type="checkbox"]').checked = true;
  })()`);
  await page.tap('.panel.signup button', 'Make my account');
}

async function play(browser: Browser, url: string, auth: FakeAuthServer, bundle: Bundle): Promise<void> {
  const page = await browser.newPage({ width: 1280, height: 800, mobile: false });
  const log = (msg: string) => console.log(`[signin] ${msg}`);

  // 1. the title offers a sign-in next to the demo
  await page.goto(`${url}?debug`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  let buttons = await titleButtons(page);
  assert(buttons.includes('New game') && buttons.includes('Sign in') && !buttons.includes('Continue'), `New game and Sign in on the title, got ${buttons.join(', ')}`);
  const note = await page.eval<string>(`document.querySelector('.demo-note').textContent`);
  assert(note.includes('Sign in to keep your valley'), `the note points at the sign-in, got "${note}"`);
  log('the title offers a sign-in');

  // 2. the sign-in box: a Google button and an email link
  await page.tap('.title-screen button', 'Sign in');
  await page.waitFor(`!!document.querySelector('.panel.signup')`, 'the sign-up box');
  const offers = await page.eval<string[]>(`[...document.querySelectorAll('.panel.signup button')].map((b) => b.textContent.trim())`);
  assert(offers.includes('Continue with Google') && offers.includes('Send me a link'), `Google and an email link in the box, got ${offers.join(', ')}`);
  assert(await page.eval<boolean>(`!!document.querySelector('.panel.signup input[type="email"]')`), 'an email field');
  log('the box offers Google and an email link');

  // 3. Google, under-age: the neutral age screen refuses and keeps the demo open
  await page.tap('.panel.signup button', 'Continue with Google');
  await page.waitFor(`!!document.querySelector('.panel.signup select[aria-label="Day"]')`, 'the sign-up form back from Google', 30_000);
  const neutral = await page.eval<{ day: string; month: string; year: string; text: string }>(`(() => {
    const box = document.querySelector('.panel.signup');
    // the text a player reads, without the select option lists (the neutral screen's criterion)
    const clone = box.cloneNode(true);
    clone.querySelectorAll('select, option').forEach((n) => n.remove());
    return {
      day: box.querySelector('select[aria-label="Day"]').value,
      month: box.querySelector('select[aria-label="Month"]').value,
      year: box.querySelector('input[aria-label="Year"]').value,
      text: clone.innerText,
    };
  })()`);
  assert(neutral.day === '' && neutral.month === '' && neutral.year === '', 'day, month and year with no default');
  assert(!/\b(age|years? old)\b/i.test(neutral.text) && !neutral.text.includes('13'), `no age text before the answer, got "${neutral.text}"`);
  await fillSignup(page, 'Kid', '2015');
  await page.waitFor(`[...document.querySelectorAll('.panel.signup a')].some((a) => a.textContent.includes('Back to the demo'))`, 'the under-age refusal', 30_000);
  assert(!auth.signedIn && auth.account === undefined, 'no account for the refused sign-up');
  log('the neutral age screen refuses under-age and points to the demo');
  await page.tap('.panel.signup a', 'Back to the demo');
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title again', 30_000);

  // 4. the email link: the account starts fresh, with the one-line notice
  await page.tap('.title-screen button', 'Sign in');
  await page.waitFor(`!!document.querySelector('.panel.signup input[type="email"]')`, 'the sign-up box');
  await page.tap('.panel.signup input[type="email"]');
  await page.type('tess@example.com');
  await page.tap('.panel.signup button', 'Send me a link');
  await page.waitFor(`document.querySelector('.panel.signup .error')?.textContent.includes('a link is on its way')`, 'the link notice');
  const token = auth.linkFor('tess@example.com');
  assert(token !== undefined, `the fake sent a link to that address, got ${JSON.stringify([...auth.links.entries()])}`);
  await page.goto(`${url}auth/email/link?token=${token}`);
  await page.waitFor(`document.body.textContent.includes('Sign in to Openfold')`, 'the link page');
  await page.tap('button', 'Sign in to Openfold');
  await page.waitFor(`!!document.querySelector('.panel.signup select[aria-label="Day"]')`, 'the sign-up form back from the email link', 30_000);
  await fillSignup(page, 'Tess', '2000');
  await page.waitFor(`document.querySelector('.panel.signup')?.textContent.includes('Your account starts fresh')`, 'the fresh notice', 30_000);
  assert(auth.account !== undefined && auth.account.email === 'tess@example.com' && auth.signedIn, 'the account is made and the browser signed in');
  assert(auth.wire.state.player.race === '', 'no game yet: the wire holds the state before the start');
  log('the email link made the account, fresh, with the one-line notice');
  await page.tap('.panel.signup button', 'Continue');

  // 5. a signed-in title: New game only, and the game starts over the wire
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title after the sign-up', 30_000);
  // the sign-up's Continue dropped the ?debug query: one more load brings the test hook back
  await page.goto(`${url}?debug`);
  await page.waitFor(`[...document.querySelectorAll('.title-screen button')].map((b) => b.textContent.trim()).join() === 'New game'`, 'the signed-in title', 30_000);
  buttons = await titleButtons(page);
  assert(buttons.join() === 'New game', `only New game for a fresh account, got ${buttons.join(', ')}`);
  const signedNote = await page.eval<string>(`document.querySelector('.demo-note').textContent`);
  assert(signedNote.includes('Your game lives on the server'), `the note names the server, got "${signedNote}"`);
  await page.tap('.title-screen button', 'New game');
  await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards');
  const cards = await page.eval<number>(`document.querySelectorAll('.card.race').length`);
  assert(cards === 3, `three race cards, got ${cards}`);
  await page.tap('.card.race');
  await page.tap('input.name');
  await page.type('Tess');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor(`!!window.__game && window.__game.session && window.__game.session.state.player.race`, 'the world on the server', 30_000);
  const started = await sessionOf(page);
  const firstRace = Object.keys(bundle.races).sort()[0];
  assert(started.race === firstRace && started.name === 'Tess' && started.remote, `${started.race} "${started.name}" on the wire, remote=${started.remote}`);
  assert(auth.wire.state.player.name === 'Tess' && auth.wire.state.player.race === firstRace, 'the server holds the started game');
  log(`the new game started over the wire as ${started.race}, remote`);

  // 6. a reload continues the same game from the server, no save in the browser
  const pos = started.pos;
  await page.goto(`${url}?debug`);
  await page.waitFor(`[...document.querySelectorAll('.title-screen button')].map((b) => b.textContent.trim()).join() === 'Continue'`, "the started account's title", 30_000);
  buttons = await titleButtons(page);
  assert(buttons.join() === 'Continue', `only Continue for a started account, got ${buttons.join(', ')}`);
  await page.tap('.title-screen button', 'Continue');
  await page.waitFor(`!!window.__game && window.__game.session && window.__game.session.state.player.race`, 'the world again', 30_000);
  const again = await sessionOf(page);
  assert(again.race === started.race && again.name === started.name && again.pos.join() === pos.join() && again.remote, 'the reload continues the same remote game');
  log(`a reload continued ${again.race} "${again.name}" at ${again.pos.join(',')} from the server`);

  // 7. the page stayed quiet: no exception, no console error
  await page.eval(`new Promise((r) => setTimeout(r, 300))`);
  assert(page.errors.length === 0, `a quiet page, got: ${page.errors.join(' | ')}`);
  log('the page stayed quiet');
}

async function main(): Promise<void> {
  if (!existsSync(join(GAME_DIR, 'src', 'generated', 'bundle.json'))) throw new Error('no bundle: run "pnpm bundle" first');
  console.log('[signin] building the game with VITE_GAME_SERVER empty (the wire on its own origin)');
  buildSignInDist();
  const bundle = loadBundle();
  const auth = new FakeAuthServer(bundle, { now: () => NOW, secretSeed: () => 7 });
  const { server, url } = await serve(auth);
  const browser = await Browser.launch();
  try {
    await play(browser, url, auth, bundle);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`[signin] done (screenshots, when kept, in ${OUT})`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
