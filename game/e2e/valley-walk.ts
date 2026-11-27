/**
 * The valley's frame-time walk (charter rows G8 / B3): the first ten minutes' route walked for a fixed time with the CPU slowed, on a phone
 * viewport and a desktop one, against a local build or a deployed page, best of N. It MEASURES; it is not a gate (it is slow, and a
 * headless browser on software GL inflates ordinary frames, so only the freezes compare between builds). Not part of CI's e2e.
 *
 *   pnpm perf:valley [--runs 2] [--url https://loomvale.vercel.app/play/] [--viewport phone|desktop|all] [--secs 40] [--cpu 4]
 *                    [--dist game/dist] [--out dir] [--label name]
 *
 * One cold browser per run (a fresh profile: nothing cached). The save is fixed: the west-bank wake (seed 6), the name cut, the bridge mended
 * by hand off the clock (the keystone put in the bag, the walk to the bridge, the act the Mend button makes), and the feet back on the wake
 * tile. The window then walks the opening e2e's route with the opening's own planner (`__e2e.plan`, opening.ts IN_PAGE): the bridge, the camp
 * fire, the town square (one step in, the word in town closed), the ruined house at the town's edge, the night ruins' gate, and round again
 * until the time is up. Only that window has the CPU slowed; the boot is timed at full speed.
 *
 * One JSON per run in <out> (valley-walk-<label>-<viewport>-<n>.json, with the raw frames), and one summary line per run and per viewport's
 * best on stdout. The best run is the one with the shortest freeze, then the fewest frames over 50 ms, then the fewest over 20 ms (frame-stats.ts bestOf);
 * every run's own JSON stays, so the other runs' freezes are not lost to the best-of.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { loadavg, cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, sleep, type Page, type Viewport } from './cdp';
import { bestOf, bootBytes, stopsOf, summarize, type FrameLog, type FrameSummary } from './frame-stats';
import { START, closeBoxes, serve, wake } from './frame-probe';
import { DESKTOP, PHONE } from './viewports';
import { type Dir, FreeWalk, VEC } from './walk';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORTS: Record<string, Viewport> = { phone: PHONE, desktop: DESKTOP };

interface Options {
  runs: number;
  url: string | null;
  viewports: string[];
  secs: number;
  cpu: number;
  dist: string;
  out: string;
  label: string;
}

function parseArgs(argv: readonly string[]): Options {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const viewport = get('viewport') ?? 'all';
  const url = get('url') ?? null;
  const o: Options = {
    runs: Number(get('runs') ?? 2),
    url: url ? (url.endsWith('/') ? url : `${url}/`) : null,
    viewports: viewport === 'all' ? ['phone', 'desktop'] : [viewport],
    secs: Number(get('secs') ?? 40),
    cpu: Number(get('cpu') ?? 4),
    dist: resolve(get('dist') ?? join(GAME_DIR, 'dist')),
    out: resolve(get('out') ?? join(GAME_DIR, '..', '.scratch', 'valley-walk')),
    label: get('label') ?? (url ? new URL(url).hostname.split('.')[0]! : 'local'),
  };
  if (!(o.runs >= 1) || !(o.secs > 0) || !(o.cpu >= 1) || o.viewports.some((v) => !VIEWPORTS[v])) {
    throw new Error('usage: pnpm perf:valley [--runs N>=1] [--url URL] [--viewport phone|desktop|all] [--secs S>0] [--cpu K>=1] [--dist DIR] [--out DIR] [--label NAME]');
  }
  return o;
}

/** In the page, before it loads: when the title, the built valley and the woken character first show, with the bytes fetched by then. */
const BOOT_MARKS = `(() => {
  const M = (window.__boot = {});
  // the default buffer holds 250 entries and the boot fetches more: the bytes at a moment would stop counting at the 250th
  performance.setResourceTimingBufferSize(5000);
  const snap = () => {
    const all = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
    return { ms: performance.now(), entries: all.map((e) => [e.transferSize || 0, e.decodedBodySize || 0]) };
  };
  const mark = (k) => { if (!M[k]) M[k] = snap(); };
  const look = () => {
    try {
      if (document.querySelector('.title-screen button')) mark('title');
      const g = window.__game;
      if (g && g.world) mark('built');
      if (g && g.session && g.session.started) { mark('play'); return true; }
    } catch (e) {}
    return false;
  };
  new MutationObserver(() => { look(); }).observe(document, { childList: true, subtree: true });
  const id = setInterval(() => { if (look()) clearInterval(id); }, 5);
})()`;

