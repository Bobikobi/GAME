/**
 * Just enough of the Chrome DevTools Protocol to play the game in a headless
 * Chrome: pages, keys, taps, script evaluation, screenshots and a frame
 * recording. No browser
 * automation package, so nothing extra to install or keep up to date.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_NAMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

function findChrome(): string {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const dir of (process.env.PATH ?? '').split(':')) {
    for (const name of CHROME_NAMES) {
      const path = join(dir, name);
      if (existsSync(path)) return path;
    }
  }
  throw new Error('No Chrome found. Install Chrome or set CHROME_BIN.');
}

/**
 * The time ledger: where a script's wall time goes, by kind (a walk, a wait on the game's clock, a fixed sleep), printed at
 * the end of the run. A span is charged to the outermost kind open (a sleep inside a wait is the wait's), what no span covers
 * is "taps, evals and loads". `E2E_LEDGER=0` silences it.
 */
const ledger = new Map<string, { ms: number; n: number }>();
let open = 0;
const started = Date.now();
export function charge(kind: string, ms: number): void {
  const row = ledger.get(kind) ?? { ms: 0, n: 0 };
  row.ms += ms;
  row.n += 1;
  ledger.set(kind, row);
}
/** Runs `fn`, charging its wall time to `kind` unless a span is already open. */
export async function timed<T>(kind: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  open += 1;
  try {
    return await fn();
  } finally {
    open -= 1;
    if (open === 0) charge(kind, Date.now() - t0);
  }
}
if (process.env.E2E_LEDGER !== '0') {
  process.on('exit', () => {
    const total = Date.now() - started;
    const charged = [...ledger.values()].reduce((a, r) => a + r.ms, 0);
    const rows = [...ledger.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 12);
    if (rows.length === 0) return;
    console.log(`e2e ledger: ${(total / 1000).toFixed(0)} s in all, ${((total - charged) / 1000).toFixed(0)} s in taps, evals and loads`);
    for (const [kind, r] of rows) console.log(`e2e ledger: ${(r.ms / 1000).toFixed(1).padStart(6)} s ${String(r.n).padStart(4)}x ${kind}`);
  });
}

export const sleep = async (ms: number): Promise<void> => {
  const t0 = Date.now();
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
  if (open === 0) charge(`sleep ${ms} ms`, Date.now() - t0);
};

/**
 * E2E_WARP=<k> (k > 1) lets the game's clock run k times faster than the wall's while a script only waits on it
 * (`Page.waitFor`): a dig, a felling or a cooking that holds the player for N game seconds, the wait for dusk.
 * Walks, taps, minigames and every sleep stay at the real pace, and game durations are unchanged (the tick is
 * the game's own, so a dig still takes its game seconds); what shrinks is only the wall time spent looking at
 * the clock. Set by the runner (run.ts) for the scripts that wait on the clock; unset, nothing is wrapped.
 * The wrap is in the page's performance.now(), which Phaser's loop reads for its delta; the frame cap on the
 * game's own side (LONGEST_FRAME_MS) bounds the gain on a slow machine, and the end-of-run report says how much.
 */
const WARP = Number(process.env.E2E_WARP ?? 1);
/**
 * How fast the game's clock runs while a script walks (walk.ts): the walk's own factor, lower than the wait's, because the body
 * crosses a tile in a few frames and the page lets go on the frame the feet are on the tile, so a frame must not carry it past.
 * Default 1 (walks at the game's pace): at 2 the phone opening's collapsed-hall digs timed out on CI (issue #545). E2E_WALK_WARP=2 turns it on.
 */
export const WALK_WARP = Math.min(WARP, Number(process.env.E2E_WALK_WARP ?? 1));

