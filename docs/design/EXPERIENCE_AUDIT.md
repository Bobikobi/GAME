# The experience audit: what a player of the leading open worlds expects, what Loomvale gives, and what an open-world launch still needs

Written 2026-10-31 for the owner, who asked on 28.10: "where we have not advanced a place, options and opportunities, and the player
experience that a game like World of Warcraft has to give", and "is there something we forgot to advance in the open world for launch?"

[GAP_WOW_RS.md](GAP_WOW_RS.md) (8.10) compared the demo with World of Warcraft and RuneScape and is not repeated here: since then the
quests grew from 6 fetches to 15 quests of 11 types, the expedition was adopted (G36), combat was decided in five rounds, and the
first map was picked (frame A2, [FIRST_MAP.md](FIRST_MAP.md)). This page measures the game as it stands on `origin/develop`
(dbb823030, 31.10) and the plan in `docs/team/NEXT.md`. Nothing is built by it. The sea crossing has its own page,
[SEA_CROSSING.md](SEA_CROSSING.md).

How it was measured:
- **Content counts** are read from `content/core/` and `content/core/map.json` by script on 31.10. They are the numbers in the
  "Loomvale today" column.
- **The outside games** are described as their players know them, with the page of the public wiki (Wowpedia for World of Warcraft,
  the Old School RuneScape Wiki for RuneScape) that a reader can check. The explorer memo commissioned on 29.10 (manager research
  folder, `explorer-first-hour.md`) supplied density benchmarks; several of its citations could not be verified, so its numbers are
  used only as proposals to test in play, never as facts.
- **Not played for this page.** The brief asked for 30 to 60 minutes of play; this audit read the content and the opening's own
  records instead (`docs/design/OPENING_REVIEW.md`, the e2e runs). A timed play of the first map belongs to NEXT 19's playtest, when
  the map exists.

## 1. The expectation list and the audit

Status of our rules on each row: **for** (a rule or decision asks for it), **against** (a rule refuses it), **silent**.
Band: **must** (before an open-world launch), **next**, **later**, or **-** (already there).

### Places

