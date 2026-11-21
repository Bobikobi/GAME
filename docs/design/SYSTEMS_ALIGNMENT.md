# Systems alignment: every thin system from the page to a plan in code (2026-11-21)

Status: **the short-form systems map for #784.** The nine system pages, Appendix A's inventory and the build plan are pending. Section 4 lists the open questions.

The owner, 21.11: "תן פתרונות להכל בהשוואה למולטיפלייר הגדולים ולמובילים. אני רוצה יישור קו מרעיון על הנייר ועד תכנית בקוד בדיוק ובאינטגרציה עם שאר המשחק (מיקום, רמה, חנות, קושי, חומרי גלם ועוד)". What he weighs is the player's experience and the world itself, so the systems run in that order: finding first, then carrying, the kit, the tree, making, shops, the curve across the world, shelter, and last what waits behind the fight.

**Two of his decisions of 21.11 are already in this map:**
- **The basket goes, because the bag exists** ("סל מיותר כי יש תיק"). Row 2.4 lays out every job the basket does today and what takes each one over.
- **Exploration finds stay open without a fight.** Weapon finds and their bonuses stay behind the combat gate with the fight's own things (row 9.2). He asked: "לגבי דף קרוע - איך זה מתיישר עם חקירת העולם שאפשר בלי אצל אחרים?" Row 1.4 places the four torn hide pages in gate rubble open to everyone. Getting the hide from small game before combat opens is a separate proposal, pending Q1 (rows 1.5 and 9.1).

## How to read this page

- **Eight fields, short form.** Each row of section 1 carries the eight fields of the brief in short form:
  1. the idea on paper
  2. the leaders
  3. ours in code
  4. the gap
  5. the one solution
  6. the integration
  7. the plan
  8. the owner question

  The full system pages S1–S9 (`docs/design/alignment/S<n>_*.md`) are pending step 2 of #784. A cell that has nothing to say reads "none", with its reason.
- **State.** Each row has one of four states:
  - **in code:** built on `develop`.
  - **decided:** the owner ruled, and it is not built (or only partly built).
  - **on paper:** proposed on a design page, with no ruling.
  - **missing:** no page covers it.
