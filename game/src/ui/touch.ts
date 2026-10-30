/**
 * On-screen controls for phones, in two layouts.
 *
 * Portrait: the fixed pad and the A/B buttons. The pad is a stick: the finger's offset from its center is the walk's
 * direction at any angle, and its length the speed, from nothing inside the dead zone to full speed (`stickFrom`)
 * (NEXT 22 b).
 *
 * Landscape (the owner, 30.10, in the Wild Rift grammar): a floating stick that rises where the left thumb lands in
 * the left half below the HUD's band and fades when it lifts (`FloatingStick`), and on the right the big A, B left of
 * it, Sneak above-left, and the bag, journal and menu in a small arc above A. The body's `landscape` class comes from
 * the orientation query, never from the user agent; the stylesheet shows one layout or the other.
 *
 * Shown on touch screens, and on any device after its first touch.
 */
import { app } from '../app';
import { type Button, type Dir, stickFrom } from '../input';
import { h } from './dom';
import { TAP, buzz } from './haptics';
import { FloatingStick, stickZone } from './stick';

/** The one line a portrait phone may show once, after it wakes (dismissable, never over the world's middle). */
export const ROTATE_HINT = 'Turn your phone for the full view';
const HINT_KEY = 'loomvale.rotate-hint';
const HINT_MS = 10_000;