/** In the page: a clock that is continuous when its rate changes, and stays at 1 unless a wait asked and it is safe. */
const WARP_CLOCK = `(() => {
  const real = performance.now.bind(performance);
  let virt = real(), last = virt, gain = 0, since = 0, safe = false;
  window.__warp = 1;
  // safe when the world has run long enough for the device settings to settle (120 frames, about 10 s of play clock
  // even on a slow runner; cached per 50 ms) and no minigame is open (asked at every call: a minigame times its
  // frames on this clock, and a press is timed in real ms from its ring, so it must see one clock from its start)
  const settled = (r) => {
    if (r - since > 50) {
      since = r;
      const g = window.__game;
      safe = !!(g && g.session && g.session.tick > 10000);
    }
    return safe;
  };
  performance.now = () => {
    const r = real();
    const k = window.__warp > 1 && settled(r) && !document.querySelector('.minigame-layer') ? window.__warp : 1;
    virt += (r - last) * k;
    gain += (r - last) * (k - 1);
    last = r;
    return virt;
  };
  // Phaser's loop and the games take the frame's time from the rAF argument: it must be this clock, not the browser's
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(performance.now()));
  window.__warpGain = () => gain;
})();`;

/** What the warp gained over the run, summed over pages, for the line at the end. */
let warpedMs = 0;
let warpWaitMs = 0;
if (WARP > 1) {
  process.on('exit', () => {
    if (warpWaitMs > 0) console.log(`e2e warp x${WARP}: ${(warpWaitMs / 1000).toFixed(0)} s of waiting on the game clock ran ${((warpWaitMs + warpedMs) / 1000).toFixed(0)} s of it`);
  });
}

/** An in-page expression for `Page.tapWhere`: the first shown element matching the selector whose text holds `text`, enabled unless `disabledToo`. */
export function byText(selector: string, text = '', disabledToo = false): string {
  return `(() => {
    for (const el of document.querySelectorAll(${JSON.stringify(selector)})) {
      if (!el.textContent.includes(${JSON.stringify(text)})) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0${disabledToo ? '' : ' || el.disabled'}) continue;
      return el;
    }
    return null;
  })()`;
}

export interface Viewport {
  width: number;
  height: number;
  /** a phone: touch input and a coarse pointer */
  mobile: boolean;
  /** device pixels per CSS pixel; 1 when left out. The pixel game's phone runs at 3 (a 2K phone). */
  scale?: number;
}

export class Browser {
  private constructor(
    private readonly proc: ChildProcess,
    private readonly profile: string,
    readonly port: number,
  ) {}

  static async launch(): Promise<Browser> {
    const profile = mkdtempSync(join(tmpdir(), 'loomvale-e2e-'));
    const args = [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--mute-audio',
      // WebGL without a GPU, so the real renderer is what gets tested
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      'about:blank',
    ];
    if (process.env.CI || process.platform === 'linux') args.unshift('--no-sandbox', '--disable-setuid-sandbox');
    const proc = spawn(findChrome(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const port = await new Promise<number>((resolve, reject) => {
      let seen = '';
      const timer = setTimeout(() => reject(new Error('Chrome did not open a debugging port in 20 s')), 20_000);
      proc.stderr?.on('data', (chunk: Buffer) => {
        seen += chunk.toString();
        const m = /DevTools listening on ws:\/\/[^:]+:(\d+)\//.exec(seen);
        if (m) {
          clearTimeout(timer);
          resolve(Number(m[1]));
        }
      });
      proc.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Chrome exited early with code ${code}`));
      });
    });
    return new Browser(proc, profile, port);
  }

  async newPage(viewport: Viewport): Promise<Page> {
    const res = await fetch(`http://127.0.0.1:${this.port}/json/new?about:blank`, { method: 'PUT' });
    const target = (await res.json()) as { webSocketDebuggerUrl: string };
    const page = await Page.connect(target.webSocketDebuggerUrl);
    await page.init(viewport);
    return page;
  }

  async close(): Promise<void> {
    const exited = new Promise<void>((resolve) => {
      if (this.proc.exitCode !== null) resolve();
      else this.proc.once('exit', () => resolve());
    });
    this.proc.kill('SIGTERM');
    await Promise.race([exited, sleep(5000)]);
    if (this.proc.exitCode === null) this.proc.kill('SIGKILL');
    rmSync(this.profile, { recursive: true, force: true });
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

/** CDP key data for the keys the game uses. */
const KEYS: Record<string, { key: string; keyCode: number; text?: string }> = {
  ArrowUp: { key: 'ArrowUp', keyCode: 38 },
  ArrowDown: { key: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { key: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { key: 'ArrowRight', keyCode: 39 },
  Enter: { key: 'Enter', keyCode: 13, text: '\r' },
  Space: { key: ' ', keyCode: 32, text: ' ' },
  Escape: { key: 'Escape', keyCode: 27 },
  KeyI: { key: 'i', keyCode: 73, text: 'i' },
  KeyJ: { key: 'j', keyCode: 74, text: 'j' },
  KeyM: { key: 'm', keyCode: 77, text: 'm' },
};

export class Page {
  private next = 0;
  private readonly pending = new Map<number, Pending>();
  private readonly listeners = new Map<string, ((params: Record<string, unknown>) => void)[]>();
  /** uncaught exceptions and console errors from the page */
  readonly errors: string[] = [];
  private mobile = false;
  /** the warp's gain in this page's clock so far, ms (WARP) */
  private gainSeen = 0;

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message: string } };
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p?.reject(new Error(msg.error.message));
        else p?.resolve(msg.result);
        return;
      }
      for (const fn of this.listeners.get(msg.method ?? '') ?? []) fn(msg.params ?? {});
    });
  }

  static connect(url: string): Promise<Page> {
    const ws = new WebSocket(url);
    return new Promise((resolve, reject) => {
      ws.addEventListener('open', () => resolve(new Page(ws)));
      ws.addEventListener('error', () => reject(new Error(`could not connect to ${url}`)));
    });
  }

  send<T = unknown>(method: string, params: object = {}): Promise<T> {
    const id = ++this.next;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise<T>((resolve, reject) => this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject }));
  }

