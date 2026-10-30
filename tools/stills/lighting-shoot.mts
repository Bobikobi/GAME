import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
/**
 * The base of the lighting ladder's stills (docs/design/LIGHTING.md section 2): the built game at 17:30 in a
 * 390x844 phone at scale 3, the elder's hearth lit, the mist and the HUD hidden, the camera centred on world
 * (CX, CY). Writes OUT.png, OUT-noplayer.png (the player's mask, for the body light), OUT-nograss.png,
 * OUT-nofire.png and OUT.json (the camera and every sprite in view).
 *
 *   pnpm --filter game build
 *   CX=530.75 CY=135.5 npx tsx tools/stills/lighting-shoot.mts tools/stills/inputs/lighting-base 35,11 17.5
 *
 * CHROME_BIN names the browser when it is not on the PATH.
 */
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep } from '../../game/e2e/cdp';
import { TAKE_GROUND, carveIn, seedQuery } from '../../game/e2e/wakes';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'game', 'dist');
const OUT = process.argv[2]!;
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
  const page = await browser.newPage({ width: 390, height: 844, mobile: true, scale: 3 });
  await page.goto(`${url}?debug&sway=on&cloud=${process.env.CLOUD ?? 0}${seedQuery('core/west-bank')}`);
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
  const cam = await page.eval(`(() => { const c = window.__game.world.cameras.main; return { zoom: c.zoom, x: c.worldView.x, y: c.worldView.y, w: c.worldView.width, h: c.worldView.height, sx: c.scrollX, sy: c.scrollY }; })()`);
  const objs = await page.eval(`(() => { const w = window.__game.world, c = w.cameras.main, v = c.worldView, out = [];
    const walk = (list) => { for (const o of list) { if (o.list) walk(o.list); if (!o.texture || !o.visible) continue; const k = o.texture.key; if (k === '__DEFAULT') continue;
      let b; try { b = o.getBounds(); } catch { continue; }
      if (b.right < v.x || b.x > v.right || b.bottom < v.y || b.y > v.bottom) continue;
      if (b.width > 300) continue;
      out.push({ k, f: o.frame && o.frame.name, x: b.x, y: b.y, w: b.width, h: b.height, d: o.depth, a: o.alpha, ox: o.originX, oy: o.originY }); } };
    walk(w.children.list); return out; })()`);
  writeFileSync(OUT + '.json', JSON.stringify({ info, cam, objs }, null, 1));
  await page.screenshot(OUT + '-hud.png');
  await page.eval(`(() => { const u = document.getElementById('ui'); if (u) u.style.visibility = 'hidden'; return true; })()`);
  await sleep(300);
  await page.screenshot(OUT + '.png');
  const hide = async (re: string, tag: string) => {
    await page.eval(`(() => { const w = window.__game.world, hid = []; const walk = (l) => { for (const o of l) { if (o.list) walk(o.list); if (o.texture && new RegExp(${JSON.stringify(re)}).test(o.texture.key) && o.visible) { o.setVisible(false); hid.push(o); } } }; walk(w.children.list); window.__hid = hid; return hid.length; })()`);
    await sleep(300);
    await page.screenshot(OUT + '-no' + tag + '.png');
    await page.eval(`(() => { for (const o of window.__hid) o.setVisible(true); return true; })()`);
    await sleep(300);
  };
  await hide('^core/base-kit:chars/', 'player');
  await hide('props/(grass_tall|flowers|flowers_white|reeds)$', 'grass');
  await hide('props/campfire_lit$', 'fire');
} finally {
  await browser.close().catch(() => {});
  server.close();
}
