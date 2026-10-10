# Crafting audit: what the core enforces, what the rules say, and what the crafting core builds on it

Audit of `develop` at commit 4ee9433, read on 2026-10-09. Every fact about the code or the docs carries a path and the line as the snapshot numbers it. The product spec is Hebrew HTML (`docs/spec/product-spec-v4.6.html`); it is cited by HTML line with the section number, and the quoted line is translated. The twelve decisions this audit asked for were answered the same day; they are recorded in DECISIONS.md under 2026-10-09 and summarised in section 5. The first build wave is described in section 6 as it was built.

## 0. The request

The owner's brief (2026-10-09; the material names in it are examples, not a list):

- Crafting is recipes: a mix of gathered materials (iron, stone and wood were the examples). Collecting the materials is play.
- The combination space must be huge and must grow without friction through developers' extensions.
- The core of the mechanism must be stable as part of the economy, with rarity and difficulty tiers that cannot be broken: advanced materials are rare and appear once in a long while, reached through hard quests; advanced recipes are long; in return they give a significant upgrade to the player's abilities.
- Some advanced craftables may later give something obtainable only with paid credits: a hook now, nothing sold now.
- The whole idea is for advanced stages, but the foundations are needed now.
- Crafting is optional. A player with no interest in it still progresses (the examples were war, theft, robbery, hard rewarding quests, treasure hunting, riddles). A player who puts no skill points into crafting almost cannot craft, and progresses by the other roads.
- Deliverable: a thorough audit of the infrastructure and the play rules first, then the hard core of the world. Decisions are asked one at a time, simply, with a recommendation; the owner answers.

How this audit was made. Six areas were read in full: the rules (GAME_RULES.md, DECISIONS.md, the kernel review, the team docs), the spec, the kernel, the schema with the assembler and the checker, the content, and the client. A set of 53 starting notes, written before the reading, was then checked claim by claim against the snapshot, and each note was marked verified (true as written), corrected (partly true; the exact statement follows) or refuted (false). Every verdict was checked a second time by a separate reading of the same files. The verdicts are in Appendix A. Facts about other games (Appendix C) come from their public wikis and guides, linked there.

## 1. The enforced invariants

What refuses what, today, with the line that refuses it.

### 1.1 The kernel

The craft action (`kernel/src/step.ts:290-315`) passes eight gates in this order and then always succeeds. It draws nothing, grades nothing and never misses.

| Order | Gate | Line | What the player reads |
|---|---|---|---|
| 1 | the recipe exists in the bundle | `kernel/src/step.ts:293` | Unknown recipe. |
| 2 | the player knows the recipe | `kernel/src/step.ts:294` | You do not know this recipe yet. |
| 3 | a built camp part provides the recipe's station | `kernel/src/step.ts:295-298` | You need a campfire to cook. / You need a (station). |
| 4 | that camp part has a tile on the map | `kernel/src/step.ts:299-300` | The camp is missing from the map. |
| 5 | the player stands at that tile | `kernel/src/step.ts:301` | (the shared position check) |
| 6 | the level of the one craft profession reaches `recipe.level` | `kernel/src/step.ts:302` | Needs (profession) level N. |
| 7 | every input is in the bag | `kernel/src/step.ts:303-305` | You need (qty) (item). |
| 8 | the bag has room for what the recipe adds | `kernel/src/step.ts:306-307` | Your bag is too full for what this makes. |

After the gates (`kernel/src/step.ts:309-314`): the duration is `active_ms` sped up by the `craft_speed_pct` technique through the one clamp of rule R9 (`speedPermille`, `kernel/src/step.ts:611-613`), the inputs leave the bag, the outputs enter it, the recipe's `made` counter rises, the player is busy for the duration and the craft profession gains the base active time as experience.

Other kernel rules that touch crafting:

| Rule | Where |
|---|---|
| A new character knows every recipe whose `known` is `start`, sorted by id. | `kernel/src/step.ts:213-215` |
| `learn` consumes one fragment item from the bag and teaches the recipe it unlocks; it refuses an item that is not a fragment, an item the player does not hold, and a recipe already known. | `kernel/src/step.ts:564-572` |
| A quest reward may carry up to four recipes. | `schema/src/index.ts:313` |
| Skill points: character level = 1 + the sum over professions of (profession level - 1); points left = character level - 1 - points spent; an attribute stops at 10. | `kernel/src/state.ts:144-152`, `kernel/src/step.ts:574-582` |
| The power cap is read by character level from `power_cap_permille`; every speed bonus and the rare-find bonus pass through it. | `kernel/src/state.ts:154-159`, `kernel/src/step.ts:94-97`, `kernel/src/step.ts:611-613` |
| On a dig, the chance of a find of rarity rare or legendary is multiplied by the luck multiplier. | `kernel/src/step.ts:272` |
| A gather or dig takes the best tool of the kind in the bag by tier; a tool breaks after `uses` uses. | `kernel/src/step.ts:626-653` |
| The shop never buys a tool. | `kernel/src/step.ts:367` |
| A shop pays k * r * V / 1000 per unit, rounded down; the lowest it may charge is r * V. | `kernel/src/values.ts:173-180` |
| Gold is milli-gold; every milli-gold that enters or leaves the world goes through one ledger (minted, burned). | `kernel/src/state.ts:30-31`, `kernel/src/state.ts:64-65` |
| A save made with another content tag is adapted: every id the new bundle does not know is dropped from the bag, the wear, the made counters, the quests, the reputation, the experience, the journal, the recipes, the restores, the camp and the visited places; nothing is converted. The last 40 actions are kept for bug reports, not as a replay base. | `game/src/session.ts:243-265`, `game/src/session.ts:39-40`, `game/src/session.ts:53` |

The value table (`kernel/src/values.ts`), rule R7 as the code runs it:

| Rule | Where |
|---|---|
| One activity record per resource (verb gather, weight `easy`), per treasure (dig, `medium`) and per recipe (craft, `craft`, no rarity bonus). The `hard` weight is never used. | `kernel/src/values.ts:51-97` |
| The rarity bonus b is paid only when `respawn_ms` is above 0, and is the smaller of `rarity_bonus_ms[rarity]` and `rarity_budget_permille` of w * t. It is a cap per activity; nothing sums the bonuses of the world. | `kernel/src/values.ts:45-49`, `kernel/src/values.ts:63`, `kernel/src/values.ts:79` |
| Cost of one execution: w * t + 1000 * b + 1000 * sum(qty * V(input)). An output's value: share * den * cost / (100000 * num), rounded down. | `kernel/src/values.ts:105-118` |
| Cheapest-source relaxation over (items + 2) rounds; a value still falling after that is a recipe loop and an error. | `kernel/src/values.ts:126-149` |
| R7 in integers: 100000 * num * V <= share * den * cost, else "is worth more than the effort that makes it"; a value under 1 is an error; an input with no source is an error; shares must sum to 100. | `kernel/src/values.ts:151-168` |

### 1.2 The assembler (`tools/src/assemble.ts`)

| Refuses | Line |
|---|---|
| a core-only file type (`shop`, `profession`, `params`, `kit`, `map`) under an extension | `tools/src/assemble.ts:136` |
| two professions training one verb, and a verb no profession trains | `tools/src/assemble.ts:194-200` |
| a reference to an item that does not exist | `tools/src/assemble.ts:216` |
| a fragment that unlocks no existing recipe | `tools/src/assemble.ts:232` |
| a `make` step on no recipe, a `build` step on no camp part, a reward recipe that does not exist | `tools/src/assemble.ts:269`, `tools/src/assemble.ts:271`, `tools/src/assemble.ts:288` |
| a `find` of an item that is sold, made or grows in more than one place | `tools/src/assemble.ts:275` |

The bundle tag is the hash of the canonical content (`tools/src/assemble.ts:204`), so any content change is a new world for saves.

### 1.3 `pnpm check` (`tools/src/check.ts`, `tools/src/play.ts`)