  on(method: string, fn: (params: Record<string, unknown>) => void): void {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), fn]);
  }

  private once(method: string): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      const fn = (params: Record<string, unknown>) => {
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((f) => f !== fn));
        resolve(params);
      };
      this.on(method, fn);
    });
  }

  async init(viewport: Viewport): Promise<void> {
    this.mobile = viewport.mobile;
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    this.on('Runtime.exceptionThrown', (p) => {
      const d = p.exceptionDetails as { text?: string; exception?: { description?: string } } | undefined;
      this.errors.push(d?.exception?.description ?? d?.text ?? 'exception');
    });
    this.on('Runtime.consoleAPICalled', (p) => {
      if (p.type !== 'error') return;
      const args = (p.args as { value?: unknown; description?: string }[]) ?? [];
      this.errors.push(args.map((a) => String(a.value ?? a.description ?? '')).join(' '));
    });
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.scale ?? 1,
      mobile: viewport.mobile,
    });
    if (viewport.mobile) await this.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    if (WARP > 1) await this.send('Page.addScriptToEvaluateOnNewDocument', { source: WARP_CLOCK });
    // E2E_CPU_SLOWDOWN=4 makes a fast machine render as slowly as CI does
    const slowdown = Number(process.env.E2E_CPU_SLOWDOWN ?? 1);
    if (slowdown > 1) await this.send('Emulation.setCPUThrottlingRate', { rate: slowdown });
  }

  async goto(url: string): Promise<void> {
    const loaded = this.once('Page.loadEventFired');
    await this.send('Page.navigate', { url });
    await loaded;
  }

  /** Runs an expression in the page and returns its JSON value (promises are awaited). */
  async eval<T = unknown>(expression: string): Promise<T> {
    const r = await this.send<{ result: { value?: unknown }; exceptionDetails?: { text: string; exception?: { description?: string } } }>(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
    );
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value as T;
  }

  /**
   * Polls until the expression is truthy and returns its value. With E2E_WARP the game's clock runs faster while it
   * polls (see WARP); a wait that holds a walk or a push passes `warp: false`, so the body moves at the real pace.
   */
  async waitFor<T = unknown>(expression: string, what: string, timeoutMs = 15_000, warp = true): Promise<T> {
    const end = Date.now() + timeoutMs;
    const poll = async (): Promise<T> => {
      for (;;) {
        const v = await this.eval<T>(expression);
        if (v) return v;
        if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
        await new Promise<void>((resolve) => setTimeout(resolve, 40));
      }
    };
    const warping = WARP > 1 && warp;
    return timed(`${warping ? 'wait (warped)' : 'wait (real pace)'}: ${what.slice(0, 48)}`, () => (warping ? this.warped(WARP, poll) : poll()));
  }

  /**
   * Runs `fn` with the game's clock `k` times the wall's (see WARP), and puts it back at once; the gain is booked for the
   * report at the end. The page can be gone when it ends (a crash or a reload), which the caller sees on its own.
   */
  async warped<T>(k: number, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    await this.eval(`(window.__warp = ${k})`);
    try {
      return await fn();
    } finally {
      warpWaitMs += Date.now() - t0;
      const gain = await this.eval<number>('(window.__warp = 1, window.__warpGain ? window.__warpGain() : 0)').catch(() => this.gainSeen);
      warpedMs += gain - this.gainSeen;
      this.gainSeen = gain;
    }
  }

  async key(code: string, type: 'keyDown' | 'keyUp'): Promise<void> {
    const k = KEYS[code];
    if (!k) throw new Error(`no key data for ${code}`);
    await this.send('Input.dispatchKeyEvent', {
      type: type === 'keyDown' && k.text ? 'keyDown' : type,
      key: k.key,
      code,
      windowsVirtualKeyCode: k.keyCode,
      nativeVirtualKeyCode: k.keyCode,
      ...(type === 'keyDown' && k.text ? { text: k.text, unmodifiedText: k.text } : {}),
    });
  }

  async press(code: string): Promise<void> {
    await this.key(code, 'keyDown');
    await this.key(code, 'keyUp');
  }

  async type(text: string): Promise<void> {
    await this.send('Input.insertText', { text });
  }

  /** A click on a phone page is a tap. */
  async tapAt(x: number, y: number): Promise<void> {
    if (this.mobile) {
      await this.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      return;
    }
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  /** One notch of the mouse wheel over the page (negative deltaY is away from the user, the way in). */
  async wheel(x: number, y: number, deltaY: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
  }

  /** Taps the first visible element matching the selector whose text contains `text`. */
  async tap(selector: string, text = ''): Promise<void> {
    await this.tapWhere(byText(selector, text), `${selector} "${text}"`);
  }

  /**
   * Taps the element `find` (an in-page expression giving an element or null) once it holds still: scrolled into
   * view, its centre is measured over two frames, and one that moved between them (a smooth scroll, a panel
   * sliding in) is measured again. A tap never lands where a button was: on a slow runner the shop's strip
   * scrolled the Buy button 17 px on between the measure and the tap (CI run 40278768589).
   */
  async tapWhere(find: string, what: string, timeoutMs = 15_000): Promise<void> {
    const at = await this.waitFor<{ x: number; y: number }>(
      `(async () => {
        const el = ${find};
        if (!el) return null;
        el.scrollIntoView({ block: 'nearest' });
        const centre = () => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, shown: r.width > 0 && r.height > 0 }; };
        const a = centre();
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
        const b = centre();
        return b.shown && Math.abs(b.x - a.x) < 1 && Math.abs(b.y - a.y) < 1 ? b : null;
      })()`,
      what,
      timeoutMs,
    );
    await this.tapAt(at.x, at.y);
  }

  /**
   * Records the page as JPEG frames in `dir`, one file per screen change, with
   * `frames.txt` listing the millisecond of each; a video tool stitches them.
   */
  async record(dir: string): Promise<void> {
    mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    const times: string[] = [];
    this.on('Page.screencastFrame', (p) => {
      const file = `${String(times.length).padStart(5, '0')}.jpg`;
      writeFileSync(join(dir, file), Buffer.from(p.data as string, 'base64'));
      times.push(`${Date.now() - t0} ${file}`);
      writeFileSync(join(dir, 'frames.txt'), `${times.join('\n')}\n`);
      void this.send('Page.screencastFrameAck', { sessionId: p.sessionId });
    });
    await this.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 });
  }

  async screenshot(path: string): Promise<void> {
    const r = await this.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
  }

  close(): void {
    this.ws.close();
  }
}