export function mountTouch(root: HTMLElement): void {
  const pad = h('div', { class: 'pad', 'aria-label': 'Direction pad' }, h('i', { class: 'up' }), h('i', { class: 'right' }), h('i', { class: 'down' }), h('i', { class: 'left' }));
  const a = h('button', { class: 'tbtn a', type: 'button', 'aria-label': 'A' }, 'A');
  const sneak = h('button', { class: 'tbtn sneak', type: 'button', 'aria-pressed': 'false' }, 'Sneak');
  const b = h('button', { class: 'tbtn b', type: 'button', 'aria-label': 'B' }, 'B');
  // the landscape arc above A: the HUD's own buttons, for the right thumb
  const bag = h('button', { class: 'tbtn nav bag', type: 'button' }, 'Bag');
  const journal = h('button', { class: 'tbtn nav journal', type: 'button' }, 'Journal');
  const menu = h('button', { class: 'tbtn nav menu', type: 'button' }, 'Menu');
  const knob = h('i', { class: 'stick-knob' });
  const stick = h('div', { class: 'stick', 'aria-hidden': 'true' }, knob);
  const zone = h('div', { class: 'stick-zone', 'aria-label': 'Walk: touch and slide' });
  const el = h('div', { class: 'touch' }, zone, stick, pad, h('div', { class: 'tbtns' }, sneak, b, a, bag, journal, menu));
  root.append(el);

  const show = () => document.body.classList.add('touch-on');
  if (matchMedia('(pointer: coarse)').matches) show();
  window.addEventListener('touchstart', show, { once: true, passive: true });

  // the portrait hint, once a device: under the tracker, gone at its cross, at a turn, or after ten seconds
  const hint = h(
    'div',
    { class: 'rotate-hint', hidden: true },
    h('span', null, ROTATE_HINT),
    h('button', { class: 'rotate-hint-x', type: 'button', 'aria-label': 'Dismiss' }, '×'),
  );
  const top = root.querySelector('.top');
  top?.insertBefore(hint, top.querySelector('.toasts'));
  function hideHint(): void {
    hint.hidden = true;
  }
  hint.querySelector('button')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hideHint();
  });
  const landscape = matchMedia('(orientation: landscape)');
  const setLandscape = () => {
    document.body.classList.toggle('landscape', landscape.matches);
    if (landscape.matches) hideHint();
  };
  landscape.addEventListener('change', setLandscape);
  setLandscape();

  const setStick = (v: readonly [number, number] | null) => {
    app.controls.setStick(v);
    // the arrow the stick leans on lights, as the pad's arrows did
    const [x, y] = v ?? [0, 0];
    const lean: Dir | '' = x === 0 && y === 0 ? '' : Math.abs(x) >= Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
    pad.dataset.dir = lean;
  };

  // portrait: the fixed pad
  let active: number | null = null;
  const stickAt = (e: PointerEvent): [number, number] => {
    const r = pad.getBoundingClientRect();
    return stickFrom(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width);
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    active = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    setStick(stickAt(e));
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === active) setStick(stickAt(e));
  });
  const release = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = null;
    setStick(null);
  };
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);

  // landscape: the floating stick, raised where the thumb lands below the HUD's band
  const floating = new FloatingStick();
  const bandBottom = () => {
    let bottom = 0;
    for (const part of root.querySelectorAll('.top > .hud, .top > .tracker')) {
      const r = part.getBoundingClientRect();
      if (r.height > 0) bottom = Math.max(bottom, r.bottom);
    }
    return bottom;
  };
  const drawKnob = (x: number, y: number) => {
    const k = floating.knob(x, y);
    knob.style.transform = `translate(${k.x}px, ${k.y}px)`;
  };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!floating.down(e.pointerId, e.clientX, e.clientY, stickZone(window.innerWidth, window.innerHeight, bandBottom()))) return;
    zone.setPointerCapture(e.pointerId);
    stick.style.left = `${e.clientX}px`;
    stick.style.top = `${e.clientY}px`;
    drawKnob(e.clientX, e.clientY);
    stick.classList.add('on');
    setStick([0, 0]);
  });
  zone.addEventListener('pointermove', (e) => {
    const v = floating.move(e.pointerId, e.clientX, e.clientY);
    if (!v) return;
    drawKnob(e.clientX, e.clientY);
    setStick(v);
  });
  const lift = (e: PointerEvent) => {
    if (!floating.up(e.pointerId)) return;
    stick.classList.remove('on');
    setStick(null);
  };
  zone.addEventListener('pointerup', lift);
  zone.addEventListener('pointercancel', lift);

  const tap = (btn: HTMLElement, name: Button) =>
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('down');
      buzz(TAP);
      app.controls.press(name);
      window.setTimeout(() => btn.classList.remove('down'), 120);
    });
  tap(a, 'a');
  tap(b, 'b');
  tap(bag, 'bag');
  tap(journal, 'journal');
  tap(menu, 'menu');

  // the arc's bag and journal come with the HUD's: hidden until the hook ladder opens them
  const hud = root.querySelector('.hud');
  const mirror = () => {
    bag.hidden = !!hud?.querySelector<HTMLElement>('.hud-bag')?.hidden;
    journal.hidden = !!hud?.querySelector<HTMLElement>('.hud-journal')?.hidden;
  };
  if (hud) new MutationObserver(mirror).observe(hud, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  mirror();

  // sneak is a toggle for the thumb that is steering: one tap on, one tap off
  sneak.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const on = !app.controls.sneak;
    app.controls.setSneak(on);
    sneak.setAttribute('aria-pressed', String(on));
    buzz(TAP);
  });

  // A acts on pointerdown, so the browser's click that follows the finger
  // lifting would land on the window A just opened (and close it)
  for (const el of [pad, zone, a, b, sneak, bag, journal, menu]) el.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });

  const offerHint = () => {
    if (!document.body.classList.contains('touch-on') || landscape.matches || !top) return;
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      return;
    }
    hint.hidden = false;
    window.setTimeout(hideHint, HINT_MS);
  };

  // the tap that leaves the title enters the world: there the phone asks for the full view
  let atTitle = document.body.classList.contains('at-title');
  new MutationObserver(() => {
    const now = document.body.classList.contains('at-title');
    if (atTitle && !now) {
      enterFullView();
      offerHint();
    }
    atTitle = now;
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

/**
 * Fullscreen and the landscape lock, best effort: a browser may refuse either (iOS refuses the lock, and a phone
 * browser without the element fullscreen refuses both), and play never waits on them.
 */
export function enterFullView(): void {
  if (!document.body.classList.contains('touch-on') || document.fullscreenElement) return;
  const lock = () => {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    orientation?.lock?.('landscape').catch(() => undefined);
  };
  try {
    const asked = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    if (asked) asked.then(lock, () => undefined);
    else lock();
  } catch {
    // an old browser without the promise form: no full view, play goes on
  }
}