| Refuses | Line |
|---|---|
| a bounded parameter outside [min, max], min above max | `tools/src/check.ts:57-61` |
| a power cap that falls with level | `tools/src/check.ts:67-71` |
| an active time outside [t_min_ms, max_action_ms] on a resource, a treasure or a recipe (not on a restore or a camp part, which also carry `active_ms`) | `tools/src/check.ts:109-117` |
| every value issue of section 1.1 (loops, R7, value under 1, missing inputs, shares) | `tools/src/check.ts:120-121` |
| an input of a recipe, a restore or a camp part, or a `bring` item, that nothing in the world gives (no value, not sold, not a reward) | `tools/src/check.ts:124-136` |
| a shop price under r * V | `tools/src/check.ts:140-150` |
| a declared rarity more than one step from the computed one: a find's rarity from its chance (30%, 10%, 3% bands), a node's from how many gates it has (hours, level 4 or more, respawn of 300 s or more), a recipe's from its highest input, one more when `known` is `found` | `tools/src/check.ts:77-102`, `tools/src/check.ts:152-166` |
| a value that moved more than `drift_budget_permille` (10%) from `content/values.lock.json`; a missing lock is a warning | `tools/src/check.ts:172-193` |
| a kit colour outside the core palette | `tools/src/check.ts:197` onward |
| the play rules: G2 counters, G4 gold-only rewards, G10 a build with neither station nor bag bonus, G14 and G21 talk length, G8 inscriptions nothing cites, G17 quest types | `tools/src/play.ts:91`, `:100`, `:111`, `:141`, `:131`, `:160`, `:169`, `:180`, `:190`, `:203` |

What the check does not verify today, and a crafting core needs: that some camp part provides a recipe's station (the kernel refuses at play time instead, `kernel/src/step.ts:295-298`); a recipe level against the length of the profession's `xp_levels`; a world-level rarity budget; a derived effort tier; an item tier of any kind; a bound on recipe expansion; rule G3; the active time of restores and camp parts.

### 1.4 The schema (`schema/src/index.ts`)

| Closed list or limit | Members | Line |
|---|---|---|
| `FORMAT_VERSION` | 1 | `schema/src/index.ts:16` |
| rarities | common, uncommon, rare, legendary | `schema/src/index.ts:44` |
| tool kinds | basket, trowel | `schema/src/index.ts:49` |
| stations | fire, workshop | `schema/src/index.ts:52` |
| item kinds | material, food, tool, fragment, treasure | `schema/src/index.ts:55` |
| attributes | carry, senses, agility, luck, stamina | `schema/src/index.ts:63` |
| a tool's tier and uses | tier 1 to 5 ("Better tools work faster"), uses 1 to 1000 | `schema/src/index.ts:101-102` |
| a recipe | station, active_ms, level 1 to 20 ("Cooking level required."), 1 to 6 inputs, 1 to 4 outputs with `share_pct`, known start or found | `schema/src/index.ts:168-180` |
| a camp part | slot fire, storage, workshop or shelf; 1 to 6 inputs; an optional station it provides; an optional bag bonus | `schema/src/index.ts:334-344` |
| technique effects | see_ripe, timing_window_pct, second_hint, rare_find_pct, craft_speed_pct, meal_fill_pct | `schema/src/index.ts:366` |
| a quest | up to 4 required quests, a reward of rep, gold (up to 10,000,000 mg), items and up to 4 recipes; no level gate | `schema/src/index.ts:307-313` |
| items per file | 40 | `schema/src/index.ts:549` |
| creator file types | resource, treasure, recipe, npc, quest, restore, camp, starter, items, creator | `schema/src/index.ts:574` |
| core-only file types | shop, profession, params, kit, map | `schema/src/index.ts:575` |
| `Ms` fields | 0 to 3,600,000 ms; the play bounds are the params, not the schema | `schema/src/index.ts:40` |

### 1.5 The content at the snapshot

18 items (materials, foods, two tools, three treasures, one fragment); 7 resources, all level 1 or 2, respawn 30 to 90 s; 3 treasures (respawn 60 s, 120 s, 300 s); 4 recipes, all at the fire, levels 1, 2, 1, 1, two of them `found`; 2 camp parts (the campfire provides the fire; the storage chest adds 10 to the bag); 3 professions of 9 levels each, one per verb; 1 shop that sells the basket and the trowel at 30,000 mg each, berries at 5,000, herb tea at 36,000 and berry mash at 42,000; 16 anchored values in `content/values.lock.json`. Parameters: effort weights 400, 600, 800, 1000 permille (`content/core/params.json:34-58`), rarity budget 100 permille (`:76`), rarity bonus 0, 150, 400, 1000 ms by rarity, k 500, r 10, t_min 1000 ms, max action 15000 ms, drift 100 permille, power cap 1000 to 3000 permille over 14 levels (`:60`). No camp part provides the workshop, and no recipe uses it.

### 1.6 The client

The craft panel (`game/src/ui/panels.ts:321-356`) lists the known recipes of the station the player stands at, asks the kernel's `check` for the refusal line of each, and sends the craft action. The journal has four tabs, tasks, items, recipes and skills (`game/src/ui/panels.ts:130-141`); the items tab lists every item alphabetically with no grouping (`:168-186`); the recipes tab names the station, the time and "cooking level N" (`:200`). A tool's tier shows as a speed line (`game/src/text.ts:239-241`). Rarity colours a bag slot (`game/src/ui/panels.ts:79`). The opening e2e cooks once at the fire and checks that the herb-tea recipe was learned (`game/e2e/opening.ts:529-537`, `:567-569`).

## 2. The written rules that bind crafting

### 2.1 The rules page (`docs/design/GAME_RULES.md`)

| Id | One line | Line |
|---|---|---|
| Pillar 1 | Every minute pays: something new to see at least every ninety seconds. | `docs/design/GAME_RULES.md:33-35` |
| Pillar 3 | Every task is a question, and the next one is a different kind; a counter is not a question. | `:38-41` |
| Pillar 4 | The world is the interface; nothing is built in the world in order to open a menu. | `:42-44` |
| Pillar 5 | Effort is never wasted: a miss keeps something, a wrong answer teaches. | `:45-46` |
| G3 | At most three quest steps visible at once; the journal shows the question, not the whole recipe. | `:91-92` |
| G4 | A reward changes what the player can do: a recipe, a tool, a place, an ally. | `:93-95` |
| G10 | A camp is built only if it gives a station, capacity, a path, a light or a trade. | `:119-121` |
| G11 | Nothing is built, bought or unlocked that the player cannot feel within one minute. | `:122-123` |
| G12 | A choice is real: neither side strictly better, both lead on; the basket-or-trowel choice is the model. | `:127-128` |
| G15 | A miss keeps something; a missed strike keeps the stone half the time and never keeps nothing. | `:139-140` |
| G17 | Every quest declares its type; no two of one type in a row. | `:159-162` |
| G18 | Getting an item is not one motion; across a chain, the way varies. | `:163-167` |
| G28 | No dark patterns: no punishment for being away, no timer that runs out while the player sleeps, no fake scarcity, nothing to pay for. | `:261-264` |
| G32 | Health is the one bar; eating is how the player heals, and cooking keeps its purpose. | `:288-292` |
| G34 | Each hazard has one thing to buy and one thing to make that answers it. | `:303-311` |
| G35 | No fighting; combat stays at stage 8 or a community vote. | `:312-314` |
| G36, G37 | An expedition is the valley's dungeon and never the only road. | `:318-324` |
| Section 6 | A request that breaks a rule is not built and the rule is not bent; six lines to the owner; the answer in DECISIONS.md the same day. An agent decides alone numbers inside the ranges of `params.json`; never a new step kind, a reward type, a rung of the ladder. | `:385-417` |
| Section 8 | What the check enforces: G2, G4, G8, G10, G17, G14 and G21 are errors since P-3. | `:442-458` |

