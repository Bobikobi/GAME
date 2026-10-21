# The style spec: how the world looks at 64 px per tile

The look in one place, for creators and for every session that draws or renders the world. The pipeline (how art is made and imported) is in [ASSET_PATH.md](ASSET_PATH.md), and the file layout is in [docs/creators/README.md](../creators/README.md).

**Where it stands (2026-10-18)**
- Decided (all DECISIONS 2026-10-18):
  - 64 px per tile, for 2K phones (the 2024 flagships and up). It supersedes the 32 px of the same morning.
  - Proportions are part of the standard (section 1b).
  - Shadows C, the body's own shadow plus light on the body.
  - The night: darker than N3 out in the wild, with the town lit by its lights. The final level is the owner's call in the live game.
  - Height as levels with rock faces (T2).
  - All six depth cues of section 7.
- Waiting for the owner:
  - the numbers of the proportions table, seen once on the first wave's phone still (section 1b);
  - the final look of each new ground, as stills at the ground wave;
  - the walking rule between levels, through GAME_RULES section 6 when stage 3 opens.
- When it lands:
  - Nothing in the game changes before the engine step (docs/team/NEXT.md section 15).
  - The shadows, the night with the town's lights, and depth cues 1 to 5 come with or after that step, in one window of `game/src/scenes/world.ts`.
  - The layers above the sprite (the light module, ramps per material and region, motion, composition) and the ladder of stills that decides their look: [ART_SYSTEM.md](ART_SYSTEM.md) (2026-10-20).
  - The world's natural laws (scale in characters, a climate per region, the seasons, the weathers as a look, the light's laws) and their sheets of stills: [NATURE.md](NATURE.md) (2026-10-21, proposal).
  - Grounds and height come with the open world's first ring ([OPEN_WORLD.md](OPEN_WORLD.md)).

**Both doors (owner, 18.10).** The whole standard holds for the 3D game at `/play3d/` too, in its own means: the proportions as ratios to a character's height, the light and shadow, the night, height and the depth cues. Only the pixel numbers are 2D's alone. The pixel game is built first, and the 3D game follows it. The 3D game may be desktop-only where a phone would block a rule. How it is carried across: docs/team/NEXT.md section 8 e.

A section marked *proposal* is the art session's recommendation, not yet the owner's pick. The stills of section 10 were made at 32 px per tile; every art-pixel number below is already doubled for 64.

## 1. The grid

| What | Size in art pixels |
|---|---|
| Ground tile, item | 64 x 64 |
| Character frame | 64 x 96 |
| Work pose | 128 x 128, two frames (tool raised, tool down) |
| Prop | up to 384 x 384 (six tiles a side) |

- **The screen.** The canvas draws at the device's own pixels, and one art pixel is always a whole number of device pixels: 2 on a 2K phone (1440 px across, about 11 tiles), 1 on a 1080 px phone (about 17 tiles, crisp but small; older phones are not a target). The camera's rule is in NEXT 15.
- **A face.** At 64x96 the head is about 24 to 28 px wide and the face about 20. Eyes are 2 to 3 px, each with a white and a dark pupil; brows, a nose and a mouth are drawn, not implied. The frame `density-64` is the measure.
- The check takes both grids since the engine step (NEXT 15): 16 px at density 1 (the default) and 64 px at density 4, and a size that belongs to the other grid is an error. The redraw waves move the kit to 64. Nothing drawn at 32 goes into a kit.

## 1b. Proportions (decided that they rule; the numbers wait for one look)

The owner, 18.10, on the walk video where an oak stood barely taller than Pell: "64 is the new standard ... bring in proportions". The character is the measure: a frame of 1 x 1.5 tiles, the body about 80 px tall. A top-down game shrinks the world around its people, and so does this one, but never below the ratios here.

| Thing | Today at 16 (tiles) | At 64 (tiles, art px) | Against a character's height |
|---|---|---|---|
| Character frame | 1 x 1.5 | 1 x 1.5 (64 x 96) | 1 |
| Work pose | 2 x 2 | 2 x 2 (128 x 128) | - |
| Grown tree (oak) | 2 x 2 | 3 x 5 (192 x 320) | at least 3 |
| Young tree | 1 x 1.5 | 2 x 3 (128 x 192) | 2 |
| Dead tree | 2 x 2 | 3 x 4 (192 x 256) | 2.5 |
| Canopy over a forest block | 2 x 2 | 3 x 3 (192 x 192) | over the head |
| Bush, berry bush | 1 x 1 | 1 x 1 (64 x 64), about 48 px tall | half |
| Tall grass, reeds, flowers | 1 x 1 | 1 x 1 (64 x 64), blades up to 24 px | a quarter |
| Street lamp | 1 x 2 | 1 x 3 (64 x 192) | 2 |
| Standing stone, pillar, totem, statue | 1 x 2 | 1 x 2.5 to 2 x 3 | 1.5 to 2 |
| Small house | 3 x 3 | 3 x 5 (192 x 320): the door 1 tile wide and about 112 px tall, the eaves at about 2.5 characters | 3 |
| Market stall | 2 x 2 | 2 x 3 (128 x 192), the counter at 48 px | 2 |
| Well | 2 x 2 | 2 x 2 (128 x 128), the rim at about 40 px | - |
| Rubble | 2 x 1 | 2 x 1 (128 x 64) | - |
| Ruin arch, ruin wall | 2 x 2 | 2 x 3 to 3 x 4 | - |
| Item | 1 x 1 | 1 x 1 (64 x 64), an icon, the thing filling 40 to 56 px of it | - |

