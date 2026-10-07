/**
 * On-screen pad and A/B buttons for phones. The pad reads the finger's angle
 * from its center, so sliding between directions works like a real d-pad.
 * Shown on touch screens, and on any device after its first touch.
 */
import { app } from '../app';
import type { Dir } from '../input';
import { h } from './dom';

export function mountTouch(root: HTMLElement): void {
  const pad = h('div', { class: 'pad', 'aria-label': 'Direction pad' }, h('i', { class: 'up' }), h('i', { class: 'right' }), h('i', { class: 'down' }), h('i', { class: 'left' }));
  const a = h('button', { class: 'tbtn a', type: 'button', 'aria-label': 'A' }, 'A');
  const b = h('button', { class: 'tbtn b', type: 'button', 'aria-label': 'B' }, 'B');
  const el = h('div', { class: 'touch' }, pad, h('div', { class: 'tbtns' }, b, a));
  root.append(el);

  const show = () => document.body.classList.add('touch-on');
  if (matchMedia('(pointer: coarse)').matches) show();
  window.addEventListener('touchstart', show, { once: true, passive: true });

  let active: number | null = null;
  const dirFrom = (e: PointerEvent): Dir | null => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  };
  const setDir = (d: Dir | null) => {
    app.controls.setTouchDir(d);
    pad.dataset.dir = d ?? '';
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    active = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    setDir(dirFrom(e));
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === active) setDir(dirFrom(e));
  });
  const release = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = null;
    setDir(null);
  };
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);

  const tap = (btn: HTMLElement, name: 'a' | 'b') =>
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('down');
      app.controls.press(name);
      window.setTimeout(() => btn.classList.remove('down'), 120);
    });
  tap(a, 'a');
  tap(b, 'b');

  // A acts on pointerdown, so the browser's click that follows the finger
  // lifting would land on the window A just opened (and close it)
  for (const el of [pad, a, b]) el.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
}
