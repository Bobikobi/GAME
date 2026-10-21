# The rules of nature: scale, climate, season, weather and light

The owner, 20.10: the world has to obey basic natural law. A tree is taller than a person, a wolf is not; a pastoral town is green and full, a desert village is yellow and bare; winter brings rain and wind, a clear summer day has no clouds; the light under trees is not the light in the open, and a character standing in shade is in shade. The measure he named for the look is Graveyard Keeper (section 9).

This page gives those laws one home. It extends [STYLE.md](STYLE.md) (the grid, the proportions table 1b, shadows, the night, height, the depth cues), [ART_SYSTEM.md](ART_SYSTEM.md) (the light module, ramps per material and region, motion, composition) and [REACTIONS.md](REACTIONS.md) (weather by day, phase B). It repeats none of them. Where this page and one of them say the same thing, the older page rules until the owner picks here.

Two rules stand over all of it:
- **The kernel never reads any of this** except the one `weather` condition of #215. A climate, a season or a storm changes what a player sees and hears, never what a rule answers (G29: colour is never the only signal). The one exception already decided: fog shortens a predator's sight (REACTIONS Q1 a).
- **A direction is seen as stills before it is built** (AGENTS.md). Every table below says whether it is a direction (stills first) or polish (iterate, do not ask).

