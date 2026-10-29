# The first map - the plan (NEXT 19 item 0)

**Picked by the owner, 28.10: A** (DECISIONS 2026-10-28 "The first map: frame A"). The owner's notes with the pick:
- The mountains around the valley are snowy, and crossing them is close to impossible: hard routes that cannot be seen, found the way a player explores an open world, with heavy snow, ice pits and monsters. The three passes are the ways out; the mountains between them are not a wall but a trial.
- The human city is reached by sailing: it stands on the far bank, the south-west corner across the bay, as the plan draws it (scenery only on the first map, G55). The tarn in the east highland is a small mountain lake with the boathouse and its keeper, not the city.
- Later, a mechanism that lets creators change a mountain in a way that makes sense to players (a route opened, a pass cut); it is written when the open world's creator rules (item h) are built.
- Paths outside the opening: faint, worn, with small weathered signs (the paragraph below).

Every number below is a proposal that the pick turns into the plan to build (items a to i).

192 x 192 tiles (3 x 3 chunks). Plan A2 (29.10) re-lays the valley to the site's key art: section "The picture is the map" below. Walking distances are 4-way BFS steps (G56), measured on the plan's raster by `first-map/plan.py`
(`first-map/measure.json`). Images: `frames/2026-10-28-first-map-plan.png`, `frames/2026-10-28-first-map-A.png`, `-B.png`, `-C.png` (390 x 844). Names are neutral (S1-S6: nothing here states the past).

**Frame.** The authored valley moves as one rigid block by (+66,+84): town about (96,92), river and bridge (79-81,101-102), tangle,
night ruins, bay. Around it: a 96 x 96 floor (x48-143, y48-143) of meadow and forest, then mountains, grey by level (0-9).

| Region | Climate (NATURE) | Place card (PLACE_LOOK) | Landmark | Danger |
|---|---|---|---|---|
| Valley floor | temperate | temperate valley (approved) | town square smoke, bridge, tangle | d0 (< 64 steps from town) |
| East terraces + highland | cold / highland | cold highland; the lake needs its own card (lakeside) | boathouse smoke on the skyline, tarn, boat lift | d0 floor, d1 tarn (88 steps) |
| North: elf wood | temperate, dense | Elf world | three wayside stalls, branching trails with dead ends | d2 (134-144 steps) |
| The bay + south coast | wet edge | marsh / wet edge | dock, reed marsh at the tangle's wet corner | d2 (dock 139) |
| Far bank (map edge) | - | Human city (scenery only, G55) | skyline across the bay | not walkable |
| Undead south | dry, dark | Undead world | night arch (valley), sunken hall, descent | d1 hall (106), d2 beyond |

**Starting areas** (each a 7-tile disc, level 0, never tied to a race; the seed draws the pocket): 1 north meadow (72,68), 2 west bank (67,95),
3 slid bank (68,121). **Elf** north, **human** across the bay, **skeleton** south: their worlds open by their own quests.

**Passes (G68, a face blocks both ways, crossings vary by place).** N (72,48): stairs cut in the face, up to level 3 and down into the wood.
E (143,100): cart ramps up the terraces, then a switchback ramp to the highland (level 3); a boat lift joins the stream to the tarn.
SW (84,144): the shore walk along the bay, level 0, to the coast and dock. Descent: a stair down from the night ruins to the undead south.
No crossing strands a player (every pass is walkable from the town, `pass_reach` in `first-map/measure.json`).

**Paths (G69).** Every path is a staircase of legs of 3-7 tiles with sidesteps. Longest straight run in the plan: **7** (limit 8). The old
block keeps the paths it already has.

**Look of paths outside the opening (owner, 28.10; a rule for items e) and i); the stills stay as drawn, they show layout, not this look).**
Outside the valley's opening, paths are faint worn dirt traces that fade in and out - never a continuous drawn road - or almost
non-existent and unclear, because the world is one you discover. A small weathered sign in the region's own material (wood in the elf wood,
stone in the highland, and so on) stands now and then, mostly at forks and passes. The opening's paths inside the valley stay as they are:
the opening rules and pillar 1 need the way to the first bridge readable. The solid lines in the images mark where a trace runs, not how it is drawn.

**Danger (G64).** d = steps from town / 64. d0 the floor round town, d1 the outer floor and the passes' feet, d2 beyond the crests (pink line on
the images marks each 64). Tiles by level in A: d0 4541, d1 6142, d2 994.

**Distances.** Today (develop, `starts.ts`-style BFS on `content/core`): wake to bridge 16 / 8 / 7, nearest pair **9** steps (west bank - slid bank).
A: wake to bridge 39 / 17 / 30, pairs 32 / 57 / **25** (nearest = west bank - slid bank): 2.8 x today. The first bridge's view shows none of the three areas.

