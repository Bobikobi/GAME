/**
 * The proof of the private preview (tracker #33, bar P1): the game as the owner's phone gets it, from the cloud copy behind the site's password.
 *
 *   [PREVIEW_SIZE=WxH[,mobile]] [PREVIEW_MINUTE=780] [E2E_GPU=1] tsx game/e2e/preview.ts BASE_URL PASSWORD OUT_DIR SEAM_C0,SEAM_C1
 *
 * PREVIEW_EXTRA="seethrough=0" adds a query to the page (the page's own query wins over the preview's, which has see-through on), for a still that tries one option.
 * PREVIEW_SCALE=N sets the device's pixel ratio (default 1 at 844 x 390; a phone has 3). PREVIEW_MEASURE=1 stops after the valley start and prints the camera's numbers (zoom, canvas, her silhouette and share of the frame height).
 * PREVIEW_TWIN=1 saves beside each still its see-through-off twin (still-*-off.png) and checks that nothing outside 3 figure heights around her differs (bar S3).
 * BASE_URL is the cloud site (the private preview's emulator, with the real policy headers), PASSWORD the site's. One headless Chrome at 844 x 390 (landscape, touch, the phone's frame):
 *
 *   1  sign in through the login page, open /preview/?preview: every file answered 200, no refused request, 0 console or page errors so far
 *   2  the game starts in the valley (not in the scene), the painted mount is up with its way out, and the light is the world's at the device clock's hour
 *   3  the figure walks from the valley's start, out by the east lane, into the block and across the seam's columns (SEAM_C0..SEAM_C1, cells of the scene), a tile at a time; every tile of the route is
 *      one the engine's own `canWalk` calls open, and the feet stand on the corners and on every cell of the seam's span
 *   4  the frame time in the valley and in the block (rAF intervals over 8 s, this laptop: printed, no bound) and 0 console or page errors so far
 *   5  [PREVIEW_CROSSINGS=FILE, PREVIEW_HOURS=780,1050] every crossing of every seam of the block, walked both ways by the block command's own walker (crossing.ts, the route reversed for the way back), at each hour;
 *      a still of the first crossing of each seam in each direction, and for each still a probe: the same frame once more with her sprite filled magenta, the magenta pixels inside her box counted against the
 *      valley start's count (below half of it: the figure is hidden behind a canopy or another object). Hiding her instead would drop her cover and see-through masks and count the fade as her.
 *   6  her whole silhouette is in the frame at every still (top, feet and both sides; the count hidden behind an object is printed beside it); 0 console or page errors over the whole run
 *
 * It prints one JSON line per station and screenshots (small) into OUT_DIR, and exits 0 when it ran to the end (the lines say pass or fail). The browser is closed by its handle in `finally`.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, type Page, sleep } from './cdp';
import { FreeWalk, ART_PX } from './walk';
import { type Crossing, walkCrossing } from './crossing';
import { boxInFrame, frameGap } from './inframe';

interface Line {
  n: number;
  ok: boolean;
  bar: string;
  detail: string;
  ms: number;
}
const say = (l: Line): void => console.log(JSON.stringify(l));

/** The viewport: PREVIEW_SIZE=WxH[,mobile] (default the owner's phone, landscape only: 844 x 390 touch at scale 1, so a still is 844 x 390). */
function viewport(): { width: number; height: number; mobile: boolean; scale: number } {
  const v = process.env.PREVIEW_SIZE;
  const dsf = Number(process.env.PREVIEW_SCALE ?? 0);   // PREVIEW_SCALE=3: the device's pixel ratio (a phone has 3), over the default of the size's kind
  if (!v) return { width: 844, height: 390, mobile: true, scale: dsf > 0 ? dsf : 1 };
  const [wh, mob] = v.split(',');
  const [width, height] = wh!.split('x').map(Number) as [number, number];
  return { width, height, mobile: mob === 'mobile', scale: dsf > 0 ? dsf : mob === 'mobile' ? 2 : 1 };
}
/** The minute the rig holds the light at (PREVIEW_MINUTE, default 13:00): the preview's light follows the device clock, and a night run is black. */
const HOLD_MINUTE = Number(process.env.PREVIEW_MINUTE ?? 780);

/** The mean luma (0-255) of a PNG data URL, read back in the page: a canvas that came out black reads 0. */
const LUMA = (url: string): string => `new Promise((resolve) => {
  const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) { s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; } resolve(s / n); };
  im.src = ${JSON.stringify(url)}; })`;
