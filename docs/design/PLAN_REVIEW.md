# The plan review: the play experience beside other games, and what the owner ruled

Written 2026-11-27 for the owner, who asked on 23.11: "a conversation about the plan, to understand the expected
play experience compared with others, and then a general check of the plan against other games". The rulings below
are his yes of 27.11 in chat; they are recorded in [DECISIONS.md](../../DECISIONS.md) under the same date. Nothing is
built by this page.

How it was read: the plan of record, [GAME_RULES.md](GAME_RULES.md), [OPEN_WORLD.md](OPEN_WORLD.md),
[PROGRESSION.md](PROGRESSION.md), [MODES.md](MODES.md), [STORY.md](STORY.md) and the six comparison pages
([EXPERIENCE_AUDIT.md](EXPERIENCE_AUDIT.md), [GAP_WOW_RS.md](GAP_WOW_RS.md), [GAP_RDR2.md](GAP_RDR2.md),
[GAP_RS_GEAR.md](GAP_RS_GEAR.md), [GAP_DIMRAETH_DRAKANTOS.md](GAP_DIMRAETH_DRAKANTOS.md),
[GAP_MATERIALS.md](GAP_MATERIALS.md)), which are not redone here. What other games give at each moment is the
reviewing model's knowledge, not a source checked for this page; for Dimraeth and Drakantos the page leans on our own
comparison page alone.

## 1. What the game is

**Ruling.** The game is mostly work, discovery and building. The fight is live, and it is one verb among several.
The structure (trades, regions by danger, gathering tiers, what a week of play holds) is measured against RuneScape
and Albion Online. Path of Exile 2 and Wild Rift are bars for the feel of the fight and for animation only.

**Evidence.** The six built schools are all work trades. `kernel/src/fight.ts` opens with "Never called by the game
yet". No page describes how a player chooses whom to hit. G35 keeps the fight out of the opening and G78 ties it to
the live connection; the plan places it two stages after the valley. Albion Online is the closest shipped game to
what the pages describe (seen from above, played on a phone, danger by zone, gathering tiers, loot in marked zones),
and it was missing from the games the experience is measured against.

## 2. Six moments a player has

### The first ten minutes
- **We give:** a waking by race, a tool on the ground, one press and the work runs by itself; the bridge, a tree, a
  fire, Maru or Pell, a dusk riddle, the threshold of the night ruins; an item at once, level 1 with a jingle, a
  skill point (GAME_RULES section 2). No threat and no fight (G35).
- **Others give:** a first enemy in the first minute and a boss that can kill around minute 10 to 15 (Path of Exile
  2); a fight in the first minute (Wild Rift); RuneScape and Red Dead Redemption 2 open slowly, as we do.