- **Our numbers** are read from `develop` at eaeb1ead. Prices come from the one calculator (`kernel/src/values.ts`, the R8 floor: a shop price is at least 10 times the value in mg, and 1 gold is 1000 mg). A new item's price is whatever the calculator gives when the item lands, never a number typed into a shop file. Minutes come from the route player (`pnpm map:playtest`, seed 1) where it reaches; elsewhere a row says what its estimate is based on.
- **Game comparisons** cite source ID groups or numbered sections where available.
  - `FB:` groups cite IDs O, W, A, N, V, S and T from FINDING_BALANCE section 6 (#783). Numbered FB section pointers refer to the comparison tables.
  - `CB` points to numbered sections of CLOTHING_BALANCE (#778), whose sources are in section 11.
  - `SV:` is the skill-family survey's S1-S31, the sources of SKILL_FAMILIES (#779).

  A number taken from memory or from a search snippet is marked (unchecked). "STORY S1-S6" always means STORY.md's rules, never a source.
- **Plan ids** (`P01`...) point to section 3, where the build order, files, tests and line estimates are pending step 3 of #784.
- **Rules:** G-numbers are GAME_RULES.md and R-numbers are the kernel's value rules.

**Counts**

- 69 map rows across S1–S9 (14 in code, 23 decided, 24 on paper, 8 missing).
- 0 rows with any of the eight numbered fields empty.
- Field 2 has 78 FB citation groups, 27 SV citation groups, 12 CB section pointers, 5 FB section pointers and 40 (unchecked) marks. Each FB or SV group counts once, even when it names several source IDs. Each numbered CB or FB section pointer counts once.
- The inventory and its row mappings are pending in Appendix A. The plan's line estimates are pending in section 3.

Run this command from the repository root to reproduce the counts.

```bash
awk -F '|' '
  /^## 1\. The map$/ { in_map = 1; next }
  /^## 2\. / { in_map = 0 }
  in_map && /^\| [0-9]+\.[0-9]+ \|/ {
    rows++
    state = $4
    gsub(/^ +| +$/, "", state)
    states[state]++
    for (field = 5; field <= 12; field++) {
      if ($field !~ /[^[:space:]]/) { missing++; break }
    }
    fb += gsub(/FB:[A-Z][0-9]+/, "", $6)
    sv += gsub(/SV:S[0-9]+/, "", $6)
    cb_sections += gsub(/CB [0-9]+/, "", $6)
    fb_sections += gsub(/FB [0-9]+/, "", $6)
    unchecked += gsub(/\(unchecked\)/, "", $6)
  }
  END {
    printf "Map rows: %d (%d in code, %d decided, %d on paper, %d missing)\n",
           rows, states["in code"], states["decided"], states["on paper"], states["missing"]
    printf "Rows with a missing field: %d\n", missing
    printf "Field 2: %d FB citation groups, %d SV citation groups, %d CB section pointers, %d FB section pointers, %d unchecked marks\n",
           fb, sv, cb_sections, fb_sections, unchecked
  }
' docs/design/SYSTEMS_ALIGNMENT.md
```

## 1. The map

### S1. Finding and loot

| # | Thing | State | 1 Paper | 2 Leaders | 3 Ours in code | 4 Gap | 5 Solution (before -> after) | 6 Integration | 7 Plan | 8 Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Where finds sit, and the share of found, made and bought | in code | FINDING_BALANCE 1.1-1.2; SEARCH (built first slice) | found / made / bought: OSRS 60/20/20 (FB:O1,O2,O6), WoW 60/10/30 (FB:W1-W5), Albion 55/35/10 (FB:A1-A5), Valheim 5-15/85-90/0 (FB:V1-V5), Stardew 60-70/15-20/15 (FB:T1-T5) | 6 fixed tool spots at 100% that return after 60 s; 3 ruin dig tables (gate, deep, hall); 3 searchables that refill at dawn; about 45 / 45 / 10 (FB 1.2) | none: inside the range of all seven games | keep it as it is | valley d0, minute 0-16 | none | none |
| 1.2 | The long tail (F2) | on paper | FINDING_BALANCE 1.3, F2 (recommended yes, after the clothing wave) | OSRS clue 1 in 64 to 1 in 128 on its own roll (FB:O7); Vintage Story temporal gear 1 in 2,000 (FB:S2); Stardew prismatic shard 0.05% (FB:T6); Albion .4 item 0.3% (FB:A6); WoW pouch about 0.1% (FB:W1) | the stone idol has a base 1-in-20 chance (`content/core/treasures/ruins-deep.json:34-37`); one roll per dig, and a miss can return nothing (`kernel/src/step.ts:686-701`) | the shortest tail of all eight games, and it shares the main roll. [G15](GAME_RULES.md#L148-L152) requires exactly one unit at the end of every completed work interval, including a dig. An empty result breaches that rule | **open: needs the manager.** Decide what the guaranteed one-unit result is and its table odds. Review the proposed separate 1-in-400 bonus roll on a regional trace table (3-5 rows) against G15's one-unit rule and G42's shared rarity budget | if approved, every dig spot; trace rows go on the region card in the pending S7 page; luck tilts only the trace roll; a drawing per trace item (kit:gen rich) | P12a (a pending docs page); P12b waits for Q3 | Q3: main-table contents and odds, and whether the separate trace roll fits G15 and G42 |
| 1.3 | Finds that teach a recipe | decided | DECISIONS 2026-11-12 the weapon table ("every route open at once"); CLOTHING 6; FINDING_BALANCE 1.4 | WoW recipe drops (unchecked); OSRS none; Valheim none: recipes open when a material is picked up (V4, (unchecked) for the rule); Albion recipes only through the Destiny Board (SV:S13) | `core/stew-scrap` teaches herb stew (`ruins-gate` 10%); `known: found` recipes exist (bandage, herb stew, herb tea) | thin: one scrap, three found recipes | **every recipe of tier 2 and up has at least two open routes: a find (a scrap) and one more (a quest, the try, a teacher). A scrap row sits only in ground that is open to all (no gate, no key item)** | gate rubble (t2), deep ruins (t3), a region's ruin (t3 of the region's goods) | P07, P13 | none |
| 1.4 | The torn page under free exploration (the owner's question) | decided | CLOTHING_BALANCE 9 Q2 (yes, 21.11); the manager's `gate: "combat"` on dig rows is withdrawn | the leaders all let a player explore and find with no fight and no key item: Vintage Story vessels in ruins (FB:S3), Stardew artifact spots (FB:T2), OSRS ground spawns (FB:O2), Valheim chests (FB:V3), Albion resource rarity (FB:A4) | no scrap rows yet; `kernel/src/hunt.ts:2-5` ties the carcass to the combat rules | the proposed pages can stay open to exploration; the pre-combat source of hide is pending Q1 | **four t2 hide pages dig open in the gate rubble at chance 5 each (CB R3), with no gate. The take in 1.5 would supply the hide if Q1 passes. The pages teach when found; the recipes need hide to craft. For any claim about the valley's past, the page names its speaker under STORY S1/S2** | `ruins-gate` (d0, open from minute 15.5); Handcraft L3; shard, coin and stew scrap each lose at most 5% of their worth (inside R11's 10%) | P07 for the pages; P05 for the hide, pending Q1 | page access decided; hide source pending Q1 |
| 1.5 | Where a recipe's material comes from before the fight | on paper | GAP_MATERIALS 6 step 1 (the take and the snare); HUNTING 5 T0-T1 ("a hunt is not a fight") | the first animal falls in the first minutes in Valheim (FB:V2), Vintage Story (FB:S4), New World (FB:N1) and OSRS (FB:O4), each with no gate | 8 hare spots and 5 roe spots on the map (`map.json` creatures); `dress` is built; no verb lays a carcass | 119 of 158 materials wait behind a verb that does not exist (GAP_MATERIALS 4) | **if Q1 passes, the take comes before combat as its own verb: T0 a thrown stone (a river stone picked up, no recipe), T1 a snare (2 reed cord and 1 branch at the work stone, checked once a game day). The predators stay hazards (G34, G35)** | valley meadows d0; hare first, then roe; Handcraft L1 (snare); a hide spoils in 6 game days if not taken; no drawing beyond the snare icon | P05 waits for Q1 | **Q1** (yes or no: put the T0–T1 small-game take and its progression before combat, with predators still hazards) |
| 1.6 | What each region gives that the valley does not | on paper | BODY_CLOCKS 7 (each region grows an ingredient that answers its own conditions); WEAPON_MATRIX Q6 (each land has its own metal); EXPERIENCE_AUDIT N1 (one rare per region, the white hart first) | WoW zones by level, each with its own herbs and ores (unchecked); Albion tiers by zone (unchecked); OSRS area resources (unchecked); Valheim biome materials, the world as the gate (SV:S29); New World territories (unchecked) | 6 region cards in `map.json` (valley, east highland, elf wood, bay coast, far bank, undead south); content exists only in the valley | no page lists, per region, what is found there | **one region card rule: every region card names 1 plant, 1 stone or wood, 1 animal good of its own, 1 rare (N1), its trace rows (1.2) and its tier band (S7 row 7.1)** | each card in FIRST_MAP; tier = the region's d + 1 | P13 | none |
| 1.7 | Bad-luck protection | in code | FINDING_BALANCE 1.3 ("none") | none in OSRS (FB:O7), Vintage Story (FB:S2) or Valheim (FB:V3); Stardew's ladder grows likelier as rocks run out (FB:T6) | none; luck tilts only the rare rows (`rareFindPermille`) | none | keep none: G42 already makes rarity a matter of capacity | none: no bad-luck system to place | none | none |
| 1.8 | The rarity budget, with the new rows | on paper | GAP_RS_GEAR 9, Q1 (default A: fit by each source's own respawn) | not found: no leader publishes a world budget | `rarity_budget_permille` 100; 87,697 of 100,000 ppm used (GAP_RS_GEAR 9) | the long tail, the pages and the hunters' cache all draw on the same budget | **A, as the default says: each new row fits by its own respawn, and if Q3 approves the trace roll, it counts in the budget at its real rate. The check prints the budget left after each pull request** | `tools/src/check.ts` budget row | P12b | none (its default stands) |

### S2. Carrying

| # | Thing | State | 1 Paper | 2 Leaders | 3 Ours in code | 4 Gap | 5 Solution | 6 Integration | 7 Plan | 8 Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | The bag ladder 12 / 24 / 36 and the load | in code | DECISIONS 2026-10-23 "Bags on the back" and "Weight and the three paces" | Stardew 12, 24, 36 (FB:T1,T7); WoW 16 plus 4 bags (FB:W4,W8); Albion 48 and a load of 50 (FB:A7); Vintage Story 10 plus 4 bag slots (FB:S1,S5); OSRS 28, no bag (FB:O11) | `bag_base` 12; satchel `places` 24; frame pack 36 and `load_bonus` 10; load base 30 plus 10 a point of might; paces 170 / 190 / 230 ms | none | keep it | the back slot; human +2 places | none | none |
| 2.2 | The first bag's source (F1) | decided | FINDING_BALANCE F1 (recommended yes); DECISIONS 2026-10-23 (made at the workshop, and Pell sells it) | WoW gives a free 4-slot quest bag (FB:W4); Albion drops one in the tutorial (FB:A1); New World gives one by quest at level 10 (FB:N4); Vintage Story finds one in a vessel 12.3% of the time (FB:S5); Stardew sells one for 2,000g, 4 times its start (FB:T1,T7) | made at the workshop L3 (2 reed cord, 1 woven mat) or bought from Pell (`content/core/shops/trader-shop.json:14-17`); never given | the satchel costs 5 to 9 times the purse when the opening ends | **if Q2 passes, `a-whole-one` gives the satchel in place of the reed basket, without adding a quest leg. The satchel gives more carrying space (G4). Pell keeps selling it at its calculated R8 floor, as a second bag or for whoever skips the quest** | the collapsed hall (bowl 8% a dig, count 6, back after 30 s); the reward lands at about minute 20-25 (an estimate: 12 digs after the hall opens); Pell's basket line is to be rewritten in his voice (G20); any claim about the past needs a speaker (STORY S1/S2) | P04 | **Q2** (yes or no: the quest reward becomes the satchel) |
| 2.3 | The frame pack's source | decided | DECISIONS 2026-10-23 ("the city's"); EQUIPMENT 3.2 | the top early bag: WoW 6-12 slots from tailors (FB:W8); Albion tier-3 bag by craft (unchecked); Stardew 36 for 10,000g (FB:T7) | `items/bags.json` frame pack (t3, 36 places, weight 4); nothing gives it | no source | **made in the city's workshop, t3, wear family, Handcraft L8 (its band on the new curve, 4.6), from 2 woven mat, 2 roe leather and 4 branch. This is a craft source under G41, which bars shop sales for tier 3 and up** | the city on the west bank (FIRST_MAP); leather comes from the take (1.5); a drawing exists, not yet in the kit (DECISIONS 2026-10-23) | P17 | none |
| 2.4 | The basket goes (the owner) | decided | the owner, 21.11: "סל מיותר כי יש תיק" | none of the seven carries a gathering basket as a tool: herbs are picked by hand in OSRS (unchecked), WoW (W5 needs no tool for herbs, (unchecked)), Valheim (FB:V4), Stardew (FB:T1); Vintage Story's basket is a bag (FB:S5) | the `basket` tool kind (`schema/src/index.ts:54`); 5 resources and 1 reaction ask for it (`content/core/reactions/mushrooms-after-rain.json:9-21`); the west-bank ground and intro; treasure `bank-basket`; Pell's line and shop row; the reward of `a-whole-one`; recipes `reed-basket` and `fine-basket`; 3 school icons (`content/core/schools/foraging.json:61`, `content/core/schools/handcraft.json:33,61`) for `forest-pace`, `careful-work` and `masters-eye` | a tool whose job the hand already does | **herbs, sunleaf, bellberry and mushrooms are picked by hand. The rain reaction drops its `tool` field, so its mushrooms are also picked by hand, still at level 2 beside grove logs in rain. The two basket recipes become an axe ladder (P03). The pocket lays only the axe. Pell drops the basket offer and keeps the existing axe row (`content/core/shops/trader-shop.json:9-25`). New items use the calculator price when they land. If Q2 passes, the quest gives the satchel (2.2). The three school icons need item references that survive P02. The basket sprite stays for the two bags** | rules touched: G103 and the G59 world lock (GAME_RULES section 6) govern the axe-only pocket. The proposal keeps the first task a herb picked on the bank and keeps the existing opening legs. Q2 holds the reward choice under G4 | P02, P03, P04 | none: decided; its reward goes in Q2 |
| 2.5 | Travel's carrying nodes | on paper | PROGRESSION 4.8 (`load_pct`, `load_step_pct`, `edge_pct`, `belt_tools`) | WoW none (FB:W8); Albion mounts and food for load (unchecked); Valheim a belt +150 weight for 950 coins (FB:V5); OSRS a weight-reducing outfit (unchecked); New World weight perks on gear (unchecked) | no Travel school; the load is built | the paper only | **the first four Travel nodes, `load_pct` 20 (human 30), `load_step_pct` 75, `edge_pct` 50, `belt_tools` 1, as PROGRESSION 4.8 gives them** | Travel L1-10; no shop | P22 | none |
| 2.6 | Storage at home | in code | DECISIONS 2026-10-23 (the storage chest); QUARRYING (stone store, `bag_bonus` 20) | OSRS a bank (FB:O11); Valheim a chest of 10 wood (FB:V4 container row); Stardew a chest of 50 wood (FB:T5); Vintage Story a reed chest (FB:S5) | `storage-chest` camp part (3 logs and 4 stone, `bag_bonus` 10) | none | keep it; the stone store follows QUARRYING | camp | none | none |

### S3. The carried kit and raw materials

The manager's list was from memory. Checked against the seven games:
- Kept: fuel, shelter, food, healing, tools, weapons, light, rope, ammunition, fibre and cloth, ore and metal, clay.
- Ruled by the manager: boards.
- Dropped: a water vessel and a map item (3.10, 3.16).
- Added: bait (with fishing), the dressing blade, a fire starter, and a needle.

| # | Thing | State | 1 Paper | 2 Leaders | 3 Ours in code | 4 Gap | 5 Solution | 6 Integration | 7 Plan | 8 Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| 3.1 | Fuel | in code | PRODUCTION_MAP (a split log doubles fire time) | OSRS logs (FB:O2); WoW wood with flint and tinder (FB:W7); Valheim wood (FB:V4); Vintage Story 1 log split into 4 (FB:S4); Albion wood by weight (FB:A5) | log (axe), branch, `split-log` (1 log to 2 branch); the campfire takes 2 logs | none | keep it | valley trees d0 | none | none |
| 3.2 | Boards (F3, ruled by the manager) | decided | FINDING_BALANCE F3; the manager: no board now, it joins with the first tier-2 tool or camp piece that needs it | none in the first hours in four of seven; boards at tier 2 in Albion (6 a tool, FB:A5) and New World (FB:N2) | none | none now | **`core/plank` (t2) joins with the drying and tanning racks, the first t2 camp pieces that need it: 1 log to 2 planks at the workbench, Woodcutting-fed, Handcraft L3** | camp, workbench t2 | P16 | none |
| 3.3 | Shelter: the camp and the tent | decided | DECISIONS 2026-10-23 (the tent comes back as a portable inn: bought, a full night, the place a player returns to after death); 2026-10-19 (a fire anywhere) | no leader carries a tent: New World's camp is placed, from 5 wood and 1 flint (FB:N3); Valheim a bed under a roof (FB:V4); Vintage Story a hay bed (FB:S4) | campfire = a safe place (G30); no tent item | the decided tent is not built; two pages disagree (OPEN_WORLD against BODY_CLOCKS) | see S8 row 8.2 | none: row 8.2 covers where the tent fits | P18 | none |
| 3.4 | Food | in code | BODY_CLOCKS 7 (the valley: 12 ingredients and 16 dishes; 2 dishes count at once) | food is the healing in all seven games (FB 2, healing row); Valheim 3 food slots (unchecked); Stardew forage and Pierre (FB:T7) | 6 dishes (`berry-mash`, `grilled-fish`, `herb-stew`, `herb-tea`, `mushroom-skewer`, plus the berry); Pell sells 3 foods (temporary until the inn, DECISIONS 2026-11-12) | Cooking has no t2 or t3 (F5 fails) | **2 dishes at t2 and 2 at t3 from BODY_CLOCKS' valley list, so the food family passes F5** | the fire; Cooking L3 and L8 | P14 | none |
| 3.5 | Healing | in code | GAP_MATERIALS 6 step 6 (poultice 10, bandage 20, salve 30, kit 50, hunter's kit 70) | food and potions in WoW (FB:W1-W5); food alone in the other six (FB 2) | bandage (made, found recipe), first-aid kit (Pell or the reward in `content/core/quests/the-south-bank.json:24-31`) | thin: two rungs | **the remedies family opens with 3 rungs: poultice t1 (herbs), bandage t1 (moved in), salve t2 (herb and fat from the take). The kits stay bought or rewarded** | Cooking school, remedies family; the fat comes from the take (1.5) | P15 | none |
| 3.6 | Tools | in code | EQUIPMENT 2; PRODUCTION_MAP 4 | OSRS 11 pickaxes (GAP_MATERIALS S12); axe, pick and rod ladders in OSRS, WoW and New World (unchecked) | 13 tools in 7 kinds; the axe, rod and pick have only t1 | three gathering verbs have no tool ladder | **the axe ladder (flint axe t2, hafted stone axe t3) takes over the two basket recipes. Picks follow QUARRYING. The rod gets t2 with bait (3.12)** | workshop; Handcraft L3 / L8; tier speed +150 permille a tier (built) | P03 | none |
| 3.7 | Weapons | decided | WEAPONS, WEAPON_MATRIX; decision 42 (no weapon at the start) | all seven put a weapon in the first hours (FB 2) | none; a work tool strikes at 1050 permille (DECISIONS 2026-11-21) | apart, by decision | stays behind the gate (S9 row 9.2) | none: row 9.2 covers the combat gate | (#710) | none |
| 3.8 | Light | decided | DECISIONS 2026-11-12 (the torch: allowed, thrown, it lights a slow fire); G34 (gear answers a place's condition) | torch in Valheim (FB:V4), Vintage Story (FB:S4), Stardew (FB:T5), OSRS (FB:O9) | the lantern lights itself after dark (`params.light`); no torch | the torch is decided and not built | **the torch: a hand item with uses, made at the work stone from 1 branch and 1 resin (or 2 dry reed), Handcraft L1. It lights a radius in the dark below** | the south's dark (d1-d2); the valley needs none | P19 | none |
| 3.9 | Rope | on paper | GAP_MATERIALS 6 step 3 (rope = 3 reed cord at the work stone) | Vintage Story makes rope from vine or reed (FB:S4); OSRS sells it for 18 coins (FB:O10) | reed cord only | no rope; Climbing needs one | **`core/rope` joins with its first consumer, the rope crossing (`climb_reach`): 3 reed cord at the work stone** | the south's drops; Climbing L1 | P20 | none |
| 3.10 | A water vessel | missing | none: no page names it | no thirst meter, and no vessel carried early, in OSRS, Valheim or Stardew (FB 2); Vintage Story's bowls and buckets are kitchen things (unchecked) | none; the body has health and experience only (PROGRESSION 4.5, Q8a) | none | **dropped: with no thirst there is no carried vessel. A clay pot joins Cooking as a station part when clay gets its consumer (3.15)** | none: no carried vessel is proposed | none | none |
| 3.11 | Ammunition | decided | WEAPONS 6, Q4 (12.11: ammunition stays on the ground) | OSRS arrows (FB:O1); WoW arrows (unchecked) | none | by the gate | stays behind the gate (row 9.2) | none: row 9.2 covers the combat gate | (#710) | none |
| 3.12 | Bait | on paper | PROGRESSION 4.2 Fishing `bait_keep`; MATERIALS (borderline) | OSRS fishing bait and feathers (unchecked); Stardew crafted bait (unchecked); WoW lures (unchecked) | the rod (t1), cast spots | Fishing has no second rung | **bait (worms dug at the river bank with the trowel, d0) joins with the t2 rod: a cast with bait draws the rod's t2 rows** | river d0; Fishing L3 | P21 | none |
| 3.13 | Fibre and cloth | decided | DECISIONS 2026-11-12 (cloth queued: a fibre plant in the valley); CLOTHING 3 | WoW linen from drops (W8); Albion cloth (FB:A5); New World linen (CB 2) | reed cord, woven mat, dyed cord | cloth waits | keep the queue: cloth lands with its fibre plant, after the leather chain | valley d0; wear family | (queued) | none |
| 3.14 | Ore and metal | decided | DECISIONS 2026-11-12 (metal opens with the town's kiln and smithy; no mining split); MATERIALS_COUNT (copper T4 in the highland, tin T4 across the bay, iron T5) | OSRS bars at Smithing 1/15/30/50/70/85 (SV:S5); WoW brackets of 75 (SV:S7,S8) | none | by decision | keep the decision; S7 places each metal | city; east highland d1 | (queued) | none |
| 3.15 | Clay | on paper | MATERIALS_COUNT (clay T1 by the river, with no recipe); PROGRESSION `clay_eye` | Stardew clay from artifact spots, 10-48% (FB:T2); Vintage Story pottery (unchecked) | none | a material with no consumer | **clay lands with its first consumer, a fired clay pot (a Cooking station part that adds a second pot to a fire), at the town kiln** | river bank d0; Digging L3 | P21 | none |
| 3.16 | A map | missing | PROGRESSION 4.8 `map_wide`, `way_home`; Lore `map_mark` | the map is a screen, not an item, in OSRS, WoW, Valheim and Stardew (unchecked) | the game's map screen (built: `game/src/ui`) | none | **dropped as an item; the Travel and Lore sights stay on paper** | none: the map stays a screen | none | none |
| 3.17 | The dressing blade (added) | missing | HUNTING 6 (dressing steps) | Vintage Story cuts hides with a knife (FB:S4); WoW needs a skinning knife (FB:W5) | `dress` asks for no tool | none needed | **keep the dress toolless; the flint knife stays a weapon (only the spear is dual, #710)** | none: dressing needs no blade | none | none |
| 3.18 | A fire starter and a needle (added) | missing | none | a tinderbox in OSRS (FB:O1); flint and tinder in WoW (FB:W7); OSRS's needle costs 1 coin (CB 2) | the campfire needs only logs; sewing needs nothing | none | **dropped: neither adds a choice. A tool that is spent on every fire would be a chore (G15)** | none: neither tool is proposed | none | none |

### S4. The skill tree

| # | Thing | State | 1 Paper | 2 Leaders | 3 Ours in code | 4 Gap | 5 Solution | 6 Integration | 7 Plan | 8 Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| 4.1 | The catalogue: 22 schools in 5 groups | on paper | PROGRESSION 4.2; #559 (held since 30.10) | OSRS 23 skills (SV:S1); WoW 8 crafting and 3 gathering (SV:S7); FFXIV 8 plus 3 (SV:S19,S20); ESO 7 (SV:S23); GW2 9 (SV:S27) | 6 schools, 44 nodes (cooking 7, digging 9, fishing 7, foraging 7, handcraft 7, woodcutting 7) | 16 schools on paper only | **proposed school order: Travel and Survival first (the long way's schools), then Woodcraft, Mining, Remedies (as a family first), then Lore; the combat schools stay with the fight. #559 stays held** | each school's first meeting place is pending the S4 page | P22, P26 | none |
| 4.2 | Levels and the cap | decided | PROGRESSION 3.2 Q1 = C (25.10): 20 levels, t1 28 s, ratio 1.5, mastery at level 21 after 51.7 h | OSRS 1-99, 13,034,431 xp, half at level 92 (SV:S2); Stardew 10 levels, 15,000 xp (SV:S30); Valheim 1-100 (SV:S29); ESO 1-50 (SV:S23); GW2 500 (SV:S27); New World 200 to 250 (SV:S17) | `xp_levels` 8 thresholds: level 9 is the cap, reached in about 63-70 min | the built curve ends about 47 times short | **swap to the decided curve: 20 levels from the formula, one table for every profession (F2). `tier_min_level` becomes [1, 3, 8], so tiers 2 and 3 open after the same minutes as today (70 s and 15 min)** | all professions; tiers 4 and 5 at L11 and L16 when they open (matching the wear bands of PROGRESSION 5.6) | P11 | none: Q1 is decided |
| 4.3 | The pace: level 6 after 12-15 minutes | in code | professions `xp_levels` | OSRS level 10 within the first quarter hour (unchecked); Stardew level 1 on day 1 (unchecked); WoW profession 1-75 in an evening (unchecked) | L6 at 720-900 s of work | inside the leaders' feel at the start, and far too short at the top | the proposed change brings L6 from 12–15 min to 6.2 min and stretches the top. It keeps L3 at 70 s and puts the t3 threshold at L8 at 15 min (G41 tier bands) | as 4.2 | P11 | none |
| 4.4 | Set A families | decided | SKILL_FAMILIES 2 (picked 21.11); #776 brings the `family` key | the edge stays inside its family (SV side by side); WoW's specialisations (SV:S8); Albion's board (SV:S13) | none yet (#776 in flight) | none: #776 covers the pending family key | **the `wear` and `tools` groups now; `food` with the t2 dishes; `arms` with the weapon wave; `remedies` when it opens (P15)** | Handcraft, Cooking | P09 | none |
| 4.5 | `nodes_max` | on paper | SKILL_FAMILIES C8 (20); PROGRESSION 4.6 (60) | not found | 12 | two pages give different numbers | **20 now (C8), 60 when #559 builds the full schools** | params `growth` | P09 | none |
| 4.6 | Tier bands on the long curve | missing | PROGRESSION 5.6 (wear bands 1/6/11/16/21) against `tier_min_level` [1, 3, 6] | OSRS Smithing tiers at 1/15/30/50/70/85 (SV:S5); WoW brackets of 75 (SV:S7) | [1, 3, 6] on a 9-level curve | no page fits the tiers to the 20-level curve | **[1, 3, 8, 11, 16], with tiers 4 and 5 entering when `open_tiers` grows** | as 4.2 | P11 | none |
| 4.7 | Travel, a full school | on paper | PROGRESSION 4.8 (32 nodes, 13 reserved) | Valheim run and jump skills (SV:S29); OSRS Agility (SV:S1) | none | the paper only | first 8 nodes (row 2.5 plus `ford`, `scramble`, `path_read`, `way_home`) | the first map's crossings | P22 | none |
| 4.8 | Survival and Climbing | on paper | PROGRESSION 4.2 | Valheim none; New World none; ESO none (SV) | none | the paper only | see S8 row 8.4 | none: row 8.4 covers Survival and PROGRESSION 4.2 covers Climbing | P26 | none |
| 4.9 | Respec | decided | GROWTH; PROGRESSION 6.3 (limited respec, 3 free uses) | PoE 2 refund by gold per point (SV:S31) | none | not built | **build `unlearn` as decided. The fee is set by a rule when the respec lands (open)** | the elder or the trainers' stall | P23 | fee rule open |
| 4.10 | Books teach one node | on paper | GROWTH (a book teaches one node, never sold) | ESO skill books (unchecked); Albion none (SV:S13) | none | the paper only | after P09: one book per family group, found as a rare in a region's ruin (row 1.6) | region ruins | P13 | none |

### S5. Making

| # | Thing | State | 1 Paper | 2 Leaders | 3 Ours in code | 4 Gap | 5 Solution | 6 Integration | 7 Plan | 8 Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| 5.1 | Stations | in code | PRODUCTION_MAP; HUNTING 7 (racks); decision 51 (the forge only in the city) | Valheim workbench and forge with upgrades (SV:S29); ESO stations by site (SV:S26); Albion refining and crafting stations (CB 2) | fire, work stone t1, workbench t2, workshop t3 | racks proposed; no kiln | **the drying rack and the tanning rack (t2 camp pieces, planks: 3.2) join with the hide chain; the kiln and forge come with the city** | camp; the city | P16 | none |
| 5.2 | Route length: tools, arms, food, remedies | missing | CLOTHING_BALANCE 3 is the pattern (clothing only) | first piece 7-27 min, first outfit 30-90 (CB 2) | recipe steps have inputs and active times in `content/core/recipes/`: flint trowel (4 s, 2 stone flakes and 1 branch, `flint-trowel.json:26-44`); grilled fish (4 s, 1 river fish and 1 branch, `grilled-fish.json:24-42`); bandage (3 s, 2 herbs and 1 reed cord, `bandage.json:24-45`). Arms have no recipe in that directory | no measure outside clothing | **measure one route per family from its sources and recipes. The proposed target for time to a first t2 piece is within a factor of two across the families (an F3 twin for time, within G41's tier bands)** | none: route times and places await measurement | P10 | none |
| 5.3 | Parity checks F1-F6 | decided | SKILL_FAMILIES 2.3 (with set A) | Albion: a chest costs 16 refined units and a head 8 in every family (CB 7) | none | not built | **F1-F6 in `pnpm check`; wear passes once P3 and C5 land** | `tools/src/schools.ts` | P10 | none |
| 5.4 | The leather chain's length (P3, C5) | decided | CLOTHING_BALANCE 8 P3; SKILL_FAMILIES C5 | 2 to 4 prep steps (CB 2) | not built | 5 steps | scrape and tan as one 6 s step; one thread on the jerkin and the leggings | workshop | P06 | none |
| 5.5 | The pieces per place (hands, legs, reed t1) | on paper | CLOTHING_BALANCE 5.4 (ranked list) | 2.5 to 4 a place (CB 5.2) | 1.8 a place after the wave | thin | ranks 1-3 with the wave (gloves, reed cape, boiled-leather leggings) | as CLOTHING | P06 | none |
| 5.6 | Gear's look rising with tier (the owner's later input, #772) | missing | none (#772 holds it for after the first three sets) | WoW's tier sets have unique models (unchecked); GW2 legendaries carry moving effects (unchecked); FFXIV dyes on most gear (unchecked); OSRS gives the top dragon pieces their own look (unchecked); PoE 2 gives unique items their own art (unchecked) | sets own their bonus (DECISIONS 2026-11-20) | no look ladder | **a look ladder in pixels: t1-t2 plain ramps; t3 a trim accent (a second ramp on the edges); t4 its own silhouette detail; t5 and named rare sets a 2-4 frame idle shimmer on one accent (the dragon-scale case). Dye on cloth and reed only (decided). The knit cap and the face mask join the head place at t2 (cloth) and t2 (leather), no new place** | head place; cloth waits for its fibre | P24 | none: recorded for #772 |
| 5.7 | Quality grades | on paper | PROGRESSION 5.3 (plain, fine, true, master); CLOTHING 9 | Albion 5 levels (CB 5.3); New World gear score (CB 5.3) | none | waits for `quality_pct` | stays after the wave (the first family major waits for it) | none: quality waits for the family wave | (after P09) | none |
| 5.8 | The try (discovery at the bench) | on paper | WEAPON_MATRIX 7 | ESO research by time (SV:S24) | none | needs a core schema change | with the weapon wave | none: the try waits for the weapon wave | (#710) | none |
| 5.9 | Mend | decided | EQUIPMENT 3.4; WEAPONS 7 (tools mend at a bench with a whetstone) | Don't Starve and Valheim repair at a station (GAP_MATERIALS T8, (unchecked) for Valheim) | tools wear by uses; no mend | not built | **mend at the workbench: a whetstone (1 slate) or 1 cord brings a tool under 500 permille back to full** | workbench | P25 | none |

### S6. Shops and buying

| # | Thing | State | 1 Paper | 2 Leaders | 3 Ours in code | 4 Gap | 5 Solution | 6 Integration | 7 Plan | 8 Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| 6.1 | Who sells what | in code | DECISIONS 2026-11-12 (shops by the city's grade, up to grade 5); decision 32 (the cook sells food) | OSRS general store at 1-20 coins (FB:O6); Stardew's Pierre (FB:T7); Valheim's trader 1500 m out (FB:V5) | Pell sells the basket, trowel, axe, walking staff, satchel, three foods and first-aid kit (`content/core/shops/trader-shop.json:9-47`). Buy-back requires an item definition and a calculated value. The trader refuses raw hunt goods and payouts below one coin. This applies to found tools too. The tool in hand sells last, with the payout for a tool with uses reflecting the share of uses left (`kernel/src/step.ts:1099-1134`) | one shop | **after P02, Pell drops the basket and keeps the axe, trowel and walking staff offers. Pell's new clothing shelf (6.4) and the city's grade shops use the calculator for new item prices when the items land** | the valley; the city | P02, P08 | none |
| 6.2 | The purse over time | in code | FINDING_BALANCE 1.2 (31.8 to 61.8 gold at 16.4 min) | Stardew starts with 500g (FB:T1); OSRS with 25 coins (FB:O1) | measured: the explorer ends at 16.5 min with 31.8 gold (`pnpm map:playtest`, seed 1) | most of the purse is one quest's 30 | if Q2 passes, the quest makes the satchel available to players who cannot afford Pell's offer (2.2) | none: the purse measurement is a baseline | P04 | none |
| 6.3 | The first bag at the calculated floor | decided | DECISIONS 2026-10-23 (the owner kept the calculated floor) | Stardew's first bag is 4 times its start (FB:T1,T7); WoW's a few silver (FB:W4) | Pell sells the satchel at the R8 floor for a value of 29,000 (`kernel/src/values.ts:316-319`, `content/values.lock.json:33`, `content/core/shops/trader-shop.json:14-17`) | 5 to 9 times the purse | Pell keeps the calculated floor. The proposed quest reward waits for Q2 (2.2) | Pell | P04 | in Q2 |
| 6.4 | Pell's clothing shelf (R1) | decided | CLOTHING_BALANCE 9 Q1 (yes, 21.11) | OSRS sells clothes at 5 to 17.5 times the make cost (CB 2); Vintage Story's clothing trader (CB 2) | none | not built | one plain t1 piece per body place at the R8 floor | Pell | P08 | none |
| 6.5 | Sinks | on paper | GAP_RS_GEAR 3 (no trade tax; gold leaves through what the world sells); PROGRESSION 6.3 (respec) | WoW repairs and training fees (unchecked); Albion market tax (unchecked); OSRS GE tax (unchecked) | shop purchases only | few sinks after the first bag | **sinks with a use: respec (3 free uses, then a fee set by a rule when the respec lands (open)), the inn's night and the tent, a trowel or axe bought again, the city's grade shops. No tax (a player-set rule)** | Pell, the inn, the elder | P18, P23 | none |
| 6.6 | Buy-back | in code | kernel sell rule | OSRS sells back below the buy price (CB 4.5: ratio 2) | raw 5 times value, made 7.5 times; the item definition, calculated value, raw hunt exclusion and tool wear follow 6.1 | buy 10, sell 7.5: a ratio of 1.33 | keep it | none: buy-back keeps its current rule | none | none |

### S7. The curve across the world

| # | Thing | State | 1 Paper | 2 Leaders | 3 Ours in code | 4 Gap | 5 Solution | 6 Integration | 7 Plan | 8 Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| 7.1 | Tier and difficulty by distance | on paper | OPEN_WORLD (d = steps / 64); FIRST_MAP (the valley d0, the east d0-d1, the elf wood d2, the bay d2, the undead south d1-d2); SETTLEMENT (difficulty 1.5 times a level) | Albion tiers rise by zone (unchecked); WoW zones by level band (unchecked); Valheim biomes in order, the world as the gate (SV:S29) | `danger` on map areas (0-1); only the valley has content | no single table ties tier, d and material | **one table: a region's gathered goods are of tier d + 1 (t1-t3 up to d2), its hazards at grade d, and its recipes in the same band. Tier 4 and up wait for metal and the next land** | FIRST_MAP regions | P13, P25 | none |
| 7.2 | The race lands | on paper | FIRST_MAP (the elf wood d2, the undead south d1-d2, the city of all three races on the west bank); G70 (home always strong) | WoW starting zones per race (unchecked); ESO alliance zones (unchecked) | race grades in content (G70) | the lands hold no goods yet | each race land follows 7.1 and its own card (row 1.6) | none: row 7.1 sets the bands and row 1.6 names each region's goods | P13 | none |
| 7.3 | The gear tier by place | on paper | CLOTHING 5 (t2 gate rubble, t3 deep ruins, t4 mail with metal) | (as 7.1) | t1-t3 open (`open_tiers` 3) | none: CLOTHING 5 names the tier and place | as written; t3 pages also in each d2 region's ruin | none: the solution supplies the ruin placements | P07, P13 | none |
| 7.4 | Harsh grades by place | on paper | BODY_CLOCKS 5.2 (grades 0-4 with proposed hourly health drain); PROGRESSION 4.5 | Valheim's cold and wet need gear (unchecked) | the grade drain values exist in `content/core/params.json:1095-1101` | [G32](GAME_RULES.md#L368-L381) bars health drain by the clock, including the proposed hourly drain | **open: needs the manager.** Decide how harsh grades affect health within G32 and how gear answers the place's conditions under G34 (row 8.3) | regional effects wait for Q4 | P27 waits for Q4 | Q4: health effects in harsh places within G32 |
| 7.5 | Quests outside the valley | missing | EXPERIENCE_AUDIT M8; #582 | comparisons pending the S7 page | 0 of 15 outside the 64 by 64 | the world is empty of quests past the valley | **#582 builds them; each region gets 2 quests that pay in its own goods (G4)** | each region | (#582) | none |

### S8. Shelter and survival

| # | Thing | State | 1 Paper | 2 Leaders | 3 Ours in code | 4 Gap | 5 Solution | 6 Integration | 7 Plan | 8 Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| 8.1 | The camp as shelter | in code | G30; DECISIONS 2026-10-23 (the campfire is the safe log-out) | New World's camp is a placed shelter (FB:N3); Valheim needs a fire and a roof (FB:V4) | campfire, storage chest, work stone, workbench, workshop | none | keep it | anywhere a fire may burn | none | none |
| 8.2 | The tent | decided | `DECISIONS.md:2961-2965` (the owner made the pitched tent an exception to G33), alongside G30's rule for a burning camp | no leader carries a tent early (FB 2) | none | G33 gives the last town as the usual return point; the recorded tent exception is still on paper | **a burning campfire gives safety under G30. A bought, pitched tent gives a full night's sleep and is where the player wakes after death, as G33's recorded exception. The outing's pack still lies at the death site** | sold by the inn (city) at the R8 floor; Survival `tent_quick` | P18 | none |
| 8.3 | Weather and harsh places | on paper | BODY_CLOCKS; PROGRESSION 4.5 | comparisons pending the S8 page | `params.light` handles darkness; `kernel/src/reactions.ts:164-176,194-201` gives the regional sky | [G32](GAME_RULES.md#L368-L381) bars health drain by the clock, including the hourly drain in BODY_CLOCKS 5.2 | **open: needs the manager.** Decide how harsh regions affect health within G32 and how gear answers their conditions under G34 (row 7.4) | proposed for d1-d2 regions, pending Q4 | P27 waits for Q4 | Q4: health effects in harsh places within G32 |
| 8.4 | The Survival school | on paper | PROGRESSION 4.2 (`weather_read`, `tent_quick`, `camp_quick`, `dark_sight`, `fall_soft`) | none of OSRS, WoW, Valheim or Stardew has one (SV) | none | the paper only | **its first 7 nodes with the harsh grades (P27)** | the first harsh region | P26 | none |
| 8.5 | Sleep and the rest mend | decided | DECISIONS 2026-10-23 (the skeleton's double mend waits for a rest) | Valheim's rested buff (unchecked) | `restMendPermille` held in the kernel | not wired | with the tent and the inn | none: rest mend follows the tent and inn | P18 | none |

### S9. Only the rows where another system leans on the combat gate

| # | Thing | State | 1 Paper | 2 Leaders | 3 Ours in code | 4 Gap | 5 Solution | 6 Integration | 7 Plan | 8 Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| 9.1 | What could leave the gate under Q1 | on paper | the owner, 21.11 (the exploration rule above); HUNTING 5 T0-T1; GAP_MATERIALS 6 step 1 | (row 1.4) | `kernel/src/hunt.ts:2-5` lays carcasses only "once the combat rules land" | the hide chain, leather family and hunter's first task need a source of hide. Finding the pages is open to exploration under 1.4 | **if Q1 passes, bring the T0–T1 small-game take, the t1-t3 hide chain, the leather family's nodes, the hunter's first task (R2) and Hunting's gathering nodes (`track_read`, `harvest_yield`) before combat. Predators stay hazards under G34/G35** | the valley's meadows | P05 and P06 wait for Q1; P07 covers the pages | Q1: whether the small-game take and its progression come before combat |
| 9.2 | What stays behind it | decided | G35; WEAPONS; COMBAT | comparisons pending the S9 page | `combat.enabled` 0 | none | the fight, the weapons, ammunition, the quiver, the Strike, Aim and Guard schools, the `arms` family, found-weapon bonuses, `guard_pct`, `quiet_wear`, predators as foes, the sling and bow T2-T4 takes | none: availability waits for the combat gate | (#710) | none |

## 2. The pages that already answer each row

| Row | Pages |
|---|---|
| 1.1 | FINDING_BALANCE 1.1-1.2; SEARCH |
| 1.2 | FINDING_BALANCE 1.3, F2 |
| 1.3 | DECISIONS 2026-11-12 (the weapon table); CLOTHING 6; WEAPON_MATRIX 7 |
| 1.4 | CLOTHING_BALANCE 4.6 (R3), 8 (P1), 9 (Q2) |
| 1.5 | GAP_MATERIALS 4 and 6 (step 1); HUNTING 5; HUNT_LADDER |
| 1.6 | BODY_CLOCKS 7; EXPERIENCE_AUDIT (N1, M8); WEAPON_MATRIX Q6; FIRST_MAP |
| 1.7 | FINDING_BALANCE 1.3 |
| 1.8 | GAP_RS_GEAR 9, Q1 |
| 2.1 | DECISIONS 2026-10-23 (bags, weight, the owner's answers on the bag); FINDING_BALANCE 3 |
| 2.2 | FINDING_BALANCE 3, F1 |
| 2.3 | DECISIONS 2026-10-23; EQUIPMENT 3.2 |
| 2.4 | none before this page (the owner's word of 21.11) |
| 2.5 | PROGRESSION 4.8 |
| 2.6 | DECISIONS 2026-10-23; QUARRYING |
| 3.1 | PRODUCTION_MAP |
| 3.2 | FINDING_BALANCE F3 |
| 3.3, 8.2 | DECISIONS 2026-10-19, 2026-10-23; OPEN_WORLD; SETTLEMENT; BODY_CLOCKS |
| 3.4 | BODY_CLOCKS 7; DECISIONS 2026-11-12 (materials) |
| 3.5 | GAP_MATERIALS 6 (step 6) |
| 3.6 | EQUIPMENT 2; PRODUCTION_MAP 4; QUARRYING |
| 3.7, 3.11, 9.2 | WEAPONS; WEAPON_MATRIX; COMBAT |
| 3.8 | DECISIONS 2026-11-12 (the torch); GAP_MATERIALS Q6 |
| 3.9 | GAP_MATERIALS 6 (step 3); PROGRESSION 4.5 (drops) |
| 3.12, 3.15 | MATERIALS_COUNT; PROGRESSION 4.2 |
| 3.13 | CLOTHING 3, 18; DECISIONS 2026-11-12 (clothing) |
| 3.14 | QUARRYING; MATERIALS_COUNT; DECISIONS 2026-11-12 (quarrying) |
| 3.10, 3.16, 3.17, 3.18 | none (added or dropped by this page) |
| 4.1-4.10 | PROGRESSION 3-6; SKILL_FAMILIES; GROWTH; PATHS |
| 5.1 | PRODUCTION_MAP; HUNTING 7 |
| 5.2-5.5 | CLOTHING_BALANCE; SKILL_FAMILIES 2.3 |
| 5.6 | none (#772 holds the owner's note) |
| 5.7 | PROGRESSION 5.3; CLOTHING 9 |
| 5.8 | WEAPON_MATRIX 7 |
| 5.9 | EQUIPMENT 3.4; WEAPONS 7 |
| 6.1-6.6 | FINDING_BALANCE 1.2, 3; CLOTHING_BALANCE 4.5-4.6; GAP_RS_GEAR 3; PROGRESSION 6.3 |
| 7.1-7.5 | OPEN_WORLD; FIRST_MAP; SETTLEMENT; BODY_CLOCKS; EXPERIENCE_AUDIT; CLOTHING 5 |
| 8.1-8.5 | G30; BODY_CLOCKS; PROGRESSION 4.2, 4.5; DECISIONS 2026-10-23 |
| 9.1 | HUNTING; GAP_MATERIALS; CLOTHING_BALANCE 8 (P1) |

## 3. The plan in code

Pending step 3 of #784. Each row's plan id points here for its build order, files, tests and line estimate.

## 4. Owner questions

Question cards are pending step 4 of #784. The open questions are below.

- **Q1.** Should the T0–T1 small-game take and its progression come before combat, with predators still hazards under G34/G35 (rows 1.5, 9.1)?
- **Q2.** Should `a-whole-one` give the satchel in place of the basket under G4 (rows 2.2, 2.4, 6.3)?
- **Q3.** What should the main dig table give, and at what odds, to guarantee the one unit per completed interval required by [G15](GAME_RULES.md#L148-L152)? Does the separate proposed bonus roll fit that rule and G42's shared rarity budget (rows 1.2, 1.8)?
- **Q4.** How should harsh regions affect health within [G32](GAME_RULES.md#L368-L381), which bars drain by the clock, and how should gear answer those conditions under G34 (rows 7.4, 8.3)?

The respec fee rule is also open (rows 4.9, 6.5).

## Appendix A. Every thin thing, traced to its row

Pending step 2 of #784. The inventory will trace the thin things named by the three balance pages and PROGRESSION to their map rows.