interface Marks {
  [k: string]: { ms: number; entries: [number, number][] } | undefined;
}

interface Plan {
  path: Dir[];
  face: Dir;
  goal: [number, number];
}

interface Leg {
  to: string;
  state: 'ok' | 'no-route' | 'stuck' | 'time';
  from_s: number;
  to_s: number;
}

const mb = (bytes: number): number => Number((bytes / 1048576).toFixed(1));

async function heap(page: Page): Promise<{ used_mb: number; retained_mb: number; nodes: number }> {
  const read = async (): Promise<Record<string, number>> => {
    const r = await page.send<{ metrics: { name: string; value: number }[] }>('Performance.getMetrics');
    return Object.fromEntries(r.metrics.map((m) => [m.name, m.value]));
  };
  const before = await read();
  await page.send('HeapProfiler.collectGarbage');
  const after = await read();
  return { used_mb: mb(before.JSHeapUsedSize ?? 0), retained_mb: mb(after.JSHeapUsedSize ?? 0), nodes: after.Nodes ?? 0 };
}

/** One walk to a place: plan it with the opening's planner, hold to each turning tile, and plan again from where the body stands when a step does not land (three tries). */
async function leg(page: Page, walk: FreeWalk, rect: object, deadline: number, enter: boolean): Promise<Leg['state']> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const plan = await page.eval<Plan | null>(`__e2e.plan(${JSON.stringify(rect)})`);
    if (!plan) return 'no-route';
    const from = await page.eval<[number, number]>('__e2e.state().pos');
    let landed = true;
    for (const stop of stopsOf(from, plan.path)) {
      if (Date.now() >= deadline) return 'time';
      await walk.holdTo(stop, `stop ${stop.join(',')}`, 20_000);
      const pos = await page.eval<[number, number]>('__e2e.state().pos');
      if (pos[0] !== stop[0] || pos[1] !== stop[1]) {
        if (!(await walk.closeBox())) await sleep(200);
        landed = false;
        break;
      }
    }
    if (!landed) continue;
    if (enter && Date.now() < deadline) {
      // one step on into what was walked to: the word in town opens a box, which a player taps away
      const into: [number, number] = [plan.goal[0] + VEC[plan.face][0], plan.goal[1] + VEC[plan.face][1]];
      if (await page.eval<boolean>(`__e2e.open(${into[0]}, ${into[1]}, [${plan.goal[0]}, ${plan.goal[1]}])`)) {
        await walk.holdTo(into, 'one step in', 10_000);
        await sleep(300);
        if (!(await walk.closeBox())) await closeBoxes(page);
      }
    }
    return 'ok';
  }
  return 'stuck';
}

/** The setup that is off the clock: the keystone, the walk to the bridge and the mend the button makes, the box after it closed, the feet back on the wake tile. */
async function mendBridge(page: Page, walk: FreeWalk, wakeTile: [number, number]): Promise<void> {
  await page.eval(`(() => { const p = window.__game.session.state.player; p.bag['core/keystone'] = (p.bag['core/keystone'] ?? 0) + 1; return 1; })()`);
  const bridge = await page.eval<object>(`__e2e.slot('core/old-bridge')`);
  const state = await leg(page, walk, bridge, Date.now() + 60_000, false);
  if (state !== 'ok') throw new Error(`setup: the walk to the bridge ended ${state}`);
  const standing = await page.eval<[number, number]>('__e2e.state().pos');
  const done = await page.eval<boolean>(`(() => { const r = window.__game.session.act({ t: 'restore', restore: 'core/old-bridge', at: ${JSON.stringify(standing)} }); return !!r && r.ok !== false; })()`);
  if (!done) throw new Error('setup: the game refused the mend');
  await page.waitFor(`!window.__game.session.busy`, 'the mend to finish', 30_000);
  await sleep(500);
  await closeBoxes(page);
  const back = await page.eval<boolean>(`__e2e.plan({ x: ${wakeTile[0]}, y: ${wakeTile[1]}, w: 1, h: 1 }) !== null`);
  if (!back) throw new Error('setup: no way back to the wake tile');
  const home = await leg(page, walk, { x: wakeTile[0], y: wakeTile[1], w: 1, h: 1 }, Date.now() + 60_000, false);
  if (home !== 'ok') throw new Error(`setup: the walk back to the wake tile ended ${home}`);
}

interface RunResult {
  summary: FrameSummary;
  json: Record<string, unknown>;
}

