# The lighting ladder: three stills, three questions (2026-10-30, picked: C, built)

DECISIONS 2026-10-22 (decision 6) makes the engine's light one deep session: the hour's tint, light sources, shadows and cloud shade, shader motion for wind, water and flame, particles. AGENTS.md says a direction is seen first, as two or three phone stills, each one named difference. This page holds those stills, the numbers behind every layer in them, what each rung costs on a phone, and the build that follows the owner's pick.

The owner picked C on 30.10 (A no, B yes, C yes: the whole ladder) and answered the three questions in section 5; the build of section 6 followed the same day (DECISIONS.md, 2026-10-30, "Lighting: the ladder is C"). Section 7 records what was built, its stills and its measurements.

## 1. Already decided, not up for a pick

| Decided | Where | In the stills |
|---|---|---|
| Cast shadows C: the caster's silhouette sheared away from a south sun, `#1b1a2e` at 30%, the contact line at 45%, 0.8 to 1.1 of the height at 16:30, up-right in the evening | STYLE 4, DECISIONS 2026-10-18 "Shadows" and 2026-10-21 (GK2 B) | Already built (`game/src/cast.ts`, `game/src/cast-layer.ts`), so all three stills carry them as the game draws them at 17:30 |
| Body light: 4 art px on the side away from the light one step darker, the side toward it one step lighter | STYLE 4 | Decided, not built. B and C add it |
| The night: one darkness at 92%, every light cuts a pool in two hard steps, the town lit by lamps and windows, the wild dark | STYLE 5, DECISIONS 2026-10-18 "The night" | Not shown: 17:30 is before the night. The pools here are the same lights earlier in the evening |
| Lit windows: a second image with only the window pixels in the fire ramp, on the buildings the player uses | STYLE 5 | B and C light Pell's window; the small house stays dark (houses are paused) |
| Cloud shade by day, fog banks at dawn and at night | DECISIONS 2026-10-20 "The air over the valley" | Built (`game/src/sky.ts`) at `#172a52` 34% in one step. The base pins `?cloud=0`, so A and B show none; C shows the softer shade the brief asked for (section 4) |

The 20.10 art ladder's L2 still (`frames/2026-10-20-art-L2.png`) asked part of the same question at 19:00 and was never picked. A pick here answers its light part.

## 2. How the stills were made

- **The base is the real game.** `game/dist` built from `develop`, opened in headless Chromium at 390x844 CSS px and device scale 3 (1170x2532), the e2e harness's way (`game/e2e/cdp.ts`, the wake and carve helpers of `game/e2e/wakes.ts`; `opening.ts` untouched). `?debug&cloud=0` with the west-bank seed, a human, the clock set to 17:30 the way `game/e2e/stealth.ts` sets an hour, the session paused.
- **What was set by hand for the frame:** the player stands at 35,11, in front of Pell's door; the elder's hearth (29,6) burns, as a tended fire in the state (`fires['core/elder-hearth']`), so the game draws its lit sprite; the camera is centred on world (530.75, 135.5), so the frame holds lamps 30,7, 33,7 and 34,4, the trainers' stall and Pell's shop with its window; the mist is hidden, as after the opening has opened the town; the HUD is hidden, so the light is read alone.
- **The frame shows today's sprites.** The houses, lamps, well and stall are still the 16 px set waiting for their redraw (`tools/src/kit/rich.ts`). The light is the subject, not the art.
- **The layers are composed over that base** in Python (Pillow and numpy), on the art-pixel grid (390x844, one art px is 3 device px), then enlarged 3x nearest. Every layer is whole art pixels at one alpha per step, at most four steps, dithered only where two steps meet (STYLE 2). Only palette colours are used. The composer is `tools/stills/lighting.py` (`python3 tools/stills/lighting.py` re-makes the four frames from the two checked-in base screenshots in `tools/stills/inputs/`), and `tools/stills/lighting-shoot.mts` takes the base again from a build; every number it uses is also below.
- The hearth is 2.5 tiles left of the frame's edge: the phone's 6.1 tiles across cannot hold both the hearth and Pell's window, and the brief names the shop. Its pool and its embers reach into the frame from the left.