**What each still tests.** A: the proposal. B: only the floor, 72 x 72 (the outer 12 tiles round the floor become foothill forest; the authored
valley block keeps its own ground where it sticks out south of y131). C: only the passes, the south-west pass closed (2 passes).

**For the owner to judge:** whether the valley feels framed by mountains, whether the passes read as ways out, whether the world feels huge after the first bridge.

## The picture is the map (owner, 29.10)

The site's home background, `web/public/keyart/hero-poster.jpg` (1920 x 1080), is the illustration of the first map. Where plan A and the
picture disagree, the picture wins. The picture looks north from a meadow in the south: its left is west, its right (the low sun) east.
Picture positions are pixels of the jpg (x, y from the top left); plan positions are tiles of the 192 x 192 raster. A2 is drawn by
`first-map/plan.py` (variant `A2`) and measured into `first-map/measure.json`; images `frames/2026-10-29-first-map-A2.png` and
`frames/2026-10-29-first-map-A-vs-A2.png` (A left, A2 right).

| In the picture (where, how big) | In plan A (where, or missing) | The change to the plan (tiles) | Note |
|---|---|---|---|
| The river: enters from the north-east distance (x 650-850, y 400-540), passes the town's east side, is widest at the bridge (x 440-800, y 640-720), then turns toward the viewer and swings south-west to the lower left (x 200-600, y 740-960) | Runs straight north to south from a spring at (80,51) along x 79-81 to the bay | Re-routed from the north-east: spring (128,49), down through (121,55), (110,61), (100,64), (90,68), the bend at (84,71)-(82,75), then (80,79) into the old river top at (80,84); 3 tiles wide. A's channel x 77-83, y 52-83 is meadow again. Below y 84 the river and the bay are unchanged | The authored block's river, bridge and bay do not move |
| A lake with wooded islets where the river leaves the hills (x 650-900, y 430-540) | Missing | A mere at (114,58), 5 x 3 tiles, on the river; its islets are forest | The pocket rule turns the islets to trees |
| The waterfall: several cascades off a cliff on the west heights, level with the bridge (x 40-130, y 640-760, about 90 x 120 px) | Missing; the west of the floor is flat meadow with a forest edge | The west heights: a shelf x 48-56, y 68-92 at level 2, pines on it; the falls drop off its east face at (56-57, 80-84); a brook runs east along y 82-83 from x 57 to the river at x 78, under the city's south wall; a stair beside the falls (53-63, 87-89) climbs the shelf | The brook gets a footbridge where the city's south road crosses it (64,83) |
| The town with red roofs: about twenty houses, the largest built thing in the picture (x 240-720, y 440-640), on the river's west bank, smoke from the chimneys | The valley town at (96,92) is on the river's east bank; the human city is scenery on the far bank (x 0-24, y 150-191) | Reading (b) drawn: a walled city x 58-75, y 64-80 (18 x 17 tiles) on the west bank inside the bend; red-roofed blocks between streets, a square at (64-69, 70-74); gates south (66-67, 80), north (66-67, 64), east (75, 77-78), dock gate (75, 71-73) | The authored town keeps its place east of the river; in the picture that spot is behind the elf |
| Its tall tower: a stone tower with a smoking top, the tallest building (x 278-342, y 445-550), on the town's west side | Missing | Tower tiles (60-61, 66-67), the city's north-west corner | The city's landmark seen from the meadow |
| A red-roofed spire on a wooded rise behind the town (x 520-550, y 385-460) | Missing | Spire tile (73, 59-60), on the rise north-east of the city | |
| The bridge: a stone bridge of five arches with lamps (x 440-790, y 630-710), from the town's south-east to the east bank | One bridge, the first bridge (79-81, 100-101), on the authored block | A second bridge, the city bridge: rows 77-78 over the river (x 79-83), from the city's east gate to the east bank; a road from its east end (83,78) to the town's north side (94,85) | The first bridge stays as it is; the opening's way to it is untouched |
| The dock: a wooden crane over the water at the town's river edge, north of the bridge (x 560-620, y 490-560) | The only dock is on the bay's south coast (52,177) | A river dock x 76-83, y 71-73 out from the dock gate to the water, the crane at (77,71) | The coast dock stays |
| The ruined hall: a great arched gate and walls on a hilltop above the town (x 150-360, y 95-230) | Missing; A's halls are the night ruins on the block and the sunken hall in the undead south | A hill at level 2 round (55,55), 8 x 6 tiles; the hall's walls x 51-58, y 51-55 with three arches open in the south wall at (52,55), (54,55), (56,55); a stair cut in the hill from the city's north gate (66,63) to the hall (56,57) | 81 steps from the town (d1) |
| The wooden tower: a scaffold tower beside the hall (x 350-420, y 165-240) | Missing | Tower tiles (60, 53-54) on the hill, east of the hall | |
| Broken towers down the ridge between the hall and the town (x 410-700, y 220-350, four or five) | Missing | Two broken towers at (62,58) and (58,60) on the hill's south-east slope | |
| Pine forests on every slope, densest on the left (x 0-250, y 160-560) | Round clumps of forest scattered over the floor; the mountain ring is bare grey rock | The ring's slopes at levels 1-2 west of x 66 and north of y 66 (x < 128) are pine forest; pines on the ruins hill and the west heights; a clump on raised ground is pine | Forest on level 0 keeps A's clumps |
| The high mountain range behind, north-west, in mist; the highest peak at the upper left (x 30-200, y 60-110), a second summit at x 450-650, y 110-170 | A uniform ring rising to level 9 all round; every outer tile is snow | The ring tops out at level 7 (snow on the crests); one peak at (30,32) rises to 9: level 8 or more within about 9 tiles of it. A2's relief is lit from the east | The second summit is a crest of the ring at level 7, north of the elf wood |
| Mist banks over the middle of the valley and round the falls (y 300-450) | The mist at the grid's edge only | None on the raster: mist is a look of the place, for the place card (PLACE_LOOK) | Not a tile |
| The meadow in the foreground where the three stand: grass with white flowers, high above the river, mossy squared stones (x 0-480, y 840-1080 and x 720-880, y 860-960) | Missing: south of the block are the shore pass (84,144) and the undead south | A meadow round (91,151), 6 x 4 tiles at level 0, just south of the block's south edge; flowers, rocks at (86,153), (96,153), (95,149), mossy stones at (88-89, 148) and (93,148); a path from the shore pass (85,146) to (91,151); 82 steps from the town (d1) | The picture's eye: from here the city, the falls, the hill and the peak lie north-west, the town north |
| A dark plume curling up at the east edge, behind the skeleton (x 1750-1890, y 280-480) | Missing | A lone dark tower, 2 x 2 tiles at (183-184, 123-124), on the highland's south-east rim, with its plume; 116 steps from the town (d1) | The picture shows the plume, not the masonry; the plan gives it a source |
| The sunset side: the sun low on the right (x 1800, y 165), warm light, shadows to the west | The relief is lit from the north-west | A2 lights the relief from the east; a sun mark on the east edge | The east is the light's side; the highland and the tarn sit in it |
| Sand along the west bank below the bridge (x 250-560, y 740-800), rocks in the river (x 420-560, y 860-900) | The authored block's sand banks along the river (x 78 and 82) | None | Already there |
| The ground behind the three, east of the river (x 800-1850) | The valley town, the camp, the east terraces | None | Covered by the figures |
| Glowing pixel glyphs in the sky (x 150-1250, y 0-140) | - | None | The site's decoration, not land |

