import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RICH } from '../src/config';
import { startPerf } from '../src/perf';
import { SETTINGS_KEY, readSettings } from '../src/settings';
import { SettingsApplier, applyDisplay, type Root } from '../src/settings-apply';

const mem = () => {
  const store: Record<string, string> = {};
  return { store, getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
};

/** A loop that answers like Phaser's: setFPSLimit(n) restarts it, and actualFps is the rate it then draws at, never above the screen's. */
function fakeLoop(screenHz: number) {
  const loop = {
    fpsLimit: 0,
    actualFps: screenHz,
    setFPSLimit(n: number) {
      loop.fpsLimit = n;
      // Phaser smooths actualFps over a second of frames; the fake lands on the new rate after 1000 ms
      loop.settleAt = clock.now + 1000;
      loop.target = n === 0 ? screenHz : Math.min(n, screenHz);
    },
    settleAt: 0,
    target: screenHz,
  };
  const clock = { now: 0 };
  const advance = (ms: number) => {
    clock.now += ms;
    if (clock.now >= loop.settleAt) loop.actualFps = loop.target;
  };
  return { loop, advance, clock };
}

function setup(storage = mem(), hz = 120) {
  const perf = startPerf('', storage);
  perf.device = { tier: 'high', headless: false, refreshHz: hz, p50: 3, p95: 4 };
  const { loop, advance, clock } = fakeLoop(hz);
  const root: Root = { dataset: {} };
  const apply = new SettingsApplier({ perf, game: { loop }, storage, root, richFromUrl: false });
  return { apply, perf, loop, advance, clock, root, storage };
}

describe('the frame cap', () => {
  it('changes actualFps within 2 s of the press', () => {
    const t = setup();
    expect(t.loop.actualFps).toBe(120);
    t.apply.set({ frameCap: 30 });
    t.advance(2000);
    expect(t.loop.actualFps).toBe(30);
    t.apply.set({ frameCap: 'max' });
    t.advance(2000);
    expect(t.loop.actualFps).toBe(120);
  });
  it('Auto on this device shows what it resolved to', () => {
    const t = setup();
    expect(t.apply.qualityAuto()).toBe('Auto - high');
    expect(t.apply.capAuto()).toBe('Auto - 120 Hz');
  });
});

describe('settings survive a reload', () => {
  it('a change is kept and read back by the next launch', () => {
    const storage = mem();
    const t = setup(storage);
    t.apply.set({ quality: 'low', frameCap: 60, reducedMotion: true, textSize: 20 });
    expect(JSON.parse(storage.store[SETTINGS_KEY]!)).toEqual({ quality: 'low', frameCap: 60, reducedMotion: true, textSize: 20 });
    const next = startPerf('', storage);
    expect(next.settings).toEqual({ quality: 'low', frameCap: 60, reducedMotion: true, textSize: 20 });
    expect(readSettings(storage)).toEqual(next.settings);
  });
  it('Reset to Auto clears the record and every row is Auto again', () => {
    const t = setup();
    t.apply.set({ quality: 'low', textSize: 18 });
    t.apply.reset();
    expect(t.storage.store[SETTINGS_KEY]).toBeUndefined();
    expect(t.apply.settings).toEqual({ quality: 'auto', frameCap: 'auto', reducedMotion: false, textSize: 16 });
    expect(t.root.dataset.textSize).toBe('16');
  });
});

describe('applied at once', () => {
  it('the quality groups and the page attributes follow the press', () => {
    const t = setup();
    t.apply.set({ quality: 'low' });
    expect(RICH).toEqual({ detail: false, motion: false, light: false });
    t.apply.set({ quality: 'high', textSize: 18 });
    expect(RICH.motion).toBe(true);
    expect(t.root.dataset.textSize).toBe('18');
  });
  it('reduced motion set by the player wins; unset, the phone decides', () => {
    const root: Root = { dataset: {} };
    const base = { quality: 'auto', frameCap: 'auto', textSize: 16 } as const;
    applyDisplay(root, { ...base, reducedMotion: false }, false);
    expect(root.dataset.motion).toBe('full');
    applyDisplay(root, { ...base, reducedMotion: false }, true);
    expect(root.dataset.motion).toBe('reduced');
    applyDisplay(root, { ...base, reducedMotion: true }, false);
    expect(root.dataset.motion).toBe('reduced');
  });
});

describe('the window keeps the floor at every text size (G29)', () => {
  const css = readFileSync(new URL('../src/ui/settings.css', import.meta.url), 'utf8');
  const theme = readFileSync(new URL('../src/ui/theme.css', import.meta.url), 'utf8');
  const px = (v: string): number => {
    const m = /^calc\((\d+)px \* (\d+) \/ (\d+)\)$/.exec(v.trim());
    return m ? (Number(m[1]) * Number(m[2])) / Number(m[3]) : Number.parseFloat(v);
  };
  const sizes = (block: string): Record<string, number> =>
    Object.fromEntries([...block.matchAll(/(--(?:ui|kit)-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1]!, px(m[2]!)]));

  it('no size is under 16 px at 16, 18 or 20, and 20 scales the largest by 1.25', () => {
    const base = sizes(/:root\s*\{([^}]*)\}/.exec(theme)![1]!);
    const sets = [16, 18, 20].map((n) => (n === 16 ? base : { ...base, ...sizes(new RegExp(`data-text-size='${n}'\\]\\s*\\{([^}]*)\\}`).exec(css)![1]!) }));
    for (const set of sets) {
      for (const name of ['--ui-title', '--ui-text', '--ui-group', '--ui-big', '--kit-text', '--kit-text-s', '--kit-text-l']) {
        expect(set[name], name).toBeGreaterThanOrEqual(16);
      }
    }
    expect(sets[2]!['--kit-text-s']).toBe(20);
    expect(sets[2]!['--ui-big']).toBeCloseTo(33.75);
  });
  it('every font in the window\'s rules is a kit size, and every control is 44 px or more', () => {
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const m of rule[2]!.matchAll(/font(?:-size)?:[^;]*?\b(\d+)px/g)) expect(Number(m[1]), rule[1]!.trim()).toBeGreaterThanOrEqual(16);
    }
    const control = /\.set-opt,[^{]*\{([^}]*)\}/.exec(css)![1]!;
    expect(control).toMatch(/min-height:\s*44px/);
    expect(control).toMatch(/min-width:\s*44px/);
  });
  it('uses regular hyphens only', () => {
    for (const f of ['settings.css', 'settings-window.ts']) expect(readFileSync(new URL(`../src/ui/${f}`, import.meta.url), 'utf8')).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("the stored preferences reach the rules the phone's own setting reaches", () => {
  const read = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  const settings = read('ui/settings.css');
  /** every selector the stylesheets still its animations for under prefers-reduced-motion: reduce */
  const reduced = (css: string): string[] => {
    const out: string[] = [];
    for (const m of css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{/g)) {
      let depth = 1;
      let i = m.index! + m[0].length;
      const start = i;
      while (depth > 0) {
        depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
        i++;
      }
      const body = css.slice(start, i - 1).replace(/\/\*[\s\S]*?\*\//g, '');
      for (const r of body.matchAll(/([^{}]+)\{/g)) out.push(...r[1]!.split(',').map((x) => x.trim()));
    }
    return out;
  };
  it('mirrors every reduced-motion selector of style.css and games.css under the attribute', () => {
    const sels = [...reduced(read('style.css')), ...reduced(read('ui/games/games.css'))];
    expect(sels.length).toBeGreaterThan(10);
    for (const sel of sels) expect(settings, sel).toContain(`:root[data-motion='reduced'] ${sel}`);
  });
  it('scales the px sizes of the windows (dialog, minigames, search, notes) with the chosen size', () => {
    for (const sel of ['.dialog-text', '.md p', '.version', '.row .muted', '.panel.search .search-row', '.minigame-title']) {
      expect(settings, sel).toContain(`:root[data-text-size='20'] ${sel}`);
    }
  });
});