/** The pixels that differ between two screenshots (data URLs) inside a box (CSS px, scale 1): the figure's own pixels when the second frame has the figure hidden. */
const DIFF = (a: string, b: string, box: [number, number, number, number], outside = false): string => `new Promise((resolve) => {
  const load = (u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u; });
  Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]).then(([ia, ib]) => {
    const g = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    const A = g(ia), B = g(ib); const [bx, by, bw, bh] = ${JSON.stringify(box)};
    const x0 = Math.max(0, Math.floor(bx)), y0 = Math.max(0, Math.floor(by)), x1 = Math.min(A.width, Math.ceil(bx + bw)), y1 = Math.min(A.height, Math.ceil(by + bh));
    let n = 0; for (let y = ${outside ? '0' : 'y0'}; y < ${outside ? 'A.height' : 'y1'}; y++) for (let x = ${outside ? '0' : 'x0'}; x < ${outside ? 'A.width' : 'x1'}; x++) { ${outside ? 'if (x >= x0 && x < x1 && y >= y0 && y < y1) continue; ' : ''}const i = (y * A.width + x) * 4; if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 30) n++; }
    resolve(n); }); })`;
/** The pixels of a still that are the figure filled magenta (her sprite drawn with tint mode FILL, nothing else changed): the count and the bounding box [x0, y0, x1, y1], or null. */
const MAGENTA = (a: string, box: [number, number, number, number]): string => `new Promise((resolve) => {
  const i = new Image(); i.onload = () => {
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const A = x.getImageData(0, 0, c.width, c.height);
    const [bx, by, bw, bh] = ${JSON.stringify(box)};
    const x0 = Math.max(0, Math.floor(bx)), y0 = Math.max(0, Math.floor(by)), x1 = Math.min(A.width, Math.ceil(bx + bw)), y1 = Math.min(A.height, Math.ceil(by + bh));
    let n = 0, r = null;
    for (let y = y0; y < y1; y++) for (let xx = x0; xx < x1; xx++) { const k = (y * A.width + xx) * 4, R = A.data[k], G = A.data[k + 1], B = A.data[k + 2];
      if (R > 100 && B > 100 && G < 0.5 * Math.min(R, B) && Math.abs(R - B) < 0.35 * Math.max(R, B)) { n++; r = r ? [Math.min(r[0], xx), Math.min(r[1], y), Math.max(r[2], xx), Math.max(r[3], y)] : [xx, y, xx, y]; } }
    resolve({ n, r }); };
  i.src = ${JSON.stringify(a)}; })`;
const RENDERER = `(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : 'no webgl'; })()`;

/** Where the figure stands on the screen (CSS px) and the camera's zoom: a still where the figure is not in the frame shows nothing of the walk. */
const FIGURE = `(() => { const c = window.__game.world.cameras.main, [x, y, w, h] = window.__painted.walkerBox('player');
  const p = window.__game.world.player; return { x: x + w / 2, y: y + h / 2, w: w, h: h, view: [c.width, c.height], vis: p.visible, alpha: p.alpha, depth: p.depth, py: p.y, key: p.texture.key, scale: [p.scaleX, p.scaleY] }; })()`;

/** The route from the feet's tile to the first tile at scene column `col` or beyond, by the engine's own `canWalk`, four ways; corners only plus the length. */
const ROUTE = (col: number): string => `(() => {
  const p = window.__painted, w = window.__walk;
  const W = p.x0 + p.scene.cols + 2, H = 64, goalX = p.x0 + ${col};
  const b = window.__game.world.body, from = [Math.floor(b.x / 64), Math.floor(b.y / 64)];
  const key = (x, y) => y * W + x, prev = new Map([[key(from[0], from[1]), -1]]), q = [from];
  let hit = null;
  for (let i = 0; i < q.length && !hit; i++) {
    const [x, y] = q[i];
    if (x >= goalX) { hit = [x, y]; break; }
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(key(nx, ny))) continue;
      let ok = false; try { ok = !!w.open(nx, ny); } catch (e) { ok = false; }
      if (!ok) continue;
      prev.set(key(nx, ny), key(x, y)); q.push([nx, ny]);
    }
  }
  if (!hit) { let mx = 0; for (const k of prev.keys()) mx = Math.max(mx, k % W); const o = (x, y) => { try { return !!w.open(x, y); } catch (e) { return 'err'; } };
    return { diag: 'reached ' + prev.size + ' tiles, furthest column ' + mx + '; from ' + from + '; open(46,22)=' + o(46, 22) + ' (47,22)=' + o(47, 22) + ' (55,22)=' + o(55, 22) + ' (62,22)=' + o(62, 22) + ' (63,22)=' + o(63, 22) + ' (64,22)=' + o(64, 22) + ' (65,22)=' + o(65, 22) }; }
  const path = []; for (let k = key(hit[0], hit[1]); k !== -1; k = prev.get(k)) path.unshift([k % W, Math.floor(k / W)]);
  return path;
})()`;

