/**
 * The lighting ladder's frame time (docs/design/LIGHTING.md section 4): the built game in headless Chromium at
 * 1440x3120 (480x1040 CSS px at scale 3) with the CPU throttled 4x, the `?stats=1` overlay read after the world
 * has run a while in the town square. Prints one line: the hour, the p50 and p95 of the frame's real interval over
 * six seconds (requestAnimationFrame), and the overlay's fps and smoothed p50 and p95.
 *
 *   pnpm --filter game build
 *   E2E_CPU_SLOWDOWN=4 npx tsx tools/stills/frame-time.mts [hour=19.5] [cloud=2] [seconds=10]
 *
 * A software renderer in the cloud says nothing absolute about a phone's GPU; the number is for before and after.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep } from '../../game/e2e/cdp';
import { TAKE_GROUND, carveIn, seedQuery } from '../../game/e2e/wakes';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'game', 'dist');
const hour = Number(process.argv[2] ?? '19.5');
const cloud = process.argv[3] ?? '2';
const seconds = Number(process.argv[4] ?? '10');
const T: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!)).replace(/^(\.\.[/\\])+/, '');
  let f = join(DIST, path);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': T[extname(f)] ?? 'application/octet-stream' });
  createReadStream(f).pipe(res);
});
await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
const browser = await Browser.launch();
try {
  const page = await browser.newPage({ width: 480, height: 1040, mobile: true, scale: 3 });
  await page.goto(url + 'index.html?blank');
  // the High preset and no cap, so the overlay shows what a frame costs and not the cap Auto chose
  await page.eval(`(() => { localStorage.setItem('openfold.settings.1', JSON.stringify({ quality: 'high', frameCap: 'max', reducedMotion: false })); return true; })()`);
  await page.goto(`${url}?debug&stats=1&cloud=${cloud}${seedQuery('core/west-bank')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'title', 60_000);
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(`document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`, 'cards', 30_000);
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Human');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'wake', 30_000);
  await page.eval(carveIn('Tess'));
  await page.eval(TAKE_GROUND);
  for (let i = 0; i < 20; i++) { if (!(await page.eval<boolean>('!!document.querySelector(".dialog")'))) break; await page.press('Enter'); await sleep(100); }
  await page.eval(`(() => { const g = window.__game, s = g.session;
    s.state.player.quests['core/herbs-for-pell'] = 'done';
    if (!s.state.player.restored.includes('core/old-bridge')) s.state.player.restored.push('core/old-bridge');
    s.pos = [35, 11]; s.state.player.at = [35, 11]; s.facing = 'down';
    const day = g.bundle.params.day_length_ms, q = Math.floor(day / 2);
    let t = s.tick - ((s.tick + q) % day) + Math.round((${hour} / 24) * day); if (t < s.tick) t += day; s.tick = t;
    s.state.player.fires = s.state.player.fires || {}; s.state.player.fires['core/elder-hearth'] = { lit: s.tick - 1000, until: s.tick + 10 * day };
    g.world.bind(s);
    return true; })()`);
  for (let i = 0; i < 20; i++) { if (!(await page.eval<boolean>('!!document.querySelector(".dialog")'))) break; await page.press('Enter'); await sleep(100); }
  await page.eval(`(() => { const w = window.__game.world; w.mist.setVisible(false); w.mist.setAlpha(0); return true; })()`);
  await sleep(seconds * 1000);
  // the overlay's ms are Phaser's smoothed delta, which a slow frame clamps; the frame's real interval is read by rAF
  const raf = await page.eval<number[]>(`new Promise((ok) => { const out = []; let last = 0; const end = performance.now() + 6000;
    const step = (t) => { if (last) out.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else ok(out); }; requestAnimationFrame(step); })`);
  const sorted = [...raf].sort((a, b) => a - b);
  const pct = (p: number) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]! * 10) / 10;
  const stats = await page.eval<string>(`[...document.querySelectorAll('div')].map((d) => d.textContent).find((t) => t && t.startsWith('fps ')) || ''`);
  const m = /fps (\d+)\s+ms p50 ([\d.]+) p95 ([\d.]+)/.exec(stats);
  console.log(JSON.stringify({ hour, cloud, frames: raf.length, rafP50: pct(0.5), rafP95: pct(0.95), fps: Number(m?.[1]), p50: Number(m?.[2]), p95: Number(m?.[3]), overlay: stats.replace(/\n/g, ' | '), errors: page.errors.slice(0, 3) }));
} finally {
  await browser.close().catch(() => {});
  server.close();
}
