# The art ladder: the green at 19:00, four stills, one loop and Pell (2026-10-20)

The direction step of [ART_SYSTEM.md](../ART_SYSTEM.md) section 1. One scene, one difference per frame, made as the 18.10 sets were made ([2026-10-18-light-and-ground.md](2026-10-18-light-and-ground.md)). Nothing in the game changed: no kernel, content, schema or sprite under `content/` was touched, and STYLE.md and DECISIONS.md are unchanged. The output is the frames and this note; the pick's record comes in a later pull request.

## The scene

The green by the elder's house at 19:00, when the last sun, the street lamp's pool and the hearth's fire are in one frame. Every frame is 390x844 art pixels, enlarged 3x to **1170x2532** (a 390x844 phone at 3x), with **64 px per tile**: 6.09 tiles across and 13.19 down.

| Part | Size and place in art px |
|---|---|
| Far bank meadow | y 0 to 56, the second region ramp from L1, with a field fence and two bushes |
| Water | y 56 to 197, four depth bands, the far oak and the boat reflected, three lily pads near the shore |
| Sand shore | y 197 to 232, five fading footprints, three reed clusters, driftwood and shells |
| Village green | y 232 to 844: meadow grass, not a paved square. A small worn forecourt of large flagstones and dirt around the well and the door, dirt patches under the bench, lamp, cart and hearth, a curved ragged path with stepping stones, a grass bed for the tall grass, two bushes, flowers and clover, one puddle |
| Forecourt | a ragged patch around the well, x 0 to 260, y 250 to 560 (about 4.1 x 4.8 tiles), and a narrow tongue to the door at x 190 to 390, y 430 to 630; cut by grass islands, 26 to 45 px flagstones 18 to 27 px tall in 6 to 7 px dirt joints, a stippled fringe, no drawn oval |
| Path | from the door step (290, 560) to (330, 844), 22 to 36 px wide, centre `290 + 26 sin((y-560)/110) + 0.04 (y-560)`, ragged edges and grass tufts, ruts, hoofprints, ten pressed stones and seven stepping stones |
| Dirt patches | nine worn patches, 56 to 104 px across, four overlapping ellipses each, 22 tufts and 36 mottled pixels at the rim |
| Bushes | two 30x22 shrubs at (348, 582) and (100, 560), in the leaf ramp, with contact shadows |
| Elder's house | 192x320 at (198, 252); a shingled roof 108 tall, a door 64x112 at (262, 460) with a canopy, two 32x32 lit windows with flower boxes, a wall lantern, a hanging leaf sign and a woodpile |
| Well | 128x160 at (48, 244); a shingled roof, a windlass, a rope, a bucket and a stone rim |
| Street lamp | 64x192 at (144, 424); a stone foot, an iron bracket and a chain; the lantern's light at (170, 458) |
| Hearth | 64x64 at (240, 680); a tripod and a cauldron over the fire at (272, 720) |
| Young tree | 128x192 at (-32, 652), framing the near-left corner, with branches, bark, a knot and moss |
| Far oak | 200x88 at (-54, -30), canopy only, overhanging the water |
| Boat | 84x30 at (248, 104); planks, a seat, an oar, a net and a rope coil |
| Mooring post | 24x34 at (228, 164), with a rope to the boat's stern |
| Bench, barrel, crate | 64x26 at (24, 470), 24x30 at (92, 442), 30x28 at (116, 478); a mug, hoops and slats |
| Handcart | 64x40 at (148, 698); two spoked wheels, a handle and two sacks |
| Elder | 64x96 at (208, 572), a detailed script-drawn stand-in beside the door: hood, pouch, robe folds |
| Pell | 64x96 at (312, 696), in the tall grass at the near edge |
| Tall grass | 104x80 at (288, 724), in front of Pell's feet |
| Bird | 24x16 at (230, 540); its shadow is the ground ellipse (272, 624) to (308, 636) |