- **Gap:** the player's hands are not tested once.
- **Ruling 1:** one moment of hand skill inside the first ten minutes, from what is built: the charged stone throw
  at small game. It is met, never taught (the owner's word of 19.11: the opening teaches almost nothing).

### The first outing
- **We give:** a dusk countdown, then a night of a wolf that walks a round, sees and smells, a pit, a trap and deep
  water; the one answer to a predator is to run (G34). A fall wakes the player in town, takes the outing's gains and
  undoes its discoveries (G33, and the outing record in `kernel/src/state.ts`).
- **Others give:** a short run back with no loss (World of Warcraft), a checkpoint (Path of Exile 2), the items
  waiting on a grave (RuneScape).
- **Gap:** ours is the heaviest penalty of them, on the very first outing, with no way to win anything back.
- **Ruling 2:** the pack left on the ground (G33, once planned for the combat frame's first step) comes forward into the
  valley. The kernel part is built (kernel 0.43.0, `player.packs`, the `takepack` action); the card and the drawing follow.

### The first hour
- **We give:** six trades, levels by the time worked, points that buy nodes at a safe place, 15 quests of 10 kinds.
  A profession's curve ends today at about two and a half hours (PROGRESSION 3.1).
- **Others give:** after an hour a player of Path of Exile 2 knows what they are building; RuneScape shows 23
  skills to 99 from the first minute, so the long road is in sight.
- **Gap:** after an hour the end of the road is in sight. The 16 to 22 schools of about 52 hours each
  (PROGRESSION 3.2, 4.2) are on paper with no plan row, and no trade changes how a player moves or meets danger.
- **Ruling 3:** the valley shows the whole tree, the built branches lit and the ones not built locked, and the size
  of progression gets a plan row. The tree's picture is drawn first as an art still; effects and animation are added
  on it if the owner likes it (his words).

### A week of play
- **We give:** the valley waits at the hour it was left (G28); a new day brings a regrown grove, a new line, a day
  summary that names one open door (G16). The content is one valley.
- **Others give:** one unit a player repeats a hundred times and still enjoys: a match, a map, a dungeon, a number
  that climbs.
- **Gap:** we have no such unit yet. The candidate is the expedition (problems, a clock, gains that count only once
  brought home: G33, G36), and there is one.
- **Ruling 4:** the expedition is the repeatable unit. Its variety is the first thing built after the valley, before
  more regions.

### The wide world
- **We give:** a world board of 2,280 squares, three worlds, danger that rises with the distance from town (G64).
  Most plan rows are about how the world looks and joins; "quests and pays beyond the valley" is blocked, and a rare
  creature per region and a second expedition have no row.
- **Others give:** a region with its own foes, music and story (World of Warcraft); something happening every two
  minutes of riding (Red Dead Redemption 2).
- **Gap:** the risk of a world that is beautiful, large and empty.
- **Ruling 5:** before the next block is joined, the first region outside the valley gets a play card: the resource
  found only there, its creatures, its hazard, its expedition and the reason to return, held to the valley's own bar
  of no more than 90 seconds without an event.

### Playing with others
- **We give:** one world for everyone with each player's progress their own (MODES section 1), a server mostly
  built, a players counter. Seeing another player has no plan row; groups, a market and a marked zone for fights
  between players are on paper.
- **Others give:** other players in sight in the first minute (World of Warcraft, RuneScape), which is half the pull.
- **Gap:** the cheapest and strongest part is missing, and the valley goes to its testers as a game for one.
- **Ruling 6:** players seeing each other is the first row of that stage, before chat, a market and the fight.

## 3. Where each ruling sits

| Ruling | Stage | State on 27.11 |
|---|---|---|
| 1. A moment of hand skill in the opening | the valley | waits for the animals on screen (#916) |
| 2. The pack left on the ground | the valley | kernel built (0.43.0); the card and the drawing are the next pull request |
| 3. The whole tree in sight; its picture first | the valley | the picture is #920; the sizing row is new |
| 4. The expedition as the repeatable unit | first after the valley | recorded, not started |
| 5. A play card for the first region outside | before the next block is joined | recorded, not started |
| 6. Players see each other | first row of the stage of playing together | recorded, not started |

**Focus (the owner, the same turn):** nothing outside the valley is started by this review. Rulings 4 to 6 are rows
at their stages.

## 4. The comparison pages since they were written

A model read the six pages against the plan and the headings of the decisions since 30.10 and counted 57 findings:
24 closed by a decision (decided, not all built), 12 in the plan, 9 open and 11 that cannot be settled from the
documents. The count is that reading's, not a tally made by hand.

One finding is repeated by three pages (GAP_RDR2, GAP_RS_GEAR and GAP_MATERIALS, where it is gap 1): the hunt's
take and the snare, with 119 of 158 materials waiting behind it. The rules exist in `kernel/src/hunt.ts` (early
prey, dressing a carcass, snares); a player meets them when the animals stand on screen (#916). Ruling 1 uses it.

Still open, the ones a player would feel: a rare creature in each region (EXPERIENCE_AUDIT N1); a second expedition
(N2, now ruling 4); food, healing and effects with a model and almost no content (GAP_MATERIALS gap 6); a market
between players (GAP_WOW_RS, GAP_RS_GEAR); a quick bar for food and crafting beside the bag, salvage and pets
(GAP_DIMRAETH_DRAKANTOS); 22 materials with no source and made parts that nothing uses (GAP_MATERIALS gaps 3
and 5).

## 5. Where two pages disagree

Three places met on the way, each checked against both texts. Each needs the eye of whoever owns the page before a
rule's text changes; this page changes none.
- G83 says a foe's bars sit over its head and "no number is printed on a bar"; the decision of 25.11 "A small
  health bar under the foe, with its number (#866)" draws the bar under the feet with the health printed beside it.
- OPEN_WORLD opens with the owner's direction of 17.10 "the world has no end", and its G50 caps the world at one
  grid of 1024 x 1024 tiles; neither states its link to the world board of 38 x 60 squares.
- OPEN_WORLD's D3 (option 3, 16.10) says each region carries its own small story and that STORY's frame is
  rewritten to match; STORY still reads "The valley is the hero".
