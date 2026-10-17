# Beyond the mist: a landmark and the world's edge, three stills for the owner

B2 clears the mist for 5 tiles around the character and thickens it to almost solid over the next 6, so on a phone the eye gets only one to four tiles past the clear circle before the screen ends, and nothing behind a fog band is ever seen. D1 in the open-world draft asks how far the eye reaches past the clear circle, and how the grid's outer edge looks, since fog that never lifts must not look like fog that will (G54). These stills try one landmark drawn above the mist and an edge with a look of its own, one difference each, at the valley's west edge. Nothing here is in the game yet. B2 itself is approved but not built: these stills draw it for the captures only, matched to the 2026-10-10 frame, and a builder takes B2 from DECISIONS.md, not from these stills.

- `2026-10-16-landmarks-1-control.png`, `2026-10-16-landmarks-2-smoke.png`, `2026-10-16-landmarks-3-edge.png`: the three stills.
- `2026-10-16-landmarks-crops.png`: the band strip of each still (x 0-211, y 310-502) side by side, enlarged twice.

## What each still tests

Sizes are in game pixels unless marked CSS px. On a phone the game draws one game pixel as 2x2 CSS px.

1. **control**: B2 and the one mist, with nothing beyond. Past the map's west edge (screen x 0-115) lies a band of the kind the draft calls a fog band, drawn as B2's far mist: 15 of 16 game pixels, over the band's ground. Near a border B2's two criteria meet (no mist within 5 tiles, at least 90% at the border), and here the border wins, so the dark starts 2.5 tiles from the player, right past the valley's forest. This is also how the world's edge looks with B2 alone (D1's option 2): the same as a band that will lift.
2. **smoke**: as 1, plus one landmark above the mist: a column of smoke in the band, 4 tiles tall, rising out of the mist in single puffs and bending a little at its top. Its middle is level with the player, about 4.5 tiles due west of them and 2 tiles past the map's edge, and its source is not shown. In the build a landmark sits at its true place when that is inside the view, and at the view's edge in its direction when it is not. A band is at least half a view deep, so a landmark past one is never inside a phone's view: the still shows that edge place.
3. **edge**: as 1 on the valley's side; only the band strip changes, to the grid's outer edge, which never lifts. The land ends at a lip on the band's first tile (screen x 83-115): earth and stone one tile wide (wood, wood2, grey, grey2), lit along its outer side by a line of paper one game pixel wide, and broken every 2 to 4 tiles so it reads as ground, not a wall. Past the lip the mist has nothing under it: every game pixel is mist, ink2 with grey streaks 1 game pixel tall and 6 to 16 long running outward, as if the mist pours off the edge (Valheim's world-edge waterfall seen from above), and ink in the 2 game pixels under the lip as its shadow.

Why smoke for the landmark:

- Top-down hides height. A tower top seen from above is one more roof a tile or two wide, the size of every house and ruin pillar, so nothing shows that it is tall or far. Smoke draws its own height up the screen, in a shape nothing else in the world has.
- The night already holds many small lights: fire, lanterns, sparks, fireflies, glowing mushrooms, the ambient eye pairs and the wolf's eyes. A light would be one more dot among them, and a pair of lights in the dark already means eyes.
- Smoke is pale on the near-black band, so its brightness alone carries it, and colour blindness takes nothing away.
- The valley's houses already smoke (`game/src/scenes/world.ts:670`), so a far column says people and a place without a word (pillar 2).
- It needs no new art and stays on the palette.

