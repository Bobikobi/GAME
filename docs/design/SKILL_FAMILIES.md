# Skill families: what the tree holds, a first family set fitted to it, and a clean one (2026-11-21)

Status: **picked: A, 21.11; B the later expansion** (#769). The owner answered the card `skill-families-1121`, 21.11 at 09:44: "לגבי המחקר a בהמשך הרחבה לb" (on the survey: A, and later an expansion to B). Set A's frame is built on develop (#776): Handcraft's families `wear` and `tools`, the node `family` key, and F6's kernel test (kernel/test/recipe-gate.test.ts, "a family node"). Not built yet, step C of the clothing wave: the node groups, `nodes_max` 12 to 20 (params.json still says 12) and the check rows F1 to F5. Nothing of B is built now, and nothing in A may block it (section 2.4).

The owner, 21.11: "לגבי הפער של עיצוב הביגוד זה עץ נחמד אבל הוא לא יכול להיות קשה מידי לפיתוח לעומת שאר המשפחות, כי יהיה ברזל ואז יהיה שריון מגינים חרבות ועוד שימוש מתכת, אז מי שמתקדם בייצור ביגוד יהיה לו קל מולם, לעומת מי שמייצר נשק ומתקדם בזה יהיה לו קל יותר בנשקים, גם אוכל או כישורים נוספים. תעשה בדיקת עצי סקילים אצל המובילים ותציע לי ערכת משפחות ראשונה, מול מה שיש לנו וגם אלטרנטיבה נקייה בלי מה שאתה יודע על המשחק כבר (חוץ מזה שזה עולם פתוח לחקירה)".

What he asks for, in plain words:
- No family may be harder to grow in than another.
- Going deep in a family makes things easier inside that family only. The clothier is the one who finds armour easy when iron comes, the weapon maker finds weapons easy, and the same goes for the cook.
- Survey how the leading games split making into families.
- Propose two sets. Set A is fitted to what we have. Set B is clean, built knowing only that this is an open world to explore.

**The two sets in one line each.**
- **A, fitted:** the schools stay as built. Inside each craft school, the families split by what a thing is for: wear, tools, arms, food. Each family gets the same group of 4 nodes, and six parity checks in numbers that `pnpm check` can run.
- **B, clean:** six families by use (Wear, Arms, Kitchen, Remedies, Fieldcraft, Jewelcraft) on one 50-level table, each with 12 small nodes and 2 big ones, two deep families per player, and ten parity checks. It is written in docs/design/SKILL_FAMILIES_CLEAN.md, unchanged, and summarised in section 4.

Both sets agree on the things the survey's leaders agree on:
- families split by use
- metal arrives as a material wave, not as a family
- one shape and one curve for every family
- the edge stays inside its family

**Recommendation, and the owner's pick: A now, B later.** A runs on the kernel as built. It takes B's split by use and B's metal wave, and leaves B's level table, point economy and deep slots for later, when the tree grows past its first schools.

## 1. What the tree holds today (as built, develop 16445813)

### 1.1 How a player grows

- **Profession levels.** Each profession has 9 levels, set by 8 thresholds in seconds of work (`xp_levels`, content/core/professions/*.json).
- **Tiers.** A recipe's tier opens at level 1, 3 or 6 (`tier_min_level` [1, 3, 6], content/core/params.json:94-98). There is no wall: each level under a recipe's takes 5% off the chance.
- **Points.** One skill point for every profession level gained, in any profession. Points are spent in any school: `skillPoints` = character level - 1 - spent, and the character level = 1 + the sum of (each profession's level - 1) (kernel/src/state.ts:610-618).
- **Costs.** A small node costs 1 point, a major 2, a corner 3, a keystone 4 (`growth.cost`, content/core/params.json:687-713; `nodes_max` and `slot_levels` at :714-722).
- **Techniques.** Majors and corners are techniques: they work only while they sit in the build. The build has 5 slots, opening at character levels 1, 1, 5, 10 and 15 (`slot_levels`), A player sees at most 12 nodes in one school, its paths and their race's corner (`nodes_max`).
- **What a node helps.** A craft node helps every recipe of its profession (the `Effect` description, schema/src/index.ts:1272-1275). A gathering node helps its own gathering. No built node names a family. The node `family` key, its reader and the combat gate arrive with #776, so after it lands a node may help one family only.

### 1.2 Every school and node

The family a node helps is "all" for every built node: every recipe of its profession, or its own gathering.

| School (file) | Node (line) | Size, cost | Needs | Effect | Race |
|---|---|---|---|---|---|
| Handcraft (content/core/schools/handcraft.json) | `sure-hands` (:14) | small, 1 | - | craft_speed_pct 5 | all |
| | `careful-work` (:23) | major, 2 | sure-hands | craft_chance_pct 10 | all |
| | `quick-knots` (:36) | small, 1 | careful-work | craft_speed_pct 5 | all |
| | `masters-eye` (:48) | major, 2 | quick-knots | craft_chance_pct 15 | all |
| | `tinker` (:64) | corner, 3 | careful-work | craft_chance_pct 10 | human |
| | `fine-fingers` (:78) | corner, 3 | careful-work | craft_speed_pct 15 | elf |
| | `patient-work` (:92) | corner, 3 | careful-work | craft_chance_pct 10 | skeleton |
| Cooking (content/core/schools/cooking.json) | `practiced` (:14) | small, 1 | - | craft_speed_pct 5 | all |
| | `camp-meal` (:23) | major, 2 | practiced | meal_fill_pct 20 | all |
| | `even-heat` (:36) | small, 1 | camp-meal | craft_chance_pct 5 | all |
| | `hearty-pot` (:48) | major, 2 | even-heat | meal_fill_pct 30 | all |
| | `inn-cook` (:64) | corner, 3 | camp-meal | craft_speed_pct 15 | human |
| | `herb-cook` (:78) | corner, 3 | camp-meal | meal_fill_pct 20 | elf |
| | `bone-broth` (:92) | corner, 3 | camp-meal | craft_chance_pct 10 | skeleton |
| Digging (content/core/schools/digging.json) | `steady` (:14) | small, 1 | - | dig_speed_pct 5 | all |
| | `old-signs` (:23) | major, 2 | steady | second_hint | all |
| | `quick-trowel` (:36) | small, 1 | old-signs | dig_speed_pct 5 | all |
| | `depth-sense` (:48) | major, 2 | quick-trowel | rare_find_pct 10 | all |
| | `stone-breaker` (:64) | small, 1 | steady | gather_speed_pct 5 | all |
| | `rock-grain` (:76) | major, 2 | stone-breaker | gather_speed_pct 8 | all |
| | `surveyor` (:89) | corner, 3 | old-signs | dig_speed_pct 10 | human |
| | `root-reader` (:103) | corner, 3 | old-signs | rare_find_pct 10 | elf |
| | `grave-wise` (:117) | corner, 3 | old-signs | rare_find_pct 15 | skeleton |
| Foraging (content/core/schools/foraging.json) | `quick-fingers` (:14), `sure-grip` (:36) | small, 1 | -; steady-pick | gather_speed_pct 5 each | all |
| | `steady-pick` (:23), `forest-pace` (:48) | major, 2 | quick-fingers; sure-grip | gather_speed_pct 15 each | all |
| | `road-forager` (:64), `forest-born` (:78), `night-picker` (:92) | corner, 3 | steady-pick | gather_speed_pct 10, 20, 10 | human, elf, skeleton |
| Fishing (content/core/schools/fishing.json) | `still-water` (:13), `quick-reel` (:35) | small, 1 | -; patient-line | gather_speed_pct 5 each | all |
| | `patient-line` (:22), `deep-pool` (:47) | major, 2 | still-water; quick-reel | gather_speed_pct 10 each | all |
| | `net-mender` (:63), `river-listener` (:77), `still-as-bone` (:91) | corner, 3 | patient-line | gather_speed_pct 10, 15, 15 | human, elf, skeleton |
| Woodcutting (content/core/schools/woodcutting.json) | `sure-swing` (:14), `clean-cut` (:36) | small, 1 | -; felling-line | gather_speed_pct 5 each | all |
| | `felling-line` (:23), `heartwood` (:48) | major, 2 | sure-swing; clean-cut | gather_speed_pct 15 each | all |
| | `saw-wise` (:64), `tree-speaker` (:78), `tireless-swing` (:92) | corner, 3 | felling-line | gather_speed_pct 10, 15, 10 | human, elf, skeleton |

**Summing up.**
- Every school has 2 small nodes, 2 majors and 3 race corners (7 nodes). Digging has 3, 3 and 3 (9 nodes).
- A player can take only their own race's corner. So one school costs 9 points to fill, Digging 12.
- A profession's 9 levels give 8 points, which are spent anywhere.

| Profession | Levels for tier 2 / tier 3 | Minutes of work to level 3 / level 6 | Points from its own levels |
|---|---|---|---|
| Handcraft, Cooking | 3 / 6 | 0.7 / 12.0 | 8 |
| Digging | 3 / 6 | 1.5 / 15.0 | 8 |
| Foraging | 3 / 6 | 1.0 / 13.3 | 8 |
| Fishing, Woodcutting | 3 / 6 | 1.3 / 13.7 | 8 |

### 1.3 The craft recipes, by what they are for

Work is the sum of `active_ms` down a recipe's inputs, per unit made, the gathering left out. Steps are recipe steps from gathered goods.

| School | What it is for | Recipes (tier) | Work per piece | Steps |
|---|---|---|---|---|
| Handcraft | to wear | traveller's cap (1, a look); reed sandals, reed hat, satchel, lucky charm (2) | 10 s; 14 to 27 s | 2; 2 to 3 |
| Handcraft | tools | hammerstone, fishing rod, knapped pick (1); flint trowel, reed basket (2); stone trowel, fine basket (3) | 2 to 10.5 s; 10.5 to 11.5 s; 27.5 to 33 s | 1 to 2; 2; 3 |
| Handcraft | goods for other recipes | reed cord, stone flakes (1); dyed cord, woven mat, stone blade (2) | 3 s; 7 to 15 s | 1; 2 |
| Handcraft | remedies | bandage (1) | 6 s | 2 |
| Cooking | food | berry mash, herb tea, grilled fish, mushroom skewer, sunleaf mushrooms, herb stew (1) | 3 to 6 s | 1 to 2 |
| Cooking | goods for other recipes | split log (1) | 0.5 s | 1 |
| Handcraft, designed (CLOTHING appendix) | to wear | hare-fur hood, roe-leather jerkin and leggings, hare-leather shoes (1); boiled-leather cap and boots, fur-lined cloak (2); hardened jerkin and breeches, woven reed coat (3) | 19.5 to 22 s at tier 1 | 4 at tier 1 |

Handcraft's other tier-1 goods have a median work of 8 s; a tier-1 leather piece takes 19.5 to 22 s, that is 2.4 to 2.8 times (CLOTHING_BALANCE 7).

**What the design pages already plan** (PROGRESSION 4.2 and 4.3):
- A catalogue of craft schools split by material: Woodcraft, Tailoring, Leatherwork, Smithing (forking into Blades, Armour and Tools), Remedies and Tinkering, beside Cooking and Handcraft.
- A school grows to 32 nodes and 48 points: a main line of 12, 3 corners, 2 branches of 8 and a crown.
- Handcraft forks into Reedwork and Stonework.

In that plan the clothier and the armourer are different schools (Tailoring and Leatherwork against Smithing's Armour). The owner's word of 21.11 asks the opposite, so set A changes it.

## 2. Set A: the first family set, fitted to what is built

### 2.1 The families

A family lives inside a craft school as the recipe `family` key (#776). It is named by **what the thing is for**. The material stays on the item, as built: an item's `family` is its animal or plant.

| School | Family | What it makes now | Its materials now | What plugs in later |
|---|---|---|---|---|
| Handcraft | `wear` | the reed pair, the satchel, the lucky charm, the traveller's cap; the hide chain and the woven reed coat (CLOTHING) | reed, leather, fur; cloth when the land gives a fibre | mail and plate with the metal wave, made by the same family. Jewelry moves to its own family with precious metal |
| Handcraft | `tools` | the hammerstone, picks, trowels, baskets, the fishing rod | stone, reed; wood | metal tools with the metal wave |
| Handcraft | `arms` | nothing yet. It opens with the weapon wave: spear, sling, club, shield (WEAPONS) | wood, stone, sinew | metal blades and shields with the metal wave |
| Cooking | `food` | the six dishes | plants, fish; meat with the hunt | metal pots with the metal wave |
| Cooking | `remedies` | nothing yet. Herb tea and the bandage move here when it opens | herbs | stills and vials |

- **Goods for other recipes** (cord, flakes, mat, the stone blade, the split log) carry no family. They feed every family, so a family node never makes them cheaper for one family only.
- **The gathering schools stay as built** (Digging, Foraging, Fishing, Woodcutting; Hunting with combat), with no families inside them. Every family uses their goods.
- **A word on the word.** PROGRESSION 4.2 calls its five groups of schools (Gathering, Crafting, Combat, Movement, Social) "families". On this page a family is a group of recipes inside one craft school, as the recipe `family` key of #776 has it.
- **A school splits** only when a family holds the PATHS floor by itself (CLOTHING 6.2, proposed there). For example `wear` becomes its own school when it holds 16 recipes, 8 places and 3 quests. The family name goes with it, and so do its nodes and the points spent on them.

**The owner's moment, in set A.** A player who has made leather for a week meets their first iron. Mail and plate arrive as new recipes in their own family, `wear`. Their family nodes work on them, and their level carries over. The weapon maker gets iron blades in `arms`, and the cook gets iron pots in `food`.

### 2.2 One shape for every family

Each craft family gets the same group of 4 nodes on top of its school's shared 7. The group sits in the school file, in the node format of #776.

| Node | Size, cost | In the build | Needs | Effect (family only) |
|---|---|---|---|---|
| first small | small, 1 | always on | the school's first major | `craft_speed_pct` 5 |
| second small | small, 1 | always on | the first small | `craft_chance_pct` 5 |
| first major | major, 2 | a technique: works while in a build slot | the second small | `quality_pct`, when it is built (it waits, CLOTHING 9) |
| second major | major, 2 | a technique: works while in a build slot | the first major | one rule change from a closed list: a miss keeps one more input; (open, #784: "one more from a batch of goods for this family" gives output the inputs did not pay for, against G44 and R9 when the craft consumes its inputs; the alignment study settles it in its S4 page, and the node is not built until then; B's Hands branch in SKILL_FAMILIES_CLEAN.md has the same "+1 batch size" and the same conflict) no wear on this family's tools (an open end) |

- A full group costs 6 points. Every family's group costs the same, sits at the same depth in its school and gives the same numbers. Only the names and the text differ.
- Nodes carry no level of their own today: depth comes from the chain (`needs`) and the points, and the majors from the build's slots. A level band per node (PROGRESSION 3.3's bands of five levels) is a later step for the whole tree, not for families alone.
- **A family behind a gate** (arms, and leather until the hunt) has its group shown and refused while the fight is off (`gate: "combat"`, #776). So no point is ever spent on a node that cannot help yet.
- **Allowed bonus kinds:** `craft_speed_pct`, `craft_chance_pct`, `quality_pct`, and the closed list of rule changes.
- **Forbidden on a family node:** an effect on another family; a stat of the body; experience; a price (R8); a recipe only the node opens.

**Set A in numbers.**

| School | Today | After set A |
|---|---|---|
| Handcraft | 7 nodes; 5 seen by one race | 7 shared + 4 wear + 4 tools = 15 nodes, 13 seen by one race; + 4 arms with the weapon wave = 19, 17 seen |
| Cooking | 7 nodes; 5 seen by one race | 7 shared + 4 food = 11, 9 seen; + 4 remedies later = 15, 13 seen |

Thirteen seen nodes pass the cap of 12 (`nodes_max`), so set A raises it to 20 (C8). PROGRESSION 4.3 already plans 42 seen nodes a school; 12 was the placeholders' size.

A player who fills a school and one family group spends 9 + 6 = 15 points, two professions' worth of levels. Points come from any profession, so the cook who also gathers fills their group as fast as the clothier who also hunts.

### 2.3 The parity rule, in numbers a check can test

Six rows for `pnpm check` (proposed). Each row reads the content and the bundle's values. Every number is an integer per mille, so the kernel stays integer.

| # | Check | Pass when | Where it reads |
|---|---|---|---|
| F1 | One shape | every craft family has exactly 2 small and 2 major family nodes, the smalls at 5, the majors as techniques, each group hanging from its school's first major in the same order | content/core/schools/*.json; tools/src/schools.ts |
| F2 | One curve | every craft profession has the same `xp_levels`, and `tier_min_level` is one table | professions/*.json; params.json |
| F3 | Work per tier | a family's median work per piece at a tier is at most 2 times the median of the other families of its school at that tier | recipes: `active_ms` down the inputs, per unit |
| F4 | Steps | a family's pieces at a tier have at most 3 recipe steps from gathered goods (the games' band is 2 to 4, CLOTHING_BALANCE 2) | recipes |
| F5 | Pieces per tier | an open tier of a family holds at least 2 recipes, and at most 3 times the smallest family of its school at that tier | recipes, `open_tiers` |
| F6 | The edge stays home | a family node's effect reaches only recipes of its own family (built as a kernel test, #776), and its effect is one of the allowed kinds | tools/src/schools.ts; kernel/test/recipe-gate.test.ts |

**Today, and with the clothing wave as designed.**

| Family | F3 work (median, against the others) | F4 steps | F5 pieces (tier 1 / 2 / 3) | Verdict |
|---|---|---|---|---|
| wear, built | 10 s at tier 1 (only the cap): 1.3 times | 2 to 3 | 1 / 4 / 0 | F5 fails at tiers 1 and 3 until the hide chain lands |
| wear, with the hide chain | 20.75 s at tier 1: 2.6 times | 4 | 5 / 7 / 3 | **F3 and F4 fail** |
| wear, with P3 (scrape and tan as one step, CLOTHING_BALANCE 8) | 16.75 s: 2.1 times | 3 | 5 / 7 / 3 | F3 fails by a hair |
| wear, with P3 and one sinew thread on the jerkin and leggings | 16 s: 2.0 times | 3 | 5 / 7 / 3 | passes |
| tools | 8 s at tier 1 | 1 to 3 | 3 / 2 / 2 | passes |
| food | 4.5 s at tier 1 | 1 to 2 | 6 / 0 / 0 | F5: food has no tier 2 or 3 yet (Cooking's ladder is the cooking lane's) |
| arms, remedies | - | - | 0 | not open: the checks start when a family opens |

The wear family's fix is two edits to designed content that is not built yet (CLOTHING's appendix). No locked value moves.

**Built (step C, #769).** `pnpm check` runs F1 to F5 from `tools/src/families.ts` (F6 stays the kernel test of #776). The wear and tools groups are in the Handcraft school file, each with its two smalls (`quick-seams`, `steady-needle`; `deft-grip`, `sure-edge`), and `nodes_max` is 20. The fix above is built as C5: scrape and tan are one 6 s action and the jerkin and leggings take one thread. On the built content the table reads:

| Family | F3 work, tier 1 / 2 / 3 (median) | F4 steps (longest) | F5 pieces, tier 1 / 2 / 3 | Verdict |
|---|---|---|---|---|
| wear | 16 s / 17 s / 29 s | 3 | 4 / 4 / 1 | passes; one note: tier 3 holds 1 recipe, fewer than 2 (the hardened pieces wait) |
| tools | 8 s / 11 s / 30.25 s | 3 | 3 / 2 / 2 | passes |

- **F1 while the majors wait.** The row asks of a group two smalls at 5 (speed, then chance), the first hanging from the school's first major, and then none or two majors that are techniques. The majors `even-cut` and `close-stitch` are not built, so a group of two smalls passes, and a lone major is an error. When they land the row holds them to two.
- **F3 at the edge.** Wear at tier 1 is exactly 2.0 times the tools' median (16 s against 8 s), the largest the row allows. The row's ceiling is part of the design: a heavier hide piece fails it.
- **F5's floor is a note.** A tier with one recipe in a family is a `!` line, not an error, because a family fills tier by tier; the ratio to the smallest family is an error.
- **F2** holds today: Handcraft and Cooking share one `xp_levels` table. `tier_min_level` is one table by construction (one param).


### 2.4 What keeps B open (the owner: B is the later expansion)

A is built so that growing into B is mostly an addition: the names, the nodes and the points carry over. It is not free of rewriting: B still replaces the level table and the built schools' node files (section 5, "What it costs to build"), and how a player's saved levels and nodes move is not designed here, because no migration or migration test exists (open, for B's own pull request):

- **The family names carry over.** A's `wear`, `arms` and `remedies` are B's Wear, Arms and Remedies; `food` is Kitchen and `tools` is Fieldcraft. When a family becomes a school of its own, its recipes name that profession, and its nodes and the points spent on them move with it (2.1).
- **One curve.** F2 keeps one `xp_levels` table for every craft profession. B's 50-level table is then one swap for all of them at once, the way B moves every family's tiers together.
- **A's group fits inside B's shape.** A's speed node is where B's Hands branch starts, and A's quality major where its Finish branch starts. A's rule-change major is a kind B's big nodes may give. B adds the Thrift branch, the masterwork grade and the paths. A node kind that B forbids (a body stat, experience, another family's effect) is forbidden in A too (2.2).
- **Deep slots come later.** A limits majors with the build's slots. B's two deep families per player are a new limit added on top, and nobody loses a node to it.
- **No B-only system is half-built in A.** The masterwork grade, family points and paths wait for B's own pull requests.

## 3. Changes before -> after, and which need the owner's yes

| # | Before | After | Owner's yes? |
|---|---|---|---|
| C1 | Handcraft's families are `cloth`, `leather` and `reed`, by material (#776; CLOTHING 6) | `wear`, `tools`, later `arms`, by use. The material stays the item's `family` (hare, roe, reed) | **yes, given 21.11** with set A |
| C2 | CLOTHING 6.1: four nodes, two for leather and two for fur | one `wear` group of 4 and one `tools` group of 4, in the shape of 2.2 | **yes, given 21.11** (with C1) |
| C3 | PROGRESSION 4.2: Tailoring and Leatherwork are schools of their own, and Smithing makes armour | one `wear` family makes clothing and armour. It splits into its own school only by the floor rule, whole | **yes, given 21.11**: it changes the catalogue |
| C4 | Cooking has no family | `food` now and `remedies` later; herb tea and the bandage move when remedies opens | no: it follows C1 |
| C5 | The hide chain: scrape and tan are two actions, and the jerkin and leggings take two threads | one action, and one thread (F3, F4) | no: designed content, not built, no locked value |
| C6 | No parity check on families | F1 to F6 in `pnpm check` | no: it is built after the pick |
| C7 | The gathering schools | unchanged | no |
| C8 | `nodes_max` is 12 (params `growth`) | 20, room for the shared 5 seen nodes, three family groups and one more | no: a bound inside its range (1 to 400), it follows C2, and it moves no locked value |

## 4. Set B: the clean kit, unchanged

The clean kit was written from the survey alone, as the owner asked, knowing only that the game is an open world to explore. It is in docs/design/SKILL_FAMILIES_CLEAN.md exactly as written (172 lines, sections 1 to 12), with the survey it rests on in docs/design/SKILL_FAMILIES_SURVEY.md (10 games, 31 sources). Every "(unchecked)" mark there is carried as written; the Path of Exile 2 notes are mostly unchecked. Where the clean kit says "SURVEY.md (same folder)", it means docs/design/SKILL_FAMILIES_SURVEY.md.

Its one-screen summary, as written there:

| Family | Makes | Main material | Opens | Nodes small / big | Paths | Specialist's edge |
|---|---|---|---|---|---|---|
| Wear | clothing, later armour | fibre, hide; later metal | day one | 12 / 2 | Wayfarer (light, travel) · Guardian (protection, takes metal) | masterwork wear, signature outfits |
| Arms | weapons, shields | wood, bone, flint; later metal | day one | 12 / 2 | Hunter (ranged) · Warrior (melee, shields) | masterwork weapons, signature arms |
| Kitchen | food, drink | meat, fish, plants, salt | day one | 12 / 2 | Trail cook (long, travel) · Feast (strong, short) | masterwork meals, regional dishes |
| Remedies | potions, poisons, dyes | herbs, fungi, resins | day one | 12 / 2 | Healer · Alchemist (poisons, oils, dyes) | masterwork brews, regional cures |
| Fieldcraft | tools, exploring gear | wood, stone, fibre; later metal | day one | 12 / 2 | Pathfinder (climb, light, rafts) · Toolwright (tools, camp kits) | masterwork tools, signature gear |
| Jewelcraft | rings, amulets, charms | precious metal, gems | metal wave | 12 / 2 | Setter (gems) · Charmwright (small exploring charms) | masterwork settings, signature charms |

"All families: same 50-level table, tiers at 1/10/20/30/40, 9 points for 12 shared small nodes, 2 deep slots per player, at most 1 borrowed part per piece, and P1-P10 before anything ships."

## 5. The two sets side by side

| | Set A, fitted | Set B, clean |
|---|---|---|
| Split | by use, inside the built craft schools: wear, tools, arms, food, remedies | by use, as six families: Wear, Arms, Kitchen, Remedies, Fieldcraft, Jewelcraft |
| Metal | a material wave: new rows in wear, tools, arms and food | the same: a wave, not a family |
| Jewelry | inside wear until precious metal; then its own family | Jewelcraft, opening with the metal wave |
| Tools and exploring gear | `tools` in Handcraft | Fieldcraft |
| Gathering | its own schools, as built (Digging, Foraging, Fishing, Woodcutting; Hunting later) | not a family: anyone with the right tool gathers; each family's nodes raise the yield of its own materials |
| Preparing (cord, leather, flour) | goods with no family, in the school that makes them | inside each family |
| Levels | 9 per profession; tiers open at levels 1, 3 and 6 | 50 on one table; tiers at 1, 10, 20, 30 and 40; launch caps at 30 |
| Nodes per family | 4 family nodes (2 small, 2 major) on top of the school's 7 shared | 12 small in 3 branches of 4, and 2 big in one of two paths |
| Points | one per profession level, spent in any school | 9 family points per family (one each 5 levels) |
| How many deep | anyone takes every group; the build's 5 slots limit the majors in use | 2 deep families per player; levels and small nodes unlimited; one move a week |
| The specialist's edge | the family's majors: quality and one rule change | a masterwork grade (at most +10%), signature recipes, one rule change |
| Parity checks | F1 to F6 (one shape, one curve, work per tier at most 2 times, at most 3 steps, pieces per tier, the edge stays home) | P1 to P10 (one table, first piece in 5 to 15 minutes, time per tier within 15%, gathering per 1,000 XP within 15%, 3 ± 1 steps, 8 ± 2 pieces a tier, 12 + 2 nodes, supply in 2 regions, 1 borrowed part, specialist edge at most 10%) |
| Families leaning on each other | not written | at most 1 borrowed part per piece, from tier 2 |
| What it costs to build | the recipe `family` key, node `family` and the gate are built (#776); the groups are content; F1 to F6 are check rows | a new level table and curve, a family point economy, deep slots, paths and masterwork grades in the kernel; the built schools are rewritten |
| Where it fits | now, with 6 schools and 22 core recipes | when the tree grows toward PROGRESSION's catalogue (16 schools) and a market |

**Why A now.** It answers the owner's moment the same way B does: armour lands in the clothier's family, blades in the weapon maker's, pots in the cook's. It uses the frame already built (#776) and adds no kernel system. Its checks can run in `pnpm check` from the first content pull request. B is the better shape for a large tree with a market. Its parts can come into A one at a time when the tree grows: the borrowed-part rule, the deep slots, the masterwork grade.

## 6. Sources

- Ours: the school files, profession files and params cited above; kernel/src/state.ts:610-618; content/core/params.json:94-98 and 687-722; schema/src/index.ts:1262-1275; PROGRESSION 4.2 and 4.3; CLOTHING 6, 6.1, 6.2 and the appendix; docs/design/CLOTHING_BALANCE.md sections 6 and 7; #776.
- The survey: docs/design/SKILL_FAMILIES_SURVEY.md, 31 sources (S1 to S31), read 21.11.2026; the clean kit: docs/design/SKILL_FAMILIES_CLEAN.md. Both are copied unchanged from the manager's working folder.
