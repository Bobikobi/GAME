/** Browser checks for the connected visual fixture, served locally unless a URL is supplied. */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import walkMetadata from '../../docs/design/frames/rich-world-motion-2026-10-29/walk-metadata.json';
import { Browser, sleep, type Page } from './cdp';

const localServer = process.env.WORLD_STUDY_URL ? undefined : await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  server: { host: '127.0.0.1', port: 0 },
});
await localServer?.listen();
const url = process.env.WORLD_STUDY_URL ?? `${localServer!.resolvedUrls!.local[0]}world-study.html`;
const frames = process.env.WORLD_STUDY_FRAMES;
const motionFrames = process.env.WORLD_STUDY_MOTION;
if (frames) mkdirSync(frames, { recursive: true });

async function screenshot(page: Page, name: string): Promise<void> {
  if (frames) await page.screenshot(join(frames, `${name}.png`));
}

async function checkCamera(page: Page, dpr: number, wide: boolean): Promise<void> {
  // Use the fixture's host, excluding its DOM controls. Native device-pixel boxes
  // may differ from rounded CSS * DPR by a pixel at a fractional boundary.
  try { await page.waitFor(`(() => {
    const s = window.__worldStudy, canvas = document.querySelector('canvas');
    const host = document.getElementById('game').getBoundingClientRect();
    const k = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / 576));
    return devicePixelRatio === ${dpr}
      && Math.abs(canvas.width - Math.round(host.width * ${dpr})) <= 2
      && Math.abs(canvas.height - Math.round(host.height * ${dpr})) <= 2
      && s.cameras.main.zoom === ${wide ? 'k' : 'Math.ceil(1.5 * k)'}
      && document.getElementById('zoom').getAttribute('aria-pressed') === '${wide}';
  })()`, 'device canvas and approved camera step', 30000); } catch (error) {
    console.log(await page.eval(`(() => {
      const canvas = document.querySelector('canvas');
      return { dpr: devicePixelRatio, canvas: [canvas.width, canvas.height], style: canvas.getAttribute('style'), host: document.getElementById('game').getBoundingClientRect().toJSON(), zoom: window.__worldStudy.cameras.main.zoom, wide: document.getElementById('zoom').getAttribute('aria-pressed') };
    })()`));
    throw error;
  }
  console.log(await page.eval(`(() => {
    const s = window.__worldStudy, canvas = document.querySelector('canvas');
    return { canvas: [canvas.width, canvas.height], dpr: devicePixelRatio, zoom: s.cameras.main.zoom, wide: ${wide} };
  })()`));
}

