/**
 * A clip of a fire's breathing pool (LIGHTING.md section 7): the built game at 19:00, the elder's hearth lit, the
 * camera on it, the HUD and the mist hidden, motion on; recorded by the browser's screencast for SECONDS (14) and
 * written as frames with their times, which ffmpeg stitches into an 800 px webm.
 *
 *   pnpm --filter game build
 *   npx tsx tools/stills/fire-clip.mts <out-dir> 30,7 19
 *   ffmpeg -f concat -safe 0 -i <out-dir>/concat.txt -vf scale=800:-2 -c:v libvpx-vp9 -b:v 0 -crf 40 docs/design/frames/2026-10-30-fire-breath.webm
 *
 * CHROME_BIN names the browser when it is not on the PATH.
 */
import { existsSync, createReadStream, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep } from '../../game/e2e/cdp';
import { TAKE_GROUND, carveIn, seedQuery } from '../../game/e2e/wakes';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'game', 'dist');
const OUT = process.argv[2]!;
const SECONDS = Number(process.env.SECONDS ?? 14);
const [px, py] = (process.argv[3] ?? '31,9').split(',').map(Number);
const hour = Number(process.argv[4] ?? '17.5');
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
  const page = await browser.newPage({ width: 400, height: 400, mobile: true, scale: 2 });
  await page.goto(`${url}?debug&cloud=0${seedQuery('core/west-bank')}`);
  await page.waitFor(`!!document.querySelector('.title-screen button')`, 'title', 30_000);
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(`document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`, 'cards');
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Human');
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'wake', 10_000);
  await page.eval(carveIn('Tess'));
  await page.eval(TAKE_GROUND);
  for (let i = 0; i < 20; i++) { if (!(await page.eval<boolean>('!!document.querySelector(".dialog")'))) break; await page.press('Enter'); await sleep(100); }
  const info = await page.eval(`(() => { const g = window.__game, s = g.session;
    s.state.player.quests['core/herbs-for-pell'] = 'done';
    if (!s.state.player.restored.includes('core/old-bridge')) s.state.player.restored.push('core/old-bridge');
    s.met.add('core/trader');
    s.pos = [${px}, ${py}]; s.state.player.at = [${px}, ${py}]; s.facing = 'down'; g.world.bind(s);
    const day = g.bundle.params.day_length_ms, q = Math.floor(day / 2);
    let t = s.tick - ((s.tick + q) % day) + Math.round((${hour} / 24) * day); if (t < s.tick) t += day; s.tick = t;
    s.state.player.fires = s.state.player.fires || {}; s.state.player.fires['core/elder-hearth'] = { lit: s.tick - 1000, until: s.tick + 10 * day };
    g.world.bind(s);
    s.paused = true;
    return { day, rich: g.rich, zoom: g.world.cameras.main.zoom, view: g.world.cameras.main.worldView };
  })()`);
  await sleep(2500);
  for (let i = 0; i < 20; i++) { if (!(await page.eval<boolean>('!!document.querySelector(".dialog")'))) break; await page.press('Enter'); await sleep(100); }
  await page.eval(`(() => { const g = window.__game; g.session.paused = true; return true; })()`);
  await page.eval(`(() => { const w = window.__game.world; const c = w.cameras.main; c.stopFollow(); c.centerOn(${process.env.CX ?? 514.75}, ${process.env.CY ?? 135.5}); w.mist.setVisible(false); w.mist.setAlpha(0); return true; })()`);
  await sleep(500);
  await page.eval(`(() => { const w = window.__game.world; const c = w.cameras.main; c.stopFollow(); c.centerOn(${process.env.CX ?? 472}, ${process.env.CY ?? 100}); w.mist.setVisible(false); w.mist.setAlpha(0); const u = document.getElementById('ui'); if (u) u.style.visibility = 'hidden'; return true; })()`);
  await sleep(1500);
  await page.screenshot(join(OUT, 'still.png'));
  await page.record(OUT);
  await sleep(SECONDS * 1000);
  // the concat list: each frame held until the next one came
  const lines = readFileSync(join(OUT, 'frames.txt'), 'utf8').trim().split('\n').map((l) => l.split(' ')) as [string, string][];
  const list: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const next = i + 1 < lines.length ? Number(lines[i + 1]![0]) : Number(lines[i]![0]) + 100;
    list.push(`file '${join(OUT, lines[i]![1])}'`, `duration ${((next - Number(lines[i]![0])) / 1000).toFixed(3)}`);
  }
  writeFileSync(join(OUT, 'concat.txt'), `${list.join('\n')}\n`);
  console.log(`${lines.length} frames over ${SECONDS} s`);
} finally {
  await browser.close().catch(() => {});
  server.close();
}