Why a lip over the open sea (OSRS's edge):

- Water already means a promise: the draft's river border, where a crossing can come. Border water is at most 4 tiles wide, and wider water waits on this call.
- A forest means the wall a clearing quest can open.
- A lip with the mist falling away says there is no way on, in a look no restorable place uses (fog "awaiting restoration" tells a player the place can come back).

## The moment

One frame on a 390x844 phone at 13:02, the same in all three, opened with no rich parameter, so every enrichment group is on as players get it: a fresh save (New game, Forager), the player on (2, 20), the westmost walkable column of the valley, facing west. The valley's two forest columns lie between the player and the map's west edge. By day the frame's vignette is at strength 0.3 and radius 0.8, with no dusk wash.

For the captures only, the camera's bounds were widened 8 tiles west (a band is at least half a view deep), so the camera keeps the player in the middle: the feet at (195, 422), the tile centre at (195, 406) and the map's edge at screen x 115. The forest tile goes on for those 8 columns as the band's ground, today's thin mist (8% by day) is hidden, and B2 is drawn as the one mist, anchored to the world, under the player's stencil as today's mist is. The game and its CSS animations were paused on that frame, and only the named difference was redrawn between the captures. B2's light outline on the direction pad is not drawn; the pad sits over the band as it does today.

The HUD is develop's. Out here it shows its "Dark in" row, so the tracker ends at y 182.5, lower than in the town.

## The numbers

Measured on the stills, or on the capture layers before the colour grade and the vignette where marked. Contrast is the WCAG ratio.

The view:

- The free game area runs from the tracker's bottom (y 182.5) to the direction pad's top (y 682).
- From the tile centre it reaches 7.0 tiles up, 8.6 down and 6.1 to each side, 9.3 and 10.6 tiles to its top and bottom corners.
- So past B2's 5-tile circle the eye gets 2.0 tiles up, 3.6 down and 1.1 to each side before the screen ends. B2 reaches 90% only at 10-11 tiles, which shows only in the free area's two bottom corners.

B2, on its layer, on the valley's side:

| Ring, tiles | 5-6 | 6-7 | 7-8 | 8-9 | 9-10 | 10-11 |
|---|---|---|---|---|---|---|
| Mist share in the free area | 0.015 | 0.186 | 0.436 | 0.586 | 0.747 | 0.871 |
| The 2026-10-10 frame | 0.02 | 0.19 | 0.44 | 0.59 | 0.77 | 0.90 |
| ink2, ink, grey on the whole layer | 0.85, 0.00, 0.15 | 0.53, 0.32, 0.15 | 0.46, 0.38, 0.16 | 0.62, 0.24, 0.14 | 0.71, 0.08, 0.21 | 0.74, 0.08, 0.18 |
| The 2026-10-10 frame | 0.82, 0.00, 0.18 | 0.57, 0.30, 0.14 | 0.53, 0.38, 0.10 | 0.63, 0.24, 0.13 | 0.71, 0.10, 0.19 | 0.80, 0.09, 0.11 |

- No mist pixel lies within 5 tiles of the tile centre on the valley's side.
- Split into 16 sectors around the tile centre, the share never falls from one ring to the next.
- In the free area alone the colour mix is within 0.1 of the frame's for every ring but 9-10: that ring shows only as two corners, which hold one grey patch (grey 0.33 against 0.19).
- Over the band, each of the 1,728 whole 4x4 cells holds exactly one ground pixel, so 15 of 16 game pixels are mist, in ink2 0.81, ink 0.09 and grey 0.10.

The smoke (2):

- 128 CSS px tall (64 game pixels, 4 tiles); 4 CSS px wide at its foot, where it is single 2x2 puffs like the chimneys' smoke, and 12 at its widest, so it is more than 10 times as tall as it is wide.
- Its box is x 41-59, y 342-470: in the band and in the free area, clear of the HUD, the pad and the player. Its middle is at y 406, level with the tile centre.
- Its foot thins: the bottom 16 CSS px hold 36 pixels of smoke against 132 in the top 16.
- On its layer: paper 157, paper2 72 and grey2 26 game pixels, so paper and paper2 make 90% of it; every pixel fully clear or fully solid.
- On the still, against the band's median pixel within 16 px of it (`#312e46`): its paper core `#a1a0a5` 5.0:1, paper2 `#878996` 3.8:1, grey2 `#66697b` 2.4:1, and its median pixel 5.0:1.
- No smoke pixel is warm or coloured (the largest gap between its red, green and blue is 21 of 255), so it cannot be read as a light or an eye.

The edge (3):

- The lip is 32 CSS px wide (x 83-115) and runs the whole height of the screen. The free area holds 4 of its breaks, 9% of its length.
- Its lit side is `#b4b2b6` on the still: 7.9:1 against the ink shadow beside it (`#1e1d2f`) and 6.1:1 against the mist past that (`#322f46`).
- Past the lip, on its layer: no ground pixel (16 of 16 mist, against 15 of 16 in 1 and 2), ink in the 2 game pixels under the lip without exception, and grey streaks over 19% of that strip in the free area.
- The lip uses wood, wood2, grey, grey2 and paper, the mist ink2, grey and ink; every pixel fully clear or fully solid.

The captures:

- A second capture of 1, taken last, matched the first with 0 pixels different.
- 1 against 2: 1,020 pixels differ, all inside the smoke's box; 0 outside it.
- 1 against 3: 37,796 pixels differ, all in the band strip (x below 115, the parts under the HUD and the pad included); 0 outside it. 2 against 3: 0 outside the band strip.

Nothing leaves the 32-colour palette, so no still needs an exception to the style compass of 2026-10-09 in DECISIONS.md.

Two looks changed while the stills were made, each for a reason. The smoke was first a straight column, 6 CSS px wide at its foot and 14 at its top, and it read as a pole, so it is drawn as puffs that bend at the top. The lip's lit side was first paper2, which measured 4.35:1 against the mist at the lip's outer side, where the vignette is darker than at its middle, so it is paper.

## The question

Which of 2 and 3 go in: **both, one or neither** (1 is B2 alone)? And near a border, should the band's mist **cut into the clear circle**, as in all three stills: **yes or no**?

Recommended default: **both, and yes.**

- Past the circle a phone shows only 1.1 to 3.6 more tiles, so without a landmark nothing behind a band is ever seen, and a long walk has no goal the eye can hold.
- The world's edge must not look like fog that will lift. In 1 the edge and a band that will lift look the same; 3 gives the edge its own look.
- B2's two criteria cannot both hold within 5 tiles of a border. A yes keeps the border dark right up to the player, as here; a no keeps the clear circle whole, so the band's mist starts 5 tiles out and the border reads weaker within them. A no changes the base of all three stills, so they are recaptured together.

Its costs:

- Smoke moves, and a still shows one moment of it. Its drift over B2's dots can shimmer in motion, which only a walk-by on a real phone shows.
- At night the column dims with the world, where a light would read better. A faint glow at its foot could carry it then; that is not shown here.
- A landmark past a band is never inside a phone's view, so the build draws it at the view's edge in its bearing: a new mechanism that can read as a compass or a HUD marker. A still shows one place of it, never its slide along the edge as the player walks.

## The 3D client

The 3D client already sees far: its day fog (`FogExp2` at 0.009, `game/src/play3d/scenery.ts:739`) keeps half of a thing's colour up to about 92 units, and its far plane is at 160 (`game/src/play3d/world3d.ts:221`); B2 is not defined there. A landmark would be a real column of smoke, made of particles at its true place with fog turned off on its material, and past the far plane a card on the sky at its bearing. The edge would be a real drop with a sheet of mist falling over it, the Valheim waterfall itself. Nothing of it is captured here.

## After the pick

- DECISIONS.md takes the picks with their frames.
- The landmark layer (about 80 lines, stage 5) draws one landmark per region: at its true place inside the view, and at the view's edge in its direction outside it.
- The grid's outer edge is drawn in 3's look, from the borders. Fog bands keep 1's look until their region ships.
- B2's build (stage 5) takes the yes or no.
- The rule for border water wider than 4 tiles follows: with 2, a far bank past the circle can still be seen by its landmark; without it, border water stays at most 4 wide.
- The change that drew these stills was for the captures only and is not committed. Until then the game keeps today's mist.