**Where it stands (2026-10-20, the owner's answers):** partly decided, nothing built. The owner answered section 10 and judged the sheets (DECISIONS 2026-10-20, "Nature's laws"). Decided: the people and animals of section 1 as drawn (now in STYLE 1b), the valley as temperate, autumn and winter, overcast, and the cast shadows under weather (now in STYLE 4). Open: rain, fog and the shade over people (not seen yet), the dry, cold and wet climates (a second round when the open world reaches one), and the monster grades (not now). The twelve stills of section 8 are `docs/design/frames/2026-10-21-nature-*.png` with the note [2026-10-21-nature.md](frames/2026-10-21-nature.md), composed by `tools/stills/nature.py` from `tools/stills/nature.json`, which holds every table of sections 1 to 5 as data. Section 12 says where this page and the older pages disagreed and how it was settled.

## 0. Already decided, not reopened here

| Decided | Where |
|---|---|
| The character is the measure: a frame of 1 x 1.5 tiles, the body about 80 px; the proportions table for trees, houses, props; bigger is open | STYLE 1b, DECISIONS 2026-10-18 |
| Shadows C, the night at 92% with light pools, lit windows, height T2, the six depth cues (reflections, into the grass, cloud shadows, footprints, a shadow that stays down, height) | STYLE 4 to 7 |
| The light is one module with an hour table in `params.json`; the hour's tints wait for the L2 pick | ART_SYSTEM 2, #234, #241 |
| Ramps per material and per region, declared and checked; a region's look is a table, not a redraw | ART_SYSTEM 3, #230 |
| The valley's year is the real year; days stay short (20 min); a season of content adds and never removes | DECISIONS 2026-10-09 |
| Weather is one value per region per game day: clear, rain or fog, decided from the seed a day ahead | REACTIONS phase B, #215 |
| Weather never touches a fire | G48, DECISIONS 2026-10-19 |
| Ambient creatures are map data the client draws; the kernel never reads them | #205 |

## 1. Scale: everything is measured in characters

STYLE 1b gives the floor for trees, houses and props. This section adds what it leaves out: people, animals, and the things a monster is allowed to break. The unit is one character's height (about 80 px of body at 64 px per tile). A number is a floor and the size of the common one; bigger is open (STYLE 1b).

| Thing | Height in characters | Footprint (tiles) | Note |
|---|---|---|---|
| Adult | 1 | 1 x 1 | The measure |
| Child | 0.6 to 0.7 | 1 x 1 | Head larger in proportion (a child's head is about a quarter of its height, an adult's a fifth to a sixth; Drakantos B pushes the adult toward 0.4, the owner's pick) |
| Elder | 0.9, stooped | 1 x 1 | A stoop, not a smaller body |
| Bird (sparrow, crow) | 0.1 to 0.15 | under a tile | Drawn at 16 to 24 px; its shadow on the ground is the depth cue |
| Hare, cat, hen | 0.25 | 1 x 1 | |
| Dog, fox | 0.4 to 0.5 at the shoulder | 1 x 1 | |
| Wolf | 0.55 at the shoulder, 1 x 2 long | 1 x 2 | Never taller than a person on four legs; the fear is in the eyes and the dark, not the size |
| Deer | 0.9 at the head, antlers to 1.4 | 1 x 2 | |
| Sheep, goat, pig | 0.5 | 1 x 1 | |
| Cow, horse, ox | 1.1 to 1.4 | 1 x 2 | A cart behind a horse is 2 x 3 with it |
| Bear | 1 on four legs, 1.8 standing | 2 x 2 | The one natural animal that stands over a person |
| Fish | 0.1 to 0.3 | in water | Seen as a shape under the surface and a rise |
| Grown tree (oak) | at least 3 | 3 x 5 | STYLE 1b |
| Pine, fir | 4 to 5, narrow | 2 x 6 | Cold and high climates (section 2); a 384 px cap means the top three tiles are a second sprite |
| Palm, cypress | 3 to 4, narrow | 1 x 4 to 2 x 5 | Dry climates |
| Boulder | 0.5 to 1.5 | 1 x 1 to 2 x 2 | |
| Door | 1.3 to 1.5 | 1 wide | STYLE 1b: 112 px |
| One storey | 2.5 | | Eaves at 2.5 characters (STYLE 1b) |
| Tower, church, keep | 6 to 10 | 3 x 3 up | Built from pieces above the 384 px cap; a landmark seen over the mist (OPEN_WORLD, one landmark per region) |
| Bridge, causeway | | 2 tiles wide | Wide enough for a cart |

- **Monsters are exempt from the floors, never from the rules.** (The grades below are not decided: the owner, 20.10, "not now", section 10 question 5.) A monster kind declares its own grade, one of four (STYLE 1b's grades): small (under 1), person-sized (1 to 1.5), large (2 to 3), colossal (above 3, built from pieces). A colossal thing keeps STYLE 1b's three rules: the map does not move, see-through over the player, nothing a task names hidden. A monster's grade is a design value chosen with its danger, so a large thing is never a weak one (G47: a rule a player can read by watching).
- **The check** (`pnpm check`, proposal): a kit sprite may declare `scale` (its height in characters, one decimal). A kind in this table or in STYLE 1b with a `scale` under its floor is a warning; a creature with no `scale` is a warning once the first creature kit lands. The owner makes either an error when he wants.
- **Kind:** the numbers are the art session's starting point, judged by the owner by eye on one still (as STYLE 1b: "only by eye will I know"). The still: the square at 12:00 with an adult, a child, the elder, a hen, a dog, a wolf, a deer, a horse and cart, and the oak, in one frame (section 8).

## 2. Climate: a region declares what grows there

A region (one map file, OPEN_WORLD G51) declares one `climate`. The climate is a table the engine reads: which ramps the region's ground and vegetation remap to (ART_SYSTEM 3), how dense the scatter is, which trees and ground kinds the generator may place, what the air does by default, which sound beds play. The same meadow drawing serves every climate; the table changes its colour and its density, and a desert's bareness is a rule, not poor content (the richness check reads the climate's own floor, section 7).

| Climate | Example | Ground mix | Vegetation | Greens | Water | Air by default | Shadows |
|---|---|---|---|---|---|---|---|
| Temperate, pastoral | The valley, the first region | Meadow 55%, forest floor 20%, path, rock 10%, water 15% | Dense: oaks, young trees, bushes, tall grass; scatter at the full density of STYLE 3 | The full greens ramp, `#2e6b3b` to `#c8e88a` | Blue, the water ramp as is | Morning mist by the water (fog banks of #238 at dawn); clouds most days | As decided |
| Dry, desert | A desert village, a caravan stop | Sand 60%, rock 25%, hard earth; water under 3% and only at an oasis or a well | Sparse: a palm or cypress every 12 to 20 tiles, dry bushes, no tall grass; scatter at a third of the valley's density | Olive and yellow: the greens remapped to `#4c9a3f` at most, the earth ramp for the rest, grass in `#c99a5e` | Green-blue and shallow; the deep band rare | No fog, no cloud shade on most days; heat shimmer over sand at midday (motion kind `heat`, section 4 of ART_SYSTEM); dust on footsteps | Hard and short at noon, long and warm at the hours |
| Cold, highland or north | Pine forest, a snowed pass | Snow in winter 70%, rock 20%; meadow and forest floor in summer | Pines and firs, dense; low bushes; no oaks; lichen on rock | Dark and blue-leaning: `#1f3d2b` to `#4c9a3f`, never `#c8e88a` | Dark, `#172a52` to `#3f8fd1`; ice in winter | Fog often; snow in winter; wind most days (sway amplitude high) | Long; the sun low all day in winter |
| Wet, marsh or swamp | Reeds, a drowned wood | Water 35%, mud, moss, reeds | Reeds, willows, moss on everything; mushrooms | Yellow-green and grey-green | Brown-green, still, reflective | Fog most mornings and evenings; rain often | Soft; overcast most days |

- **Mixing:** a region has one climate. The crossing between two climates is a band of two to four tiles where the ground's ramp steps from one table to the other, on the ragged line STYLE 3 already draws between grounds; the trees of both may stand in the band.
- **A town carries its climate:** a pastoral town is green and full (gardens, a well, washing lines, chickens); a desert town is walled, shaded and bare (awnings, water jars, a shaded square). The stamps a creator adds (ART_SYSTEM 5) say which climates they fit.
- **Data (proposal):** `climate` on the region's map body, one of a closed list; the tables above as `content/core/climates.json` (ramp set, densities, allowed kinds, air defaults, sound beds). The valley gets `temperate` in the same change and nothing on screen moves until a second climate exists.
- **Kind:** direction, once. The still: one scene of the same layout (a well, a house, a tree, a path, water) rendered in each of the four climates at phone size, four frames (section 8). After the pick, a climate's numbers are polish.

## 3. The seasons of the year

The year is the real year (decided). A season changes the climate's table, never the map (G59): the same ground, remapped; the same trees, with another canopy sprite; the day's length, from the hour table.

| Season | Temperate | Dry | Cold | Day (sun up, sun down) |
|---|---|---|---|---|
| Spring | Light greens, flowers scattered (2 to 3 kinds), the canopy thin; rain one day in three; mud after rain | Short green after rain, flowers one week | Snow melting, mud, water high | 06:00, 19:00 |
| Summer | Deep greens, the canopy full; clear most days, a storm now and then | Yellow and bare; heat shimmer; no rain | Green meadow, long light, pines as always | 05:00, 20:30 |
| Autumn | Yellow and orange canopies (the fire ramp and earth ramp over the leaf motifs), leaves falling (motion `leaves`), fog mornings, rain one day in two | Wind and dust; cooler nights | First snow on the high ground; fog | 06:30, 18:00 |
| Winter | Bare trees (a second trunk sprite), brown and grey meadow, puddles; rain and wind most days; snow some days in the hills; the shortest light | Cold nights, bright days; rain rarely | Snow 70%, ice on still water, wind, snowfall (motion `snow`) | 07:30, 16:30 |

- **The hour table per season:** `light.keys` (#241) gains an optional `season` on each key; the engine takes the keys of the current season, else the plain ones. Winter's dusk key lands at 16:30 and summer's at 20:30. The night rule (92%) and its pools do not change.
- **Hemisphere:** the valley's seasons follow the northern months (the owner's question, section 10, Q1).
- **A season never gates content** (DECISIONS 2026-10-09): a thing of one season comes back every year and nothing is lost by missing it (G28, G42). A seasonal ground kind (snow, mud) is a look; the tile under it keeps its walkability.
- **Kind:** polish inside the climate pick, except autumn's canopy colours and winter's bare trees, which are one still each (section 8).

## 4. Weather: one sky per region per day

REACTIONS phase B decides the day's weather from the seed, a day ahead, shown in the morning toast. This section says what each weather looks like and adds three kinds to the closed list (#215: clear, rain, fog).

| Weather | Ambient light | Cast shadows | Sky layer (sky.ts) | Ground | Motion | Sound | Fire |
|---|---|---|---|---|---|---|---|
| Clear | The hour table as is | As decided, full | No cloud shade on a clear day; the fog banks only at dawn | Dry | Sway at the breeze's amplitude (a third of the full) | Birds, the climate's bed | As is (G48) |
| Overcast | Minus 20% (a multiply of `#5d6177` at 20%) | Faint: shadows at half their alpha, the same length | Cloud shade over the whole view, drifting slowly | Dry | Sway at half | Fewer birds | As is |
| Rain | Minus 30%, cool (`#275a99` at 15%) | None | Full cloud; rain streaks in whole pixels, 2 px long, at the wind's angle, behind `RICH.motion`, and the drops landing beside them (the owner, 21.10) | Wet: the ground one step darker for the day; puddles on path and cobble (the reflection cue at full) ; mud on meadow in spring and autumn; tracks after rain (REACTIONS phase C) ; and the landing answers the surface: stone a ring and a crown, water a flat ripple, a wall a drop that runs down it, a roof a bead, grass a drop in the blades, sand a dimple, a canopy only the drop that leaves it (the owner, 21.10) | Sway at full; drips off the eaves | Rain bed, the birds silent | As is: rain never puts a fire out (G48). The fire's glow reads brighter against a dark day: that is the light module's contrast, not a rule change |
| Fog | Minus 15%, pale (`#c6cad6` at 15%) | Faint, short | Three banks across the view (#238) all day, thick at dawn and dusk | Wet | Sway at a third | Muffled: the bed at half | As is. Fog shortens the wolf's sight (decided) |
| Wind | The hour table as is | As decided | Clouds cross fast; cloud shade at full speed | Leaves and dust blown across the path (motion `leaves`, `dust`) | Sway at full and the wind's phase shared by every swaying thing on screen | Wind bed, the shutters | As is. Smoke from a chimney or a fire leans with the wind (motion `smoke`, drift from the wind) |
| Storm | Minus 40%, blue (`#172a52` at 25%) | None | Full cloud, fast; rain at a steep angle; one lightning frame every 20 to 60 s, the whole screen `#f5f4ef` at 60% for two frames, then a rumble | As rain | Everything at full | Storm bed | As is |
| Snow (cold climate, winter) | Minus 10%, pale | Faint | Flakes falling slowly, drifting with the wind; the fog banks pale | Snow deepens on the ground over the day (a second snow fill at full) ; footprints (cue 4) | Flakes | Snow bed, muffled | As is |

- **The shine of a wet world** (the owner, 21.10): the tops of the stones throw the sky back, the puddles and the
  water hold it, and a lit window or a fire bleeds a soft halo into the wet air. It sits behind `RICH.light`
  with the rest of the light, and it reads the hour's own light rather than a fixed colour, or it disagrees
  with the pools at night. The pick and its stills: DECISIONS 2026-10-21 "Rain: the drops fall and land".
- **Weather is a look and a sound.** Nothing in the table changes a rule: a player walks, gathers and crafts the same in a storm. The two reads the kernel keeps are the ones already decided: the `weather` condition on a reaction, and fog on a predator's sight.
- **The mix per climate and season** lives in the climate table (section 2) as weights: temperate winter `rain 40, overcast 25, wind 15, clear 10, fog 10`; temperate summer `clear 60, overcast 20, wind 10, storm 5, rain 5`; dry summer `clear 85, wind 15`; cold winter `snow 40, overcast 25, fog 15, clear 10, wind 10`. The seed draws from the weights, so the same day is the same weather on every replay (REACTIONS phase B).
- **One sky for the whole region,** as decided; a player who crosses to another region crosses into its weather at the climate band (section 2).
- **What never dims:** a signal a rule needs stays at least as visible as today under every weather (ART_SYSTEM 2): the wolf's eyes, the player's pool, the fire's stage, the glint, the lantern post, the path. The e2e colour checks run under the darkest weather too (storm at 19:00).
- **Phones:** every weather layer sits behind `RICH.light` or `RICH.motion` and falls back by group; the plain valley is clear and still.
- **Kind:** overcast, rain and fog at 12:00 on the square are one sheet of three stills (section 8); the rest is polish inside them.

## 5. Light: one sun, and what stands in its way

The light module (#234, #241) holds the hour. This section adds the laws that bend it.

- **Ambient:** the hour's tint (the table, per season) times the weather's level (section 4). Both multiply once; the product is capped so that the darkest daytime (storm at 19:00 in winter) stays lighter than the night's 92%, and the night is the night under every weather.
- **Shade under cover:** 12% as decided (ART_SYSTEM 2), over the cover rects: groves, canopies, roofs when houses return, a cliff's foot on its shaded side. **A character under a canopy is shaded too:** the multiply runs over the character's sprite as over the ground, so Pell in the grove is darker than Pell in the open. The dapple (`dappleAt`) runs over him as over the ground. His own pool and the wolf's eyes are cut out of the shade like every pool (STYLE 5).
- **Between trees:** two canopies within two tiles of each other make the ground between them a cover rect too, so a forest floor is shaded, with the dapple as its only light; a clearing of 3 x 3 or more is open ground.
- **Cast shadows** (STYLE 4) take their length from the hour and the season: at the hours STYLE names, 0.8 to 1.1 times the height; in winter 1.3 at the same hours, since the sun is low; none at noon in summer, 0.3 at noon in winter. The direction is the convention of STYLE 4 (left in the morning, right in the evening), the same for every caster in a frame.
- **Indoors** (the shop interiors, the hall): no sun and no weather. The room's light is its own lamps and windows: a window pool on the floor in the daytime at the hour's tint, the lamps' pools from dusk. A storm outside is heard, and lightning flashes the window pool.
- **The moon:** a full moon lifts the wild's night from 92% to 88% and shows the ground's shape; a new moon leaves 92%. The phase comes from the real date (the year is the real year). Polish, after the night's final level is set by the owner in the live game.
- **Both doors:** the 3D client reads the same hour table, the same weather and the same climate table for its ambient light, its fog distance and its sky colour, as ratios (STYLE, "Both doors").

## 6. The colour of nature, as one formula

A green on screen is never one number. It is the ground's ramp, remapped by the climate's ramp set (section 2), shifted by the season (section 3), darkened one step when wet (section 4), under the hour's tint and the weather's level (section 5), under cover shade where a canopy stands. Every factor is a table, and every table is data in `content/core/`, so a creator who draws a meadow once sees it right in every climate, season and sky without a second drawing.

The check keeps the formula honest: a still of the same spot in the four climates, the four seasons and the seven weathers (section 8's sheets) is re-made by `tools/stills/` when a table changes, and the owner compares.

## 7. Checks and measures

- **Scale:** `scale` on kit sprites against the floors of section 1 and STYLE 1b (warning).
- **Climate:** a region file names a `climate` once a second region exists (error); a kind placed in a region its climate does not allow is a warning (an oak in the desert).
- **Richness by climate:** the richness warning (#204) reads the climate's own floor: the desert's floor is a third of the valley's, so a sparse desert window is not a warning and a bare valley window still is.
- **Weather weights:** every climate and season row has weights that sum to 100 (error).
- **Signals under weather:** the e2e colour checks at the darkest weather (storm at 19:00, winter) for the wolf's eyes, the pool, the fire's stage, the glint.
- **Frame time:** a 2K phone holds its budget with every layer on, in a storm, at night, with a fire; a weaker phone drops by `RICH` group.

## 8. The stills: what the owner sees, in what order

One scene, one difference per still, at phone size, as the 18.10 and 20.10 sets were made:

| Sheet | Frames | Tests |
|---|---|---|
| Scale | 1: the square at 12:00 with an adult, a child, the elder, a hen, a dog, the wolf, a deer, a horse and cart, the oak | The numbers of section 1 (direction) |
| Climate | 4: the same layout in temperate, dry, cold, wet | Section 2 (direction) |
| Season | 2: the square in autumn (orange canopies, leaves falling) and in winter (bare trees, puddles, the short light at 16:30) | Section 3 (direction for those two; the rest polish) |
| Weather | 3: the square at 12:00 under overcast, rain and fog | Section 4 (direction); wind, storm and snow are polish inside the pick |
| Shade | 2: Pell in the grove at 12:00 with and without the shade over him | Section 5 (polish, shown once because it changes every character's look under every tree) |

The sheets were made on 21.10 with the L1 material look (the ladder's L1, since L1 is the world's half of the character pick C and the climate tables are ramp overrides on it), by `tools/stills/nature.py` from `tools/stills/nature.json`. A number change costs a run. What each frame shows and its exact numbers: [frames/2026-10-21-nature.md](frames/2026-10-21-nature.md).

What they do not show, on purpose: the final art (every prop is the ladder's script-drawn stand-in), the house's windows (lit in the stand-in at every hour), motion (rain, flakes and leaves stand still), and the night (decided, not reopened).

## 9. The compass: Graveyard Keeper, and the honest distance

The owner, 20.10: "the level of Graveyard Keeper 2, if not more". What that game does that the valley does not yet:

| Graveyard Keeper | The valley today | The path |
|---|---|---|
| Painted pixel art: 8 to 12 steps per material, every prop hand-shaded, texture on every surface | 16 px sprites in the 32 core colours, a median of 3 colours per tile sprite (#230's count) | The 64 px redraw waves in ramps (L1) |
| A real light layer: a coloured day cycle, every lamp a soft pool, the night blue and the fire orange on the walls | Night at 50% in the live game, two-step pools, no hour tints by day (#241: four of five hours are the same picture) | The light module (built) with L2's tints and the four-step pools |
| Weather and seasons that change the scene's colour, not only the sky | Weather is a schema value, not a look; no seasons | Sections 2 to 6 of this page |
| Depth: foliage in layers over and under the player, long shadows, things behind things | Shadows C and the six cues decided, not built | STYLE 4 to 7, in the `world.ts` window |
| Motion everywhere: smoke, flames, leaves, cloth, dust, water | Static, except the ambient creatures | ART_SYSTEM 4, L3 |
| Every screen composed: a focal thing, a frame, a rest | By code, with a richness warning | ART_SYSTEM 5 |

The distance is large on every row and the ladder is already the path. This page adds the rows that make a region's look follow its climate, season and sky, so that when the art is there, the world behaves.

## 10. The owner's questions

Each with a recommended default; silence keeps the default. Answered by the owner on 20.10 (DECISIONS 2026-10-20, "Nature's laws").

1. **Hemisphere.** The valley's seasons follow the northern months (winter in December). Default: yes. The game is for the whole world, but a world has one calendar, and the valley's story has a long night in winter. **Answer: the default.**
2. **Does the valley get snow?** Default: no, except a rare winter day in the hills; snow as a ground belongs to the cold climate. A snowed valley is a holiday look later, never a rule. **Answer: the default.**
3. **How long is a weather?** The whole game day, as decided (REACTIONS phase B). Default: keep it; a change at midday is a later refinement with its own still. **Answer: the default.**
4. **Do overcast days cancel the cast shadows?** Default: no, half alpha; rain and storm cancel them. A shadow is a depth cue a player reads, and a day without any is flat. **Answer: the default** (STYLE 4, the weather row).
5. **Monster grades.** Four grades, small to colossal, declared per kind. Default: yes; the number of grades is the same as STYLE 1b's "bigger is open" already implies. **Answer: not now.** The grades are decided with the first monster kind (combat, stage 8).
6. **Interiors in weather.** Default: a storm is heard indoors and lightning flashes the window pool; nothing else of the weather enters. **Answer: the default.**

## 11. The order, who builds what, and the proof

| # | Step | Kind | Builder | Waits on | Proof |
|---|---|---|---|---|---|
| 1 | This page as a decision: the owner's answers to section 10 into DECISIONS | Decision | The owner | Nothing | The DECISIONS entry (done 20.10) |
| 2 | `scale` in the check (the picked rows are in STYLE 1b since 20.10) | Mechanics | The art stream | Nothing | Tests; every kit of today passes |
| 3 | `climates.json`, `climate` on the region, the ramp-set remap per climate | Mechanics, shared file first | The art stream, with the open-world stream told (NEXT 19 a's chunk file carries the ramp set) | #230 (landed) | The valley as `temperate`, no pixel moves |
| 4 | The sheets of section 8 from `tools/stills/` | Direction | The art stream | The L1 to L3 pick | The frames and their note |
| 5 | Weather looks: the sky layer per weather, the ground's wet step, the ambient level | Polish inside the weather pick | The light stream | REACTIONS phase B (the `weather(day)` function) and the pick | Stills at 12:00 per weather against the table; e2e signals under storm |
| 6 | The season keys in `light.keys`, the seasonal canopies and ground remaps | Polish inside the climate pick | The light stream and the art stream | Steps 3 and 4 | Captures at the four seasons' 16:30 |
| 7 | Shade over characters and between trees | Polish | The light stream | #234 (landed) | The shade sheet |

Rules for every step as ART_SYSTEM 8 says: its own pull request off `origin/develop`, the shared files as PARALLEL.md says, a look change only after its still is picked, a DECISIONS entry as built with a `Model:` line.

## 12. Where the pages disagreed, and how it was settled (21.10)

Read together on 21.10: STYLE, ART_SYSTEM, REACTIONS, OPEN_WORLD, the DECISIONS of 18 to 20.10, and the code of #230, #234, #238 and #241. Six places disagreed. Each is settled here and, where the older page needed a line, in the same pull request.

| Disagreement | Was | Settled |
|---|---|---|
| Cloud shade: STYLE 7 said `#1b1a2e` at 12%, whole pixels; #238 built `#172a52` at 34%, ground only, with the owner's "keep" on three stills | Two numbers in force | STYLE 7's row now carries the kept number and names the one open question (shade over props and people too). Section 4's "overcast" uses the same colour; its 20% is the whole-sky case, not the drifting patch |
| STYLE 2 "every pixel fully clear or fully solid" against the engine's alpha layers (shadows at 30%, the night, pools, the wash, fog) | A rule written for sprites read as a rule for the screen | STYLE 2 now says the rule is for sprites and tiles; a layer is a blend at one alpha per step, at most four steps, dithered where steps meet. `nature.py` keeps fog to three alphas for that reason |
| #238's fog "in the low ground" (the code's comment) against its banks at fixed fractions of the view | The comment described fog by place; the code draws bands | Section 4 says one sky per region and bands across the view; fog by place needs a height or water test and waits for T2 (STYLE 6) |
| ART_SYSTEM 2 listed "the day's weather" as an input of the light module with no table behind it | An input with no values | Section 4's table is the values; ART_SYSTEM 2 points here |
| REACTIONS phase B has three weathers (clear, rain, fog); the look needs more | Overcast, wind, storm, snow had no home | Section 4 adds four, as look only; the closed list in `schema/src/index.ts` grows with phase B, never before (G29: no rule reads them) |
| The colour count of #230 reads the sprites' PNG palettes under a window, and every pixel must still be in the 32 colours, so no window can pass 32 and "warn above 96" cannot fire until a kit declares ramps | A measure that reads 21 today and cannot see the 382 to 492 of the references | `nature.py` counts colours on the finished still, light and weather included: 97 to 374 on the sheets against 117 on the plain square. That is the number to put beside a reference frame; the check's count stays what it is, a count of sprite palettes, and says so in its warning once ramps land |

What the ramp check measures, restated (for the owner reading its numbers): that a declared ramp's warmth (red minus blue over the colour's light) moves by at least 0.03 from its darkest to its lightest step, in either direction, and that its steps rise in value. It does not check the direction ART_SYSTEM 3 names (cooler as it darkens, warmer as it lightens), because the core's own earth ramp cools as it pales and would fail; and a ramp that only desaturates passes. It is a smoke test against a pure value ramp, not the rule's full statement. A stricter form is a pick of the owner's after L1, not before.

## Sources

- The owner, 20.10: natural law for the look; Graveyard Keeper as the measure.
- [STYLE.md](STYLE.md) 1b, 3 to 7; [ART_SYSTEM.md](ART_SYSTEM.md) 2 to 5, 8; [REACTIONS.md](REACTIONS.md) phase B and C, Q1, Q2; [OPEN_WORLD.md](OPEN_WORLD.md) G51, G57, the landmark per region; [GAME_RULES.md](GAME_RULES.md) G28, G29, G42, G47, G48, G59.
- DECISIONS 2026-10-09 (seasons, the real year), 2026-10-18 (the compass, shadows, the night, the cues, 64 px), 2026-10-19 (fog yes, weather never touches a fire), 2026-10-20 (the art system, the ramp rule, the light module).
- Pull requests #204, #205, #215, #230, #234, #238, #241.
