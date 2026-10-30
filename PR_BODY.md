# feat(ui): the Settings window in theme D - quality, frame rate, sound, accessibility, applied at once and kept

## What changed and why

Step 1 (#421) built the settings record, the device tier and the frame cap, but a player had no way to see or change any of it. This adds the Settings window, opened from a new "Settings" row in the menu, in the theme D kit: sections under gold group names, each row a label over one full-width control, so one thumb reaches every row at 390 px. Every press goes through one small applier (`settings-apply.ts`) that keeps the record, hands the cap to the loop, redraws the quality groups into RICH and sets two attributes on the page root; the window holds no rule of its own.

- Display: Quality (Auto / Low / Medium / High) and Frame rate (Auto / 30 / 60 / 120). While a row is on Auto it shows what Auto resolved to on this device ("Auto - high", "Auto - 120 Hz").
- Sound: the existing mute switch only. The audio buses keep their levels inside the graph and the sound API exposes no gain per bus, so there are no master / music / effects sliders.
- Controls: left out. The touch pad and buttons have no stick side or button size today.
- Accessibility: reduced motion (on wins over the phone; off follows the phone's prefers-reduced-motion, so it wins only when the player sets it) and text size 16 / 18 / 20. Text size scales every size of the kit with the smallest word (16 stays the kit as drawn and the floor, G29). A side fix: step 1 let the stored flag overwrite the phone's own request when drawing; the phone's request now counts at launch.
- "Reset to Auto" clears the stored record.

Quality changes are written into RICH at once; groups the world draws once (ground, props) show fully on the next map load or reload. Kernel untouched, no generated file by hand, nothing in play3d, opening e2e untouched.

## Measurables

- Frame cap changes actualFps within 2 s: vitest with a fake loop (settles after 1000 ms, 120 to 30 to 120): passes. In real Phaser (headless Chromium, 390x844) pressing 30 sets `game.loop.fpsLimit` 0 to 30 at once. Real actualFps could not be shown: headless draws in software at about 10 fps, under any cap, so it read 13 / 10 / 9 and says nothing. Not measured on a phone here.
- Settings survive a reload: vitest round trip through a localStorage stand-in (write, then `startPerf` reads it back, then Reset clears the key): passes. In the browser a reload kept `textSize: 20`.
- Text size 20 inside the phone frame: measured in Chromium at 390x844 with 20 stored: Settings panel 8,30 to 382,814 (inside; scrolls inside its frame when taller), Menu 8,99 to 382,745, Feedback 8,218 to 382,626. Bag, Journal and Map need a running session and were not measured here; they already scroll inside their frame. Not a full pass of all 13 windows.
- No text under 16 px: the computed font size of every text node in the window is 16 px or more at 16 (the close button's cross is drawn by the kit at font-size 0 by design); vitest checks the variables at 16, 18 and 20 (20 gives 20 / 22.5 / 27.5 / 33.75) and the CSS. Smallest control: 44 x 44 px.
- Opening e2e: untouched (`game/e2e/opening.ts` not edited; CI runs it).
- `pnpm vitest run game/test tools/test/ui-theme.test.ts`: 57 files, 610 tests pass. `pnpm typecheck` green. eslint clean on the touched files. No em or en dash in any touched file.
- Phone still at 390x844 at 3x: `docs/design/frames/2026-10-30-settings-window.png`, 253 KB.

Quest review: clear (no content or quest change).
Story review: clear (labels of a settings screen; no story text).
Source: drawn in code (the kit's CSS; no picture under content/kit).
Tree: none: a settings screen; nothing a player can grow in changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PpsERutba9y4bzaK7R3jPH
