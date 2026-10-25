import { h } from './dom';

/** How long a press must hold to open the exact values (decision 39: one long press away). */
export const EXACT_HOLD_MS = 500;
const MOVE_SLOP = 10;

/**
 * Words on screen, the real numbers one long press away. Holding `el` (a finger or a mouse button)
 * shows `exact` in a line right after it; holding again hides it. The click that ends a long press
 * is swallowed so a hold on a button's text never presses the button. The numbers also sit in
 * `aria-description`, so a screen reader still has them.
 */
export function withExact<T extends HTMLElement>(el: T, exact: string): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let held = false;
  let line: HTMLElement | undefined;
  let x = 0;
  let y = 0;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  el.setAttribute('aria-description', exact);
  el.addEventListener('pointerdown', (e) => {
    held = false;
    x = e.clientX;
    y = e.clientY;
    cancel();
    timer = setTimeout(() => {
      timer = undefined;
      held = true;
      if (line?.isConnected) {
        line.remove();
        line = undefined;
        return;
      }
      line = h('span', { class: 'exact muted' }, exact);
      el.insertAdjacentElement('afterend', line);
    }, EXACT_HOLD_MS);
  });
  el.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - x, e.clientY - y) > MOVE_SLOP) cancel();
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(type, cancel);
  // a long press on a phone also opens the browser's own menu
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('click', (e) => {
    if (!held) return;
    held = false;
    e.stopPropagation();
    e.preventDefault();
  });
  return el;
}