People and animals, seen by the owner on 20.10 on `frames/2026-10-21-nature-scale.png` and picked as drawn, with the young tree at 2 above (DECISIONS 2026-10-20, "Nature's laws"). NATURE.md section 1 holds the kinds no still has shown yet.

| Thing | At 64 (tiles) | Against a character's height |
|---|---|---|
| Child | 1 x 1 | 0.65, the head kept at the adult's size |
| Elder | 1 x 1 | 0.9, stooped: a stoop, not a smaller body |
| Hen | 1 x 1 | 0.25 |
| Dog | 1 x 1 | 0.45 at the shoulder |
| Wolf | 1 x 2 | 0.55 at the shoulder: never taller than a person on four legs |
| Deer | 1 x 2 | 0.9 at the head, antlers to 1.4 |
| Horse | 1 x 2, with a cart 2 x 3 | 1.25 |

- **The map does not move.** A trunk, a door or a post stands on the tile it stands on today, and the solid tiles stay as they are (G59). A bigger drawing grows upward and over its neighbours, never into a new solid tile.
- **See-through.** A thing that draws over the player (a canopy, a roof, a tall prop the player walks behind) shows the player through it: a fade of the part in front or a silhouette, the builder's choice. A bigger prop never hides the player or a thing a task points at.
- **Measured at each wave:** on the opening's first frame and at the bridge, no wake tile, pickup or prop a task names is covered by another sprite's solid pixels over more than half its area, after the see-through rule.
- **The numbers** are the art session's starting point, and the owner judges them by eye (18.10: "only by eye will I know"). He sees them once, on the first wave's phone still; his correction goes into this table, and from then on it is the compass.
- **Bigger is open.** The table is a floor for each kind and the size of its common one. Above it a creator is free: a giant tree, a castle, a colossus (the owner, 18.10). Such a thing keeps the rules above (the map does not move, see-through, nothing a task names hidden). One sprite stays within the schema's 384 x 384, six tiles a side at 64; a larger thing is built from pieces, or the cap is raised in its own pull request.

## 2. Pixels and colour