**The five biggest changes.** 1 The walled city with the tall tower, its own bridge and a river dock stands on the river's west bank at
the bend (x 58-75, y 64-80). 2 The river comes from the north-east through a mere and bends south at (84,71) instead of running straight
down from the north. 3 One high peak north-west at (30,32) reaches level 9; the rest of the ring tops out at 7. 4 A ruins hill with the
arched hall and the wooden tower at (55,55), above the falls off the west heights (57,82) and their brook. 5 The meadow where the three
stand, south of the block at (91,151); start 1 moves from (72,68), now inside the city, to the east bank at (106,74).

**Measured on A2** (`measure.json`, key `A2`; A's numbers unchanged). Wake to bridge 55 / 17 / 30 (A 39 / 17 / 30); pairs 66 / 85 / **25**
(nearest = west bank - slid bank, 2.8 x today's 9, as in A); the first bridge's view shows none of the three areas; every pass is walkable
from the town (N 68, E 55, SW 74 steps); the city's east gate is 36 steps from the town, its square 50 (d0); no walkable tile is cut off;
no path has a straight run over 7 (limit 8); danger tiles d0 4642, d1 6239, d2 775 (A 4541 / 6142 / 994). The authored block keeps its
ground and paths; the three passes stay where A has them.

### The human city: two readings (the owner picks)

**(a) The picture's town is the valley town.** The walled town with the tall tower is the town the player starts near, the one the
opening already has; the human city stays across the bay as scenery (G55 as it stands). The town stays east of the river where the
authored block puts it (the picture's left and right are the painter's for this one place): its tall tower goes to the square's west edge
(about (88,88)) and its dock and crane to the river beside it (about (82,90)); the first bridge is the picture's bridge, so the city bridge
is not built; the west bank at x 58-75, y 64-80 is meadow again and start 1 can return to (72,68).

**(b) The picture's town is the human city, in the valley.** The walled town on the river's west bank, reached on foot over its own
bridge, is the human city; it is no longer scenery sailed to, so G55 changes, and the far bank at the south-west corner is a skyline with
no city. The human world opens from the valley's north-west instead of across the bay. The opening's town stays the town by the first
bridge. A2 draws this reading; the caption of the still names what (a) would move.
