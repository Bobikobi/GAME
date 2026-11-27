/**
 * The first light of a painted land on a phone's network (V5b, private #44): how long from the page's request, and from the wake-up tap, until the land the player stands in is drawn,
 * what crossed the wire for it, and what it holds in textures.
 *
 *   [STREAM_NET=fast|slow|none] [STREAM_CPU=4] [STREAM_WALK=x,y;x,y;...] tsx game/e2e/stream.ts SCENE_DIR DIST_DIR OUT_DIR
 *
 * It serves DIST_DIR (scripts, styles and data gzipped, as a real host does; pictures as they are) and the scene folder at /painted/<id>/, opens
 * `?debug&seed=7&frame=off&painted=<id>&base=1&zoom=auto` at the phone's landscape size (844 x 390) with the cache off, the network held at Fast 4G (9 Mbps down, 170 ms;
 * `slow`: Slow 4G, 1.6 Mbps, 150 ms; `none`: no throttle) and the CPU 4x slower, and taps through the title at once. One JSON line per station:
 *
 *   title       ms from the request to the title screen
 *   light       ms from the request and from the wake-up tap to the first light: the mount lit and, on a streamed land, the standing unit lit (`__painted.stream`)
 *   wire        bytes over the wire: all, and the painted folder's
 *   textures    bytes held in textures (w x h x 4 of every texture source): all, the painted ones, and the stream's own counter when the land streams
 *   clear       pixels of the clear colour in the canvas's still at first light (the camera's background painted #ff00fe, a colour no art uses; the DOM over the canvas hidden)
 *   walk        [STREAM_WALK] the player carried tile by tile along the route (scene px): at each step the clear-colour pixels and the stream's bytes; the step's wait on a unit
 *   frames      with the network and CPU let go: the frame interval's mean and p95 over 8 s
 *   errors      the console and page errors over the run
 *
 * Stills go to OUT_DIR. The browser is closed by its handle in `finally`.
 */
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Browser, type Page, byText, sleep } from './cdp';

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const ZIP = new Set(['.html', '.js', '.css', '.json', '.svg']);
const say = (o: object): void => console.log(JSON.stringify(o));
const NETS: Record<string, { down: number; latency: number } | undefined> = { fast: { down: 9e6 / 8, latency: 170 }, slow: { down: 1.6e6 / 8, latency: 150 }, none: undefined };
/** the clear colour the rig gives the world's camera (no art uses it; the game's own ink, #1b1a2e, is a palette colour the art uses too) */
const CLEAR = [0xff, 0x00, 0xfe];
const PAINT_CLEAR = `(() => { const w = window.__game.world; w.cameras.main.setBackgroundColor('#ff00fe'); return 1; })()`;

