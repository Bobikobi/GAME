/**
 * Makes the owner's three stills of the landscape controls' skin (the owner, 30.10: "design the joysticks to the
 * general theme and show me options for approval"). Not a test, and in no e2e group: run it by hand after
 * `pnpm build`.
 *
 *   tsx game/e2e/stills/phone-landscape.ts <out-dir> [date]
 *
 * The same frame for each: the valley by day, the player mid-walk under a held stick, a 2K phone on its side
 * (800 by 360 CSS px at 3x, so 2400 by 1080). Only the skin differs; the layout is the shipped one. The skins are
 * laid over the shipped plain look here, in the page, and none of them ships until the owner picks one.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser } from '../cdp';
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

const L = 'body.touch-on.landscape';
// the gold ramp and the blacks of theme.css, by name, so a skin is one of frame D's own colours
const SVG = (body: string, size = 132) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`)}")`;

/** A tick on the compass ring at each of the four ways, in the gold. */
const TICKS = SVG(
  [0, 90, 180, 270]
    .map((a) => `<path transform='rotate(${a} 66 66)' d='M66 5 L72 17 L66 14 L60 17 Z' fill='#c9a96a' stroke='#4d3c22' stroke-width='1'/>`)
    .join('') + `<circle cx='66' cy='66' r='44' fill='none' stroke='#4d3c22' stroke-width='1'/>`,
);
/** The lacquer gem: a cut stone on its point, gold-set, one facet lit. */
const GEM = SVG(
  `<path d='M28 4 L52 28 L28 52 L4 28 Z' fill='#131220' stroke='#c9a96a' stroke-width='3'/><path d='M28 14 L42 28 L28 42 L14 28 Z' fill='#1b1a2e' stroke='#7a5f33' stroke-width='1.5'/><path d='M28 14 L42 28 L28 28 Z' fill='#2a2114'/><circle cx='28' cy='28' r='3' fill='#e8d4a2'/>`,
  56,
);

const SKINS: Record<string, string> = {
  // A: lacquer disc with a thin antique-gold rim; the knob a smaller lacquer disc with a gold dot; gold glyphs
  A: `
    ${L} .stick { background: rgb(19 18 32 / 0.78); border: 1px solid var(--ui-gold-4); }
    ${L} .stick-knob { width: calc(var(--knob) * 0.9); height: calc(var(--knob) * 0.9); background: var(--ui-black); border: 1px solid var(--ui-gold-4); display: grid; place-items: center; }
    ${L} .stick-knob::after { content: ''; width: 26%; height: 26%; border-radius: 50%; background: var(--ui-gold-5); }
    ${L} .tbtn { background: var(--ui-black); border: 1px solid var(--ui-gold-4); color: var(--ui-gold-5); }
    ${L} .tbtn.a { color: var(--ui-gold-6); }
  `,
  // B: an open gold ring, no filled disc; the knob a gold-rimmed lacquer coin; buttons gold-rimmed coins, the glyph cut in gold
  B: `
    ${L} .stick { background: none; border: 3px solid var(--ui-gold-5); box-shadow: 0 0 0 1px var(--ui-gold-2), inset 0 0 0 1px var(--ui-gold-2); }
    ${L} .stick-knob { background: var(--ui-black); border: 3px solid var(--ui-gold-5); box-shadow: inset 0 0 0 4px var(--ui-black), inset 0 0 0 5px var(--ui-gold-3), 0 3px 0 rgb(12 11 18 / 0.5); }
    ${L} .tbtn { background: var(--ui-black); border: 3px solid var(--ui-gold-5); box-shadow: inset 0 0 0 4px var(--ui-black), inset 0 0 0 5px var(--ui-gold-3), 0 3px 0 rgb(12 11 18 / 0.5);
      color: var(--ui-gold-5); text-shadow: 0 -1px 0 var(--ui-gold-1), 0 1px 0 var(--ui-gold-6); font-family: var(--ui-display); font-weight: 700; }
    ${L} .tbtn.nav, ${L} .tbtn.sneak { font-family: var(--font-body); font-weight: 400; font-size: 16px; }
  `,
  // C: a compass-rose stick, four gold ticks on the ring; the knob a lacquer gem; buttons as frame D's corner ornament in miniature,
  // drawn inside the round hit target so no two touch
  C: `
    ${L} .stick { background: ${TICKS} center / 100% no-repeat, rgb(19 18 32 / 0.72); border: 2px solid var(--ui-gold-4); }
    ${L} .stick-knob { border: 0; border-radius: 0; background: ${GEM} center / 100% no-repeat; box-shadow: none; }
    ${L} .tbtn { background: none; border: 0; box-shadow: none; color: var(--ui-paper); }
    ${L} .tbtn::before { content: ''; position: absolute; z-index: -1; inset: 10%; border: 1px solid var(--ui-gold-4); box-shadow: 0 3px 0 rgb(12 11 18 / 0.5);
      background: var(--ui-corner-tl) left top / 42% no-repeat, var(--ui-corner-tr) right top / 42% no-repeat,
        var(--ui-corner-bl) left bottom / 42% no-repeat, var(--ui-corner-br) right bottom / 42% no-repeat, var(--ui-grain), var(--ui-black); }
    ${L} .tbtn.sneak::before { inset: 4%; } /* the word stays on the lacquer, never on bare ground */
    ${L} .tbtn.a { color: var(--ui-gold-6); }
  `,
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
    for (const name of ['plain', ...Object.keys(SKINS)]) {
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
        const skin = SKINS[name];
        if (skin) await page.eval(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(skin)}; document.head.append(s); })()`);
        // mid-walk: the thumb holds the stick, pushed right and a little down
        const at = { x: 190, y: 250 };
        await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at, id: 1 }] });
        await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x + 44, y: at.y + 10, id: 1 }] });
        await page.waitFor(`!!__game.world.body.moving`, 'the walk', 5000);
        await page.screenshot(join(out, `${date}-phone-landscape-${name}.png`));
        await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        console.log(`${name}: ${join(out, `${date}-phone-landscape-${name}.png`)}`);
        if (name === 'plain') console.log(`density: ${JSON.stringify(await page.eval(DENSITY))}`);
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
