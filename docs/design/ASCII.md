# A character-grid look: kept for later

The owner asked on 2026-10-18 whether an ASCII or coloured character-grid renderer, fed by an automatic pipeline that turns the existing pixel art into characters, would make the game simpler. The answer was no for now, and the owner asked to keep the idea for a possible switch or addition later. This page holds what was measured, so the next session starts from numbers, not from scratch. The decision is DECISIONS 2026-10-18 "A character-grid look is kept for later".

Each claim is marked **measured** (a number taken on 18.10), **code** (read from the source on `develop` 6922636e) or **guess**.

## 1. The idea as asked

1. A conversion step: scale each sprite frame down to a cell grid, pick a glyph per cell by brightness and shape, colour it by the cell's average, store the result as data.
2. One "golden spot" of tuning (cell size, glyph set, contrast), done once.
3. A character-grid renderer on the same kernel, as a second view or as the only one.

## 2. What the measurements said

**Where CI time goes.**
- **measured** (CI run of 17.10, job `ci`): `pnpm verify` took about 47 s and `pnpm e2e` about 11 min, so the e2e is about 93% of the job.
- **measured**: inside the e2e, the opening took 234 s on the phone and 143 s on the desktop, stealth 47 s, tending 25 s, hud 65 s and the 3D door about 2.5 min.

**Why a cheaper renderer barely moves that time.**
- **code + measured**: the game clock runs in real time. The stealth e2e logged "camp reached 7160 game ms after the chase began (7161 ms wall)". The e2e waits for the game to be played, not for frames to be drawn.
- **measured** on this laptop, one run each, sequential: switching Phaser from WebGL to Canvas (`--disable-webgl`) changed tending from 27.5 s to 26.6 s and stealth from 52.1 s to 49.5 s, a 3-5% gain.
- **measured**: in headless Chrome the software GPU process (SwiftShader) used more than 90% of Chrome's CPU in every mode, Canvas 2D included.

**How a character grid draws in headless Chrome** (phone frame 390 x 844, mean frame time; the machine was 83-94% busy with other sessions, so treat these as an order, not as exact values).

| Mode | Cells | Mean frame |
|---|---|---|
| The game today, Phaser WebGL | - | 32 ms |
| The game today, Phaser Canvas | - | 20 ms |
| Character grid, 8 px glyphs, `fillText` per cell | 49 x 71 | 87 ms |
| Character grid, 8 px glyphs, glyph atlas | 49 x 71 | 156 ms |
| Character grid, 16 px glyphs, glyph atlas | 25 x 36 | 43 ms |

- **measured**: a plain Canvas 2D character grid was slower than the game as it is.
- **code** (the projects below): the fast web character renderers draw with WebGL, so in headless CI they run through the same SwiftShader.

**What a third renderer would cost.**
- **code**: the 2D scene (`game/src/scenes/world.ts`, 2439 lines) and the 3D door (`game/src/play3d/world3d.ts`, 1335 lines) share 24 method names and 222 identical non-trivial lines. Walking, arriving at a slot, the haunt and the work timer live in the scenes, not in pure modules.
- **code**: the copies have already drifted. The 3D door has no predator rounds, no cover and no tended fires.
- **guess**: a third renderer would be a third copy of that flow, and drift again unless the flow moves out first.

**The phone.**
- **code**: GAME_RULES G29 asks for text of at least 16 px and says colour is never the only signal.
- **code**: the phone camera shows about 12 tiles across (`world.ts` zoom formula at 16 px tiles).
- **guess**: a 16 px glyph grid gives about 24 columns on a 390 px phone, so 2 glyphs per tile. That is too few to tell a wolf from a bush by shape alone. Telling them apart by colour alone would break G29.

**What the game already has without characters.**
- **code**: the world map `content/core/map.json` is already a character grid (48 x 49) with a legend.
- **code**: the `?rich=` groups (detail, motion, light) already give the procedural layers a character look would bring: grass tones, sway, dapple, glows, the lantern pool and mist.

## 3. What exists, so nothing is built from scratch

Found on 18.10, none of them installed or trialled:
- [chafa](https://hpjansson.org/chafa/): image to coloured terminal characters. It could feed the conversion step.
- [rot.js](https://ondras.github.io/rot.js/): a roguelike toolkit with a WebGL tile backend (`tile-gl`).
- [beamterm](https://github.com/junkdog/beamterm): a WebGL terminal-grid renderer.
- three.js `AsciiEffect`: renders a 3D scene as characters. It could sit on the 3D door.
- Stone Story RPG: a commercial game in animated ASCII. Its animation is drawn by hand, not converted. **guess**: the look in its trailers comes from that hand work.

## 4. What was taken instead (approved 18.10)

- A **text view of the state** for tests and agents: the map is already characters, so the kernel's state can be printed as a grid at the moments a test cares about.
- **Moving e2e checks to state tests**: most e2e assertions read `window.__game.session.state` or DOM text, not pixels (**code**: in `stealth.ts` and `tending.ts` only one assertion reads a sprite flag). The first trial ports `game/e2e/stealth.ts` to a vitest test that drives the `Session` directly.

## 5. When to come back to it

A character-grid look is a direction (AGENTS.md): it changes the product visibly everywhere. If it comes back:
1. **First stills.** Two or three still frames at phone size go to the owner, each testing one named difference, for example: 8 px against 16 px glyphs, a converted sprite against a hand-drawn one, or characters over the pixel ground against characters only. Nothing is built before the pick.
2. **First the shared flow.** Walking, stepping, arriving, the haunt and the work timer move out of the two scenes into pure modules (the pattern `targets.ts`, `work.ts` and `fires.ts` already follow). A new renderer should only draw.
3. **Then the conversion step**, starting from an existing converter, as one more option in the kit import (`tools/src/kit/import.ts`). Its output is generated data, never edited by hand.

Come back when one of these holds:
- the owner wants the look itself, as a style;
- a terminal or agent client is wanted that plays, not only reads;
- the shared flow has been extracted for another reason, so a renderer is cheap;
- the e2e moves to a real GPU or a faster clock and drawing becomes the cost.
