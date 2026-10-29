Title: feat(game): settings step 1 - quality preset, frame cap, device tier and the stats overlay

## What changed and why

The game had no frame-rate setting: Phaser's loop ran on requestAnimationFrame with no limit, so the draw followed the screen (60 Hz on most phones, 90 or 120 on high-refresh ones). This is step 1 of a settings system like the big games have: a quality preset (Low / Medium / High), a frame-rate cap (30 / 60 / 120 / max) and reduced motion, each either chosen by the player or Auto. Auto picks from the device. Step 1 is the model, the measuring and the wiring, plus a `?stats=1` overlay; the settings screen itself is a later step, so today the stored choice is Auto unless localStorage (`openfold.settings.1`) says otherwise.

- `game/src/settings.ts`: the Settings record, read/write on one localStorage key (defensive like the sound key; any corrupt or wrong field falls back to Auto), `resolve(settings, device)` and `richOf(quality, reducedMotion)`. Thresholds are named constants at the top.
- `game/src/device.ts`: `measureRefresh` (rAF interval over 60 frames, rounded to 60/90/120/144, median so a stall does not skew it), `FrameTimer` (p50/p95 of the last 180 frames), `tierOf` (cores, deviceMemory, dpr, WebGL renderer string) and `readDevice`.
- `game/src/perf.ts` + `main.ts`: the quality preset sets the RICH groups before the first scene draws (low = none; medium = detail + light; high = all; `?rich=` in the URL still wins). The frame cap goes to Phaser through its public API `game.loop.setFPSLimit(n)` (TimeStep, 0 removes the limit); no render-skip was needed. Auto settles the cap once: refresh is measured at launch, p50/p95 are taken after 120 world frames from the `poststep` delta.
- Auto: high tier gives high and 120 when the measured refresh is above 100 Hz and p95 is under 6 ms, else 60; mid gives medium/60; low gives low, and 30 only if p95 passes 16 ms. A chosen cap is bounded by the screen (a cap above the measured refresh becomes uncapped).
- Quality is chosen once at launch from the tier (scenes build once, so it cannot change mid-world); only the cap adapts to the measurement.

## Tests

- New: `game/test/settings.test.ts` and `game/test/device.test.ts`.
- `pnpm typecheck` clean (after `pnpm bundle`, which makes the git-ignored `generated/bundle.json`).
- `pnpm vitest run game/test`: 54 files, 578 tests, all green (new files included).

## Measured

Headless Chromium (software renderer), `/?stats=1&debug`, 8 s: the overlay showed tier low, screen 60 Hz, p50 32.9 ms, p95 40.4 ms, preset low, cap 30; RICH was all false; no page errors. So the Auto path low tier -> 30 fps works end to end.

## Not verified

- A real 90/120 Hz phone: the 120 path is covered by unit tests only.
- The overlay's `fps` (Phaser's `actualFps`) read 67 while capped at 30 in the headless run; it is a moving average over boot, so I did not trust it as proof of the cap. A device run should confirm the cap by eye.
- The GPU/tier regexes are first guesses and need real devices.
- Not run: `pnpm verify`, `pnpm e2e`.

Quest review: clear (no quest or content change).
Story review: clear (no text a player reads except the overlay's numbers behind a flag).
Source: drawn in code, no picture.
Tree: none: a settings module and an overlay; nothing a player can grow in changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PpsERu2ucMLNNGUWxEc1WX