The Pell sprites are the only real 64 px sprites in the stills. The house, well, lamp, hearth, trees, boat, bench, barrels, cart, elder, grass, water and ground are detailed script-drawn stand-ins in the frame's ramps, as the 18.10 boulders and grounds were: the 64 px ground wave is not built yet. They are for composition and light, not the final art. The Pell A, B and C sprites are the checked-in generated inputs (`tools/stills/inputs/`), drawn by Codex image generation for the density-64 trial and its two variants. No model is called at run time.

## What each frame adds

| Frame | Adds | Everything else |
|---|---|---|
| `2026-10-20-art-L0.png` | Nothing: 64 px, the 32 core colours, the one outline `#1b1a2e`, shadows C, the night rule at the hour, depth cues 1 to 5 | As decided |
| `2026-10-20-art-L1.png` | Colour craft: eleven material ramps of five or six steps, the hue moving cooler as it darkens and warmer as it lightens; every sprite outlined in the darkest step of its own ramp; the far bank's meadow in a second region ramp | As L0 |
| `2026-10-20-art-L2.png` | The light layer: the hour's warm wash `#e2533f` at 28%, light pools in four steps with a dithered edge against L0's two, and 12% shade under the canopies | As L1 |
| `2026-10-20-art-L3.png` and `2026-10-20-art-L3-loop.gif` | Motion as a one-second loop beside the still: chimney smoke, the hearth's flame, grass sway and water ripples; the still is frame 0 | As L2 |
| `2026-10-20-pell-A.png` | Pell at 64x96, the standard as decided: the density-64 redraw, in the 32 core colours with the one `#1b1a2e` outline | The green at 19:00, L0 light |
| `2026-10-20-pell-B.png` | Drakantos's proportion: the head and hands drawn larger (the face 39 px wide against A's 33, the hands 22 px tall against A's 10), still in the 32 core colours and the one outline | The same green and light as A |
| `2026-10-20-pell-C.png` | B plus colour craft: 23 local colours in hue-shifted ramps and the outline in the darkest step of the sprite's own ramp (`#5d183e` and `#6b1d3a`), not `#1b1a2e` | The same green and light as A and B |

The Pell frames put the candidate at (190, 620) on the same L0 green, with the house, well, lamp, hearth and path behind. They differ only in the sprite.

## The exact numbers

### Grid and light

