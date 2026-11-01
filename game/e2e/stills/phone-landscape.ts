/**
 * Makes the still of the landscape controls in the shipped skin, B (the owner's pick of 1.11 from three; DECISIONS
 * 2026-11-01). Not a test, and in no e2e group: run it by hand after `pnpm build`.
 *
 *   tsx game/e2e/stills/phone-landscape.ts <out-dir> [date]
 *
 * The frame: the valley by day, the player mid-walk under a held stick, a 2K phone on its side (800 by 360 CSS px
 * at 3x, so 2400 by 1080), shot from one paused moment, with the density of the buttons as the page draws them.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser } from '../cdp';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
import { TAKE_GROUND, carveIn, seedQuery } from '../wakes';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(GAME_DIR, 'dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

/**
 * The density as the page draws the frame, in CSS px and in the still's own pixels (3 a CSS px): the edge gaps
 * between A and B, B and Sneak, and the column's neighbours, against a fifth of the smaller button, and A's center
 * from the right and the bottom edge, against 0.19 H.
 */
const DENSITY = `(() => {
  const c = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, d: r.width }; };
  const gap = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) - (p.d + q.d) / 2;
  const [a, b, s, bag, journal, menu] = ['.tbtn.a', '.tbtn.b', '.tbtn.sneak', '.tbtn.bag', '.tbtn.journal', '.tbtn.menu'].map(c);
  const H = innerHeight, r1 = (n) => Math.round(n * 10) / 10;
  const rows = {
    'A-B gap': [gap(a, b), 0.2 * Math.min(a.d, b.d)],
    'B-Sneak gap': [gap(b, s), 0.2 * Math.min(b.d, s.d)],
    'Bag-Journal gap': [gap(bag, journal), 0.2 * Math.min(bag.d, journal.d)],
    'Journal-Menu gap': [gap(journal, menu), 0.2 * Math.min(journal.d, menu.d)],
    'A center from the right': [innerWidth - a.x, 0.19 * H],
    'A center from the bottom': [H - a.y, 0.19 * H],
  };
  return Object.fromEntries(Object.entries(rows).map(([k, [got, want]]) => [k, { css: r1(got), still: r1(got * devicePixelRatio), want: r1(want), wantStill: r1(want * devicePixelRatio) }]));
})()`;

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

async function main(): Promise<void> {
  const out = resolve(process.argv[2] ?? '.scratch/stills');
  const date = process.argv[3] ?? '2026-10-30';
  mkdirSync(out, { recursive: true });
  const local = await serve();
  const browser = await Browser.launch();
  try {
    {
      const page = await browser.newPage({ width: 800, height: 360, mobile: true, scale: 3 });
      try {
        await page.goto(`${local.url}?debug&rich=all${seedQuery('core/west-bank')}`);
        await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 60_000);
        await page.tap('.title-screen button', 'New game');
        const choice = await page.waitFor<string>(
          `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
          'the race cards',
        );
        if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
        await page.tap('.card.race', 'Elf');
        await page.tap('.title-screen button', 'Wake up');
        await page.waitFor('!!window.__game.session && window.__game.session.started', 'the character to wake', 20_000);
        await page.eval(carveIn('Tess'));
        await page.eval(TAKE_GROUND);
        for (let i = 0; i < 12 && (await page.eval<boolean>(`!!document.querySelector('#ui > .layer')`)); i++) await page.tap('.tbtn.a');
        await page.waitFor(`!document.querySelector('#ui > .layer')`, 'the waking lines to close', 20_000);
        await page.waitFor(`document.querySelectorAll('.toasts > *').length === 0`, 'the opening toasts to leave', 30_000);
        // mid-walk: the thumb holds the stick, pushed right and a little down
        const at = { x: 190, y: 250 };
        await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at, id: 1 }] });
        await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x + 44, y: at.y + 10, id: 1 }] });
        await page.waitFor(`!!__game.world.body.moving`, 'the walk', 5000);
        // one paused moment: the game holds still for the shot
        await sleep(400);
        await page.eval('__game.world.game.loop.sleep()');
        // a toast keeps its own clock while the game sleeps: the shots wait for it to leave, so none goes mid-set
        await page.waitFor(`document.querySelectorAll('.toasts > *').length === 0`, 'the toasts to leave', 30_000);
        const file = join(out, `${date}-phone-landscape-B.png`);
        await page.screenshot(file);
        console.log(`B: ${file}`);
        console.log(`density: ${JSON.stringify(await page.eval(DENSITY))}`);
        await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } finally {
        page.close();
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
    local.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