async function playOne(openingInPage: string, browser: Browser, url: string, name: string, viewport: Viewport, o: Options, n: number): Promise<RunResult> {
  const page = await browser.newPage(viewport);
  const net = { requests: 0, transfer: 0, decoded: 0 };
  await page.send('Network.enable');
  page.on('Network.requestWillBeSent', () => void (net.requests += 1));
  page.on('Network.loadingFinished', (p) => void (net.transfer += Number(p.encodedDataLength ?? 0)));
  page.on('Network.dataReceived', (p) => void (net.decoded += Number(p.dataLength ?? 0)));
  await page.send('Performance.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: BOOT_MARKS });
  const load1 = loadavg()[0]!;
  const started = new Date().toISOString();

  await wake(page, url);
  const marks = await page.eval<Marks>('window.__boot');
  const atPlay = { ...net };
  const bootHeap = await heap(page);

  await page.eval(openingInPage);
  const walk = new FreeWalk(page, viewport.mobile);
  const wakeTile = await page.eval<[number, number]>('__e2e.state().pos');
  await mendBridge(page, walk, wakeTile);
  const dayMs = await page.eval<number>('window.__game.bundle.params.day_length_ms');
  // the route, from the opening's own order: the bridge, the camp fire, the town square, the ruined house, the night ruins' gate
  const rects = await page.eval<{ to: string; rect: object; enter: boolean }[]>(`(() => {
    const slot = (id) => __e2e.slot(id), camp = slot('core/camp');
    return [
      { to: 'core/old-bridge', rect: slot('core/old-bridge'), enter: false },
      { to: 'core/camp (the fire)', rect: { x: camp.x + 2, y: camp.y + 2, w: 1, h: 1 }, enter: false },
      { to: 'core/town-square', rect: slot('core/town-square'), enter: true },
      { to: 'core/town-edge (the ruined house)', rect: slot('core/town-edge'), enter: false },
      { to: 'core/ruins-gate', rect: slot('core/ruins-gate'), enter: false },
    ];
  })()`);

  await sleep(1500);
  const start = await heap(page);
  if (o.cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: o.cpu });
  await page.eval(START);
  const t0 = Date.now();
  const deadline = t0 + o.secs * 1000;
  const legs: Leg[] = [];
  let guard = 0;
  while (Date.now() < deadline && guard < 40) {
    const target = rects[guard % rects.length]!;
    guard += 1;
    const from_s = (Date.now() - t0) / 1000;
    let state: Leg['state'];
    try {
      state = await leg(page, walk, target.rect, deadline, target.enter);
    } catch (e) {
      console.error(`[${name} #${n}] leg to ${target.to}: ${String(e).slice(0, 100)}`);
      state = 'stuck';
      await walk.release();
      await walk.closeBox();
    }
    legs.push({ to: target.to, state, from_s: Number(from_s.toFixed(1)), to_s: Number(((Date.now() - t0) / 1000).toFixed(1)) });
    if (state === 'no-route' || state === 'stuck') {
      // two legs in a row that cannot be walked end the window: the save is not what the route needs
      if (legs.length >= 2 && ['no-route', 'stuck'].includes(legs[legs.length - 2]!.state)) break;
    }
  }
  await walk.release();
  const raw = await page.eval<FrameLog & { bake: [string, number, number][] }>(`(() => { window.__stutterStop = 1; const S = window.__stutter; return { t: S.t, at: S.at, tile: S.tile, game: S.game, long: S.long, bake: S.bake }; })()`);
  if (o.cpu > 1) await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const end = await heap(page);
  const summary = summarize(raw, dayMs);
  const strips = raw.bake.filter((b) => b[0] === 'bakeUnit').map((b) => b[2]);
  const uploads = raw.bake.filter((b) => b[0] === 'upload').map((b) => b[2]);
  const boot = (key: string) => {
    const m = marks[key];
    return m ? { ms: Math.round(m.ms), ...bootBytes(m.entries.map(([transfer, decoded]) => ({ transfer, decoded }))) } : null;
  };
  const visited = new Set(raw.tile.map((t) => t.join(','))).size;
  const json = {
    tool: 'valley-walk',
    url,
    label: o.label,
    viewport: { name, width: viewport.width, height: viewport.height, mobile: viewport.mobile },
    run: n,
    started,
    machine: { cpu: cpus()[0]?.model ?? '', load1_at_start: Number(load1.toFixed(2)), load1_at_end: Number(loadavg()[0]!.toFixed(2)) },
    probe: { cpu_throttle: o.cpu, window_secs_asked: o.secs, wake: 'core/west-bank (seed 6)', input: viewport.mobile ? 'touch stick' : 'keyboard', gl: 'swiftshader (software)', start_tile: wakeTile },
    boot: {
      title_ms: boot('title')?.ms ?? null,
      built_ms: boot('built')?.ms ?? null,
      play_ms: boot('play')?.ms ?? null,
      at_title: boot('title'),
      at_built: boot('built'),
      at_play: boot('play'),
      wire_at_play: { requests: atPlay.requests, transfer_bytes: atPlay.transfer, decoded_bytes: atPlay.decoded },
      wire_at_end: { requests: net.requests, transfer_bytes: net.transfer, decoded_bytes: net.decoded },
    },
    memory: { boot_js_heap_mb: bootHeap.retained_mb, start_js_heap_mb: start.retained_mb, end_js_heap_mb: end.retained_mb, start_used_mb: start.used_mb, end_used_mb: end.used_mb, dom_nodes_end: end.nodes },
    frames: summary,
    route: { legs, tiles_visited: visited },
    strips: { n: strips.length, sum_ms: Math.round(strips.reduce((a, b) => a + b, 0)), over20: strips.filter((v) => v > 20).length, max: Math.max(0, ...strips) },
    uploads: { n: uploads.length, sum_ms: Math.round(uploads.reduce((a, b) => a + b, 0)), over20: uploads.filter((v) => v > 20).length, max: Math.max(0, ...uploads) },
    errors: page.errors.filter((e) => !/favicon/.test(e)).slice(0, 3),
  };
  return { summary, json: { ...json, raw: { t: raw.t.map((v) => Number(v.toFixed(1))), at: raw.at.map(Math.round), tile: raw.tile, game: raw.game, long: raw.long, bake: raw.bake } } };
}

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2));
  if (!o.url && !existsSync(join(o.dist, 'index.html'))) throw new Error(`no ${o.dist}/index.html: run "pnpm bundle && pnpm --filter game build" first, or pass --url`);
  mkdirSync(o.out, { recursive: true });
  // the opening e2e's page-side planner (its IN_PAGE): imported, not copied, with its own main() held back
  process.env.E2E_NO_MAIN = '1';
  const openingInPage = (await import('./opening')).IN_PAGE;
  const local = o.url ? null : await serve(o.dist);
  const url = o.url ?? local?.url ?? '';
  const sha = o.url ? '' : (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: GAME_DIR }).toString().trim(); } catch { return ''; } })();
  const table: Record<string, unknown>[] = [];
  try {
    for (const name of o.viewports) {
      const runs: RunResult[] = [];
      for (let n = 1; n <= o.runs; n++) {
        // a cold browser every run, closed before the next starts
        const browser = await Browser.launch();
        try {
          const r = await playOne(openingInPage, browser, url, name, VIEWPORTS[name]!, o, n);
          runs.push(r);
          writeFileSync(join(o.out, `valley-walk-${o.label}-${name}-${n}.json`), JSON.stringify({ ...r.json, build: sha || undefined }));
          const f = r.summary;
          console.log(`[${o.label} ${name} #${n}] n=${f.n} mean=${f.mean} p95=${f.p95} over20=${f.over20} over50=${f.over50} max=${f.max} longtasks=${f.longtasks.n} freeze=${f.freeze ? `${f.freeze.ms}ms@${f.freeze.at_s}s tile ${f.freeze.tile.join(',')} ${f.freeze.game}` : '-'}`);
        } catch (e) {
          console.error(`[${o.label} ${name} #${n}] FAILED: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
          await browser.close();
        }
      }
      const best = bestOf(runs.map((r) => r.summary));
      if (best >= 0) {
        const r = runs[best]!;
        const j = r.json as { boot: { title_ms: number; play_ms: number; at_play: { transfer: number } | null; wire_at_play: { transfer_bytes: number } }; memory: { start_js_heap_mb: number; end_js_heap_mb: number } };
        table.push({ label: o.label, viewport: name, best_of: runs.length, ...r.summary, title_ms: j.boot.title_ms, play_ms: j.boot.play_ms, boot_transfer_bytes: j.boot.wire_at_play.transfer_bytes, heap_start_mb: j.memory.start_js_heap_mb, heap_end_mb: j.memory.end_js_heap_mb });
      }
    }
  } finally {
    local?.server.close();
  }
  writeFileSync(join(o.out, `valley-walk-${o.label}-best.json`), JSON.stringify({ url, build: sha || undefined, options: o, best: table }, null, 1));
  console.log(`BEST ${JSON.stringify(table.map((t) => ({ ...t, worst: undefined })))}`);
  if (table.length < o.viewports.length) process.exitCode = 1;
}

main().then(
  () => process.exit(),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
