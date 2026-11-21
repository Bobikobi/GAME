# Finding, the carried kit and the bag, measured against seven games

Status: **a check, not a design** (#769, the clothing wave). The owner asked on 21.11: "מציאה וlooting גם צריכים לעבור השוואה למשחקים ... מה חומרי הגלם ששחקן מחזיק? קרשים למדורה/עבודה, אוהל, אוכל, נשקים, כלים, מה עוד? מה לגבי תיק אוביקט ללבוש?" This page answers in three parts:
- finding and loot: where things are found, the share of found, made and bought, the shape of a loot table, and what keeps finding from making crafting pointless
- the kit a player carries in the first hours
- the bag as a worn object

Each part gives what Loomvale does today, read from `content/` on `develop`. The gap table and the questions for the owner are in sections 4 and 5. It sits beside the clothing balance page (#778).

The seven games are Old School RuneScape (OSRS), World of Warcraft Classic (WoW), Albion Online, New World, Valheim, Vintage Story and Stardew Valley.

How to read the numbers:
- Every number from a game carries its source (section 6), read on a fetched page or, for Albion, in the game's own data files.
- "(unchecked)" marks a number from memory or a search snippet.
- "not found" means the sources were searched and do not say.
- A share of found, made and bought is an **estimate**: nobody publishes it. Its basis is the starter list, the drop tables and the shop prices, as written beside it.
- New World's numbers are from its launch era (2021-22). Its first starter zone closed in 2023, so treat that column as possibly out of date.

## 1. Finding and loot

### 1.1 Where a new player finds things

| Game | Given at the start | On the ground, dug, searched | From a kill | From a quest | Source |
|---|---|---|---|---|---|
| OSRS | after the tutorial: bronze axe, pickaxe, tinderbox, net, dagger, sword, shield, bow, 25 arrows, runes, bucket, pot, bread; 25 coins | Lumbridge spawns: 2 pickaxes, 2 knives, bucket, pot, leather boots, logs x4, an iron dagger; a bird's nest 1 in 256 per log | cow: hide, beef, bones every time; goblin: coins, hammer, a bronze axe 3 in 128 | Cook's Assistant gives no item | O1, O2, O3, O4, O5 |
| WoW | a hearthstone | not found for the first hours | young wolf: meat 54%, vendor bits 37%, one grey armour piece about 1% each (about 28% for any of them) | a pick of shoes or bracers; a 4-slot bag (Westfall, Durotar) | W1, W2, W3, W4 |
| Albion | leather start set (tutorial) | wood gathering can drop a tier-2 axe; rare resource nodes 5% / 1% / 0.2% | tutorial mini-boss: a tier-2 bag | a shield, sickle, knife, 6 planks, 6 bars, 4 cloth, 4 leather, soups | A1, A2, A3, A4 |
| New World | nothing named | flint and green wood picked up by hand; chests in enemy camps (no rates found) | boar: hide, meat, tusk (no rates found) | flint axe at level 3, flint pick at 4, a sickle, a rod; the first bag at level 10 | N1, N2, N3, N4 |
| Valheim | a torch and a rag tunic | branches, flint, stone, berries; chests at fixed places roll 2-3 of 6 equal entries (amber, coins, feathers, flint, arrows, a torch); the burial digging needs a pick that comes after the first boss | boar: leather scraps 1 and meat 1 every time, a trophy 15% | no quests | V1, V2, V3, V4 |
| Vintage Story | the class's clothes (Commoner: 4 pieces), no tools | panning: nothing 1 in 1.6, copper 1 in 6.7, a rusty gear 1 in 167, a temporal gear 1 in 2,000; cracked vessels in ruins always give something (flint axe 27%, metal tools 0.9-2.7%) | hare: 2 meat, 0-1 hide; wolf: hide, meat, bones | none | S1, S2, S3, S4 |
| Stardew | 5 tools, a 12-slot pack, 500g, 15 seeds | artifact spots always give one item (lost book 20-32%, clay 10-48%); mine chests on floor 10 (leather boots) and 20 (a sword), once | green slime: slime 75%, sap 15%, amethyst 1.5% | a rusty sword when the mines open; a rod by mail on day 2 | T1, T2, T3, T4 |
| **Loomvale** | the race's outfit: 3 pieces each (human: work clothes, work boots, work hammer) | four tools lie at fixed spots, always found, back after 60 s (axe, basket, trowel, staff); searched heaps give berries, stone, branches, shards, coins (85-100% something); dug rubble gives shards, coins, an idol 5%, a recipe scrap 10% | (behind the gate) hare: meat, hide, bone every time; no chance roll | branches, the bandage, a reed basket, a trowel, an idol, a first-aid kit, a key | `content/core/races`, `treasures`, `quests`, `map.json` |

### 1.2 The share of found, made and bought in the first hours (estimates)

| Game | Found or given | Made | Bought | Basis |
|---|---|---|---|---|
| OSRS | 60% | 20% | 20% | starter set, spawns, store prices 1-20 coins (O1, O2, O6) |
| WoW | 60% | 10% | 30% | drops, quest picks, vendor bags and food (W1-W5) |
| Albion | 55% | 35% | 10% | tutorial gear, quest tools and materials, recipes (A1-A5) |
| New World | 50% | 40% | 10% | quest tools that are also a 1-flint craft (N1-N4), low confidence |
| Valheim | 5-15% | 85-90% | 0% | two start items, chests without gear, the trader 1500 m out (V1-V5) |
| Vintage Story | 25-35% | 65-75% | 0% | class clothes, knapped tools, traders paid in found gears (S1-S5) |
| Stardew | 60-70% | 15-20% | 15% | starter tools, the sword gift, Pierre (T1-T5) |
| **Loomvale** | **about 45%** | **about 45%** | **about 10%** | by kind, from `content/` (below) |

Loomvale by kind, counting what a player can hold in the first hour:
- **Tools:** 6 of 13 are found or given (4 at fixed spots, 2 in outfits) and 7 are made. The 4 found ones are also sold at 30 gold each.
- **Clothes:** 3 per race are given and 4 are made (the reed hat and sandals, the charm, the satchel). None is found or sold (PR D adds the reed coat's page; Pell's shelf and the torn page come later in this wave).
- **Food:** most is gathered by hand. Five meals are made, and three foods are sold.

The simulated opening (`pnpm map:playtest`, seed 1) ends at 16.4 game minutes with 31.8 to 61.8 gold, most of it from one quest's 30.

**Where we sit:** inside the seven's range on every share (found 5-70%, made 10-90%, bought 0-30%), between OSRS and Vintage Story. Nothing to fix here.

### 1.3 The shape of a loot table

| Game | Sure or chance | Rarity ladder | Rarest early find | Luck | Bad-luck protection | Source |
|---|---|---|---|---|---|---|
| OSRS | sure rows (bones, hide) plus n/128 rows and a "nothing" row (38/128 on a goblin) | written as fractions, no named rungs | a goblin champion scroll 1 in 5,000; clues 1 in 64 to 1 in 128, rolled apart | none on the drop page | none | O3, O7 |
| WoW | each item its own constant chance per kill | poor, common, uncommon, (rare, epic unchecked) | a 6-slot pouch about 0.1% | not found | not found for Classic | W1, W6 |
| Albion | weighted lists (a mini-boss: 92.5% to roll a tier-2 list of 8 groups) | an enchantment ladder 75 / 19 / 4.7 / 1.2 / 0.3% | a .4 item 0.3% | not found | not found | A2, A6 |
| New World | nested rolls of 100,000 points, "guaranteed" tables | perks: common 0 to epic 3, legendary 3 plus a gem slot | not found | a luck stat lifts the rare rows (+2.9% on a perk) | not found | N5, N6 |
| Valheim | sure materials plus a chance trophy (5-50%); chests pick 2-3 of equal entries | none | a trophy 5% | none found | none found | V2, V3 |
| Vintage Story | a vessel always gives (fixed tries); panning mostly gives nothing | none named; 1 in 2 down to 1 in 10,000 | a temporal gear 1 in 2,000 | none (class perks only) | none | S2, S3 |
| Stardew | an artifact spot always gives one, checked in order | none named; 75% down to 0.05% | a prismatic shard 0.05% (late) | a daily luck of -0.1 to +0.1 | none (a ladder grows likelier as rocks run out) | T2, T6 |
| **Loomvale** | rows in order on one roll, the rest is nothing (gate rubble 25% nothing, deep ruins 45%, hall 0%); hunt goods always all | common, uncommon, rare, legendary | **the stone idol, 1 in 20 (5%)** | rare and legendary rows scale with luck | none | `treasures/*.json`, `kernel/src/step.ts` dig |

**Where we sit:** our shape is the common one: one roll per dig, a "nothing" share, sure goods from a hunt, a luck scale on the rare rows, no pity counter. We differ in one way. Our rarest find is 1 in 20, while every game with a ladder runs a long tail down to 1 in 128 to 1 in 10,000. Most of them roll that tail apart from the main row (OSRS clues and tertiaries, Stardew's extras, Vintage Story's panning tail). That gives a dig the small chance of a story to tell. It is question F2.

### 1.4 What keeps finding from making crafting pointless

The seven agree on three ways:
- **Found things are raw, or low.** Stardew's finds are coal, ore, stone and clay. Vintage Story's tool vessels give flint tools 81% of the time and a metal tool 0.9-2.7%. Valheim's chests hold no usable gear, and their wooden weapons deal 1 damage (T2, S3, V3).
- **A found finished piece is a one-off.** Stardew's floor 10 and 20 chests never reset, and OSRS drops are small and random (T3, O3).
- **The better tier is only made.** Valheim's armour, OSRS's smithed armour, Albion's tier-2 tools from planks and bars, and New World's crafted gear score all work this way (V5, O8, A5, N6).

Loomvale already holds all three:
- the only finished things found are the tier-1 starter tools and the race's outfit
- every tier-2 and tier-3 tool and garment is made
- a found tool carries no value, so the trader never buys it back (`kernel/src/step.ts` sell: "a tool with no value ... is never bought back"), and a hunt good is never sold raw

We add one way the seven mostly lack: a find that **teaches** a recipe (the stew scrap, the reed coat's page, the torn pages to come), so finding feeds making instead of replacing it. Of the seven, only WoW has the same thing, its recipe drops (unchecked).

## 2. The carried kit in the first hours

| Kind | OSRS | WoW | Albion | New World | Valheim | Vintage Story | Stardew | **Loomvale** |
|---|---|---|---|---|---|---|---|---|
| Fuel | logs, chopped (O2) | wood plus flint and tinder for a campfire (W7) | wood by weight (A5) | green wood (N2) | wood (V4) | firewood: 1 log split into 4 (S4) | none; the campfire is a craft (T5) | **log** (axe); the campfire takes 2 |
| Boards, planks | later, sawmill | not found | tier-2 planks, 6 per tool (A5) | timber at tier 2 (N2) | none (built pieces) | later, needs smithing (S4) | none (wood) | **none** |
| Shelter, tent, bed | none | none | none (home island furniture) | a placed camp, 5 wood and 1 flint (N3) | a bed (8 wood) under a roof (V4) | a hay bed (S4) | the farmhouse (unchecked) | **the camp**: a burning fire makes a safe place (G30); no tent, no bed |
| Food | cooked fish, bread | drops, vendor | quest soup, crafted | from the first quests | berries, meat | forage, cooked meat | forage, Pierre | **berries, herbs, mushrooms, fish; 5 meals; the trader's food** |
| Weapon | given | starter, quest, drop | crafted, quest | quest, drop | a club by hand (V4) | a spear or club, knapped (S4) | a rusty sword, given | **none built**: the fight is behind its gate; a work tool fights one small step above bare hands (DECISIONS 2026-11-21) |
| Tools | given, 1-20 coins | bought | quest, crafted | quest or 1 flint plus 1 wood | stone axe, hammer by hand | knapped axe and knife | 5 given | **13**: 4 found, 2 given, 7 made, 4 also sold |
| Light | a torch, later (O9) | none | an off-hand torch at tier 3 | not found | a torch, given and crafted (V4) | a torch, 2 dry grass and a stick (S4) | a torch, 1 wood and 2 sap (T5) | **the lantern lights itself after dark** (a sign, not a shield, G31); the torch is decided (DECISIONS 2026-11-12), not built |
| Rope | a shop, 18 coins (O10) | not found | none | not found | not found | made from vine or reed (S4) | not found | **reed cord**, made |
| Containers | none early | worn bags | the worn bag | worn bags from level 10 | a chest, 10 wood | a reed chest, a basket | a chest, 50 wood | **a satchel, a storage chest** (3 logs and 4 stones), and the basket as a gathering tool |
| Healing | food | food, potions | food | food | food | food | food | **the bandage (made) and the first-aid kit (bought, or a quest)** |

**What ours lacks against the seven:**
- **A weapon.** All seven put one in the first hours, and we put none. This is by decision: the fight opens behind its gate (DECISIONS 2026-11-12 and 2026-11-14), and the weapon table already plans every route to a weapon. No question here.
- **A torch.** Three of the seven hand one over or make it in the first hour (Valheim, Vintage Story, Stardew). Ours lights itself, so nothing is missing for the night. The torch is decided and still waits to be built for the south's dark (DECISIONS 2026-11-12, "the dark below (a torch or an ember)"). No new question.
- **Boards.** Four of the seven have none in the first hours. Where boards exist (OSRS, Albion, New World), they arrive at tier 2 as the material for better tools and buildings. Question F3.
- **A tent or a bed.** None of the seven carries a tent. Shelter is a placed thing in four of them, as our camp is, so there is no gap.

## 3. The bag as a worn object

| Game | Start | Worn? | First upgrade and how | Top early | Weight | Source |
|---|---|---|---|---|---|---|
| OSRS | 28 fixed | no; the bank holds the rest | none | 28 | run energy drains 2x at 64 kg | O11, O12 |
| WoW | 16 backpack | yes, 4 bag slots | a 4-slot quest bag (free), a 6-slot pouch (about 5 silver), a crafted 6-slot linen bag, or a 0.1% drop | 16 plus 4 bags of 6-12 | none | W4, W8 |
| Albion | 48 slots and a load of 50 | yes, 1 bag slot | a tier-2 bag, dropped in the tutorial or crafted (12 cloth, 12 leather) | - | above 100% load speed x0.8, down to none at 800% | A1, A5, A7 |
| New World | a weight of 200 | yes, 3 bag slots at levels 10, 30, 45 | the first bag from a quest at level 10 | not found | no sprint, no dodge | N4, N7 |
| Valheim | 32 slots, weight 300 | no bag item | Megingjord +150 weight, 950 coins at a trader 1500 m out | 32 | slowed, no attack or block | V1, V5 |
| Vintage Story | 10 plus 4 empty bag slots | yes | a hand basket +3 from 10 reeds on day 1, or found in a vessel (12.3%) | 4 bags of 3-8 | none found | S1, S5 |
| Stardew | 12 | no | 24 for 2,000g, then 36 for 10,000g | 36 | none | T1, T7 |
| **Loomvale** | **12 places** (human +2), **a load of 30** | **yes**, the back slot | **the satchel, 24**: made at the workshop at level 3 (2 reed cord, 1 woven mat) or bought for 290 gold | **the frame pack, 36 and +10 load**, but nothing gives it yet (it waits for the city, `content/core/items/bags.json`) | three paces by load (light 60%, heavy to 150%) | `params.json`, `items/bags.json`, `recipes/satchel.json`, `shops/trader-shop.json` |

**Where we sit:**
- Our ladder (12, 24, 36) is Stardew's. Our worn bag is WoW's, Albion's, New World's and Vintage Story's. Our weight with paces is Albion's.
- The start of 12 is at the low end, with Vintage Story (10) and Stardew (12).
- Our first step is the largest of the worn-bag games: it doubles the bag where they add 3 to 6.
- **The first bag comes only from making or buying.** In all four worn-bag games the first bag can also be found or given: a free quest bag in WoW, a tutorial drop in Albion, a level-10 quest in New World, a vessel find in Vintage Story.
- Buying costs 290 gold. The opening ends with 32 to 62, so that is 5 to 9 times what a new player holds. Stardew's first bag is 4 times its starting gold, and WoW's is a few silver. That is question F1.

## 4. The gap in one table

| Part | Loomvale against the seven | Verdict |
|---|---|---|
| Found, made, bought | 45 / 45 / 10, inside the range (found 5-70, made 10-90, bought 0-30) | inside |
| Loot table shape | one roll, a nothing share, sure hunt goods, luck on rare rows, no pity | inside |
| The long tail | rarest early find 1 in 20; the seven reach 1 in 128 to 1 in 10,000, mostly on a separate roll | **missing** (F2) |
| Finding against crafting | finished finds are tier 1 only, found tools never bought back, finds teach recipes | inside, and one step ahead |
| Weapon in the first hours | none; the seven all have one | apart by decision (the gate) |
| Light | the lantern lights itself; the torch decided, not built | apart, no gap |
| Boards | none; the seven have none early, or at tier 2 | inside for now (F3) |
| Tent or bed | the camp is the shelter; none of the seven carries a tent | inside |
| The first bag | made at level 3 or 290 gold; the four worn-bag games also give or drop it | **apart** (F1) |
| The top bag | the frame pack exists, nothing gives it yet | waits for the city (decided) |

## 5. Questions for the owner

Each is a yes or no, with the builder's recommendation. None is built before the answer.

- **F1. The first bag found or given.** *A new player who has walked the valley for twenty minutes is handed a satchel by someone who needs a thing carried.*
  - The question: should the satchel also come from one quest, built through the quest-designer with its hand check?
  - Yes: the first bag works as in WoW, Albion and New World, and buying stays for a second one.
  - No: the bag stays made or bought, as in Stardew.
  - **Recommended: yes.** All four games with a worn bag give the first one away, and 290 gold is 5 to 9 times an opening's purse.
- **F2. A long tail on digging.** *Once in some hundreds of digs, a player turns up a thing nobody in the valley has seen.*
  - The question: should a separate small roll per dig (1 in 200 to 1 in 2,000) be designed as its own piece, needing a kernel rule, values and a place card?
  - Yes: the dig gains the small chance of a story, as OSRS clues, Stardew's extras and Vintage Story's temporal gear give.
  - No: our rarest find stays 1 in 20.
  - **Recommended: yes, after the clothing wave**, as its own design page first.
- **F3. Boards.** *A player chops a log and saws it into boards at the workbench.*
  - The question: should a board item join now?
  - Yes: it gives the wood line a second step now.
  - No: boards wait for the first tier-2 tool or camp piece that needs them, as in OSRS, Albion and New World.
  - **Recommended: no.** Nothing in the first hours needs a board in four of the seven, and an item no recipe uses is clutter.

## 6. Sources

The research notes behind this page were fetched on 21.11.2026.

| Id | Page | How read |
|---|---|---|
| O1 | https://oldschool.runescape.wiki/w/Learning_the_Ropes | fetched |
| O2 | https://oldschool.runescape.wiki/w/Lumbridge | fetched |
| O3 | https://oldschool.runescape.wiki/w/Goblin | fetched |
| O4 | https://oldschool.runescape.wiki/w/Cow | fetched |
| O5 | https://oldschool.runescape.wiki/w/Bird%27s_nest ; https://oldschool.runescape.wiki/w/Cook%27s_Assistant | fetched |
| O6 | https://oldschool.runescape.wiki/w/Lumbridge_General_Store | fetched |
| O7 | https://oldschool.runescape.wiki/w/Drop_table | fetched |
| O8 | https://oldschool.runescape.wiki/w/Mining | fetched |
| O9 | https://oldschool.runescape.wiki/w/Unlit_torch | fetched |
| O10 | https://oldschool.runescape.wiki/w/Rope | fetched |
| O11 | https://oldschool.runescape.wiki/w/Inventory ; https://oldschool.runescape.wiki/w/Bank | fetched |
| O12 | https://oldschool.runescape.wiki/w/Weight | fetched |
| W1 | https://www.wowhead.com/classic/npc=299 (young wolf, 115,665 kills) | fetched |
| W2 | https://www.wowhead.com/classic/quest=33/wolves-across-the-border | fetched |
| W3 | https://www.wowhead.com/classic/npc=504/defias-trapper | fetched |
| W4 | https://blizzardwatch.com/2024/03/04/where-to-get-bags-wow-classic/ | fetched |
| W5 | https://warcraft.wiki.gg/wiki/Mining_Pick ; https://warcraft.wiki.gg/wiki/Skinning_Knife | fetched |
| W6 | https://warcraft.wiki.gg/wiki/Loot | fetched |
| W7 | https://www.wowhead.com/classic/spell=818/basic-campfire | fetched |
| W8 | https://warcraft.wiki.gg/wiki/Bag ; https://warcraft.wiki.gg/wiki/Linen_Bag | fetched |
| A1 | https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/tutorial.xml | fetched (game data) |
| A2 | https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/loot.xml | fetched (game data) |
| A3 | https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/quests.xml | fetched (game data) |
| A4 | https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/rareresourcedistribution.xml ; mobs.xml | fetched (game data) |
| A5 | https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.xml | fetched (game data) |
| A6 | https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/lootchests.xml | fetched (game data) |
| A7 | https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/characters.xml ; gamedata.xml | fetched (game data); the wiki returned 403 |
| N1 | https://newworld.fandom.com/wiki/A_Warm_Bed and the quest pages beside it | fetched (wiki text, launch era) |
| N2 | https://newworld.fandom.com/wiki/Bush ; /Flint ; /Green_Wood | fetched (wiki text) |
| N3 | https://newworld.fandom.com/wiki/Camp | fetched (wiki text) |
| N4 | https://newworld.wiki.fextralife.com/Bags | fetched (summary) |
| N5 | https://newworldpacifist.github.io/resources/rng-explained | fetched (summary; closed-beta data) |
| N6 | https://newworld.fandom.com/wiki/Equipment ; https://newworld.fandom.com/wiki/Luck | fetched (wiki text) |
| N7 | https://newworld.wiki.fextralife.com/Weight | fetched (summary) |
| V1 | https://valheim.fandom.com/wiki/Inventory | fetched (wiki text) |
| V2 | https://valheim.fandom.com/wiki/Boar ; /Greydwarf ; /Neck | fetched (wiki text) |
| V3 | https://valheim.fandom.com/wiki/Loot_chest ; /Wooden_axe | fetched (wiki text) |
| V4 | https://valheim.fandom.com/wiki/Workbench ; /Campfire ; /Bed ; /Torch ; /Club ; /Wood | fetched (wiki text) |
| V5 | https://valheim.fandom.com/wiki/Haldor ; /Megingjord | fetched (wiki text) |
| S1 | https://wiki.vintagestory.at/Survival_Guide_-_Your_first_day ; /Classes | fetched |
| S2 | https://wiki.vintagestory.at/Panning | fetched |
| S3 | https://wiki.vintagestory.at/Cracked_vessel | fetched |
| S4 | https://wiki.vintagestory.at/Firewood ; /Torch ; /Rope ; /Bed ; /Hare ; /Wolf | fetched |
| S5 | https://wiki.vintagestory.at/Containers ; /Basket | fetched |
| T1 | https://stardewvalleywiki.com/Tools ; /Inventory | fetched |
| T2 | https://stardewvalleywiki.com/Artifact_Spot | fetched |
| T3 | https://stardewvalleywiki.com/Mines | fetched |
| T4 | https://stardewvalleywiki.com/Green_Slime ; /Rusty_Sword ; /Quests | fetched |
| T5 | https://stardewvalleywiki.com/Torch ; /Campfire ; /Chest | fetched |
| T6 | https://stardewvalleywiki.com/Luck | fetched |
| T7 | https://stardewvalleywiki.com/Pierre%27s_General_Store | fetched |