| # | Expectation | Outside source | Our rules | Loomvale today | In the plan | Missing | Band |
|---|---|---|---|---|---|---|---|
| 1 | A hub town with people, a trader and a reason to come back | Wowpedia: Goldshire, Stormwind City; OSRS Wiki: Lumbridge | for: SETTLEMENT.md, DECISIONS 2026-10-22 "The cook is the innkeeper" | 1 town, 8 named characters on routes (Maru, Pell, the innkeeper, the traveller, the watchman, the drunk, the smuggler, the elder), 2 with character files, 1 shop | FIRST_MAP A2: a walled city of all races at the bend, 36 steps from the town | Nothing for the valley; the city's people and vendors are not written | - |
| 2 | An inn, rest and a home point | Wowpedia: Inn, Hearthstone, Rest | for in part: sleep only in a town or at a burning camp (dec 1093); a rested bonus is silent (G28 forbids a penalty for absence, not a reward) | The innkeeper stands all day (`core/innkeeper-post`); 7 rest tiles in the plan; a fall wakes the player in the last town (G65) | Nothing more | A rested bonus or a bind point; neither is needed on a map crossed in about a minute | later |
| 3 | Vistas: a high place that shows the land ahead | Wowpedia: Vista (achievement "Explore"), OSRS Wiki: Viewpoint | for: DECISIONS 2026-10-17 "Beyond the mist" (one column of smoke per region) | 0 authored vistas; the valley is level 0 to 1 | A2 heights: the ruins hill (level 2), the falls' shelf (2), the peak (9), the boathouse smoke (S3) | A vista tile that reveals regions on the map when stood on (row 5) | next |
| 4 | Named landmarks seen from afar | Wowpedia: Blackrock Mountain; OSRS Wiki: Wizards' Tower | for: G51 (a landmark per region), "Beyond the mist" | 23 regions in the map plan, each titled; landmarks: the town smoke, the bridge, the tangle, the night arch | A2 adds the city tower, the spire, the hall, the dark tower and its plume, the boathouse smoke | Nothing beyond A2; the plume and smoke must be drawn (19 i) | - |
| 5 | A map that fills in as you go | Wowpedia: World map ("unexplored areas"); OSRS Wiki: World map | for: G66 (reveal stored per region and area, a map screen shows the regions seen) | One valley chart with fog in 8 by 8 cells (`game/src/ui/map.ts`, 293 lines); no seen list in the state | G66 is a draft in OPEN_WORLD 1.7; no NEXT item builds it | A seen list per region in the state and a map screen for 192 by 192 | must |
| 6 | A new place is announced when you enter it | Wowpedia: Zone text, Exploration experience | for: G63 "Entering pays" (draft) | 0: no banner on entering a region (no code reads a region on entry) | G63 is a draft only | The region's name on first entry, counted as a find when brought home | must |
| 7 | Each region looks, sounds and weathers like itself | Wowpedia: Zone music; OSRS Wiki: Music (a track per area) | for: PLACE_LOOK cards per region (FIRST_MAP table) | 3 positional sound beds (fire, stream, dread) and 2 ambience beds (day, night) in `game/src/audio/`; `weatherOf(seed, region, day)` per region in `kernel/src/reactions.ts:170`; 0 region beds; 0 rain sound | Place cards for 6 regions in FIRST_MAP; the town theme waits for the owner (DECISIONS 2026-10-30 "Sound") | A sound bed and a weather look per region of the first map, and rain you can hear | must |
| 8 | Signs and wayfinding | Wowpedia: Signpost; OSRS Wiki: Signpost | for: FIRST_MAP "small weathered signs at forks and passes" | Sign cards exist (`openSignCard`, `game/src/ui/panels.ts:1415`) | 19 e and i draw them | Nothing beyond the plan | - |
| 9 | Storage you can trust | Wowpedia: Bank; OSRS Wiki: Bank | for: SETTLEMENT (one store, a chest in every town) | 1 storage chest build of 5 camp builds; 2 bags among 25 items | A chest in each far town (G65) | Nothing on the first map | - |

### Options: what a player can do at any moment

