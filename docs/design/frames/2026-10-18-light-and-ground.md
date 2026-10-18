# Shadows, the night and the ground at 32 px, three sets of stills (2026-10-18)

The owner asked for two things on 18.10. First: "the characters lack a shadow that changes during the game, and other small elements that make it feel 3D". Then: "the night should be darker", plus height and grounds other than grass. These stills were made for those picks. Each frame is 1170x2532, a 390x844 phone at 3x, with twelve tiles across at 32 px per tile, so one art pixel is 3 device pixels. Nothing is built and no game code changed.

The sprites are the 32 px redraws behind `art-size-32`. The boulders and every ground except the meadow were drawn by a script in the core palette. They stand in for the ground wave and are not finished art.

## Shadows (16:30), one difference each

| Frame | Tests |
|---|---|
| `shadow-A` | Today's oval under each thing, moved and stretched away from the sun. |
| `shadow-B` | The caster's own silhouette laid on the ground and sheared away from the sun: long in the morning and evening, short at noon. |
| `shadow-C` | B plus light on the body. A dark line under the feet, the two art pixels on the side away from the light one step darker, and the side toward it one step lighter. |
| `shadow-day` | A, B and C (columns) at 08:00, 12:00, 16:30 and 22:00 (rows). At 22:00 only the lantern casts: shadows inside its pool point away from it, and nothing outside the pool has one. |

Every shadow pixel is a whole art pixel of the outline colour `#1b1a2e`. The cast shadow is at 30% and the line under the feet at 45%. Where shadows overlap, the ground is no darker than under one.

Picked: C. Which way the shadow points does not matter to the owner (DECISIONS 2026-10-18).

## The night (22:00, C shadows), one difference: how dark the unlit ground is

| Frame | Night blue over the screen |
|---|---|
| `night-N1` | 50%, today's full night (`shadeFor` in `game/src/scenes/world.ts`) |
| `night-N2` | 68% |
| `night-N3` | 85%: only what a light touches reads |

The lantern's pool is the same in all three: no tint within 44 art px, half the tint to 60. Today's vignette and mist are left out, so the frames show only the darkness.

Picked: darker than N3. The owner said "darker than N3; street lighting and the houses' light will light the town, but in nature it has to be scary and dark". The build starts at 92% (DECISIONS 2026-10-18).

## Height and grounds (16:30, C shadows)

| Frame | Tests |
|---|---|
| `terrain-T1` | Snow, a rock shelf, meadow, sand and water side by side on one level. The grounds meet on a ragged line. |
| `terrain-T2` | T1 raised into levels with rock faces. One level is 16 art px of face. A light lip runs along the top edge (white with drips under snow, light green under grass), a dark line along the foot, and a cast shadow from the sun. Steps are cut into the shelf. |
| `terrain-T3` | T1 raised into soft slopes. The drop is drawn in the upper ground, two steps darker, with no face, and casts half the shadow. |

T1 against T2 tests height. T2 against T3 tests the face against the slope.

Picked: T2. The owner said "T2 fits" (DECISIONS 2026-10-18).

## How they were made

A Python script with Pillow composes each frame on the art grid (390x844) and enlarges it 3x with hard edges. Shadows are computed from each sprite's alpha:
- A pixel at height z above the sprite's lowest opaque row lands at (x + z·sx, feet + z·sy).
- (sx, sy) comes from the sun's height at that hour: length = cot(elevation), capped at 1.4, with elevation = 8° + 62°·sin of the day's progress from 06:00 to 18:00.
- sx = −cos(progress) · length · 0.8 and sy = 0.3 · length, so a shadow always falls a little toward the viewer.

A raised tile casts the same way, with z set to its levels times 16. The night multiplies by `#172a52` at the level shown.
