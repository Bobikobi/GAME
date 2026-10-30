# The first map - the plan (NEXT 19 item 0)

**Picked by the owner, 28.10: A** (DECISIONS 2026-10-28 "The first map: frame A"). The owner's notes with the pick:
- The mountains around the valley are snowy, and crossing them is close to impossible: hard routes that cannot be seen, found the way a player explores an open world, with heavy snow, ice pits and monsters. The three passes are the ways out; the mountains between them are not a wall but a trial.
- The human city is reached by sailing: it stands on the far bank, the south-west corner across the bay, as the plan draws it (scenery only on the first map, G55). The tarn in the east highland is a small mountain lake with the boathouse and its keeper, not the city.
- Later, a mechanism that lets creators change a mountain in a way that makes sense to players (a route opened, a pass cut); it is written when the open world's creator rules (item h) are built.
- Paths outside the opening: faint, worn, with small weathered signs (the paragraph below).

Every number below is a proposal that the pick turns into the plan to build (items a to i).

192 x 192 tiles (3 x 3 chunks). Walking distances are 4-way BFS steps (G56), measured on the plan's raster by `first-map/plan.py`
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