/** The frame intervals over \`ms\`, from requestAnimationFrame in the page: mean, 95th percentile and the frame count. */
const FRAMES = (ms: number): string => `new Promise((resolve) => {
  const t = []; let last = performance.now(); const end = last + ${ms};
  const f = (now) => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else {
    t.shift(); t.sort((a, b) => a - b);
    resolve({ mean: t.reduce((a, b) => a + b, 0) / Math.max(t.length, 1), p95: t[Math.floor(t.length * 0.95)] ?? 0, n: t.length, fps: window.__game.loop ? window.__game.loop.actualFps : null }); } };
  requestAnimationFrame(f);
})`;

async function signIn(page: Page, base: string, password: string): Promise<void> {
  await page.goto(`${base}/`);
  await page.waitFor(`!!document.querySelector('form')`, 'the login page', 20_000);
  await page.eval(`(() => { const f = document.querySelector('form'); f.p.value = ${JSON.stringify(password)}; f.requestSubmit(); return true; })()`);
  await page.waitFor(`!document.querySelector('input[name=p]') && document.readyState === 'complete'`, 'the site after the password', 20_000);
}

/** The first load, as the owner's phone first sees it: ms from the request of the page to the title screen, and from the wake-up tap to the painted mount's first light (this laptop, no network between). */
const firstLoad = { title: 0, mount: 0 };

async function toTheValley(page: Page, base: string): Promise<void> {
  const t = Date.now();
  await page.goto(`${base}/preview/?preview&debug&seed=7&hold=clock${process.env.PREVIEW_EXTRA ? `&${process.env.PREVIEW_EXTRA}` : ''}`);
  await page.waitFor(`!!document.querySelector('.title-screen button') || !!window.__fail`, 'the title screen', 90_000);
  firstLoad.title = Date.now() - t;
  await page.tap('.title-screen button', 'New game');
  await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards', 30_000);
  await page.tap('.title-screen button', 'Wake up');
  const t2 = Date.now();
  await page.waitFor(`!!window.__game?.session && !!window.__painted`, 'the session and the painted mount', 60_000);
  firstLoad.mount = Date.now() - t2;
  for (let k = 0; k < 40; k++) {
    const up = await page.eval<number>(
      `(() => { const o = document.querySelector('.dialog-options button'); if (o) { o.click(); return 1; } const d = document.querySelector('.dialog, .story-box'); if (d) { d.click(); return 2; } return 0; })()`,
    );
    if (up === 0) break;
    await sleep(350);
  }
}

