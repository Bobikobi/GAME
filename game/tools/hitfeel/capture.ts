/**
 * Trial 2 capture: one chop with the blow's feel and one with ?juice=0, frame by frame. The game's loop is put
 * to sleep and stepped by hand at 20 ms a frame, so the capture keeps true game time on a loaded machine.
 * Four strengths side by side: on (as built), mid (no flash, a 1 px knock), light (no flash, no knock) and off.
 * The owner, 26.10: gathering gets none of it; the strengths are kept for fights and monsters (DECISIONS).
 * Usage: tsx game/tools/hitfeel/capture.ts, then python3 game/tools/hitfeel/compose.py .scratch/hit-feel-capture OUT_DIR on mid light off   (needs game/dist)
 */
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page } from '../../e2e/cdp';
import { TAKE_GROUND, seedQuery } from '../../e2e/wakes';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', '..', 'dist');
const OUT = process.env.OUT ?? join(HERE, '..', '..', '..', '.scratch', 'hit-feel-capture');
const STEP = 20;
const MAX = Number(process.env.FRAMES ?? 260);
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(DIST) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
const port = (server.address() as { port: number }).port;

async function shot(page: Page, path: string, clip: { x: number; y: number; width: number; height: number }): Promise<void> {
  const r = await (page as unknown as { send: <T>(m: string, p: object) => Promise<T> }).send<{ data: string }>('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
  writeFileSync(path, Buffer.from(r.data, 'base64'));
}

type Variant = 'on' | 'mid' | 'light' | 'off';
// mid: no white flash and the knock at 1 art px; light: no flash and no knock, only the hold and the chips
const PATCH: Record<Variant, string> = {
  on: '',
  off: '',
  mid: `(() => { const w = window.__game.world, tick = w.feelTick; w.flashWhite = () => {}; w.feelTick = function () { tick.call(this); const c = this.cameras.main; c.setPosition(Math.trunc(c.x / 2), Math.trunc(c.y / 2)); }; })()`,
  light: `(() => { const w = window.__game.world, tick = w.feelTick; w.flashWhite = () => {}; w.feelTick = function () { tick.call(this); this.cameras.main.setPosition(0, 0); }; })()`,
};

async function capture(page: Page, variant: Variant): Promise<number> {
  const juice = variant !== 'off';
  const dir = join(OUT, variant);
  mkdirSync(dir, { recursive: true });
  await page.goto(`http://127.0.0.1:${port}/?debug${seedQuery('core/west-bank')}${juice ? '' : '&juice=0'}`);
  await page.tap('.title-screen button', 'New game');
  const choice = await page.waitFor<string>(
    `document.querySelector('.card.race') ? 'cards' : [...document.querySelectorAll('.title-screen button')].some((b) => b.textContent.includes('Start a new game')) ? 'ask' : ''`,
    'the race cards',
  );
  if (choice === 'ask') await page.tap('.title-screen button', 'Start a new game');
  await page.tap('.card.race', 'Elf');
  if (await page.eval<boolean>('!!document.querySelector("input.name")')) {
    await page.tap('input.name');
    await page.type('Tess');
  }
  await page.tap('.title-screen button', 'Wake up');
  await page.waitFor('!!window.__game.session && window.__game.session.started', 'the wake', 30_000);
  await page.eval(TAKE_GROUND);
  if (PATCH[variant]) await page.eval(PATCH[variant]);
  for (let i = 0; i < 30 && (await page.eval<boolean>('!!document.querySelector(".dialog")')); i++) {
    await page.eval('document.querySelector(".dialog")?.click()');
    await sleep(150);
  }
  const placed = await page.eval<{ id: string } | null>(`(() => {
    const g = window.__game, s = g.session, b = g.bundle;
    const near = (i) => Math.abs(i.x - s.pos[0]) + Math.abs(i.y - s.pos[1]);
    const trees = Object.entries(b.instances).filter(([id, i]) => i.kind === 'resource' && b.resources[i.source].tool === 'axe' && (s.state.nodes[id]?.readyAt ?? 0) <= s.tick).sort((x, y) => near(x[1]) - near(y[1]));
    for (const [id, i] of trees) {
      for (const [dx, dy, f] of [[-1, 0, 'right'], [1, 0, 'left'], [0, 1, 'up'], [0, -1, 'down']]) {
        const x = i.x + dx, y = i.y + dy;
        const blocked = Object.values(b.instances).some((o) => o.x === x && o.y === y);
        if (blocked || x < 0 || y < 0 || x >= b.map.width || y >= b.map.height) continue;
        s.pos = [x, y]; s.state.player.at = [x, y]; s.facing = f;
        return { id };
      }
    }
    return null;
  })()`);
  if (!placed) throw new Error('no tree to stand beside');
  await sleep(800);
  // hand-stepped from here on: every frame is exactly STEP ms of game time
  await page.eval('window.__g = window.__game.world.game; window.__g.loop.sleep(); window.__t = performance.now()');
  const step = (): Promise<unknown> => page.eval(`window.__t += ${STEP}; window.__g.step(window.__t, ${STEP})`);
  for (let i = 0; i < 30; i++) await step();
  const vp = await page.eval<{ w: number; h: number }>('({ w: innerWidth, h: innerHeight })');
  // centred between the player and the tree, in CSS pixels
  const mid = await page.eval<{ x: number; y: number }>(`(() => {
    const w = window.__game.world, b = window.__game.bundle, i = b.instances[${JSON.stringify(placed.id)}];
    const a = w.worldToPage(w.player.x, w.player.y - 12), t = w.worldToPage((i.x + 0.5) * 16, (i.y + 0.2) * 16);
    return { x: (a.x + t.x) / 2, y: (a.y + t.y) / 2 };
  })()`);
  const side = 140;
  const clip = { x: Math.round(Math.max(0, Math.min(vp.w - side, mid.x - side / 2))), y: Math.round(Math.max(0, Math.min(vp.h - side, mid.y - side / 2))), width: side, height: side };
  console.log('clip', JSON.stringify(clip), 'mid', JSON.stringify(mid));
  await shot(page, join(OUT, `full-${variant}.png`), { x: 0, y: 0, width: vp.w, height: vp.h });
  let n = 0;
  for (; n < 8; n++) {
    await step();
    await shot(page, join(dir, `${String(n).padStart(4, '0')}.png`), clip);
  }
  await page.eval(`window.__game.world.startWork(${JSON.stringify(placed.id)}).then(() => (window.__started = window.__game.world.working))`);
  for (let i = 0; i < 20 && !(await page.eval<boolean>('window.__game.world.working')); i++) await step();
  console.log('working:', await page.eval<boolean>('window.__game.world.working'), 'toast:', await page.eval<string>('[...document.querySelectorAll(".toast")].map((t) => t.textContent).join(" | ")'));
  let after = 0;
  const hits: number[] = [];
  for (; n < MAX; n++) {
    await step();
    await shot(page, join(dir, `${String(n).padStart(4, '0')}.png`), clip);
    hits.push(await page.eval<number>('window.__game.world.auto?.hits ?? -1'));
    writeFileSync(join(dir, 'hits.json'), JSON.stringify({ start: 8, hits }));
    if (!(await page.eval<boolean>('window.__game.world.working')) && ++after > 40) break;
  }
  return n;
}

const browser = await Browser.launch();
try {
  const page = await browser.newPage({ width: 480, height: 1040, mobile: true, scale: 3 });
  for (const v of (process.env.VARIANTS ?? 'on,mid,light,off').split(',') as Variant[]) console.log(`${v}: ${await capture(page, v)} frames`);
  if (page.errors.length) console.log('page errors:', page.errors.slice(0, 5));
  page.close();
} finally {
  await browser.close();
  server.close();
}