- **Colours:** only the 32 core colours (`tools/src/kit/palette.ts`).
- **Pixels:** every pixel fully clear or fully solid. No anti-aliasing, no gradients, no half-clear pixels. This is the rule for a sprite and a ground tile. A layer the engine draws over them (a shadow, the night, a pool, the hour's wash, cloud shade, fog) is a blend at one alpha per step, and the result is still a fully solid pixel; such a layer never has more than four steps, and where two steps meet it may dither (ART_SYSTEM 2, NATURE 4 and 5).
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
- its fill tiles: 64 x 64, edge to edge, at least four variants;
- its scatter motifs (below);
- its ramp;
- its rank;
- whether it can be walked on;
- its footstep sound.

The engine draws the edges between grounds, so a new ground ships only its fill tiles and motifs and meets every other ground on its own (*proposal*: one shared set of ragged edge masks).

| Ground | Colours | Detail | Rank |
|---|---|---|---|
| Snow | `#f5f4ef`, `#c6cad6` drifts, `#c4ecf8` flecks | Drift lines every 22 rows along a slow wave, broken, with a light crest; blue flecks and small hollows | 5 |
| Meadow | the greens | 12 to 16 tufts per tile, each 3 to 5 blades of 6 to 12 px in two lighter greens over a darker root; clover and small leaves between them; single darker pixels | 4 |
| Rock | the greys from `#3a3554` to `#c6cad6` | Broken slabs about 32 px across. Each crack is dark, with a light edge on the slab below it, and the cracks are left unfinished in places; grit and a few lichen spots in `#84c450` | 3 |
| Sand | `#ebd3a2`, `#c99a5e` ripples, `#9e6b3c` pebbles | Wind ripples of 6 to 10 px dashes every 14 rows along a slow wave, two or three pebbles per tile with a lit top, rare `#f5f4ef` glints | 2 |
| Water | the water ramp | A 6 px foam line at the shore, shallow water (`#3f8fd1` with `#7cc4ec` dashes) for the first tile, deep water beyond (`#275a99` with `#3f8fd1` dashes). The depth reads by colour alone | 0 |

- **The floor is the live game.** The owner on the 64 video: "the grass is too generic and not as rich in detail as the production". Everything today's ground shows carries over at 64: variants on about two tiles in five, the shaded, plain and sunlit patches of `game/src/richground.ts`, flowers, tall grass, the drawn edges between grounds, the canopies. On top of that, a 64 px fill tile uses at least five colours (today's use three to five on 16 px).
- **Scatter, not rows.** Small motifs (a tuft, a flower, a pebble, a ripple dash, a fallen leaf, a crack's end) are scattered over the ground by a seeded hash on art-pixel positions, across tile edges, at a density each ground sets. The model draws the motifs; the script places them (DECISIONS 2026-10-18: a whole tile written by the model repeats in rows).
- **Measured at the ground wave:** a phone still of the opening's first frame at 64 beside today's live frame of the same spot shows every decoration layer of today; in a 1440x3120 frame of meadow no two tiles are pixel-identical. How rich is rich enough is the owner's to judge in the live game.
- The path, cobble, forest floor, grove and ruin floor keep their present tiles until the ground wave redraws them to this table.
- Later grounds (mud, ash, ice, moss, swamp) each add a row of their own.
- **On one level:** the higher-ranked ground lies over the lower on a ragged line, never along a tile edge. The pixels of the lower ground along that line are one step darker (frame `terrain-T1`).

## 4. Light and shadow (decided: C; the direction moved with the GK2 B sun)

| Part | Rule |
|---|---|
| Cast shadow | The caster's silhouette, sheared away from the light. A pixel z rows above the lowest solid row lands at (x + z·sx, feet + z·sy). Colour `#1b1a2e` at 30%. Where shadows overlap, the ground is no darker than under one |
| Length | 0.8 to 1.1 times the caster's height at 08:00 and 16:30. At 12:00, no more than 12 art px past the feet |
| Direction | The sun stands south (DECISIONS 2026-10-21, the GK2 method B), so the shadow falls **away** from the viewer: up-screen, behind its caster, which the depth order draws over it, and a thing standing north covers the shadow of the thing before it. Left in the morning, right in the evening: up-left at 08:00, up-right at 16:30, straight back at noon. Every caster in a frame points the same way |
| Contact line | Four rows under the feet, `#1b1a2e` at 45% |
| Body light | The 4 art px on the side away from the light one step darker, the side toward it one step lighter. None at noon |
| Night | No sun shadow. Inside a light's pool, shadow and body light come from that light. Outside every pool, nothing casts |
| Raised ground | Casts the same way, with z = levels x 32 (section 6) |
| Weather | Overcast: the same length at half the alpha (15%). Rain and storm: no sun shadow. Fog waits for its still (the owner, 20.10, NATURE.md section 10 question 4) |

Every number above is whole art pixels at one alpha, so the build is checked by stills at fixed hours against this table. Creators do nothing: every shadow comes from the sprite's alpha.

## 5. The night (decided)

The owner, 18.10: "darker than N3; street lighting and the houses' light will light the town, but in nature it has to be scary and dark".

- **One darkness over the whole screen**, deeper than N3. Today the full night multiplies the screen by `#172a52` at 50%, and N3 is 85%. The build starts at 92%, and the owner sets the final level in the live game.
- **Every light cuts a pool** in that darkness, in two hard steps: no tint inside, half the tint in a ring around it.
- **The town reads lit because it is full of lights:**
  - street lamps (the `lantern_post` prop), enough that every walkable town tile is within 3 tiles of a light (on 18.10, 19 of the 175 are not);
  - lit windows on the buildings the player uses: the shops and the stall.
  - The three small houses stay dark while player houses are paused (DECISIONS 2026-10-10: houses paused, no dead props). Their windows light up when houses return.
- **Out in the wild there is only:** the player's own light (DECISIONS 2026-10-12), a burning fire, and the wolf's eyes. The player's pool and the wolf's eyes keep today's size and brightness, so the dark is frightening and still readable.
- **A building's lit windows** ship as a second image of the same size that holds only the window pixels in the fire ramp. The game draws it over the building from dusk to dawn, with a pool in front of it.

## 6. Height (decided: T2 and the walking rule)

The owner, 18.10: "T2 fits".

- **The layer.** A height layer beside the ground layer: one digit, 0 to 9, per tile, written in the map as rows like the ground. Integers only.
- **The face.** One level is 32 art px of face, half a tile. A thing standing on a level draws 32 px higher per level.
- **T2, faces:**
  - The face is in the grey ramp, with ledges every 16 px.
  - A light lip of 2 to 4 px runs along the top edge: white with drips under snow, `#84c450` under meadow, `#c6cad6` under rock.
  - A dark line of 4 px runs along the foot, and the face casts a shadow (section 4).
  - Where a top stands over a lower neighbour to the west or east, it gets a 2 px dark rim.
- **Not picked, T3, slopes:** the drop drawn in the upper ground, two steps darker, with no face. It barely shows at phone size.
- **Height limit:** one step shows at most 3 levels (96 px). Higher than that is a mountain band, which cannot be walked.
- **Walking** (decided 18.10, GAME_RULES G68). A rock face blocks both ways. Between levels only across a crossing tile, and the crossing varies by place: stairs, a ramp, a lift, a cable car, any tool that fits the place. Stepping off a face is refused, like a solid tile.
- **Paths wind** (GAME_RULES G69). Generated ground and authored paths both: no straight run over 8 tiles (a bridge or a causeway up to 12), and a turn or a gap through trees, rocks or mountains at least that often. The ground builders and the art follow it.
- **Both clients.** The 3D client already lifts its ground with noise (`game/src/play3d/scenery.ts`, the corner heights). With a height layer, both clients read the same data.

## 7. More depth, cheapest first (decided: all six)

The owner, 18.10: "I want 1-6 too".

| Cue | What it looks like | What it touches |
|---|---|---|
| 1. Reflections | A thing standing by water shows in it, flipped, in `#275a99` at 35%. The reflection is cut at the shore and wobbles 2 px sideways as the water moves | the client |
| 2. Into the grass | In tall grass or shallow water, the bottom 16 to 24 px of a character are hidden behind blades or a waterline. Today's 72% fade (`dimInCover`) gives way to this, and the kernel's cover is unchanged | the client |
| 3. Cloud shadows | Large shapes drifting slowly over the ground by day. Proposed as `#1b1a2e` at 12%; at 12% nothing showed on a phone, and the owner kept `#172a52` at 34% on the three stills of 20.10 (#238). That number is the one built; whether the shade also falls on props and people, or on the ground alone as the stills showed, is the open question NATURE.md section 5 carries | the client |
| 4. Footprints | In sand and snow, fading after 20 s | the client |
| 5. A shadow that stays down | When a body bobs or a dropped thing arcs, its shadow stays on the ground and grows as the thing lands | the client |
| 6. Height | Section 6 | the map, the kernel, both clients |

- **When:** cues 1 to 5 are built with the night, in the same window, and judged in the live game. They need no stills of their own: they are details inside the light direction already picked, so they are polish. Footprints come in sand with them and in snow when snow arrives. Height comes with stage 3.
- **Stealth:** "into the grass" keeps the signal today's fade gives, so a player in cover still shows as in cover. The proof is the covered bank road in `game/e2e/stealth.ts`, which passes unchanged in meaning. The variety stream, which built the stealth cues, hears of the change before it is built.

## 8. Users change the world

The owner, 18.10: "users will be able to change existing areas, even completely". His word is recorded under D2 in [OPEN_WORLD.md](OPEN_WORLD.md). Two questions stay open there for when stage 3 opens: who the users are, and whether the hand-made valley may change. Whoever they turn out to be, for the look it means:
- A ground and a height are data. A change to an area re-grounds or reshapes it, and the engine draws the edges, faces and shadows from that data. Whoever makes the change draws fill tiles, motifs and sprites, nothing else.
- The core's checks still run on every change: walkability and the rules in GAME_RULES.

## 9. What the check enforces

- **Today:** the palette, hard alpha and the sizes.
- **With the engine step:** the sizes for each density (NEXT 15).
- **Proposed with the ground wave:**
  - a ground tile fills its square edge to edge;
  - a ground uses only its own ramp plus at most two accent colours.

## 10. Frames

`docs/design/frames/`:
- `2026-10-18-density-*`: 32, 64, 128 on a 2K phone (the pick: 64).
- `2026-10-18-art-size-*`: 16, 32, 48 (the morning's pick of 32, superseded).
- `2026-10-18-shadow-*`: A, B, C and a day.
- `2026-10-18-night-*`: N1 to N3.
- `2026-10-18-terrain-*`: T1 to T3.

How each set was made: [2026-10-18-density.md](frames/2026-10-18-density.md), [2026-10-18-art-size.md](frames/2026-10-18-art-size.md) and [2026-10-18-light-and-ground.md](frames/2026-10-18-light-and-ground.md).