async function main(): Promise<number> {
  const [base, password, outDir, seamArg] = process.argv.slice(2) as [string, string, string, string];
  const [c0, c1] = (seamArg ?? '0,0').split(',').map(Number) as [number, number];
  mkdirSync(outDir, { recursive: true });
  const browser = await Browser.launch();
  let n = 1;
  let t0 = Date.now();
  const done = (ok: boolean, bar: string, detail: string): boolean => {
    say({ n, ok, bar, detail, ms: Date.now() - t0 });
    t0 = Date.now();
    n += 1;
    return ok;
  };
  const answers: { url: string; status: number }[] = [];
  const refused: string[] = [];
  try {
    const page = await browser.newPage(viewport());
    await page.send('Network.enable');
    await page.send('Log.enable');
    page.on('Network.responseReceived', (p) => {
      const r = p.response as { url: string; status: number };
      answers.push({ url: r.url, status: r.status });
    });
    const sizes = new Map<string, string>();
    let wire = 0;
    page.on('Network.requestWillBeSent', (p) => sizes.set(String(p.requestId), String((p.request as { url: string }).url)));
    page.on('Network.loadingFinished', (p) => {
      if ((sizes.get(String(p.requestId)) ?? '').startsWith(`${base}/preview/`)) wire += Number(p.encodedDataLength ?? 0);
    });
    page.on('Log.entryAdded', (p) => {
      const e = p.entry as { level: string; text: string; url?: string };
      if (e.level === 'error' || /Content Security Policy|Refused/i.test(e.text)) refused.push(`${e.text} ${e.url ?? ''}`.slice(0, 200));
    });
    await signIn(page, base, password);
    await toTheValley(page, base);
    const preview = answers.filter((a) => a.url.startsWith(`${base}/preview/`));
    const bad = preview.filter((a) => a.status !== 200);
    const errs1 = [...page.errors.filter((e) => !/favicon/.test(e)), ...refused];
    const ok1 = preview.length > 10 && bad.length === 0 && errs1.length === 0;
    if (!done(ok1, 'signed in, /preview/ loads: every file 200, nothing refused by the policy, 0 console or page errors',
      ok1 ? `${preview.length} files from /preview/, all 200, 0 errors; first load on this laptop (no network between): ${(firstLoad.title / 1000).toFixed(1)} s from the request to the title screen, ${(firstLoad.mount / 1000).toFixed(1)} s from the wake-up tap to the painted mount; ${(wire / 1e6).toFixed(1)} MB over the wire` : `${preview.length} files; not 200: ${JSON.stringify(bad.slice(0, 3))}; errors ${JSON.stringify(errs1.slice(0, 3))}`)) return 0;

    // 2. the valley start, the mount, the clock
    await page.waitFor('window.__painted.litMinute >= 0', 'the first light pass', 90_000);
    const st = await page.eval<{ x: number; id: string; link: boolean; lit: number | undefined; device: number; x0: number; cols: number }>(
      `(() => { const p = window.__painted, b = window.__game.world.body; const d = new Date();
        return { x: Math.floor(b.x / 64), id: p.scene.id, link: p.link, lit: p.litMinute, device: d.getHours() * 60 + d.getMinutes(), x0: p.x0, cols: p.scene.cols }; })()`,
    );
    const ok2 = st.x < st.x0 && st.link && st.lit !== undefined && Math.abs(st.lit - st.device) <= 3;
    if (!done(ok2, 'the figure starts in the valley, the painted mount has its way out, the light is at the device clock\'s minute',
      `figure column ${st.x} (the scene starts at ${st.x0}), mount ${st.id}, link ${st.link}, light minute ${st.lit} against the device's ${st.device}`)) return 0;
    // the light is the device's at the start; the rig now holds it at HOLD_MINUTE (the clock is held by `hold=clock`), so a run at night is not black
    await page.eval(`window.__painted.setMinute(${HOLD_MINUTE})`);
    await page.waitFor(`Math.abs(window.__painted.litMinute - ${HOLD_MINUTE}) <= 3`, `the light at minute ${HOLD_MINUTE}`, 90_000);
    const renderer = await page.eval<string>(RENDERER);
    const gpuAsked = process.env.E2E_GPU === '1';
    if (!done(!gpuAsked || !/swiftshader|llvmpipe|no webgl/i.test(renderer), 'the renderer is the one asked for (E2E_GPU=1: a real GPU, never a software one)', `renderer: ${renderer}`)) return 0;
    await sleep(1500);
    const f0 = await page.eval<{ x: number; y: number; w: number; h: number; view: [number, number]; vis: boolean; alpha: number; depth: number; key: string }>(FIGURE);
    const inFrame = (f: { x: number; y: number; view: [number, number] }): boolean => f.x > 0 && f.x < f.view[0] && f.y > 0 && f.y < f.view[1];
    if (!inFrame(f0)) return done(false, 'the figure is in the frame of the valley still', `the figure's box is centred at ${f0.x.toFixed(0)},${f0.y.toFixed(0)} of ${f0.view[0]} x ${f0.view[1]}: the camera does not follow it`) ? 1 : 0;
    console.log(JSON.stringify({ n: 0, ok: true, bar: 'valley still (info)', detail: `figure box ${f0.w.toFixed(0)} x ${f0.h.toFixed(0)} centred at ${f0.x.toFixed(0)},${f0.y.toFixed(0)}; sprite ${f0.key} visible ${f0.vis} alpha ${f0.alpha} depth ${f0.depth}`, ms: 0 }));
    const valleyUrl = await page.screenshot(join(outDir, 'valley.png'));
    // the probe (bar B4): a still, then the same frame with the figure hidden; the pixels that change inside the figure's own bounds are the figure's. The baseline is taken here, on the valley's open ground.
    const figureNow = (): Promise<{ x: number; y: number; w: number; h: number; view: [number, number]; vis: boolean; alpha: number }> => page.eval(FIGURE);
    const BOUNDS = `(() => { const w = window.__game.world, c = w.cameras.main, b = w.player.getBounds(); return [(b.x - c.worldView.x) * c.zoom, (b.y - c.worldView.y) * c.zoom, b.width * c.zoom, b.height * c.zoom]; })()`;
    const probe = async (path: string, twinPath?: string, figH?: number): Promise<{ n: number; far?: number; nOff?: number; h: number; sil: [number, number, number, number] | null; fig: Awaited<ReturnType<typeof figureNow>> }> => {
      await page.eval(`(window.__painted.setHold('clock,wind,water,grass,air,fog'), 1)`);   // the probe's two frames differ by the figure only: the moving things are held
      await sleep(300);
      const a = await page.screenshot(path);
      const fig = await figureNow();
      const box = await page.eval<[number, number, number, number]>(BOUNDS);
      // her own pixels: the same frame once more with her sprite filled magenta (tint mode FILL; the world clears her tint every frame in placeLantern, so clearTint is held off for the probe's frames); only her visible pixels turn magenta, and nothing else in the frame changes (hiding her drops her cover and see-through masks, so a still without her counts the fade as her)
      await page.eval('(() => { const p = window.__game.world.player; window.__tint0 = [p.tintTopLeft, p.tintMode]; p.clearTint0 = p.clearTint; p.clearTint = function () { return this; }; p.setTint(0xff00ff).setTintMode(1); return 1; })()');
      await sleep(250);
      const m = await page.screenshot(join(outDir, 'probe.png'));
      await page.eval('(() => { const p = window.__game.world.player; p.clearTint = p.clearTint0; p.setTint(window.__tint0[0]).setTintMode(window.__tint0[1]); return 1; })()');
      const mg = await page.eval<{ n: number; r: [number, number, number, number] | null }>(MAGENTA(m, box));
      const n = mg.n, sil = mg.r;
      // bar S3: the same frame with the see-through switched off (its masks drop at once); outside a box of 3 figure heights (her silhouette's height on open ground) around her the two must not differ
      let far: number | undefined;
      let nOff: number | undefined;
      if (twinPath && figH) {
        await page.eval('(window.__painted.seeThrough = false, 1)');
        await sleep(400);
        const t = await page.screenshot(twinPath);
        // the same count with see-through off: what her probe reads when nothing is thinned (the twin of the share)
        await page.eval('(() => { const p = window.__game.world.player; window.__tint0 = [p.tintTopLeft, p.tintMode]; p.clearTint0 = p.clearTint; p.clearTint = function () { return this; }; p.setTint(0xff00ff).setTintMode(1); return 1; })()');
        await sleep(250);
        const mo = await page.eval<{ n: number }>(MAGENTA(await page.screenshot(join(outDir, 'probe.png')), box));
        nOff = mo.n;
        await page.eval('(() => { const p = window.__game.world.player; p.clearTint = p.clearTint0; p.setTint(window.__tint0[0]).setTintMode(window.__tint0[1]); return 1; })()');
        await page.eval('(window.__painted.seeThrough = true, 1)');
        const side = 3 * figH, cx = sil ? (sil[0] + sil[2]) / 2 : box[0] + box[2] / 2, cy = sil ? (sil[1] + sil[3]) / 2 : box[1] + box[3] / 2;
        far = await page.eval<number>(DIFF(a, t, [cx - side / 2, cy - side / 2, side, side], true));
      }
      await page.eval(`(window.__painted.setHold('clock'), 1)`);
      return { n, far, nOff, h: sil ? sil[3] - sil[1] + 1 : 0, sil, fig };
    };
    // the baseline: the figure on the open valley ground, the same probe
    const base0 = await probe(join(outDir, 'probe-valley.png'));
    const vb = base0.sil ? { x: base0.sil[0], y: base0.sil[1], w: base0.sil[2] - base0.sil[0] + 1, h: base0.sil[3] - base0.sil[1] + 1 } : null;
    console.log(JSON.stringify({ n: 0, ok: vb !== null && boxInFrame(vb, base0.fig.view[0], base0.fig.view[1]), bar: 'valley start (info): her whole silhouette is inside the frame', detail: vb ? `silhouette ${vb.w} x ${vb.h} at ${vb.x},${vb.y}: gap to the frame's top ${vb.y} px, smallest gap to any edge ${frameGap(vb, base0.fig.view[0], base0.fig.view[1])} px` : 'no silhouette', ms: 0 }));
    console.log(JSON.stringify({ n: 0, ok: base0.n >= 500, bar: 'figure probe baseline: the figure on the valley\'s open ground is seen by the probe (500 pixels or more)', detail: `on the valley's open ground ${base0.n} pixels change inside the figure's box (${base0.fig.w.toFixed(0)} x ${base0.fig.h.toFixed(0)}) when the figure is hidden; her silhouette there is ${base0.h} px tall`, ms: 0 }));

    // the camera's numbers at the valley start (the phone camera, private #33): the zoom, the canvas, how many device pixels one art pixel is, her silhouette's height and its share of the frame's height
    const cam = await page.eval<{ zoom: number; cw: number; ch: number; css: [number, number]; dpr: number; ratio: number; artPx: number; canvasW: number }>(
      `(() => { const c = window.__game.world.cameras.main, cv = document.querySelector('canvas'); return { zoom: c.zoom, cw: c.width, ch: c.height, css: [window.innerWidth, window.innerHeight], dpr: window.devicePixelRatio, ratio: c.width / window.innerWidth, artPx: c.zoom / 4, canvasW: cv.width }; })()`);
    console.log(JSON.stringify({ n: 0, ok: true, bar: 'camera (info)', detail: `css ${cam.css[0]} x ${cam.css[1]}, device pixel ratio ${cam.dpr}, canvas ${cam.cw} x ${cam.ch} (backing ${cam.canvasW} wide), camera zoom ${cam.zoom} = ${cam.artPx} device px per art px = ${(cam.artPx / (cam.cw / cam.css[0])).toFixed(3)} css px per art px; her silhouette ${base0.h} px tall = ${base0.h / cam.artPx} art px = ${(100 * base0.h / cam.ch).toFixed(1)}% of the frame's height ${cam.ch}; box ${base0.fig.w.toFixed(0)} x ${base0.fig.h.toFixed(0)} centred at ${base0.fig.x.toFixed(0)},${base0.fig.y.toFixed(0)}`, ms: 0 }));
    if (process.env.PREVIEW_MEASURE === '1') { done(true, 'measure only: stopped after the valley start', 'PREVIEW_MEASURE=1'); return 0; }

    // 3. the walk
    const walk = new FreeWalk(page, false);
    await (walk as unknown as { install(): Promise<void> }).install();
    const goalCol = c1 + 2;
    const found = await page.eval<[number, number][] | { diag: string }>(ROUTE(goalCol));
    if (!Array.isArray(found)) return done(false, 'a route of open tiles from the valley start to the cell east of the seam', `none to scene column ${goalCol}: ${found.diag}`) ? 1 : 0;
    const route = found;
    const x0 = st.x0;
    const stops: [number, number][] = [route[0]!];
    for (let i = 1; i < route.length - 1; i++) {
      const [a, b, c] = [route[i - 1]!, route[i]!, route[i + 1]!];
      const turn = b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1];
      const inSeam = b[0] - x0 >= c0 - 1 && b[0] - x0 <= c1 + 1;
      if (turn || inSeam) stops.push(b);
    }
    stops.push(route[route.length - 1]!);
    const stood: number[] = [];
    let shotEnter = false;
    let shotSeam = false;
    let at = 0;
    for (const [tx, ty] of stops.slice(1)) {
      const dist = Math.abs(tx - (stops[at]![0])) + Math.abs(ty - (stops[at]![1]));
      for (let tries = 0; tries < 6; tries++) {
        try {
          await walk.holdTo([tx, ty], `tile ${tx},${ty}`, 6_000 + dist * 900);
        } catch (e) {
          // a walk that timed out: say how the frames ran and what is under the feet, then try again (a slow software-GL frame is not a wall)
          const fr = await page.eval<{ mean: number; n: number }>(FRAMES(1500));
          const f0 = await walk.feet();
          await page.screenshot(join(outDir, 'stuck.png'));
          console.log(JSON.stringify({ n: 0, ok: false, bar: 'walk retry', detail: `${(e as Error).message}; frames mean ${fr.mean.toFixed(0)} ms over ${fr.n}; feet ${f0.map((v) => v.toFixed(1))}; open here ${await page.eval<string>(`String(window.__walk.open(${tx}, ${ty}))`)}`, ms: 0 }));
        }
        const f = await walk.feet();
        if (Math.floor(f[0] / ART_PX) === tx && Math.floor(f[1] / ART_PX) === ty) break;
        if (!(await walk.closeBox())) await sleep(300);
      }
      const f = await walk.feet();
      if (Math.floor(f[0] / ART_PX) !== tx || Math.floor(f[1] / ART_PX) !== ty) {
        await page.screenshot(join(outDir, 'stuck.png'));
        return done(false, 'the feet stand on each stop of the route', `at ${tx},${ty} the feet are at ${f.map((v) => v.toFixed(1))} after ${stops.indexOf([tx, ty] as never)}`) ? 1 : 0;
      }
      stood.push(tx - x0);
      // stills along the way, as the phone shows them (844 x 390): the first stop inside the scene and the seam's middle column
      if (!shotEnter && tx >= x0) { shotEnter = true; await sleep(1500); await page.screenshot(join(outDir, 'enter.png')); }
      if (!shotSeam && tx - x0 >= Math.floor((c0 + c1) / 2)) { shotSeam = true; await sleep(1500); await page.screenshot(join(outDir, 'seam.png')); }
      at = stops.findIndex((s) => s[0] === tx && s[1] === ty);
    }
    await sleep(1500);   // the camera follows the figure with a lag: the still is taken when it has caught up
    const blockUrl = await page.screenshot(join(outDir, 'block.png'));
    const lumaValley = await page.eval<number>(LUMA(valleyUrl));
    const lumaBlock = await page.eval<number>(LUMA(blockUrl));
    const fig = await page.eval<{ x: number; y: number; w: number; h: number; view: [number, number]; vis: boolean; alpha: number; depth: number; py: number; key: string; scale: number[] }>(FIGURE);
    done(lumaValley > 20 && lumaBlock > 20 && inFrame(fig), 'the rig\'s own screenshots show the canvas (mean luma above 20 at the held hour) with the figure in the frame, in the valley and in the block', `mean luma valley ${lumaValley.toFixed(1)}, block ${lumaBlock.toFixed(1)} at minute ${HOLD_MINUTE} (a black canvas reads 0); at the end of the walk the figure's box is ${fig.w.toFixed(0)} x ${fig.h.toFixed(0)} px, centred at screen ${fig.x.toFixed(0)},${fig.y.toFixed(0)} of ${fig.view[0]} x ${fig.view[1]}; sprite ${fig.key} visible ${fig.vis} alpha ${fig.alpha} depth ${fig.depth} y ${fig.py.toFixed(0)} scale ${fig.scale.map((v) => v.toFixed(2))}`);
    const last = route[route.length - 1]!;
    const seamCols = [...new Set(stood.filter((c) => c >= c0 && c <= c1))];
    const left = route.find((t) => t[0] >= x0)?.[0];
    const ok3 = last[0] - x0 > c1 && left !== undefined && seamCols.length === c1 - c0 + 1;
    if (!done(ok3, 'the figure walks from the valley out by the lane into the block and stands on every column of the seam\'s span',
      `${route.length - 1} tiles from ${route[0]} to ${last} (scene cell ${last[0] - x0},${last[1] - 1}), entered the scene at column ${left === undefined ? '?' : left - x0}, seam columns ${c0}-${c1}: stood on ${seamCols.length} of ${c1 - c0 + 1}`)) return 0;

    // 4. frame time and errors
    const inBlock = await page.eval<{ mean: number; p95: number; n: number; fps: number | null }>(FRAMES(8000));
    const errs = [...page.errors.filter((e) => !/favicon/.test(e)), ...refused];
    const ok4 = errs.length === 0 && inBlock.n >= 2;
    done(ok4, '0 console or page errors over the whole run; the frame time is printed',
      `frame time in the block: mean ${inBlock.mean.toFixed(1)} ms, 95th percentile ${inBlock.p95.toFixed(1)} ms over ${inBlock.n} frames (actualFps ${inBlock.fps === null ? '?' : inBlock.fps.toFixed(0)}); errors ${JSON.stringify(errs.slice(0, 3))}`);

    // 5. every seam, both ways, at each hour: the block command's walker on the preview's own mount
    const crossFile = process.env.PREVIEW_CROSSINGS;
    if (crossFile) {
      const fwd = (JSON.parse(readFileSync(crossFile, 'utf8')) as { crossings: Crossing[] }).crossings;
      const all: Crossing[] = [...fwd, ...fwd.map((x) => ({ ...x, route: [...x.route].reverse(), first: false, back: true }))];
      const hours = (process.env.PREVIEW_HOURS ?? '780,1050').split(',').map(Number);
      const y0 = await page.eval<number>('window.__painted.y0');
      const w2 = new FreeWalk(page, false);
      await (w2 as unknown as { install(): Promise<void> }).install();
      let walks = 0;
      const stuck: string[] = [];
      const stills: { name: string; n: number; share: number; inFrame: boolean; gapTop: number; gap: number; hShare: number; far?: number; nOff?: number }[] = [];
      const taken = new Set<string>();
      const t5 = Date.now();
      for (const m of hours) {
        await page.eval(`window.__painted.setMinute(${m})`);
        await page.waitFor(`Math.abs(window.__painted.litMinute - ${m}) <= 3`, `the light at minute ${m}`, 90_000);
        for (const c of all) {
          const key = `${c.seam}${c.back ? '-back' : ''}`;
          const name = `still-${key}-${m === 780 ? '1300' : m === 1050 ? '1730' : String(m)}`;
          const want = !taken.has(`${name}`);
          let got: { n: number; far?: number; nOff?: number; h: number; sil: [number, number, number, number] | null; fig: Awaited<ReturnType<typeof figureNow>> } | null = null;
          const r = await walkCrossing(page, w2, c, st.x0, y0, want ? async (): Promise<string> => { await sleep(900); got = await probe(join(outDir, `${name}.png`), process.env.PREVIEW_TWIN ? join(outDir, `${name}-off.png`) : undefined, base0.h); return ''; } : undefined);
          walks += 1;
          if (!r.ok) stuck.push(`${key} at ${m}: ${r.detail}`);
          if (want && got) {
            taken.add(name);
            const g = got as { n: number; far?: number; nOff?: number; h: number; sil: [number, number, number, number] | null; fig: Awaited<ReturnType<typeof figureNow>> };
            // her whole silhouette (the magenta pixels of her sprite) inside the frame: top at or below the frame's top, feet at or above its bottom, both sides inside (the middle of her box inside was a pass for a head cut by the top)
            const sb = g.sil ? { x: g.sil[0], y: g.sil[1], w: g.sil[2] - g.sil[0] + 1, h: g.sil[3] - g.sil[1] + 1 } : null;
            const [fw, fh] = g.fig.view;
            stills.push({ name, n: g.n, share: g.n / Math.max(base0.n, 1), inFrame: sb !== null && boxInFrame(sb, fw, fh), gapTop: sb ? sb.y : -9999, gap: sb ? frameGap(sb, fw, fh) : -9999, hShare: sb ? sb.h / fh : 0, far: g.far, nOff: g.nOff });
          }
        }
      }
      const seamsSeen = [...new Set(all.map((x) => x.seam))];
      done(stuck.length === 0 && walks === all.length * hours.length, 'the figure crosses every seam of the block in both directions, at every hour, the feet on every cell of every route',
        `${walks - stuck.length} of ${all.length * hours.length} walks good (${fwd.length} crossings of ${seamsSeen.length} seams, both ways, at minutes ${hours.join(', ')}), ${((Date.now() - t5) / 1000).toFixed(0)} s${stuck.length ? '; stuck: ' + stuck.slice(0, 3).join(' | ') : ''}`);
      const hidden = stills.filter((x) => x.share < 0.5);
      for (const x of stills) console.log(JSON.stringify({ n: 0, ok: true, bar: 'still (info)', detail: `${x.name}: ${x.n} figure pixels (${(x.share * 100).toFixed(0)}% of the open-ground baseline), whole silhouette in frame ${x.inFrame} (gap to the frame's top ${x.gapTop} px, smallest gap to any edge ${x.gap} px, ${(x.hShare * 100).toFixed(1)}% of the frame's height)${x.nOff === undefined ? '' : `, with see-through off ${x.nOff} px (${(x.nOff / Math.max(base0.n, 1) * 100).toFixed(0)}%)`}${x.far === undefined ? '' : `, ${x.far} pixels differ from the see-through-off twin outside 3 figure heights`}`, ms: 0 }));
      done(stills.length > 0 && stills.every((x) => x.inFrame), 'her whole silhouette is inside the frame at every still (top at or below the frame\'s top, feet at or above its bottom, both sides inside)',
        `${stills.filter((x) => x.inFrame).length} of ${stills.length} stills with the whole figure inside the frame, smallest gap to the frame's top ${Math.min(...stills.map((x) => x.gapTop))} px, smallest gap to any edge ${Math.min(...stills.map((x) => x.gap))} px, her height ${(Math.min(...stills.map((x) => x.hShare)) * 100).toFixed(1)}-${(Math.max(...stills.map((x) => x.hShare)) * 100).toFixed(1)}% of the frame; hidden behind an object (under half of the baseline's pixels): ${hidden.length} of ${stills.length}${hidden.length ? ' (' + hidden.map((x) => x.name.replace('still-', '') + ' ' + (x.share * 100).toFixed(0) + '%').join(', ') + ')' : ''}`);
      const twins = stills.filter((x) => x.far !== undefined);
      if (twins.length) done(twins.every((x) => x.far === 0), 'nothing far from the figure fades: outside a box of 3 figure heights around her the still equals its see-through-off twin',
        `${twins.filter((x) => x.far === 0).length} of ${twins.length} stills equal outside the box${twins.some((x) => x.far !== 0) ? '; differ: ' + twins.filter((x) => x.far !== 0).map((x) => x.name.replace('still-', '') + ' ' + x.far + ' px').join(', ') : ''}`);
    }
    {
      const errsEnd = [...page.errors.filter((e) => !/favicon/.test(e)), ...refused];
      done(errsEnd.length === 0, '0 console or page errors over the whole run, the walks across the seams included', `errors ${JSON.stringify(errsEnd.slice(0, 3))}`);
    }
    return 0;
  } catch (e) {
    done(false, 'the run went through', `${(e as Error).message}`);
    return 0;
  } finally {
    await browser.close();
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.log(JSON.stringify({ n: 0, ok: false, bar: 'the preview rig ran', detail: String(e), ms: 0 }));
    process.exit(0);
  },
);