| # | Expectation | Outside source | Our rules | Loomvale today | In the plan | Missing | Band |
|---|---|---|---|---|---|---|---|
| 10 | Quests of many kinds, so the next one is not the last one again | Wowpedia: Quest; OSRS Wiki: Quests (over 170) | for: G1-G18, G17 (no two of a type in a row), the quest forge (DECISIONS 2026-10-23) | 15 quests of 11 types: discovery 3, investigation 3, mastery 2, riddle, gamble, skill, tending, stealth, maze, fetch with a twist 1 each | The quest forge binds quests per land; the first map's places get theirs in 19 e | Quests for the first map's regions beyond the valley: today 0 outside the 64 by 64 map | must |
| 11 | Gathering | Wowpedia: Herbalism, Mining; OSRS Wiki: Woodcutting | for | 13 resource kinds, 25 resource slots on the map | More on the first map (19 e) | Endemic resources per region (row 7's cards name them) | next |
| 12 | Crafting and cooking | Wowpedia: Profession; OSRS Wiki: Crafting, Cooking | for | 20 recipes, 6 schools with 44 nodes, 5 camp builds | PROGRESSION.md (the long game's schools) | Nothing for launch | - |
| 13 | Fishing | Wowpedia: Fishing; OSRS Wiki: Fishing | for: DECISIONS 2026-10-25 "Fishing" | 1 fishing school, 1 fish resource, a rod recipe and 1 fish dish | Spots on the sea once a crossing exists | Sea fishing (SEA_CROSSING) | next |
| 14 | Hunting and a first fight | Wowpedia: Combat; OSRS Wiki: Combat | for: combat rounds 1-5 (DECISIONS 2026-10-23), the hunt foundations (2026-10-30) | 6 creature kinds, 17 creature spots (34 in an open pull request); `kernel/src/hunt.ts` and the `dress` verb; 0 fights | The combat schools are written with the first foe (DECISIONS 2026-10-25 "The progression map, Q2") | The first foe and the fight loop | next |
| 15 | Exploring off the path pays | Wowpedia: Treasure chest; OSRS Wiki: Clue scroll | for: G5 ("something to notice on the way"), G62 (a pay within 241 steps) | 15 treasures, 3 of them search spots; a daily search draw (DECISIONS 2026-10-23 "Search, first slice") | G62's check runs on the first map (19 g) | Pays across the 192 by 192 map (row 16 counts them) | must |
| 16 | Something to notice every few seconds of walking | Explorer memo: an interest point every 10 to 25 tiles (a proposal) | for: G62 caps the gap at 241 steps; G69 paths wind | Valley: 296 props, 54 slots on 4,096 tiles | 19 g measures the gap on the first map | The proxy is 10 times the memo's spacing: 241 steps is about 46 s on foot (190 ms a step). Whether that feels empty is a playtest question | next |
| 17 | Collecting for its own sake | OSRS Wiki: Collection log; Wowpedia: Collections | silent | The journal has 4 tabs (tasks, items, recipes, skills); no collection count | Nothing | A collection count per kind (fish, coats, finds) | later |
| 18 | A social act | Wowpedia: Emote, Group; OSRS Wiki: Clan | for: NEXT "presence" (players who see each other without chat) | 0 in the client (no presence, no chat) | NEXT "presence" (open) | Presence before launch is the owner's order (DECISIONS 2026-10-17 "The order from here"); not this audit's call | next |

### Opportunities

| # | Expectation | Outside source | Our rules | Loomvale today | In the plan | Missing | Band |
|---|---|---|---|---|---|---|---|
| 19 | Discovery pays | Wowpedia: Exploration experience | for: G63, counted when brought home | 0 | G63 draft | Row 6 | must |
| 20 | Rare spawns worth a detour | Wowpedia: Rare mob; OSRS Wiki: Rare drop table | for: the wild brain ("no route is a pattern a player can learn", DECISIONS 2026-10-30) | 0 rare creatures on the map (the white hart has a body, not a spot) | BESTIARY.md, the first ring | One rare per region of the first map, the hart first | next |
| 21 | World events | Wowpedia: World event; OSRS Wiki: Shooting Stars | for: the quest forge's "bound storylets and world events" | 5 reactions (birds over a find, fish at dusk, mushrooms after rain, reeds in rain, windfall berries) | The forge (no item yet) | Events that travel the map; the sea's event table is the first (SEA_CROSSING) | next |
| 22 | Reputation | Wowpedia: Reputation | for: standings with characters | A `rep` record per character in the state (`kernel/src/state.ts:193`) | Nothing more | A standing per land or city | later |
| 23 | Achievements and titles | Wowpedia: Achievement, Title; OSRS Wiki: Achievement Diary | for in part: the boards (DECISIONS 2026-10-09) | Verified boards on the server (`server/src/boards.ts`); 0 achievements, 0 titles | Nothing | Achievements tied to the tree (G "Tree first") | later |
| 24 | Daily things to do | Wowpedia: Daily quest; OSRS Wiki: Daily | against in part: G28 (no punishment for absence) | 1 daily draw (search) | P-4's day summary | Nothing a daily would add that G28 allows beyond the draw | later |
| 25 | A dungeon | Wowpedia: Dungeon; OSRS Wiki: Barrows | for: G36 (the expedition) | 1 expedition (the night ruins), NEXT 14 "building - variety" | NEXT 14 | A second expedition on the first map (the sunken hall, d1) | next |
| 26 | A faster way to travel | Wowpedia: Flight path, Mount; OSRS Wiki: Teleportation | for: DECISIONS 2026-10-23 "The world's structure" (7): every faster form is legitimate, each earned by level, none picked | Walk and run gaits (DECISIONS 2026-10-29); 0 fast routes | Nothing | Not needed on the first map: the farthest pass is 74 steps from town (14 s) and the coast dock 139 (26 s). Needed when the map grows | later |
| 27 | A boat to somewhere new | Wowpedia: Boat; OSRS Wiki: Charter ship | for: DECISIONS 2026-10-22 "The human world is a serious city across the river" (boats cross the bay); the owner, 28.10 | 0: the plan's exit `core/ferry` and a schema exit "the jetty where the boat waits" (`schema/src/index.ts:2068`) only | In no NEXT section | The passage (SEA_CROSSING.md) | must |
| 28 | Pets | Wowpedia: Battle pet; OSRS Wiki: Pet | silent | 0 | Nothing | - | later |
| 29 | Mail and an auction house | Wowpedia: Auction House; OSRS Wiki: Grand Exchange | for: stage 4, the market | 1 shop at fixed prices | Stage 4 (GAP_WOW_RS section 4) | - | later |
| 30 | A guild | Wowpedia: Guild; OSRS Wiki: Clan | silent | 0 | Nothing | - | later |
| 31 | A place to fight other players | OSRS Wiki: Wilderness | for: DECISIONS 2026-10-23 "The world's structure" (6) | 0 | Nothing | - | later |

### Experience beats

| # | Expectation | Outside source | Our rules | Loomvale today | In the plan | Missing | Band |
|---|---|---|---|---|---|---|---|
| 32 | The first hour's pacing: a pay at least every minute or so | Wowpedia: Starting zone; OSRS Wiki: Tutorial Island | for: pillar 1 (a pay within 90 s), the rungs | 3 wake pockets, each with a first task; wake to bridge 16 / 8 / 7 steps; the opening e2e times the 90 s ceiling | 19 e re-anchors the legs to 55 / 17 / 30 steps (A2) | Nothing; the re-anchor must keep the ceiling (19's measurable) | - |
| 33 | The game teaches by doing | Wowpedia: Tutorial | for: the hint ladder (NEXT 9) | Built (#132) | - | - | - |
| 34 | Danger you can read before it hits | Explorer memo section 6 (proposal); Wowpedia: Elite | for: G31 (nobody falls unwarned), G64 (the world shows d, never the screen) | `dangerAt` returns 0 or 1 only (`kernel/src/danger.ts:184`); 0 areas carry d | The difficulty reckoning and `pnpm map:playtest` are built (#342, #428); setting d per area is CR-38 | d on every area of the first map, and a cue at each d1 and d2 border (tracks, bones, thicker mist) | must |
| 35 | When a region is too hard, the player knows what to do | Wowpedia: Level (the zone's level range on the map) | for: G33, G34 (the answer is a run), G64 | The rule is "run to a safe place"; nothing tells the player from outside | Row 34 | Row 34, plus a line from Maru (a ranger) about the passes | must |
| 36 | Night changes the world | Wowpedia: Day/night cycle | for: NEXT 11, 21 | The long night and a fire anywhere (#211, #227); lamps from 17:00 | - | - | - |
| 37 | The return: something changed since yesterday | OSRS Wiki: Farming (growth cycles) | for: GAME_RULES "Day 2" row, G28 | 5 reactions, the daily draw | P-4 | Nothing for launch | - |
| 38 | Music by place | Wowpedia: Zone music; OSRS Wiki: Music | for | `game/src/audio/songs.ts`; the town theme waits for the owner's pick | DECISIONS 2026-10-30 "Sound" (⏸) | A theme per region, after the pick | next |
| 39 | Saves survive the world growing | Every live game (no source needed: a lost character ends a player) | for: dec 1094 ("no way back is ever closed") | `kernel/src/adapt.ts` moves a walled-off tile to the nearest reachable one; the server adapts a stored state on read (#490, #496) | Nothing for the block move | **The A2 offset** (section 2, gap M5) | must |
| 40 | The opening cannot be broken by later changes | - (our own need: creators edit ground) | for: G59 | No lock file: `content/` holds `values.lock.json` only | 19 e re-anchors the lock; 19 h fences the valley | The world lock as a file the checks read | must |

## 2. The gaps, ranked

Ranked by what a player gains against what it costs, inside each band. Each line is one a builder can take.

### Must, before an open-world launch

- **M1. The sea passage to the far bank** (rows 13, 21, 27). The owner named it on 28.10 and it is in no NEXT section. Build it as
  [SEA_CROSSING.md](SEA_CROSSING.md) proposes: a `passage` file, a server roll from a weighted event table, the first content on the
  bay. Cost: medium (a file type, a kernel state, one client scene).
- **M2. Entering a region names it and counts it** (rows 6, 19). A region title on first entry, kept in a per-player seen list (G66),
  counted on the exploration board when brought home (G63). Cost: small (a state list, a banner within frame D, a board row).
- **M3. The map screen covers the first map** (row 5). The valley chart grows to 192 by 192 and shows the regions seen (M2's list),
  never tiles. Cost: small to medium; it needs M2.
- **M4. Danger reads from the world** (rows 34, 35). Every area of the first map carries d from the reckoning (CR-38), checked by G64,
  and each d1 and d2 border has a cue the eye catches (tracks, bones, thicker mist). Cost: medium; the reckoning exists.
- **M5. A save keeps its place when the valley block moves** (row 39). A2 moves the authored valley by (+66, +84) inside the 192 by
  192 map (FIRST_MAP.md, "Frame"). `kernel/src/adapt.ts` keeps a saved tile if it is still reachable (line 59) and the server adapts
  the same way on read (#490), but neither knows the block moved. Today's bridge (`core/old-bridge`) is at (13-15, 17-18) in the
  64 by 64 map and lands at (79-81, 101-102) after the move. A save standing on the bridge keeps (13, 17), which on the new map is
  the mountain ring at level 7 (`mountain_level_a2` in `docs/design/first-map/plan.py`); the reach check then drops the player on the
  nearest reachable tile of the ring's foot, about 35 tiles from the bridge, outside the valley.
  The fix: the map change carries its offset (a `moved: {dx, dy}` on the map or a one-off adapt step keyed on the content tag), and
  adapt adds it before the reach check. It is the owner's call whether old saves move or reset (DECISIONS 2026-10-31 "The server
  brings a stored state to new content" assumes they move). Cost: small, but it must land with 19 e, not after.
- **M6. The world lock** (row 40). A file of the opening's legs and pays that `pnpm check` reads, written when 19 e re-anchors them,
  before any creator edits ground (19 h). Cost: small.
- **M7. Each region of the first map sounds and weathers like itself** (row 7). One bed and one weather look per region card
  (6 in FIRST_MAP), rain you can hear. Cost: medium (sound sourcing waits for the owner's sound pick).
- **M8. Quests and pays beyond the valley** (rows 10, 15). The forge binds the first map's regions; G62's check passes on the whole
  map. Cost: large; it is 19 e's content and the forge's first land.

### Next

- **N1. A rare per region**, the white hart first (row 20).
- **N2. A second expedition** in the sunken hall, d1 (row 25).
- **N3. Events that travel**: the sea's table first, then the land's (row 21).
- **N4. The first foe and the fight loop** (row 14), by the combat rounds.
- **N5. Endemic resources and sea fishing** per region (rows 11, 13).
- **N6. Vistas that reveal**: standing on a high tile marks the regions it overlooks as seen (row 3).
- **N7. A theme per region** after the town-theme pick (row 38).
- **N8. Measure the walking gap in play**: G62's 241-step cap against the memo's 10-25 tiles, in the first map's playtest (row 16).
- **N9. Presence** (row 18), in the order the owner set.

### Later

Pets, a guild, mail and the market (stage 4), a player-fight zone, achievements and titles, a collection count, a rested bonus, a
fast route (only when the map grows past about a minute's walk), reputation per land.

## 3. The open-world launch checklist

Status words: BUILT (on develop), PLANNED (a NEXT section or DECISIONS entry holds it), PARTLY (a piece exists), NOWHERE.

| # | Check | Status | Evidence | Why a launch needs it |
|---|---|---|---|---|
| 1 | A map screen and travel for 192 by 192 | PARTLY | A valley chart with fog (`game/src/ui/map.ts`); no seen list, no fast route; G61 says no stage builds one; the 192 by 192 map is not drawn (core `map.json` is 64 by 64; 19 e open) | Gap M3. Travel itself: the farthest pass is 74 steps (14 s) and the coast dock 139 (26 s), so walking is enough on the first map |
| 2 | The sailing to the human city (owner, 28.10) | NOWHERE | Hooks only: the region purpose `passage` (`schema/src/index.ts:1979`), the jetty exit (2068), the plan exit `core/ferry`, Pell's ferry route 6-19 in the plan; no step, no state; in no NEXT section. Since 30.10 also open: where the human city stands now that A2's walled city is of all races (FIRST_MAP "The city") | Gap M1. Without it the south-west is a picture |
| 3 | Free movement (NEXT 22) | BUILT | #280, commit b1fe4f8b | - |
| 4 | The long night and a fire anywhere (NEXT 21) | BUILT | #211, #227 | - |
| 5 | Region sound beds and weather beyond the valley | PARTLY | 3 positional beds, 2 ambience beds; `weatherOf` per region; 0 region beds, 0 rain sound | Gap M7 |
| 6 | Saves across the map change | PARTLY | Content changes: BUILT (`kernel/src/adapt.ts`, server #490 #496). The block move of A2 by (+66, +84): NOWHERE | Gap M5 |
| 7 | The creators' ground changes (19 h) | PLANNED | NEXT 19 h, open | Without the guide and the fence a creator can break the opening |
| 8 | What a player does when a region is too hard (G64) | PARTLY | Reckoning and playtest built (#342, #428); `dangerAt` 0 or 1; no area carries d | Gap M4 |
| 9 | A world lock for the opening (G59) | NOWHERE | No lock file; `tools/src/starts.ts` measures, nothing refuses | Gap M6 |
| 10 | Performance on a phone with streaming (19 d) | BUILT, not yet on a phone | `game/src/stream.ts` (#425): at most 9 chunks, longest frame 31-32 ms headless at phone size; one chunk file exists to stream | A real phone walking the 192 by 192 map, when 19 e has drawn it |
| 11 | A region names itself on entry | NOWHERE | G63 draft only | Gap M2 |
| 12 | Quests outside the valley | NOWHERE as content | 0 quests outside the 64 by 64 map; the forge has no land yet | Gap M8 |

"Nowhere" lines: the sea passage, the A2 save offset, the world lock, the region name on entry, quests outside the valley.

## 4. What the owner decides

1. **Old saves and the block move (M5):** move every saved position by (+66, +84) when the first map lands (recommended), or reset
   positions to the wake tile.
2. **The sea crossing (SEA_CROSSING.md section 6):** whether the boat is the only way for a human to reach the far bank; whether the
   first map's crossing lands at a far jetty with the city shut, or waits for the city's land; where the human city stands now.
3. **The order:** M2, M3, M5 and M6 are small and ride 19 e; M1 is a stream of its own; M4, M7 and M8 are 19 e's content. Whether M1
   goes before or after 19 e is the owner's call (recommended after 19 e item a, beside the boathouse, since both use stamps).