### 2.2 The kernel review (`docs/kernel-review-v1.md`)

| Id | One line | Line |
|---|---|---|
| R1 | A pure step function; no clock, no I/O, no timers; absolute ticks. | `docs/kernel-review-v1.md:88` |
| R2 | Safe integers only; `mulDiv` and `idiv` with a stated rounding. | `:91` |
| R3 | Sorted ids, sorted keys, code-unit order. | `:94` |
| R4 | A draw is f(seed, entity id, per-entity counter); value and power checks use exact expected values. | `:97` |
| R5 | A save names the kernel build and the content tag; saves move forward through migrations; a removed item converts to something whose value is not higher. | `:100` |
| R6 | Nodes, recipes, drop tables, rewards, treasure, starter kits and conversions are activity records with active time between t_min and a maximum; waits and respawns are capacity and never count as time; gold moves only through one ledger. | `:103` |
| R7 | Nobody declares V; yield * V(out) <= share * (time + sum qty * V(in)); items reachable from input-free activities. | `:106` |
| R8 | The highest a shop pays is at most k * r * V; the lowest it charges is at least k * r * V. | `:109` |
| R9 | A build changes the active time of any activity and the output only of an activity without inputs; the combined multiplier is clamped to P(level). | `:112` |
| R11 | A merge or a parameter change moves no existing V by more than X percent from the anchor table. | `:118` |
| R12 | k, X, P(level), t_min, the maximum action and the attribution table live in one file with min, max, step and cooldown; r is fixed for good. | `:121` |
| V3, V9 | Counting waiting as work paid x5.3 and x12; gates never enter V; rarity is a supply limit. | `:46`, `:52` |
| G3 (gold), G6 | An output bonus on a recipe with valuable inputs pays x18 (so R9); an 8-hour action paid 8 hours in one click (so the maximum action). | `:57`, `:60` |
| D1 | Waiting or rarity raising a shop price: decided 2026-10-06, both, as a small bonus under a fixed budget (8.2). | `:165-166` |
| 7.1, 8.1 | Every activity carries an effort tier derived by the check, never declared; w * t replaces t; the tier weights live in the params with bounds. | `:205`, `:259-261` |
| 8.2 | An activity with a declared finite capacity may carry a rarity bonus b, fixed per tier; on the merged world the sum of (nodes / respawn) * b stays at or under beta (proposed 0.10); a full budget means a new rare thing enters with no shop bonus or the community moves beta. | `:270-272`, `:287-288` |
| 8.4 | A new verb arrives as one pull request with the step code, its sources as activity records, property tests and an example file. | `:305-307` |

### 2.3 The spec (`docs/spec/product-spec-v4.6.html`, by section)

