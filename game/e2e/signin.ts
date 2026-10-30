/**
 * Plays the sign-in in a real browser against the REAL sign-in handler (`createSignIn`,
 * server/src/auth/signin.ts) in front of the game wire, on one origin (game/test/signin-box.ts): the
 * title's sign-in screen, a Google round through the real provider, the neutral age screen with its
 * under-age refusal that keeps the demo open, the email link read from the mail, the fresh notice of the
 * opening handover (NEXT 18 d), and a game that lives on the server - the start goes over the wire, and a
 * reload continues the same character from the server's state.
 *
 * What a browser decides is left to the browser (the 27.10 security review, findings 1, 2 and 4): the
 * Origin of the link page's POST under its referrer policy, whether CSP `form-action` lets the confirm's 303
 * through, and which cookies ride the game's own calls. The script asserts on what the server saw and
 * answered, and on where the page landed; the session cookie is httpOnly and is never read by script.
 *
 * The run builds its own copy of the game with an empty VITE_GAME_SERVER, so every wire and sign-in call
 * goes to the origin the page came from: the game served beside the API on one origin, as the box runs it.
 * The other e2e runs keep playing the demo build in game/dist, untouched.
 *
 *   pnpm build && pnpm e2e [out-dir]
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer, type RequestListener, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Bundle } from '@game/kernel';
import { widenSeed } from '@game/kernel';

import { Browser, sleep, type Page } from './cdp';
import { SignInBox, type Seen } from '../test/signin-box';
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

function listen(handler: RequestListener): Promise<{ server: Server; origin: string }> {
  return new Promise((ok) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      ok({ server, origin: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}` });
    });
  });
}

/** One origin: the real sign-in and the game wire, then the built game itself. */
async function serve(box: SignInBox): Promise<{ server: Server; origin: string }> {
  const served = await listen((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    void box
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
  // the redirects and the mailed link are built on the origin, so the sign-in opens once the port is known
  box.open(served.origin);
  return served;
}

/** Another origin on the same machine: a page that posts a sign-in link's token to the box's confirm. */
function serveStranger(target: string): Promise<{ server: Server; origin: string }> {
  return listen((req, res) => {
    const token = new URL(req.url ?? '/', 'http://localhost').searchParams.get('token') ?? '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      res.writeHead(400).end('no token');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      '<!doctype html><html lang="en"><meta charset="utf-8"><title>Another site</title>' +
        `<form method="post" action="${target}/auth/email/confirm"><input type="hidden" name="token" value="${token}"><button type="submit">Claim the link</button></form></html>`,
    );
  });
}

function assert(condition: boolean, what: string): void {
  if (!condition) throw new Error(`expected ${what}`);
}

/** The last request the box saw on a path; fails when there was none. */
function last(box: SignInBox, method: string, path: string): Seen {
  const seen = box.seenOn(method, path).at(-1);
  assert(seen !== undefined, `a ${method} ${path} at the server`);
  return seen!;
}

/** The first request on a path once the server has seen it: the browser sends some on its own time. */
async function seenFirst(box: SignInBox, method: string, path: string): Promise<Seen> {
  const end = Date.now() + 15_000;
  while (box.seenOn(method, path).length === 0) {
    if (Date.now() > end) throw new Error(`timed out waiting for a ${method} ${path} at the server`);
    await sleep(40);
  }
  return box.seenOn(method, path)[0]!;
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

async function play(browser: Browser, origin: string, stranger: string, box: SignInBox, bundle: Bundle): Promise<void> {
  const url = `${origin}/`;
  const page = await browser.newPage({ width: 1280, height: 800, mobile: false });
  const log = (msg: string) => console.log(`[signin] ${msg}`);
  // any request the browser itself blocked (a CSP form-action on the confirm's redirect would show here)
  const blocked: string[] = [];
  await page.send('Network.enable');
  page.on('Network.loadingFailed', (p) => {
    if (p.blockedReason) blocked.push(`${String(p.blockedReason)} ${String(p.errorText ?? '')}`);
  });

  // 1. the title offers a sign-in next to the demo
  await page.goto(`${url}?debug`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 30_000);
  let buttons = await titleButtons(page);
  assert(buttons.includes('New game') && buttons.includes('Sign in') && !buttons.includes('Continue'), `New game and Sign in on the title, got ${buttons.join(', ')}`);
  const note = await page.eval<string>(`document.querySelector('.demo-note').textContent`);
  assert(note.includes('Sign in to keep your valley'), `the note points at the sign-in, got "${note}"`);
  // the title's probe went over the wire without a session and was answered 401
  const unsigned = await seenFirst(box, 'POST', '/session');
  assert(unsigned.status === 401 && unsigned.account === undefined, `the probe without a session answered 401, got ${JSON.stringify(unsigned)}`);
  log('the title offers a sign-in');

  // 2. the sign-in box: a Google button and an email link
  await page.tap('.title-screen button', 'Sign in');
  await page.waitFor(`!!document.querySelector('.panel.signup')`, 'the sign-up box');
  const offers = await page.eval<string[]>(`[...document.querySelectorAll('.panel.signup button')].map((b) => b.textContent.trim())`);
  assert(offers.includes('Continue with Google') && offers.includes('Send me a link'), `Google and an email link in the box, got ${offers.join(', ')}`);
  assert(await page.eval<boolean>(`!!document.querySelector('.panel.signup input[type="email"]')`), 'an email field');
  log('the box offers Google and an email link');

  // 3. Google, under-age: the real provider's round, then the neutral age screen refuses and keeps the demo open
  await page.tap('.panel.signup button', 'Continue with Google');
  await page.waitFor(`!!document.querySelector('.panel.signup select[aria-label="Day"]')`, 'the sign-up form back from Google', 30_000);
  const callback = last(box, 'GET', '/auth/google/callback');
  assert(callback.status === 303 && callback.location === `${origin}/#signin=signup`, `the callback sent the browser to the sign-up, got ${JSON.stringify(callback)}`);
  assert(box.google.exchanges.length === 1, 'the real provider exchanged the code once');
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
  const refused = last(box, 'POST', '/auth/signup');
  assert(refused.status === 403 && refused.origin === origin, `the sign-up refused for the age, from the game's origin, got ${JSON.stringify(refused)}`);
  assert(box.store.accounts.size === 0 && box.store.tickets.size === 0 && box.store.sessions.size === 0, 'no account, no ticket and no session for the refused sign-up');
  log('the real Google round led to the neutral age screen, which refuses under-age and points to the demo');
  await page.tap('.panel.signup a', 'Back to the demo');
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title again', 30_000);
  // the next player comes in another browser: this one is held to its age refusal for a day
  await page.send('Network.clearBrowserCookies');

  // 4. the email link, asked for from the game; the link is read from the mail the sign-in sent
  await page.tap('.title-screen button', 'Sign in');
  await page.waitFor(`!!document.querySelector('.panel.signup input[type="email"]')`, 'the sign-up box');
  await page.tap('.panel.signup input[type="email"]');
  await page.type('tess@example.com');
  await page.tap('.panel.signup button', 'Send me a link');
  await page.waitFor(`document.querySelector('.panel.signup .error')?.textContent.includes('a link is on its way')`, 'the link notice');
  const start = last(box, 'POST', '/auth/email/start');
  assert(start.status === 202 && start.origin === origin, `the link asked for from the game's origin, got ${JSON.stringify(start)}`);
  const link = box.linkFor('tess@example.com');
  assert(link !== undefined && link.startsWith(`${origin}/auth/email/link#token=`), `a mailed link on the box's origin, got ${link}`);
  const token = new URL(link!).hash.slice('#token='.length);

  // 5. the negative: the token posted from a page on another origin is refused, the link stays unspent
  await page.goto(`${stranger}/?token=${token}`);
  await page.tap('button', 'Claim the link');
  await page.waitFor(`location.origin === ${JSON.stringify(origin)} && location.hash === '#signin=origin' && !!document.querySelector('.title-screen button')`, 'the game, told the post came from elsewhere', 30_000);
  const foreign = last(box, 'POST', '/auth/email/confirm');
  assert(foreign.origin === stranger && foreign.status === 303 && foreign.location === `${origin}/#signin=origin`, `requireOrigin refused the stranger's post, got ${JSON.stringify(foreign)}`);
  assert([...box.store.links.values()].every((l) => l.usedAt === undefined), 'the link was not spent by the refused post');
  assert(box.store.sessions.size === 0 && box.store.tickets.size === 0, 'no session and no ticket from the refused post');
  log(`a post of the token from ${stranger} was refused (origin), and the link stayed unspent`);

  // 6. finding 1: the link page's own button posts with the box's origin and is accepted;
  //    finding 2: the confirm's 303 reaches the game under the page's CSP form-action, and the sign-up box opens
  await page.goto(link!);
  await page.waitFor(`!!document.querySelector('button:not([disabled])')`, 'the link page with its button');
  assert(await page.eval<boolean>(`location.hash === '' && !location.href.includes(${JSON.stringify(token)})`), 'the token gone from the address bar');
  await page.tap('button', 'Sign in to Loomvale');
  await page.waitFor(`!!document.querySelector('.panel.signup select[aria-label="Day"]')`, 'the sign-up form back from the email link', 30_000);
  const landed = await page.eval<string>(`location.href`);
  assert(landed === `${origin}/#signin=signup`, `the browser landed on the game's sign-up, got ${landed}`);
  const confirm = last(box, 'POST', '/auth/email/confirm');
  assert(confirm.origin === origin && confirm.status === 303 && confirm.location === `${origin}/#signin=signup`, `the link page's POST accepted, got ${JSON.stringify(confirm)}`);
  assert([...box.store.links.values()].every((l) => l.usedAt !== undefined), 'the link spent by its own page');
  assert(blocked.length === 0, `nothing blocked by the browser, got ${blocked.join(' | ')}`);
  log('the link page posted with its own origin, was accepted, and its 303 reached #signin=signup');
  await fillSignup(page, 'Tess', '2000');
  await page.waitFor(`document.querySelector('.panel.signup')?.textContent.includes('Your account starts fresh')`, 'the fresh notice', 30_000);
  const made = last(box, 'POST', '/auth/signup');
  assert(made.status === 201 && made.origin === origin, `the sign-up made the account, got ${JSON.stringify(made)}`);
  const account = box.account('tess@example.com');
  assert(account !== undefined && account.name === 'Tess', `the account row for tess@example.com, got ${JSON.stringify(account)}`);
  assert(box.store.games.get(account!.id)?.record.state.player.race === '', 'no game yet: the account holds the state before the start');
  log('the email link made the account, fresh, with the one-line notice');
  await page.tap('.panel.signup button', 'Continue');

  // 7. finding 4: a signed-in title, and the game starts over the wire with the session cookie on every call
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title after the sign-up', 30_000);
  // the sign-up's Continue dropped the ?debug query: one more load brings the test hook back
  await page.goto(`${url}?debug`);
  await page.waitFor(`[...document.querySelectorAll('.title-screen button')].map((b) => b.textContent.trim()).join() === 'New game'`, 'the signed-in title', 30_000);
  const probe = last(box, 'POST', '/session');
  assert(probe.status === 200 && probe.account === account!.id && probe.origin === origin, `the probe resolved to the account, got ${JSON.stringify(probe)}`);
  buttons = await titleButtons(page);
  assert(buttons.join() === 'New game', `only New game for a fresh account, got ${buttons.join(', ')}`);
  const signedNote = await page.eval<string>(`document.querySelector('.demo-note').textContent`);
  assert(signedNote.includes('Your game lives on the server'), `the note names the server, got "${signedNote}"`);
  await page.tap('.title-screen button', 'New game');
  await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards');
  const cards = await page.eval<number>(`document.querySelectorAll('.card.race').length`);
  assert(cards === 3, `three race cards, got ${cards}`);
  await page.tap('.card.race');
  // the title has no name field: the name is cut on the stone at the bridge
  assert(await page.eval<boolean>(`!document.querySelector('.title-screen input')`), 'no name field on the choice of character');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor(`!!window.__game && window.__game.session && window.__game.session.state.player.race`, 'the world on the server', 30_000);
  const started = await sessionOf(page);
  const firstRace = Object.keys(bundle.races).sort()[0];
  const wire = box.wires.get(account!.id);
  assert(started.race === firstRace && started.name === '' && started.remote, `${started.race} "${started.name}" on the wire, remote=${started.remote}`);
  assert(wire !== undefined && wire.state.player.name === '' && wire.state.player.race === firstRace, "the account's game on the server, started, with no name yet");
  log(`the new game started over the wire as ${started.race}, remote`);
  // the stone's carve is the one action that names the character; over the wire it is kept like any other
  const carved = await page.eval<{ ok: boolean }>(`window.__game.session.act({ t: 'carve', name: 'Tess' })`);
  assert(carved.ok && wire!.state.player.name === 'Tess', 'the carved name reaches the server');
  const action = last(box, 'POST', '/action');
  assert(action.status === 200 && action.account === account!.id && action.origin === origin, `POST /action carried the session, got ${JSON.stringify(action)}`);
  const state = await page.eval<{ status: number; name: string }>(`fetch('/state').then(async (r) => ({ status: r.status, name: (await r.json()).state.player.name }))`);
  const read = last(box, 'GET', '/state');
  assert(state.status === 200 && state.name === 'Tess' && read.account === account!.id, `GET /state from the game page carried the session, got ${JSON.stringify(state)} ${JSON.stringify(read)}`);
  log('GET /state and POST /action from the game page carried the session cookie and were answered 200');
  started.name = 'Tess';

  // 8. a reload continues the same game from the server, no save in the browser
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

  // 9. the page stayed quiet: no exception, no console error
  await page.eval(`new Promise((r) => setTimeout(r, 300))`);
  assert(page.errors.length === 0, `a quiet page, got: ${page.errors.join(' | ')}`);
  log('the page stayed quiet');
}

async function main(): Promise<void> {
  if (!existsSync(join(GAME_DIR, 'src', 'generated', 'bundle.json'))) throw new Error('no bundle: run "pnpm bundle" first');
  console.log('[signin] building the game with VITE_GAME_SERVER empty (the wire on its own origin)');
  buildSignInDist();
  const bundle = loadBundle();
  const box = new SignInBox(bundle, { now: () => NOW, secretSeed: () => widenSeed(7) });
  const { server, origin } = await serve(box);
  const stranger = await serveStranger(origin);
  const browser = await Browser.launch();
  try {
    await play(browser, origin, stranger.origin, box, bundle);
  } finally {
    await browser.close();
    server.close();
    stranger.server.close();
  }
  console.log(`[signin] done (screenshots, when kept, in ${OUT})`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