Coordinates below are art px in the 390x844 frame; world (wx, wy) maps to ((wx - 482) x 4, (wy - 30) x 4).

## 3. The ladder, rung by rung

### A: the hour's tint only (`frames/2026-10-30-lighting-A.png`)

| Layer | Rule |
|---|---|
| The wash | `#eda83a` at 18%, multiply, over the whole frame: the game's own dusk rectangle (`world.ts`, `this.dusk`) with a key the table does not have yet |
| Where 18% comes from | The hour table ART_SYSTEM 2 proposes: 16:30 `#eda83a` 12%, 19:00 `#e2533f` 28%. 17:30 is 40% of the way, so 12 + 0.4 x 16 = 18%. The colour holds at `#eda83a`, since a mix of the two is not a palette colour. Today's `washAt` mixes the channels between keys, so the build adds an explicit 17:30 key and makes the tint step to the next key's colour instead of mixing (section 6) |
| Everything else | As the game draws it today: the shadows of STYLE 4, the fog slots, the chimney smoke |

What A shows: a multiply only darkens. At 18% the blue cobbles go grey and a little warm, and the frame reads dimmer, not golden. The gold of a golden hour comes from light added, which is B.

### B: A plus light sources and the decided body light (`frames/2026-10-30-lighting-B.png`)

