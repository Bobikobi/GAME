/**
 * On-screen pad and A/B buttons for phones. The pad is a stick: the finger's
 * offset from its center is the walk's direction at any angle, and its length
 * the speed, from nothing inside the dead zone to full speed (`stickFrom`)
 * (NEXT 22 b). Shown on touch screens, and on any device after its first touch.
 */
import { app } from '../app';
import { type Dir, stickFrom } from '../input';
import { h } from './dom';
import { TAP, buzz } from './haptics';

export function mountTouch(root: HTMLElement): void {
  const pad = h('div', { class: 'pad', 'aria-label': 'Direction pad' }, h('i', { class: 'up' }), h('i', { class: 'right' }), h('i', { class: 'down' }), h('i', { class: 'left' }));
  const a = h('button', { class: 'tbtn a', type: 'button', 'aria-label': 'A' }, 'A');
  const sneak = h('button', { class: 'tbtn sneak', type: 'button', 'aria-pressed': 'false' }, 'Sneak');
  const b = h('button', { class: 'tbtn b', type: 'button', 'aria-label': 'B' }, 'B');
  const el = h('div', { class: 'touch' }, pad, h('div', { class: 'tbtns' }, sneak, b, a));
  root.append(el);

  const show = () => document.body.classList.add('touch-on');
  if (matchMedia('(pointer: coarse)').matches) show();
  window.addEventListener('touchstart', show, { once: true, passive: true });

  let active: number | null = null;
  const stickAt = (e: PointerEvent): [number, number] => {
    const r = pad.getBoundingClientRect();
    return stickFrom(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width);
  };
  const setStick = (v: readonly [number, number] | null) => {
    app.controls.setStick(v);
    // the arrow the stick leans on lights, as the pad's arrows did
    const [x, y] = v ?? [0, 0];
    const lean: Dir | '' = x === 0 && y === 0 ? '' : Math.abs(x) >= Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
    pad.dataset.dir = lean;
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

  const tap = (btn: HTMLElement, name: 'a' | 'b') =>
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('down');
      buzz(TAP);
      app.controls.press(name);
      window.setTimeout(() => btn.classList.remove('down'), 120);
    });
  tap(a, 'a');
  tap(b, 'b');

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
  for (const el of [pad, a, b, sneak]) el.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
}