| Section | One line (translated) | HTML line |
|---|---|---|
| 5 | Knowledge decides what is possible, skill decides whether you succeeded; luck tilts the odds and does not replace skill. | 153 |
| 5 | A new item, or a profession that uses existing verbs, is a data file; a new verb enters in a core release. | 156 |
| 5 | Power is not sold for money; an advantage in the game is obtained only inside the game. | 157 |
| 5 | Progress is a choice, not power; every level has a power cap; extensions add options, not a stronger character. | 160 |
| 5 | Effort pays, within a cap; hard work earns more than easy work. | 163 |
| 6 | The power cap is the maximum sum of effects (nodes and equipment) a character can hold at a level; premium currency is a separate currency for look items only, planned for a late stage. | 182, 205 |
| 8 | The launch is the period before metal, with two gathering professions and one crafting art, cooking; a new profession is a data file the community adds without code. | 252, 257, 248 |
| 8 | A new recipe is not received from a level-up: someone has to dig it (the same spec also gives recipes as quest rewards and through reputation). | 261 (367, 370, 303) |
| 8 | The next discoveries, by vote: hunting, fishing, pottery, farming, quarrying and metal. | 263 |
| 8 | The camp's four slots: fire, storehouse, workshop (making tools instead of buying them), collection shelf; every upgrade is built like a meal. | 276-277 |
| 8 | Profession level decides which resources, recipes and techniques are open; a node's effect comes from a closed list that includes "opening a recipe family"; the check sums nodes and equipment under the cap. | 284, 293, 294 |
| 8 | Tools come in quality grades; equipment and clothing is an item with a small, focused advantage and a look, capped by rarity and inside the power cap; an item with an advantage is found, made in the workshop or bought with gold, never sold for premium currency or money. | 343, 344, 351 |
| 8 | Four rarity grades for every resource and item; the creator picks a grade and the check verifies that difficulty and value match it. | 349 |
| 9 | G-6 (mandatory): cooking and basic recipes, meals, tools and products for sale; G-8: a profession level that opens resources and recipes; G-14 (desired): equipment with a small advantage; V-2: the economic check also sets the effort tier of every activity. | 388, 390, 396, 411 |
| 11 | A profession on existing verbs ("metal: ore from the ruins and processing at a furnace") is a level-1 file; protected rules are the voting right, the weights, the merge gate, the license and the revenue split, and nothing else. | 475, 517 |
| 13 | The price of an activity's output is work time times its tier weight; the check sets the tier from the file's data; tiers easy 0.4, medium 0.6, craft 0.8, hard 1.0; processing is the way up; most of the value of a rare thing is in use; waiting is not work and gives at most a rarity bonus; a quest's difficulty is the sum of its steps. | 542, 545-548, 552, 561, 582 |
| 15 | The lists of what the game can do are core code, closed and documented; base, attributes, equipment, nodes and meal enter one function that returns the values after the caps. | 681, 683 |
| 16 | Stage 3 brings the four-slot camp, the tree with the one calculator and caps, and the effort tiers; stage 6 brings premium currency and look items; combat sits at stage 8. | 703, 706, 708 |
| 17 | "Power is not sold" is a fixed commitment; the revenue split (40% to the creators' fund) is protected. | 765, 762 |
| 20 | Answered: the power cap at the top level (x3), the effort numbers (0.4, 0.6, 0.8, 1.0) and the 10% rarity budget live in `content/core/params.json`; the computed difficulty is the one internal scale (`docs/design/SETTLEMENT.md` 3.6, S3, 9.10). | 830, 834, 844 |

### 2.4 Decisions on record (DECISIONS.md)

Each row names the entry by date and title (a long title is cut at its colon).

| Date and title | What it binds |
|---|---|
| 2026-10-07, A save is a state snapshot plus the last actions, not a replay log | the save format; the action tail travels with bug reports. |
| 2026-10-07, Item values from a simplified relaxation solver | `values.ts` settles values by relaxation; retry when content adds recipe cycles that do not settle. |
| 2026-10-07, No workshop recipe for tools yet (marked paused) | a tool recipe gave the tools a computed value, and the shop floor then clashed with the 30-gold price the opening is balanced around. |
| 2026-10-07, Points are parameters, hours are not published, nothing is called credits | nothing is called credits until D5 has a formula. |
| 2026-10-08, Two step kinds, no format bump | the precedent: fields are added, old files read the same, FORMAT_VERSION stays 1. |
| 2026-10-08, The core content passes the play rules | three value anchors added, none of the thirteen moved. |
| 2026-10-09, twelve crafting entries | section 5 below. |

## 3. The gaps, by layer

The starting notes said "nothing exists yet" twelve times. Checked, and placed in the layer that closes each one. "Wave" refers to section 6.

| Id | The gap, as corrected | Layer | Closed by |
|---|---|---|---|
| C1 | Nothing groups materials: an item has a kind and a rarity and no class, family or tag (`schema/src/index.ts:83-112`). | schema | wave 1: `class`, `family`, `tags`, `classes` |
| C2 | No tier on materials, recipes or stations. A tool has `tool.tier` 1 to 5, which changes speed only (`schema/src/index.ts:101`, `game/src/text.ts:239-241`). | schema, check | wave 1: `item.tier`, `camp.tier`, the level bands |
| C3 | Stations are fire and workshop (`schema/src/index.ts:52`); no camp part provides the workshop, no check says so, the kernel refuses at play time (`kernel/src/step.ts:295-298`). | check, content | wave 1: "no camp part provides a (station)"; wave 3: the workshop part. New station names stay core releases (Q12). |
| C4 | A recipe cannot name a profession; the craft verb gates on the one craft profession (`kernel/src/step.ts:302`, `schema/src/index.ts:172`). | schema, kernel | wave 1: `recipe.profession` and the check; wave 2: the kernel gate |
| C5 | No graded or probabilistic recipe output; a craft that passes its gates always yields in full and draws nothing (`kernel/src/step.ts:309-314`). | kernel | wave 2 (Q4) |
| C6 | No form for a long recipe inside the 15 s action cap; no recipe uses another recipe's output (`content/core/recipes`). | design, content | answered by Q8 (chains); wave 1 checks one tier per step; wave 3 writes the first chains |
| C7 | No equipment kind, no equipped slot on the player (`kernel/src/state.ts:23-54`), no calculator that sums worn effects under the cap. | schema, kernel | wave 1 names the classes `garment`, `jewelry`, `tool`; wave 2 (Q9) adds the slots and the calculator |
| C8 | No world-level rarity budget: the bonus is capped per activity (`kernel/src/values.ts:45-49`) and the node count is never read. | kernel, check | wave 1: `rarityBudget` and its check |
| C9 | No premium hook of any kind, no cosmetic item kind; the letter D5 is the creator-fund formula (`docs/kernel-review-v1.md:175`). | schema, check | wave 2 with the look layer (Q1, Q9); register CR-9 |
| C10 | No conversion for an item an extension removes; `adapt` drops unknown ids from a save (`game/src/session.ts:250-261`), against R5. | schema, kernel | register CR-2 |
| C11 | No quest gate by profession or character level; a quest has `requires` (quest ids) only (`schema/src/index.ts:307`). | schema | register CR-10 |
| C12 | No family grouping in the journal; the items tab is alphabetical (`game/src/ui/panels.ts:168-186`). | client | wave 4 |
| C13 | The effort tier is set by verb, not derived; `hard` is never used (`kernel/src/values.ts:57`, `:70`, `:89`), against 8.1 and spec 13. | kernel | wave 1: `effortTier` |
| C14 | The check's shop floor is r * V (`kernel/src/values.ts:178-180`, `tools/src/check.ts:143`), twice the k * r * V that R8 writes (`docs/kernel-review-v1.md:109`) at k = 500. This floor is what parked the tool recipe. | kernel, docs | register CR-1 |
| C15 | R12 is followed only in part: every bounded parameter carries min, max and step, none carries a cooldown, the check reads min and max only, and r is votable (5 to 20) although "fixed for good" (`content/core/params.json:16-21`, `tools/src/check.ts:51-74`). | check, docs | register CR-3 |
| C16 | Restores and camp parts carry `active_ms` and are outside the bounds check (`tools/src/check.ts:109-113`). | check | register CR-5 |
| C17 | Profession files are core-only (`schema/src/index.ts:575`), against spec 8 line 248 and spec 11 line 475. | schema, docs | Q12 keeps it so for now; register CR-7 |
| C18 | The shop never buys a tool (`kernel/src/step.ts:367`): a crafted higher-tier tool has a value and no sell-back. | kernel, design | register CR-8 |

## 4. Collisions between the brief and the written rules

| Id | The brief says | The rules say | Verdict and resolution |
|---|---|---|---|
| D1 | some advanced craftables may later need paid credits | G28 "nothing to pay for" (`docs/design/GAME_RULES.md:261-264`); spec 5 line 157 and 17 line 765 "power is not sold", a fixed commitment (not a protected rule: section 11 line 517 protects only the vote, the weights, the merge gate, the license and the split); premium currency buys look items only, stage 6 (6:205, 16:706). "Credits" in this repository means attribution (`docs/team/PLATFORM.md:378`). | Corrected: the collision holds, the word "protected" does not. Resolved by Q1: power is never sold; the hook is a marker on look items only. |
| D2 | war, theft, robbery as the non-crafter's roads | G35 no fighting (`:312-314`); D6 deferred ownership, conquest and lawless zones (`docs/kernel-review-v1.md:242`, `:256`); kernel review 7.2 makes control of an entity, contesting it and local rules new verbs, core releases, not before the live shared world (`:230`); combat itself sits at stage 8 (spec 16 line 708); G28 forbids punishing absence. | Verified. Resolved by Q2: the roads already written; combat waits for stage 8 or a vote. |
| D3 | without skill points one almost cannot craft | spec 5 line 153 knowledge decides what is possible, skill whether you succeeded; pillar 5 (`:45-46`); G15 (`:139-140`); R9 lets no build change the output of an activity with inputs (`docs/kernel-review-v1.md:112`). The spec does let a node "open a recipe family" (8:293) and profession level open recipes (8:284). | Verified. Resolved by Q3 and Q4: the profession gates, skill decides the chance, luck tilts, a miss keeps something. |
| D4 | a significant upgrade to the player's abilities | spec 8 line 344: equipment is "an item with a small, focused advantage, and a look", capped by rarity and inside the power cap; spec 5 line 160 "progress is a choice, not power"; R9; the cap's direction is x3 at the top level (20:830). G-14 is desired, not mandatory (9:396). | Verified. Resolved by Q9: a small capped bonus and a set bonus; "significant" means new capability and reaching the cap. |
| D5 | rare materials appear once in a long while | R6 waits are capacity; 8.2 lets a capacity-limited source carry a fixed bonus under beta (`docs/kernel-review-v1.md:268-272`); G28 forbids fake scarcity and sleeping timers; spec 5 line 158 no clock runs while the player is away. | Corrected: no collision with R6 as amended; the constraint is G28. Resolved by Q7: rarity is capacity and gates, inside the budget, never a timer. |
| D6 | advanced recipes are long | R6 and the params bound every action to 1 to 15 s (`tools/src/check.ts:109-117`); G6 of the review makes anything longer a wait in a slot (`:60`). G3 does not collide: it caps visible quest steps, not recipes. | Corrected. Resolved by Q8: a long recipe is a chain of short steps. |
| D7 | the combination space grows almost without end through extensions | the closed lists (`schema/src/index.ts:9-11`, section 1.4); one profession per verb (`tools/src/assemble.ts:194-200`); profession core-only (`:575`), against spec 8 line 248 and 11 line 475. | Verified. Resolved by Q5 and Q12: classes, families, tags, templates and recipes grow without end; verbs, stations, professions, effects and params stay core for now. |
| D8 | iron among the materials | spec 8 line 252 the launch is the period before metal; line 263 the next discoveries by vote; spec 11 line 475 lets anyone propose a metal profession as a level-1 file; team content is stage-1 core content only (16:751). "Iron" appears in no file of the snapshot. | Corrected: the vote does not hold all metal content, the team's hand does. Resolved by Q11: the grammar carries mineral and metal; the content waits for its discovery. |

## 5. The decisions

All twelve were asked on 2026-10-09 and answered the same day; each answer is an entry in DECISIONS.md under 2026-10-09 with the title below. The order here puts the questions that shape the schema first, because the first build wave is schema and checker; the original question numbers stand beside each. No answer touches a protected rule (spec 11 line 517). Q1 touches the fixed commitment of spec 17 and keeps it.

| Order | Q | The question | The answer (DECISIONS.md, 2026-10-09) | Rules touched | Changes |
|---|---|---|---|---|---|
| D-CRAFT-1 | Q5 | How is a material described so the combinations grow without end? | "The material grammar: base classes from the core, more classes from extensions". Base classes owned by the core; an extension may declare a class under a base class; family and tags open; every item a tier; a template is a class and a lowest tier, expanded at assemble time into concrete recipes, bounded. | spec 15:681, R7, D7 | schema, check, content, docs |
| D-CRAFT-2 | Q6 | One ladder or two, and what cannot be broken? | "Two ladders: an open-ended tier for how advanced, the four rarities for how often". The tier is a number the core opens stage by stage (1 to 3 at launch); rarity stays four. The check refuses an output more than one tier above its highest input, a level outside the tier's band, a station below the recipe's tier, a tier 3 or higher from an ungated source, a world over its rarity budget, a template past its bound; the effort tier is derived. | 8.1, 8.2, spec 8:349, 13:542 | schema, kernel, check, content |
| D-CRAFT-3 | Q3 | One crafting skill or several? | "One craft verb; a recipe names the profession that gates it". The verb stays one; `recipe.profession` is optional and defaults to the station's profession; one profession per verb and station family; core-only for now. | spec 8:248, 11:475, A17 | schema, check (wave 1), kernel (wave 2) |
| D-CRAFT-4 | Q12 | What may an extension add? | "Extension reach: as far as it can be made safe, opened stage by stage". Items with class, family, tags and tier; classes under a base class; recipes and templates; resources, treasures, camps that provide existing stations, quests. Not a verb, a station name, a profession, an effect or a param yet. | spec 10, 15:681, 8.4 | schema, assembler, docs, roadmap |
| D-CRAFT-5 | Q11 | Metal now or later? | "Metal: the grammar is ready, the content waits for its discovery". Mineral and metal are base classes from the start; no metal item or class until the discovery; the first chains are wood, stone, fibre and clay. | spec 8:252, 8:263, 11:475 | content, check |
| D-CRAFT-6 | Q9 | What does the upgrade give, and where is it worn? | "The upgrade: work clothes with a small capped bonus, and a look layer on the same slots". Slots: head, top, trousers or a full outfit, feet, two jewelry, a hand tool; small capped effects from the closed list plus a set bonus, one calculator under the power cap; a look layer on the same slots carries the premium marker; a weapon waits for G35; the bag gets categories. | spec 8:344, 15:683, R9, G35 | schema, kernel (wave 2), client (wave 4) |
| D-CRAFT-7 | Q4 | What happens when a craft fails? | "A craft can miss: skill decides, luck tilts, a miss keeps something". A success chance set by skill against the recipe's level, tilted by luck stones and the character's luck, a miss that keeps something (G15), R4 draws, value at perfect execution (R6), never above (R9), under the power cap. | spec 5:153, pillar 5, G15, R4, R6, R9 | kernel (wave 2), docs |
| D-CRAFT-8 | Q8 | How is a recipe long? | "A long recipe is a chain of short steps". Intermediate items at stations, one tier per station step, each step inside the action cap; never a single long timer. | R6, G3, 13:582 | check (wave 1), content (wave 3) |
| D-CRAFT-9 | Q7 | Where does rare value come from? | "Rare value comes from capacity and gates, paid by work and chance". Count, respawn, hours, level, tool and find tables, under the 10% budget; no event timers. | R6, R7, 8.2, G28 | kernel, check (wave 1) |
| D-CRAFT-10 | Q10 | What does the workshop make? | "The workshop makes better tools that no shop sells; the 30-gold tools stay". Higher-tier tools come from recipes only; the basket and the trowel keep their price; R8 is untouched. | R8, DECISIONS 2026-10-07 (parked entry) | content (wave 3), docs |
| D-CRAFT-11 | Q1 | What may money ever buy around crafting? | "Crafting and money: power is never sold; a look may carry a marker for a later premium sale". Nothing crafted is sold or gated for money; a marker is allowed only on look items with no effect, and the check enforces that; the recipe itself is always obtainable in the game. | G28, spec 5:157, 17:765, 6:205 | schema, check (wave 2), roadmap (stage 6) |
| D-CRAFT-12 | Q2 | How does a non-crafter progress? | "Crafting is optional: a player who never crafts progresses by the roads already written". Hard quests, treasure and digging, riddles, mastery of the minigames, the expedition and reputation; combat stays out until stage 8 or a vote. | G35, G36, G37, G28, D6 | docs (G38), roadmap |

## 6. The build waves, adjusted to the answers

Every wave: a branch from `origin/develop`, one draft pull request into `develop`, `pnpm verify` and `pnpm e2e` green before the pull request, one concern per pull request, a DECISIONS.md line per decision it implements, and the next wave starts after the previous one is merged (CONTRIBUTING.md, "How a pull request is merged"). Schema changes are additive and FORMAT_VERSION stays 1. The waves do not edit `content/kit/**`, `game/src/scenes/world.ts`, `game/src/config.ts`, `game/e2e/*`, `game/vite.config.ts`, `game/3d.html`, `game/src/valley3d`, `game/src/cell3d` or `game/public/3d`, which other work owns.

### Wave 1: the grammar and the checker (built; pull request 30 from `feat/crafting-core`)

What it adds, as built:

- Schema: `class`, `family`, `tags` (up to 8) and `tier` (1 to 20) on an item; `classes` declared under a base class (up to 10 per file); the `template` record type with class inputs (`class`, optional `family`, `min_tier`, `qty`); `recipe.profession` optional; `camp.tier`; `profession.stations`; params `open_tiers` (3), `tier_min_level` ([1, 3, 6]) and `template_max_recipes` (12). The base classes: plant, wood, fibre, stone, clay, mineral, metal, animal, meal, tool, garment, jewelry, relic.
- Kernel: `effortTier(verb, tier)` (8.1) and `rarityBudget(content)` (8.2); every core item is tier 1, so no value moves and `values.lock.json` is untouched.
- Assembler: classes collected, templates expanded in id order into recipes known from the start, each carrying `template`; the bound refused with the fix named.
- Checker, `checkCrafting`: every refusal of D-CRAFT-2, plus: an item without class or tier, a tool outside class `tool`, a non-food meal, anything under `metal`, a profession that works stations without training craft, a station worked by two professions, a recipe level the profession does not reach, a station no camp part provides, `tier_min_level` that does not start at 1 or does not rise.
- Content: the 18 core items tagged (two tools, four meals, berries, herbs, mushrooms, wood, stone, pottery, relics), cooking works the fire; the extension template's plum is a plant of family plum.
- Docs: "Classes and tiers" and "Recipe templates" in `docs/creators/README.md`; the crafting rules G38 to G45 in `docs/design/GAME_RULES.md` with their coverage rows.
- Tests: 29 checker cases (one world that passes with zero errors and one case per refusal) and 8 value cases.

What changed from the first plan, and why: the tier is a number the core opens (D-CRAFT-2), not the four rarities; a template input may name a `family`, because a broad template (plant with plant) passes the bound today and breaks when another creator adds plants, and the check runs on the merged world; a recipe counts as a gated source for tier 3 and up through its level band, because every output has a level gate in the recipe itself; the G-rules moved from wave 3 into this wave so the checker's messages can cite them; one craft profession per station is enforced now so the default of D-CRAFT-3 is well defined before the kernel reads it in wave 2.

### Wave 2: the kernel (built on `feat/crafting-wave2`)

- The craft gate reads `recipe.profession` (or the station's profession) and the station's tier; the assembler allows one profession per verb and station family (D-CRAFT-3).
- The craft chance (D-CRAFT-7): a success chance from skill against the recipe's level, tilted by luck stones and the character's luck through R4 draws; a miss keeps part of the inputs and makes nothing else; value at perfect execution, never above the certificate.
- Worn items (D-CRAFT-6): the slots head, top, trousers or full outfit, feet, two jewelry, hand tool; effects from the closed list, bounded per tier; a set bonus; one calculator with the power cap; the look layer on the same slots and the `premium_later` marker allowed only on look items with no effect, which the check enforces (D-CRAFT-11, CR-9).
- Invariant tests extended (replay, determinism, bag, ledger, the miss); `pnpm verify` and the opening e2e green.

As built (the readings are in DECISIONS.md, 2026-10-09, "Crafting wave 2 as built"):

- Schema: `wear` (slot, `look`, up to two effects from the worn list, `set`) and `premium_later` on an item; `miss` (`keep_pct` up to 90) on a recipe and a template; `upgrades` on a camp part; the effects `gather_speed_pct`, `dig_speed_pct` and `craft_chance_pct`; params `craft_chance_bp`, `craft_level_step_bp`, `craft_luck_max_permille`, `craft_miss_keep_pct`, `wear_effect_max_pct` and `wear_set_bonus_pct`.
- Kernel 0.3.0: `recipeProfession`, `recipeTier`, `craftChanceBp`, `craftLuckPermille` and `missOutcome`; the craft refuses a station below the recipe's tier and a level of the recipe's own profession, draws once per try and keeps part on a miss; the `wear` and `unwear` actions and the `miss`, `wear` and `unwear` events; `effectValue` (techniques and worn pieces, one calculator, every rate still clamped under the power cap); `fitWorn` takes off what leaves the bag; `campBuilt` follows upgrades.
- Assembler and checker: the bundle's `stations`; template recipe ids with "+"; `checkWear` for G39 and G44; the miss and the upgrade rules of G40 and G41.
- Client: the miss, wear and unwear lines and the miss sound; an old save gains empty worn places and craft counters, and a new world version teaches its new start recipes.
- Tests: kernel crafting (gate, chance, luck, miss, replay and ledger), worn items (places, layers, set, power cap, a random run that keeps every worn unit in the bag), worn and miss schema cases, the checker's passing world and every refusal, the save cases, and the invariant run with wear and unwear.

### Wave 3: seed content and creator docs

- Two or three chains that climb tier 1 to 2 to 3 through a station each, inside the period before metal: wood, stone, fibre and clay (D-CRAFT-5, D-CRAFT-8); one template among them.
- The workshop camp part (tier 1, and a tier-2 part) and the first higher-tier tools that no shop sells (D-CRAFT-10); the first garments and jewelry as worn items.
- `docs/creators/README.md`: adding a material, a recipe, a template, a worn item; what the check refuses and why (the parts wave 1 did not write).
- `docs/team/GRUNT.md` rows for what stays open (Appendix D).

### Wave 4: the client, inside the existing craft panel

- Class and tier shown on an item and a recipe; the gate that blocks (which level, which station tier, which profession); the family row in the journal; the bag categories of D-CRAFT-6. No restyle.

The owner's economy answers of 9.10 evening (DECISIONS.md, 2026-10-09, "The crafting economy") change waves 3 and 4 where they differ from the lines above: a craft is no longer refused for its level, so the gate that blocks is the station's tier alone, and the screen shows no chance, no word for the difficulty and no wanted level. The new work is in Appendix D, CR-16 to CR-23, with the decided CR-8.

## Appendix A. The starting notes, checked

| Id | The note, in a few words | Verdict | Correction and citation |
|---|---|---|---|
| A1 | value is a checked certificate, R7 | verified | the formula in integers: `kernel/src/values.ts:105-118`, `:162-165`; b enters the cost as 1000 * b |
| A2 | w = 400 / 600 / 800 / 1000 permille | verified | `content/core/params.json:34-58` |
| A3 | t bounded 1,000 to 15,000 ms per action | corrected | the schema allows 0 to 3,600,000 (`schema/src/index.ts:40`); the bounds are the params `t_min_ms` and `max_action_ms` (votable 500 to 2000 and 8000 to 30000), enforced by the check for resources, treasures and recipes only (`tools/src/check.ts:109-117`) |
| A4 | b only on capacity-limited sources, capped at 10% of w * t | verified | `kernel/src/values.ts:45-49`, `:63`, `:79`; the cap is per activity |
| A5 | waiting is never paid (R6) | corrected | R6 says waits are capacity and never count as time (`docs/kernel-review-v1.md:103`); since 2026-10-06 a capacity-limited source may carry a fixed bonus under a budget (`:166`, `:270`); the words "waiting is never paid" are the code's (`schema/src/index.ts:126`, `kernel/src/values.ts:11`) |
| A6 | the solver refuses loops and values under 1 | verified | `kernel/src/values.ts:126-149`, `:166`; the issues become check errors (`tools/src/check.ts:120-121`) |
| A7 | shops pay 50% of value and charge at least 100% (R8) | corrected | the code pays k * r * V / 1000 and charges at least r * V (`kernel/src/values.ts:173-180`); R8 as written puts the floor at k * r * V (`docs/kernel-review-v1.md:109`), half the code's floor at k = 500 |
| A8 | gold is one ledger in milli-gold | verified | `kernel/src/state.ts:30-31`, `:64-65` |
| A9 | 16 anchors, 10% drift, only `pnpm values` re-anchors | verified | `content/values.lock.json`; `tools/src/check.ts:172-193`; `tools/src/cli.ts:33-41` |
| A10 | a recipe is station, active_ms, level, inputs 1 to 6, outputs 1 to 4, known | verified | `schema/src/index.ts:168-180`; level reads "Cooking level required." (`:172`) |
| A11 | the craft gates, in order; no draw, no failure | verified | `kernel/src/step.ts:290-315`; section 1.1 |
| A12 | recipes are learned three ways | verified | `kernel/src/step.ts:213-215`, `:564-572`; `schema/src/index.ts:313` |
| A13 | "a new recipe is never received from a level-up" | verified | spec 8 line 261 reads "is not received"; the spec also gives recipes as quest and reputation rewards (lines 367, 370, 303) and lets a node open a recipe family (293) |
| A14 | draws f(seed, entity, counter); a save is a snapshot plus 40 actions; crafting draws nothing | corrected | draws `kernel/src/rng.ts:8-23`; replay `kernel/src/step.ts:137`; the save is a snapshot (`game/src/session.ts:205-215`) and the 40-action tail is attached to bug reports (`:39-40`, `:53`; DECISIONS.md 2026-10-07, "A save is a state snapshot plus the last actions, not a replay log"); crafting draws nothing |
| A15 | rarity declared on items and on finds, verified within one step | corrected | rarity is declared on items only; a find carries chance and share (`schema/src/index.ts:149`); the computed rarity is `tools/src/check.ts:77-102` as section 1.3 states |
| A16 | rarity feeds only the shop bonus and the check | corrected | it also tilts a dig's chance of a rare or legendary find by luck (`kernel/src/step.ts:272`) and colours a bag slot (`game/src/ui/panels.ts:79`) |
| A17 | one profession per verb; core-only types; craft is cooking; six effects | verified | `tools/src/assemble.ts:194-200`; `schema/src/index.ts:575`, `:366`; `content/core/professions` |
| A18 | skill points from character level; attributes capped at 10; none touches crafting | verified | `kernel/src/state.ts:144-152`; `kernel/src/step.ts:574-582`; craft speed comes from a technique, not an attribute (`kernel/src/step.ts:309`) |
| A19 | the power cap clamps every rate multiplier | verified | `kernel/src/state.ts:154-159`; `kernel/src/step.ts:94-97`, `:611-613`; 14 levels, 1000 to 3000 (`content/core/params.json:60`) |
| A20 | tools: basket and trowel, tier 1 to 5 changes speed only, bought not crafted | verified | `schema/src/index.ts:49`, `:101`; `kernel/src/step.ts:626-640`; `game/src/text.ts:239-241`; no recipe makes a tool |
| A21 | treasures are the only drop tables | verified | a resource has a fixed yield; a find has a chance (`schema/src/index.ts:149`) |
| A22 | the checker verifies R7, R8, V-2, R11, reachability, loops | verified | section 1.3; it also checks the params bounds, the power cap, the active-time bounds, the kit palette and the play rules |
| A23 | the checker does not verify station reachability, the rarity budget, the effort tier, quest difficulty | verified | section 1.3, last paragraph |
| A24 | the workshop tool recipe is parked over R8 and the 30-gold price | verified | DECISIONS.md 2026-10-07; `content/core/shops/trader-shop.json:11-16`; the clash is with the code's floor r * V (`tools/src/check.ts:143`) |
| A25 | 8.2 states a world budget, 8.1 a derived tier, spec 8 a quest difficulty sum | verified | `docs/kernel-review-v1.md:271`, `:261`; spec line 304; the code follows none of the three |
| B1 | closed verbs; a new verb is a core release | verified | `schema/src/index.ts:11`; `kernel/src/bundle.ts:120` |
| B2 | stations fire and workshop | verified | `schema/src/index.ts:52` |
| B3 | tool kinds basket and trowel | verified | `schema/src/index.ts:49` |
| B4 | item kinds material, food, tool, fragment, plus look items | corrected | five kinds: material, food, tool, fragment, treasure; there are no look items (`schema/src/index.ts:55`) |
| B5 | six technique effects | verified | `schema/src/index.ts:366` |
| B6 | closed quest step kinds | verified | `schema/src/index.ts:273`; bring, find, riddle, make, restore, build, visit (`kernel/src/step.ts:435-453`) |
| B7 | camp slots fire, storage, workshop, shelf | verified | `schema/src/index.ts:336` |
| B8 | extensions add nouns and numbers, items 40 per file | verified | `schema/src/index.ts:549`, `:574`; also npcs, restores, starters and a creator profile |
| C1 | no classes or tags | verified | section 3 |
| C2 | no tier anywhere | corrected | a tool has a tier of 1 to 5 (`schema/src/index.ts:101`); nothing else has one |
| C3 | no station beyond fire and workshop, no station reachability check | verified | section 3 |
| C4 | no `recipe.profession` | verified | section 3 |
| C5 | no graded or probabilistic output | verified | section 3 |
| C6 | nothing for long recipes | verified | section 3 |
| C7 | no equipment kind or slot | verified | `kernel/src/state.ts:23-54` |
| C8 | no world rarity budget | verified | section 3 |
| C9 | no premium hook; D5 is taken | verified | the only cosmetic mention is the demo title (`README.md:5`); D5 `docs/kernel-review-v1.md:175` |
| C10 | no conversion field for removed items | verified | `adapt` drops unknown ids (`game/src/session.ts:250-261`) |
| C11 | no quest gate by profession or level | verified | `schema/src/index.ts:307` |
| C12 | no family grouping in the journal | verified | `game/src/ui/panels.ts:168-186` |
| D1 | paid credits against G28 and "power is not sold" (protected) | corrected | section 4: not a protected rule, a fixed commitment |
| D2 | war, theft, robbery against G35, D6 and G28 | verified | section 4 |
| D3 | "almost cannot craft without points" against spec 5, pillar 5, G15 | verified | section 4; a node may open a recipe family |
| D4 | "significant upgrade" against R9 and spec 8 | verified | section 4 |
| D5 | "once in a long while" against R6 and the 10% cap | corrected | section 4: no collision with R6 as amended; G28 is the constraint |
| D6 | "long recipes" against the action bounds and G3 | corrected | section 4: only the action bounds collide |
| D7 | "endless extension" against the closed lists and one profession per verb | verified | section 4 |
| D8 | iron before the metal vote | corrected | section 4: the vote does not hold all metal content; the team's hand does |

## Appendix B. Files this audit read

| Area | Files |
|---|---|
| rules | `docs/design/GAME_RULES.md`, `DECISIONS.md`, `docs/kernel-review-v1.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/team/WORKFLOW.md`, `docs/team/HANDOFF_TEMPLATE.md`, `docs/loop/README.md`; `docs/design/TOOLKIT.md` and `docs/FTUE_RESEARCH.md` for economy lines |
| spec | `docs/spec/product-spec-v4.6.html`, `docs/design/GAP_WOW_RS.md`, `docs/team/PLATFORM.md`, `docs/team/GRUNT.md`, `docs/creators/README.md`, `README.md` |
| kernel | `kernel/src/values.ts`, `kernel/src/step.ts`, `kernel/src/state.ts`, `kernel/src/bundle.ts`, `kernel/src/rng.ts`, `kernel/src/world.ts`, `kernel/src/num.ts`, `kernel/test/*.ts` |
| schema and tools | `schema/src/index.ts`, `schema/src/validate.ts`, `schema/src/emit.ts`, `tools/src/check.ts`, `tools/src/assemble.ts`, `tools/src/cli.ts`, `tools/src/play.ts`, `tools/src/load.ts`, `tools/test/*.test.ts`, `mcp/src/*.ts` |
| content | every file under `content/core/`, `content/values.lock.json`, `templates/extension/**`, `.github/workflows/*.yml`, `.github/*.json` |
| client | `game/src/ui/panels.ts`, `game/src/text.ts`, `game/src/session.ts`, `game/e2e/opening.ts`, `game/e2e/cdp.ts` |

## Appendix C. How other games build tier ladders and equipment slots

Read for the two ladders (D-CRAFT-2), the slots (D-CRAFT-6) and the miss (D-CRAFT-7). Facts are the games' public design as their wikis and guides state it.

### Tier ladders

| Game | The ladder | What it teaches here | Source |
|---|---|---|---|
| Minecraft | Six tool materials: wood, stone, iron, diamond, netherite, gold. A tier sets the mining level (what it can break), durability and speed; a wooden pickaxe mines stone and coal, stone mines iron, iron mines diamonds, diamond mines everything. | The tool's tier gates the next material: the ladder is climbed one rung at a time, and gold is a side branch (fast, fragile, low level). | [Tiers](https://breezewiki.discard.no/minecraft/wiki/Tiers) |
| Valheim | Each biome hands out one metal (copper and tin for bronze, then iron, silver, black metal) and one boss whose drop opens the next biome; the next tier of gear is crafted at upgraded stations. | The station's tier and the place gate the material tier together; a boss (a hard quest) is the gate between rungs. | [Progression guide](https://xgamingserver.com/blog/valheim-progression-guide/), [Biome order](https://finalboss.io/valheim-how-to-follow-the-biome-progression-order-1-0-route) |
| Terraria | Ore tiers from copper to hellstone, gated by pickaxe power in bands (35 to 49%, 50 to 54%, 55 to 64%, 65 to 99%) and by bosses; the Nightmare Pickaxe is needed for hellstone. | Pickaxe power is one number that gates by band, the way a tier band gates a level here. | [Pickaxes](https://terraria.wiki.gg/wiki/Pickaxes), [Ores](https://terraria.wiki.gg/wiki/Ores) |
| Stardew Valley | Tools upgrade in order through copper, iron, gold and iridium at the blacksmith, five bars and gold each, two days of waiting; an upgrade cannot skip a level. | One tier at a time, paid in material and money; the wait is the one thing this game forbids (R6), so here the wait becomes a chain of steps. | [Tools](https://stardewvalleywiki.com/Tools), [Blacksmith](https://stardewvalleywiki.com/Blacksmith) |
| World of Warcraft Classic | Four profession ranks (apprentice 75, journeyman 150, expert 225, artisan 300), each learned from a trainer at a minimum skill and character level; recipes carry a skill requirement. | A level band per rank, and a trainer gate between bands: the `tier_min_level` bands with a profession that stops at a level. | [Classic proficiency](https://warcraft.wiki.gg/wiki/Classic_proficiency), [Professions guide](https://www.icy-veins.com/wow-classic/professions-guide) |
| Guild Wars 2 | Eight disciplines, levels 0 to 500; about every 25 levels a higher grade of materials unlocks superior versions of the same items; tier 6 materials need rating 400. | Material tiers and discipline levels advance together; the same recipe family repeats one tier up, which is what a template with `min_tier` gives. | [Craft](https://wiki.guildwars2.com/wiki/Craft), [Crafting detailed](https://www.pcgamer.com/au/guild-wars-2-crafting-system-detailed) |
| Albion Online | Tiers 2 to 8, each with enchantment levels .0 to .4; item power is one number (T4.0 is 700, each tier and each enchantment adds 100), so T8.0 and T4.4 are equal in power and differ in cost; quality adds a little more. | Two ladders folded into one number: the tier says how advanced, the enchantment how rare; choosing between them is an economic choice, not a power choice. | [Gear tier system](https://guildorder.com/games/albion/wiki/gear-tier-system) |

### Equipment slots and work clothes

| Game | The slots | What it teaches here | Source |
|---|---|---|---|
| Old School RuneScape | Eleven slots: head, cape, neck, weapon, body, shield, legs, hands, feet, ring, ammunition. | The full paper doll of a combat game; more than a gathering game needs before stage 8. | [Worn Equipment](https://oldschool.runescape.wiki/w/Worn_Equipment) |
| RuneScape and Old School RuneScape | Skilling outfits: each piece gives 1% extra experience in its skill, and the full set another 1% (6% for five pieces, 5% for four). | Work clothes with a small bonus per piece and a set bonus: the shape of D-CRAFT-6, with the bonus inside the power cap. | [Experience-boosting set](https://oldschool.runescape.wiki/w/Experience-boosting_set), [Skill set items](https://runescape.wiki/w/Skill_set_items), [Artisan's outfit](https://runescape.wiki/w/Artisan%27s_outfit) |
| Stardew Valley | Hat, shirt, pants, footwear and two rings; hats, shirts and pants are look only, boots give defence or immunity, rings give passive effects. | A look layer and a small effect layer on the same character, two rings as the jewelry slots. | [Clothes](https://stardewvalleywiki.com/Clothes) |

### A craft that misses

| Game | The miss | What it teaches here | Source |
|---|---|---|---|
| The Legend of Zelda: Breath of the Wild | Incompatible ingredients cook into Dubious Food or Rock-Hard Food; both still restore a little health. | A miss keeps something (G15), not nothing. Mistvale keeps part of the inputs, not a lesser dish (DECISIONS.md, 2026-10-09, "The crafting economy"). | [Cooking](https://zeldawiki.wiki/wiki/Cooking_in_Breath_of_the_Wild), [Rock-Hard Food](https://zeldawiki.wiki/wiki/Rock-Hard_Food), [Dubious Food](https://zelda-archive.fandom.com/wiki/Dubious_Food) |
| Final Fantasy XIV | A synthesis has progress, quality and durability; crafting stats decide the chance of a high-quality result; when durability runs out before progress is complete the synthesis fails and materials are lost. | Skill decides the chance and the grade; the loss of all materials on a miss is what pillar 5 and G15 rule out here. | [Crafting](https://ffxiv.consolegameswiki.com/wiki/Crafting), [Crafting basics](https://icy-veins.com/ffxiv/crafting-basics-in-ffxiv) |

## Appendix D. The open ends

Mirrored in `docs/team/GRUNT.md`, section "Open ends". An item leaves the list when its "closes when" is true on `develop`.

| Id | What is open | Where | Closes when |
|---|---|---|---|
| CR-1 | The shop floor in the code is r * V; R8 writes k * r * V. One of the two is wrong. | `kernel/src/values.ts:178-180`, `docs/kernel-review-v1.md:109` | the owner's word is in DECISIONS.md and either the review or `minChargeFor` matches it |
| CR-2 | A removed item is dropped from a save, not converted (R5). | `game/src/session.ts:250-261` | a conversion record exists in the schema and `adapt` applies it, before stage 2a saves |
| CR-3 | R12 names min, max, step and cooldown per parameter; the params carry min, max and step, no cooldown, the check reads min and max only, and r is votable though "fixed for good". | `content/core/params.json:16-21`, `tools/src/check.ts:51-74` | the check reads the step and a cooldown, or the review is amended |
| CR-4 | G3 has no check and no checklist question. | `docs/design/GAME_RULES.md:91-92`, `tools/src/play.ts` | a play rule counts visible steps, or section 8 records G3 as reviewed by hand |
| CR-5 | Restores and camp parts carry `active_ms` outside the bounds check. | `tools/src/check.ts:109-113` | the `timed` list includes them |
| CR-6 | Stale texts about the check: "!" lines, rules G1 to G16, kernel rules R1 to R11. | `docs/design/GAME_RULES.md:4`, `:76-77`, `:332`, `:382-383`; `AGENTS.md:9`; `CONTRIBUTING.md:15`; `docs/design/TOOLKIT.md:48-49` | one docs sweep |
| CR-7 | Professions are core-only, against spec 8 line 248 and 11 line 475; held so by D-CRAFT-4 for now. | `schema/src/index.ts:575`, `tools/src/assemble.ts:136` | the stage that opens professions to extensions, with its own decision |
| CR-8 | The shop never buys a tool; a crafted higher-tier tool has a value and no sell-back. Decided 9.10 (DECISIONS.md, "The crafting economy"): the trader buys a tool by the part of its uses left, and a tool may leave out `uses` and last. | `kernel/src/step.ts:367`, `schema/src/index.ts` | D-CRAFT-10's content lands with that sell-back and the optional `uses` |
| CR-10 | Quest gates by profession or character level for the non-crafter's roads. | `schema/src/index.ts:307` | a quest may name a level, or DECISIONS.md says it never will |
| CR-11 | Bag categories. | `game/src/ui/panels.ts` | wave 4 |
| CR-12 | A weapon slot waits for G35 (stage 8 or a vote). | roadmap | that stage or vote |
| CR-13 | Metal content waits for its discovery. | roadmap | a vote or an accepted proposal |
| CR-14 | A broad template can pass its bound today and fail on a later merge when another creator adds fitting items; the guide says to keep templates narrow. | `tools/src/assemble.ts` (wave 1) | the first such failure is handled, or the fit is scoped per creator |
| CR-16 | The average try: at its own level a tier-2 recipe uses 112.5 percent of its inputs for each success and a tier-3 recipe about 127; the value table prices only the success. | `tools/src/check.ts` | the check refuses a recipe whose average try at its own level loses value, p * V(out) + (1 - p) * V(kept) >= V(in), with a test |
| CR-17 | The level wall: a recipe above the profession's level is refused. Decided 9.10: no wall, the chance falls by `craft_level_step_bp` per missing level down to nothing, fitting gear counts on the side of skill, and the screen shows no chance or difficulty. | `kernel/src/step.ts` | the kernel no longer refuses on level and a try at nothing runs and misses, with tests |
| CR-18 | A made good sells for the raw share. Decided 9.10: the trader pays `k_craft_permille` (750) of r * V for an item whose value comes from a recipe. | `kernel/src/step.ts`, `content/core/params.json`, `docs/kernel-review-v1.md` | the param, the trader and R8 with Theorem 3 change together, with a test |
| CR-19 | The trader pays one price whatever the supply. Decided 9.10: a free market, a stock per item that moves the trader's and the shop's prices inside R8's band and drains with game time. Timing decided 9.10: the build right after crafting wave 4, one market per world, tuned in the demo; at stage 4 the players of a world share it. | `kernel/src/state.ts`, `kernel/src/step.ts` | the market stock and its prices exist with tests, and the trader shows today's price |
| CR-20 | No upgrade recipe: an item and more materials that give the next tier of the same item, whose miss keeps the item whole. | `schema/src/index.ts`, `kernel/src/step.ts` | such a recipe exists and its miss keeps the item, with a test |
| CR-21 | Worn effects are pluses only, so a set cannot trade one task for another. | `schema/src/index.ts`, `tools/src/check.ts` | a worn effect may carry a minus inside its tier's cap, with a check and a test |
| CR-22 | Gold per hour of making is not reported, so the market's steps cannot be tuned from numbers. | the values report in `tools/src/` | the values report prints gold per hour of making per tier |
| CR-23 | What gold is for: group quests and a settlement that players found, guard and feed together, meant as the main sink. | roadmap | its own plan, with a decision |