| Layer | Rule |
|---|---|
| A pool | Added light (ADD, as the game's glows), centred on the light's foot on the ground. Four steps from the centre out: up to 0.25 of the radius `#f8de62` at 24%; to 0.50 `#eda83a` at 18%; to 0.75 `#eda83a` at 12%; to 1.00 `#b8661f` at 8% |
| Dither | A checker 0.03 of the radius wide on each side of a step's edge |
| Overlap | Where pools meet, a pixel takes the brightest step of any of them, never the sum (the same rule as the shadows) |
| On sprites | The pool lies over the ground and over every sprite inside it: the well, the stall's posts, the player |
| Lamp | Radius 1.5 tiles (96 art px). Lamps in or near the frame: 30,7 foot (24, 392); 33,7 foot (216, 392), its head behind the house at 31,5; 34,4 foot (280, 200); 37,13 foot (472, 776), off the right edge |
| A lamp's head | Two steps of `#f8de62`, ADD: 50% within 6 art px of the head, 25% within 12. Heads at (24, 280) and (280, 88) |
| Fire | Radius 2 tiles (128 art px), centred on the hearth at (-40, 296), off the left edge |
| Lit window | Pell's glass pixels (`house_small` sprite, the `#8f94a8` and `#c6cad6` panes) recoloured `#eda83a` and `#f8de62`, whole pixels, opaque; its pool an ellipse of 1 x 0.625 tiles (64 x 40 art px) on the ground in front of the wall at (358, 600) |
| Body light | The sun stands south-west at 17:30 (the shadows point up-right), so on the player the 4 left art px of every row are one step lighter on their ramp and the 4 right art px one step darker. The ink outline stays ink |

What B shows: the evening reads warm where there is light and stays the hour's grey between the lights. The player in front of Pell's door is lit by the window and shaded on the right.

### C: B plus cloud shade and motion caught in one frame (`frames/2026-10-30-lighting-C.png`)

| Layer | Rule |
|---|---|
| Cloud shade | Three soft shades, multiply `#172a52`, each an ellipse 1.25 times wider than tall: 8 tiles across at (-60, 150), 6 at (430, 690), 10 at (90, 1010). Full inside 0.6 of the radius, falling to nothing at the rim. Three steps, 4%, 8% and 12%, an ordered 4x4 dither between them (the mist's own matrix). One shade where clouds overlap. Drawn under the pools: a cloud shades the sun, not a lamp |
| Sun shaft | One band 1 tile wide along the sun's line (1.03 right, 0.40 up, the 17:30 shadow's own direction) from (-20, 720), ADD `#f8de62` at 6%, only where a cloud's density (1 at its heart, 0 past its rim) is under 0.25, so the shaft runs in the gaps between clouds and stops where their first 4% step begins |
| Dust motes | 14, 2x2 art px, `#f5f4ef` at 45%, inside the shaft, placed by a seeded pick (seed 7); embers seed 3, fireflies seed 11 |
| Embers | 7, 2x2 art px, `#f8de62` and `#eda83a` in turn, rising 0.5 to 2 tiles over the hearth and carried right by the same wind |
| Fireflies | 5, a 2x2 core of `#c8e88a` with a 1 px ring of `#84c450` at 40%, in the meadow at the bottom edge, where no pool reaches |
| Flame shape | Each fire's and lamp's pool edge carries 3 lobes of 4% of its radius, each light at its own phase: the shape a flicker gives the light at one instant |
| Grass bend | In the bottom meadow, the two lightest greens lean 1 art px right at a gust's edge and 2 at its heart (rows alternating every 6) |
| Not in this frame | Water and trees: the square has neither. Their rules for the build: water highlights move along the shore's dashes (`#7cc4ec` and `#c4ecf8`) 1 art px a frame-step; a canopy bends its top third 1 to 2 art px with the gust, the trunk still |

What C shows: at phone size C is close to B. The 12% cloud shade barely reads, as STYLE 7's 12% barely read on 20.10, which is why the built shade is 34%. The particles read only where they are bright on dark (embers, fireflies); the motes and the grass bend need motion to be seen at all. A still is a poor judge of motion, so C is the least certain of the three.

## 4. What each rung costs on a 2K phone

Estimates, not measurements. The headless browser in the cloud renders in software, so its frame times say nothing about a phone's GPU. The build measures each rung on a real phone with the overlay `?stats=1` (PR #421) before and after.

The unit is one full-screen blended pass: the game draws at the device's pixels (`game/src/view.ts`), so at 1440x3120 a pass reads and writes 4.5 million pixels. On a 2K phone's GPU (an Adreno 640 or Mali-G76 class) we estimate 1 to 2 ms a pass, from a blended fill of 2 to 4 billion pixels a second. The budget at 60 Hz is 16.7 ms, and at the 30 that Auto falls to on a low-tier phone (`game/src/settings.ts`) it is 33 ms.

| Rung | Cost | Reasoning |
|---|---|---|
| A, the hour's tint | +0 to 2 ms | One full-screen multiply. The dusk rectangle exists and is skipped while its alpha is 0; A keeps it on from 16:30 to dawn. Folded into the night's shade (one rectangle, one colour per hour) it costs nothing new |
| B, pools | +0.5 to 1 ms | On a lit town screen about five pools of 3 to 4 tiles across cover about half the screen once: half a pass. The heads and windows are a few small sprites |
| B, body light | about 0 ms a frame | Two columns per row, baked into the caster's texture when the sun's key changes (the cast layer's pattern), then only placed. Costs texture memory, not time |
| B, shadows inside a pool by night (STYLE 4) | +0.5 to 1 ms while a body moves in a pool | One more cast paint per light with a moving caster; nothing while all stand |
| C, cloud shade | +0 ms against today | Built: one tiled multiply, a pass when the sky has cloud. Softer steps are a different texture, not a new pass |
| C, particles | under 0.2 ms | Fewer than a hundred small quads; the game already runs emitters for smoke |
| C, sun shaft | +0.3 to 0.6 ms | A band over about a third of the screen |
| C, sway on prop sprites (tall grass, canopies, flames) | about 0.1 ms | Per-vertex movement of a few dozen sprites |
| C, a motion shader over the whole ground (meadow bend, water) | +1 to 3 ms | Every ground pixel pays a second texture read and a little arithmetic: one to one and a half passes |

So A and B together cost about one pass, the price of one more fog bank. C is cheap with sway on props and particles, and its ground shader is the largest single cost on this page: up to 3 ms, about a fifth of a 60 Hz frame (16.7 ms) and about a tenth of the 33 ms a low-tier phone gets at 30.

**Measured at the build (30.10).** `tools/stills/frame-time.mts`: the built game in headless Chromium at 1440x3120 (480x1040 CSS px at 3x), the CPU throttled 4x, the High preset with no cap, the square by Pell's shop at 19:30 with `?cloud=2`, the elder's hearth lit; the frame's real interval over six seconds, read by `requestAnimationFrame`, two runs each. The `?stats=1` overlay was read too, but its ms are Phaser's smoothed delta, which a slow frame clamps: it showed 16.7 ms at every rung, so the interval is the number. WebGL here is SwiftShader, software on the CPU, so the numbers compare the rungs with each other and say nothing absolute about a phone's GPU. No rung was dropped for its cost; the owner decides.

| Rung | Frame, p50 (ms), two runs | Against the start |
|---|---|---|
| Before any change (`develop` with #439) | 383, 383 | |
| `light.ts` numbers and the `params` table | not drawn: no draw call changed | |
| The pool layer: the hour's shade with every light cut out of it, the pools, the heads, the lit windows | 517, 450 | +70 to +130 |
| The sun shaft and its dust | 533, 567 | +150 to +180 (no shaft at 19:30, sun down: run noise) |
| Body light and the night's own shadows | 533, 517 | +130 to +150 |
| Motion: the sway on the camera, the flame on the tongues | 617, 600 | +220 to +230 |
| The redraw cut (after CI's phone opening ran an hour late): the two textures redrawn only when what they show moves, on a 32-unit grid; a fire's flicker on a 250 ms beat; the ring only at night; the sway off where no meadow, grove or water is in view | 633, 617 (a still frame, which never redrew) | the same standing; the walk is where it saves |

What the walk costs shows in the phone opening played with the CPU at 4x (`E2E_CPU_SLOWDOWN=4 pnpm e2e:group opening-phone`, the way CI's runners are slow): `develop` cooks the stew at 18:00 and reaches the arch at 20:00 in 529 s; the ladder before the cut cooked it at 19:00 and missed the evening's dig (CI failed there twice); after the cut it cooks at 18:00 and passes in 538 s.

**The sway where WebGL is drawn in software.** After `develop` merged in, CI's phone opening ran two hours late again. On a meadow at noon (no shade, no pool) `develop` draws a frame in 250 to 267 ms and the ladder in 367 to 383: the sway's pass over the camera is a third of a frame when WebGL is SwiftShader. So the sway, and the flame shader with it, runs where WebGL has a graphics chip, phones of every tier included as the owner asked, and not in software WebGL (SwiftShader, llvmpipe: a machine without a graphics chip, or a test runner); `?sway=on` and `?sway=off` decide for a still, a clip or a measurement (`richground.ts` `swayOn`, pinned by a test; the still and clip scripts ask for it on). With the CPU at 4x the phone opening then cooks the stew at 18:00 and passes in 535 s, against `develop`'s 533 s.

The largest steps are the two full-view textures of the pool layer and the sway's pass over the camera, as section 4 estimated: one and about one more full-screen pass. The game's page grew from 1,868.90 kB to 1,885.37 kB minified (+16.5 kB, 503.40 to 509.38 kB gzipped); Vite's chunk warning at 1,600 kB was already passed before this build and its limit is unchanged.

## 5. The owner's three questions, with a recommendation each

**1. How strong is the hour's tint?** A shows 18% at 17:30 from the table proposed in ART_SYSTEM 2 (12% at 16:30, 28% at 19:00).
Recommendation: keep that table, no stronger. A multiply only darkens; a stronger one makes the afternoon dim, not golden, and eats the margin between the dusk and the night's 92% that tells a player the dangerous hour is coming. The warmth comes from B.

*The owner, 30.10: "compare to the reference pictures, and if there is no conclusion compare to more pictures from the internet". The comparison, measured (boards [1730](frames/2026-10-30-tint-compare-1730.png) and [1900](frames/2026-10-30-tint-compare-1900.png)):*

- **What is compared.** The square of still A at 17:30 with `#eda83a` at 0, 12, 18, 28 and 40%, and at 19:00 with `#e2533f` at 0, 18, 28, 40 and 55%, each 1170x2532 over the same base, with the build's pools at the hour (`poolAt`: 0.625 of B's alphas at 17:30, full at 19:00), Pell's window lit and the body light, so only the tint differs along a row. The 19:00 row uses the 17:30 base: at 19:00 the game's night shade is still 0, and the fog banks (20% then) are left out so the row shows the tint alone.
- **The measure.** For every picture the mean a*, the mean b* and the mean chroma C of the midtones (luma 0.25 to 0.75, Rec. 709) in CIELAB D65, sky and ground read apart (`tools/src/light/tint.ts`, pinned by `tools/test/light-tint.test.ts` on one fixture). Our frames look straight down, so the whole frame is ground and they have no sky. The pick is the strength whose ground numbers sit closest (straight distance over a*, b* and C) to the references' median ground. `python3 tools/stills/tint_compare.py` re-makes both boards and every number.
- **The references.** The repository names one picture for the golden hour: the key art. No page under `docs/art` or `docs/design` names another for light or dusk (grep for reference, golden and dusk). The key art comes as a poster and a 17-second video whose light warms as it runs, so the poster and five frames of the video were read, each with its sky and ground boxes drawn on the board (`tools/stills/refs/refs.json`).
- **The web references were not fetched.** This session's network refuses Wikimedia Commons, Unsplash, Pixabay, Openverse, Flickr and Poly Haven (403 at the proxy), so no outside picture is in the table. Six to ten openly licensed golden-hour and dusk photographs of a village or a meadow can be added to `refs.json` (file, page URL, licence) and the boards re-made by the one command; the table below is ready for them.

| Reference | Licence and page | Ground a* / b* / C | Sky a* / b* / C |
|---|---|---|---|
| Key art, poster (`web/public/keyart/hero-poster.jpg`) | The game's own | 3.4 / 4.7 / 11.3 | 3.1 / -14.1 / 19.4 |
| Key art, video at 0.5 s (`web/public/keyart/hero.mp4`) | The game's own | 4.4 / 4.3 / 11.8 | 4.3 / -14.2 / 19.8 |
| Key art, video at 4 s | The game's own | 4.8 / 5.5 / 12.4 | 5.4 / -7.1 / 16.5 |
| Key art, video at 8 s | The game's own | 4.8 / 5.8 / 12.4 | 5.4 / -5.8 / 16.1 |
| Key art, video at 12 s | The game's own | 4.8 / 5.7 / 12.4 | 5.9 / -3.6 / 17.7 |
| Key art, video at 16 s | The game's own | 4.5 / 4.8 / 12.0 | 4.8 / -9.8 / 19.8 |
| **Median** | | **4.6 / 5.1 / 12.2** | 5.1 / -8.5 / 18.5 |

| 17:30, `#eda83a` | 0% | 12% | 18% | 28% | **40%** |
|---|---|---|---|---|---|
| a* / b* / C | 3.7 / -4.3 / 10.3 | 3.9 / -0.8 / 8.2 | 4.1 / 0.9 / 7.5 | 4.2 / 4.1 / 7.4 | 4.2 / 8.2 / 9.7 |
| Distance to the median | 9.7 | 7.2 | 6.4 | 4.9 | **4.0** |

| 19:00, `#e2533f` | 0% | 18% | **28%** | 40% | 55% |
|---|---|---|---|---|---|
| a* / b* / C | 4.0 / -2.9 / 10.3 | 7.1 / 0.0 / 10.3 | 8.8 / 2.4 / 11.4 | 11.2 / 5.6 / 13.9 | 14.6 / 9.9 / 18.5 |
| Distance to the median | 8.3 | 6.0 | **5.0** | 6.8 | 12.7 |

**What the numbers say.** At 19:00 the table's 28% is the closest: weaker leaves the cobbles blue-grey (b* under 0, the references' ground is warm at b* 5), stronger overshoots into red (a* 11 and up against 4.6). At 17:30 the closest is 40%, the strongest in the row, with 28% next (4.9 against 4.0): the gold multiply warms b* slowly and lowers the chroma first (it greys the blue cobbles before it yellows them), so it takes a strong gold to reach the key art's warm ground. The 17:30 row's best sits at its edge, so the curve may still fall a little past 40%.

**Recommendation from the measure:** 19:00 stays at 28%. 17:30 moves from 18% to 28% (the table's 19:00 strength one key earlier, the next closest at 4.9) or to 40% (the closest at 4.0); 40% at 17:30 makes the late afternoon as dim as the dusk, which is the cost the first recommendation named. The references are one painting, so the measure narrows the pick to 28 or 40 at 17:30 and does not settle it; more photographs in `refs.json` would. The build ships the provisional table (16:30 12%, 17:30 18%, 19:00 28%) as numbers in `content/core/params.json` `light.keys`, so the owner's pick is a one-line change.

**2. Do light sources colour the day and the dusk, or only the night?** B shows the lamps, the window and the hearth at full at 17:30.
Recommendation: dusk and night, not the day. The lamps and windows light at 17:00 and their pools rise from half to B's numbers by 19:00; a burning fire shows its pool from 16:30, since a fire is lit by choice. A pool at noon reads as a mistake and says nothing; a pool coming on at 17:00 is the town telling the player the evening has begun, a cue that is not colour alone.

**3. Are cloud shade and motion worth their cost on a phone?** C shows both at once, as the brief set the rung. Its parts differ in cost and are not one choice: the owner can answer each part on its own (the cloud shade's strength, the particles, sway on props, the ground shader), and the recommendation below is split the same way. If a part needs its own still, it is one more frame from the same base and numbers.
Recommendation: yes for the cheap part, later for the rest. Keep the built cloud shade at 34%: C's 10 to 15% does not read at phone size, as on 20.10. Build particles (embers, fireflies, motes) and sway on prop sprites now, behind `RICH.motion`. The ground shader for the meadow and the water waits for a measurement on a real 2K phone: it is the one rung that can cost 3 ms, and its gain is seen only in motion, so the owner judges it in the live game, not in a still.

*Closed, the owner's pick, 30.10 10:58:* **17:30 at 28% and 19:00 at 40%.** At 17:30 the pick is the table's next closest (distance 4.9; 40% was 4.0); at 19:00 the owner went warmer than the closest number (28%, distance 5.0; 40% is 6.8) on purpose: "It is a pastoral place, the red is beautiful, a spectacular sunset, a bright summer day and a rainy winter - exactly the direction." The built table in `content/core/params.json` `light.keys`: 15:30 none, 16:30 `#eda83a` 12%, 17:30 `#eda83a` 28%, 19:00 `#e2533f` 40%, 21:00 to 04:00 the night `#172a52` at STYLE 5's 92%, none from 06:00; the strength steps evenly between keys, the colour is the next key's. The summer day and the rainy winter are direction for NATURE's seasons and weather, not built here.

**For a colour-blind reader:** nothing here carries meaning by hue alone. A pool is brighter than its ground; a cloud is darker; the lit window is the brightest thing on the building; embers rise over a fire and fireflies sit low in the meadow with a ring around them. The red and green of the palette carry no light signal.

## 6. The build after the pick

One engine session, in the `world.ts` window STYLE already names for the shadows and the night.

| File | What changes |
|---|---|
| `game/src/light.ts` | The pool's four steps, radii and dither as numbers; the hour gate of question 2 (`poolAt(minute)`); the head glow; one function per number, pure, so a test pins them and the 3D door reads them; `washAt` steps the tint to the next key's colour rather than mixing channels, so every minute's wash is a palette colour |
| `content/core/params.json` | The `light.keys` table of question 1 (16:30, 17:30, 19:00 and the night) |
| `game/src/scenes/world.ts` | The pool layer (ADD images, brightest step wins), the lit-window images and their pools, the dusk rectangle folded into the night's shade, the particles |
| `game/src/cast-layer.ts` | Body light baked per sun key; by night, the shadow from the light whose pool a caster stands in (STYLE 4, "Night") |
| `game/src/richground.ts` | Which ground pixels may move: the meadow's two lightest greens and the water's dashes, as a mask for the shader |
| `game/src/sky.ts` | Nothing, if the built 34% is kept |
| A shader or two | `sway` for the ground mask and the prop sprites (grass, canopies), `flame` for a flame's outline; both behind `RICH.motion`, with reduced motion keeping them still (G29) |

Stays out: normal maps (an automatic kit stage once the sprites settle, decision 6), weather and rain's shine, the moon, indoor light, the night's final level (the owner's in the live game), new sprites, and anything the kernel reads. The 3D door follows from the same `light.ts` numbers, after the pixel game (NEXT 8 e).

Proof at the build: stills at 08:00, 12:00, 16:30, 17:30, 19:00 and 22:00 of this square against this page's numbers; `?stats=1` on a real 2K phone before and after each rung; the e2e's colour checks untouched or updated in one pass.

## 7. Built (30.10)

The owner's answers: A no, B yes, C yes, so the whole ladder; question 1 closed in section 5 (17:30 28%, 19:00 40%); question 2 as recommended (lamps and lit windows from 17:00 at half, full by 19:00, none by day; a burning fire from 16:30); question 3 yes to the motion, the ground shader included and measured, not gated on the weak phone, with a note: "the phone is the volume, but do not weigh it too much; in parallel, clouds plus fog at night make the game hard to see, think how to balance that", which became the night readability rule below.

| Part | Where | How |
|---|---|---|
| The numbers | `game/src/light.ts` | `POOL_STEPS`, `POOL_DITHER`, `POOL_RADIUS`, `HEAD_GLOW`, `GATES` and `poolAt`, `CUT`, `READ` and `readableAlpha`, `cloudAt`, `bankAt`, the body light's `bodyStep` and `bodyLight`, a light's own sun by night (`poolSun`), the sun shaft (`SHAFT`, `shaftAt`), each pinned in `game/test/light.test.ts`. `washAt` steps the colour to the next key's |
| The hour's shade | `content/core/params.json` `light.keys`, `game/src/light-layer.ts` | One texture over the view at art pixels, the hour's colour as one opaque multiply factor; the old dusk rectangle and the night's blue veil are folded into it. The plain valley (`?rich=none`) keeps its veil |
| The pools | `light-layer.ts` | A second texture, each step a disc drawn from the outermost step of every light to the innermost, opaque, so the brightest step wins; added over the shade. Every light also cuts its pool out of the shade in STYLE 5's two steps (clean inside half the radius, half the shade to the rim). Lamps 1.5 tiles, fires 2, windows an ellipse of 1 by 0.625 tiles; a lamp's head in two steps |
| Lit windows | `world.ts` `lightWindow`, `light-layer.ts` `litWindow` | The house's own glass recoloured in the fire ramp, drawn in code (no new sprite), on a house with a shop's sign at its wall (Pell's); lifted over the shade, as a fire is at night |
| Fires | `world.ts` | A fire's pool replaces its old glow, from 16:30, dimming with its last wood; its sparks were built |
| Particles | `world.ts` | The sun shaft, `#f8de62` added at 6% along the sun's line on a cloudy late afternoon, with dust drifting in it; the sparks over a fire and the fireflies after dark were already built |
| Body light | `game/src/cast-layer.ts` | The player and the people: a copy of the texture lit from one side, 4 art px a step up the ramp on the lit side and a step down on the far side, the ink kept; none at noon |
| Night shadows | `cast-layer.ts` | A body in a lit pool casts away from that light, longer the farther it stands; outside every pool nothing casts |
| The pixels that may move | `game/src/richground.ts` | `MOVES`: the meadow's two lightest greens and the water's two light dashes; `groundMask`, `leanAt` |
| Motion | `game/src/motion.ts` | Two custom filters behind `RICH.motion`: the sway on the camera before its grade (the moving colours lean 1 to 2 whole art px with a gust anchored to the world, so a tile, a tall grass and a canopy's highlights move and a trunk does not; the water's dashes drift); the flame on a fire's drawn tongue. Reduced motion turns `RICH.motion` off, so both hold still (G29) |
| Cloud shade | `game/src/sky.ts` | Untouched: the built 34% stays by day |

**The night kept readable (the owner's note).** When the night's shade is on, the cloud shade fades to nothing by 20:00 (`cloudAt`: half the night's fade), and a fog bank cannot cover more than `light.read.fog` (40%) at full night (`bankAt`). Inside any light's pool the shade is cut (clean, or half in the ring), and in the ring of three tiles around the player the shade is held at what keeps the meadow's middle green (`#4c9a3f`, luma 0.51) at the **floor: luma 0.22, `light.read.floor` = 22 in `content/core/params.json`**, a number the owner can judge on the live preview; at the night's 92% that is a 68% shade in the ring. The night's dark frame (the vignette) keeps out of the ring too. Proof, the still at 22:00 with fog and full cloud (`2026-10-30-lighting-built-2200-fog.png`, the camera on the player as in play): the ground in the ring keeps a median luma of 0.191 against 0.274 at noon on the same cobbles, 70% of its daylight, so the meadow green reads about 0.36, over the floor; outside the ring and the pools it is 0.087. The cloud shade at 22:00 is 0 (faded by 20:00).

**Stills of the built game** (the square of section 2, 390x844 at 3x, the hearth lit, the HUD and the mist hidden): [08:00](frames/2026-10-30-lighting-built-0800.png), [12:00](frames/2026-10-30-lighting-built-1200.png), [16:30](frames/2026-10-30-lighting-built-1630.png), [17:30](frames/2026-10-30-lighting-built-1730.png), [19:00](frames/2026-10-30-lighting-built-1900.png), [22:00](frames/2026-10-30-lighting-built-2200.png), and [22:00 with fog and full cloud](frames/2026-10-30-lighting-built-2200-fog.png). `CLOUD=3 CX=568 CY=168 npx tsx tools/stills/lighting-shoot.mts <out> 35,11 22` re-makes the last one; the others take `CX=530.75 CY=135.5` and the hour.

**What a still shows that the numbers did not.** Under the night's ink, a pool's added gold over the blue-grey cobbles reads as a pale warm grey rather than gold: yellow added to blue tends to grey. The numbers are the decided ones; whether the pools want a warmer step is polish in the live game. The sway only moves the two lightest meadow greens, and the town square's rich tiles draw few of them, so it shows most in the open meadow and by water.

**Still open.** The night's final level (STYLE 5: the build starts at 92%, the owner sets it in the live game); the readable floor and the fog's cap, both one-line numbers in `light.read`; a real 2K phone's frame time, which this cloud cannot measure; the 3D door, paused, follows from the same `light.ts` numbers (NEXT 8 e).

The 22:00 square still pins the camera off the player (the square's framing), so its frame cut, which follows the screen's middle, and the shade's ring, which follows the player, show as two discs there; in play the camera holds the player in the middle and the two are one, as in the fog still.

**A fire's breath, on video.** [`frames/2026-10-30-fire-breath.webm`](frames/2026-10-30-fire-breath.webm) (14 s, 800 px, the elder's hearth at 19:00 with motion on) and its first frame [`2026-10-30-fire-breath.png`](frames/2026-10-30-fire-breath.png): the fire's pool and its cut in the shade grow and shrink together by up to 4% of the radius, on a beat of 250 ms (four breaths a second), at the flame's own phase; its strength holds; lamps and lit windows hold still. `npx tsx tools/stills/fire-clip.mts <dir> 31,9 19` records it and the ffmpeg line in that script's header stitches it.
