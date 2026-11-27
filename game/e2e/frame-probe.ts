/**
 * What the frame-time walks share (west-stutter.ts, valley-walk.ts): a static server over a build, the title-to-wake taps, and the
 * recorder that runs in the page. Moved out of west-stutter.ts so the two tools measure with the same pieces.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { sleep, type Page } from './cdp';
import { carveIn, seedQuery, type WakePocket } from './wakes';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

/** Serves a build at the root of a port on this machine. */
export function serve(dist: string): Promise<{ server: Server; url: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')).replace(/^(\.\.[/\\])+/, '');
      let file = join(dist, path);
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!file.startsWith(dist) || !existsSync(file)) {
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

/** From the title to a woken character in a pocket (the seed draws it), the name cut, every box tapped away. */
export async function wake(page: Page, url: string, pocket: WakePocket = 'core/west-bank'): Promise<void> {
  await page.goto(`${url}?debug${seedQuery(pocket)}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 60_000);
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Human');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the character to wake', 20_000);
  await page.eval(carveIn('Tess'));
  await closeBoxes(page);
}

/** Presses Enter until no dialog is open (thirty at most). */
export async function closeBoxes(page: Page): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const open = await page.eval<boolean>(`!!document.querySelector('.dialog')`);
    if (!open) break;
    await page.press('Enter');
    await sleep(80);
  }
}

/**
 * In the page: records every requestAnimationFrame interval with the feet's tile and the game's clock, the long tasks, and (when the
 * world has a chunk painter) the strip job and the page upload, each timed where it stands so a slow frame can be matched to them.
 * Stop it with `window.__stutterStop = 1`. The hooks on the chunk painter are skipped on a build that has none (an older deployed one).
 */
export const START = `(() => {
  const S = window.__stutter = { t: [], at: [], tile: [], game: [], long: [], bake: [], t0: performance.now() };
  let last = performance.now();
  const f = (now) => {
    if (window.__stutterStop) return;
    S.t.push(now - last); S.at.push(now - S.t0);
    const b = window.__game.world.body; S.tile.push([Math.floor(b.x / 64), Math.floor(b.y / 64)]);
    S.game.push(window.__game.session.tick);
    last = now; requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
  const chunks = window.__game.world.chunks;
  if (chunks) for (const name of ['bakeUnit', 'upload']) {
    if (typeof chunks[name] !== 'function') continue;
    const orig = chunks[name].bind(chunks);
    chunks[name] = (...args) => { const t = performance.now(); const r = orig(...args); S.bake.push([name, Math.round(t - S.t0), +(performance.now() - t).toFixed(1)]); return r; };
  }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) S.long.push([Math.round(e.startTime - S.t0), Math.round(e.duration)]); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  return 1;
})()`;
