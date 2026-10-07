/**
 * Just enough of the Chrome DevTools Protocol to play the game in a headless
 * Chrome: pages, keys, taps, script evaluation and screenshots. No browser
 * automation package, so nothing extra to install or keep up to date.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface Viewport {
  width: number;
  height: number;
  /** a phone: touch input and a coarse pointer */
  mobile: boolean;
}

export class Browser {
  private constructor(
    private readonly proc: ChildProcess,
    private readonly profile: string,
    readonly port: number,
  ) {}

  static async launch(): Promise<Browser> {
    const profile = mkdtempSync(join(tmpdir(), 'mistvale-e2e-'));
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
    if (process.env.CI) args.unshift('--no-sandbox');
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
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
    });
    if (viewport.mobile) await this.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
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

  /** Polls until the expression is truthy and returns its value. */
  async waitFor<T = unknown>(expression: string, what: string, timeoutMs = 15_000): Promise<T> {
    const end = Date.now() + timeoutMs;
    for (;;) {
      const v = await this.eval<T>(expression);
      if (v) return v;
      if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
      await sleep(40);
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

  /** Taps the first visible element matching the selector whose text contains `text`. */
  async tap(selector: string, text = ''): Promise<void> {
    const at = await this.waitFor<{ x: number; y: number }>(
      `(() => {
        for (const el of document.querySelectorAll(${JSON.stringify(selector)})) {
          if (!el.textContent.includes(${JSON.stringify(text)})) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || el.disabled) continue;
          el.scrollIntoView({ block: 'nearest' });
          const q = el.getBoundingClientRect();
          return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
        }
        return null;
      })()`,
      `${selector} "${text}"`,
    );
    await this.tapAt(at.x, at.y);
  }

  async screenshot(path: string): Promise<void> {
    const r = await this.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
  }

  close(): void {
    this.ws.close();
  }
}