let browser: Browser | undefined;
try {
  browser = await Browser.launch();
  const desktop = await browser.newPage({ width: 1440, height: 900, mobile: false });
  const sandUrl = new URL(url);
  sandUrl.searchParams.set('view', 'sand');
  await desktop.goto(sandUrl.href);
  await desktop.waitFor('!!window.__worldStudy', 'desktop world fixture', 60000);
  if (await desktop.eval<string>('document.getElementById("status").textContent') !== 'חול יבש') throw Error('sand review link did not open on sand');
  if (await desktop.eval<boolean>('!!window.__worldStudy.footprints || !!document.getElementById("footprints")')) throw Error('deferred footprint prototype is still active');
  await checkCamera(desktop, 1, false);
  if (await desktop.eval<number>('window.__worldStudy.cameras.main.zoom') !== 2) throw Error('desktop default must be the picked close view');
  await desktop.eval("document.getElementById('motion').click(); window.__worldStudy.jumpToView('forest')");
  await sleep(150);
  await screenshot(desktop, 'desktop-close');
  await desktop.eval("document.getElementById('zoom').click()");
  await checkCamera(desktop, 1, true);

  // A screen-density change without a CSS resize must update the canvas and
  // preserve the chosen wide/close mode. Rotation and a return are separate.
  await desktop.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await checkCamera(desktop, 2, true);
  await desktop.eval("document.getElementById('zoom').click()");
  await checkCamera(desktop, 2, false);
  await desktop.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1440, deviceScaleFactor: 2, mobile: false });
  await checkCamera(desktop, 2, false);
  await desktop.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await checkCamera(desktop, 1, false);

  // Pointer events arrive in CSS pixels; after resizing, they still lead the
  // feet toward the intended world point, rather than a DPR-multiplied target.
  await desktop.eval("window.__worldStudy.jumpToView('meadow')");
  await sleep(150);
  const target = await desktop.eval<{ x: number; y: number; before: number }>(`(() => {
    const s = window.__worldStudy, c = s.cameras.main, r = document.querySelector('canvas').getBoundingClientRect();
    const left = c.scrollX + c.width / 2 - c.width / c.zoom / 2;
    const top = c.scrollY + c.height / 2 - c.height / c.zoom / 2;
    return {
      x: r.left + (s.actor.x + 32 - left) * c.zoom * r.width / c.width,
      y: r.top + (s.actor.y - top) * c.zoom * r.height / c.height,
      before: s.actor.x,
    };
  })()`);
  await desktop.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 });
  await desktop.waitFor(`window.__worldStudy.actor.x > ${target.before} + 5`, 'pointer follows the world target');
  await desktop.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 });

  await desktop.eval(`(() => {
    const s = window.__worldStudy, a = s.actor;
    if (a.texture.key !== 'world-study-human-left' || !a.flipX) throw Error('right walk did not use the picked directional sheet');
    if (a.scaleX !== 1 || a.scaleY !== 1 || a.frame.realWidth !== 128 || a.frame.realHeight !== 128) throw Error('actor must retain native frame scale');
    if (a.originX !== .5 || a.originY !== 90 / 128) throw Error('actor lost its authored ground anchor');
    for (const id of ['meadow', 'forest', 'cove', 'shore', 'paving', 'worn', 'sand']) {
      s.jumpToView(id);
      if (!s.ground.canStand(a.x, a.y)) throw Error('blocked review viewpoint: ' + id);
      if (a.frame.name !== ${walkMetadata.walkingFrames}) throw Error('review jump must use the standing pose');
    }
  })()`);
  for (const [code, axis, sign] of [
    ['ArrowRight', 'x', -1], ['ArrowLeft', 'x', 1],
    ['ArrowDown', 'y', -1], ['ArrowUp', 'y', 1],
  ] as const) {
    await desktop.eval(`(() => {
      const s = window.__worldStudy, t = s.ground.treeFootprints[0];
      s.actor.setPosition(t.x, t.y);
      s.actor.${axis} += ${sign} * (t.${axis === 'x' ? 'radiusX' : 'radiusY'} + ${axis === 'x' ? 6 : 4} + 16);
      if (!s.ground.canStand(s.actor.x, s.actor.y)) throw Error('invalid trunk approach setup');
    })()`);
    await desktop.key(code, 'keyDown');
    await desktop.eval(`(() => {
      const s = window.__worldStudy, t = s.ground.treeFootprints[0], before = s.actor.${axis};
      for (let i = 0; i < 32; i++) s.update(0, 50);
      if (!s.ground.canStand(s.actor.x, s.actor.y) || (s.actor.${axis} - t.${axis}) * ${sign} <= 0) throw Error('walk crossed the trunk');
      if (Math.abs(s.actor.${axis} - before) < 5) throw Error('walk did not approach the trunk');
      if (s.actor.frame.name !== ${walkMetadata.walkingFrames}) throw Error('blocked walk must stop the stride');
      if (!s.ground.canStand(t.x, t.y - 80)) throw Error('canopy blocks the walk-behind space');
    })()`);
    await desktop.key(code, 'keyUp');
  }
  for (const view of ['forest', 'shore', 'sand']) {
    await desktop.eval(`window.__worldStudy.jumpToView('${view}')`);
    await sleep(150);
    await screenshot(desktop, `desktop-${view}`);
  }
  // Real input and real camera follow: preserve an inspectable moving scene,
  // including turns and a stop, rather than only a sprite-strip preview.
  await desktop.eval("window.__worldStudy.jumpToView('sand')");
  await sleep(200);
  if (motionFrames) await desktop.record(motionFrames);
  for (const [keys, sheet, flip] of [
    [['ArrowDown', 'ArrowRight'], 'down-left', true],
    [['ArrowUp', 'ArrowRight'], 'up-left', true],
    [['ArrowUp', 'ArrowLeft'], 'up-left', false],
    [['ArrowDown', 'ArrowLeft'], 'down-left', false],
    [['ArrowRight'], 'left', true],
    [['ArrowLeft'], 'left', false],
  ] as const) {
    for (const key of keys) await desktop.key(key, 'keyDown');
    await desktop.waitFor(`window.__worldStudy.actor.texture.key === 'world-study-human-${sheet}' && window.__worldStudy.actor.flipX === ${flip}`, 'rendered movement direction');
    await sleep(650);
    for (const key of keys) await desktop.key(key, 'keyUp');
  }
  await desktop.waitFor(`window.__worldStudy.actor.frame.name === ${walkMetadata.walkingFrames}`, 'standing after input release');
  await sleep(450);
  if (motionFrames) await desktop.send('Page.stopScreencast');
  // Keep the desktop from consuming software-rendering time while the 3x phone runs.
  await desktop.send('Page.setWebLifecycleState', { state: 'frozen' });

  const phone = await browser.newPage({ width: 390, height: 844, mobile: true, scale: 3 });
  await phone.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await phone.goto(url);
  await phone.waitFor('!!window.__worldStudy', 'phone world fixture', 60000);
  await checkCamera(phone, 3, false);
  if (await phone.eval<number>('window.__worldStudy.cameras.main.zoom') !== 3) throw Error('3x phone default must be the picked close view');
  await phone.eval("window.__worldStudy.jumpToView('shore')");
  const held = await phone.eval<number>('window.__worldStudy.water.time');
  await sleep(200);
  if (await phone.eval<number>('window.__worldStudy.water.time') !== held) throw Error('reduced motion advanced the water');
  if (await phone.eval<boolean>('document.documentElement.scrollWidth > innerWidth')) throw Error('phone horizontal overflow');
  await screenshot(phone, 'phone-close');
  await phone.eval("window.__worldStudy.jumpToView('cove')");
  await sleep(150);
  await screenshot(phone, 'phone-cove');
  await phone.eval("document.getElementById('zoom').click()");
  await checkCamera(phone, 3, true);
  await phone.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
  await checkCamera(phone, 3, true);
  await phone.eval("document.getElementById('zoom').click()");
  await checkCamera(phone, 3, false);
  await phone.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await checkCamera(phone, 3, false);
  await phone.eval("window.__worldStudy.jumpToView('sand')");
  await sleep(150);
  const touch = await phone.eval<{ x: number; y: number }>(`(() => {
    const s = window.__worldStudy, c = s.cameras.main, r = document.querySelector('canvas').getBoundingClientRect();
    const left = c.scrollX + c.width / 2 - c.width / c.zoom / 2;
    const top = c.scrollY + c.height / 2 - c.height / c.zoom / 2;
    return { x: r.left + (s.actor.x + 72 - left) * c.zoom * r.width / c.width, y: r.top + (s.actor.y - top) * c.zoom * r.height / c.height };
  })()`);
  const beforeTouchX = await phone.eval<number>('window.__worldStudy.actor.x');
  await phone.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touch.x, y: touch.y }] });
  await phone.waitFor(`window.__worldStudy.actor.x > ${beforeTouchX} + 5`, 'touch walking moves the player');
  await sleep(750);
  await phone.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(100);
  await screenshot(phone, 'phone-touch-walking');
  if (desktop.errors.length || phone.errors.length) throw Error([...desktop.errors, ...phone.errors].join('\n'));
  console.log('PASS: framing, device resolution, DPR/resize, pointer walking, native 50-degree actor, blocked strides, root collision, viewpoints, deferred footprints absent, touch walking and reduced motion; no browser errors.');
} finally {
  await browser?.close();
  await localServer?.close();
}
