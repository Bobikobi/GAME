# Clothing balance: the route to a worn piece, measured against seven games (2026-11-21)

Status: a measure and proposals (#769). Nothing on this page moves a locked value, writes a price, or bends a rule of GAME_RULES. Each change of that kind is an owner question in section 9.

The owner, 21.11: "בניית ביגוד וקניה שלו ושלבי ההכנה צריכים להיות מאוזנים שלא בהכרח יהיה מסלול ארוך או קצר מידי, תשווה כמו במשחקים דומים". Later the same night he asked whether making was also compared with buying and finding, and what about the variety of what can be made. He also said the clothing tree may not be harder to develop than the other families. This page answers all three.

**In short.**

| Measure | The band of the games | Loomvale |
|---|---|---|
| First worn piece | 7 to 27 minutes of play | 3.6 minutes of active play (4.4 pass, 0.8 of them waiting on a node): short. With the planned day of curing, 24 minutes have passed |
| First outfit | 30 to 90 minutes of play | the tier-1 kit takes 7.4 minutes of active play (8.7 pass): short. The first bonus set takes 13 to 16 minutes of play, and 64 minutes pass (median) when its recipes are dug up |
| Ways to get a piece | every game but one gives two or three ways (make, buy, find) | making only. Buying and finding are missing |
| Pieces per body place by the end of tier 2 | 2.5 to 4 | 1.8: thin. The hands have none |
| Clothing against the other families | - | the same levels and the same minutes to each tier. A tier-1 leather piece has one step more, 2.4 to 2.8 times the work of another tier-1 Handcraft good, and 3 to 4 times its value. One step less (P3) brings the work inside twice its tier; most of the value gap is the hide, that is the hunt |

The recommendation is one line. Keep the work per piece as it is, because the parity with the other families matters more than the band. Let the route's length come from the found scraps and the day of curing. Open the buy and find routes at tier 1 (questions 1 and 2), and close the variety gaps by the ranked list in section 6.

## 1. How it was measured

- **The games.** Seven games: Old School RuneScape (OSRS), World of Warcraft Classic (WoW), Albion Online, New World (NW), Valheim, Vintage Story (VS) and Stardew Valley. They were chosen because each has early worn gear made from hide, fibre or cloth, and together they span a fast game (OSRS), a quest-led MMO (WoW), market MMOs (Albion, NW), survival crafting (Valheim, VS) and a farm game (Stardew).
- **What a number is.** Minutes are minutes of active play by someone who knows the way, from the moment the player is free to act. That moment is after the tutorial: OSRS from the mainland, WoW at level 5, Albion after its tutorial. Waits (curing, respawns) are listed apart. Loomvale's own rows give two figures: **passed**, every minute from the morning after the opening, node waits and the night included, and **active**, passed minus the waits on nodes and the night; the comparison with the games uses active. Every number has a source in section 11. A number marked **ESTIMATE** is a judgement written from the sources, and **(unchecked)** marks one taken from memory or from a search summary without a fetched page.
- **The band.** For each game take the middle of its range, sort the games, and drop the shortest and the longest. The band runs from the second-shortest to the second-longest. One odd game cannot move it.
- **Loomvale's row.** The route was played on the kernel itself by `pnpm exec tsx tools/src/balance/clothing-route-cli.ts [--seeds 1,2,3] [--found]` (tools/src/balance/clothing-route.ts). It is a measuring tool. It reads the tier-1 hide chain from the content, adds only the tier-2 rows that are still a proposal to a copy of the world (their values from the calculator), lays the carcass as the hunt fields state (the route plays the take as the animal's `take_s` at its spot; the thrown stone of #827 takes small game in the game, and the route does not play it yet), and plays every other step through `step`: walking tile by tile, gathering, building, crafting with its chance and misses, dressing and wearing. It writes nothing. Values come from the calculator (kernel/src/values.ts, through `pnpm check`).
- **The run.** The route starts the morning after the opening: the forager's opening takes 7.0 minutes, then the night is waited out (8.3 minutes), because a camp wolf kills at night. Then it goes on to:
  - the first piece: the hare-leather shoes
  - the tier-1 kit: hood, jerkin, leggings and shoes
  - the first bonus set: "digger leathers", a boiled-leather cap and boots
  
  Without `--found` the tier-2 recipes are known from the start. With it they are dug up at the gate rubble as CLOTHING 6 designs: four scrap rows at chance 5, a trowel bought again when one wears out, the shards and coins sold to pay for it.

## 2. The games, link by link

One row per game for its first cloth or leather piece and its first full outfit. "Prep steps" counts the actions from the live animal or plant to the worn piece, side steps included.

| Game | Prep steps | Stations and tools | First piece (active min) | First outfit (active min) | Buy against make | Waits | Travel |
|---|---|---|---|---|---|---|---|
| OSRS | 4: kill a cow, pick up the hide, tan at a tanner (1 coin), sew with needle and thread | none; needle 1 coin, thread 1 coin per 5 pieces | 3 to 5 | 60 to 120 for the 6 leather pieces, mostly levelling to Crafting 18 | shop price 5 to 17.5 times the make cost (gloves 6 coins, body 21) | none (cows respawn in 27 s) | a toll gate (10 coins) or a walk to the tanner |
| WoW Classic | 4: kill, skin, 3 scraps to 1 light leather, sew | none (craft anywhere); trainer fee | 5 to 9 | 17 to 48 for 6 pieces (19 light leather) | no vendor sells the same crafted green. Vendor whites trail by 5 to 15 armour | none | trainer in town |
| Albion | 3: skin, tan (1 hide to 1 leather), craft (16 leather a jacket, 8 a hood or shoes) | a refining station and a crafting station (names unchecked); the Destiny Board unlock | 8 to 22 (ESTIMATE) | 12 to 40 (ESTIMATE) | no NPC shop for armour; the player market. Price unknown | none | city stations |
| New World | about 8: skin, tan (4 rawhide to 1 leather), weave, smelt, then the outfitting station | tannery, loom, smelter, outfitting station | 8 to 30 (ESTIMATE) | 45 to 190 (ESTIMATE) | the player market, prices not read | none | town stations |
| Valheim | 2: kill and loot, craft (no tanning) | workbench (10 wood); level 2 for leather | 19 to 34 (rags); 26 to 42 (leather) | 34 to 64 (rag set); 58 to 106 (3 leather pieces) | nothing sold (Haldor sells no armour) | none | none |
| Vintage Story | 1 for rawhide (cut raw hides with a knife); 5 for leather | none for rawhide; barrels and lime for leather | 20 to 35 (rawhide) | 30 to 55 (rawhide) | the clothing trader: gambeson 56 gears a set. Make cost in gears not computable | rawhide none; leather 400 real minutes of soaking and tanning | find a trader first |
| Stardew | cloth: wool, the loom (4 game hours), the sewing machine | loom (Farming 7), Emily's sewing machine | 15 (cloth by mail or cart) to hours | not comparable (clothes carry no stats; boots cannot be made) | cloth sells 470 g against a 1000 g shirt: about 2.1 | loom 4 game hours | - |

**The band, link by link.** Stardew is left out of the minutes, because its made clothes carry nothing and its boots cannot be made.

| Link | Middle of each game, sorted | Band |
|---|---|---|
| Prep steps | VS rawhide 1, Valheim 2, Albion 3, OSRS 4, WoW 4, NW 8 | 2 to 4 |
| Stations before the first piece | OSRS 0, WoW 0, VS 0, Valheim 1, Albion 2, NW 2 | 0 to 2 |
| First piece, active minutes | OSRS 4, WoW 7, Albion 15, NW 19, Valheim 26.5, VS 27.5 | **7 to 27** |
| First outfit, active minutes | Albion 26, WoW 32.5, VS 42.5, Valheim 49, OSRS 90, NW 117.5 | **about 30 to 90** |
| Waits before the first piece | 0 in six games (VS leather: 400 minutes) | 0 |
| Shop price against make cost, where a shop sells the piece | Stardew 2.1, OSRS 5 to 17.5 | 2 to 17.5 (two games only) |

## 3. Where Loomvale stands, link by link

Seed 1, from the morning after the opening (`clothing-route-cli.ts --seeds 1,2,3,4,5`; seeds 1 to 5 agree within 0.2 minute):

*Re-measured 22.11 (#769), after the hide chain was built (#788, #797).* The first run of this page played a copy of the chain kept inside the route's own code (scrape 6 s, then tan 4 s). The route now reads the chain from the content: scrape and tan are one 6 s action, and the roe jerkin and leggings take one thread. The route also sets out only in the hours of the day (the bank wolf walks the road by night), so the first set now passes one night. What moved: the kit 9.0 to 8.7 (active 7.7 to 7.4), the known set 21.3 to 24.3 (active 13.4 to 13.1), the dug-up median 64.1 to 64.2. The first piece is unchanged.

*Checked again 23.11 (#769), after early hunting landed (#827, 520e3444).* Nothing moved: the first piece 4.4, the kit 8.7 (7.4 active) and the known set 24.2 to 24.4 on seeds 1 to 5 (24.3 on seed 1), seed 16 found 39.8, and the dug-up median 64.2 (28.9 to 208.6) on seeds 1 to 20, all as before. The reason is that the route still takes an animal the way the hunt fields state it, standing at its spot for its `take_s`; it does not throw the stone or set the snare. A route that throws at the hare (40 s at its spot today) may well be shorter, so the figures stand as the route of the hunt fields, not yet of the thrown stone; the roe (a medium animal, 90 s) is not taken by the stone. **The dug-up median goes stale when the dig rule lands** (DECISIONS 2026-11-22, "Digging: areas with a winning pattern"): it rests on today's digs of the gate rubble and is not re-measured before then.

| Milestone | Minutes passed (active) | Where the time went |
|---|---|---|
| First piece worn (hare-leather shoes) | 4.4 (3.6 active) | hunt 2.6, walk 0.3, gather 0.3, craft 0.4, waiting on a node 0.8; Handcraft level 2 |
| Tier-1 kit worn (4 pieces) | 8.7 (7.4 active) | hunt 5.2, walk 0.6, gather 0.6, craft 1.0, node 1.2 |
| First set worn, recipes known from the start | 24.3 (13.1 active) | hunt 8.8, walk 1.2, gather 1.0, craft 2.0, node 2.1, night 9.2: 13.1 active |
| First set worn, recipes dug up (`--found`, seeds 1 to 20) | median 64.2 (28.9 to 208.6) | active median 15.8 (13.9 to 25.2); waiting on the rubble median 21.3; night median 26.7; digs median 36.5 (9 to 160) |

| Link | Band | Loomvale | Verdict |
|---|---|---|---|
| Prep steps to the first piece | 2 to 4 | 4 on the main line: hunt, take, scrape and tan (one action since step C, #797), sew. Two side steps: knap flakes, twist sinew thread | inside (was 5, **too long** by one step, before step C) |
| Stations | 0 to 2 | the work stone (tier 1); the workbench (tier 2) | inside |
| First piece | 7 to 27 | 3.6 active (4.4 passed, 0.8 of it waiting on a node) | **too short** |
| First outfit | 30 to 90 | tier-1 kit 7.4 active (8.7 passed, 1.2 of it waiting on a node); bonus set 13.1 (known) or 15.8 active (found, median) | **too short** in work |
| First bonus set, minutes passed | 30 to 90 | 24.3 (known); 64.2 median (found) | known **too short**; found **inside** |
| Waits | 0 | the hide's day of curing, 20 real minutes (DECISIONS 2026-11-19; not built, so not in the run) | **long**, on the owner's own decision; passive |
| Travel | a few minutes (not measured for the games) | 0.3 to 1.2 minutes of walking | short |
| Shop price against make cost | 2 to 17.5 | a shop price is at least 10 times the value (R8; the satchel is sold at exactly 10). But no garment is sold | **missing** |

**Why it is short.** Each Loomvale step is a few seconds: scrape and tan together are one 6 s action (two, 6 s and 4 s, before step C), a sewing 5 to 7 s (CLOTHING appendix). In OSRS and WoW most of the first outfit's time is levelling: Crafting 18 for OSRS chaps, skill 25 for a WoW belt. Loomvale's tier-1 recipes sit at levels 1 to 2 by the band rule (`tier_min_level` [1, 3, 6], content/core/params.json). Handcraft reaches level 3 after 0.7 minutes of crafting and level 6 after 12 (content/core/professions/handcraft.json, `xp_levels`). The whole valley runs on this short clock. A cooked dish is worth 4 to 8 seconds of play, a tier-3 stone trowel 31.

**Why we do not lengthen the work.** To reach the band's lower edge for the kit (30 minutes), the kit would need about ten more hides, three or four a piece, since a roe takes about 2 minutes of play. A jerkin with three more roe leathers would be worth about 140,000 instead of 44,500, four times the dearest built Handcraft piece (the fine basket, 35,000). The owner's word of 21.11 puts the families on one footing (section 7), so that cost is not paid. The route's length comes from three things the games also use:
- the dug-up scraps (WoW's patterns: 24 of 51 leatherworking recipes up to skill 150 are found, not taught)
- the day of curing (VS's tanning, much shorter here)
- the routes beside making (section 4)

With the scraps and the curing, the first set's minutes passed sit inside the band; only the active minutes stay short.

**What the run leaves out.**
- The take verb: the run stands by the spot for the hunt's `take_s`. When combat opens, the hunt may include a fight and grow longer.
- The day of curing.
- The quest that opens the gate.

All three lengthen the route, so the measure is a lower bound.

## 4. Make, buy, find

### 4.1 Which routes exist at the early tiers

| Game | Make | Buy | Find or given |
|---|---|---|---|
| OSRS | every leather piece, 1 leather each | Thessalia: gloves 6, boots 6, body 21 coins; stock 10, back in about a minute | Adventurer Jon gives boots, gloves, cowl and chaps once; rare drops; ground spawns; clues |
| WoW Classic | trainer recipes and found patterns | vendor whites, 5 to 15 armour below the crafted greens | quest rewards and drops at equal armour, some better (Camouflaged Tunic 81 against Embossed Vest 62) |
| Albion | every piece, after a Destiny Board unlock | the player market; the tutorial sends the player there for a tier-2 head, chest and shoes | tutorial gear (tier-1 jacket and shoes), a tier-2 cape from a quest; drops about 0.1% a kill (ESTIMATE from the drop tables) |
| New World | 20 worn recipes at level 0 | the trading post; a faction shop for tokens (unchecked) | named tier-2 pieces from quests, chests and bosses, 275 to 300 gear score against a beginner crafter's 200 to 210 |
| Valheim | every piece | none | the rag tunic at the start; no armour found in chests (no page lists any) |
| Vintage Story | 179 pieces for anyone, 55 for the Tailor only | the clothing trader: 2 to 3 gears for plain pieces, stock 1 to 2 each | ruins, panning, fishing; 578 of 812 clothing rows cannot be made at all |
| Stardew | cosmetics only; boots cannot be made | the Adventurer's Guild: boots 500 to 700 g | the chest on mine floor 10 (leather boots), crates, fishing chests |

### 4.2 Share of a new player's worn pieces, first hours (ESTIMATE in every game)

| Game | Made | Bought | Found or given |
|---|---|---|---|
| OSRS | about 20% | about 30% | about 50% (Jon and the starter kit 45, drops 5) |
| WoW Classic | about 5% | about 10% | about 85% (quests 50, drops 35) |
| Albion | 10 to 25% | 35 to 50% (market) | 30 to 50% (start and quest 30 to 45, drops 0 to 5) |
| New World | 20 to 35% | 0 to 15% | 50 to 70% |
| Valheim | 95 to 100% | 0% | 0 to 5% (the start rag) |
| Vintage Story | 50 to 60% | 10 to 15% | 25 to 35% |
| Stardew boots | 0% | about 40% | about 60% |
| **Band** (drop the two ends) | **10 to 60%** | **0 to 40%** | **30 to 85%** |

### 4.3 Found against made at the same tier

- **The same item:** OSRS, Albion and Stardew boots. A dropped leather body is the crafted one. Albion drops use the crafted pieces' ids.
- **Roughly equal, different in kind:** WoW. Found greens match crafted greens in armour; a crafted piece can be chosen, a found one cannot.
- **Found is better:** NW early (275 to 300 against 200 to 210), and VS's found armour sets. NW's page itself names this a tension.
- **No found tier:** Valheim.

### 4.4 What keeps one route from making the others pointless

1. **Making is for growing, not for selling.** In OSRS a leather body's inputs cost more than the body sells for; people craft to level. In WoW a crafted white sells for less than its leather.
2. **Shops are cheap but thin.** OSRS stocks 10 and restocks slowly; VS's trader holds 1 to 2 of each, 12 items, about 35 gears.
3. **Found is rare, random or one-off.** Jon's gifts are once per account. Albion's drop rate is about 0.1% a kill. WoW's quest pieces cannot be targeted.
4. **Loot feeds making.** Albion's artefact and royal recipes eat a dropped item.
5. **The routes split by kind.** In Stardew stats live only on boots (found or bought); looks come only from tailoring.

### 4.5 Loomvale, as designed and as built

| Route | As built (develop 16445813) | As designed (CLOTHING) | Against the band |
|---|---|---|---|
| Make | reed hat and sandals (tier 2, known from the start), the lucky charm, the satchel, the traveller's cap (a look) | the hide chain: 4 tier-1 pieces (known, behind the combat gate), 3 tier-2 and 2 tier-3 (dug up), the woven reed coat (tier 3, dug up) | about 100% of what a player adds: **above the band** |
| Buy | the satchel (a bag) at 10 times its value; no garment | none | **missing** |
| Find or given | each race's start outfit (work clothes, light cloak, sandals, work boots, herb pouch, remnant amulet); no garment is found, only recipe scraps | none | **missing** for found; given at the start, as OSRS, Albion and Valheim give |

Two rules stand behind this:
- The trader pays 7.5 times the value for a made good and 5 times for a raw one, and refuses hunt goods raw (kernel/src/step.ts, the sell rule).
- A shop price is at least 10 times the value (R8, tools/src/check.ts).

So if a garment were sold, buying would cost 10 times the value and selling one back would bring 7.5: a ratio of 1.33, against OSRS's 2.

### 4.6 Proposals for the routes (before -> after)

| # | Before | After | Needs |
|---|---|---|---|
| R1 | No garment is sold | Pell sells one plain tier-1 piece per body place (head, top, legs, feet), at the shop floor, 10 times its value. That is OSRS's Thessalia and VS's clothing trader | a price written into the shop file by hand: **owner question 1** |
| R2 | No garment is found | When the fight opens, the hunter's first task pays one plain tier-1 leather piece, the same item a crafter makes. That is OSRS's Jon and Albion's tutorial cape | a quest pitch through the quest-designer skill when the gate opens; the owner picks among the pitches as usual. It moves no locked value |
| R3 | The tier-2 recipes are designed as dug up at the gate rubble, re-splitting its shares | The same, kept: it is the found route that brings the first set inside the band (section 3) | moves the shard, the coin and the stew scrap by up to 5%: **owner question 2** |
| R4 | (not written) | A found or bought piece is the same item as the made one, never better. That keeps making alive by choice and by growing, as OSRS and Albion do, and avoids NW's tension | nothing: a rule for the content pull requests (CLOTHING 6) |

With R1 to R3 the routes would sit at about 60% made, 20% bought and 20% found or given (ESTIMATE). Making sits at the top of its band (10 to 60%) and buying inside its band (0 to 40%). Finding stays under its band (30 to 85%) until the fight opens and R2 adds the hunter's quest piece.

## 5. Variety of making

### 5.1 Body place by family by tier: Loomvale after the wave

Made pieces with a worn effect, from CLOTHING's appendix and the built content. The traveller's cap is a look, counted apart.

| Place | Tier 1 | Tier 2 | Tier 3 | By the end of tier 2 |
|---|---|---|---|---|
| Head | hare-fur hood (fur) | reed hat (reed), boiled-leather cap (leather) | - | 3 |
| Top | roe-leather jerkin (leather) | fur-lined cloak (fur) | hardened jerkin (leather), woven reed coat (reed) | 2 |
| Legs | roe-leather leggings (leather) | - | hardened breeches (leather) | 1 |
| Feet | hare-leather shoes (leather) | reed sandals (reed), boiled-leather boots (leather) | - | 3 |
| Hands | - | - | - | **0** |
| **Total** | 4 | 5 | 3 | **9 over 5 places: 1.8 a place** |

By family to the end of tier 2:

| Family | Pieces | Places |
|---|---|---|
| Leather | 5 | 4: head, top, legs, feet |
| Fur | 2 | head, top |
| Reed | 2 | head, feet; no tier-1 piece at all |

### 5.2 The games at the same stage

| Game | Early made pieces | Places | A place | Note |
|---|---|---|---|---|
| OSRS | 7 (leather and hard leather); 11 with studded | 5 | 1.4 (2.2) | no back, belt or cloak |
| WoW Classic | 29 leatherworking, 25 tailoring by skill 100 | 9 | 3.2 (2.8) | colour variants are separate recipes |
| Albion | 12 at tiers 2 and 3 (cloth and leather) | 3 and a cape | 4 | 1 design per place and family a tier; 3 at tier 4 |
| New World | 20 at level 0 (linen, leather, iron) | 5 | 4 | |
| Valheim | 10 (rag, leather, troll) | 4 | 2.5 | |
| Vintage Story | 105 in the core places, the whole game | 7 | 15 | colour rows counted; not an early stage |
| Stardew | about 340 cosmetics, no stat piece | - | - | not comparable |
| **Band** (drop the two ends) | | | **2.5 to 4** | |

### 5.3 What multiplies a piece without a new recipe

| Multiplier | Games that use it | Loomvale |
|---|---|---|
| Colour, dye | WoW (dye as a reagent), VS (11 dyes), Stardew (dye pots); OSRS none | a hide's colour is final (owner, 12.11); dyed cord is built as a material; earth-dyed cord waits (CLOTHING 10) |
| Quality | Albion (5 levels), NW (gear-score roll), Valheim (4 item levels) | waits for `quality_pct` (CLOTHING 9) |
| Sets | Valheim troll set; none early in OSRS, WoW or VS | **built**: each set owns its bonus (reed-walker; DECISIONS 2026-11-20) |
| Traits, perks | NW (perks, sockets), Albion (enchant) | waits for G34 (CLOTHING 7.6) |
| Coat | - | the hide's coat per animal (CLOTHING 10), waits for M4 |
| **Count** | band of the games: 2 to 4 (OSRS 0, Valheim 2, VS 2, Stardew 2, WoW 3, Albion 4, NW 4) | **1 built**; 5 when the waits land |

### 5.4 Gaps, and the pieces that would close them (proposal only, ranked)

The gaps: the hands are empty, the legs have one piece to the end of tier 2, reed has no tier-1 piece, and fur covers two places.

| Rank | Piece | Family | Tier | Place | What it needs |
|---|---|---|---|---|---|
| 1 | hare-leather gloves | leather | 1 | hands | hare leather 1, sinew thread 1; known from the start, behind the combat gate. The hands place is built (#753) |
| 2 | woven reed cape | reed | 1 | top | reed cord 3; known from the start. It needs no hunt, so it can land while the fight is off. It would be the reed family's first rung below the tier-2 pair |
| 3 | boiled-leather leggings | leather | 2 | legs | boiled leather 1, sinew thread 1; dug up; a third piece of "digger leathers". The set row (a set never gives more than its pieces) must be checked again: a third piece at 5 may need the set's bonus to drop |
| 4 | hare-fur mittens | fur | 2 | hands | hare fur 1, sinew thread 1; dug up; the cold answer when traits land (G34) |
| 5 | reed leggings | reed | 2 | legs | reed cord 2, woven mat 1; known from the start like the built pair; a third reed-walker piece, with the same set-row check |

With ranks 1 to 3 the count would be 12 over 5 places, 2.4 a place: at the band's edge. With all five it would be 14, 2.8 a place: inside.

## 6. Specialising inside a craft, in other games

| Game | Can a crafter specialise? | What it gives | Exclusive? | When |
|---|---|---|---|---|
| OSRS | No. One Crafting skill for leather, gems, pottery and spinning. The Crafting Guild is a door, with no bonus | - | - | - |
| WoW Classic, Leatherworking | Yes: Dragonscale, Elemental or Tribal, each by a trainer and a quest | exclusive patterns only; no speed, no fewer misses | yes, one at a time; changing means dropping the profession (or a book at skill 200, as the Classic guide says) | character level 40 and skill 225 (from a later-era page; unchecked for 1.12). Far past the first tiers |
| WoW Classic, Tailoring | No (TBC added Mooncloth, Shadoweave and Spellfire at skill 350) | - | - | - |
| WoW Dragonflight | Yes: four trees per profession (Leatherworking: Discipline, Leather Armor, Mail Armor, Primordial), 750 points | crafting skill, Inspiration, Resourcefulness, Multicraft, and patterns per armour type | no: mix freely, but points are spent for good | from skill 25; points arrive by the week |
| Albion | Yes: the Destiny Board, one line per design under each place and family | focus efficiency (250 + 30 a level, from a weapon example) and quality (6 + 0.75 a level) | no: each line levels by its own use; time is the cost | tiers 2 to 4 are unlocked on the board |
| Vintage Story | Yes, by class at character creation: the Tailor | 55 recipes no other class can make; better armour repair | yes, chosen once; it costs three penalties | at the start |
| Valheim, Stardew, New World | No | - | - | - |

**What it means for Handcraft.** The games that specialise put it far past the first tiers (WoW at skill 225) or make it non-exclusive and paid by time (Albion, Dragonflight). Specialisation never makes a family's first pieces cheaper than another's. Loomvale's family nodes (CLOTHING 6.1) follow Albion and Dragonflight: non-exclusive, a small edge per family. Which families and how many nodes is the owner's pick of a family set (docs/design/SKILL_FAMILIES.md, next).

## 7. Parity: clothing against the built families

The owner, 21.11: "לגבי הפער של עיצוב הביגוד זה עץ נחמד אבל הוא לא יכול להיות קשה מידי לפיתוח לעומת שאר המשפחות". Measured by the calculator and the profession files.

| Family (profession) | Level for tier 2 / tier 3 | Minutes of that profession's work to tier 2 / tier 3 | Steps to its first tier-1 good | Value of a tier-1 good | Its tier-1 worn piece | Tree nodes in reach |
|---|---|---|---|---|---|---|
| Clothing, leather (Handcraft) | 3 / 6 | 0.7 / 12.0 | 4 recipe steps (flakes, scrape, tan, sew), the take, the thread | 32,390 to 44,500 per piece | 4 pieces (designed) | 7 of Handcraft's school + 4 proposed family nodes (held) |
| Clothing, reed (Handcraft) | 3 / 6 | 0.7 / 12.0 | 2 to 3 (cord, then the piece) | the tier-2 pair 15,200 and 20,932 | none at tier 1 | 7 of Handcraft's school |
| Stone tools and baskets (Handcraft) | 3 / 6 | 0.7 / 12.0 | 1 to 2 | 3,400 to 11,600 | the traveller's cap 10,500 (a look) | 7 of Handcraft's school |
| Food (Cooking) | 3 / 6 | 0.7 / 12.0 | 1 to 2 | 600 to 8,040 | - | 7 |
| Digging | 3 / 6 | 1.5 / 15.0 | - | - | - | 9 |
| Foraging | 3 / 6 | 1.0 / 13.3 | - | - | - | 7 |
| Fishing, woodcutting | 3 / 6 | 1.3 / 13.7 | - | - | - | 7 each |

**Reading it.**
- **Levels and minutes are equal.** Clothing is Handcraft, so its tiers open at the same levels and after the same minutes as stone and baskets, and as Cooking.
- **The craft side is heavy for its tier.** The Handcraft actions in a pair of leather shoes take 19.5 s: knapping the flakes 3, a scrape of 6, a tan of 4, half a thread of 1.5, a sewing of 5. The jerkin and the leggings take 22 s. Handcraft's other tier-1 goods take 2 to 10.5 s, with a median of 8 s: the hammerstone, the fishing rod, the knapped pick, the bandage and the traveller's cap. A cooked dish takes 3 to 6 s. So a tier-1 leather piece is 2.4 to 2.8 times a tier-1 Handcraft good in work, and as heavy as the built tier-2 reed pieces (14 to 19 s). (Sums of `active_ms` down each recipe's inputs, per unit made.)
- **The gap is in the hide.** The hide is 36 to 44% of a tier-1 leather piece's value. A hare-hide is worth 11,760 and a roe-hide 19,440, because the hunt's take takes 40 or 90 seconds (content/core/map.json, `creatures`). So a tier-1 leather piece is worth 3 to 4 times the built tier-1 worn piece and about as much as a tier-3 stone trowel. That number belongs to the hunt, and it is measured again when the gate opens (HUNTING).
- **Steps.** Leather has 4 to 5 steps, against 1 to 3 for every other family. That is one more than the games' band (2 to 4, section 2).
- **The cure for both: one step less (P3).** If scrape and tan become one 6 s action of the workshop, the shoes take 15.5 s (1.9 times the tier-1 median) and leather has 3 recipe steps (flakes, scrape-and-tan, sew). That brings it inside the games' band and inside twice its tier's median. A hare leather would then be worth 21,560 instead of 24,760, and the shoes 29,190 instead of 32,390. The rest of the gap is the hide.
- **Nodes.** With its four family nodes, Handcraft would hold 11 nodes against 7 for Cooking and 9 for Digging. The family set of SKILL_FAMILIES gives every family the same count, so no family needs more points than another to reach its top.

**Albion's parity rule.** A chest costs 16 refined units, a head or shoes 8, in leather and cloth alike (Albion data dump, items.xml; plate unchecked). It is the plainest parity rule among the seven games. Loomvale can test the same idea: at one tier, a family's worn piece costs about what the same place costs in the other families. SKILL_FAMILIES writes it as a check in numbers.

## 8. Proposals for CLOTHING.md (before -> after)

None moves a locked value or writes a price. They are applied to CLOTHING.md in this pull request.

| # | Section | Before | After |
|---|---|---|---|
| P1 | 6, "Known or found" | Tier 1 known from the start, tiers 2 and 3 dug up, by DECISIONS 2026-10-10 | The same split, now measured: the found route brings the first set inside the band. It is kept under the owner's teach rule of 2026-11-12 (every route open, difficulty matched to the grade). The found hide recipes cannot carry the combat gate: the check row of #776 keeps gated recipes known from the start, so their scraps could be dug while the fight is off. So the tier-2 and tier-3 hide recipes and their scrap rows land when the gate opens, not with the tier-1 chain |
| P2 | 6.1 | Four family nodes proposed | Held until the owner picks a family set (SKILL_FAMILIES). The two majors also wait for `quality_pct` |
| P3 (built in step C, #797) | 4.2 and the appendix | Scrape (6 s), then tan (4 s): two actions | One action of the workshop, "scrape and tan": hide, flakes and herb in, the leather or the fur out, 6 s. It applies if the owner's family set keeps a parity check on work per tier (SKILL_FAMILIES); until then it stays a proposal, and the tier-1 chain of pull request E is built either way from one table |
| P4 | 5 and the appendix's Waits | No piece for the hands; reed starts at tier 2 | The ranked gap list of section 5.4, as proposals. The hare-leather gloves join the tier-1 chain behind the gate; the woven reed cape can land now |
| P5 | 6 (a new line) | (not written) | A found or bought piece is the same item as the made one, never better (R4) |
| P6 | 18 | Five questions | Two more, this page's questions 1 and 2 |
| P7 | 17 | Row 2: "the three families from tier 2 are found" | Dropped by the owner's teach rule of 2026-11-12. The other five rows are built (#776) |

## 9. Owner questions

1. **Pell's shelf.** *A new player reaches Pell with a few coins and their race's clothes, and on the shelf lies a pair of plain hare-leather shoes.* Should Pell sell one plain tier-1 piece for each body place, at 10 times its value? That is the same rule as the satchel, but the price is written into the shop file by hand. Yes: buying becomes a route, as in OSRS and Vintage Story. No: making stays the only route to a garment, as in Valheim. **Answered 21.11: yes** (the owner on the card `clothing-routes-1121`: "קניה ומציאה- כן"). The price is the R8 floor times the item's worth, never written by hand (the manager, 21.11).
2. **The torn page in the rubble.** *A player digging the gate rubble for coins and shards turns up, once in about twenty digs, a torn page: how to boil leather.* Should the four tier-2 hide scraps join the gate rubble? The shard, the coin and the stew scrap would each lose up to 5% of their worth: inside the drift rule (R11, 10%), but locked values move. Yes: the first set takes about an hour, inside the games' band. No: the scraps wait for a spot of their own (as WEAPONS and QUARRYING did), and that spot needs a place card first. **Answered 21.11: yes** (the same card and words). A found recipe cannot carry the combat gate (CLOTHING 6), so how the pages stay closed while the fight is off goes to the manager before they are built.

## 10. What is not built here

- The route tool is a measure. It adds the hide chain only to a copy of the world.
- The hide chain lands in pull request E, behind the combat gate:
  - the tier-1 pieces only
  - the found tiers with the gate's opening (P1)
  - the gloves with them if the owner agrees (P4)
- The family nodes: the owner picked set A on 21.11 (docs/design/SKILL_FAMILIES.md), so Handcraft gets a `wear` group of 4 (CLOTHING 6.1), built after #776 (P2).
- R1 and R3 were answered yes by the owner on 21.11 (section 9) and are built in pull requests of their own. R2 waits for the quest-designer when the fight opens.

## 11. Sources

Ours: CLOTHING (sections 3 to 8, 17, 18 and the appendix); DECISIONS 2026-10-10 "First-tier recipes are known from the start; higher tiers are dug up", 2026-11-12 "Clothing: a tenth place for gloves, a hide's colour is final, a set gives its own bonus, cloth is queued" and "Materials: a hide dries for a game day, clothes never wear...", 2026-11-19 "Gear hands, a one-day hide cure...", 2026-11-20 "Every clothing set owns its bonus"; GAME_RULES R8, R11, G41; content/core/params.json (`tier_min_level`, `drift_budget_permille`); content/core/professions/*.json (`xp_levels`); content/core/shops/trader-shop.json; content/core/treasures/ruins-gate.json; kernel/src/values.ts; tools/src/balance/clothing-route.ts.

Outside, fetched 21.11.2026 unless marked:
- OSRS wiki: Leather_body, Leather_boots, Leather_gloves, Leather_chaps, Leather_cowl, Leather_vambraces, Hard_leather_body, Studded_body, Adventurer_Jon, Adventure_Paths, Thessalia's Fine Clothes, Tanner (Ellis), Cow, Toll gate, Crafting, Crafting_Guild, Experience table. https://oldschool.runescape.wiki/w/<page>
- WoW Classic: warcraft.wiki.gg Classic_Leatherworking, Classic_Tailoring, Leatherworking, Elemental_Leatherworking, Tailoring, Coarse Thread (retail page; Classic unchecked), Dragon_Isles_Leatherworking_Knowledge; Wowhead Classic tooltips (items 2300, 2302, 2303, 2304, 2309, 2314, 2317, 4243, 5957, 7280, 236) and item lists https://www.wowhead.com/classic/items/armor/; https://warcrafttavern.com/wow-classic/guides/leatherworking-specializations; https://www.wow-professions.com/tbc/leatherworking-specializations-tbc-classic; https://www.wowhead.com/guide/professions/leatherworking/overview-dragonflight; https://www.wowhead.com/guide/professions/knowledge-points; Blizzard's Dragonflight professions post via Wowhead blue tracker.
- Albion: the community data dump github.com/ao-data/ao-bin-dumps (items.xml, loot.xml, mobs.xml, quests.xml, tutorial.xml, localization.xml, craftingmodifiers.xml, wardrobe.xml), because the official wiki and site returned 403; albionfreemarket.com (focus and quality articles); albionutil.com; stabbedup.blogspot.com 2017 crafting guide; guildorder.com. The item-power line per spec level is unchecked.
- New World: nwdb.info recipe pages (procedural_cloth*t2, list pages 160 to 163); newworld.com articles (character progression, crafting in New World, tips); newworld.wiki.fextralife.com (Armoring, Armor, Leatherworking, Trade Skills, chest armour lists); pcgamesn.com gear progression. The faction shop and the Armoring boosts are unchecked.
- Valheim: valheim.fandom.com through Wayback snapshots (Workbench 2026-01-04, Rag armor, Leather armor, Deer, Boar, Haldor); gamerant.com armor sets; allthings.how (Haldor's store, troll armour); gamever.io (seasonal items; Haldor and Hildir); bisecthosting.com trader guide; gamepressure.com skills. Live fandom returned 402. The troll set bonus and workbench level conflict between guides.
- Vintage Story: wiki.vintagestory.at (Clothes v1.22.7, Class v1.21.6, Armor v1.20.12, Trading v1.21.5, Time, Pelt, Leather working, Leather, Hide, Dye, Rawhide clothing set). The Tailor's repair bonus conflicts: 10% (Clothes) against 25% (Class).
- Stardew: stardewvalleywiki.com (Tailoring, Clothing, Footwear, Boots, Cloth, Dyeing, Hats, The_Mines, Fishing, Farming, Mining, Foraging, Combat).

Every share in section 4.2 is an ESTIMATE. The working notes behind each row, with the URL per claim, were kept in the wave's scratch files and are summarised here.
