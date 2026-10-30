/**
 * Makes the HUD's frame D stills and measures them (DECISIONS 2026-10-30, "The HUD wears frame D too"). Not a test,
 * and in no e2e group: run it by hand after `pnpm build`, once on the old HUD and once on the new.
 *
 *   tsx game/e2e/stills/hud-frame-d.ts <out-dir> <before|after> [date]
 *
 * The same frames each time: a phone in portrait (390 by 844 CSS px at 3x) by day, in the opening's first minute
 * with the tracker shown and one toast up, and the same phone at night; a desktop (1280 by 800) by day. Beside each
 * still it writes the HUD's boxes (so the two runs prove the layout did not move), the smallest text, the smallest
 * tap target, the HUD band's height and every text's colour on the colour under it.
 */
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page } from '../cdp';
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

const FORMS = [
  { name: 'phone-day', width: 390, height: 844, mobile: true, scale: 3, hour: 9 },
  { name: 'phone-night', width: 390, height: 844, mobile: true, scale: 3, hour: 22 },
  { name: 'desktop-day', width: 1280, height: 800, mobile: false, scale: 1, hour: 9 },
] as const;

/** The HUD's pieces, the boxes they take, and what their words read on. */
const MEASURE = `(() => {
  const PIECES = '.hud .meter, .hud .chip, .hud .btn, .tracker, .toast, .hud-map';
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: +r.left.toFixed(2), y: +r.top.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) }; };
  const name = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
  // a piece's frame is its box less what it holds: the words (each text's own line boxes), the icons and the meter's well
  const holds = (el) => {
    const out = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const q of r.getClientRects()) out.push({ x: q.left, y: q.top, w: q.width, h: q.height });
    }
    // a step's '> ' is drawn by ::before, outside any text node: the step's whole line is words
    for (const c of el.querySelectorAll('i, .meter-bar, .load-word, .hud-map-chart, .tracker-step')) out.push(box(c));
    return out;
  };
  const pieces = [...document.querySelectorAll(PIECES)].filter(shown).map((el) => ({ name: name(el), text: el.textContent.trim().slice(0, 40), ...box(el), holds: holds(el) }));
  const rgb = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const ground = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return { c, from: name(e) }; } return null; };
  const texts = [];
  for (const el of document.querySelectorAll('.top *, .hud-map *')) {
    if (!shown(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    texts.push({ name: name(el), text: [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').slice(0, 30), size: parseFloat(cs.fontSize), family: cs.fontFamily, color: rgb(cs.color), ground: ground(el) });
  }
  // a tap target is where a finger lands on it: walked along its middle column and row, a pixel at a time
  const reach = (el) => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hits = (x, y) => { const at = document.elementFromPoint(x, y); return !!at && (at === el || el.contains(at)); };
    let top = cy, bottom = cy, left = cx, right = cx;
    while (top > 0 && hits(cx, top - 1)) top--;
    while (bottom < innerHeight && hits(cx, bottom + 1)) bottom++;
    while (left > 0 && hits(left - 1, cy)) left--;
    while (right < innerWidth && hits(right + 1, cy)) right++;
    return { tapW: right - left + 1, tapH: bottom - top + 1 };
  };
  const taps = [...document.querySelectorAll('.hud button, .tracker, .hud-map')].filter(shown).map((el) => ({ name: name(el), text: el.textContent.trim().slice(0, 20), ...box(el), ...reach(el) }));
  let band = 0, bandTop = 1e9;
  for (const el of document.querySelectorAll('.top > .hud, .top > .tracker')) if (shown(el)) { const r = el.getBoundingClientRect(); band = Math.max(band, r.bottom); bandTop = Math.min(bandTop, r.top); }
  const hud = document.querySelector('.top > .hud').getBoundingClientRect();
  return { pieces, texts, taps, hud: { top: hud.top, height: hud.height }, band: { top: bandTop, bottom: band } };
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

async function wake(page: Page): Promise<void> {
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
  // the waking lines, read to their end
  for (let i = 0; i < 40; i++) {
    const open = await page.eval<boolean>(`!!document.querySelector('#ui > .layer, .dialog')`);
    if (!open) {
      await sleep(400);
      if (!(await page.eval<boolean>(`!!document.querySelector('#ui > .layer, .dialog')`))) break;
    }
    await page.press('Enter');
    await sleep(150);
  }
  await page.waitFor(`!document.querySelector('#ui > .layer, .dialog')`, 'the waking lines to close', 20_000);
  await page.waitFor(`document.querySelectorAll('.toasts > *').length === 0`, 'the opening toasts to leave', 30_000);
}

async function main(): Promise<void> {
  const out = resolve(process.argv[2] ?? '.scratch/stills');
  const label = process.argv[3] ?? 'after';
  const date = process.argv[4] ?? '2026-10-30';
  mkdirSync(out, { recursive: true });
  const local = await serve();
  const browser = await Browser.launch();
  try {
    for (const form of FORMS) {
      const page = await browser.newPage({ width: form.width, height: form.height, mobile: form.mobile, scale: form.scale });
      try {
        await page.goto(`${local.url}?debug&rich=none${seedQuery('core/west-bank')}`);
        await page.waitFor(`!!document.querySelector('.title-screen button')`, 'the title screen', 60_000);
        await wake(page);
        await page.eval(`(() => {
          const s = __game.session, day = __game.bundle.params.day_length_ms, q = Math.floor(day / 2);
          let t = s.tick - ((s.tick + q) % day) + Math.round((${form.hour} / 24) * day);
          if (t < s.tick) t += day;
          s.tick = t;
        })()`);
        await page.waitFor(`!document.querySelector('.tracker').hidden`, 'the tracker', 10_000);
        // the night's lantern warning may open a box: it is read away so the HUD stands alone
        await sleep(1200);
        for (let i = 0; i < 10 && (await page.eval<boolean>(`!!document.querySelector('#ui > .layer, .dialog')`)); i++) {
          await page.press('Enter');
          await sleep(200);
        }
        await page.waitFor(`document.querySelectorAll('.toasts > *').length === 0`, 'the toasts to leave', 30_000);
        const file = `${date}-hud-D-${form.name}-${label}`;
        // the clock's minutes change a chip's width: the clock is held, and the boxes are read on both sides of the
        // still until they agree; the toast goes up last, so it stands in the still
        await page.eval(`__game.session.pauses += 1`);
        await sleep(600);
        await page.eval(`__game.ui.toast('Gathered 2 Sunleaf', 'good')`);
        await page.waitFor(`!!document.querySelector('.toast') && getComputedStyle(document.querySelector('.toast')).opacity === '1'`, 'the toast', 5000);
        // a short line's time is about a second, shorter than a 3x still takes: the band's timer is held, so it stays up
        await page.eval(`window.clearTimeout(__game.ui.bandTimer)`);
        await sleep(300);
        let seen: { pieces: unknown } = { pieces: null };
        for (let i = 0; i < 10; i++) {
          const before = await page.eval<{ pieces: unknown }>(MEASURE);
          await page.screenshot(join(out, `${file}.png`));
          seen = await page.eval<{ pieces: unknown }>(MEASURE);
          if (JSON.stringify(before.pieces) === JSON.stringify(seen.pieces)) break;
        }
        writeFileSync(join(out, `${file}.json`), JSON.stringify({ form, scale: form.scale, ...seen }, null, 1));
        console.log(`${form.name}: ${join(out, `${file}.png`)}`);
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
