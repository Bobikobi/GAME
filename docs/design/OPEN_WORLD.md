# Open world: design draft

Status: this is a draft for the owner, under the request rule in GAME_RULES.md section 6 (532-571). Nothing here is built, except G56: built at stage 2a (kernel `walkDistance`, the server's movement credit, `tools/src/check.ts`; DECISIONS 2026-10-20, "The server's wire, as built"). Every claim was checked read-only against `origin/develop` @ 2719343. That commit is three merges after ace1e33, the base of the four reader reports: #118, #106 and #119. The draft was then rebased to `origin/develop` @ dac7bdf, which adds #120 (Maru's hearth and the long night), and every cite into a file #120 changed was checked again there. Line numbers are at dac7bdf.

**Owner direction, 17.10.2026: the world has no end** (DECISIONS.md, 2026-10-17). Generated ground from one seed surrounds the hand-made valley, danger by distance replaces doors, authored places are stamped in, the community grows the world, and it opens ring by ring. G50's 1024-tile cap, the grid edge (G54) and crossings as the only way on (G55, G58) are to be rewritten to match; the edge lip of D1 waits. Until that rewrite, read the sections below through that entry.

**Owner decision, 16.10.2026: D3 is decided, option 3.** The valley becomes the first region of a named land, and each region carries its own small story (OSRS kingdoms, WoW zones); G7 and G22 become "the region's". STORY 35 and 38 and the ladder's frame (GAME_RULES.md:61-63) are rewritten to match, in a docs change the owner reviews. Everything below that assumed option 1 (a fold giving back the valley's own land) follows option 3; ground past the valley's edge is open, so the work gated on D3 can start.

Short names: `s` = `schema/src/index.ts`; `dec` = `DECISIONS.md`; `spec` = `docs/spec/product-spec-v4.6.html`; `NEXT` = `docs/team/NEXT.md`; `WORKFLOW` = `docs/team/WORKFLOW.md`. SETTLEMENT, STORY, GRUNT and kernel-review are the design docs of those names, cited by line.

Numbering: the new rules start at **G50**, after G49, the highest number in GAME_RULES.md (392-398). The G numbers in that file are not in line order (G48 is at line 372, G36 at line 384). No G50 or higher exists at dac7bdf. The merge must check again and renumber if one has landed.

Two words:
- **Region** means one map file's part of the world. The valley is region one ("The first region", map.json:8), and assemble already expects "a second region" (assemble.ts:212-214). Spec 383's "one area" (G-1) is a region in this sense: the valley as a whole.
- **Area** keeps the meaning it has in SETTLEMENT 66-72 and in the `area` slot kind: a place inside a region. In the valley these are core/town-square, core/arch-mouth, core/night-threshold and core/tangle-heart. Danger levels belong to areas, not regions (G64).

## 1. World rules draft

### 1.1 The frame

**G50. One grid, the valley first.**
- The world is one tile grid of at most 1024 x 1024 tiles, the largest map the schema allows (s:942-943). That is about 446 times the valley's area.
- The valley (`core/world`, "The first region", map.json:8) is region one.
- Every map file carries an `origin` in the grid.
- The valley's origin is a chunk corner near the middle, for example (512, 512). The world can then grow on every side, and every outer edge lies far from the first town.
- The valley's origin ships with the stitcher (stage 4), not later, so no save is ever made in a frame that then moves under it.
- Once a file's origin has shipped, it never changes. The world lock (G59) holds it.

**G51. Regions are authored, chunks are cut.**
- A region is one map file: a rectangle of the grid with an id and a title. Files, seasons and gates work in regions.
- A region groups areas. It carries no danger level of its own (G64).
- A chunk is 64 x 64 tiles, aligned to the grid's corner. Nobody writes a chunk by hand.
- The chunk size, and the build cutting chunks from the stitched ground, are this draft's own proposal. docs/3d/world-notes.md:11-13 gives "64 x 64 m" only as an example and says nothing of a build step.
- Clients stream and cull by chunk (stages 5 and 6). The tools index by chunk where a check needs it.
- The kernel needs no chunk index at 50 times today's area. Strike is linear in hazards (kernel/src/step.ts:1014-1026), and isSafeGround and townAt are linear in slots (kernel/src/danger.ts:150-172). Measure again before the full grid.
- A region does not have to line up with chunks. How large a region should be is a smaller call (section 4).
- From world-notes, this draft takes the chunk ring: chunks resident around the player and a far ring (11-13).
- It does not take world-notes' walkability. World-notes makes a tile walkable by slope (9-10); the kernel's walkability is per tile (kernel/src/world.ts:162-191).

**G52. Saves never land in the wrong place.**
- The bundle is cut to the union of the map files and carries `frame`, its min corner. The frame is snapped down to the chunk grid, so two frames always differ by whole chunks.
- Node layout parity (x + y even, kernel/src/world.ts:104 and tools/src/starts.ts:99) and every look hash use coordinates fixed to the grid. The look hashes are at game/src/scenes/world.ts:552, 665, 794 and 1051 (2D) and the corner heights at game/src/play3d/scenery.ts:131-140 (3D).
- Grid-fixed coordinates are bundle coordinates plus `frame`, counted from the valley's origin (negative west and north of it). In the valley they equal today's coordinates. So neither shipping the origin nor growing the frame moves a node, a dig spot or a look.
- A save carries the frame it was made in.
- A save without a frame holds the valley file's own coordinates. Every save written before stage 4 is of that kind, since the valley was the whole bundle.
- On load, `adapt` shifts every stored coordinate by the difference between the two frames. That covers the kernel's `at`, the SaveFile `pos`, the `at` of each action in the tail (game/src/session.ts:41-56) and, once tents exist, a pitched tent. `adapt` (434-475) already runs on any content change (175-179).
- `adapt` then tests the tile. If it is solid or off the map, the player is placed in the town they were last in. The placement uses reappearTile's town pick (kernel/src/danger.ts:191-206) under a draw key of its own.
- This is placement only, never fall(). fall() takes the outing's gains, undoes its riddles and first-seen places, and counts a fall (kernel/src/step.ts:1062-1096). A content publish never costs a player an outing.
- Load's own fallback to `map.spawn` (session.ts:188-192) becomes the same placement, so `pos` and `at` always agree.
- Today `adapt` never touches `at`, load tests only `pos`, and the bundle holds one map (kernel/src/bundle.ts:49, 154).
- A frame in the save is a save-format change. WORKFLOW:39 allows one with a migration, and `adapt` is that migration.

Algorithm, stitch (in `assemble`, lifting the one-map refusal at assemble.ts:212-214):
1. Read every `map` file. `origin` defaults to (0, 0) while there is only one map file; with two or more, every file must carry one.
2. Refuse each of these:
   - a file that leaves the grid;
   - two files that overlap;
   - a slot id used in two files (references at assemble.ts:360-376);
   - a shipped file whose origin has changed (the world lock, G59).
3. Set `frame` to the min corner of all files, snapped down to the chunk grid, and the size to their bounding box. Refuse a side over 1024.
4. Ground:
   - Copy each file's rows at `origin - frame`.
   - Fill uncovered tiles with one reserved solid "void" character. Void counts as a fog band (G54).
   - A legend entry needs a sprite, a solidity and a tag (s:945). So void needs three things: a new tag in the closed TILE_TAGS list (s:66), a sprite in the core kit (the sprite must exist, assemble.ts:556-558), and a 3D kind, since 3D draws an unknown sprite as grass (scenery.ts:124).
5. Legend:
   - Use one shared legend. A file that maps a character differently from another file is refused, never remapped, because 'T' and '%' are hard-coded in the clients and tools (world.ts:584; scenery.ts:123; tools/src/site/scene.ts:127).
   - The one-character key space (s:944) cannot run out in practice; checkMap iterates code points (assemble.ts:554).
6. Offset props (hazards and their `round` included), slots and `borders` by `origin - frame`.
   - `spawn` comes from the valley's file only.
   - A starter's `wake` names the map file its coordinates belong to (the valley's when it names none) and is offset by that file's origin (G67).
7. Keep a tile-to-file index, so an error names the file its tile came from. Today every error is blamed on the valley's `origin[b.map.id]` (hazards.ts:87; deadprops.ts:28; assemble.ts:549). The bundle also keeps each file's rect, so the kernel knows a tile's region (G63, G66).
8. Run every check on the stitched map. Tag as today (assemble.ts:260-261).

### 1.2 Borders

