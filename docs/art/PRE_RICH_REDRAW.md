# What was drawn before the rich wave: the redraw list (2026-10-25)

The owner's word of 25.10 ([DECISIONS.md](../../DECISIONS.md), "What was drawn before the rich wave is redrawn to match it, the shop interior first"): everything drawn before the rich wave of 23.10 is renewed so the game reads as one hand. A piece whose frame stands is **redrawn in the rich style**; a piece whose frame does not is **made again**. This page is the list that art stream follows: every picture a player can see that predates the wave, ranked by how often it is seen. It is an inventory. No picture was generated or imported to make it, and no kit file changed.

## How to read it

**Where the line is.** The rich wave is the 35 sprites in [tools/kit-gen/rich-wave.manifest.jsonl](../../tools/kit-gen/rich-wave.manifest.jsonl): 19 items and 16 props, all 64x64 at `density` 4. The two ways of counting agree (35 manifest lines, 35 kit entries at density 4), so the kit on develop holds **180 sprites, 35 rich and 145 not**: 37 tiles, 74 character frames and 34 props. Every item is already rich. Everything the client draws in code or CSS (the `fx-*` textures, glyphs, frames, chart) is also pre-rich and is listed below the kit pieces, in the same ranking.

**Basis of "how often".** Develop's valley, 48x49 tiles, on the owner's target phone (about 1440x3120, 8 device pixels per 16 px art pixel, so a window of 11x24 tiles). For each of the three wake pockets the window was slid from the wake tile to the old bridge in eight steps and the tiles and props in the union counted (437 to 466 tiles per pocket); the counts are in the rows. Valley v2 ([#293](https://github.com/Bobikobi/GAME/pull/293)) and the hand-made first map (NEXT 19) change these numbers, so the order is for today's valley; the pieces will not change but their rank may.

**Bands.** *Opening minute*: every new player sees it in the first minutes (the wake window, the walk to the bridge, the first herbs, the first fire, the first dialogue). *Every session*: any normal session. *Rare*: a place or moment most sessions skip. Inside a band the rows run by how much of the screen they take.

**Verdict.** I read each row against the DECISIONS entries; this is a reading for the manager and the owner to confirm, and the contested rows are collected under [Open for the owner](#open-for-the-owner).
- **Redraw** - the thing is already in the live game and its identity stands. It is redrawn from itself in the rich style by the route of the 35 (words and ramps, best of three by eye, the ink edge), as the rich wave did with the existing props and items ("The palette deepens", 21.10).
- **Make again** - no pick of a frame for it is recorded. It is drawn new, and where it is a direction (a body, a ground, a tree) its stills go to the owner first (AGENTS.md).
- **Blocked** - waits on a pick or a decision that is open.

**What the list assumes about the style.** The rich style is defined by three pull requests that are still open: the importer fix that keeps the drawing inside its outline ([#301](https://github.com/Bobikobi/GAME/pull/301)), the ink edge on every rich sprite ([#309](https://github.com/Bobikobi/GAME/pull/309), draft) and the rule that refuses new 16 px art ([#295](https://github.com/Bobikobi/GAME/pull/295), draft). The 35 picks and the nine of the models review ([#304](https://github.com/Bobikobi/GAME/pull/304), draft) are the references. If the style changes, the list is redrawn against the new one (the "retry when" of the 25.10 entry).

## The ranked list

### Opening minute

| # | Piece | Source | Where a player sees it | Rich replacement | Frame and verdict |
|---|---|---|---|---|---|
| 1 | **The player's body**: the human, elf and skeleton stand-ins. `chars/explorer_*`, `explorer_w_*`, `forager_*`, `forager_w_*`, `digger_*`: 45 PNGs (walk 3 frames x 3 directions, idle 2 x 3, work pose 32x32 x 3; right is the left sheet mirrored). 16x24 | kit | Every frame of every session, and the three race cards on the title screen at 3x. The one sprite that is always on screen | None. The races use these sheets as stand-ins until their own figures are drawn (decision 43 of 22.10) | No pick recorded. The 64x96 stills Pell A, B and C of 20.10 wait for the owner; the cast is drawn on one rig with slot wear after the animation route (decisions 3, 6, 9, 41 of 22.10). **Make again, blocked on the Pell pick.** #325 draws the body in eight facings when a look has its diagonal sheets, so the brief for the cast should say eight, not four |
| 2 | **Meadow**: `tiles/grass`, `grass_1..3`, `grass_flowers` (5) | kit | 44 to 51% of the tiles in each wake window (grass alone); 27% of the whole valley | None in the kit. The scatter route is built (`kit:gen` route `scatter`, spec [tools/kit-gen/ground-64.json](../../tools/kit-gen/ground-64.json), meadow and sand); no ground has landed | Direction decided (64 px, STYLE.md section 3, "the floor is the live game"); no ground still picked. **Make again.** Measure: a 1440x3120 frame of meadow has no two tiles alike, and carries every layer of `game/src/richground.ts` (rank 21) |
| 3 | **The field kit's frame: HUD, dialogue box, toasts, bag, character, shop, journal** (bag, outfit, skills, shop, journal tabs) | CSS (`game/src/ui/kit.css`, `style.css`) | The HUD from the first second; the dialogue box at every talk; the bag in every session | None as pictures. The frame is built in CSS (wood, brass, canvas, paper, 3px ink outline). [#298](https://github.com/Bobikobi/GAME/pull/298) re-skins it ("B, canvas", Jersey 15) | Direction **approved**: Field Kit, 20.10 ("The UI's direction"), which names "the frame art, the item cards, the aggregate effects and the enlarged character" as the next art wave. **Redraw** the frame art; whether it becomes bitmap art or stays CSS is open |
| 4 | **Sand and water**: `tiles/sand`, `sand_1`, `sand_2`, `tiles/water` (4) | kit | Sand 17 to 19% and water 17 to 21% of each wake window; the river runs through every opening | None | Direction decided, no still picked. **Make again** (sand is in `ground-64.json`; water is one of the four tiles NEXT 15 plans by image) |
| 5 | **Edges where grounds meet**: `tiles/shore_n/e/s/w`, `bank_*`, `fringe_*` (12) | kit | Along the whole river and every meadow-to-forest line, in every window | None | STYLE.md section 3 proposes one shared set of ragged edge masks drawn by the engine, and NEXT 15 plans to retire these from the redraw. That is a proposal, not a decision. **Open for the owner**: masks (engine work) or 12 redrawn tiles |
| 6 | **The path**: `tiles/path`, `path_1`, `path_2` (3) | kit | 10 to 11 tiles per window; leads to the bridge and the town | None | Same as 2. **Make again** (STYLE.md: path keeps its tile until the ground wave) |
| 7 | **Forest mass**: `tiles/forest`, `forest_1`, `forest_2` (3), the grove floor `tiles/grove`, `grove_1`, `grove_2` (3) and the canopies `props/canopy_1..3` (3, 32x32, laid over 2x2 forest blocks by the client) | kit | Forest is 8 to 9% of each wake window and the whole border of the valley (35% of all tiles); the grove is 2% of a window and 12% of the valley, the south of the walk | None. Canopies were drawn in [#285](https://github.com/Bobikobi/GAME/pull/285)'s review (two takes each) and all three were marked fail | "The forest as a layered mass" is a direction and has no still (21.10, "Three gaps"): stills first, after the ladder pick ([#240](https://github.com/Bobikobi/GAME/pull/240)) and the GK2 pick. **Make again, blocked on those picks** |
| 8 | **Tall grass**: `props/grass_tall` (16x16, 2 frames) | kit | 40 on the map, 26 to 31 per wake window: the most numerous prop | #285 candidate marked fail | Identity stands, and the STYLE.md ground floor names tall grass. **Redraw**, read with row 2 so the two agree |
| 9 | **Flowers**: `props/flowers`, `flowers_blue`, `flowers_white` (16x16, 2 frames each) | kit | 26 on the map, 10 to 13 per window | #285: all three marked pass | **Redraw** |
| 10 | **Gather nodes**: `props/herb_plant` (7 nodes), `bush_berry` and `bush_empty` (6 nodes), `reeds` (4 nodes), all 16x16 | kit | The first task is herbs; berries are the "three fruits"; reeds on the bank. Opening minute and every session | #285: bush_empty pass, bush_berry maybe, herb_plant fail, reeds fail | Identity stands. **Redraw**, from the item they give (already rich) so a node and its icon match |
| 11 | **Trees**: `props/tree_oak` (32x32, 2x2 tiles; 12 nodes), `young_tree` (16x24, the growth step), `dead_tree` (32x32, 2 frames; 2). The sapling and the stump are already rich | kit | The felled tree is the first fire. Oaks stand around the camp and the wake windows | #285: tree_oak maybe, young_tree pass, dead_tree pass | The oak is 2x2 beside a character of 1x1.5; STYLE.md 1b asks at least three times the character's height (the 18.10 finding). The look of a tree is a direction, stills first. **Make again, blocked with row 7** |
| 12 | **Pebbles and the keystone**: `props/pebbles` (11 on the map, 7 per window), `props/rock_small` (the keystone node at the bridge) | kit | Pebbles everywhere on the bank; the keystone is the bridge-mending moment | **Open**: both in [#304](https://github.com/Bobikobi/GAME/pull/304) (draft): pebbles Codex round 5 candidate 1, rock_small FLUX.1 schnell seed 1. They keep 16 px until it lands | Frame stands. **Redraw, in flight** |
| 13 | **The old bridge**: `tiles/bridge_broken`, `tiles/bridge` (2) | kit | The opening's goal and the share card's frame; seen once per player, the strongest single image of the opening | None. The rich experiment's stone bridge (256x128, [frames/rich/](frames/rich/)) is a reference, not a tile | The share card (17.10) and the hook stills (18.10) are approved frames that show the bridge, at 16 px. **Redraw** from them, by image (NEXT 15 plans bridge, broken bridge, cobble and water by image) |
| 14 | **The standing stone**: `props/standing_stone` (16x32; 2) | kit | One per wake window; the riddle's stones | #285: marked fail (drawn after the marks) | **Redraw** |
| 15 | **The first fire**: `props/campfire_lit` (16x16, 3 frames) and, in code, `fx-flame` (7x15), `fx-firelight`, `fx-spark`, `fx-smoke` | kit and code | The first fire is built in the opening's first minutes; every camp after it | The unlit fire is already rich (`campfire_unlit`, 64x64). The lit one is not, so the two sit side by side at different densities | The tending frame (13.10) set the flame's four stages by size as defaults for the owner to confirm at the merge; the entry does not record the confirmation. **Redraw** `campfire_lit` as the unlit one's twin; the flame stages are a code row (16) |
| 16 | **Action and footstep pixels, in code**: `fx-dust` 3x3, `fx-leaf`, `fx-chip` 2x1, `fx-dirt`, `fx-puff`, `fx-grit`, `fx-arrow` 7x5 (the target marker), `fx-bang` 4x10, `fx-cross` 3x3 | code (`makeFx` in `game/src/scenes/world.ts`) | Every step, every swing, every target | None | These are 1 to 15 px marks. **Open for the owner**: redrawn at the rich grid, or kept as particles. The target arrow and the bang are shapes and read as sprites |
| 17 | **Ambient life, in code**: `fx-butterfly`, `fx-fly`, `fx-mote`, `fx-leaf-fall`, `fx-bird-0/1` 3x2, `fx-birds` 11x6, `fx-ripple` 11x5 (behind `?rich=` motion) | code | Meadow and grove life in every session | None | Same open question as 16. The birds and the ripple are shapes |
| 18 | **Title screen, character choice and the three minigames**: the title card, the race cards (the body sprite at 3x), the strike stone, crack and ring, the pick berry and leaf, the snap branch | CSS (`title.ts`, `games/games.css`) | The opening teaches strike (the stones) and pick (herbs) in minutes 2 to 5 | The item inside a minigame is the item's own rich sprite when it has one; the stone, ring, crack, berry, leaf and branch shapes are CSS fallbacks | Part of Field Kit (row 3). **Redraw** with the frame art; the race cards ride on row 1 |
| 19 | **Glyphs and the clock icon**: six 8x8 masks (`g-leaf`, `g-star`, `g-sun`, `g-flower`, `g-key`, `g-wave`) and the sun and moon of the clock | CSS (`style.css`) | The HUD and the signature plaques | None | Part of Field Kit. **Redraw** with row 3 |

### Every session

| # | Piece | Source | Where a player sees it | Rich replacement | Frame and verdict |
|---|---|---|---|---|---|
| 20 | **Maru and Pell**: `chars/elder`, `elder_blink`, `trader`, `trader_blink` (4 PNGs, 16x24; the blink is 2 frames) | kit | The town square and every talk; the dialogue portrait is the sprite at 3x. Met in the opening's first ten minutes | None. Both stand in as 16 px figures; decision 41 of 22.10 puts every character on the player's rig | No pick. **Make again, blocked with row 1** (Pell A, B, C). Maru's stoop is a body figure by decision 41; Pell is human (decision 29) |
| 21 | **The map window**: the chart (SVG in `game/src/ui/map.ts`) and its list | code | Opened from the menu in every session | None. "An illustrated map and UI is polish inside Field Kit; its drawn art follows the 64 px waves" (21.10) | Direction **approved** (the window, 20.10). **Redraw** as the illustrated map, after the ground. The chart draws `map.json` and never a picture, so it needs the ground first |
| 22 | **Cobble and the town**: `tiles/cobble`, `cobble_1`, `cobble_2` (3); `props/house_small` (48x48; 3), `well_old` (32x32), `market_stall` (32x32), `lantern_post` (16x32, 2 frames; 3), `fence` and `fence_post` (16x16; 3 each) | kit | Town square, the elder's house, the trader's stall. 7% of the valley is cobble | #285 marks: house_small maybe, well_old maybe, lantern_post maybe, market_stall fail, fence pass, fence_post pass. The three lantern looks (iron, stone, wood) are drawn as candidates in `tools/kit-gen/props-styles-1.json`, all kept | Decision 8 of 22.10: a prop's look follows its place; the lanterns' three stills are **kept**, one per settlement, named in each map plan. So the town set waits for the first map's plan (NEXT 19 and #293). Cobble and the houses: **Redraw**; lanterns: **Redraw per kept still**. Large and thin props go down Codex (decision 1 of 22.10) and the credits are out |
| 23 | **Glow mushrooms**: `props/glow_mushrooms` (16x16, 2 frames; 8) | kit | The grove and the night walk | #285: marked fail | **Redraw** |
| 24 | **Mist and fog**: `props/fog` (32x32), the slot fog atlas `fx-slotfog`, the mist breathing, the pocket's clear circle (`game/src/fog.ts`, `mist.ts`) | kit and code | The mist is the game's frame: every session, every pocket | #285: fog maybe | The 20.10 air stills (cloud shade, dawn banks, night banks) are **approved** and drawn as engine layers. **Keep** the layers, **Redraw** the `fog` sprite only if the new ground makes it read wrong |
| 25 | **Light and air layers, in code**: the dusk ramp and night (`light.ts`, `fx-dark`, `fx-glow`, `fx-dapple`), cloud shade and fog banks (`sky.ts`), rain, the cast shadow pass (`cast-layer.ts`), the ground's tone field (`richground.ts`) | code | Every frame by hour and weather | These are the rich look already (palette ramps, shadows C, night 92%) | Frames **approved** (shadows C and the night 18.10; air 20.10; rain 21.10). Not redrawn. Re-judged once, against the redrawn ground, because they were tuned on the 16 px one |
| 26 | **The wolf at night, in code**: `fx-wolf-eyes`, `fx-wolf-halo`, `fx-wolf-flare`, `fx-eye`, `fx-den` 14x9, `fx-paw` 7x6 | code | Night out in the wild | None | The eyes are **approved** (16.10, still 3: red squares, soft glow, the one off-palette exception). **Keep** the eyes; the den and paw marks are **Redraw** (same open question as row 16) |

### Rare

| # | Piece | Source | Where a player sees it | Rich replacement | Frame and verdict |
|---|---|---|---|---|---|
| 27 | **The ruin floor**: `tiles/ruin_floor`, `tiles/rubble` (2) | kit | 167 and 15 tiles of the valley (7% and 0.6%): the gate and the hall. The opening ends at the ruins' entrance | None | No still. **Make again** (STYLE.md: ruin floor keeps its tile until the ground wave) |
| 28 | **The ruin set and statues**: `props/ruin_arch` (32x32), `ruin_wall` (32x32), `ruin_pillar` (16x32; 5), `rubble` (32x16), `broken_statue` (16x32; 2), `statue_head` (32x32), `totem` (16x32) | kit | The ruins, the arch the player opens, the night yard | #285: ruin_arch fail, ruin_wall maybe, ruin_pillar maybe, rubble maybe, broken_statue pass, statue_head fail, totem fail | Statues: the three stills (robed founder, stag with a broken antler, toppled knight) are **kept** (decision 8 of 22.10), each placed where its story belongs. The rest: **Redraw**. The night ruins are revived with changes (25.10) and their rows come from the hand-made map, so these wait for it |
| 29 | **The wolf and the pit as props**: `props/hazard_wolf` (16x16, 2 frames; 2) | kit | The den prop on the west bank; the body is not drawn by day, and at night only the eyes show | #285: marked fail | **Redraw**, low priority: its body is rarely on screen |
| 30 | **The share card and the site's pictures**: the card `web/public/og/card.png` (cut from the clean 16 px capture of the mended bridge, 17.10), the favicon, the hero key art (made from the kit sprites by an image model, 23.10) | files | Link previews and the home page, not the game | None | The card is a capture of the 16 px game. **Redo after rows 1, 2, 4 and 13** so the preview shows the same hand as the game. The key art was made on 23.10 and is the owner's pick; left as it is |

Eight outfit items borrow other icons today (`work-clothes`, `work-boots`, `light-cloak`, `sandals` use the branch; `herb-pouch` uses the herb; `rust-pick` the trowel; `remnant-amulet` the old coin; `work-hammer` the axe). They are not pre-rich art, they are art that does not exist yet, and they belong to the race wave, not to this list.

## Counts, so the stream can size it

| Group | Not rich | Rows |
|---|---|---|
| Tiles | 37 | meadow 5 (row 2), sand and water 4 (4), edges 12 (5), path 3 (6), forest and grove 6 (7), bridge 2 (13), cobble 3 (22), ruin 2 (27) |
| Character frames | 74 | 49 in use: the player's 45 (row 1), Maru and Pell 4 (20); **25 are not in use** (below) |
| Props | 34 | rows 7 (3 canopies), 8 to 15, 22 to 24, 28, 29 |
| Code- and CSS-drawn | about 30 `fx-*` textures, 6 glyphs, 2 clock icons, the Field Kit, the title, the three minigames, the chart | rows 3, 15 to 19, 21, 24 to 26 |

**Not redrawn: the archive.** 25 character PNGs have no reader: `player_*` (9) and `woman_*` (7) are the retired starter looks (decision 43 of 22.10 retires the starter looks), and `digger_w_*` (9) because the skeleton has no second look. The explorer, forager and digger sheets that the races wear today go to the archive too, once the race figures land. Nobody sees the 25. They are not redrawn.

## The shop interior

The food and medicine shop was drawn on 11.10 and never reached develop. It is the owner's first example of the rule, so it gets its own block.

**What exists.** Branch `feat/food-shop-interior` (head 378cc514, 11.10; no pull request, not merged): 38 files, +1425 lines, on top of develop as of v0.1.2. The frame is [docs/design/frames/2026-10-11-shop-interior.png](../design/frames/2026-10-11-shop-interior.png), approved as pick C of three ([compare](../design/frames/2026-10-11-shop-interior-compare.png)), DECISIONS 2026-10-11 "The shop interior: warm planks, a runner to the counter, the trade shown on the back wall". The room is `game/src/scenes/room.ts` (475 lines); the pieces are drawn in code by `tools/src/kit/interiors.ts` (636 lines), 22 sprites in the 16 px grid: `tiles/planks`, `planks_1`, `planks_2`; `props/room_wall`, `room_wall_1`, `hearth` (64x43, 3 frames), `shop_window` (22x20, 2 frames), `jar_shelf`, `counter_left`, `counter`, `counter_right`, `runner`, `runner_top`, `runner_end`, `door_mat`, `scale`, `shop_cat`, `shop_sign_food`, `flour_sack`, `mushroom_crate`, `pear_barrel`, `potted_herb`.

**What carries over** (the 25.10 entry: "its layout and frame carry over"):
- the frame C still as the compass;
- the room: 7 columns by 9 rows, the door at the bottom in column 3, the entry at the door, a rim of 4 px;
- the layout: the runner from the door to the counter, the keeper behind the counter, the trade shown on the back wall (the stove for food; an anvil, a loom and so on for the others), each shop its own floor and wall materials, window light, shadows and small life (a cat, a scale, hanging herbs);
- the mechanism: the `interior` field on a shop (schema) and the door-by-keeper rule, where the keeper's map slot is the door tile and the session holds the player on the doorstep while inside, so buy, sell and talk validate with no kernel change;
- the known polish list: the stove is too large for its wall, the light patches are faint, the sacks and crates are quick props.

**What does not carry over:** the 22 sprites. They are 16 px pieces in the old palette and would not sit beside the rich wave, so the whole set is redrawn: the room is composed of rich pieces, not scaled ones.

**Rank.** Rare today (no shop interior is on develop), but it is the first thing the new stream draws. It is also a *Make again* for the ground inside it (`planks`) and a *Redraw* for every prop in it, against frame C.

**Flags for the manager (not decided here):**
- The branch edits `game/e2e/opening.ts` (about 90 changed lines), which is protected. A revived interior must be rebuilt on a fresh branch from develop and stop at that file.
- Its map edit puts a 3x2 house at (34,9) and a shop sign at (35,10), where the stall stood; [#293](https://github.com/Bobikobi/GAME/pull/293) and [#296](https://github.com/Bobikobi/GAME/pull/296) both touch the town.
- The branch moves Pell into the food shop. Decision 32 of 22.10 says the cook is the innkeeper and sells food, while Pell sells only raw materials and equipment; decision 50 puts the inn in the rebuilt house at the town's edge ([#296](https://github.com/Bobikobi/GAME/pull/296) builds it, with the keeper Wenna). So the frame C room may now belong to the inn, not to Pell. See the question below.

## The 3D door is a separate list

The second door (`/play3d/`) draws its own assets, none of them from the kit sprites: six ground textures in `game/public3d/tiles/` (sand, path, grass_flowers, forest, water, grass), a set of glb models in `game/public3d/models/` (Kenney mini characters and nature models, Meshy figures, a bridge, campfire, logs, plants), and a `colormap.png`. They are outside the pixel redraw: pixel first, 3D on spare capacity (the owner's rule), and the 3D door has its own gap list ([NEXT.md](../team/NEXT.md) section 8, item b). Where it falls back to a bundle sprite, it draws the same sheets as the 2D game, so a redrawn sprite also changes there.

## Not on this list

- **The 35 rich sprites and the nine of #304**: done or in flight.
- **Creatures** (a sparrow, a crow, a trout, a hare, a roe): their kinds and spots are map content, but the client does not draw them yet; they come after this redraw, drawn once in the rich style (the 25.10 entry on creatures). The branch `feat/creatures-scene` stays as it is.
- **Pieces not yet drawn at all**: the race figures and their wear, the cook, the traveller, the route people, the inn art (a small house stands in), the stall's final art.
- **The website's page chrome and fonts**: the night look landed 23.10 and is not game art.
- **Piles on the ground** (dropped things, [#297](https://github.com/Bobikobi/GAME/pull/297)): drawn from the dropped item's own icon, so rich by construction. To be checked when #297 lands.

## Open for the owner

These rows have no recorded answer; the list holds them as written and nothing is built on a guess.

1. **Row 1 and 20:** the Pell pick (A, B or C) that unblocks every character. It also decides how many facings a figure has (four sheets, or eight with diagonals, #325).
2. **Rows 2, 4, 6, 27:** the ground. The direction is decided and the route is built; does the first ground go to the owner as one still of the opening's first frame, as STYLE.md section 3 measures it ("a phone still of the opening's first frame at 64 beside today's live frame")?
3. **Row 5:** engine edge masks, or 12 redrawn edge tiles.
4. **Rows 7 and 11:** the forest as a mass and the look of a tree, which wait on the ladder pick (#240) and the GK2 pick.
5. **Rows 3, 18, 19, 21:** the Field Kit frame is CSS today. Does "redraw" mean bitmap frame art, or the same CSS with rich glyphs and icons?
6. **Rows 16, 17, 26:** the 1 to 15 px `fx-*` marks. Redrawn at the rich grid, or kept as particles?
7. **The shop interior:** frame C was a food and medicine shop at Pell's stall, and food has since moved to the innkeeper. Is the redrawn room the inn (Wenna's, at the town's edge), a shop for Pell's raw goods, or both?
8. **The verdict column** above is a reading; the owner may move any row between *Redraw* and *Make again*.

## How this was made

Read-only. The kit ids were compared with the manifest; the kit's PNG sizes and densities, the map's tile and prop counts, the resource and pocket files, `game/src/scenes/world.ts` (`makeFx` and the rich groups), `game/src/ui/`, the open pull requests' file lists (`gh pr diff --name-only`) and the branch `feat/food-shop-interior` were read; DECISIONS entries are cited by date and title. The window counts come from sliding an 11x24-tile window along the straight line from each wake tile to the old bridge in eight steps. No picture was generated, imported or changed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
