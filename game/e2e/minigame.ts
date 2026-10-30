/**
 * Plays the open minigame (timing, strike, pick, snap) from inside the page. Every game marks the moment to
 * press with data-cue="now", set by its own frame. A test that read the cue over CDP and only then sent its own
 * key landed a frame or two late, and on a slow runner (SwiftShader draws the 3D door at a few frames a second)
 * the cue's window can open and close between two frames and never be seen at all. Strike's perfect window is
 * 55 ms; a missed blow keeps its stone only on the kernel's miss draw, so the gather came back empty.
 *
 * So the press is made in the page, never over CDP: a loop presses in the same animation frame that shows the
 * cue, and for strike the ring's scale (3 at the start of a blow, 1 at the target 900 ms in) says how far the
 * blow is, so a timer presses at the target without waiting for a frame.
 *
 * The press goes in the way the game reads it: an Enter key pair on the window for a keyboard, a pointerdown
 * on the layer for touch. Returns the result lines the game showed, for the log.
 */
import type { Page } from './cdp';

export async function solveMinigame(page: Page, touch: boolean, what = 'the minigame'): Promise<string[]> {
  // the clock runs at the real pace around a minigame (cdp.ts, WARP): its press is timed in real ms
  await page.waitFor('!!document.querySelector(".minigame[data-game]")', `${what} to open`, 5000, false);
  await page.eval(`(() => {
    const game = document.querySelector('.minigame[data-game]');
    if (!game || game.__solving) return;
    game.__solving = true;
    const shown = (window.__minigameShown = []);
    const press = ${touch}
      ? () => game.closest('.minigame-layer')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
      : () => { for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })); };
    const result = game.querySelector('.minigame-result');
    const ring = game.querySelector('.strike-ring');
    let beatTimed = false;
    const tick = () => {
      if (!game.isConnected) return;
      if (ring) {
        const scale = Number(/scale\\(([-\\d.]+)\\)/.exec(ring.style.transform)?.[1] ?? 3);
        if (scale > 2.95) beatTimed = false;
        else if (!beatTimed && scale >= 1) {
          beatTimed = true;
          setTimeout(() => { if (game.isConnected) press(); }, Math.max(0, 900 - (3 - scale) * 450));
        }
      } else if (game.dataset.cue === 'now') press();
      const text = result ? result.textContent.trim() : '';
      if (text && shown[shown.length - 1] !== text) shown.push(text);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })()`);
  await page.waitFor('!document.querySelector(".minigame-layer")', `${what} to close`, 30_000, false);
  return page.eval<string[]>('window.__minigameShown ?? []');
}
