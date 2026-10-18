# The style spec: how the world looks at 32 px per tile

The look in one place, for creators and for every session that draws or renders the world. The pipeline (how art is made and imported) is in [ASSET_PATH.md](ASSET_PATH.md), and the file layout is in [docs/creators/README.md](../creators/README.md).

**Where it stands (2026-10-18)**
- Decided:
  - 32 px per tile (DECISIONS 2026-10-18).
  - Shadows C, the body's own shadow plus light on the body (DECISIONS 2026-10-18).
  - The night goes darker.
- Waiting for the owner:
  - how dark the night is (`night-N1` to `N3`);
  - height as rock faces or soft slopes (`terrain-T2` or `T3`);
  - the final look of each new ground, as stills at the ground wave.
- When it lands:
  - Nothing in the game changes before the engine step (docs/team/NEXT.md section 15).
  - Shadows and the night come with or after that step.
  - Grounds and height come with the open world's first ring ([OPEN_WORLD.md](OPEN_WORLD.md)).

A section marked *proposal* is the art session's recommendation, not yet the owner's pick.

## 1. The grid

| What | Size in art pixels |
|---|---|
| Ground tile, item | 32 x 32 |
| Character frame | 32 x 48 |
| Work pose | 64 x 64, two frames (tool raised, tool down) |
| Prop | up to 128 x 128 |

- A phone shows twelve tiles across. One art pixel is 3 device pixels on a 3x screen and 2 on a 2x one, always a whole number.
- Until the redraw waves, 16 px art stays legal and draws at density 1 (NEXT 15).

## 2. Pixels and colour

- **Colours:** only the 32 core colours (`tools/src/kit/palette.ts`).
- **Pixels:** every pixel fully clear or fully solid. No anti-aliasing, no gradients, no half-clear pixels.
- **Ramps** run dark to light:
  - greys: `#1b1a2e #3a3554 #5d6177 #8f94a8 #c6cad6 #f5f4ef`
  - greens: `#1f3d2b #2e6b3b #4c9a3f #84c450 #c8e88a`
  - earth: `#3d2618 #6e4226 #9e6b3c #c99a5e #ebd3a2`
  - water: `#172a52 #275a99 #3f8fd1 #7cc4ec #c4ecf8`
  - reds: `#5e1c28 #a8302f #e2533f #f6a07f`
  - fire: `#b8661f #eda83a #f8de62`
  - skin: `#d38c66 #f3c7a0`
  - purples: `#5b3373 #9a5bb0`
- **Outline:** characters, items and props have a one-pixel outline in `#1b1a2e`. Ground tiles have none.
- **Baked light comes from above.** Tops are lightest and undersides darkest, with left and right even. Light from the side is added while the game runs (section 4), and side light baked into the art would fight it.
- **Never draw a shadow into a sprite.** The engine casts it from the sprite's own shape, starting at the lowest solid row: that row is where the thing touches the ground.

## 3. Grounds

A ground is data:
- its fill tiles: 32 x 32, edge to edge, at least three variants;
- its ramp;
- its rank;
- whether it can be walked on;
- its footstep sound.

The engine draws the edges between grounds, so a new ground ships only its fill tiles and meets every other ground on its own (*proposal*: one shared set of ragged edge masks).

| Ground | Colours | Detail | Rank |
|---|---|---|---|
| Snow | `#f5f4ef`, `#c6cad6` drifts, `#c4ecf8` flecks | Drift lines every 11 rows along a slow wave, broken, plus a few blue flecks | 5 |
| Meadow | the greens | 6 to 8 tufts per tile, each a small V of 3 to 5 px in a lighter green, plus single darker pixels | 4 |
| Rock | the greys from `#3a3554` to `#c6cad6` | Broken slabs about 16 px across. Each crack is dark, with a light edge on the slab below it, and the cracks are left unfinished in places | 3 |
| Sand | `#ebd3a2`, `#c99a5e` ripples, `#9e6b3c` pebbles | Wind ripples of 3 to 5 px dashes every 7 rows along a slow wave, about one pebble per tile, rare `#f5f4ef` glints | 2 |
| Water | the water ramp | A 3 px foam line at the shore, shallow water (`#3f8fd1` with `#7cc4ec` dashes) for the first tile, deep water beyond (`#275a99` with `#3f8fd1` dashes). The depth reads by colour alone | 0 |

- The path, cobble, forest floor, grove and ruin floor keep their present tiles until the ground wave redraws them to this table.
- Later grounds (mud, ash, ice, moss, swamp) each add a row of their own.
- **On one level:** the higher-ranked ground lies over the lower on a ragged line, never along a tile edge. The pixel of the lower ground along that line is one step darker (frame `terrain-T1`).

## 4. Light and shadow (decided: C)