**G53. Every edge is closed and readable.**
- Every tile on the stitched map's edge is solid or inside a border band.
- Every tile of a band is solid, so the kernel's walkability (kernel/src/world.ts:162-191) needs no new case for bands.
- Movement is 4-way: the client is a d-pad (game/src/input.ts:6-14; dec 1337), and reach.ts and starts.ts also search 4-way. A band 1 tile thick therefore holds.
- The valley's edges pass as they are, including the maze's 1-tile south wall (map.json row 48), so no maze is edited (dec 1345).
- There is no invisible wall. A band's ground looks impassable (thicket, cliff, deep river, mist over void), and bumping into it shows the band's line (`says`).

**G54. Three border kinds.**
- **Fog: the not-yet.**
  - Solid ground or void under the one mist (dec 1143) at its thickest. That look is B2's edge: at least 90% mist at the map border (dec 1267).
  - B2 is approved but not built. The 2D mist is one uniform sprite at alpha 0.1 (world.ts:988), and game/src has no clear circle or thickened edge anywhere. dec 1269 says "both are told before anyone builds".
  - B2's edge is therefore a prerequisite of fog bands, with its own build (stage 5).
  - A fog band is at least half a view deep, 6 to 13 tiles at zoom 2 on a phone, so the camera clamp at the map edge (world.ts:387; fit at :2334-2344) feels natural.
  - Both clients draw fog bands from `borders`, as the one mist thickened, never as a second layer (stages 5 and 6).
  - There is no interim through slots:
    - An empty `area` slot draws no fog: emptySlots skips area slots (game/src/places.ts:26-29).
    - Every other empty slot also gets a creator sign and is published to creators (world.ts:2278-2280, 2292-2300; schema/src/hub.ts:169-181).
    - Slots stop at 64 x 64 (s:926-927).
  - A fog band lifts when the region behind it ships.
  - The grid's outer edge is fog that never lifts, and it needs a look of its own. Fog with "awaiting restoration" tells a player the place can be restored (spec 211, 448), and this edge cannot be. Its look goes with D1.
- **Forest: the wall.**
  - Solid forest ground (`T`), never tree nodes.
  - Felling is not the reason. A stump blocks its tile as the tree did (dec 527, 1172; kernel/src/world.ts:159-160, 170-173), and town trees are not felled (dec 528).
  - The reasons are three:
    - a grove must never wall the map (tools/src/reach.ts:2-5);
    - no prop may wear a node's sprite (dec 1300; tools/src/deadprops.ts:28-39);
    - solid tiles never take a node (kernel/src/world.ts:104).
  - A forest band is permanent unless it names a `crossing`: a restore that a clearing quest opens. That is the one way dec 527 leaves to uproot a tree for good.
- **River: the promise.**
  - Solid water (`~`), at most 4 tiles wide. From the near bank, the far bank then sits within 5 tiles.
    - The fit keeps at least about 15 x 10 tiles in view (world.ts:2334-2344), so the far bank is on screen.
    - It also sits inside B2's clear circle once B2 is built (dec 1267).
  - A `far` rect is drawn behind the water, and a fog or forest band lies behind that before the map edge.
  - Deep water (walkable, a hazard by night, G34, GAME_RULES.md:352-353) never forms a border. The G30 check row already fails "a pit, trap or deep water that is solid" (GAME_RULES.md:616).

**G55. A far bank is scenery now and a promise later.**
- A `far` rect holds no slot, instance or hazard, and no wake place reaches it. So G34's check (tools/src/hazards.ts:180-208) and the reach check raise nothing there.
- The rect's props obey dec 1300 like any prop.
- Every river border names a `crossing`: a restore slot on the near bank (a broken bridge, a ferry post, a ford).
- Crossing slots are core-only: the check refuses a creator fill.
- Until its region ships, a crossing is shut by a gate: an optional `shut_until` on the restore that names the region file that must ship first (G67).
- The gate is needed because a filled restore can otherwise be restored at once, and it then opens its tiles (kernel/src/world.ts:174-189). Without it, a crossing would open early onto an empty far rect.
- A shut crossing draws as broken and cannot be restored.
- Its line says only what is true ("The bridge is out."), never that it could be mended (G8; "Free read", GAME_RULES.md:499).
- The far rect belongs to the region behind it. Until that region ships, it is drawn in the valley's file. When the region ships as its own file, the rect moves into that file as its first rows, and the valley's file drops it in the same merge.
- When the region ships, the gate lifts and the crossing becomes restorable.
- Each player opens a crossing by restoring it, by hand or through a quest's `reward.opens` (G58), and it stays open for that player (dec 1064).
- New rule, not a citation: a seen far bank always opens in the end.
  - Pillar 4 (GAME_RULES.md:42-44) says world objects change where the player can go; it makes no promise about far banks.
  - The WoW Greymane Wall and the OSRS River Salve are the pattern.

**G56. Borders hold in the kernel at stage 2a.**
- A band must stop a jump as well as a walk.
- An honest client never crosses one. It steps 4-way, only onto walkable tiles, and reports every tile (session.ts:291; world.ts:1515-1516).
- The kernel checks travel in one place, moveTo (kernel/src/step.ts:975-984).
  - It accepts a move within Chebyshev `2 + floor(elapsed / walk_step_ms)` of the last position (981-982; in place since P-5a, NEXT:29).
  - It tests only the target tile.
- An action sets `at` to the tile it names with no travel check (checkAt, step.ts:1104-1112).
- So a long idle followed by one far report, or one action naming a far tile, can land on a far bank.
- Why this waits for stage 2a:
  - While the kernel runs in the browser and the save is local, a stricter check stops no one who edits the save.
  - dec 30-33 set movement validation for stage 2a (server validation), and this check belongs there. The first far bank does not pull it forward.
- When the check lands, the gathered-node walk-over moves into the kernel with it; dec 94-97 set the same trigger.

Algorithm, move check (stage 2a):
- `r = 2 + floor(elapsed / walk_step_ms)`, capped at `move_reach_max` (a new param, G67).
- Search breadth-first over walkable tiles inside the square of side `2r + 1` around the last position, with 4 neighbours in a fixed order. Accept when the target is reached within `r` steps.
  - A 1-tile band then holds.
  - No move the client cannot make is accepted.
- The same search covers every tile an action names (checkAt).
- The search starts from the last `at` the kernel set, including the kernel's own moves:
  - the fall's wake (reappearTile, step.ts:1085);
  - the last bell's walk-out (step.ts:830-840, which also sets `movedAt`).
- That is at most `(2r + 1)^2` visits, about 4,200 at r = 32. Integer math and a fixed order keep it deterministic.
- The cap adds no reports and no log growth, because the client already reports every tile and keeps moves out of the tail (session.ts:284-305, 319).
- A refused report is dropped today (session.ts:296), so the client gains a snap-back to the kernel's `at`.
- **The charge is the path's octile length, from 2026-10-21 (NEXT 22 c).** The reach above stays four-way; the credit a report spends is `walkCharge` in `kernel/src/step.ts`: a four-way step costs `STEP_MILLI` (1000) and a step that turns off the one before it closes a diagonal pair for `DIAGONAL_PAIR_MILLI` (1414) the two. A free walk on a diagonal reports a staircase of single steps, and charging it by its four-way length drains the pool in about 15 s (32 / 0.41 steps), refusing an honest walk. A report of several steps pairs as many as its two axes share. Proof: `kernel/test/travel.test.ts` and `server/test/api.test.ts` (a 20 s diagonal walk passes; a jump of 3 tiles is refused).

### 1.3 Growth

**G57. The world grows by region files through the loop.**
- A new region is a data file: ground, the shared legend (G52), props, slots, its `borders`, and an `origin` that touches the world.
- It ships the way a season adds content, and what it adds stays (dec 688, 692).
- A shipped region is never removed, and a border only moves outward (dec 679: "The world must not run out").
- Creators fill its slots the way they fill the valley's (assemble.ts:369-376, 536-539).
- Map files are core-only today (s:1073; assemble.ts:175). Whether a creator's request may ask for new ground is D2.

**G58. Gates open by deed, never by date.**
- Entry past a crossing opens by a restore, in one of two ways:
  - by hand, the default ("A place opens when it is mended: the bridge is a restore step", SETTLEMENT 27);
  - as a quest step, through the quest's `reward.opens` (s:591-595). A restore with no inputs opens only that way (s:640-643; step.ts:722-726).
- Both run on today's kernel: a passable restore is the one solid tile that player state lifts (kernel/src/world.ts:174-189).
- Never a calendar date, a season clock or a real-time wait. The season decides when a region exists; the player decides when they enter it.
- A crossing is kept per player (dec 1064) and never closes again, so dec 1094 ("No way back is ever closed") holds through it.
- Once its gate is live, its line says what opens it ("The bridge is out. It could be mended.").
- Trait, skill and tool gates are not part of this draft:
  - They need WorldView (kernel/src/world.ts:149-152) widened at every place that builds walkability:
    - the walkable cache (step.ts:191-198);
    - 3D (game/src/play3d/world3d.ts:217);
    - the checks' own views (reach.ts:26; hazards.ts:53, 93; starts.ts:36; play.ts:460-473).
  - That is dec 1345-1346's "door that opens" question, and it is the owner's to answer.
  - A tool gate must also pass dec 1094. Tier-2 tools wear out (dec 423; `uses`, s:204-205), so a gate that is open only while a tool is carried can strand a player on the far side.