| What | Number |
|---|---|
| Canvas | 390x844 art px, 3x, 1170x2532 device px; 64 px tile; 6.09 x 13.19 tiles |
| Hour | 19:00. The last sun, the street lamp and the hearth are all lit |
| Warm wash, L0 and L1 | `#eda83a` at 13% multiply (today's `0.4 x warmth(19, 20)`, 13.3%) |
| Warm wash, L2 | `#e2533f` at 28% multiply (the hour table's 19:00 value) |
| Dusk shade | `#172a52` at 30% over the frame, cut by every pool |
| Pool, L0 | Two hard steps: 0 inside, 15% in the ring, 30% outside. Lamp 96 then 160 px at (170, 458); hearth 40 then 104 at (272, 720); each window 24 then 56 at (232, 428) and (354, 428) |
| Pool, L2 | Four steps: 0, 7.5, 15, 22.5 and 30%. Lamp 96, 118, 140, 160 px at (170, 458); hearth 40, 62, 84, 104 at (272, 720); each window 24, 34, 44, 56 at (232, 428) and (354, 428) |
| Dither, L2 | A 50% checker in a 7 px band on every pool boundary |
| Canopy shade, L2 | `#1b1a2e` at 12% under the near and the far canopy |
| Light cores | The lamp's panes, the fire and the window panes are fire-ramp pixels in the sprites; no additive glow is layered on |

The 30% dusk shade is the still's number so the pool's steps read at 19:00. Today's code is at 0% at 19:00 and 50% at full night; the decided night is 92% from 20:00, and the owner's final level stays a live-game setting.

### The green

| What | Number |
|---|---|
| Grass | `draw_meadow` over y 220 to 844: a base fill, about 2,700 dark and light blade marks, about 270 six to twelve px tufts, ten taller clumps, fourteen flowers and eight clover; the L1 meadow ramp. L0 uses the core greens |
| Sand-to-grass edge | a wavy line at `224 + 4 sin(x/17) + 0 to 2`, four rows of sand above it, a tuft every third column. No straight border |
| Forecourt | eight ellipses unioned (x 0 to 380, y 250 to 610) minus four grass islands (x 14 to 388, y 300 to 620); stones 26 to 45 px across and 18 to 27 px tall in 6 to 7 px dirt joints, one in seven with a crack, 48 grass tufts in the joints; the edge stippled with grass and dirt pixels and ten loose stones outside |
| Path | `centre(y) = 290 + 26 sin((y-560)/110) + 0.04 (y-560)` from y 560 to 844; half-width `11 + 5 sin(y/19)` plus 0 to 2 px jitter; 84% `path_base`, 6% `path_alt`, the rest `path_dark`; two ruts 5 px either side; hoofprints every 19 rows; ten 2 to 4 px stones |
| Stepping stones | seven flat stones from y 596 to 800 every 34 px, 14 to 20 px wide and 8 to 10 px tall, alternating 2 to 4 px off the centre, one ramp step of outline and a top highlight, a soft shadow on the dirt; a tuft on either side of about half of them |
| Dirt patches | nine: under the bench, the lamp, the cart and the hearth, plus five on the open green; four overlapping ellipses, 22 tufts inside, 36 mottled grass/dirt pixels |
| Grass bed | an ellipse (318, 756) to (392, 844) in `grass_base` under the tall grass, 16 tufts |
| Puddle | (58, 778) to (82, 790), three water steps and a `path_dark` rim |
| Flowers and clover | fourteen flower clusters and eight clover clusters on the open green |
| No straight ground border | the shore, the grass edge, the forecourt, every dirt patch and the path are ragged or stippled; the only straight lines are the water's depth bands |

### Shadows, depth cues and motion

| What | Number |
|---|---|
| Cast shadow | The caster's silhouette: a pixel z rows above the feet lands at (x + 0.92z, feet + 0.36z). `#1b1a2e` at 30%. Overlaps are one shadow, not two |
| Contact line | Four rows under the feet, `#1b1a2e` at 45% |
| Body light | The four art px on the light side one ramp step lighter, the far side one step darker; light from the left. The outline never moves |
| Cloud shadows | `#1b1a2e` at 12%: one long band and two blobs |
| Reflections | The far oak and the boat, flipped, cut at the water, in `#275a99` at 35% (L0) or the water ramp's second step at 35% (L1 to L3), stepped 2 px sideways every 4 rows |
| Footprints | Five prints in sand at the shore, in the sand ramp's dark, mid and base steps |
| Shadow that stays down | A bird at (230, 540) with its shadow on the ground at (272, 624) to (308, 636) |
| Into the grass | The bottom 20 px of Pell behind the tall grass at the near edge |
| Loop | 10 frames at 100 ms, looping forever, at 1170x2532 |
| Smoke | Six puffs from the chimney, 54 px tall in the still and 56 +- 6 px in the loop, drifting about 24 px left |
| Flame | Six tongues, the loop's scale 1 +- 0.20 and a 3 px jitter |
| Grass sway | 24 shore blades and 26 tall blades, leaning +- 3 px with the wind |
| Water ripples | 22 dashes of 11 px, moving 4 px a frame; the reflection's 2 px step moves with them |

### Pell

All three are 64x96, feet on row 95. A is the density-64 redraw. B draws the head and hands larger: the face measures 39 px wide against 33, the hands 22 px tall against 10. C is B with 23 local colours and its own outline. The body light is four px a side; the outline is protected from it.

## The ramps the frames declare

L0's base art is the 32 core colours, dark to light:

```text
greys   #1b1a2e #3a3554 #5d6177 #8f94a8 #c6cad6 #f5f4ef
greens  #1f3d2b #2e6b3b #4c9a3f #84c450 #c8e88a
earth   #3d2618 #6e4226 #9e6b3c #c99a5e #ebd3a2
water   #172a52 #275a99 #3f8fd1 #7cc4ec #c4ecf8
reds    #5e1c28 #a8302f #e2533f #f6a07f
fire    #b8661f #eda83a #f8de62
skin    #d38c66 #f3c7a0
purples #5b3373 #9a5bb0
```

L1 to L3 declare these eleven material ramps beside the core, which the trial Pell still uses:

```text
wood    #2e1e24 #4a2c2a #6e4032 #95603c #bd8655 #e0b37a
stone   #3a3230 #5c4f48 #837369 #a99889 #cdbca7 #eadcc4
leaf    #16332f #27543a #3f7d45 #68a94f #a8cd6f
meadow  #243330 #3e5038 #5e7141 #889552 #b8b96d
water2  #12203f #1c3d6e #2c6494 #557f96 #c9b28a
cloth   #3a1a2c #5e2333 #8a3534 #b8543c #de7f52
skin2   #8a4a3e #b06a4f #d38c66 #eab184 #f7d3ab
fire2   #8c3a1e #b8661f #eda83a #f8de62 #fff3c0
plaster #4a3f38 #6b5c4c #918169 #b8a789 #dccdaa
iron    #262538 #3d3a4c #5c535f #877a80 #b3a79c
sand2   #3a2e2a #5e4a3a #8a6f4f #b59468 #d9bd8a
```

The hue runs, dark to light, in degrees:

```text
wood    337.5   3.8  14.0  24.3  28.3  33.5
stone    12.0  21.0  23.1  28.1  33.2  37.9
leaf    171.7 145.3 125.8 103.3  83.6
meadow  168.0 105.0  83.7  71.6  60.8
water2  221.3 215.9 207.7 201.2  38.1
cloth   326.2 343.7   0.7  11.6  19.3
skin2     9.5  16.7  20.9  26.5  31.6
fire2    15.3  27.8  36.9  49.6  48.6
plaster  23.3  31.0  36.0  38.3  42.0
iron    243.2 250.0 285.0 332.3  28.7
sand2    15.0  26.7  32.5  34.3  38.7
```

Pell C's 23 colours:

```text
#5d183e #6b1d3a #5c2929 #68282b #8c2b43 #7e3d2e #843d36 #854631
#b03a3a #905038 #98563d #b57347 #c27148 #b8764a #e4846f #d89a5f
#e4ab67 #e5ac68 #f5a082 #e6ae6a #f7a686 #f8a787 #f5f4ef
```

## The check

The composing script is `tools/stills/compose.py`. One command re-makes every frame and checks it:

```sh
python3 tools/stills/compose.py
```

It reads the three checked-in Pell sprites, writes the eight files into this folder, and prints, for each still, its size and `in the declared ramps`:

```text
2026-10-20-art-L0.png: 1170x2532, in the declared ramps
2026-10-20-art-L1.png: 1170x2532, in the declared ramps
2026-10-20-art-L2.png: 1170x2532, in the declared ramps
2026-10-20-art-L3.png: 1170x2532, in the declared ramps
2026-10-20-pell-A.png: 1170x2532, in the declared ramps
2026-10-20-pell-B.png: 1170x2532, in the declared ramps
2026-10-20-pell-C.png: 1170x2532, in the declared ramps
```

A pixel that is not a ramp step, or one of the declared blends of one with the declared reflection, shadow, wash, shade and pool steps, fails the run. A half-clear pixel and a frame that is not 1170x2532 fail it too. The GIF is a 256-colour reduction of the ten L3 frames; the L3 PNG is the exact frame 0.

Pillow only, no network and no model call. Each frame is composed on the 390x844 art grid and enlarged 3x with hard edges.

## What this does not change

- No number the kernel reads, no content, no schema, no sprite under `content/`.
- STYLE.md, DECISIONS.md and the art system page are unchanged. If L1, L2 or L3 is picked, the rule page changes in the pull request that records the pick, never before it.
- The scene is a direction still, not the built green: the ground at 64, the house at 64 and the props are stand-ins. The only real 64 px sprites are the trial's Pell, A, B and C.

## The pick

Two picks from the same batch: which of L0 to L3 becomes the direction, and which of A, B or C is Pell's proportion and colour. The recommendation is in the pull request's question.
