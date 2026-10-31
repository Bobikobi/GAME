/** Scratch: a phone still at noon beside the oaks. Not committed. tsx game/e2e/stills/trial-trees.ts <out.png> [x y] */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep } from '../cdp';
import { TAKE_GROUND, carveIn, seedQuery } from '../wakes';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
async function main() {
  const out = resolve(process.argv[2] ?? '.scratch/trees.png');
  const [px, py] = [Number(process.argv[3] ?? 25), Number(process.argv[4] ?? 25)];
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')).replace(/^(\.\.[/\\])+/, '');
    let file = join(DIST, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file.startsWith(DIST) || !existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 390, height: 844, mobile: true, scale: 3 });
    await page.goto(`${url}?debug${seedQuery('core/west-bank')}`);
    await page.waitFor(`!!document.querySelector('.title-screen button')`, 'title', 60_000);
    await page.tap('.title-screen button', 'New game');
    const choice = await page.waitFor<string>(`document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`, 'cards');
    if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
    await page.tap('.card.race', 'Elf');
    await page.tap('.title-screen button', 'Wake up');
    await page.waitFor('!!window.__game.session && window.__game.session.started', 'wake', 20_000);
    await page.eval(carveIn('Tess'));
    await page.eval(TAKE_GROUND);
    for (let i = 0; i < 40; i++) { await page.press('Enter'); await sleep(150); if (!(await page.eval<boolean>(`!!document.querySelector('#ui > .layer, .dialog')`))) break; }
    await page.eval(`(() => { const s = __game.session, day = __game.bundle.params.day_length_ms, q = Math.floor(day / 2); let t = s.tick - ((s.tick + q) % day) + Math.round((12 / 24) * day); if (t < s.tick) t += day; s.tick = t; const p = s.state.player; p.x = ${px}; p.y = ${py}; const w = __game.world; w.player.setPosition(${px} * 16 + 8, ${py} * 16 + 8); w.cameras.main.centerOn(w.player.x, w.player.y); })()`);
    await sleep(2500);
    console.log('oaks', JSON.stringify(await page.eval(`[...__game.world.nodes.entries()].filter(([k, s]) => /oak|tree/.test(s.texture.key + k)).slice(0, 12).map(([k, s]) => [k, s.texture.key, Math.round(s.x / 16), Math.round(s.y / 16), s.visible])`)));
    console.log('chips', JSON.stringify(await page.eval(`[...document.querySelectorAll('.chip')].map((c) => c.textContent)`)));
    await page.eval(`document.querySelectorAll('.toasts, .tracker, .hud, .pad, .tbtn').forEach((e) => (e.style.display = 'none'))`);
    await page.eval(`__game.world.veil.setVisible(false); __game.session.pauses += 1`);
    await sleep(500);
    await page.screenshot(out);
    console.log(out, JSON.stringify(await page.eval(`({ x: __game.session.state.player.x, y: __game.session.state.player.y })`)));
    page.close();
  } finally { await browser.close().catch(() => undefined); server.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