- No gate is a kit against cold or heat:
  - Cold and heat would be hazard kinds outside the closed list (s:62).
  - G34 answers a hazard with a run, never gear (GAME_RULES.md:345-347; check row 618; "Gear answer", 512; dec 508).

**G59. Growth never moves the opening.** *(One exception, the owner, 18.10: the core team may reshape the valley and improve the opening once, when the first ring is built, NEXT.md section 19; GAME_RULES section 6 holds its scope. The world lock is re-anchored at the end with the owner's yes, and G59 holds whole after.)*
- The opening rungs are tied to places (GAME_RULES.md:61-73), and an agent never moves a rung (570).
- The opening check (tools/src/starts.ts) gets new work. Today it only compares starts within an effort band (182-247). It will:
  - measure each opening leg's length in steps, 4-way;
  - compare each length with a committed world lock beside content/values.lock.json, which also holds each shipped file's origin (G50).
- A merge that lengthens a leg is refused. A deliberate change goes through a re-anchor command, with the owner's yes.
- starts.ts hard-codes `WALK_MS = 190` (23); it reads `walk_step_ms` from params instead.
- Bundle coordinates do shift when the frame grows, but the opening still never moves:
  - leg lengths do not depend on the frame;
  - layout and looks use grid-fixed coordinates (G52).
  - The lock guards it.

### 1.4 Travel

**G60. Walking is priced on foot from the nearest town, if D5 picks this model.**
- What V does today:
  - V is per item: the cheapest way to make it, over activity records (kernel/src/values.ts:1-11).
  - kernel-review 54 (V11) puts walking in V, but values.ts has no walk term.
  - Its effort tiers come from the verb and the item tier, not from distance (16-31).
- Proposed term, per source:
  - Count the 4-way breadth-first steps from the nearest town tile to that source's nearest instance, over static ground with every crossing open (gates never enter V, kernel-review 52, V9).
  - Take them there and back, times `walk_step_ms` (190, params.json:169-170).
  - Round down to a band of `walk_band_steps`.
- The walk is paid once per trip and spread over the trip's actions. Adding it to each action would multiply far values. How many actions a trip holds is part of D5.
- Under "cheapest", an item that also has a source near town keeps its near price, and a far source of it raises nothing.
- The walk stays out of active time t: check.ts:145-148 refuses t outside [t_min_ms, max_action_ms], and max_action_ms is 15,000 (params.json:34-35).
- Input path: ContentForValues has no map (values.ts:66), and computeValues runs without one (assemble.ts:263). So assemble passes in the stitched map's distance for each source.
- Band 0 covers the valley's farthest source, so the term starts at zero in the valley and its first merge moves no value.
- The price of band 0: inside the valley, spec 582's "a rare resource two steps from town is refused" stays unenforced. The term gives spec 542 and 582 a number only past the valley.
- This replaces the spec's own model, which puts distance into the effort tier's weight ("a long road" is medium, weight 0.6; spec 542, 546). D5 picks between the two.
- R11's drift budget (kernel-review 118) is live today: check.ts:40 and 445-468 check it against content/values.lock.json, with `drift_budget_permille` 100.
  - Past band 0, it refuses a merge that moves an existing value beyond the budget.
  - That is how a new town or road near old content is caught.

**G61. Shortcuts, fast routes and other gates come later, in this shape.**
- A shortcut is gated by a trait or skill and is measured in steps saved (like OSRS agility shortcuts). It needs G58's WorldView change and the owner's answer to dec 1346.
- A fast route is earned by walking to it once (WoW flight masters, BotW shrines).
  - It moves the person and not the basket (Valheim portals refuse ore).
  - It never shortens a wait (dec 1097).
- Whether either one enters V is part of D5. V11 says a new shortcut near the mine re-prices every mine item in one merge, caught by R11.
- Whether to add any is the owner's call when that stage comes. No stage in section 5 builds one.

### 1.5 Density

**G62. Pillar 1 gets a static check.**
- Pillar 1 carries its own test: "time the gaps in a recording" (GAME_RULES.md:35). That test stays the measure.
- This check is a proxy. It catches a map that cannot pass the recording test, before anyone records.
- The rule: no walkable tile may lie farther than `floor(pay_gap_ms / (2 x walk_step_ms)) + sight` steps (4-way) from a pay.
  - `pay_gap_ms` = 90,000 (pillar 1, GAME_RULES.md:33-35).
  - `sight` = 5. The fit keeps at least about 15 x 10 tiles in view (world.ts:2334-2344), so a tile 5 steps away is on screen. It needs no B2; it also equals B2's clear circle (dec 1267).
  - At 190 ms a step, that is 236 + 5 = 241 steps.
- A pay is one of these:
  - a live instance;
  - a slot;
  - a crossing;
  - a note that passes G8 ("A note no quest, treasure or character refers to is cut", GAME_RULES.md:112-114; check row 612).
- A sign or noted prop that fails G8 does not count; counting it would invite filler.
- The count is generous: a sign passed on the third walk is not new, and a node pays only when it is ready. The recording test catches what the proxy cannot.
- A stretch longer than half the cap gets a warning for review, because G5 wants "something to notice on the way" on each leg (GAME_RULES.md:97-98; "Double back" at :505).

Algorithm:
- Run one multi-source breadth-first pass, 4-way, from every pay tile over walkable tiles, with every crossing open.
- The largest distance found is the score. The check prints the worst tile and its file.
- The cost is linear in tiles.

**G63. Entering pays.**
- The first entry to a region or a named area shows its name.
- It counts on the exploration board (dec 678) only once brought home, like every find (G33, GAME_RULES.md:339-340; dec 1091).
- It counts as a pay for G62 at the region's edge.
- It is kept in the per-player seen list (G66), so a fall never fires it again.
- The banner is UI frame and words. So it goes to the owner as stills (NEXT:21; dec 378), and its words follow pillar 2 (GAME_RULES.md:36-37). See the smaller calls in section 4.

### 1.6 Danger

**G64. Danger rises with distance from town, area by area.**
- Each area carries `d` in 0..9: "Every area of the map carries a danger level `d`, from 0 in the town upward, set in the content and checked by the checker against the area's distance from town and the levels its nodes ask" (SETTLEMENT 70; scale at dec 590-598).
- No area carries one yet (GRUNT 1142, CR-38).
- A region only groups areas. Where d is stored is CR-38's build. This draft assumes an optional `danger` on `area` slots (G67), with ground in no area slot at level 1, wild (kernel-review 237).
- Level 0 holds the town, the opening's ground and the night ruins' entrance (dec 1141; SETTLEMENT 66). On level 0:
  - it is safe at every hour (G30, GAME_RULES.md:301);
  - the fire burns nothing (304-306);
  - it takes no hunting hazard (CR-88, GRUNT 1185; SETTLEMENT 71).
- Safety is read from the level and the fire, never set by hand (dec 1141).
- So the valley keeps both halves of the written rules. Its level-0 places stay safe, and its wild ground keeps its hunting hazards (the bank wolf and its round, #118). Stage 7 runs the check over every authored hazard.
- The check:
  - It runs one 4-way breadth-first pass from every town tile, with every crossing open. Town tiles are cobbles tagged `town` (isTownTile, danger.ts:136-138), not townAt's area slots (159-172).
  - It takes each area's distance to its nearest walkable tile.
  - It refuses a `d` more than one level off `floor(distance / danger_band_steps)`, except at the level-0 places above.
  - It also checks `d` against the levels the area's nodes ask, within the band dec 595 sets.
- The band defaults to one chunk, 64 steps, and is set together with `fall_walk_steps` (G65).
- The screen never shows d; the world does: thicker mist, tracks, bones, a sign at an area's edge (SETTLEMENT 72; dec 597).
- SETTLEMENT 71's hazard chance, `hazard_bp * d` per game minute, is a spawn model. Today hazards are authored props:
  - danger.ts:39-61 reads them from the map;
  - Chase.hazard is a prop id (kernel/src/state.ts:58);
  - the G34 checks iterate props (hazards.ts:180-208).
- Spawning would need ids in state, a seeded spawn and a lifetime: a kernel model of its own. This draft builds only the order check.

**G65. A fall never costs more than a set walk.**
- G33 is unchanged. A fallen player wakes in the town they were last in (GAME_RULES.md:334-335). That town is kept as `p.town`, which is set only on a town tile (kernel/src/step.ts:1004) and read by reappearTile (danger.ts:191-206).
- There is no per-region wake town. It could drop a player in a town they never reached, or past a crossing they have not opened.
- New: every walkable tile lies within `fall_walk_steps` (4-way, every crossing open) of a town tile.
  - A region beyond that carries its own town.
  - That town shortens a fall once the player has stood in it, which is G33 as written.
- A far town is a whole town, with a chest of the one store (SETTLEMENT 62; dec 1150).
- Crossings stay open once restored, so dec 1094's way back from a far town is the walk home.
- `fall_walk_steps` and `danger_band_steps` are set together:
  - Every tile lies within `fall_walk_steps` of a town, so G64 never allows more than `floor(fall_walk_steps / danger_band_steps) + 1`.
  - For d 9 to stay reachable (dec 677: the best pay sits far out and high on the scale; SETTLEMENT 97), `fall_walk_steps` must be at least 8 x `danger_band_steps`.
  - At a band of 64, that is 512 steps, about 97 seconds on foot.
- There are no waystations. A `safe: true` slot (danger.ts:156; s:930-935) is the hand-set flag that dec 1141 retires and CR-88 (GRUNT 1185) removes.
- A hunting ground far from a town still needs a safe place within a run (G34's check, hazards.ts:180-208). Far out, the lawful choices are:
  - a town, which pulls d down;
  - level-0 ground, which G64 refuses far out;
  - a burning camp, which is the player's own tent and which no static check can count on.
  - Which one applies is D4.
- There is one camp:
  - "The camp" is the first camp slot (kernel/src/world.ts:141-147; danger.ts:153).
  - CampBody.slot names a part of that one camp: fire, storage, workshop or shelf (s:658-676).
  - The player's camp is one flat list (kernel/src/state.ts:109).
- Outside a town, a camp is the player's tent: one at a time, pitched off the paths, with no chest (G30, GAME_RULES.md:306-308; SETTLEMENT 64; dec 506-510, 1150).
- So the stitch refuses a second camp slot. A camp in a far town needs a camp reference in the schema and state per camp; that is later work, outside these stages.

### 1.7 Reveal

**G66. Mist is not a border.**
- The mist (one mist, kept by the kernel per area, dec 1143) hides land that can be walked. A border is ground that cannot be walked.
- No walkable tile is ever drawn as a border, and a border is never only mist.
- The mist draws back as places are restored (dec 1263).
- Reveal is stored per region and per area, by id, never per tile, in a per-player seen list of its own in the state (G67).
- It cannot ride the visit list:
  - visit() refuses an id that is not a slot (kernel/src/step.ts:858-861);
  - adapt keeps only visited ids that are map slots (session.ts:465);
  - fall() undoes an outing's first visits (step.ts:1083).
- A tile bitmap of the full grid would add 128 KB to every save.
- A map screen, when one exists, shows the regions seen.

### 1.8 Schema

**G67. Additive only; FORMAT_VERSION stays 1.**
- Every field below is optional, and an old file reads the same, so nothing is bumped (s:15-16).
- `MapBody` stays `additionalProperties: false` (s:1003), with these keys added.
- `MapBody.spawn` (s:1000) becomes optional. The check requires it in the valley's file and refuses it elsewhere.
- TILE_TAGS (s:66) gains `void`. When a closed list grows, every old file still reads the same.
- ParamsBody (s:773-891) is closed, and every field in it is required today. So each new param is optional, with its default in the Params interface (kernel/src/bundle.ts:51-99), and params.json sets it. Params are core-only (s:1073).
- Chunks are not schema (G51).
- The save's `frame` is a save-format change, migrated by `adapt` (WORKFLOW:39; G52).

```ts
// MapBody, all optional
origin?:  { x: Int(0,1023); y: Int(0,1023) }   // G50: where this file sits in the grid; fixed once shipped
borders?: Array<{                              // in the file's own coordinates
  kind: 'fog' | 'forest' | 'river';
  x: Int(0,1023); y: Int(0,1023); w: Int(1,1024); h: Int(1,1024); // the band, all solid
  far?: { x; y; w; h };  // river only: the seen bank (G55)
  crossing?: Id;         // the core restore slot that opens it (required for a river)
  says?: Name;           // the bump line (G53)
}>
// spawn: now optional; only the valley's file carries one (G52)

// Slot, kind 'area' only
danger?: Int(0,9)        // G64: the area's d; ground in no area slot is level 1

// RestoreBody
shut_until?: Id          // G55: the region file that must ship before this restore can be done

// StarterBody.wake
map?: Id                 // G52: the file whose coordinates wake uses; left out, the valley's

// TILE_TAGS: add 'void' (G52)

// ParamsBody, each optional with a default
move_reach_max?, walk_band_steps?, pay_gap_ms?, danger_band_steps?, fall_walk_steps?

// Bundle map: frame?: { x; y }                      the stitched min corner, snapped to the chunk grid (G52)
// Bundle map: regions?: Array<{ id; x; y; w; h }>   each file's rect after the stitch (G63, G66)
// State:      frame?: { x; y }                      absent = the valley file's own coordinates (G52)
// State:      seen?: Id[]                           regions and areas entered, per player (G66)
```

## 2. Where it meets the existing rules

| Existing rule (file:line) | New rule | How it meets | Resolution |
|---|---|---|---|
| Pillar 1, "something new they can see at least every ninety seconds", with its own test, "time the gaps in a recording", GAME_RULES.md:33-35 | G62 | Supports; hole: no static check (no row in the check table, :608-628, and no pass in tools/src/check.ts:29-49) | G62 adds a static proxy; the recording test stays the measure |
| Pillar 5 (:45-46), G5 "No empty leg" (:97-98), "Double back" (:505) | G62, G59 | Supports; hole: no check | The half-cap warning in G62; G59's leg lengths let starts.ts test that each opening leg passes a pay |
| G8, a note no quest, treasure or character refers to is cut, :112-114, check row :612; "Free read", :499 | G55, G62 | Collides if signs and noted props count as pays, or if a shut crossing says it could be mended | Pays are instances, slots, crossings and notes that pass G8; a shut crossing's line says only what is true |
| Pillar 3, "A counter is not a question", :40-41 | Section 4, region checklist | Collides with a checklist of finds | No checklist; finds count on the exploration board |
| Pillar 4, objects change where you can go, :42-44 | G55, G58 | Supports; it makes no promise about far banks | Every river border names a crossing; "a seen bank opens" is a new rule |
| Opening rungs, :61-73; an agent never moves a rung, :570 | G52, G59 | Collides if growth moves the valley | Leg lengths are frame-free, layout and looks use grid-fixed coordinates, and a world lock freezes the legs |
| G7 :106-108, G22 :226-232; "The valley is the hero", STORY 35; "An extension is a fold, or a corner of one", STORY 38; a fold is an age of the valley, STORY 19-21 | G57 | Hole: may a fold bring ground past the valley's edge? | D3 |
| G26, the ambience carries the place, :265-268; G27, "Nothing important lives only in sound", :269 | G57, D1 | Hole: no sound beds for a new region | Section 3, region sound; sound never stands alone (D1 option 3) |
| G30: the town and level-0 ground are safe at every hour (:301), and the fire burns more the deeper the area, none at level 0 (:304-306); level 0 holds the opening's ground and the night ruins' entrance (dec 1141; SETTLEMENT 66) | G64 | Collides if d sits on a region: a d-0 valley is safe throughout, and a d-1 valley loses its level-0 places | d on areas; the town, the opening's ground and the night ruins' entrance stay at 0 |
| The safe flag is read from the level and the fire, never set by hand (dec 1141); CR-88, no hunting hazard on level-0 ground (GRUNT 1185); no hazard at level 0 (SETTLEMENT 71) | G64, G65 | Collides with waystations as `safe: true` slots, and with the merged hazards of a d-0 valley | No waystation flag; d on areas; the far safe place is D4 |
| G31, countdown outside safe ground, :315-322; dark 20:00-05:00, :310 | G64, G65 | Hole: trips longer than one night | The player's tent (section 3) |
| G33: wake in the town last stood in (:334-335); a find counts only once brought home (:339-340; dec 1091); the basket (:343-344) | G52, G63, G65 | Collides three ways: a per-region wake town, a first-entry count before home, and falls that cost more far out | No per-region town; G63 counts once home; every tile within `fall_walk_steps` of a town; save repair is placement, never a fall |
| G34: a run, never gear (:345-347); deep water is the river without its bridge (:352-353); no schema field names an item as a hazard's answer (check row :618); "Gear answer" (:512); dec 508 | G54, G55, G58, G65 | Collides: a deep-water border can be crossed by day, a predator on a far bank is an error, and a kit gate or a cold or heat kit is a gear answer | Border rivers are solid `~`; deep water only at crossings; far rects hold no hazard; no kit gates; the far safe place is D4 |
| G30 check row: a pit, trap or deep water that is solid fails, :616 | G54 river | Supports | Border water is `~` ground, never a deep-water hazard |
| G36, G37, G49, expeditions, :384-398; G36 row, no hazard inside its place, :619; G47 row, a round that touches safe ground is refused, :621 | G51, G57, G64 | Supports once d sits on areas; a d-0 valley would refuse the merged bank wolf's round and the first expedition | An expedition stays inside one region and exits there; its place is an area slot and its exit a safe slot (NEXT:274) |
| Section 6, an idea that is fun but delays a payoff goes to the owner, :532-571, :561 | G62 | Supports: the delay becomes measurable | Content over the cap goes to the owner as the six-line note |
| Phone budget, "Not written ... Measure on a real device first", :488; dec 8 | Stages 5, 6 | Hole | The device measure gates stage 5 |
| dec 30-33, travel checked from stage 2a; NEXT:29; dec 94-97, the walk-over moves into the kernel at stage 2a | G56 | Collides only if bands must hold against an edited save before stage 2a | G56 is stage-2a work, and the walk-over moves with it |
| A stump blocks its tile as the tree did (dec 527, 1172); town trees are not felled (dec 528); no dead props (dec 1300); "a grove must never wall the map", tools/src/reach.ts:2-5 | G54 forest, G55 | Collides if a band is made of tree nodes | Solid `T` only; the check refuses a node in a band; far-bank props obey dec 1300 |
| Only a clearing quest uproots a tree for good, dec 527 | G54 forest, G58 | Supports | A forest crossing is a restore that a clearing quest opens |
| One mist, kept per area, dec 1143; GRUNT 1186 (CR-89) | G54 fog, G66 | Collides if the fog is a second layer | Bands are the one mist thickened, drawn from `borders` only |
| B2: 5 tiles clear, then 6 tiles denser, at least 90% at the border, dec 1267; told before anyone builds, 1269; not built, world.ts:988 | G54, G62 | Collides: fog bands need B2's edge, and a wide river leaves the clear circle | B2's edge is built first (stage 5); `sight` rests on the view, not on B2; border water at most 4 wide; more sight is D1 |
| The mist draws back with each restore, dec 1263 | G66 | Supports | Reveal follows restores |
| dec 380: the retry when a device cannot hold the full-map canvases at four frames is a quality level picked by measurement; world.ts:529 | Stage 5 | Collides above about 10x today's area | A paged bake, put to the owner as a new answer beside dec 380's |
| 3D is a second door and the classic game never waits for it, dec 1339-1342, NEXT:187; parallel-3d has no owner, docs/team/streams.json | Stages 5, 6 | Supports 2D first, but 3D shows a border from far off | Edge fog, void and the seam land with the first border; the rest at 3D's pace; stage 6 needs an owner |
| Direction by stills first, dec 378; NEXT:21 names art style, camera, character look and UI frame; visual changes start with criteria the owner can measure, WORKFLOW:41 | D1, G54, G63 | Supports the process | Landmarks, the edge's look and the banner go as phone stills with criteria |
| Exploring is the common task, dec 672-679; the best pay is far out and high on the scale (677; SETTLEMENT 97); seasons add content and it stays, dec 688, 692 | G57, G64, G65 | Collides if G65 caps the scale | `fall_walk_steps` at least 8 x `danger_band_steps` |
| Progress per player, like WoW phasing, dec 1064 | G55, G58 | Supports | Crossings open per player |
| Sleep only in a town or at a burning camp, dec 1093; "No way back is ever closed", dec 1094; nothing shortens a wait, dec 1097; tier-2 tools wear out, dec 423 | G58, G61, G65 | Collides with tool gates | Restore gates only, never closing; fast routes never shorten a wait |
| One camp, the first camp slot (kernel/src/world.ts:141-147; danger.ts:153); outside a town, a tent, one at a time, with no chest (SETTLEMENT 63-64; dec 506-510, 1150) | G65 | Collides with "the nearest camp" and with camps on roads | One camp slot, checked; long trips use the tent |
| A store chest in each town, SETTLEMENT 62, dec 1150 | G65 | Supports | A far town is a whole town, chest included |
| One restored town and one area (G-1), spec 383; "one area" in the risk table, spec 798 | G57 | Collides | The one-map parts harden today's map; a second region file is the owner's go, and spec 383 already calls it an extension |
| An empty slot is a ruin or fog "awaiting restoration", spec 211, 448 | G54, G55 | Collides: fog that never lifts and a shut crossing would both read as restorable | The grid's edge gets its own look; a crossing is shut by a gate |
| Creators add extensions, areas included, spec 107; area is a slot type creators restore, spec 448; slot requests, spec 449; each area has its own character, joined by the base tone, spec 215, 220-221 | G57 | Supports, with one open question | D2 |
| Walking is part of V, and a new shortcut re-prices (kernel-review 54, V11); gates never enter V (52, V9); the drift budget (118, R11; check.ts:445-468); distance in the effort tier (spec 542, 546, 582) | G60, G61 | Hole and collision: values.ts has no walk term, and G60 keeps shortcuts out of V and replaces the spec's tier weight | D5 |
| Danger d by area, SETTLEMENT 66, 70-72, dec 590-598; none built, GRUNT 1142 (CR-38) | G64 | Hole | `danger` on area slots and the order check; the spawn model later |
| One map file, assemble.ts:212-214; one MapDef, kernel/src/bundle.ts:49, 154; `map` is core-only, s:1073, assemble.ts:175; errors blamed on the one map's id, hazards.ts:87, deadprops.ts:28, assemble.ts:549 | G50, G52, G57 | Collides by design | Stitch with `origin`; a tile-to-file index for errors; core-only until D2 |
| The tag hashes all content (assemble.ts:260-261; step.ts:216), and `adapt` keeps what still exists on any change (session.ts:175-179) | G52 | Hole: `adapt` knows no frame | A frame in the save; `adapt` shifts every coordinate |
| `adapt` never touches `at` (session.ts:434-475); load tests only `pos` and falls back to spawn (:188-192) | G52 | Hole | A frame shift, a walkable test and one placement for both |
| Node layout on x + y even (kernel/src/world.ts:104; tools/src/starts.ts:99); look hashes by bundle coordinates (world.ts:552, 665, 794, 1051; scenery.ts:131-140) | G52 | Collides when the frame grows west or north | Frame snapped to the chunk grid; grid-fixed coordinates counted from the valley's origin |
| Reach only compares with and without trees, reach.ts:56-59 | G53, G55 | Hole: an unreachable slot passes | Every slot must be reachable from a wake place, with every crossing open |
| Movement is four-way, dec 1337, game/src/input.ts:6-14 | G53, G56, G60, G62, G64 | Supports | Every search is 4-way; a 1-tile band holds |
| The maze, and its retry when it needs a door that opens, dec 1345-1346 | G53, G58 | Collides if bands must be 2 thick (its south wall is 1) or if gates need a door | 1-tile bands; restore gates only; other gates wait for that question |
| WORKFLOW:38-49; CODEOWNERS; the open claim on world.ts, NEXT 14b (:280-284), with 13b (:263-267) merged as #120 | Stages 1-7 | Collides | Section 5, "What must change in protected sources" |
| Chunks resident around the player and a far ring, world-notes.md:11-13; walkable by slope, :9-10 | G51 | Supports the ring; collides on walkability | Take the ring; keep the kernel's tile walkability |

## 3. Holes closed by analogy

Each item is a hole the rules leave, closed the way a known game closes it. Items that turned out to be calls have moved to section 4.

1. **A bump line on every border.** A band says why it stops you. Once its crossing is live, it also says what would open it, like the OSRS doors and gates that name what is missing. Never a silent wall (G53).
2. **Region sound.** Each region names its own ambience beds, played with its name on first entry, like OSRS music per region (G26, and dec 1369-1371's three beds by distance). Sound never carries anything alone (G27, GAME_RULES.md:269).
3. **Falls far from home.** A far region has its own town. A fall wakes the player there once they have stood in it, like a WoW hearthstone bound at the last inn (G33, G65).
4. **Night on long trips.** The player pitches their own tent, one at a time and with no chest (SETTLEMENT 64; dec 506-510), and sleeps there or in a town (dec 1093). This is like Valheim beds, which the player builds and places (G65).
5. **A save on a tile that turned solid.** The player is placed in the town they were last in, never put through a fall. WoW does the same when it moves a player out of a reset instance to its entrance (G52).
6. **Map reveal by area, not by tile.** Like WoW zone maps, which uncover by subzone (G66).
7. **The grid's outer edge.** Fog that never lifts, with a look of its own, like Valheim's world-edge waterfall and the OSRS ocean (G54).
8. **Gates are mends, not keys.** A mended bridge, a ferry post put back, a thicket cleared by a clearing quest (dec 527). This is like OSRS Priest in Peril, a quest that opens the way past the Salve (G58). No gate is a tool or kit the player must carry.
9. **Expeditions in other regions.** The entrance and the exit sit inside the same region, and the last-bell walk-out (G49) ends there, like WoW instance portals that sit in their own zone.

## 4. Direction calls for the owner

**D1. How far the eye reaches past the clear circle, and how the world's edge looks.**
- NEXT:21 names art style, camera, character look and UI frame; it does not name borders or fog reach.
- A landmark layer and the edge's look are still looks. So they go to the owner as stills first (dec 378), with criteria the owner can see and measure (WORKFLOW:41).
- B2 and one mist are settled (dec 1267, 1143) and stay in every option.

1. **Recommended:** add one landmark per region, drawn above the mist (a light, smoke, a tower top). Show it first as two or three phone stills, together with the grid edge's own look. Why: long walks need a goal the eye can hold (BotW towers, the WoW skyline), and B2 and one mist stay as picked.
2. B2 only: a narrow river carries the seen far bank, and nothing else is seen from afar. Why not first: beyond the valley, the only thing pulling a player along a long walk is the next pay.
3. Landmarks by sound: a far bell or a fire heard before it is seen, on the distance beds (dec 1369-1371). Why not first: nothing important lives only in sound (G27, GAME_RULES.md:269), so sound can join a seen landmark but cannot stand in for one.

A river wider than 4 tiles waits for this call (G54).

**D2. May a creator's slot request ask for new ground?**
- Creators may already restore `area` slots (spec 448) and request new slots (spec 449). So spec 107's creator areas arrive without opening map files.
- Spec 215 and 220, and STORY 38-40, welcome each area's own character.
- Spec 221 keeps only what connects areas in the base tone: roads, core characters, UI and journal text.
- Map files are core-only today (s:1073).

1. **Recommended:** yes, inside a region the core has framed. The core keeps roads, borders and crossings. A request may ask for ground inside that frame once the new checks have run on one core region. Why: what connects areas stays in one hand (spec 221), and the edge, band, density and danger checks meet real content before anyone else draws ground.
2. No: creators fill and request slots, and all ground stays with the core. Why not first: every region then waits on the core's drawing, and creators' areas stay inside ground drawn for them.
3. Region files open to creators as soon as stitching lands. Why not: roads, borders and crossings would leave the hand that keeps the base tone before the new checks have met real content.

**Owner's word, 18.10.2026** (to the art session, asking for the style spec): "users will be able to change existing areas, even completely." It widens the 17.10 answer (DECISIONS 2026-10-17, "the world has no end": creators grow the world, in a frame set when that stage comes) from new ground to ground that already exists. It leaves two things open. They are asked when stage 3 opens, before any frame is written:
- Who "users" are: creators, through pull requests as today, or players inside the game. Players changing ground touches the paused houses and plots (DECISIONS 2026-10-10).
- Whether the hand-made valley is among the areas that may change. G59 and the 17.10 entry keep it hand-made at the centre; the 18.10 exception lets the core team reshape it once for the first ring, and the owner's frame for it is picked at NEXT.md section 19 step 0.
Nothing is built on it until then. Its art side (grounds and height carried as data) is in the style spec, `docs/design/STYLE.md` section 8.

**D3. May a fold bring new ground past the valley's edge?** Decided 16.10.2026 by the owner: option 3.
- The frame is written and stays: "The valley is the hero" (STORY 35), and "An extension is a fold, or a corner of one" (STORY 38).
- A fold is "one age of the valley that the mist folded away" (STORY 19-21): an age, not a place.
- So the open question is where a fold's ground may lie.

1. **Recommended:** a fold may bring ground past the valley's present edge, read as the valley's own land that the mist had folded away. G7 and G22 then read "the valley" as all the ground the mist gives back. Why: no rule or rung is rewritten, and the world can grow past 48 x 49 tiles.
2. A fold is always found inside the valley's present ground: an interior, a layer under the ruins, an older face of a known place. Why not first: the world then grows only inward, and this draft's regions, borders and crossings have nothing to open onto.
3. The valley becomes the first region of a named land, and each region carries its own small story (OSRS kingdoms, WoW zones); G7 and G22 become "the region's". Why not: it reverses STORY 35 and 38 and rewrites the ladder's frame (GAME_RULES.md:61-63).

**D4. What is a safe place far from a town?**
- G34's check needs a safe place within a run of every hunting tile (hazards.ts:180-208).
- Far out, none of the current choices works:
  - a town pulls d down (G64);
  - the order check refuses level-0 ground;
  - a burning camp is the player's tent, which no static check can count on.
- dec 1141 retires the hand-set safe flag.

1. **Recommended:** a level-0 pocket. This is a small authored area at level 0, like the night ruins' entrance (dec 1141), with no store and no chest. The order check excepts it by name. It adds a third exception to SETTLEMENT 66's list. Why: safety stays read from the level, as dec 1141 wants, and the check can count on it.
2. The player's tent: the run check assumes a tent can be pitched off the paths anywhere far out. Why not first: a static check cannot know a tent is up, and a player with no tent or no wood has no safe place.
3. No hunters far out. Far danger is the hour, food, pits, traps and deep water, and predators stay within a run of a town or level-0 ground. Why not first: the high levels keep only the hazards that need no run, a thinner scale than dec 677 promises.

**D5. How walking enters V.**
- V11 (kernel-review 54) puts walking in V. It lets a new shop or shortcut near the mine re-price every mine item in one merge, caught by R11.
- The spec puts distance into the effort tier's weight ("a long road" is medium, weight 0.6; spec 542, 546).
- Spec 582 refuses a rare resource two steps from town.

1. **Recommended:** G60's banded walk term per source: zero inside the valley, paid once per trip, with shortcuts and fast routes kept out of V. Why: one number, checked in one place, and R11 catches a new town or road. Cost: it departs from V11 for shortcuts, and spec 582 stays unenforced inside the valley.
2. The spec's model: distance picks the effort tier (spec 542, 546), and R11 catches a re-tier. Why not first: tiers are coarse, so a road that halves a walk moves no value until it crosses a tier.
3. Not yet: V keeps no walk until a second region ships. Why not: the first far content would be priced as if it sat in town, and R11 would hold that price against any later fix.

**Smaller calls.** Each goes to the owner on its own. The first four were listed in section 3 as analogies before.
- **A region checklist.** A list of finds to tick off is the counter that pillar 3 rules out ("A counter is not a question", GAME_RULES.md:40-41). Recommended: none; finds count on the exploration board (dec 678).
- **The discovery banner** (G63). It is UI frame and words (NEXT:21; pillar 2, GAME_RULES.md:36-37). Recommended: two or three phone stills first.
- **Caves and interiors.**
  - They are planned only on the 3D track, as GLB scenes behind portals (docs/3d/world-notes.md:22-29).
  - In 2D they need a kernel portal, which is dec 1345-1346's question.
  - The shop interior exists as stills only (dec 1333).
  - Recommended: leave both until that question is asked.
- **Region size.** The earlier 64 x 64 region copied a 3D example (world-notes.md:11-13). Recommended: chunks fixed at 64 tiles, regions sized by their content.
- **Trait, skill and tool gates, and shortcuts** (G58, G61). This is dec 1345-1346's "door that opens" question, with dec 1094 as the bar.
- **A second camp**, in a far town (G65). It needs a camp reference in the schema and state per camp.
- **The spawn model** for SETTLEMENT 71's `hazard_bp * d` (G64).

## 5. What it costs

| Stage | What | Code | Phone hardware |
|---|---|---|---|
| 1. Schema | `origin`, `borders` and an optional `spawn` on `MapBody`; `danger` on area slots; `shut_until` on restores; `map` on a starter's wake; the `void` tag; five optional params; `frame` and the file rects on the bundle map; `frame` and the seen list on the state (G67) | About 120 lines, plus 80 of tests | None; the bundle grows by a few KB |
| 2. Tools checks | First the speedups the readers named (about 150 lines): in reach.ts, a tile-to-slot index and one walkable build (slots x tiles today, 42-44, with makeWalkable rebuilt per call, 25; the unfixed pass is about 1e9 `near()` calls at 50x); in hazards.ts, a safe-tile bitmap and `Uint32Array` distances (map area x slots today, 51-76); in starts.ts, one walkable build, no `unshift` (34-56) and `walk_step_ms` read from params (23). The expedition one-way-in check is a local scan and needs nothing (play.ts:458-498). Then the new checks, all 4-way: edge and bands (G53); no node in a band (G54); far bank, crossing and core-only crossing slots (G55); every slot reachable; one camp slot (G65); the world lock with its re-anchor command (G50, G59); density (G62); danger order (G64); the town distance (G65) | About 700 lines, plus 350 of tests | None; it runs in CI only, each check a few linear passes, about 1M tile visits at the full grid |
| 3. Kernel | The shut-crossing gate (G55, about 30 lines); save placement through reappearTile's town pick (G52, about 40); the seen list (G66, about 40); the walk term in V with its input from assemble, only if D5 picks it (G60, about 150). No per-chunk lists: strike, isSafeGround and townAt stay linear in hazards and slots, which is fine at 50x. Reading d in the kernel (the fire, safety by level) is CR-38's and CR-88's own build (GRUNT 1142, 1185) and is not counted here | About 260 lines, plus 200 of tests | Walkability is one byte a tile (2.3 KB today, 1 MB at the full grid) |
| 4. Stitcher and saves | Several map files in `assemble`: the G52 algorithm, the shared legend and the tile-to-file index (about 350 lines). The valley's origin ships here. `adapt` shifting `at`, `pos` and the tail, with one placement for adapt and load (session.ts, about 80). Grid-fixed coordinates for node parity and look hashes (about 40). Loading per region (about 200) | About 670 lines, plus 250 of tests | Both clients import the bundle statically (game/src/main.ts:5; game/src/play3d/main.ts:10). The map alone is about 1 MB at 50x and about 9 MB at the full grid. Today it is about 21 KB minified (ground 2.8 KB, props 13.8 KB, slots 3.7 KB), plus the instances layoutInstances adds (assemble.ts:262). Loading per region must land before the bundle passes a few MB, well before the full grid |
| 5. 2D client | B2's edge, told to the owner first (dec 1269), and fog bands from `borders` as that same mist (about 150); a paged ground bake (32 x 32 tile pages, 3 x 3 kept loaded) or a culled Tilemap layer (about 350); per-chunk object lists and culling for everything that grows with the world today: create (world.ts:339-397), the per-frame loops (1292-1422), TileZone's scan every 250 ms (202-213), arrive's loop over every slot (1572-1598) and the HUD's fire warning, a loop over every prop that the HUD runs every 500 ms (game/src/ui/ui.ts:215, 247, 317-323; game/src/fires.ts:78) (about 300); camera bounds and the title pan from data instead of `22*T, 15*T` (world.ts:387, 1491-1492, about 30); the bump line and the discovery banner (about 120); the landmark layer only if D1 picks it (about 80) | About 1,030 lines, plus e2e | Today about 1 KB per tile per frame (2.3 MB a frame). The whole-map bake holds up to about 150 x 150 tiles (about 22 MB a frame) and stops at 256 tiles a side (the 4096 px texture limit, 64 MB a frame). Paged, it is a fixed 9 MB a frame, 36 MB at four frames, whatever the world size. Gate: a measure on the reference phone (dec 8, 380) |
| 6. 3D client | With the first border: edge fog as vertical cards or a distance-to-border term, since `FogExp2` only measures distance from the camera (about 100); a void kind (about 20); the river seam, with the water plane continued past the map edge or an end cap (scenery.ts:764-780, about 60); the bridge from data instead of `'core/old-bridge'`, which is hard-coded three times (scenery.ts:128, 689; world3d.ts:580; about 40). At 3D's own pace: chunked indexed terrain with two or three detail levels, per-chunk instancing and a far ring (world-notes.md:11-13, about 700) | About 920 lines | The view reaches far: far plane 160 (world3d.ts:221), zoom 4-18, pitch 0.62 (49-51), and `FogExp2` at 0.009 by day leaves about 37% fog at 75 tiles (scenery.ts:739). So a band, the far rect's back edge, the map-sized water plane (774-780) and the 400 x 400 skirt (764-768) all show. Today one non-indexed mesh of W x H x 6 vertices, about 14k, and 1.57M at 512 a side. An indexed 64 x 64 chunk is about 4,200 vertices, about 38k for 3 x 3. Gate: world-notes.md:40-41 (3 x 3 chunks, 20 characters, 60 fps on the reference phone); the lite switch at a median frame over 50 ms (lite.ts:7-12) |
| 7. Content | The core map: its `origin` (shipped with stage 4); its `T` ring and the maze's south wall as 1-tile forest bands; `danger` on its area slots, with level 0 for the town, the opening's ground and the night ruins' entrance, and the order check run over every authored hazard; a G62 pass. The river's two map exits become fog bands only once both clients draw `borders`. Then the first river border, with a far-bank stub and a shut crossing | JSON only | None |
| Later, with the project's stage 2a (dec 30-33) | The move path check (G56): the 4-way search over moves and action tiles, the walk-over moved into the kernel (dec 94-97), and the client snap-back | About 160 lines, plus 120 of tests | At most about 4,200 tile visits per move at r = 32 |

**Order:**
1. Stage 1.
2. Stage 2 (speedups first), with stage 7's forest bands and in-valley levels.
3. Stages 3 and 4, with the valley's origin, once D3 opens ground past the edge.
4. Stage 5 and stage 6's border work.
5. Stage 7's fog bands and the first river border.

Stage 6's chunked terrain moves at its own pace (dec 1339-1342), and its seam and bridge fixes can go first. The move path check waits for stage 2a.

**What must change in protected sources:**
- WORKFLOW:38-49 says who owns each part:
  - Content format (39): "A format change needs a migration or must stay backward compatible with saves". G67 stays additive, and `adapt` migrates the save's frame.
  - Look (41) covers world.ts and style.css: "Visual changes start with criteria the owner can see and measure". B2's edge, fog bands, the edge's look, landmarks, the banner and the paged bake each carry such criteria, shown in stills first.
  - Rules of play (49): GAME_RULES.md and tools/src/play.ts are the owner's page. G50-G67 and their check rows go in only with the owner's yes (section 6). The new checks live in their own files under tools/src and are wired in check.ts.
- CODEOWNERS gives every path to the code owner except the creators' folders (content/extensions/, and content/kit/ outside kit/core).
  - So every stage needs the code owner's review: kernel, schema, tools and content/core as well as game/.
  - The void sprite goes into content/kit/core under that review.
- The open claim on game/src/scenes/world.ts (NEXT; docs/team/streams.json) is 14b, feat/night-ruins (NEXT:280-284). Sections 11 (#97), 12b (#118) and 13b, feat/tending (NEXT:263-267), are merged; 13b landed as #120.
  - Stage 4's hash change and stage 5 merge after that stream or together with it.
  - Stage 5 touches the bake (world.ts:525-599), the camera bounds (387), the title pan (1491-1492), the fog path (893-924), the mist (988) and the RICH flag in game/src/config.ts (25-63).
- CRAFTING_AUDIT.md:270 and 314 bind only the crafting waves, and all four waves are built (329). They hold nothing back.
- `content/core/map.json` and params are core-only (s:1073).
- dec 380's remedy is a quality level picked by measurement. The paged bake is a new answer, to be put to the owner beside it.
- The 3D stream (parallel-3d) has no owner (docs/team/streams.json), so stage 6 needs one.

**What can start with no direction call:**
- The parts that harden today's one map:
  - stage 1's `borders`, `danger` and params;
  - stage 2's speedups and the checks of G53, G54, G59 and G62, plus the reach and single-camp checks;
  - G64 inside the valley, whose level-0 places come from dec 1141;
  - stage 6's seam and bridge fixes;
  - stage 7's forest bands and in-valley levels.
- These serve only ground past the valley's edge, so they start once D3 says yes (D3 is decided, option 3, so they can start):
  - stage 1's `origin`, `frame`, `shut_until`, the wake's `map` and `void`;
  - G55's checks;
  - stage 3;
  - stage 4.
- G64 far out and G65 wait for D4 and the two params set together.
- G60 waits for D5.
- D1 holds the landmark layer, the edge's look and any river wider than 4 tiles.
- D2 holds creator ground.
- The second region's names, words and own story wait for the story frame's rewrite under D3's option 3.
- The second region itself is the owner's go (spec 383, 798).
- Stage 5 waits for the phone measure and the open stream on world.ts (14b), not for a call. B2's edge is told to the owner first (dec 1269).

## Revision notes

R1.n is review 1 (rules), item n; R2.n is review 2 (feasibility), item n. Line numbers in these notes are at 2719343; the last note lists what moved at dac7bdf.

- R1.1 applied: d moved from regions to areas (G64, G67), and level 0 kept for the town, the opening's ground and the night ruins' entrance. Rows added for G30, dec 1141, CR-88, CR-89, and SETTLEMENT 66 and 71. SETTLEMENT 70 is now quoted in full, including the levels its nodes ask.
- R1.2 applied with a nuance: the cap is `floor(fall_walk_steps / danger_band_steps) + 1`, so the two params are set together (G65); a far town pulls d down rather than forcing 0. The far safe place became D4, and the new params are listed in G67.
- R1.3 applied: waystations and the per-region wake town dropped, with G33 kept as written. One camp slot, checked. Section 3 item 4 is now the player's tent.
- R1.4 applied: "kit carried", the cold or heat kit and section 3 item 11 cut, and a G34 and "Gear answer" row added. dec 388 is not cited, since it concerns crafting sets.
- R1.5 applied with a correction: a quest-step gate needs no kernel change, because a restore with no inputs opens through a quest's `reward.opens` (s:591-595, 640-643; step.ts:722-726). Trait, skill and tool gates are left to dec 1345-1346 and dec 1094. The felled-tree analogy was removed.
- R1.6 applied: the tree claims corrected (dec 527, 528, 1172; kernel/src/world.ts:159-160, 170-173). "No node in a band" now rests on reach.ts:2-5, dec 1300 and kernel/src/world.ts:104.
- R1.7 applied: D1's option 3 is now sound, held back by G27, and D2 and D3 ask the questions the review named. Section 3 items 6, 7, 13 and 14 moved to the smaller calls. "What can start" was rewritten.
- R1.8 applied: the interim fog band dropped (G54).
- R1.9 applied: every search is 4-way, bands are 1 tile thick, and the maze is untouched.
- R1.10 applied: G60 rewritten per source and paid per trip, outside t, with R11 live. The spec's tier model and the valley's spec 582 gap are named, and the choice is D5.
- R1.11 partly applied:
  - Applied: G56 tied to stage 2a, the walk-over moves with it, the kernel's own moves start the next search, and the load fallback is unified.
  - Rejected: the last bullet. The client already reports every tile and keeps moves out of the tail (session.ts:291, 319), so a cap adds no report.
  - Kept from its point: actions set `at` with no travel check (checkAt, step.ts:1104-1112), so the search covers them.
- R1.12 applied: pillar 1's recording test kept as the measure, and pays limited to instances, slots, crossings and notes that pass G8. G63 counts only once brought home.
- R1.13 applied:
  - `adapt` shifts `at`, `pos`, the tail and a tent;
  - repair is placement only, with one fallback;
  - `spawn` lives only in the valley's file;
  - `wake` names its file;
  - void gets a tag;
  - the "every edit invalidates every save" row was corrected.
- R1.14 applied: the grid's edge gets its own look, and a crossing is shut by a gate whose line promises nothing.
- R1.15 applied: CRAFTING_AUDIT is no longer treated as binding. The open claims are 13b and 14b, CODEOWNERS covers every stage, and the paged bake is a new answer beside dec 380.
- R1.16 applied: every listed line rebased, and the deep-water check row moved to G30's (616). The numbering holds, since no G50 exists yet.
- R1.17 applied:
  - "region" redefined;
  - SETTLEMENT 70 quoted verbatim;
  - the far-bank promise stated as a new rule;
  - isTownTile and townAt kept apart;
  - leg lengths named as new work;
  - GAP_WOW_RS dropped.
- R2.1 applied with two corrections: there is no interim, and void gets a tag, a kit sprite and a 3D kind. TILE_TAGS is at s:66, not 65. The sprite goes to content/kit/core under the code owner's review, because CRAFTING_AUDIT.md:270 binds only the built crafting waves.
- R2.2 applied with one refinement: the frame is snapped to the chunk grid, and parity and hashes use grid-fixed coordinates counted from the valley's origin, so shipping that origin changes no look.
- R2.3 applied:
  - placement goes through reappearTile's town pick, not fall();
  - `adapt` shifts `pos`, the tail and `at`;
  - the valley's origin ships with stage 4;
  - a save with no frame holds the valley file's coordinates;
  - a shipped origin never changes.
- R2.4 applied except one point: quest gates need no WorldView change (see R1.5). The WorldView cost of other gates is listed in G58 and left out of the stages.
- R2.5 applied: "the nearest camp" dropped and one camp slot checked. A second camp is a smaller call.
- R2.6 applied: `wake` names its file, and `spawn` is optional except in the valley's file (s:1000, not 999).
- R2.7 applied: 4-way moves, 1-tile bands, G56 at stage 2a, and a client snap-back. The decision is at dec 30-33, not 29-31.
- R2.8 applied: core-only crossing slots, a `shut_until` gate on the restore, and a check.
- R2.9 applied: B2's edge is a prerequisite with its own build in stage 5. `sight` and the river width now rest on the camera fit, not on B2.
- R2.10 applied, with the figure softened: edge fog, void and the seam land with the first border, and the bridge is hard-coded three times. The 45-75 tile reach is replaced by the checked far plane and the 37% fog at 75 tiles.
- R2.11 applied: per-chunk object lists and culling costed in stage 5.
- R2.12 applied: the bundle estimate counts the whole map, and loading per region is costed in stage 4.
- R2.13 applied: `hazard_bp * d` is named as a spawn model outside these stages, and only the order check is built.
- R2.14 applied: the walk term is per source, from its nearest instance, fed by assemble, with R11 anchored on values.lock.json.
- R2.15 applied: a committed world lock with a re-anchor command, and starts.ts reads `walk_step_ms`.
- R2.16 applied: a separate per-player seen list. adapt's filter is at session.ts:465, not 468.
- R2.17 applied: one shared legend, with a mismatch refused; the key-space refusal dropped.
- R2.18 applied: a tile-to-file index for errors, and slot ids unique across files.
- R2.19 applied: the omitted fields added to G67, the new params optional with defaults, and the save's frame migrated by `adapt`.
- R2.20 partly applied:
  - Applied: WORKFLOW, CODEOWNERS and streams.json named as the binding sources; 13b and 14b remain open claims.
  - Rejected: sections 11 (#97) and 12b (#118) as live claims on world.ts, since both are merged.
- R2.21 applied: per-chunk kernel lists dropped from stage 3; the tool speedups kept.
- R2.22 applied, using the source's own lines where they differ slightly: adapt 434-475, townAt 159-172, buildGround 498-572.
- R2.23 applied: the chunk size and the build cut are this draft's own proposal. The ring is taken from world-notes; its slope walkability is not.
- Also rebased, beyond the reviews' lists:
  - assemble.ts 366-372 and 508-511 to 369-376 and 536-539;
  - world.ts:506 to 502;
  - GAME_RULES 557-558 to 561;
  - s:913 to 944.
- Rebased to dac7bdf, which adds #120 (Maru's hearth and the long night) to 2719343. Of the files the draft cited at 2719343, #120 changed only game/src/scenes/world.ts and content/core/map.json. No rules, decisions, kernel, schema or tools file changed, and GAME_RULES.md still stops at G49. Each world.ts range was compared line by line at both commits.
  - world.ts moved: 525, 635, 709 and 966 to 552, 665, 794 and 1051; 557 to 584; 903 to 988; 360 to 387; 2236-2246 to 2334-2344; 1428-1429 to 1515-1516; 312-370 to 339-397; 1206-1335 to 1292-1422; 179-190 to 202-213; 1485-1511 to 1572-1598; 1404-1405 to 1491-1492; 498-572 to 525-599; 808-839 to 893-924; 502 to 529.
  - The hash at 665 now sits in the branch for props that are not fires; a fire prop is drawn with no look hash (buildFire, 684-702). The per-frame loops now also call refreshFires, a loop over every fire (1339).
  - Corrected: the creator sign on an empty slot is cited where it is made, world.ts:2278-2280 (looking at the slot's mist opens its sign) and 2292-2300 (the sign's invitation). The old cite, 845-865 (now 930-950), puts a sign only beside a slot a creator filled.
  - Made explicit: world.ts:104 in G54 and R1.6, and world.ts:159-160 and 170-173 in R1.6, are kernel/src/world.ts.
  - map.json:8 and the ground rows hold: #120 adds one prop, core/elder-hearth, at lines 275-284. The props now measure 13.8 KB as compact JSON (13,843 bytes, was 13,720), so stage 4 says 13.8.
  - 13b is merged (#120), so the one open claim on world.ts is 14b (section 2's row and section 5).
  - New in #120: the HUD's fire warning loops over every prop each time the HUD renders, every 500 ms, unless a box is open or the game is paused (game/src/ui/ui.ts:215, 247, 317-323; game/src/fires.ts:78). Stage 5's culling list names it.