function serve(dist: string, id: string, sceneDir: string): Promise<{ server: Server; url: string }> {
  const zipped = new Map<string, Buffer>();
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0] as string);
      const pre = `/painted/${id}/`;
      const file = path.startsWith(pre) ? join(sceneDir, path.slice(pre.length)) : join(dist, path === '/' ? 'index.html' : path);
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        res.end();
        return;
      }
      const ext = extname(file);
      const head: Record<string, string> = { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' };
      if (ZIP.has(ext) && /gzip/.test(String(req.headers['accept-encoding'] ?? ''))) {
        let z = zipped.get(file);
        if (!z) zipped.set(file, (z = gzipSync(readFileSync(file))));
        res.writeHead(200, { ...head, 'content-encoding': 'gzip' });
        res.end(z);
        return;
      }
      res.writeHead(200, head);
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${(server.address() as { port: number }).port}/` }));
  });
}

/** the textures held: every source's w x h x 4, all and the painted ones */
const TEXTURES = `(() => { const list = window.__game.world.textures.list; let all = 0, painted = 0; const big = [];
  for (const k of Object.keys(list)) { let n = 0; for (const s of list[k].source ?? []) n += (s.width || 0) * (s.height || 0) * 4; all += n; if (k.startsWith('painted:')) painted += n; if (n > 8e6) big.push([k, Math.round(n / 1e5) / 10]); }
  const st = window.__painted && window.__painted.stream; return { all, painted, stream: st ? st.bytes : null, peak: st ? st.peak : null, big: big.sort((a, b) => b[1] - a[1]).slice(0, 14) }; })()`;

/** a still of the canvas alone: every DOM element over it hidden (the HUD's panels are drawn in the clear colour's ink) */
async function canvasStill(page: Page, path: string): Promise<string> {
  await page.eval(`(() => { const s = document.createElement('style'); s.id = '__only-canvas'; s.textContent = '* { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(s); return 1; })()`);
  await sleep(120);
  const url = await page.screenshot(path);
  await page.eval(`(document.getElementById('__only-canvas')?.remove(), 1)`);
  return url;
}

/** the pixels of the clear colour in a still (data URL), the HUD's top and bottom strips (`cut` css px) left out */
const CLEARS = (url: string, cut: number): string => `new Promise((resolve) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; const y0 = ${cut}, y1 = c.height - ${cut}; let first = null;
  for (let y = y0; y < y1; y++) for (let i = y * c.width * 4, e = (y + 1) * c.width * 4; i < e; i += 4) if (d[i] === ${CLEAR[0]} && d[i + 1] === ${CLEAR[1]} && d[i + 2] === ${CLEAR[2]}) { n++; if (!first) first = [(i / 4) % c.width, y]; }
  resolve({ n, first }); }; im.src = ${JSON.stringify(url)}; })`;

const LIT = `(() => { const p = window.__painted; if (!p || !window.__game?.session) return false; if (p.litMinute < 0) return false; const st = p.stream; return !st || st.standingLit(); })()`;

async function main(): Promise<number> {
  const [sceneDir, dist, out] = process.argv.slice(2).map((p) => resolve(p)) as [string, string, string];
  mkdirSync(out, { recursive: true });
  const scene = JSON.parse(readFileSync(join(sceneDir, 'scene.json'), 'utf8')) as { id: string };
  const { server, url } = await serve(dist, scene.id, sceneDir);
  const net = NETS[process.env.STREAM_NET ?? 'fast'];
  const cpu = Number(process.env.STREAM_CPU ?? 4);
  const browser = await Browser.launch();
  let pageRef: Page | undefined;
  try {
    const page = await browser.newPage({ width: 844, height: 390, mobile: false });
    pageRef = page;
    await page.send('Network.enable');
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (net) await page.send('Network.emulateNetworkConditions', { offline: false, latency: net.latency, downloadThroughput: net.down, uploadThroughput: net.down / 2 });
    if (cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    let t0 = Date.now();
    const urls = new Map<string, string>();
    let wire = 0;
    let wirePainted = 0;
    page.on('Network.requestWillBeSent', (p) => urls.set(String(p.requestId), String((p.request as { url: string }).url)));
    const timeline: { url: string; start: number; end?: number; bytes?: number }[] = [];
    const byId = new Map<string, (typeof timeline)[number]>();
    page.on('Network.requestWillBeSent', (p) => {
      const e = { url: String((p.request as { url: string }).url).replace(url, '/'), start: Date.now() - t0 };
      timeline.push(e);
      byId.set(String(p.requestId), e);
    });
    page.on('Network.loadingFinished', (p) => {
      const e = byId.get(String(p.requestId));
      if (e) {
        e.end = Date.now() - t0;
        e.bytes = Number(p.encodedDataLength ?? 0);
      }
    });
    page.on('Network.loadingFinished', (p) => {
      const n = Number(p.encodedDataLength ?? 0);
      wire += n;
      if ((urls.get(String(p.requestId)) ?? '').includes(`/painted/${scene.id}/`)) wirePainted += n;
    });
    if (process.env.STREAM_PROFILE) {
      await page.send('Profiler.enable');
      await page.send('Profiler.setSamplingInterval', { interval: 1000 });
      await page.send('Profiler.start');
    }
    t0 = Date.now();
    // STREAM_PLAIN=1: the game without the painted land (the floor under first light: what the page costs before any of the land)
    const query = process.env.STREAM_PLAIN === '1' ? '?debug&seed=7&frame=off' : `?debug&seed=7&frame=off&painted=${scene.id}&base=1&zoom=auto${process.env.STREAM_EXTRA ?? ''}`;
    const nav = page.send('Page.navigate', { url: `${url}${query}` });
    await nav;
    await page.waitFor(`!!document.querySelector('.title-screen button') || !!window.__fail`, 'the title screen', 300_000, false);
    const tTitle = Date.now() - t0;
    say({ station: 'title', ms: tTitle, wire_mb: +(wire / 1e6).toFixed(2), painted_mb: +(wirePainted / 1e6).toFixed(2) });
    const stopProfile = async (): Promise<void> => {
      if (!process.env.STREAM_PROFILE) return;
      const { profile } = await page.send<{ profile: unknown }>('Profiler.stop');
      writeFileSync(join(out, 'boot.cpuprofile'), JSON.stringify(profile));
    };
    if (process.env.STREAM_PLAIN === '1') {
      await stopProfile();
      if (process.env.STREAM_TIMELINE) writeFileSync(join(out, 'timeline.json'), JSON.stringify(timeline, null, 0));
      return 0;
    }
    // the title's buttons hold still only once the boot's uploads are done: on 4x CPU that took 17 s after the title showed
    await page.tapWhere(byText('.title-screen button', 'New game'), 'New game', 180_000);
    await page.waitFor(`!!document.querySelector('.card.race')`, 'the race cards', 60_000, false);
    const tWake = Date.now();
    await page.tapWhere(byText('.title-screen button', 'Wake up'), 'Wake up', 60_000);
    await page.waitFor(`!!window.__game?.world?.cameras?.main`, 'the world', 60_000, false);
    await page.eval(PAINT_CLEAR);
    await page.waitFor(LIT, 'the first light', 300_000, false);
    const tLight = Date.now();
    await stopProfile();
    if (process.env.STREAM_TIMELINE) writeFileSync(join(out, 'timeline.json'), JSON.stringify(timeline, null, 0));
    say({ station: 'light', from_request_s: +((tLight - t0) / 1000).toFixed(2), from_tap_s: +((tLight - tWake) / 1000).toFixed(2), net: process.env.STREAM_NET ?? 'fast', cpu });
    // the boot's own marks (main.ts, boot.ts, world.ts), seconds from the page's start
    const marks = await page.eval<[string, number][]>(`performance.getEntriesByType('mark').filter((m) => m.name.startsWith('boot:')).map((m) => [m.name.slice(5), +(m.startTime / 1000).toFixed(2)])`);
    say({ station: 'marks', s: Object.fromEntries(marks), tap_s: +((tWake - t0) / 1000).toFixed(2) });
    // the camera's view at first light in the land's own pixels (scene px: the world's px times 4, from the land's corner), so a unit's size is read against it
    say({ station: 'view', ...(await page.eval<Record<string, number>>(`(() => { const v = __game.world.cameras.main.worldView; const p = window.__painted; const ox = p.x0 * 16, oy = p.y0 * 16; return { x: Math.round((v.x - ox) * 4), y: Math.round((v.y - oy) * 4), w: Math.round(v.width * 4), h: Math.round(v.height * 4), zoom: +__game.world.cameras.main.zoom.toFixed(3) }; })()`)) });
    say({ station: 'wire', all_mb: +(wire / 1e6).toFixed(2), painted_mb: +(wirePainted / 1e6).toFixed(2) });
    const tex = await page.eval<{ all: number; painted: number; stream: number | null; peak: number | null; big: [string, number][] }>(TEXTURES);
    say({ station: 'textures', all_mb: +(tex.all / 1e6).toFixed(1), painted_mb: +(tex.painted / 1e6).toFixed(1), stream_mb: tex.stream === null ? null : +(tex.stream / 1048576).toFixed(1), big_mb: tex.big });
    await page.screenshot(join(out, 'first-light.png'));
    const cl = await page.eval<{ n: number; first: [number, number] | null }>(CLEARS(await canvasStill(page, join(out, 'first-light-canvas.png')), 0));
    say({ station: 'clear', at: 'first light', pixels: cl.n, first: cl.first });
    let worstClear = cl.n;
    let worstBytes = tex.stream ?? 0;
    if (process.env.STREAM_RUN) {
      // STREAM_RUN="KEY:ms;KEY:ms": she walks by the keys (ArrowRight for 9000 ms, ...) on the net as set. Every 250 ms the rig asks whether all she sees is lit; a frame that
      // is not gets a still and its clear pixels counted. The mount's own hold at an unlit unit's edge (painted.ts holdsWalk) is reported as its longest hold.
      let unlit = 0;
      let samples = 0;
      let k = 0;
      for (const leg of process.env.STREAM_RUN.split(';')) {
        const [key, ms] = leg.split(':') as [string, string];
        await page.key(key, 'keyDown');
        const end = Date.now() + Number(ms);
        while (Date.now() < end) {
          await sleep(250);
          samples++;
          const v = await page.eval<{ lit: boolean; at: [number, number] }>(`(() => { const p = window.__painted; const b = __game.world.body; return { lit: !p.stream || p.stream.standingLit(), at: [Math.round(b.x * 4 - p.x0 * 64), Math.round(b.y * 4 - p.y0 * 64)] }; })()`);
          if (v.lit) continue;
          unlit++;
          const still = await canvasStill(page, join(out, `run-${String(k++).padStart(2, '0')}.png`));
          const c = await page.eval<{ n: number; first: [number, number] | null }>(CLEARS(still, 0));
          worstClear = Math.max(worstClear, c.n);
          say({ station: 'run-unlit', at: v.at, clear: c.n });
        }
        await page.key(key, 'keyUp');
      }
      const end = await page.eval<{ at: [number, number]; held: number; mb: number | null }>(`(() => { const p = window.__painted; const b = __game.world.body; return { at: [Math.round(b.x * 4 - p.x0 * 64), Math.round(b.y * 4 - p.y0 * 64)], held: Math.round(p.heldLongest), mb: p.stream ? +(p.stream.bytes / 1048576).toFixed(1) : null }; })()`);
      worstBytes = Math.max(worstBytes, (end.mb ?? 0) * 1048576);
      say({ station: 'run-end', samples, unlit, worst_clear: worstClear, at: end.at, longest_hold_ms: end.held, stream_mb: end.mb });
    }
    if (process.env.STREAM_WALK) {
      // STREAM_MINUTE holds the hour for the walk's stills (a whole run and a streamed one compare at the same light); STREAM_LOOK moves the camera instead of the figure
      if (process.env.STREAM_MINUTE) {
        const m = Number(process.env.STREAM_MINUTE);
        await page.eval(`window.__painted.setMinuteFirstDay(${m})`);
        await page.waitFor(`window.__painted.litMinute === ${m}`, `the light at minute ${m}`, 30_000, false);
      }
      const route = process.env.STREAM_WALK.split(';').map((s) => s.split(',').map(Number) as [number, number]);
      let held = 0;
      for (const [k, [x, y]] of route.entries()) {
        // carried to the point; a streamed land then gets up to 3 s for the unit she stands in (the step's own hold)
        await page.eval(`(() => { const p = window.__painted; p.lookAt(${x}, ${y}); return 1; })()`);
        const t = Date.now();
        await page.waitFor(`(() => { const st = window.__painted.stream; return !st || st.standingLit(); })()`, 'the units in view', 30_000, false).catch(() => undefined);
        held = Math.max(held, Date.now() - t);
        // the work after first light (the shade, the water, the pieces' alpha) for a still that compares with the whole land's
        if (process.env.STREAM_MINUTE) await page.waitFor(`window.__painted.deferredDone()`, 'the deferred work', 30_000, false).catch(() => undefined);
        await sleep(400);
        // the camera centred again just before the still: a still that compares with another run's stands at the same spot whatever moved the camera meanwhile
        await page.eval(`(() => { window.__painted.lookAt(${x}, ${y}); return 1; })()`);
        await sleep(100);
        const s = await canvasStill(page, join(out, `walk-${String(k).padStart(2, '0')}.png`));
        const c = await page.eval<{ n: number; first: [number, number] | null }>(CLEARS(s, 0));
        const b = await page.eval<number | null>(`window.__painted.stream ? window.__painted.stream.bytes : null`);
        worstClear = Math.max(worstClear, c.n);
        worstBytes = Math.max(worstBytes, b ?? 0);
        say({ station: 'walk', k, at: [x, y], clear: c.n, first: c.first, stream_mb: b === null ? null : +(b / 1048576).toFixed(1) });
      }
      say({ station: 'walk-end', worst_clear: worstClear, worst_stream_mb: +(worstBytes / 1048576).toFixed(1), longest_hold_ms: held });
      // STREAM_EVAL: an expression read in the page after the walk, for a probe (printed as is)
      if (process.env.STREAM_EVAL) say({ station: 'eval', value: await page.eval<unknown>(process.env.STREAM_EVAL) });
    }
    if (net) await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    if (cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await sleep(1500);
    const fr = await page.eval<{ mean: number; p95: number; n: number }>(`new Promise((resolve) => { const t = []; let last = performance.now(); const end = last + 8000; const f = (now) => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else { t.shift(); t.sort((a, b) => a - b); resolve({ mean: t.reduce((a, b) => a + b, 0) / Math.max(t.length, 1), p95: t[Math.floor(t.length * 0.95)] ?? 0, n: t.length }); } }; requestAnimationFrame(f); })`);
    say({ station: 'frames', mean_ms: +fr.mean.toFixed(2), p95_ms: +fr.p95.toFixed(2), n: fr.n });
    // the opening view again once the work deferred past first light (the pieces' alpha, the wall shade) has landed: the frame a player sees after the first seconds
    if (!process.env.STREAM_WALK) await canvasStill(page, join(out, 'settled-canvas.png'));
    // the wind: how many pieces lean and how many of them are off their rest now (a streamed land bakes each unit's after first light)
    say({ station: 'wind', ...(await page.eval<Record<string, number>>(`(() => { const p = window.__painted; const l = p.leansNow(); return { leaners: l.length, swaying: l.filter((x) => x.k !== 0).length, covers: p.coverList().length }; })()`)) });
    const errs = page.errors.filter((e) => !/favicon/.test(e));
    say({ station: 'errors', n: errs.length, first: errs.slice(0, 5) });
    say({ station: 'end', firstlight_tap_s: +((tLight - tWake) / 1000).toFixed(2), firstlight_request_s: +((tLight - t0) / 1000).toFixed(2), stream_mb: tex.stream === null ? null : +(worstBytes / 1048576).toFixed(1), textures_mb: +(tex.all / 1e6).toFixed(1), wire_mb: +(wire / 1e6).toFixed(2), clear: worstClear, errors: errs.length });
  } catch (e) {
    const page = pageRef;
    if (page) {
      await page.screenshot(join(out, 'fail.png')).catch(() => undefined);
      const text = await page.eval<string>(`document.body.innerText.slice(0, 400)`).catch(() => '');
      say({ station: 'fail', text, errors: page.errors.slice(0, 5) });
    }
    throw e;
  } finally {
    await browser.close();
    server.close();
  }
  return 0;
}

main().then((c) => process.exit(c), (e) => {
  say({ station: 'end', ok: false, detail: `the stream rig did not run: ${String(e)}` });
  process.exit(1);
});

