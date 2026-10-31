# The depth of every path: what each school has today, what it should have, and the order to build it (2026-10-31)

Status: a proposal for the owner. The numbers in section 2 are printed by `pnpm paths:depth` from `content/` alone and nothing in that table is typed by hand. Everything marked "proposed" is a proposal. The owner's word of 28.10 asked to deepen the crafting and the different skills "so there is richness for every path the player decides to progress on". A **path** here is a school of the tree (DECISIONS 2026-10-23, "The skill tree's format"). The questions only the owner can answer are at the end (at most five, each with a default).

## 1. The finding in one paragraph

All six built paths are **band-1 paths with seven placeholder nodes**. `pnpm tree:coverage` shows the content touching band 1 and almost nothing above it: bands 3 and 4 and the crown have no quest, recipe or place that trains them in any built school, and band 2 has two touches, both Handcraft's. The paths also differ a great deal in what surrounds the nodes: Foraging and Digging have ten or more kinds of node, 21 or more placed places and four quests each, while Fishing has one kind of node, three places and no quest, and Handcraft, the only school with real recipes, has no quest that trains it. **Six of the fifteen quests train no path at all**, which is the gap the owner's rule of 25.10 ("every quest and task starts from the tree") exists to close. The fix is not to grow the weakest school to the size of the strongest. It is to set one floor every path must reach, and to build the floor in the order below.

## 2. Today, measured

Run `pnpm paths:depth` to reproduce this table (twice gives the same table; the test is `tools/test/paths-depth.test.ts`). Columns: nodes by size (small, major, corner, keystone); nodes that are techniques in the build ("slotted"); the longest chain of needs inside the school; active hours to master from the profession's own table; the profession's older techniques; recipes the profession gates; the highest recipe level; the tiers of what the path makes or gathers; tools the path's nodes ask for; kinds of node that train the path; placed nodes and dig spots (and camp parts that give its stations); quests with a step the path trains.

| Path | Nodes (S/M/C/K) | Slotted | Chain | Hours to master | Prof. techniques | Recipes | Top recipe level | Tiers | Tools | Node kinds | Places | Quests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cooking | 7 (2/2/3/0) | 5 | 4 | 1.1 | 2 | 6 | 2 | 1 | 0 | 0 | 1 | 1 |
| Digging | 9 (3/3/3/0) | 6 | 4 | 1.2 | 2 | 0 | 0 | 1 | 5 | 11 | 21 | 4 |
| Fishing | 7 (2/2/3/0) | 5 | 4 | 1.1 | 0 | 0 | 0 | 1 | 1 | 1 | 3 | 0 |
| Foraging | 7 (2/2/3/0) | 5 | 4 | 1.1 | 2 | 0 | 0 | 1 | 3 | 10 | 23 | 4 |
| Handcraft | 7 (2/2/3/0) | 5 | 4 | 1.1 | 2 | 16 | 7 | 1,2,3 | 0 | 0 | 3 | 0 |
| Woodcutting | 7 (2/2/3/0) | 5 | 4 | 1.1 | 0 | 0 | 0 | 1 | 1 | 2 | 16 | 0 |

Cooking: tools -; quests something-warm
Digging: tools flint-trowel, rust-pick, stone-trowel, trowel, work-hammer; quests a-coin-for-maru, a-whole-one, buried-axe, glint-by-the-bridge
Fishing: tools fishing-rod; quests -
Foraging: tools basket, fine-basket, reed-basket; quests first-pickings, herbs-for-pell, the-south-bank, three-fruits
Handcraft: tools -; quests -
Woodcutting: tools axe; quests -

Hours to master: 6.6 h for 6 paths today; the balance model gives one school 51.7 h, and the catalogue's floor is 800.0 h.
Tool items no path names: walking-staff
Quests no path trains (6 of 15): first-fire, fix-the-bridge, into-town, the-long-night, the-night-arch, the-tangle

How to read it:

- **"Hours to master" is the old hand-set table, not the target.** The profession files hold `xp_levels` in active seconds (the schema says so), and the top entry of each today is 1.0 to 1.2 hours. The owner's answer Q1 of 25.10 is a school of about 50 active hours (`t1` 28 s, 51.7 hours a school, the catalogue past 800). The page measures the content as it is. The table will be regenerated to the formula when the progression map is built (PROGRESSION.md 4.6), and every path then has about forty-seven times the hours to fill (51.7 against 1.1), which is the content the floor of section 4 starts to answer.
- **"Places" mixes two things:** placed nodes and dig spots on the map, and the camp parts that provide a station. Cooking's one place is the campfire (the fire station); Handcraft's three are camp parts that provide the workshop station (the workshop, the work stone and the workbench).
- **"Quests" counts a quest when a step makes, brings or finds what the path makes.** A quest that starts from a node, which is what 25.10 asks for, is a different and stricter test, and no quest is marked that way yet.
- **Tiers are all 1 outside Handcraft** because the content holds only tier 1 of what grows and lies in it. Where tier 2 and 3 of gathered goods come from is a question for the first map (NEXT.md section 19); the column is a fact about the content, not about the schools.

The six quests no path trains, by their steps: `first-fire` (a build), `fix-the-bridge` (a restore), `into-town` and `the-tangle` (a visit), `the-long-night` (a tend), `the-night-arch` (a riddle). The last four would belong to schools that do not exist yet: `into-town` and `the-tangle` to Travel, `the-long-night` to Survival, `the-night-arch` to Lore (proposed, PROGRESSION.md 4.2).

What `pnpm tree:coverage` adds, quoted from its run on 31.10: the tree holds 76 nodes, 33 touched, 43 untouched, 13 reserved (all Travel). Fishing has **7 of 7 nodes untouched**; Cooking, Foraging and Woodcutting have one untouched each; Digging has one; Handcraft has none. Band 1 holds all the touches; Handcraft alone touches band 2, twice.

## 3. How other games make a path rich

| Game | What a path is | What makes it rich | Source |
|---|---|---|---|
| Old School RuneScape | 24 skills to level 99 (15 free, 9 members) | Each skill's levels unlock things you can see: a pickaxe is a new grade at Mining level 1, 6, 11, 21, 31, 41, 61 and 71, with an Attack level to wield it besides | S1, S2 |
| World of Warcraft | primary professions, two to a character; gathering and crafting; secondary professions without a limit | Skill rises by gathering or crafting; recipes come from trainers, the world and quests; a primary can be unlearned, losing its recipes | S3 |
| Stardew Valley | five skills (farming, fishing, foraging, mining, combat) | At level 5 a profession of two, at level 10 a second of two, which depends on the first | S4 |
| Valheim | skills that level up by use, to 100 | A skill moves what you do (spear damage, stamina in running); crafting at 100 gives faster crafting and an extra item chance | S5, S6 |

Two lessons carry over to Loomvale, and both are already in the progression map. First, **a path unlocks visible things at a steady rhythm** (OSRS's tool grades, Stardew's two forks). Loomvale's bands (PROGRESSION.md 3.3) and its tool tiers by level (6, 11, 16, 21, proposed in 5.6) are that rhythm. Second, **choice inside the path matters more than size**: Stardew's forks, Valheim's use-based skills and Loomvale's branches and corner nodes (PROGRESSION.md 4.3) make two players of one path differ.

## 4. The floor every path should reach (proposed)

The progression map already sizes a path's **tree**: 32 nodes (12 on the main line, 3 corner nodes, two branches of 8, one crown) at the first full catalogue (PROGRESSION.md 4.3). It does not say what the **content around the nodes** must hold, and that is what the owner's word asks for. Proposed floor, per path, at the first full catalogue:

| Part | Floor | Why this number |
|---|---|---|
| Nodes | 32 | PROGRESSION.md 4.3 |
| Tiers of what it makes or gathers | 3 | the three tiers Handcraft holds today; the same three bands of play before the far content |
| Tools, for a gathering path | 3 grades (a plain one, one made at the workshop, a fine one) | Foraging has three baskets; Digging has five tools |
| Recipes, for a crafting path | 16, the top at level 7 | Handcraft is the model: 16 recipes, top level 7 |
| Kinds of node, for a gathering path | 8 | Foraging has 10, Digging 11 |
| Places | 8 | Digging has 21, Foraging 23 and Woodcutting 16; Fishing and Handcraft have 3 |
| Quests that train it, each starting from one of its nodes | 3 | Foraging and Digging have 4 each |
| What it pays | money (what it makes sells inside the market's band), access (a place it opens), a look (a trophy garment, no effect), never power sold (G39) | the four prices of decision 39 and the pays of PROGRESSION.md 6.1 |

How each built path stands against the floor (`ok` meets it, otherwise today's number over the floor; "n/a" does not apply to that kind of path):

| Path | Quests | Places | Tools or recipes | Kinds | Tiers | Misses |
|---|---|---|---|---|---|---|
| Fishing | 0 of 3 | 3 of 8 | 1 of 3 tools | 1 of 8 | 1 of 3 | **5** |
| Cooking | 1 of 3 | 1 of 8 | 6 of 16 recipes | n/a | 1 of 3 | **4** |
| Woodcutting | 0 of 3 | ok (16) | 1 of 3 tools | 2 of 8 | 1 of 3 | **4** |
| Handcraft | 0 of 3 | 3 of 8 | ok (16 recipes, top 7) | n/a | ok (1,2,3) | **2** |
| Foraging | ok (4) | ok (23) | ok (3 tools) | ok (10) | 1 of 3 | **1** |
| Digging | ok (4) | ok (21) | ok (5 tools) | ok (11) | 1 of 3 | **1** |

The thin paths by the numbers are, in order, **Fishing, Cooking, Woodcutting, Handcraft**. Foraging and Digging miss only the tier column, which is the world's to fill.

## 5. The ladder of richness per path (proposed)

For each built path: what to add, with numbers, and what the path pays. All content is declarative JSON under `content/`; prices are never hardcoded; nothing here is a story claim (STORY.md: the narrator never states the past). The order of building is section 6.

**Fishing** (the thinnest: 5 misses; its 7 nodes are all untouched).
- Kinds of node: 1 to 8 (waters of different depth and speed: shallow, still, running, deep, with a fish or two of each; the existing nodes `still-water`, `deep-pool` and `river-listener` point at three of them).
- Tools: 1 to 3 (the rod; a made rod; a net the Fishing node `net-mender` serves).
- Places: 3 to 8, at least four distinct waters.
- Recipes: none of its own; its catch feeds Cooking (see Pairs below).
- Quests: 0 to 3, each starting from a node (for example one that starts from `still-water`, one from `deep-pool`, one from `net-mender`).
- Pays: money (fish sell inside the band), a look at the crown, and access (deep water opens a place the shore does not).

**Cooking.**
- Recipes: 6 to 16, three tiers of dishes. A dish's effects are the tags its ingredients share, at most two (BODY_CLOCKS.md section 7, PROGRESSION.md 4.5); a dish's rarity is the rarest ingredient that takes part in an effect.
- Places: 1 to 8, as fires and cooking stations in the town, the camps and the road.
- Quests: 1 to 3 (it already has `something-warm`).
- Pays: dishes that answer a place's condition (a warm dish for frost), which is the path's access; money; a look at the crown.

**Woodcutting.**
- Kinds of node: 2 to 8 (tree kinds by region and climate; DECISIONS 2026-10-09 says every tree gives wood by its type).
- Tools: 1 to 3 (the axe; a made axe; a fine axe). This path owns the tool the opening gives first, so its grades are the first thing a player upgrades.
- Quests: 0 to 3, including `first-fire` (a build step that needs a felled tree) re-pointed to start from a Woodcutting node.
- Places: ok (16).
- Pays: logs, bark and resin to Handcraft and Woodcraft; money; access (a felled tree can be a bridge: the effect `fell_facing`, PROGRESSION.md 4.2).

**Handcraft** (the only school with a real recipe ladder).
- Quests: 0 to 3, including `fix-the-bridge` (a restore step) re-pointed to start from a Handcraft node.
- Places: 3 to 8, workshops in the town and the camps.
- Recipes: 16 to 24, filling the two branches the map names (Reedwork and Stonework: PROGRESSION.md 4.3).
- Pays: tools and work clothes for every other path, which is the path's money (everything else needs a made tool); a look at the crown.

**Foraging and Digging** (1 miss each).
- Tiers: 1 to 3 for each: a tier-2 and a tier-3 plant or find, expected to come with the first map (NEXT.md 19), not from a node.
- Nodes: from 7 and 9 to 32 each, by branch.
- Pays: Foraging feeds Cooking and Remedies; Digging feeds Smithing, Mining and the relics.

**Pairs.** The map's `cross_links_max` (2, PROGRESSION.md 6.5) lets a node need another school's node. Proposed first links, all small: Cooking's first branch needs Fishing's `patient-line`; Handcraft's second branch needs Woodcutting's heartwood node (the untouched `heartwood`). Links are what make a player's chosen path feel like a world rather than a menu.

**For all six: bands 2, 3 and 4.** The finding of section 1 is that no content touches them. A node in band 2 should be reachable from a recipe at levels 6 to 10, a quest paying that school, or a place needing its level (PROGRESSION.md 3.3 and 4.9). Each path needs at least **two touches in each of bands 2, 3 and 4** (proposed), which is `tree:coverage`'s own test.

## 6. The order to build it (proposed)

1. **The quest gap, no new content.** Re-point `first-fire` to a Woodcutting node and `fix-the-bridge` to a Handcraft node, with `Tree:` lines. Leave `into-town`, `the-tangle`, `the-long-night` and `the-night-arch` as story quests of the centre of the tree until Travel, Survival and Lore have nodes (their schools are proposed, PROGRESSION.md 4.2). Cost: a few lines of content; needs the quest and story review of the quest skill.
2. **Fishing, then Cooking.** Both are the thinnest and they pair: the catch feeds the dishes. Fishing needs kinds of water; the first map's boathouse (NEXT.md 19 f) is where the second water comes from.
3. **Woodcutting and Handcraft's quests and places.** Cheap, because the recipes exist.
4. **Bands 2 to 4 for the four built gathering and crafting paths.** The big work: the touches the finding of section 1 asks for, built with the branches (PROGRESSION.md 4.3) and the hours table regenerated.
5. **Tiers 2 and 3 of what grows and lies in the ground**, with the first map's regions.

## 7. The owner's questions

1. **The floor.** Is 3 quests, 8 places, 3 tools or 16 recipes, 8 kinds of node and 3 tiers the right bar? **Default: yes.** It is Foraging and Handcraft's size.
2. **Re-pointing `first-fire` and `fix-the-bridge`.** May they start from a Woodcutting and a Handcraft node now? **Default: yes.** It changes where they start in the tree, not what a player does.
3. **Fishing and Cooking first.** **Default: yes.**
4. **The first cross-links** (Cooking from Fishing's `patient-line`; Handcraft from Woodcutting's heartwood). **Default: yes.**
5. **A path's trophy look at the crown.** One look item per path, no effect, earned at mastery. **Default: yes,** later, with the crown's format (PROGRESSION.md 4.3).

## 8. Sources

Outside games (read on 31.10.2026):

- S1: Old School RuneScape wiki, Skills: 24 skills, max level 99, 15 free and 9 members. https://oldschool.runescape.wiki/w/Skills
- S2: Old School RuneScape wiki, Pickaxe: Mining and Attack levels per grade. https://oldschool.runescape.wiki/w/Pickaxe
- S3: Warcraft wiki, Profession: two primary professions, gathering and crafting, unlearning a primary. https://warcraft.wiki.gg/wiki/Profession
- S4: Tom's Guide forums, Stardew Valley profession guide: five skills, a profession at level 5 and at level 10, two choices each. https://forums.tomsguide.com/faq/stardew-valley-profession-guide-what%E2%80%99s-best-and-how-to-choose-which-profession-to-follow.201704
- S5: Valheim, Wikipedia: skills to level 100 with different effects (spear damage, stamina while running). https://en.wikipedia.org/wiki/Valheim
- S6: Prima Games, Valheim skills: skills level up with use; crafting at level 100 (faster crafting, a chance of an extra item), read as quoted in a search result (the page itself was not opened). https://primagames.com/tips/valheim-list-all-skills

Ours: `pnpm paths:depth` (this page's table) and `pnpm tree:coverage` (section 2's quoted numbers); DECISIONS 2026-10-23 "The skill tree's format", 2026-10-25 "The progression map, Q1", "Tree first, both ways"; [PROGRESSION.md](PROGRESSION.md) sections 3.3, 4.2, 4.3, 4.5, 4.6, 4.9, 5.6, 6.1, 6.5; [BODY_CLOCKS.md](BODY_CLOCKS.md) section 7; [GAME_RULES.md](GAME_RULES.md) G39; NEXT.md section 19; the quests in `content/core/quests/`.