| Part | Rule |
|---|---|
| Cast shadow | The caster's silhouette, sheared away from the light. A pixel z rows above the lowest solid row lands at (x + z·sx, feet + z·sy). Colour `#1b1a2e` at 30%. Where shadows overlap, the ground is no darker than under one |
| Length | 0.8 to 1.1 times the caster's height at 08:00 and 16:30. At 12:00, no more than 6 art px past the feet |
| Direction | Free (the owner's word). The convention: a little toward the viewer, left in the morning, right in the evening. Every caster in a frame points the same way |
| Contact line | Two rows under the feet, `#1b1a2e` at 45% |
| Body light | The 2 art px on the side away from the light one step darker, the side toward it one step lighter. None at noon |
| Night | No sun shadow. Inside a light's pool, shadow and body light come from that light. Outside every pool, nothing casts |
| Raised ground | Casts the same way, with z = levels x 16 (section 6) |

Every number above is whole art pixels at one alpha, so the build is checked by stills at fixed hours against this table. Creators do nothing: every shadow comes from the sprite's alpha.

## 5. The night

- Darker than today (the owner, 18.10). Today the full night multiplies the screen by `#172a52` at 50%. The level, 50%, 68% or 85%, waits for the owner's pick.
- A light cuts a hard pool in two steps: no tint inside, half the tint in a ring around it.
- The player stays readable at every level, inside their own light (DECISIONS 2026-10-12).

## 6. Height (*proposal*; faces or slopes waits for the owner)

- **The layer.** A height layer beside the ground layer: one digit, 0 to 9, per tile, written in the map as rows like the ground. Integers only.
- **The face.** One level is 16 art px of face, half a tile. A thing standing on a level draws 16 px higher per level.
- **T2, faces:**
  - The face is in the grey ramp, with ledges every 8 px.
  - A light lip of 1 to 2 px runs along the top edge: white with drips under snow, `#84c450` under meadow, `#c6cad6` under rock.
  - A dark line of 2 px runs along the foot, and the face casts a shadow (section 4).
  - Where a top stands over a lower neighbour to the west or east, it gets a 1 px dark rim.
- **T3, slopes:** the drop is drawn in the upper ground. The crest is one step lighter, the upper half one step darker and the lower half two. It casts half the shadow.
- **Height limit:** one step shows at most 3 levels (48 px). Higher than that is a mountain band, which cannot be walked.
- **Walking.** Between levels only by steps or a ramp, a tile flagged as one. Stepping off a face is refused, like a solid tile. That is a kernel rule, so it goes to the owner first ([GAME_RULES.md](GAME_RULES.md) section 6) before it is built.
- **Both clients.** The 3D client already lifts its ground with noise (`game/src/play3d/scenery.ts`, the corner heights). With a height layer, both clients read the same data.

## 7. More depth, cheapest first (*proposal*)

| Cue | What it looks like | What it touches |
|---|---|---|
| Reflections | A thing standing by water shows in it, flipped, in `#275a99` at 35%. The reflection is cut at the shore and wobbles 1 px sideways as the water moves | the client |
| Into the grass | In tall grass or shallow water, the bottom 8 to 12 px of a character are hidden behind blades or a waterline. Today's 72% fade (`dimInCover`) gives way to this, and the kernel's cover is unchanged | the client |
| Cloud shadows | Large shapes of `#1b1a2e` at 12%, in whole pixels, drifting slowly over the ground by day | the client |
| Footprints | In sand and snow, fading after 20 s | the client |
| A shadow that stays down | When a body bobs or a dropped thing arcs, its shadow stays on the ground and grows as the thing lands | the client |
| Height | Section 6 | the map, the kernel, both clients |

The first two give the most depth for the least work. Each gets one still before it is built, and once it is agreed its details are polish.

## 8. Creators change the world

The owner, 18.10: players and creators will be able to change existing areas, even completely. For the look, that means:
- A ground and a height are data. A creator's file can re-ground or reshape an area, and the engine draws the edges, faces and shadows from that data. A creator draws fill tiles and sprites, nothing else.
- The core's checks still run on every change: walkability and the rules in GAME_RULES.
- How far a creator may change the core's own areas is question D2 in [OPEN_WORLD.md](OPEN_WORLD.md). The owner's word above reaches further than D2's recommendation. Writing it into the rules is the docs session's work.

## 9. What the check enforces

- **Today:** the palette, hard alpha and the sizes.
- **With the engine step:** the sizes for each density (NEXT 15).
- **Proposed with the ground wave:**
  - a ground tile fills its square edge to edge;
  - a ground uses only its own ramp plus at most two accent colours.

## 10. Frames

`docs/design/frames/`:
- `2026-10-18-art-size-*`: 16, 32, 48.
- `2026-10-18-shadow-*`: A, B, C and a day.
- `2026-10-18-night-*`: N1 to N3.
- `2026-10-18-terrain-*`: T1 to T3.

How each set was made: [2026-10-18-art-size.md](frames/2026-10-18-art-size.md) and [2026-10-18-light-and-ground.md](frames/2026-10-18-light-and-ground.md).
