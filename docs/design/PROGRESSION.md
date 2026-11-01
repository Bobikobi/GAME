# The progression map: the spine of a long game, its schools, its gear and its unlock economy (2026-10-25)

A map, not a content page. The owner's direction of 25.10: the infrastructure of the big long games (Fallout, Skyrim), games that take very long to complete, where levelling, crafting gear, clothing and weapons all hang on one thing: skills that unlock. This page turns that direction into world rules and algorithms (state machines, formulas, parameters) against what is already decided and built, so that every later content wave (a school's real nodes, a weapon family, a crafting ladder) is written to one map and not to the taste of its session. It takes GROWTH.md (the frame of schools, nodes, slots, keys, techniques and books) and COMBAT.md (both on `develop` since #414; COMBAT's numbers revised 29.10 in its section 4.9) as given and sizes them for a game of hundreds of hours.

Its entry: DECISIONS 2026-10-25 ⏸ "The progression map"; each answer to section 9 becomes its own entry and amends this page. The owner answered all eight on 25.10: eight ✅ entries of that day, folded in below and marked "(Q*n*, the owner)" where they land. Q8 (the body) is answered by "two bars only; places are harsh, gear answers them", with its two follow-ups Q8a (a harsh place takes health by its grade) and Q8b (food heals, dishes give timed effects, sleep only saves the night): the model, the numbers and the research are [BODY_CLOCKS.md](BODY_CLOCKS.md).

Design only. Nothing here is built: no kernel or screen changes with it, and the only content and schema it moves are the four balance values and the descriptions of the prover's findings (DECISIONS "Balance prover finding 1" to "12"). Everything marked **proposed** is a builder's shape or a reading of the owner's word, not his word; where an answer of his leaves a number or a form open, the builder's fill is marked proposed too. The questions that are his are in section 9, each with options and a recommended default. The two tree streams that were in flight on 25.10 have landed since: the skill-tree screen that draws a graph of any size (#334, 27.10) and fishing as a school (#340), with stone mining built as a Digging action rather than a school of its own (#339); section 4 names the shape their content waves land in.

Facts about Openfold are read from `origin/develop` @ 606e1620 (kernel 0.16.0): `kernel/src/state.ts` (`professionLevel`, `characterLevel`, `skillPoints`, `powerCap`, `techniqueValue`, `attrAt`), `kernel/src/step.ts` (`learn_node`, `equip`, `unequip`, `spend`, the experience line in the work step), `content/core/params.json` (`growth`, `per_point`, `power_cap_permille`, the crafting group), `content/core/professions/*.json` (`xp_levels`), `content/core/schools/*.json` (the five placeholder schools of 23.10), `content/core/recipes/`, `content/core/items/`, `content/core/races/`, `schema/src/index.ts` (`EFFECTS`, `WORN_EFFECTS`, `ProfessionBody`). Re-read on 30.10 at `origin/develop` @ 8d5cb9d (kernel 0.21.1): six school files now (fishing joined, #340), the tree as data with its screen (#334), weight, paces and bags (#297), the height layer in the walk (#405) and the gait (#424); `xp_levels` still eight thresholds, `growth.slot_levels` still [1, 1, 5, 10, 15] and `nodes_max` 12, so sections 3.1 and 3.5 read as written.

## 1. The map in one paragraph

A character grows on two axes at once. **By doing:** every school (a trade, later a weapon, a way of moving) has a skill level that rises only with the active seconds of its own verb, on one geometric curve whose ratio is the game's own difficulty step (each level asks half again as much), so that the first levels come in a minute and the last one in a string of long evenings, and a school's mastery is about fifty active hours (RuneScape's band, Q1). **By choosing:** every skill level anywhere pays one point to the character level, and points buy nodes in any school whose band the skill level has opened: a node is a thing you know how to do, a small one moves a number, a major one changes a verb or teaches a technique, a corner one is where a race meets a school. The character level is read by nothing but the caps (the power cap, the slot count, the forms of travel). Gear is made from what the schools gather, by the schools that craft, at the stations the world holds; a node never walls a recipe and never sells for gold; what a node does to gear is open its quality and its technique. Worn gear adds attribute bonuses on top of the bought pips, rising with its tier and never capped by a fixed number; an item names what it asks of its wearer, and below that it still helps, gently, one tier ahead of the wearer and no further (Q5). Experience comes only from a player's own actions; help in a group is a bounded share and a mentor's bonus, never a carry (Q7). The tree is a graph the player can never buy whole, so a build is a choice; a book or a cross-link is how a build reaches across schools. Rise-by-use opens, points buy: Skyrim's hybrid, kept, sized long.

## 2. What was decided before this page

| Decided | Where | What it fixes here |
|---|---|---|
| Skill points with effects you can feel, shown as now -> next | DECISIONS 2026-10-07 | A point is spent by choice; the screen shows the change in words |
| Crafting and money: power is never sold | DECISIONS 2026-10-09 (G39) | No node, recipe, quality or level in a shop |
| Crafting is optional; no level wall; a free market; worn pieces never wear out; a worn effect may carry a minus; the upgrade recipe | DECISIONS 2026-10-09 "Crafting is optional", "The crafting economy: a miss keeps only inputs, a free market, no level wall" | Section 5: gear's gates are place and knowledge, never a wall |
| One craft verb; a recipe names the profession that gates it; a craft can miss, skill decides, luck tilts | DECISIONS 2026-10-09 | The quality roll rides the same chance (5.3) |
| Two ladders: an open-ended tier for how advanced, four rarities for how often | DECISIONS 2026-10-09 | Tier and quality are two axes of a made thing (5.2) |
| Rare value comes from capacity and gates; a long recipe is a chain of short steps; the material grammar | DECISIONS 2026-10-09 | Gear chains (5.4); the price of upper tiers is rare inputs |
| The workshop makes better tools that no shop sells; metal waits for its discovery | DECISIONS 2026-10-09 | Smithing is a school whose content waits (4.2) |
| One internal difficulty scale: each step asks half again as much (`difficulty_ratio_permille` 1500) | DECISIONS 2026-10-09 | The experience curve's ratio (3.2) |
| The reference player: nothing worn, no points spent | DECISIONS 2026-10-09 | Every rate here is a multiplier on that player, under the power cap |
| First-tier recipes known from the start; higher tiers dug up | DECISIONS 2026-10-10 | Knowledge comes from the world, not from the tree (5.3) |
| A hazard is escaped, never answered by an item; road thieves wait for weapons | DECISIONS 2026-10-10 | Combat schools are a planned layer (4.4) |
| The world and its clocks: nothing shortens a wait | DECISIONS 2026-10-10 | No node, teacher or gold shortens a wait or a respawn (3.6) |
| G35 is the demo's rule: combat is a core part of the game, after the foundation | DECISIONS 2026-10-19 | The combat schools' names and shapes now, their nodes with the first foes |
| The skill screen as built is generic (the five attributes of pips are no tree) | DECISIONS 2026-10-19 ❌ | Attributes are keys and small pips, never the tree |
| The tree: the race is the vertical axis, each race its wing, a shared centre of attributes and small nodes, books teach from a foreign wing, the professions the horizontal axis | DECISIONS 2026-10-22 "The tree (decision 38)" | The tree's shape (4.1) |
| No percentages on screen; rising cost per tier, attribute keys, books and teachers, rare finds as the price of upper tiers | DECISIONS 2026-10-22 "No percentages on screen (decision 39)" | The unlock economy's four prices (6) |
| A fixed attribute profile per race, total 7, no free points at the title; six attributes; what a grade does; a required attribute opens a harder way, never a closed door | DECISIONS 2026-10-22 decisions 44, 45, 46; G12 | Keys (6.4) |
| Human technology means made things; making in the neutral valley has no forge, the smith and machines are in the city | DECISIONS 2026-10-22 decisions 20, 51 | Smithing and tinkering are city schools (4.2) |
| The skill tree's format: schools, nodes, the build; costs 1/2/3; slots at 1, 1, 5, 10, 15; learn and equip at a safe place; no unlearn yet | DECISIONS 2026-10-23 | The state and actions this page extends (7) |
| Travel earned by level: every faster form earned by player level, none bought | DECISIONS 2026-10-23 "The world's structure", item 7 | The character level's third reader (3.5) |
| Combat rounds 1-5: real time on the server's tick; one pack rule; bars over heads; noise turns every head; a fight reads the build's slots, the attributes as small keys and the thing in hand under one power cap | DECISIONS 2026-10-23 (carried from 20.10) | The weapon in the hand slot; the combat technique's format (COMBAT 4.3, GROWTH 3.5) |
| The night ruins revived: no door to the south, readiness is made (a torch, clothing against cold, cooked food, climbing gear, a weapon) | DECISIONS 2026-10-25 | Gear as soft gates (5.5); survival and climbing as schools (4.5) |
| Many animals come later, most hunted for what they give | DECISIONS 2026-10-25 | Hunting is the bridge between combat and leatherwork (4.2) |
| The owner, 23.10 (recorded in the race and tree answers): every trait must pay off, a weakness is always matched by a real advantage; the back is a real gear slot | DECISIONS 2026-10-23 "Each race carries its colour and its big item" and the bag entries | The race wings (4.1); the back slot in gear (5.1) |
| Growth frame: schools, three node sizes, slots and a build, keys, one technique format for work and combat, books, G87-G92 | GROWTH.md (on `develop`, #414) | Taken whole; sized here |

## 3. The spine: two axes and their formulas

### 3.1 What is built, read plainly

- A profession's experience is the active milliseconds of its own verb: `xp[profession] += ms` in the work step, nothing else pays it.
- `professionLevel = 1 + the count of thresholds met`, thresholds `xp_levels[i] * 1000` ms, at most twenty of them, in active seconds.
- `characterLevel = 1 + Σ (professionLevel - 1)` over all professions; `skillPoints = characterLevel - 1 - spent`.
- `powerCap` is a table by character level (`power_cap_permille`, fourteen entries, 1000 to 3000); `techniqueValue` sums the profession techniques by level, the learned small nodes always and the slotted techniques while in the build; the sum is clamped to the cap (R9).
- `spend` raises an attribute pip for a point; `learn_node` buys a node (1, 2 or 3 points) at a safe place; no unlearn.

So the spine is already Skyrim's hybrid: use raises the skill, every skill level pays one point, points buy by choice. What is missing is the size. Today's `xp_levels` run eight thresholds and end at about one active hour per profession (cooking 4 + 40 + ... + 3800 s ≈ 2.5 h at most; foraging ≈ 2.7 h), the power cap ends at character level 14, and the five slots are all open at 15. Nothing in it is wrong; all of it is short.

### 3.2 The skill curve (proposed)

One formula for every school, two numbers per school in the content and one constant for the game:

```
step(i)   = t1 * ratio^(i-1)                 for i = 1..20        active seconds for the i-th level
reach(n)  = t1 * (ratio^n - 1) / (ratio - 1)                      active seconds to stand at level n+1
ratio     = difficulty_ratio_permille / 1000 = 1.5                 the one scale of 9.10
t1        = the school's first step, 25 to 30 s, default 28 (Q1)  the only knob per school (param range 10..60 for tuning)
```

`xp_levels` stays the stored form (twenty integers per profession, generated from the formula by a script and checked against it, so a hand-tuned table is caught; `pnpm check` gains the row). Level 21, after the twentieth step, is **mastery**: the school's crown node opens (4.3) and the board's levels row counts it (DECISIONS 2026-10-09 "The boards rank worth, levels ...").

Why 1.5 and not Skyrim's power curve: the game already has one ratio for "the next step asks more" and a second constant would be a second scale; and 1.5 puts a third of a school's time into its last step, which is what makes mastery a thing (Skyrim puts about a quarter into the last ten levels).

The owner's word (25.10, Q1 = C): `t1` 25-30 s, a school in 45-55 active hours, the catalogue in 800 hours and more, RuneScape's band. The curve at **`t1 = 28 s`**, the default inside his band, in active seconds of the school's own verb; wall time is two to three times this, since a player also walks, trades and talks:

| Stand at level | Active time | What it is |
|---|---|---|
| 2 | 28 s | the first point, inside the first minute (G11) |
| 4 | 2.2 min | three points: a small node and the first major node of the school |
| 6 | 6.2 min | band 2 opens |
| 11 | 53 min | band 3 opens; the second corner node of the race |
| 16 | 6.8 h | band 4 opens |
| 20 | 34.5 h | the last step begins |
| 21 (mastery) | 51.7 h | the crown; the last step alone is 17.2 h |

**Why 28 and not another number in 25-30.** Mastery is `t1 * 6648.5` active seconds, so 25 s gives 46.2 h, 27 s 49.9 h, 28 s 51.7 h and 30 s 55.4 h. The first full catalogue's sixteen schools at 27 s come to 798 h, short of the owner's 800; 28 is the smallest whole second at which the catalogue at one value passes it (827 h), and it sits near the middle of his 45-55 h. It keeps the first point inside the first minute (G11), and it leaves room on both sides for the per-school spread: cooking and handcraft (short actions, many of them) may sit at 25 s (46 h), felling and mining at 30 s (55 h), so that one evening of each feels the same. The spread is held by a check row: the catalogue's mastery hours summed over its schools stay at or above `catalogue_hours_min` (800), so a spread that leans low goes red. The cost the owner accepted with C: the last step is a 15-18 h series of sessions, a third of the school; RuneScape's 92 to 99 is half of 99, so the band is the one he named.

### 3.3 Bands

A school's twenty steps fall into four **bands** of five levels and the crown: band 1 levels 1-5, band 2 levels 6-10, band 3 levels 11-15, band 4 levels 16-20, the crown at 21. A node carries the band it sits in (proposed field `band`, 1..4 or `crown`), and `learn_node` refuses a node whose band the school's level has not reached ("Your hands are not there yet." in the kernel's own words, never a number). This is the one place skill level gates the tree, and it is Skyrim's rule (a perk needs its skill at 20, 40, 60, 80). A band is never a wall on the verb: a level-1 forager may try a tier-3 recipe (no level wall holds), may walk into the south (no door holds); the band only says which nodes are for sale yet.

### 3.4 Points and the character level

- One point per character level, as built. With the first full catalogue's sixteen schools (section 4) the character level tops at 1 + 16 * 20 = 321 and so does the lifetime count of points; all twenty-two raise it to 441.
- The tree's price (section 4.6) is about 820 points at the first full catalogue, so a finished character holds under forty percent of the tree. Skyrim's figure is about thirty. The check enforces it: `tree_buyable_max_permille` (proposed 450) of the tree's total point cost is at most what a character of the maximum level could have; above it the catalogue is too small and the row goes red.
- A specialist is served by construction: a school's **main line** (its twelve trunk nodes, 4.3) and the race's corner cost 19 of the twenty points its own twenty levels pay, so a player who only ever cooks fills cooking's main line and corner from cooking alone; a school's branches and crown are paid by levels in other schools. That is the breadth pull, in points, with no wall.
- Unspent points keep (as built; Skyrim banks them too).

### 3.5 What reads the character level

Exactly three things, by rule (G89 of GROWTH, extended):
1. **The power cap.** The table is extended by a formula past its last entry: `cap(level) = table[min(level, 14)] + power_cap_step_permille * max(0, level - 14)`, clamped to `power_cap_max_permille` (proposed step 20, max 4000, range 2000..8000); 4000 is reached at character level 64, three mastered schools (about 155 active hours at `t1` 28 s). Everything a player wears, has learned and holds in slots still sums under this one number (R9).
2. **The slots.** `growth.slot_levels` re-spaced to the long scale: proposed [1, 1, 10, 30, 60] for five slots (today [1, 1, 5, 10, 15]); the fifth slot is a three-school character. Values only; the format of 23.10 stands.
3. **Travel.** Every faster form of travel names the character level it is earned at (DECISIONS 2026-10-23, item 7); on this scale the first (a trail step) sits around 10, a mount or a boat line around 40, the far forms past 100. Numbers for the world pages to set; this page only fixes the scale they are set on. A Travel crossing (4.8) is not a faster form: it is a way over (G68), opened by the Travel level as G61 allows, and the long way round always stays; a boat of one's own, a boat line, a mount and a teleport stay on the character level.

Quests, dialogue, prices, foes and recipes read the character level never. A quest that wants a capable player asks for a school's band or an attribute key (CR-10 closes that way: "a quest may name a school and a band", never a character level).

### 3.6 What pays experience (Q6, Q7, the owner)

- **Only the player's own actions.** The verb's own active time, as built (active ms are already kept per player), including the combat verbs when they come (a fight's active ms pay the weapon's school; COMBAT 4.3 reads the hand). Nothing another player does creates experience for this player: the group rule below moves a bounded share of what the others already earned and adds the mentor's +20%, the one bonus.
- **A quest pays a school** (Q6 = A). A quest reward may carry `xp: { school, seconds }`, paid to that school at completion, bounded by the quest's own active time with the effort weight (R6: a reward is an activity record; nothing pays more than the time it took), and for each player by that player's own active time on the quest: a quest done beside a veteran pays the newcomer for what the newcomer did. It never pays the character directly. This is how a quest line of the city teaches smithing to one who has never swung a hammer (Skyrim's quest skill rewards), with one spine.
- **A teacher is a place to train, not a shop** (Q7 = A). A character marked as a teacher of a school offers a lesson: an activity with active time, a minigame of the school's own kind, paying experience at the school's ordinary rate (nothing more, so it is never a shortcut) and asking nothing but standing with the character (the reputation standings) and, for the upper bands, a thing brought. Never gold for a level. Decision 39's "books and teachers" lands here; G39 forbids Skyrim's trainers (gold for levels), and this is the form that keeps both.
- Nothing shortens a wait: a respawn, a growth, a night are capacity, and no node, lesson or point touches them (R6, DECISIONS 2026-10-10 "The world and its clocks").

### 3.7 Help, never a carry: the group rule (Q7, the owner)

The owner, 25.10: help is welcome, a full carry is not, above all in multiplayer. In a group, each player earns from their own work, and a newcomer with a stronger player gets two bounded terms on top: a share, which is a split of experience the group already earned and creates none (balance finding 2, accepted 26.10), and the mentor's +20%, the only bonus; the veteran's reward is standing, not experience. Per school `k`, over a span of play in one group (the terms are the owner's; the neighbourhood, the "stronger" test, the pair schedule and the numbers in brackets are proposed):

```
own[k]       = the newcomer's own active ms in k in the span                      as built; the base of everything
share[k]     = min( group[k] / (members - 1),  own[k] * group_share_max_permille / 1000 )
               group[k] = what the other members earned in k in the span          at most a quarter of own (250)
bonus[k]     = own[k] * mentor_bonus_pct / 100   while a stronger player is near    +20% (FFXIV's mentor, rested XP)
paid[k]      = own[k] + pair_factor * (share[k] + bonus[k])
given_e[k]   = what each other member e gives to share[k], in proportion to what e earned in k;
               paid_e[k] = own_e[k] - pair_factor * given_e[k]                    moved, never made
pair_factor  = 1 for the first pair_full_min (60) active minutes of the same pair in a real day,
               1/2 for the next 60, 0 after; the day resets at 00:00 UTC (the daily caps' clock, 10.10)
```

- **The share is moved, never made** (balance finding 2, accepted 26.10): `share[k]` comes out of the other members' own earnings in `k` over the span, in proportion to what each earned, and goes to the newcomer. The sum of a group's experience equals the sum of its members' own work plus the mentor's bonus, and nothing else, so red line B (4.7) holds for groups and a carry stays bounded as Q7 meant.
- **Bounded by the newcomer's own active time.** Both terms are multiples of `own[k]`: a newcomer who stands idle while a veteran works earns nothing, and a newcomer who gathers while the veteran fights gets no share of the fight's school, because a quarter of nothing is nothing.
- **Stronger** (proposed): the other member's level in school `k` is at least `mentor_band_gap` (1) band above the newcomer's; **near**: in the same group, within `mentor_reach_tiles` (12) tiles. The bonus is one, however many veterans stand near.
- **The veteran earns standing and a line on the giving board** (the boards of 9.10 rank giving), never experience, for the time spent beside a newcomer: the giving board counts the newcomer's `share + bonus` paid while the veteran was the stronger one near.
- **Diminishing returns for the same pair** are the `pair_factor` above, so two accounts that always play together get the help for an hour a day, not for a lifetime.
- **Selling carries** (gold for a run beside a veteran) falls under "An exploit loop costs its accounts and the gold it made" (9.10): the server's books see the pair, the pattern and the gold.
- The +20% is the one multiplier on experience the game has, and it is declared as such in the conflict table (R6 reads a reward as an activity record; this is a bonus on one). No body state, node or item adds another: a garment's trait answers a place, and a dish's effects (Q8b, [BODY_CLOCKS.md](BODY_CLOCKS.md)) move work, health and sight, never experience; sleep carries no bonus.

## 4. The schools: the catalogue to aim for, and how a tree grows to a thousand nodes

### 4.1 The tree's shape, kept

Decision 38 as written: the race is the vertical axis (three wings), the schools the horizontal, a shared centre of attributes and small nodes, corner nodes where a race meets a school, books from a foreign wing. This page adds the band ring (3.3) and the branch (4.3) inside each school, and the cross-link (6.5) between schools, so that the picture of S1 (the tree of wings, DECISIONS 2026-10-23) stays the picture at a thousand nodes: the centre, three race wings, sixteen school spokes, each spoke four bands deep and forking past its second band.

### 4.2 The catalogue (proposed names; the five built schools keep theirs)

Twenty-two schools in five families: **sixteen in the first full catalogue** (now, in flight, foundation, and Trade with the market) and six that wait for combat or the city's machines (Hunting, Leatherwork, Strike, Aim, Guard, Tinkering). "Now" is built or in flight; "foundation" waits for the first hand-made map and the server; "with combat" waits for G35 to lift. What a school's nodes may change is its **effect list**, a closed list the kernel applies (GROWTH 3.5); the lists below are the target, each name core-only and added with its first node, never before.

**Gathering** (verbs that take from the world; their nodes move speed, yield, sight and reach)

| School | State | What its nodes may change (effect list) |
|---|---|---|
| Foraging | now | `gather_speed_pct`, `see_ripe` (ripe plants glow after dark), `rare_find_pct`, `second_hint`, `night_pick` (pick by dark), `root_read` (what lies under a plant) |
| Woodcutting | now | `gather_speed_pct` (felling), `fell_facing` (a tree falls the way you face; across a stream it is a bridge), `log_split` (one more log per tree), `timing_window_pct`, `bark_find` (bark and resin as a second yield) |
| Digging | now | `dig_speed_pct`, `dig_depth` (the dig game shows how deep the find lies), `timing_window_pct`, `rare_find_pct`, `clay_eye` (clay and sand read from the surface) |
| Mining | foundation (river stones are mined like felling and train Digging today, #339; its own school waits for the pick and ore) | `dig_speed_pct` (the pick), `vein_sense` (ore shows through the face), `ore_grade` (a second roll on the vein's grade), `rock_fall_window` (the warning before a fall is longer), `rare_find_pct` |
| Fishing | now (#340: the rod, spots on the water, the cast; placeholder nodes of 23.10's size) | `timing_window_pct` (the bite), `fish_depth` (what swims where), `line_hold` (a big fish does not break the line), `bait_keep`, `rare_find_pct` |
| Hunting | with combat | `track_read` (a trail shows for a beat), `quiet_step` (noise radius smaller; round 4; the radius is now the gait's noise table, `gait.noise_*`, #424 and HUNTING.md section 4, so the node lowers the gait's row, proposed by one, never below `noise_still`), `harvest_yield` (hide, meat, bone per kill), `clean_kill` (a kill that spoils nothing), `cone_beat` (a predator's cone shows when it turns) |

**Crafting** (the one craft verb; their nodes move the chance, the speed, the quality roll and the chain)

| School | State | What its nodes may change |
|---|---|---|
| Cooking | now | `craft_speed_pct`, `meal_fill_pct`, `meal_keeps` (a camp meal keeps through a night), `long_simmer` (a dish's effects last longer), `taste_read` (an ingredient's effect tags shown before it is eaten or cooked: the finding is shorter, never skipped), `portion` (one more portion per cook). No node adds a third dish slot or a third effect to a dish (BODY_CLOCKS.md section 7) |
| Handcraft | now | `craft_speed_pct`, `craft_chance_pct`, `quality_pct` (the quality roll, 5.3), `cord_twice` (a second cord from one reed), `mend` (a worn tool mended at the bench) |
| Woodcraft | foundation | `craft_chance_pct`, `quality_pct`, `shaft_true` (a staff, bow or handle of one tier higher from the same wood), `joinery` (camp parts and furniture take less wood), `bow_draw` (the bow's draw reads from agility less) |
| Tailoring | foundation | `craft_chance_pct`, `quality_pct` (a master piece's trait counts a step stronger, 4.5), `trait_sew` (a garment with no trait takes one at the bench: a recipe whose output is the same piece with the trait), `light_cut` (a garment weighs less), `dye_fast` (a dye that keeps) |
| Leatherwork | with combat (needs hunting) | `craft_chance_pct`, `quality_pct`, `tan_yield` (more leather per hide), `guard_pct` (leather that turns a blow a little), `quiet_wear` (leather that makes no noise) |
| Smithing | foundation, city only (decision 51; metal content waits, 9.10) | `craft_chance_pct`, `quality_pct`, `temper` (the upgrade recipe's miss keeps more), `edge_hold` (a blade loses uses slower), `alloy_read` (an ore's alloy shown before the melt) |
| Remedies | foundation (alchemy without magic; magic is ⏸ 9.10) | `craft_chance_pct`, `brew_strong` (a remedy's effect longer), `second_dose` (two from one brew), `taste_read` (an unknown herb's use shown), `poison_safe` |
| Tinkering | with the city's machines (decision 20: human technology is made things) | `craft_chance_pct`, `quality_pct`, `clockwork` (a made thing with a timer: a trap, a lamp that lights itself), `salvage` (parts back from a broken made thing), `fit` (a tool fits a second verb) |

**Combat** (planned layer; Q2 = B, the owner: names, shapes, effect lists and slots reserved now, and the tree screen draws the three spokes closed; the nodes are written in the same pull request as the first foe: G35, COMBAT section 6). The effect list is COMBAT 4.3's reserved list and nothing more until then: `strike`, `sweep`, `break_guard`, `step_through`, `mark`, `brace`, `second_wind`, `bleed`.

| School | What it reads |
|---|---|
| Strike (blades, blunt, spear: the thing in hand) | might for harm, agility for the wind-up, the weapon's reach |
| Aim (bow, thrown; the quiver on the back) | senses for the lead, agility for the draw, the quiver's count |
| Guard (shield, brace, the breath) | stamina for breath, might for the hold, armour's `guard_pct` |

Hunting is the bridge: its gathering half (tracks, harvest) is written with the animals (DECISIONS 2026-10-25), its kills are Strike's or Aim's.

**Movement and survival** (the long way's schools; the 25.10 answer "readiness is made" is their brief)

| School | State | What its nodes may change |
|---|---|---|
| Travel | foundation; a full school (4.8, the owner 25.10) | carrying: `load_pct` (the weight limit higher), `load_step_pct` (the heavy pace less slow), `edge_pct` (more picked up past the limit), `belt_tools`; ways over by its level: `ford`, `scramble`, `ledge`, `leap`, `cross_speed_pct`; water: `row_step_pct`; the step: `walk_step_pct` (the W9 form, past the first third of the school); the sense of a route: `path_read` (a way over marked as it comes into view), `map_wide`, `way_home`; the `sled`. Nodes, hours, crossings and sources in 4.8 |
| Survival | foundation | `weather_read` (a sight: a place's conditions for the next game hours shown on its card), `tent_quick` (a tent pitched faster), `camp_quick` (a fire laid faster), `dark_sight` (a longer sight in the dark; the torch's light is still the item's), `fall_soft` (a drop costs less). No node answers a place's condition: that is the garment's (4.5) |
| Climbing | foundation (the drops of the south need gear and a hand) | `climb_reach` (a drop of two or three levels crossed with rope; a one-level step by hand is Travel's `scramble`, 4.8), `rope_uses`, `grip` (a fall from a climb is not a fall), `hold_read` (the hand-holds of a face shown) |

**Social and trade** (nodes change capacity and reading, never a price: R8, GROWTH 5.4)

| School | State | What its nodes may change |
|---|---|---|
| Trade | with the market (CR-19) | `stall_slots` (more listings at once), `price_memory` (yesterday's price shown), `haul` (a trade cart's places), `read_stock` (a shop's stock seen before entering); never the band of R8 |
| Lore | foundation; the ancient language of 9.10 ⏸ lives here if magic comes | `read_old` (an inscription read without firelight), `book_fast` (a book read in one sitting), `map_mark`, `riddle_hint` (a `riddle` step's second clue) |
| Company | later (pets with a skill each, companions: GAP section 9) | `pet_slot`, `pet_carry`, `ally_hold` (a companion stands longer); the format leaves the place, the content waits |

Sixteen schools in the first full catalogue, twenty-two with combat and the machines (Company is outside the count until its format exists). Every school is core-only content (`CORE_ONLY_TYPES`, GROWTH 3.1); a creator proposes a book, later a node, never a school.

### 4.3 How a school grows: the main line, branches, the crown

A school at the first full catalogue (proposed sizes, all params with ranges):

- **Main line:** twelve nodes over the four bands (three a band): per band two small and one major, the second band's major being the school's signature verb change; costs 4 * (1 + 1 + 2) = 16 points.
- **Corner nodes:** three, one per race, each needing the first major (as the placeholders of 23.10 have it), 3 points each; a player takes only their race's, 3 points.
- **Branches:** past band 2 the school forks into two (later three) named **branches** of eight nodes each (bands 3-4, four a band: three small, one major; the branch's first node is its major), 2 * (3 * 1 + 2) = 10 points a branch. Handcraft forks into Reedwork and Stonework; Smithing into Blades, Armour and Tools; Cooking into the Hearth and the Road (meals that keep); Travel into the Trail and the Pack.
- **The crown:** one node at mastery (level 21), 3 points, a technique that is the school's name made flesh (the forager who hears a plant; the smith whose blade does not dull), and the race's third corner answer if its wing names one.

Count: 12 + 3 + 2 * 8 + 1 = 32 nodes, 16 + 3 * 3 + 2 * 10 + 3 = 48 points a school; a player's reachable share (own race only) 16 + 3 + 20 + 3 = 42 (corrected 25.10 with Travel's worked example, 4.8: the first count doubled the branches). Sixteen schools: 512 nodes. The race wings: three wings of eight nodes each (two small and two major a band for bands 1-2, the wing's verb changes), 24 nodes. The shared centre: six attributes as pips (not nodes; `spend`) and twelve small nodes any race may take (a wider bag pocket, a steadier hand). **First full catalogue: about 550 nodes, about 820 points of cost (sixteen schools 768, the race wings 36, the centre 12); a character's lifetime is 320.** With a third branch in every school (+128) and the combat schools' technique rows (+~60) the map holds about 750; a thousand and more comes only the way Skyrim's and Path of Exile's did, by more branches as data, never by longer main lines. The skill screen (#334, landed 27.10: a camera over a graph of any size) is tested on a fixture of about three hundred nodes (`tools/test/helpers/bigtree.ts`); the target here stays 1,000, not yet tested.

### 4.4 What a node may be (the closed effect grammar)

Every node's effect is one name from one closed list the kernel applies; a creator's content never reads a node (GROWTH 5.4). The lists of 4.2 grow by one rule: **a new effect name arrives with its first node, its kernel line, its property test and its check row, in one pull request**, the way a new verb arrives (kernel review 8.4). Four kinds of effect, by what the kernel does with them:

| Kind | Examples | Where the kernel reads it | Capped by |
|---|---|---|---|
| A rate | `gather_speed_pct`, `craft_speed_pct`, `walk_step_pct` | the activity's active time (R9) | the power cap with everything else |
| A roll | `rare_find_pct`, `craft_chance_pct`, `quality_pct`, `ore_grade` | the draw (R4) | `craft_luck_max_permille` and its siblings; never above the recipe's own ceiling |
| A sight | `see_ripe`, `dig_depth`, `vein_sense`, `track_read`, `cone_beat` | the state the client is allowed to show | none; a sight is information, not power, and it is why major nodes feel like Skyrim's perks |
| A verb change | `fell_facing`, `meal_keeps`, `climb_reach`, `clockwork` | the verb's own step | the verb's own rules (a bridge is a crossing of G68) |

A node never changes a recipe's output or a price (R9, R8). A sight node is the cheapest way to make a major node felt in a minute (G11) and is preferred over a rate node for every band-1 major.

### 4.5 The long way's gates, for the schools above

The 25.10 answer makes the south a set of made readinesses, not a door: dark (a torch, an ember), cold and food (clothing, cooked food), drops (climbing gear), creatures (a weapon, later). This page gives each a condition of the place or a check it hangs on, so that Tailoring, Leatherwork, Woodcraft, Smithing and Climbing have a thing to move:

- **Harsh places** (Q8 and Q8a, the owner): the body has two bars only, health and experience; no cold, hunger, thirst or tiredness meter. A place is harsh by its **conditions**, a closed list (`frost`, `deep_snow`, `storm`, `ice`, `heat`), each at a **harsh grade** from a closed ladder (0 calm, 1 rough, 2 severe, 3 extreme, 4 deadly; the owner's danger grade) set by the region, its climate, the hour and the day's weather and never above the area's danger level `d`, so the one scale that rates areas stays one and ground at `d` 0 stays safe (G30); the valley stays calm. A grade slows walking and work and takes health while the player stands in it unanswered: points of the base health cap (100) each game hour, the same for every player, so a bigger health cap buys time in a place; a new player in calm snow (grade 1) loses about a point every five seconds and has a little over eight minutes. A safe place (G30) stops the drain, a countdown warns before zero (G31), and nothing runs while away (G28). The answer is what the player **wears**, and a dish adds a step: a garment may carry one **trait** from a closed list (`cold_proof`, `snow_shod`, `storm_proof`, `ice_grip`, `heat_ward`), its strength from the garment's tier (1 at tiers 1-2, 2 at tiers 3-4, 3 at tier 5), so higher tiers answer harsher places; the grade falls by the strength, fully when it meets the grade, one grade down when it is one short. Tailoring makes cloth and fur traits, Leatherwork leather ones, Woodcraft snowshoes, Handcraft's Stonework and the city's Smithing the grips. A trait never adds experience and a look never carries one; every garment still carries its attribute bonuses (5.6). The ladder, the times to zero and the slots: [BODY_CLOCKS.md](BODY_CLOCKS.md) sections 5 and 6.
- **Food** (Q8b, the owner): food gives health back, and a cooked dish adds up to two timed effects (the five place answers, quicker work in one school, more maximum health, health back over time, longer sight in the dark and the like). The effect list may grow as content needs, since the screen explains each one; every effect is a closed numeric definition (stat, kind, strength and duration by tier, category), so the whole space stays computable (4.7). The richness is in the catalogue: many ingredients a region, each with one or two effect tags, and dishes whose effects are the tags their ingredients share, found by cooking. At most two dishes count at once; a dish never adds experience and never answers a hunting hazard (G34). Sleep saves and passes the night, with no bonus. [BODY_CLOCKS.md](BODY_CLOCKS.md) section 7.
- **Dark**: the light rule in `params.light` as built; a torch is a hand-slot item with uses; `dark_sight` lengthens the player's own sight a little and never replaces the torch.
- **Drops**: the height layer (`levels`, DECISIONS 2026-10-25 "One height layer"), in the walk since #405 (kernel 0.21.0): one step rule (`makeStepRule`) for the BFS, the server and the client, a change of 1 to 3 levels open only through a crossing at either end, more than 3 (`MAX_LEVEL_STEP`) never walked; a crossing of the kind `rope` is walkable only with rope in the bag and `climb_reach` learned at the drop's depth.
- **Creatures**: combat, when it comes; until then they are hazards escaped (G34).

### 4.6 The check (added rows, proposed)

Every row of GROWTH 4.5, with these on top: every `xp_levels` table equals the formula within rounding; every node names a band its school has; a band's nodes are reachable (its `needs` sit in the same or a lower band); a school's main line costs at most `main_line_points_max` (20); a school's total nodes at most `nodes_max` (now 60, up from 12) and its branches at most `branches_max` (3); the whole tree's point cost is at least `tree_buyable_max_permille` over a maximum character's points; every rate effect is in the power cap's sum; every new effect name has a kernel reader (a static grep in the check: a name in content with no reader is red).

### 4.7 Balance: two red lines, rising ceilings, walls proven both ways (the owner, 25.10)

The owner's concern: hard fixed caps would kill the chase for better sets, and fully open stacking lets an unbeatable combination exist; and the end-game's places and quests should be so hard that only near-end players pass them, while to everyone else they feel like an impossible wall. So: two lines nothing crosses, ceilings that rise with the band instead of fixed caps, and every wall proven both ways. Everything is computable; the check enumerates it. **Spec only**: the check-row family below runs in `pnpm check` once the catalogue exists, and the script is a follow-up, not built with this page (section 12).

**1. Two red lines, absolute, no exception.**

- **(a) No loop.** No source may amplify another source that amplifies it back: the effect graph is acyclic, and an effect never raises the strength of the effect kinds that raised it. The case to avoid is Skyrim's: Fortify Restoration potions strengthened the enchanted gear that strengthened the next potions, and players reached damage in the millions. The structural rule that keeps the graph acyclic: **the strength, quality, tier and duration of a made thing read only its recipe, its inputs' tier, the maker's tree and the maker's base levels**, never worn gear or an active dish. Worn and eaten effects may change how fast and how surely a thing is made (`craft_speed_pct`, `craft_chance_pct` as built: success, not strength), never how strong it comes out. A ceiling raiser (2 below) raises a ceiling, never an effect's strength, and nothing raises a raiser. The economy line stays with it: craft, sell, buy and repeat nets at most 0 at a vendor (R8, read as CR-1 settles it).
- **(b) Nothing grants experience except the mentor's +20%** (3.7). No effect, node, trait, dish, raiser or item may name experience, and luck pays none: the grade-4 jackpot of gather and dig pays goods, a larger or rarer yield, and experience stays the active time (balance finding 3, accepted 26.10; the kernel's `JACKPOT_XP` multiplier of 3 came out at kernel 0.23.0, 01.11).

**2. Rising ceilings instead of fixed caps.** Each stat category has a ceiling that is a function of the wearer's band, as Diablo II and Path of Exile cap a resistance at 75% while rare late items raise the cap itself (Path of Exile's to 90%). Sets, dishes and traits combine freely, and are meant to: every source of a category adds (nodes, worn effects, traits, a master step, dishes), and the sum stops at the ceiling of the wearer's band, plus the raisers held. Categories then apply one after another to the final value; penalties (a place's slow, low health) apply last and a ceiling never clamps a penalty away. The wearer's band in a category comes from the category's owner (the owner, 25.10: DECISIONS "The progression map: who owns each ceiling"), read on base levels and base pips as Q5 reads them (5.6): `health` from the **stamina** attribute (the band is the base stamina, at least 1: stamina 0 or 1 is band 1, 5 is band 5; the cap itself stays 100 + 20 a stamina point, Fallout's split of hit points by Endurance and of healing by the Survival skill); `sustain`, `sense` and `place` from **Survival**; `move` and `carry` from **Travel** (4.8); `work` from the school at work; `find` from the gathering school in use; `strike`, `aim` and `guard` from their own schools when combat lands. An attribute's own bonuses stay outside the ceilings (Q5: gear bonuses with no fixed cap), and stamina only picks which band of the health ceiling applies; each item's `attr_bonus_max` and the slots bound them, and the top builds report watches them.

| Category | What it sums | Band 1 | 2 | 3 | 4 | 5 | Raisers (count x step) | Top, every raiser held |
|---|---|---|---|---|---|---|---|---|
| `work` | time off a school's work, all sources | 25% | 35% | 45% | 55% | 65% | 2 x 5 points | 75% (4x speed, `power_cap_max_permille` 4000) |
| `move` | time off a step, a crossing or an oar stroke (each action its own sum, 4.8) | 10% | 15% | 20% | 25% | 30% | 2 x 5 (one is Travel's crown) | 40% |
| `carry` | the weight limit above might's and the bag's (4.8) | +10% | +15% | +20% | +25% | +30% | none | +30% |
| `health` | health cap above the attributes' cap | +10% | +20% | +30% | +40% | +50% | 2 x 10 | +70% |
| `sustain` | health back a game hour while a place drains, regen and food together, in points of the base cap (the drain's unit) | 5% | 7% | 9% | 12% | 15% | 1 x 5 | 20% |
| `find` | `rare_find_pct` points | +3 | +5 | +8 | +11 | +15 | 2 x 3 | +21 |
| `sense` | sight in the dark, a trail, tiles | +1 | +2 | +2 | +3 | +4 | 1 x 1 | +5 |
| `place` | answer steps on one condition (garment, master step, dish) | 2 | 2 | 3 | 3 | 4 | none (the ladder tops at 4) | 4 |
| `strike`, `aim`, `guard` | reserved: rows with the combat layer | | | | | | 2 each, then | |

**The raisers**: ten today (`work` 2, `move` 2, `health` 2, `sustain` 1, `find` 2, `sense` 1), each raising one category's ceiling by one step: rare, late and few. The owner's pick (27.10): half are crown nodes of a school (4.3), half are unique pieces found in band-5 places or at the end of a band-5 wall; never made; one of each counts. A crown node stays with the one who learned it; a found raiser is not bound: it trades and sells for gold like any found item, and whoever holds it gets its benefit (the owner, 1.11, DECISIONS 2026-11-01, "A found power item is not bound"). The count of ten is `raisers_max` in `content/core/params.json` and stays tunable. They are the end-game chase: a band-5 player full of sets and dishes stands at the band's ceiling, and only raisers lift it.

`sustain` is the one ceiling the game itself enforces in a new place: while a place drains (BODY_CLOCKS 5), all health back, food eaten included, comes in at most at that rate; outside a draining place eating heals at once, as today. A regeneration or mend dish adds +2 on top of the ceiling while it lasts (balance finding 11, accepted 26.10), inside the room a `sustain` raiser gives, so those dishes still count in a wall after carried food has brought `sustain` to the ceiling; food alone never lifts it past. Without the clamp a wall could be eaten through and no proof would hold.

**3. Walls proven both ways.** A place or a quest step the content flags as a **wall** carries a band `b` and its numbers, and the check proves two things:

- **Solvable**: a **witness build** recorded with the content (pieces by id, dishes, traits, school levels and base attributes), using only what exists at band `b` (tiers up to `b`, levels up to band `b`'s top), passes the wall with a margin (`wall_margin_bp`).
- **Not cheesable**: no combination of everything available below band `b - 1` (tiers up to `b - 2`, pieces one tier ahead at Q5's reduced value, every dish pair, every trait, levels up to band `b - 2`'s top, the raisers of those bands) passes it, even with no margin. Band `b - 1` may pass with a strong build; that is the near-end player.

**A wall's grade** (balance finding 8, accepted 26.10): a wall at band 3 or more is grade 3 or 4. At grades 1 and 2 a player two bands below gets through at any length, so such a place is never a wall above band 2; the prover prints the length window of each band, and a designer reads it before setting a length.

**Pass**, by the wall's kind, is all three at once:

- **Health**: T = `length_gh` x the slow of the remaining grade x (1 - `work` or `move` off); health at the end = cap - T x (drain of the remaining grade - `sustain`) must stay above zero (the witness: above `wall_margin_bp` of the cap); the drain and `sustain` are both counted in points of the base cap (100) a game hour (balance finding 10, accepted 26.10), the cap is the player's own, so health gear and the health ceiling's raisers buy seconds in a wall. Starting at full.
- **Timer**: where the wall has one (a quest step's time, the night, a fire's logs), T is at most `timer_gh` (the witness: within the margin).
- **Requirement**: the school levels and base attributes the wall names, met on base levels (Q5). In play a requirement refuses nothing: below it the attempt's chance falls to nothing as a recipe above its level does (9.10, "no level wall"); the proof reads it as unmet.

An example (proposed): a band-5 pass, frost and storm at grade 4, `length_gh` 12 (ten real minutes). The witness, band 5: a tier-5 `cold_proof` coat (3) and a dish (+1) take frost to 0; a master tier-5 `storm_proof` cloak (3 + 1) takes storm to 0; no drain, passed. Band 4 (`place` 3, `sustain` 12, `move` 25%): grade 1 remains, T = 12 x 1.15 x (1 - 25%) = 10.4 game hours; the drain of grade 1 is 10 points a game hour and `sustain` 12 covers it, so nothing is lost: the near-end player, as the owner wants. Band 3, the best below `b - 1`: tier-4 pieces worn one ahead (2), a master step and a dish come to 4, clamped by the band-3 `place` ceiling to 3; grade 1 remains, T = 12 x 1.15 x (1 - 20% `move`) = 11.0 game hours, net drain 10 - 9 = 1 point a game hour, 11 points of 100 lost: it **passes**. With the grade-1 drain at 10 (balance finding 9, accepted 26.10) a remaining grade 1 cannot stop band 3 at any length that fits a game (it would take 100 game hours), so a wall made of drain alone is cheesable from band 3 and `wall_cheese_gap` 2 is not met; the example is kept to show that. The prover's stand-in walls carry a clock or a level requirement for this reason; how a wall holds in content is answered in section 9 (27.10): a clock or a level requirement.

Combat walls (foes' damage against guard and sustain) join with the combat layer, in the same form.

**4. What the check enumerates and reports.** Over gear sets by slot x active dishes (at most two) x garment traits x school levels x place grades x the wearer's band: the two red lines, the ceilings, both proofs of every wall (all fail red); and, as a **warning**, never a failure, the `top_builds_n` strongest builds per band by a build score (each category's value over its ceiling, summed), with a warning when the strongest stands more than `top_over_median_max_permille` above the band's median, so designers see a build running away. Enumeration is exact: walked in full under `proof_enum_max` combinations, by dominance above it (every source is monotonic, so each slot's Pareto front over the wall's categories reaches the maximum); the median above it from a fixed-seed sample. A red line names what broke it: the cycle, the loop's recipes and prices, the combination that cheesed a wall.

| Check row (proposed) | Threshold |
|---|---|
| `effect_graph_acyclic` | true: no cycle among effect kinds and made-thing strengths |
| `loop_profit_max` | 0 (milligold, any cycle of recipes and vendor prices) |
| `xp_sources` | `mentor` only, at `mentor_bonus_pct` 20 (3.7) |
| `ceiling_<category>` | the table above, one row of five a category |
| `ceiling_raise_step_<category>`, `ceiling_raisers_max_<category>` | the table above |
| `wall_witness_required` | true: a wall with no witness is red |
| `wall_margin_bp` | 1000 (the witness ends with a tenth of the cap and of the timer to spare) |
| `wall_cheese_gap` | 2 (nothing from band `b - 2` or below passes) |
| `top_builds_n` | 5 a band (warning) |
| `top_over_median_max_permille` | 2000 (warning; the strongest build ran 1.70-1.89x the median at every band, accepted 26.10) |
| `proof_enum_max` | 10,000,000 combinations, then dominance |
| `common_plain` | a common item or dish carries at most 1 effect, at most its stat's smallest step (5.7) |
| `rarity_effects_max`, `rarity_band_permille` | [1, 1, 2, 2] effects; common the step, uncommon 500-750, rare 750-900, legendary 1000 (5.7) |

### 4.8 Travel, a full school: carrying, ways over, water and the sense of a route (the owner, 25.10)

The owner: Travel was far too empty to be a skill. It is the school of how the body crosses the world: what it carries and how fast under it, the ways over that open by its level, the water, and the sense of a route. Every part is taken from what the repo has built or planned, and each says what it waits on; a node that waits on a system not built keeps its place in the tree until that system lands (4.9).

**The parts and their sources.**

- **Carrying** (#297, landed 25.10; DECISIONS 2026-10-23 "Weight and the three paces" and "Bags on the back"): every item weighs; the weight limit is 30 and 10 for each point of might, and a frame pack adds 10; three paces, light up to three fifths of the limit at 170 ms a tile, steady up to the limit at 190 ms, heavy above it at 230 ms; nothing more is picked up past one and a half times the limit; one tool hangs at the belt. Might keeps the base; Travel raises the limit (`load_pct`), shortens the heavy pace (`load_step_pct`), moves the hard edge (`edge_pct`) and hangs a second tool at the belt (`belt_tools`). Fallout sets carry weight by Strength and its Strong Back perk adds to it; Skyrim's Extra Pockets does the same; Old School RuneScape lets weight drain run energy.
- **Ways over, by Travel level** (OPEN_WORLD G61: "a shortcut is gated by a trait or skill and is measured in steps saved, like OSRS agility shortcuts"; NEXT 19 b lists "a shortcut" among what a place opens; G68's crossings and the height layer with rock faces of NEXT 19 a and 19 c): the kinds below. Below its level a crossing is not taken ("Not yet. You would fall." in the world's voice) and the long way round always stays: the checks of NEXT 19 g read reach with every Travel crossing closed, so a shortcut makes a place nearer, never reachable. Each crossing names the steps it saves, as the check measures them.
- **Fords** (OPEN_WORLD: every river border names a crossing, "a broken bridge, a ferry post, a ford"; REACTIONS `close`: "a ford under high water"; QUEST_PATTERNS' stepping stones at the ford): a wild ford is a Travel crossing; a ford restored in a community slot is open to everyone, as the slot is.
- **Boats** (NEXT 19 f, the boathouse on a lake with a keeper; the boat and the mooring post of the art ladder, frames 2026-10-20): the keeper lends a rowboat, and rowing is a verb with its own active time on water tiles (proposed `row_step_ms` 300). A boat of one's own and a boat line between places are faster forms of travel, earned by character level (3.5; "The world's structure", item 7), never nodes; Travel's nodes make the oars pull further. The keeper is the school's first teacher (3.6): a lesson is rowed on the lake.
- **The sense of a route** (the chart as built, "only the ground the player has walked", in 8 by 8 chunks: `game/src/ui/map.ts`): a way over in view is marked, open or not yet at the player's level (`path_read`); the chart holds a ring more around walked ground (`map_wide`); in an unanswered harsh place or after dark the way back to the nearest safe place shows on the chart (`way_home`).

**What pays Travel.** Its verb is the way over, not the walk (3.6: the verb's own active time):

- a crossing taken: its active time, in full (a few seconds on stones, longer along a ledge);
- a ford waded and a lake rowed: the time in the water;
- a heavy step pays Travel nothing (the owner's pick, 27.10): a load matters only through the carrying nodes of the school, which raise the load limit and the stamina of carrying; a step is a step;
- a trail course: a loop of crossings at a place, walked again and again, each lap paying its crossings' time (Old School RuneScape's Agility courses); one course a band, at places of rising danger, set against NEXT 19 b's table (the owner's pick, 27.10);
- a quest that pays Travel, and a lesson from its teacher (3.6).

A plain step pays nothing at any pace. Every player walks to every other school; if walking paid Travel, its fifty hours would come free inside the other fifteen schools' walking, every player would master it without choosing it, and the catalogue's 800 hours (3.2) would count those hours twice. A new check row holds it: `xp_one_school`, every active millisecond pays exactly one school (the mentor's +20% aside, 3.7).

**The hours** (`t1` 28 s, the one curve of 3.2; active Travel time only):

| Stand at Travel level | Active time | Opens | Where a player finds the time (proposed) |
|---|---|---|---|
| 2 | 28 s | the first point | the valley's stepping stones: about seven crossings of 4 s |
| 4 | 2.2 min | `way-eye`, the first major | the first map's open crossings |
| 6 | 6.2 min | band 2: `ford-wise`, the race's corner | the first map's level 1-5 crossings and the first quest steps |
| 11 | 53 min | band 3: `scramble`, the Trail and the Pack | the first map's fords and shortcuts; the boathouse lake rowed |
| 16 | 6.8 h | band 4: `way-home`, `leap`, `sled` | the first trail course (a lap about 60 s active, 90 s on the clock); the ring's ledges |
| 20 | 34.5 h | the last step begins | the courses of the far regions, long fords, rowing |
| 21 | 51.7 h | the crown, `wayfarer` | the last step alone is 17.2 h |

From band 4 to the crown is 44.9 active hours: about 2,700 laps of a 60 s course if nothing else paid. RuneScape's Agility is its grindiest skill for the same reason, and the mix above (fords, rowing, quests, lessons) is what keeps the road varied. A heavy haul pays Travel nothing (the owner's pick, 27.10); the load is answered by the carrying nodes alone.

**The catalogue still holds.** Travel at 28 s is 51.7 h. The first full catalogue's sixteen schools (Travel among them, 4.2) at 28 s are 827 h, past `catalogue_hours_min` (800); all twenty-two, with combat and the machines, are 1,138 h; and with `xp_one_school` none of Travel's hours hide inside another school's. The per-school spread keeps its margin: up to four schools at 25 s leave the catalogue at 805 h; a fifth goes red at 799.7 h.

**The crossing kinds** (Travel's; G68's open steps and ramps stay open to everyone, and Climbing keeps the rope):

| Kind | What it is | Opens at Travel level | Node it needs | Active time (proposed) | Waits on |
|---|---|---|---|---|---|
| `stones` | stepping stones over a stream | 1-10 | none | 4 s | NEXT 19 a, 19 c |
| `log` | a fallen trunk over a stream or a gap (REACTIONS `open`; GROWTH 5.2's felled tree as a bridge) | 1-10 | none | 5 s | 19 a, 19 c |
| `squeeze` | a gap between rocks, a hole in a hedge | 1-15 | none | 6 s | 19 a, 19 c |
| `ford` | a shallow river, waded | 6-20 | `ford-wise` | 2 s a water tile | 19 a, 19 c; high water shuts it (REACTIONS `close`) |
| `scramble` | a rock step of one level, by hand | 11-20 | `scramble` | 8 s | 19 a's levels, 19 c |
| `ledge` | a narrow way along a rock face | 11-21 | `ledge-walk` | 2 s a tile | 19 a's levels, 19 c |
| `leap` | a gap one tile wide | 16-21 | `leap` | 3 s | 19 c |
| `rope` | a drop of two or three levels | Climbing's | Climbing's `climb_reach` | Climbing's | Climbing (4.5) |

A crossing tile carries `crossing: { kind, travel, secs }` where today it carries `crossing: true` (true stays the open steps or ramp; a shared-file change, its own small pull request in 19 a). The step rule landed with #405 and reads only `crossing: true` today (any crossing at either end opens a step of 1 to 3 levels); the kinds below are still to come, and when they do, the step check reads the kind, the player's Travel level and the node, in the one function the BFS of G56 shares, so reach and walking cannot disagree. A place's crossings are set against NEXT 19 b's table: where the expected level puts a player in band b, its crossings sit at band b or one above, a reason to come back. A crossing is never in two schools, and its time pays its own school only.

**The nodes, in the school file's format (#302).** `id`, `name`, `text` (words, never a number), `size`, `needs`, `effect`, `value`, `slot`, `race`, plus this page's `band` (3.3). Thirty-two nodes as 4.3 shapes a school: the main line (twelve), three corners, two branches of eight (the Trail and the Pack) and the crown. "Waits on" names the system a node needs beyond its own kernel or client line; a node with a wait is **reserved** (4.9).

| Band | id | Name | Size | Needs | Effect | Value | Text | Waits on |
|---|---|---|---|---|---|---|---|---|
| 1 | `steady-load` | Steady under load | small | none | `load_pct` | 5 | You carry a little more before the load tells. | none |
| 1 | `way-eye` | Eye for a way | major | `steady-load` | `path_read` | 8 | A way over that you could take catches your eye as it comes into view. | 19 a |
| 1 | `sure-footing` | Sure footing | small | `way-eye` | `cross_speed_pct` | 5 | Stones and logs go by quicker underfoot. | 19 a, 19 c |
| 2 | `heavy-going` | Heavy going | small | `way-eye` | `load_step_pct` | 25 | A heavy load drags at you less. | none |
| 2 | `quick-crossing` | Quick crossing | small | `sure-footing` | `cross_speed_pct` | 5 | Ways over take you less time. | 19 a, 19 c |
| 2 | `ford-wise` | Ford-wise | major | `quick-crossing` | `ford` | 0 | You can wade a river where it runs shallow enough. | 19 a, 19 c |
| 3 | `long-stride` | Long stride | small | `ford-wise` | `walk_step_pct` | 5 | Your stride carries you further each step. | none |
| 3 | `strong-back` | Strong back | small | `heavy-going` | `load_pct` | 5 | Your back takes more before your pace gives. | none |
| 3 | `scramble` | Scramble | major | `long-stride` | `scramble` | 0 | You climb a single rock step by hand, without a rope. | 19 a's levels, 19 c |
| 4 | `ground-sense` | Ground sense | small | `scramble` | `walk_step_pct` | 5 | Rough or smooth, the ground slows you less. | none |
| 4 | `tireless-stride` | Tireless stride | small | `ground-sense` | `walk_step_pct` | 5 | You keep your pace on the longest day. | none |
| 4 | `way-home` | The way home | major | `scramble` | `way_home` | 0 | In a harsh place or after dark, the way back to safety shows on your chart. | none |
| 2 (human) | `road-packer` | Road packer | corner | `way-eye` | `load_pct` | 10, slot | On a long road you carry more than most. | none |
| 2 (elf) | `leaf-step` | Leaf step | corner | `way-eye` | `cross_speed_pct` | 10, slot | You cross stones and logs as lightly as a leaf. | 19 a, 19 c |
| 2 (skeleton) | `tireless-bones` | Tireless bones | corner | `way-eye` | `load_step_pct` | 50, slot | Bones that never tire carry a heavy load at an even pace. | none |
| 3, Trail | `ledge-walk` | Ledge walk | major | `ford-wise` | `ledge` | 0 | You walk a narrow ledge along a rock face. | 19 a's levels, 19 c |
| 3, Trail | `swift-crossing` | Swift crossing | small | `ledge-walk` | `cross_speed_pct` | 5 | Ways over go quicker still. | 19 a, 19 c |
| 3, Trail | `oar-hand` | Oar hand | small | `ledge-walk` | `row_step_pct` | 10 | The oars pull the boat further each stroke. | 19 f, the `row` verb |
| 3, Trail | `wide-chart` | Wide chart | small | `ledge-walk` | `map_wide` | 1 | Your chart holds a little more around the ground you have walked. | none |
| 4, Trail | `leap` | Leap | major | `ledge-walk` | `leap` | 0 | You jump a gap a step wide. | 19 c |
| 4, Trail | `trail-stride` | Trail stride | small | `leap` | `walk_step_pct` | 5 | On a trail your feet find their rhythm. | none |
| 4, Trail | `long-oar` | Long oar | small | `leap` | `row_step_pct` | 10 | A long pull carries the boat further. | 19 f, the `row` verb |
| 4, Trail | `far-chart` | Far chart | small | `leap` | `map_wide` | 1 | Your chart holds more of the land around your ways. | none |
| 3, Pack | `shoulder` | Shoulder the load | major | `heavy-going` | `edge_pct` | 25 | You can still pick things up past where others must stop. | none |
| 3, Pack | `broad-back` | Broad back | small | `shoulder` | `load_pct` | 5 | You carry more before the load tells. | none |
| 3, Pack | `slow-burden` | Slow burden | small | `shoulder` | `load_step_pct` | 25 | A heavy load drags at you less again. | none |
| 3, Pack | `belt-loop` | Belt loop | small | `shoulder` | `belt_tools` | 1 | A second tool hangs at your belt and takes no place. | none |
| 4, Pack | `sled` | Sled hauler | major | `shoulder`, Woodcraft's `joinery` (a bridge, 6.5) | `sled` | 0 | You drag a sled behind you, and it carries a load. | a sled item (Woodcraft) |
| 4, Pack | `bearer` | Bearer | small | `sled` | `load_pct` | 5 | You carry more again before the load tells. | none |
| 4, Pack | `even-burden` | Even burden | small | `sled` | `load_step_pct` | 25 | Even a heavy load barely slows you. | none |
| 4, Pack | `last-stone` | One more stone | small | `sled` | `edge_pct` | 25 | You can pick up even more before the load stops you. | none |
| crown | `wayfarer` | Wayfarer | major | `way-home` | `raise_move` | 5 | The road knows you: your pace can rise past any other walker's. | the crown's format (4.3) |

Cost: the main line 16 points, a corner 3, a branch 10, the crown 3: 42 for a player of one race, inside the 20 its own levels pay for the main line and the corner (19). Sums by effect, against the ceilings of 4.7 read on the Travel band: `walk_step_pct` 20 from nodes (the first in band 3, past the first third of the school as GROWTH 5.2 asks), under `move`'s 20-30% from band 3 up, leaving room for boots and dishes; `load_pct` 20 (the human 30), under `carry`'s 10-30%; `cross_speed_pct` 15 (the elf 25); `row_step_pct` 20; `load_step_pct` 75 (the skeleton 100, the bound); `edge_pct` 50 (the limit's hard edge from one and a half times to twice); `map_wide` 2 chunks.

**Travel's effects** (each a closed definition; a name arrives with its first node, its kernel line, its property test and its check row, 4.4):

| Effect | Kind | Category (4.7) | Exactly | Waits on |
|---|---|---|---|---|
| `walk_step_pct` | rate | `move` | a step's time is cut by the value in percent | its kernel line only |
| `cross_speed_pct` | rate | `move` | a Travel crossing's active time is cut by the value in percent | 19 a, 19 c |
| `row_step_pct` | rate | `move` | a stroke's time on water is cut by the value in percent | 19 f, the `row` verb |
| `load_pct` | rate | `carry` (new) | the weight limit (30 + 10 a might point + the bag's `load_bonus`) rises by the value in percent, rounded down | its kernel line only (#297 landed) |
| `load_step_pct` | rate | none, bounded | the heavy pace's extra over the steady pace (40 ms) is cut by the value in percent; at 100 a heavy step is a steady one, never quicker | its kernel line only (#297 landed) |
| `edge_pct` | rate | none, bounded | the hard edge (one and a half times the limit) rises by the value in points of the limit, at most to twice the limit (`edge_max_pct` 200) | its kernel line only (#297 landed) |
| `belt_tools` | count | none, bounded | one more tool hangs at the belt with no place; two in all at most (`belt_tools_max` 2) | its kernel line only (#297 landed) |
| `path_read` | sight | none (4.4) | a Travel crossing within the value in tiles is marked as it comes into view, open or not yet at the player's level | 19 a |
| `map_wide` | sight | none (4.4) | the chart shows the value in more 8 by 8 chunks around walked ground | its client line only |
| `way_home` | sight | none (4.4) | in an unanswered harsh grade (BODY_CLOCKS 5) or after dark, the chart shows the walk to the nearest safe place (G30) by the BFS of G56 | its client line only |
| `ford`, `scramble`, `ledge`, `leap` | verb change | none | the crossing kind of the same name may be taken, at its level | as the kind |
| `sled` | verb change | none | a sled (a Woodcraft item on the back) carries a load behind: its places and weight ride on it, at the steady pace on snow and grass and the heavy pace elsewhere | a sled item, #297's back slot |
| `raise_move` | raiser | `move` | the `move` ceiling rises one step (one of 4.7's two `move` raisers) | the crown's format |

**The stacking rule with harsh places (Q8a).** A step's time is three factors, each with one owner, and each is cancelled only by its own owner:

```
step_ms    = pace * slow * (100 - move) / 100
pace       = 170 light, 190 steady, 190 + 40 * (100 - load_step) / 100 heavy      the load against the limit (#297); the Pack
grade_left = max(0, grade - answer)                                                answer: trait strength + a master step + a dish step,
                                                                                   under the `place` ceiling (Q8a, 4.7): what is worn and eaten
slow       = 1.0, 1.15, 1.3, 1.5, 2.0 by grade_left                                BODY_CLOCKS 5.2
move       = walk_step_pct of nodes, worn pieces and dishes, under the `move`     Travel's band
             ceiling of the walker's Travel band
```

- **Travel never lowers a grade, and a place answer never touches the pace or `move`.** `snow_shod` takes `deep_snow` down a grade; a `walk_step_pct` node shortens every step; neither does the other's work, so the same slow is never cancelled twice.
- **One dish effect is either a place step or a move bonus, never both**, and each counts under its own ceiling (`place`, `move`).
- **A slow is a penalty and applies after the clamp** (4.7): the ceiling clamps `move`, never the slow, so in an unanswered grade a walker is always slower than the same walker on calm ground. The drain is the place's (BODY_CLOCKS 5), and Travel never touches it; a quicker walker only spends less time in the place, which a wall's pass already counts (T, 4.7).
- A crossing reads `cross_speed_pct` the same way, and rowing `row_step_pct`; each action's own sum is clamped by the one `move` ceiling.
- **The gait comes last** (#424, DECISIONS 2026-10-29 "The gaits"): a run divides `step_ms` by `gait.run_div` (2) and a sneak multiplies it by `gait.sneak_mul` (2), after the pace, the slow and `move`. A gait is a way of walking every player has, not a node: it pays no school, and `move`'s ceiling counts nodes, worn pieces and dishes only, so a run never eats into it. Built today: `walk_step_ms` and the gait; the load's pace of #297; the rest of the formula is proposed.

Worked: a band-3 traveller (`move` ceiling 20%; `long-stride` 5 and boots of 10 make 15), lightly loaded, in deep snow at grade 2 with nothing worn for snow: 170 x 1.3 x 0.85 = 188 ms a tile, against 145 ms on calm ground. With `snow_shod` of strength 1 (grade 1 left): 170 x 1.15 x 0.85 = 166 ms. Loaded heavy, with `heavy-going` (25): (190 + 30) x 1.15 x 0.85 = 215 ms.

**Who owns its ceilings.** `move` and `carry` read the walker's Travel band (the owner's answer, DECISIONS "The progression map: who owns each ceiling"); `carry` is a new row of 4.7.

### 4.9 Tree first, both ways (the owner, 25.10)

The owner's standing rule (DECISIONS 2026-10-25 "Tree first, both ways", made enforceable in #341):

- **The tree from the work.** Every new mechanic, stat, effect, item property or system that a player can grow in is placed in the tree when it is designed: on an existing school's nodes, or in a proposal that extends the tree (a new branch or node group, in the school file's node format). The builder makes the call, and review sees it. Travel above is the first worked case: carrying (#297), the crossings of NEXT 19 a and 19 c and the boathouse of 19 f had no node; now each has a place, reserved until it lands.
- **The work from the tree.** An agent starting any task reads the tree first and says where the work sits, or which nodes it serves, before it builds. The quest designer reads the tree first and starts from its thin spots; every pitch names the schools it trains and the nodes it needs or opens (the skill's seventh pitch line), and the pull request's `Tree:` line carries them beside `Quest review:`.
- **The line.** Every pull request's body: `Tree: <school>/<node ids>`, `Tree: extends the tree: <path of the proposal>`, or `Tree: none: <why nothing a player can grow in changes>`; an extension owes it too (the owner's pick, 27.10; most write `none: <why>`). CI refuses a body without one (`tools/src/pr-rules.ts`, #341). This pull request's own: `Tree: extends the tree: docs/design/PROGRESSION.md`.

**The coverage report (built in #345, 26.10).** A read-only script, `pnpm tree:coverage` (the owner's pick, 27.10), that prints the tree's thin spots; it informs and never fails, and the quest designer reads it first.

- A node is **touched** when content names it, or its school at its band: a quest that pays the school (`xp: {school, seconds}`, 3.6) or asks for the node's band; a recipe of the school's profession whose level sits in the node's band; a place, a crossing or a course that opens or trains it (for Travel, a crossing's `kind` and `travel` level); a teacher whose `teaches.band_max` reaches it (3.6); a book that teaches it (6.5).
- A node is **reserved** when its effect has no kernel reader yet (the static grep of 4.6) or the proposal names a system it waits on (the "Waits on" column above); reserved nodes are listed first, each with what it waits on.
- Per school: the nodes touched, untouched and reserved, and the thinnest band (the fewest touches); then one line for the whole tree, the schools ordered by their untouched share. It reads `content/` and the proposals' tables; pure and integer, the same output on two machines.
- What it printed on 30.10, before this re-read: six schools built (#302, fishing #340) and sixteen proposed on this page (ten of them in the first full catalogue); Travel 25 of its 32 nodes reserved. After it, with #297 landed, Travel's carrying nodes wait only on their own line, and 13 of its 32 stay reserved, on NEXT 19 a, c and f, the sled and the crown's format.

## 5. Gear: crafted weapons, armour and clothing on the map

### 5.1 The slots and the classes

Slots as built plus the back: `head, top, legs, outfit, feet, jewelry1, jewelry2, hand, back`. The hand holds a tool or, with combat, a weapon (G44; COMBAT 4.3); the back holds a bag or a quiver (the 23.10 bag answers); one base tool at the belt is free. Classes (the material grammar, extended as content): weapons `blade, blunt, spear, staff, bow, thrown`; armour `cloth, leather, mail, plate` on head/top/legs/feet; `outfit` the look layer over them; jewelry as built. Every class names the school that makes it: cloth from Tailoring, leather from Leatherwork, mail and plate from Smithing at the city's forge, bows and staves from Woodcraft, blades and blunt from Smithing (and the stone blade from Handcraft's Stonework, tier 1-2, as today).

### 5.2 Two axes of a made thing, kept, and a third

- **Tier** (how advanced; open-ended; `tier_min_level` and `craft_chance_bp` by tier as built): decides the cap of its worn effects (`wear_effect_max_pct` [5, 8, 12] and onward), its weight class, and, for a weapon, its reach and harm band (COMBAT fixes the numbers).
- **Rarity** (how often; the four of 9.10: `common`, `uncommon`, `rare`, `legendary`): the source's capacity. A rare material makes a rare thing; the rarity budget prices it (kernel review 8.2). Since 25.10 it also sets how many effects a thing may carry and where in its tier's row they sit: common things are plain (5.7).
- **Quality** (proposed; the third axis, Skyrim's fine/superior/exquisite and Dimraeth's six): rolled at the craft, four steps, `plain, fine, true, master`. Quality moves the thing inside its tier's cap (a fine piece reaches more of `wear_effect_max_pct`; a master piece reaches all of it and may carry a second worn effect where its rarity allows two, rare or legendary, 5.7), never past it, so the power cap and the trader's day cap hold exactly as they do. Quality is the thing a school's node opens (5.3): without the family's `quality_pct` node every craft is plain.

### 5.3 The three gates of making, and the one that is not

A made thing needs **knowledge** (the recipe: tier 1 known, higher dug up, found in scraps, riddled or paid by a quest; DECISIONS 2026-10-10), a **place** (the station's tier; the forge is the city's, decision 51), and **materials** (the chain of short steps, G43). It never needs a node: no level wall and no node wall on the attempt (G40). What the school's node does: raise the chance floor by band (as the level does today, `craft_level_step_bp`), open the quality roll (5.2), and open the family's technique in the hand (a bow shoots for anyone; Aim's first node is what puts a technique on it). The quality roll (proposed):

```
chance   = as built (craft_chance_bp[tier] + level steps, luck tilt under craft_luck_max_permille)
quality  = plain                                   if the family's quality node is not learned
         = roll(quality_bp[band] + quality_pct)    otherwise: fine at q1, true at q2, master at q3 (params, bp)
a miss   = as built: inputs kept by craft_miss_keep_pct; the upgrade recipe's miss keeps the item (CR-20)
```

### 5.4 Wear, mending, upgrading

- Tools and weapons wear by uses (as tools do: basket 60, trowel 40, axe 50); armour and clothing never wear out (DECISIONS 2026-10-09; Fallout's condition bar is for the thing in the hand only).
- `mend` (Handcraft) and `edge_hold` (Smithing) move uses; a mend is a recipe whose input is the worn tool and whose output is the same tool with uses restored, under R9 (the output of an activity with inputs is never raised).
- The upgrade recipe (CR-20) lifts a thing one tier and keeps it on a miss; `temper` makes the miss keep more. A `master` piece upgraded keeps its quality.
- A worn effect may carry a minus inside its cap (decided 9.10, CR-21): plate's `quiet_wear` is negative and its `guard_pct` large; that is the race answer's "a weakness matched by an advantage" in a thing.

### 5.5 Power never sold, the free market, and the no-wall (see 5.6 for the soft wear requirement)

A made thing sells on the market inside R8's band like any item; the made share applies; a `master` piece sells for more because its priced value is higher, never because of a tag. No shop sells a node, a recipe above tier 1, a quality or a lesson; a shop sells tier-1 tools at the floor (the 30-gold tools stay). Gear is a soft gate everywhere (4.5): it makes the south crossable, it never opens a door that was shut, and a player without it may still go and come back poorer (a death leaves a pack, DECISIONS 2026-10-23).

### 5.6 Attribute bonuses on gear, and the soft wear requirement (Q5, the owner)

The owner, 25.10 (Q5 = B with gear): pips are bought with points up to `key_max` 5, as built, **and** worn gear adds attribute bonuses on top. The bonus scales with the item's tier and has **no fixed cap**: late gear must match late stages. Every item states a **wear requirement**; below it the item is still worn and still helps, gently. Premium looks never carry a bonus (the look layer counts for nothing, as built).

- **What an item carries.** `attrs: { might: 2, stamina: 1 }` beside its worn effects. The largest bonus one attribute may carry on one item grows with tier: `attr_bonus_max` (proposed [1, 2, 3, 4, 6] for tiers 1-5, then +2 a tier, a param with a range like the power cap's table and step). Quality (5.2) moves a piece inside its tier's number, as it does for worn effects. The bonuses of all worn pieces add; no fixed sum caps them; what an attribute then moves that is a rate still sums under the power cap (R9), and carry and the health cap, which are not rates, follow the attribute as built.
- **The wear requirement.** Each item names a school level and an attribute threshold: `req: { school, level, attr: { might: 4 } }`. The school is the one whose verb the item serves (a pick names Mining, a blade Strike, armour Guard, a warm coat Survival, work clothes their trade; proposed). Tier sets the level on the band ladder (proposed: tier 1 none, tier 2 level 6, tier 3 level 11, tier 4 level 16, tier 5 mastery, 21; past tier 5 the attribute threshold rises with the far content). A requirement reads the **base** attributes (race, grade, pips), never worn bonuses, so gear cannot lift a wearer into the gear above it.
- **Below the requirement** (the owner's softening): the wearer's own tier for that item is the highest tier whose requirement they meet in its school; the item's bonus counts up to what gear **one tier above** that gives, and the rest unlocks as the wearer meets the requirement:

```
own_tier = max t such that the wearer meets req(t) of the item's school   (0 if none)
active   = min(bonus, attr_bonus_max[own_tier + 1])     per attribute; worn effects the same way against wear_effect_max_pct
```

  A newcomer who saved and bought a strong piece from another player (the free market, 9.10) gets a real step ahead, not the late game. The same rule reads the item's worn effects (proposed: one rule for all of an item's power).
- **On screen.** The stats panel shows the total with the gear part in another colour and in words, so colour is never the only signal (G29): "Might 7 = 5 + 2 gear". An item's description lists its attribute bonuses under its name. When a requirement is unmet, the tooltip shows the full bonus, the active part and what unlocks the rest: "+6 might, 3 active, the rest at Guard 21". (The owner's example said Guard 30; school levels end at 21 on the twenty-step curve, so the tooltip names the level of the item's tier on that scale.) Counts of pips and points, never a percentage (decision 39).
- **Keys stay the base's.** A node's key reads race, grade and pips only (6.4 rule 4): gear lends power to the verbs, never a door in the tree, which is what kept option C of Q5 ("pips from gear only") out.

### 5.7 Common things are plain: rarity and what a thing may carry (the owner, 25.10)

The owner: the base rarity, **common**, for food and for accessories and gear, carries no effect or one very small one, never two. The map keeps the four rarities the schema already has (`common`, `uncommon`, `rare`, `legendary`, 9.10) and keeps them **orthogonal to tier**, as the schema states ("the rarity says how often it appears; the tier says how far up the ladder it is"). Tier sets the strength row an effect is read from and the ceiling band (4.7); rarity sets how many effects a thing may carry and where in its tier's row each one sits. Why orthogonal and not one axis: rarity is already a supply axis, priced by the rarity budget and computed from the data by the check, while tier is the ladder of strength and requirement; one axis would make every late thing scarce and every scarce thing strong, and the map wants both a common tier-4 coat (a plain everyday piece of the late game) and a rare tier-1 charm (a lucky find in the valley).

| Rarity | Effects, at most | Strength of each, against its tier's row | Notes |
|---|---|---|---|
| `common` | **1, often 0** | at most the stat's **smallest step**: its tier-1 value (a worn effect's 5 points, `wear_effect_max_pct[0]`; +1 to an attribute; 1 grade for a trait; a dish effect's tier-1 row) | quality never lifts it past the step; every built common piece already fits (0 or 1 worn effect at 5) |
| `uncommon` | 1 | 50-75% of the tier's value; a trait at the tier's strength (1, 1, 2, 2, 3) | |
| `rare` | 2 | 75-90% | a master piece's second worn effect needs rare or above; the best rare of a tier stays at least 10% under a legendary of it |
| `legendary` | 2 | 100%; may also carry one ceiling raiser (4.7) | the found raisers are legendary: few and late, not bound (1.11) |

Quality (5.2) moves a piece inside its rarity's band, plain at the bottom and master at the top, never past it. A rarity's share of an effect rounds down with a floor of 1 (balance finding 6, accepted 26.10), so a small effect (full value 1-3) never rounds to nothing inside its band. What counts as an effect: each worn effect, each trait and each dish effect; whether an attribute bonus counts is an owner call (section 9, recommended: it counts). A made piece's rarity is its materials', as the check computes it now ("a rare material makes a rare thing").

- **Dishes** (BODY_CLOCKS.md 7.3): a dish's effects are the tags its ingredients share, at most two. Its rarity is that of the **rarest ingredient among those that carry one of its effects**, so a rare ingredient lifts a dish only if it takes part in an effect; **a dish of common ingredients only is common** and shows at most one effect, at the smallest step. The cook's Cooking band caps it (band 1 up to uncommon, bands 2-3 up to rare, bands 4-5 up to legendary): a cook below the cap still makes the dish, at the cap (no level wall, 9.10). Where the rarity allows fewer effects than the shared tags, the one kept is the tag carried by the rarer ingredients, ties by the effect list's order, so the same pot always makes the same dish.
- **Garment traits** exist at common **only at the weakest grade**, strength 1 (the general rule applied, not an exception); strength 2 and up needs uncommon or better. The check against calm snow (grade 1, BODY_CLOCKS.md 5.2): a common tier-1 wool hood with `cold_proof` 1 (Tailoring at tier 1, from the valley's wool) and common snowshoes with `snow_shod` 1 (Woodcraft at tier 1, ash and gut) take frost and snow at grade 1 to nothing, and a common dish sharing the `cold_proof` tag does the same for frost; bare, the 8 min 20 s still holds. So a new player answers calm snow with two plain pieces made early. The other choice, traits from uncommon up only, would put the first answer to the valley's first snow behind the rarity budget's supply, answered only by luck or trade.
- **Check row** `common_plain` (joins the family of 4.7; spec only): no common item or dish carries more than one effect, and no common effect exceeds its stat's smallest step. With it, `rarity_effects_max` [1, 1, 2, 2] and `rarity_band_permille` (common: the step; uncommon 500-750; rare 750-900; legendary 1000) for the other rarities. Unlike the rest of 4.7 it can read today's content, which already passes it.

## 6. The unlock economy

### 6.1 The four prices of decision 39

"Rising cost per tier, attribute keys, books and teachers, rare finds as the price of the upper tiers." On this map: the **point** (one per character level; a node costs 1, 2 or 3 by size), the **band** (the school's own level; time by doing), the **key** (an attribute threshold; race, grade or pips), the **find** (a book for a foreign node, a recipe scrap for a higher tier, a rare material for a master piece). No fifth price; gold buys nothing on this list (G39).

### 6.2 Points per level: kept at one

One point per character level, flat (Skyrim's rule; Fallout 4's too). Not two at the upper levels: the upper bands are already priced by time (3.2), and a second scale would show through as a number. `growth.cost` stays {small 1, major 2, corner 3}; the crown costs as a corner; a branch's first node costs as a major.

### 6.3 Respec

As built: none. The owner, 25.10 (Q4 = B): the limited form. `unlearn` at a safe place, free the first `respec_free` (3) times, then `respec_mg` (proposed 20,000 mg; the sinks are the world's prices, DECISIONS 2026-10-23), one node at a time, nothing learned may depend on it, a book's node is never refunded, a pip is never unlearned (Dimraeth's rule: the tree can be redone, the attributes cannot). Skyrim's per-school reset (points back, the school's level back to the first band) was option C and is not taken: it sells time back, against "nothing shortens a wait" read the other way.

### 6.4 Keys and attributes

Six attributes, a fixed profile per race (total 7) plus the grade's shift on the two home attributes (decisions 44-46); on top, as built, `spend` buys a pip for a point, capped at `key_max` 5 (GROWTH 3.4; the owner's Q5 = B). Worn gear adds bonuses on top of that (5.6). A key on a node asks a threshold of `attrAt` (race + grade + pips). Four rules:
1. A key never asks more than the race with the lowest value in that attribute could reach with pips by the node's band (so every race can reach every node of its own schools; the harder way of G12 is the pips' price in points).
2. A race's home attribute meets its wing's keys without pips (the elf reads `senses 3` nodes at once; the skeleton `might 3`); that is where "every trait pays off" is cashed.
3. The grade's shift counts (decision 46: brighten on entering a region), so a node learned in the north with a key met by the grade stays learned in the city (a key is checked at `learn_node` only; a learned node never un-learns).
4. Worn bonuses never count toward a key or a wear requirement: `attrAt` for a key and for `req` is the base; the stats panel's total (base + gear) is what the verbs read.

### 6.5 The race trunk and the cross-links

- **The race wing**: eight nodes, bands 1-2 of the race's own path (the skeleton's rest, the elf's step, the human's made-thing bonus), reachable by the race alone, taught to another race only by a book (decision 38) and only for its small nodes (a wing's majors are the race: no book).
- **Corner nodes**: one per race in every school, needing the school's first major; the reason a skeleton smith and an elf smith differ.
- **Cross-links** (proposed, the one change to GROWTH's "same school only"): a node may carry `needs` across schools for a **bridge node**: Leatherwork's first branch needs Hunting's `harvest_yield`; Smithing's `alloy_read` needs Mining's `vein_sense`; Travel's `sled` needs Woodcraft's `joinery` (the sled is Woodcraft's make; 4.8). At most `cross_links_max` (2) per school and never into a combat school from a trade (a smith need not fight). Cross-links are the edges that make the tree a graph the in-flight screen already draws, and they are the breadth pull in shape, as 3.4 is in points.
- **Books**: as GROWTH 3.7; the rarity budget prices them; a book for a bridge node teaches it without its cross-link.

## 7. Kernel shape (proposed; additive; integer; FORMAT_VERSION unchanged)

- `Player.xp` as built; `xp_levels` to twenty entries per profession, generated.
- `Player.respecs?: number`, `Player.books?: Id[]` (GROWTH 4.3). No body field: a place's conditions are a pure function of the region, the hour and the day's weather (BODY_CLOCKS.md section 9); `Player.dishes?` (at most two: effects, tier, until) for the dish effects (Q8b).
- Group play (3.7, with presence): per player per span `own`, `share`, `bonus` by school, and a pair ledger `{ partner, day, active_ms }` for the pair schedule; the server's books, not the save.
- A node gains `band: 1..4 | 'crown'` and may gain `branch: Id` and cross-school `needs`; a school gains `branches: [{id, title}]` and `crown: Node`.
- A technique gains nothing here; its format is GROWTH 3.5 and COMBAT 4.3.
- Items gain `quality?: 'plain'|'fine'|'true'|'master'` on an instance (a stack of made things splits by quality the way it splits by tier), `guard_pct`, `quiet_wear` in `WORN_EFFECTS` when their schools land; `trait?:` one name from `TRAITS` on a garment (Q8); `weapon?: {reach, harm_band, school}` with combat; `attrs?: Partial<Record<Attribute, number>>` and `req?: { school, level, attr? }` (5.6). A new read `attrTotal` (base + the active part of worn bonuses) for the verbs; `attrAt` stays the base for keys and requirements.
- Recipes gain `family: Id` (the quality node names a family, not a recipe).
- Travel (4.8): a crossing prop's `crossing: true` may become `{ kind, travel, secs }` (19 a, a shared-file pull request of its own); actions `row` (with the boathouse, 19 f); params `row_step_ms` (300), `edge_max_pct` (200), `belt_tools_max` (2), `ceiling_carry`; check rows `xp_one_school` (every active millisecond pays one school, the mentor's +20% aside), `shortcut_reach_closed` (19 g's reach is read with every Travel crossing closed: an error), `shortcut_saves_min` (8 steps saved, a warning).
- Quests gain `xp?: {school, seconds}` in the reward; characters gain `teaches?: {school, band_max}`.
- Actions: `unlearn` (6.3), `lesson` (3.6); `learn_node` checks the band; `craft` rolls quality.
- Params (`growth`): `t1_min_s` (25), `t1_max_s` (30), `catalogue_hours_min` (800), `band_size` (5), `slot_levels` re-spaced, `power_cap_step_permille`, `power_cap_max_permille`, `main_line_points_max`, `nodes_max`, `branches_max`, `cross_links_max`, `tree_buyable_max_permille`, `key_max`, `respec_free`, `respec_mg`, `quality_bp` by band, `attr_bonus_max` by tier and its step, the balance rows of 4.7 (`effect_graph_acyclic`, `loop_profit_max`, `xp_sources`, `ceiling_<category>` with their raisers, the wall rows, `top_builds_n`, `top_over_median_max_permille`, `proof_enum_max`), `group_share_max_permille` (250), `mentor_bonus_pct` (20), `mentor_band_gap` (1), `mentor_reach_tiles` (12), `pair_full_min` (60); each with min, max and step (R12). The place conditions' params are listed in BODY_CLOCKS.md section 9.
- The state machine of a node, per player: `locked` (band or key unmet) -> `open` (buyable) -> `learned` (always on, or in the shelf) -> `slotted` (in the build; techniques only) -> `learned` again on unequip -> `open` again on unlearn (never back to `locked` while its school's band holds). The screen draws these five states and no number.

## 8. Rule lines proposed, in the form GAME_RULES uses

Numbers provisional (P1 onward; the rules pull request assigns G numbers after G92 of GROWTH.md).

- **P1 Rise by use opens, points buy.** A school's level rises only with the active time of its own verb, on one curve whose ratio is the game's difficulty step; every level anywhere pays one point; a node is bought with points in a band the school's level has reached. Nothing else pays a level and nothing shortens one.
- **P2 The character level is read by three things.** The power cap, the slots and the forms of travel; never a quest, a price, a foe or a recipe. A quest that wants a capable player names a school's band or a key.
- **P3 A band gates nodes, never verbs.** No level, band or node walls an attempt, a recipe, a region or a door; a band says which nodes are for sale, a node says how well. One exception, G61's: a Travel crossing opens at its Travel level, because the long way round always stays and the check proves it (4.8).
- **P4 The tree cannot be bought whole.** The catalogue's cost stays above what a character of the highest level could hold (the check's permille), so every character is a choice; a school's main line stays inside the points its own levels pay, so a specialist is never forced to wander.
- **P5 A made thing has a tier, a rarity and a quality.** The tier caps it, the rarity prices it, the quality moves it inside the cap; the quality roll is what a crafting node opens, and the attempt needs knowledge, a place and materials and never a node.
- **P6 Knowledge is found, skill is done, lessons are time.** Recipes above tier 1 and books come from the world; a teacher gives time at the ordinary rate and asks standing, never gold for a level; a quest pays a named school, bounded by its own active time and each player's.
- **P7 The long way is made ready, never unlocked.** Harsh places, dark, drops and creatures each hang on a condition of the place or a check that worn gear and schools move; none is a door, and none is a meter on the body: health and experience are the only bars.
- **P8 A school grows by branches.** Past its second band a school forks; a main line never grows longer than twelve nodes; a thousand nodes is more branches as data, never a longer trunk.
- **P9 A cross-link is a bridge, not a wall.** A node may need a node of another school only as a bridge between trades, at most two per school, never from a trade into combat; a book teaches a bridge node without its link.
- **P10 Gear lends attributes, one tier ahead.** Worn gear adds attribute bonuses that rise with tier, with no fixed cap; each item names a school level and an attribute it asks, read on the base; below it the item helps up to what gear one tier above the wearer's own gives, and says what unlocks the rest. Gear never meets a key, and a look never carries a bonus.
- **P11 Help, never a carry.** Experience comes only from the player's own actions. In a group a newcomer gets at most a quarter of their own earned experience as a share of the group's and a fifth more of their own while a stronger player is near, both falling for the same pair over a real day; the veteran earns standing and the giving board, never experience; a carry sold for gold is an exploit loop.
- **P12 Travel's verb is the way over.** A crossing, a ford, an oar stroke and a course lap pay Travel; a plain or heavy step pays nothing, and every active millisecond pays one school only.
- **P13 Tree first, both ways.** Everything a player can grow in has its place in the tree when it is designed, and every task and quest starts from the tree; every pull request says where, in its `Tree:` line.

## 9. Direction calls: all eight answered, and Q8's two follow-ups

Each is the owner's. All eight were answered on 25.10, one at a time; each answer is its own ✅ entry in DECISIONS of that day and is folded into the sections named. The options as asked are kept in the entries.

| Call | His word (25.10) | Where it landed |
|---|---|---|
| Q1 How long is "complete" | **C**: `t1` 25-30 s, 45-55 active hours a school, 800+ h in all (RuneScape's band). Default `t1` 28 s | 3.2 (the curve, why 28, the catalogue's check row) |
| Q2 Combat schools now or with the first foes | **B**: Strike, Aim and Guard reserved now (names, shapes, effect lists, slots; three closed spokes on the screen); nodes with the first foe | 4.2 |
| Q3 The hybrid or points alone | **A**: the hybrid as built, sized: rise-by-use opens, points buy | 1, 3.1-3.4, P1 |
| Q4 Respec | **B**: limited; one node at a time at a safe place, three free then gold; attribute pips never | 6.3 |
| Q5 Attribute pips after the opening | **B with gear**: pips bought with points to 5, and worn gear adds attribute bonuses on top, rising with tier, no fixed cap; the panel shows "Might 7 = 5 + 2 gear"; each item states a wear requirement, and below it counts up to one tier above the wearer's own; looks never carry a bonus | 5.6, 6.4, P10 |
| Q6 Quests pay a school | **A**: a named school, bounded by the quest's own active time | 3.6 |
| Q8 The body | none of A, B or C: **two bars only, health and experience**; no cold, warmth, hunger, thirst or tiredness meter; a place is harsh by its conditions (storm, snow and the like slow walking and work), and fitting gear answers it: a garment keeps its attribute bonuses and some carry a trait from a closed list | 4.5, BODY_CLOCKS.md section 5, P7 |
| Q8a Harsh places' cost | slow **and** a health drain graded by the place's danger; the right gear cancels it fully or one grade down | 4.5, BODY_CLOCKS.md section 5 |
| Balance (a refinement of Q8b) | everything computable: two red lines (no loop; experience only from the mentor), rising ceilings by band with a few rare raisers, walls proven solvable and not cheesable | 4.7 |
| Common things are plain | common food, accessories and gear carry no effect or one very small one, never two | 5.7, BODY_CLOCKS.md 6.2 and 7.3 |
| Q8b Food and sleep | food heals; cooked dishes give timed effects from a closed list, the catalogue huge; one or two at once; sleep only saves and passes the night (no Rested, Fed folded into dishes) | 4.5, 4.2 Cooking, BODY_CLOCKS.md sections 7-8 |
| Ceiling owners | **health from stamina** (100 + 20 a point; Fallout's Endurance split); Survival sets health back, the senses and the answer to places; Travel the walking speed | 4.7, 4.8 |
| Travel carries weight | a full school: carrying, ways over that open by Travel level (RuneScape's Agility), fords, the boathouse's boat, the sense of a route; a real 51.7 h path; the stacking rule with harsh places | 4.8 |
| Tree first, both ways | every feature a player grows in takes its place in the tree when designed; every task and quest pitch starts from the tree; a `Tree:` line on every pull request, checked by CI (#341) | 4.9, AGENTS.md, the quest-designer skill |
| Q7 Teachers | **A**: time at the ordinary rate, standing earned, never gold for a level; and no industrial carry: own actions only, a share of at most a quarter of one's own, +20% near a stronger player, the veteran on the giving board, diminishing returns for a pair, sold carries an exploit loop | 3.6, 3.7, P6, P11 |
| The balance prover's twelve findings (#342) | **every proposed value as proposed** (26.10, red lines first): a raw berry at 15,750 mg at the trader's stall; the group share splits experience already earned; the grade-4 jackpot pays goods, experience x1; rare 750-900; ice grip also on the hands; rarity strengths round down, floor 1; warning line 2000; walls at band 3+ are grade 3-4; grade-1 drain 10; drain in points of the base cap; regen and mend dishes +2 sustain; danger recommended by band | 3.7, 4.7, 5.7, BODY_CLOCKS.md sections 5-7, `content/core/params.json` |

**Answered by the owner on 27.10 (seven calls, each its own ✅ entry; none is open):**

| Call | Pick | Lands in |
|---|---|---|
| An attribute bonus and a common piece's one effect | it counts: a common piece carries one thing; from uncommon up attribute bonuses ride beside the effects | 5.7, section 10 |
| A heavy step and Travel | no: a heavy step pays Travel nothing; a load matters only through the carrying nodes (the owner's recommended default of an earlier draft, the time the load adds, is dropped) | 4.8, P12, section 10 |
| Trail courses | yes, one course a band, at places of rising danger | 4.8 |
| How a wall at band 3 or more holds | a clock or a school-level requirement beside the drain, as the stand-in walls carry | 4.7 |
| The `Tree:` line and extensions | owed by every pull request, extensions included | 4.9 |
| The coverage report's name | `pnpm tree:coverage` | 4.9 |
| How the ceiling raisers are had | half crown nodes, half legendary finds that trade (1.11); ten stays `raisers_max` | 4.7 |

Also recorded 27.10: the ceiling bands read as drawn (health from stamina; sustain, sense and place from Survival; move and carry from Travel). One idea of the owner is not yet rules, a fog of total darkness and unbeatable titans past the map's edge (DECISIONS 2026-10-27 ⏸).

**Q8a and Q8b, the two follow-ups, answered by the owner the same day:**

- **Q8a. Harsh places take health too.** They slow the player and take health by a grade of the place; the right gear cancels the cost fully or one grade down. A calm snowy place is about a point every few seconds, bearable for a few minutes (BODY_CLOCKS.md section 5).
- **Q8b. Food heals, and cooked dishes give timed effects.** A closed, moderate effect list; a huge catalogue of ingredients and dishes, so that finding them is part of exploring; one or two dish effects at once; never experience. Sleep saves and passes the night only: the Rested bonus is dropped, and Fed is folded into the dish effects (BODY_CLOCKS.md sections 7 and 8).

## 10. The conflict table: each draft rule against the decisions

| Draft rule (this page) | Decision (title, date) | Verdict | Note |
|---|---|---|---|
| P1 rise by use opens, points buy | "Skill points with effects you can feel" (7.10); "The skill tree's format" (23.10) | agrees | the kernel already does it; this page sizes it |
| The curve's ratio is 1.5 | "One internal difficulty scale: each step asks half again as much" (9.10) | extends | the decision names difficulty; this page reuses its constant for experience so there is one scale |
| Twenty steps, mastery at 21 | GROWTH.md 3.6 "the professions keep their twenty levels"; the 19.10 answer "not skills to 99" | agrees | the schema's cap of twenty thresholds stands |
| `t1` 28 s, a school in 52 h, the catalogue past 800 h | "The owner's answers of 10.10 afternoon" ("raising a skill or a level does not weigh as much as it should"); Q1 (25.10) | extends | sized by his Q1 = C; 28 chosen inside his 25-30 (3.2) |
| P2 three readers of the character level | GROWTH G89 "nothing but the power cap reads the character level"; "The world's structure ... travel earned by level" (23.10) | extends | G89 said one reader; travel (23.10) and the slots (23.10 format) are two more, named so the list is closed |
| Power cap by formula past level 14, max 4000 | kernel review R9, R12; "The reference player" (9.10) | extends | the table stays the first fourteen entries; the step and the max are params with ranges |
| Slots at [1, 1, 10, 30, 60] | "The skill tree's format" (23.10: 1, 1, 5, 10, 15) | extends | values only; the format's `slot_levels` param holds them |
| P3 a band gates nodes, never verbs | "The crafting economy: no level wall" (9.10); "Crafting is optional" (9.10); G12 | agrees | a band on a node is Skyrim's perk gate; the verb stays free |
| A node never walls a recipe; quality is what a node opens | "First-tier recipes known from the start; higher tiers are dug up" (10.10); "A craft can miss" (9.10) | extends | knowledge from the world, quality from the hand; the chance formula is unchanged |
| A third axis, quality, inside the tier's cap | "Two ladders: an open-ended tier ... the four rarities" (9.10); "The upgrade: work clothes with a small capped bonus" (9.10) | extends | quality moves inside `wear_effect_max_pct`, never past it |
| Tools and weapons wear; armour never | "The crafting economy ... worn pieces never wear out" (9.10); CR-12 | agrees | a weapon is a hand-slot thing with uses, as a tool |
| Mend restores uses as a recipe | R9 (the output of an activity with inputs is never raised) | agrees | the output is the input; nothing new is made |
| Quests pay a school's experience | NEXT 19 (the difficulty reckoning reads "the experience quests pay"); R6 | extends | bounded by the quest's own active time and each player's; Q6 = A |
| A teacher is time at the ordinary rate | "No percentages on screen" (22.10, decision 39: "books and teachers"); "Crafting and money: power is never sold" (9.10) | extends | lessons exist (39) and sell nothing (G39); Q7 = A |
| Experience only from the player's own actions; a group share of at most a quarter of one's own | R6; kernel review (active ms per player) | extends | both group terms are multiples of the newcomer's own active ms (3.7) |
| A newcomer earns +20% of their own near a stronger player | R6 (a reward is an activity record; nothing pays more than the time it took) | **conflicts** | declared, the owner's word (Q7, 25.10): the one multiplier on experience the game has; bounded by own time, falls for the same pair; no body state or node adds another |
| The veteran earns standing and the giving board, not experience | "The boards rank worth, levels, quests, collection, exploration and giving" (9.10) | agrees | the giving board counts the help paid |
| A carry sold for gold | "An exploit loop costs its accounts and the gold it made" (9.10) | agrees | the server's books see the pair and the gold |
| Nothing shortens a wait | "The world and its clocks" (10.10) | agrees | no node, lesson or point touches a respawn or a night |
| Race wing, corner nodes, books from a foreign wing | "The tree (decision 38)" (22.10) | agrees | kept whole |
| Cross-links between schools | "The skill tree's format" (23.10: `needs` the same school only); GROWTH 4.5 | **conflicts** | a deliberate extension: bridge nodes, two per school, never trade into combat; the check row changes from "same school" to "same school or a declared bridge" |
| Pips bought with points to 5 | "Opening balance: a fixed attribute profile per race" (22.10, decision 44); GROWTH 3.4 | extends | 44 fixes the opening ("no free points at the title"); `spend` after it is as built; Q5 = B keeps it |
| Worn gear adds attribute bonuses, rising with tier, no fixed cap | "The upgrade: work clothes with a small capped bonus" (9.10); `wear_effect_max_pct` per tier; R9 | extends | attributes are a new axis of a worn piece; worn effects keep their tier caps; what an attribute moves as a rate still sums under the power cap (5.6) |
| A wear requirement, softened: one tier ahead, the rest on meeting it | "The crafting economy: a miss keeps only inputs, a free market, no level wall" (9.10); G12 | extends | the item is always worn and always helps; the requirement gates only the part of its power past one tier ahead; the free market is the reason (Q5) |
| Gear never meets a key; looks never carry a bonus | Q5's option C (keys a shopping list); the schema's look layer ("counts for nothing"); G39 | agrees | `attrAt` stays the base for keys and requirements |
| Keys reachable by every race of the school with pips by the band | "What a grade does" (decision 46); G12 "a harder way, never a closed door" | agrees | rule 6.4.1 |
| Respec limited, gold after three | "The skill tree's format" (23.10: "no way to unlearn yet"); "Open ends of the world plan ... the sinks are the world's prices" (23.10) | extends | Q4 = B; the 23.10 line says "yet" |
| Combat schools reserved now, nodes with the first foes | "G35 is the demo's rule" (19.10); "Combat, round 5" (23.10); COMBAT section 6 | agrees | Q2 = B, the decided order |
| Hunting as a school bridging combat and leatherwork | "The ambient creatures wait ... hunted for what they give" (25.10) | extends | its gathering half before combat, its kills after |
| Smithing and Tinkering in the city only; metal content waits | "Making in the neutral valley" (decision 51); "Human technology means made things" (decision 20); "Metal: the grammar is ready" (9.10) | agrees | the forge is the gate, as decided |
| Remedies without magic | "If magic comes: scrolls and books" (9.10 ⏸) | agrees | the school holds remedies; a spell would be a book, as the ⏸ says |
| Two bars only; a place's conditions slow walking and work | G32 "Health is the one bar"; the forbidden pattern "Hunger clock"; G28 | agrees | no meter on the body; a condition is a function of the place and the hour, so nothing runs while away and nothing fills or empties (Q8) |
| Worn gear is the answer to a harsh place | G34 "the answer is a run, never gear"; the forbidden pattern "Gear answer"; "A hazard is escaped, never answered by an item" (10.10) | **conflicts** | declared, and further than before: the owner's Q8 makes gear the answer to every place's condition, on top of the 25.10 readiness answer; the rules pull request writes G34 as "a hunting hazard is answered by a run; a place's condition by what is worn", and the forbidden pattern keeps oil, an antidote and the like as answers to hazards only |
| A trait never adds experience; a harsh place pays no more per second | R6; the group rule (3.7) | agrees | a slower step is the same experience a second and fewer things an hour |
| A trait follows the one-tier-ahead rule; a look carries none | Q5 (25.10); the look layer | agrees | 5.6 |
| No hunger drain; Survival keeps no `hunger_pct` | G32; "P-5c ... the hunger clock stops" (11.10) | agrees | the first draft's `hunger_pct` slowed a drain that is 0; Fed is folded into the dish effects (Q8b) |
| A harsh place takes health over time (Q8a) | G32 "Nothing drains it by the clock (G28)" | **bends** | declared: the drain is the place's, never the body's; it runs only while the player stands in an unanswered grade, stops in a safe place, and never runs while away; outside harsh places nothing drains |
| A dish answers a place's condition | G34 "Food ... heal, they do not answer a hazard" | **bends** | declared: a dish adds one step against a place's condition (as a garment does); no dish effect touches a hunting hazard (the wolf, the pit, the trap, deep water), whose answer stays the run |
| No loop: a made thing's strength never reads worn gear or a dish | `WORN_EFFECTS` `craft_speed_pct`, `craft_chance_pct` (built) | agrees | both change speed and success, never the output's strength; a future worn effect on quality would be red |
| Rising ceilings by band, combinations stack freely up to them | R9 one power cap; Q5 "gear bonuses with no fixed cap" | agrees | the `work` row's top is `power_cap_max_permille`; the power cap keeps clamping by character level and the lower of the two binds; attributes stay outside the ceilings |
| A wall's requirement | P3 "no level, band or node walls an attempt"; "no level wall" (9.10) | agrees | the wall checks nothing at its door; below a requirement the chance falls to nothing as a recipe's does, and the numbers make the wall |
| `sustain` clamps health back while a place drains | G32 "eating is how the player heals" | **bends** | declared: only inside a draining grade; elsewhere a meal heals at once, as built |
| A found raiser is not bound (1.11, superseding the 27.10 binding) | the free market (9.10); G39 "power is never sold" | agrees | G39 keeps power from money and premium currency; a found raiser sold for gold between players is the free market, as any found item |
| The Q8 fill's "never more than one grade above the wearer's tier" | the owner's balance answer (25.10) | superseded | dropped: the `place` ceiling by band and the walls proven both ways replace it |
| Rarity sets the count and band of effects, orthogonal to tier | the schema's "the rarity says how often it appears; the tier says how far up the ladder it is"; the rarity budget (kernel review 8.2) | agrees | rarity keeps pricing supply; it now also bounds what a thing carries |
| Common things are plain | the built outfits and tools (every common piece 0 or 1 worn effect at 5) | agrees | today's content passes `common_plain` as it stands |
| A master piece's second worn effect needs rare or above | 5.2 (proposed by this page) | amended | the owner's rule wins over the page's own proposal |
| An attribute bonus as a common piece's one effect | Q8 "every garment keeps the tree points it adds"; Q5 | **decided** (owner's pick, 27.10) | it counts, so a common piece carries one thing (+1 to one attribute, or one small worn effect, or a strength-1 trait); from uncommon up attribute bonuses ride beside the effects as Q5 wrote |
| Sleep gives no bonus (Q8b) | G32 "a night's sleep in town ... give[s] it back" | agrees | sleep keeps G32's health and saves the game; it adds nothing more |
| Drops crossed with rope and a node | "One height layer" (25.10); G68 crossings | extends | a `rope` crossing kind |
| Trade nodes move capacity, never a price | "Prices and gold" (10.10); R8; GROWTH 5.4 | agrees | `stall_slots`, `price_memory`; the band is untouched |
| Travel nodes past the first third of the school | "The world's structure" (23.10, item 7); W9; G64 | agrees | GROWTH 5.2 kept: Travel's first `walk_step_pct` sits in band 3 (4.8) |
| Health's ceiling band read from stamina | 4.7 as first written (the governing school); Q5 "attributes outside the ceilings" | extends | the owner's answer (25.10); an attribute's own bonuses stay uncapped, stamina only picks the band |
| A Travel crossing opens at its Travel level | P3 (this page: "no level walls an attempt"); "The crafting economy: no level wall" (9.10) | amended | G61 gates a shortcut by a trait or skill, and the owner's "open by Travel level"; P3 names the one exception; the long way round always stays (`shortcut_reach_closed`) |
| Travel crossings are not faster forms | "The world's structure" item 7 (each faster form earned by player level); 3.5 | agrees | a crossing is a way over (G68); a boat of one's own, a boat line, a mount, a teleport stay on the character level |
| A plain step pays no experience | R6; 3.6 (the verb's own active time) | agrees | Travel's verb is the way over; `xp_one_school` keeps every school's hours its own |
| A heavy step pays Travel | R6 (a reward is an activity record) | extends | **decided** (owner's pick, 27.10): no; a heavy step pays Travel nothing, a load matters only through the carrying nodes (supersedes the recommended default) |
| Travel never lowers a grade; a place answer never adds speed | Q8a (gear cancels the cost fully or one grade down) | agrees | one slow, one owner: the stacking rule of 4.8 |
| Travel's `scramble` (one level, by hand) beside Climbing's rope | G68; "One height layer" (25.10); 4.5 drops | extends | one face, two kinds of crossing, never one crossing in two schools |
| A rowboat lent at the boathouse | NEXT 19 f (the keeper's errand uses a ramp or a boat lift) | extends | the boat is lent, not owned and not a form; the errand stays the keeper's |
| Carrying's limit read from might, raised by Travel | "Weight and the three paces" (23.10, #297) | extends | might keeps the base; Travel's `load_pct` sits in the new `carry` ceiling; the frame pack's +10 stays the bag's base |
| A `Tree:` line on every pull request | #331 (three lines, each owed by the paths it is about) | extends | owed always, since any change may grow the player; mirrored in the same CI job (#341) |
| Core-only schools (sixteen in the first full catalogue, twenty-two in all); creators never add a school | GROWTH 3.1; CRAFTING_AUDIT D-CRAFT-4 (CR-7) | agrees | a later decision may open it; not this page |
| No percentage on the skill screen; five node states | "No percentages on screen" (decision 39); "The skill screen is a tree of wings" (23.10) | agrees | the states are words; the number is a long press |
| The tree screen sized for 1,000 nodes | the tree foundations (#334, landed 27.10; a 300-node test fixture) | extends | a target for the screen's next step, not a change to what landed |
| A death leaves a pack; gear is a soft gate | "Open ends of the world plan ... a death leaves a pack" (23.10) | agrees | section 5.5 |
| Power never sold: no node, recipe, quality or lesson in a shop | "Crafting and money: power is never sold" (9.10); G39, G41 | agrees | the catalogue adds no exception |

Three conflicts and three bends, declared. The mentor's +20% (P11) against R6 is the owner's own word and stands as written. Gear as the answer to a harsh place against G34 is the owner's Q8 and follows the 25.10 readiness answer; the three bends are the owner's Q8a (a harsh place's drain against G32's "nothing drains it by the clock"), Q8b (a dish's step against a place's condition, against G34's "food heals, it does not answer a hazard") and the balance answer's `sustain` clamp inside a draining place (against G32's "eating is how the player heals"), and the rules pull request words all three. The third conflict is the cross-link (P9) against the 23.10 format's "same school only". It is proposed because the owner's vision ties everything to skills that unlock, and a tree whose schools never touch cannot express "the smith who learned the ore's grade in the mine"; the alternative (books only) makes every bridge a rare find, which is a slower and lonelier tree. If the owner keeps "same school only", P9 falls and the bridges become books; nothing else on this page moves.

## 11. Closed by analogy

Small holes this page closes by the reference games the decisions name (Skyrim, Fallout, RuneScape, The Witcher, Dimraeth, Path of Exile, Red Dead Redemption 2) and, for the answers of 25.10, the games his words point at (Final Fantasy XIV, World of Warcraft, Diablo, Elden Ring), each one line, each overturnable by the owner's word:

1. **Points bank** (Skyrim): unspent points keep without limit; as built.
2. **A perk needs its skill's band** (Skyrim's 20/40/60/80): bands of five levels gate nodes; the verb is never gated.
3. **Last step heaviest** (Skyrim's curve puts a quarter into the last tenth): the ratio 1.5 puts a third into the last step; mastery is a thing.
4. **Mastery does nothing by itself** (Skyrim's 100, RuneScape's 99): level 21 opens the crown node and a board row; no stat jumps.
5. **Trainers rejected, lessons kept** (Skyrim's gold-for-levels against G39): a lesson is time at the ordinary rate.
6. **Skill books** (Skyrim): a book teaches one node across the wings; a second copy teaches nothing; as GROWTH 3.7.
7. **Quest skill rewards** (Skyrim's skill-up rewards, RuneScape's experience lamps): a quest pays a named school, bounded by its own time.
8. **Tempering needs the perk, the base item does not** (Skyrim's smithing perks): quality needs the node; the attempt never does.
9. **Quality steps** (Skyrim's fine/superior/exquisite/flawless; Dimraeth's six): four, inside the tier's cap.
10. **Condition on the thing in hand only** (Fallout 3 and New Vegas): tools and weapons wear by uses; armour never (already decided for clothing; extended to armour by the same rule).
11. **Armour weight classes** (Skyrim's light/heavy): plate weighs into the light-load limit (30 + 10 per might); leather is quiet; cloth is warm.
12. **Fixed-difficulty places** (Fallout New Vegas, not Skyrim's scaling): danger by distance and the difficulty reckoning (G64, NEXT 19); no foe reads the player's level.
13. **Harsh places answered by gear** (Valheim's one frost-resistant cape, Red Dead's outfit warmth, Skyrim's warmth by slot, without their meters): conditions and traits; the research is BODY_CLOCKS.md.
14. **Harvest on a kill** (Red Dead Redemption 2, named 25.10): Hunting's `harvest_yield` and `clean_kill`; the hides feed Leatherwork.
15. **Active slots and a build** (The Witcher 3, Dimraeth): kept from GROWTH; the slot count re-spaced to the long scale.
16. **The tree as one picture, branches as data** (Path of Exile): a thousand nodes come by branches, never longer trunks; the screen is sized for it.
17. **No free attribute points at creation, pips later** (Dimraeth: attributes bought, never refunded): decision 44 at the title, `spend` after it, pips never unlearned.
18. **Respec limited and paid** (Dimraeth: free at first, then a cost): three free, then gold.
19. **A specialist fills their own tree** (Skyrim: one skill's levels pay for its own perks): a school's main line costs at most twenty points.
20. **Bridges between trades** (Skyrim's smithing-enchanting-alchemy loop, as perks that read each other): cross-links, two per school; a declared conflict.
21. **Gear shows its part of a stat** (World of Warcraft's character sheet colours a raised stat and splits base and bonus in its tooltip): "Might 7 = 5 + 2 gear", the gear part in another colour and in words.
22. **Under-requirement gear still helps, scaled** (Elden Ring and Dark Souls let a weapon be wielded under its requirement at a penalty; Diablo and World of Warcraft refuse it): the softer form, one tier ahead of the wearer and no further.
23. **A requirement reads the base** (in Diablo II and Path of Exile gear's own attribute bonuses count toward the next piece's requirement, so a player climbs through gear; this map closes that ladder): gear never meets a requirement or a key.
24. **A mentor's bonus** (Final Fantasy XIV's mentors and level sync, World of Warcraft's rested experience): +20% of the newcomer's own while a stronger player is near; the mentor's reward is standing and a board line, as XIV marks its mentors with a crown.
25. **Diminishing returns for the same pair** (World of Warcraft's honour fell for killing the same player again and again): the pair schedule, an hour full, an hour half, then nothing, each real day.
26. **Respec one node at a time** (Path of Exile's refund points and Dimraeth's paid reset): three free, then gold; a pip never.
27. **Shortcuts by skill level, and courses to train it** (Old School RuneScape's Agility shortcuts, each opened by an Agility level, and its Agility courses): Travel's crossings and trail courses.
28. **Carry weight from strength, raised by a perk** (Fallout's Strength and Strong Back, Skyrim's Extra Pockets; Old School RuneScape's weight draining run energy): might sets the base limit, Travel's Pack raises it.
29. **Hit points from the body, healing from a skill** (Fallout 3 and New Vegas: Endurance gives 20 hit points a point, the Survival skill what food and drink restore): stamina owns the health ceiling, Survival the health back.

## 12. The order, and what this page does not do

- Now: this page; the owner's answers Q1-Q8 (25.10, eight ✅ entries) folded in; Q8a and Q8b answered the same day; the balance model answered (4.7: two red lines, rising ceilings, walls proven both ways); the ceiling owners, Travel as a full school (4.8) and tree first, both ways (4.9) answered in round 5, the `Tree:` line's CI check (#341) and the coverage report (#345) landed on their own; the tree foundations (#334) landed with a three-hundred-node fixture, and the thousand-node target, the five node states and the three closed combat spokes (Q2) are for the screen's next step; fishing landed as a school (#340) and stone mining as a Digging action (#339), with the placeholder sizes of 23.10 until the content wave writes the band form and the effect lists of 4.2.
- Next (the growth format's build, GROWTH section 9 stage 3): `band`, the generated `xp_levels` at `t1` 25-30 with the catalogue-hours row, the power cap formula, the slot values, `unlearn`, the quality roll, the cross-link check row, gear's `attrs` and `req` with the stats panel's split total. One pull request per piece.
- With presence and groups (PRESENCE builds): the group rule of 3.7 and the giving board's count of help.
- With the first hand-made map and the city: Travel, Survival, Climbing, Tailoring, Woodcraft, Smithing, Remedies, Lore as schools with real nodes; the place conditions and the garment traits (Q8); the balance check-row family (4.7), a follow-up script once the catalogue exists; quests that pay a school; teachers.
- Now that #297 (weight, paces, bags) has landed: Travel's carrying nodes, each with its own kernel line. With the crossing kinds of NEXT 19 a (the step rule of 19 c landed in #405 with `crossing: true` only) and 19 f: Travel's crossings, fords and the boathouse's boat; the trail courses with the first map's places.
- The balance findings that are code, not words (accepted 26.10): the kernel's grade-4 jackpot multiplier came out (finding 3, kernel 0.23.0, 01.11, with its test); the prover's dish rules read the +2 sustain of regen and mend dishes (finding 11) and the ice grip on the hand slot (finding 5) once the catalogue holds them.
- With combat (G35 lifted): Strike, Aim, Guard, Hunting's kills, Leatherwork, armour's worn effects, weapons in the hand.
- Not done here: any real node (the content wave writes them to this map); the numbers beyond their ranges (tuning in play); pets and companions (the Company school waits for its format); magic (⏸ 9.10); creators proposing nodes or schools; any screen.
- Pages this map touches when its rules pull request lands: GAME_RULES (P1-P9 after G92), GROWTH.md 3.6 and 4.5 (bands, cross-links, slot values), COMBAT.md 4.3 (the hand's weapon record), CRAFTING_AUDIT CR-10, CR-20, CR-21, CR-32 (closed by sections 3.5, 5.3, 5.4), NEXT 19 (the difficulty reckoning reads the band and the quest's school experience), the tree screen's size target (#334's next step).

## Sources

- The Elder Scrolls V: Skyrim (Bethesda, 2011): eighteen skills raised by use, perks gated by skill level and bought with one point per character level, skill books, trainers, tempering by perk, legendary skill resets; its survival mode's warmth.
- Fallout 3 and New Vegas (Bethesda, Obsidian): condition on weapons and armour, fixed-difficulty zones (New Vegas), experience from everything into one pool (the model set aside in Q3).
- Fallout 4 (Bethesda, 2015): one perk point per level, perks gated by attribute (SPECIAL) and level; the flat point rate.
- Old School RuneScape: skills to 99 by doing, quest experience lamps, no classes; the per-skill time scale this page stays short of.
- The Witcher 3 (CD Projekt Red, 2015), Dimraeth (2025), Path of Exile (2013): the build and its slots, the tree of wings, attributes as keys and books across the class, the passive tree as one picture (GROWTH.md Sources).
- Red Dead Redemption 2 (Rockstar, 2018): hunting that skins and harvests what is killed (DECISIONS 2026-10-25).
- Final Fantasy XIV (Square Enix): the mentor system and level sync, where a veteran beside a newcomer is rewarded with recognition; World of Warcraft (Blizzard): rested experience, the character sheet's base and bonus, and honour's diminishing returns for the same victim.
- Diablo II and IV (Blizzard), Elden Ring and Dark Souls (FromSoftware): equipment requirements by attribute; the Souls games' under-requirement wielding at a penalty, the softer form taken in 5.6.
- Old School RuneScape (Jagex): Agility, its shortcuts opened by level and its courses; weight draining run energy (the Old School RuneScape Wiki, "Agility", "Shortcuts", "Weight").
- Fallout 3, New Vegas and 4: Strength and carry weight, the Strong Back perk; Endurance's 20 hit points a point and the Survival skill's food and drink healing in New Vegas (the Fallout Wiki, "Endurance", "Survival (Fallout: New Vegas)", "Strong Back"). Skyrim's Extra Pockets perk (UESP, "Skyrim:Pickpocket").
- The body clocks' sources (Skyrim's Survival Mode, Fallout 4 and New Vegas, The Long Dark, Valheim, Red Dead Redemption 2, Don't Starve, Minecraft, Stardew Valley, Old School RuneScape) are listed in BODY_CLOCKS.md.
