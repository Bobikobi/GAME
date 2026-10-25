# The progression map: the spine of a long game, its schools, its gear and its unlock economy (2026-10-25)

A map, not a content page. The owner's direction of 25.10: the infrastructure of the big long games (Fallout, Skyrim), games that take very long to complete, where levelling, crafting gear, clothing and weapons all hang on one thing: skills that unlock. This page turns that direction into world rules and algorithms (state machines, formulas, parameters) against what is already decided and built, so that every later content wave (a school's real nodes, a weapon family, a crafting ladder) is written to one map and not to the taste of its session. It takes GROWTH.md (the frame of schools, nodes, slots, keys, techniques and books; branch `docs/growth-frame`) and COMBAT.md (branch `docs/combat-frame`) as given and sizes them for a game of hundreds of hours.

Its entry: DECISIONS 2026-10-25 ⏸ "The progression map"; each answer to section 9 becomes its own entry and amends this page. The owner answered Q1-Q7 on 25.10: seven ✅ entries of that day, folded in below and marked "(Q*n*, the owner)" where they land. Q8, the body clocks, stays open; its research and cross table are [BODY_CLOCKS.md](BODY_CLOCKS.md).

Design only. Nothing here is built: no schema, kernel, content, parameter or screen changes with it. Everything marked **proposed** is a builder's shape or a reading of the owner's word, not his word; where an answer of his leaves a number or a form open, the builder's fill is marked proposed too. The questions that are his are in section 9, each with options and a recommended default. The two tree streams in flight (the skill-tree screen that draws a graph of any size, and stone mining and fishing as new schools) are not touched here; section 4 names the shape they should land in.

Facts about Openfold are read from `origin/develop` @ 606e1620 (kernel 0.16.0): `kernel/src/state.ts` (`professionLevel`, `characterLevel`, `skillPoints`, `powerCap`, `techniqueValue`, `attrAt`), `kernel/src/step.ts` (`learn_node`, `equip`, `unequip`, `spend`, the experience line in the work step), `content/core/params.json` (`growth`, `per_point`, `power_cap_permille`, the crafting group), `content/core/professions/*.json` (`xp_levels`), `content/core/schools/*.json` (the five placeholder schools of 23.10), `content/core/recipes/`, `content/core/items/`, `content/core/races/`, `schema/src/index.ts` (`EFFECTS`, `WORN_EFFECTS`, `ProfessionBody`).

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
| Growth frame: schools, three node sizes, slots and a build, keys, one technique format for work and combat, books, G87-G92 | GROWTH.md (branch `docs/growth-frame`) | Taken whole; sized here |

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

**Why 28 and not another number in 25-30.** Mastery is `t1 * 6648.5` active seconds, so 25 s gives 46.2 h, 27 s 49.9 h, 28 s 51.7 h and 30 s 55.4 h. Sixteen schools at 27 s come to 798 h, short of the owner's 800; 28 is the smallest whole second at which the catalogue at one value passes it (827 h), and it sits near the middle of his 45-55 h. It keeps the first point inside the first minute (G11), and it leaves room on both sides for the per-school spread: cooking and handcraft (short actions, many of them) may sit at 25 s (46 h), felling and mining at 30 s (55 h), so that one evening of each feels the same. The spread is held by a check row: the catalogue's mastery hours summed over its schools stay at or above `catalogue_hours_min` (800), so a spread that leans low goes red. The cost the owner accepted with C: the last step is a 15-18 h series of sessions, a third of the school; RuneScape's 92 to 99 is half of 99, so the band is the one he named.

### 3.3 Bands

A school's twenty steps fall into four **bands** of five levels and the crown: band 1 levels 1-5, band 2 levels 6-10, band 3 levels 11-15, band 4 levels 16-20, the crown at 21. A node carries the band it sits in (proposed field `band`, 1..4 or `crown`), and `learn_node` refuses a node whose band the school's level has not reached ("Your hands are not there yet." in the kernel's own words, never a number). This is the one place skill level gates the tree, and it is Skyrim's rule (a perk needs its skill at 20, 40, 60, 80). A band is never a wall on the verb: a level-1 forager may try a tier-3 recipe (no level wall holds), may walk into the south (no door holds); the band only says which nodes are for sale yet.

### 3.4 Points and the character level

- One point per character level, as built. With sixteen schools (section 4) the character level tops at 1 + 16 * 20 = 321 and so does the lifetime count of points.
- The tree's price (section 4.6) is about 850 points at the first full catalogue, so a finished character holds under forty percent of the tree. Skyrim's figure is about thirty. The check enforces it: `tree_buyable_max_permille` (proposed 450) of the tree's total point cost is at most what a character of the maximum level could have; above it the catalogue is too small and the row goes red.
- A specialist is served by construction: a school's **main line** (trunk nodes plus one branch, 4.3) costs at most the twenty points its own twenty levels pay, so a player who only ever cooks fills cooking's main line from cooking alone; the second and third branch of a school are paid by levels in other schools. That is the breadth pull, in points, with no wall.
- Unspent points keep (as built; Skyrim banks them too).

### 3.5 What reads the character level

Exactly three things, by rule (G89 of GROWTH, extended):
1. **The power cap.** The table is extended by a formula past its last entry: `cap(level) = table[min(level, 14)] + power_cap_step_permille * max(0, level - 14)`, clamped to `power_cap_max_permille` (proposed step 20, max 4000, range 2000..8000); 4000 is reached at character level 64, three mastered schools (about 155 active hours at `t1` 28 s). Everything a player wears, has learned and holds in slots still sums under this one number (R9).
2. **The slots.** `growth.slot_levels` re-spaced to the long scale: proposed [1, 1, 10, 30, 60] for five slots (today [1, 1, 5, 10, 15]); the fifth slot is a three-school character. Values only; the format of 23.10 stands.
3. **Travel.** Every faster form of travel names the character level it is earned at (DECISIONS 2026-10-23, item 7); on this scale the first (a trail step) sits around 10, a mount or a boat line around 40, the far forms past 100. Numbers for the world pages to set; this page only fixes the scale they are set on.

Quests, dialogue, prices, foes and recipes read the character level never. A quest that wants a capable player asks for a school's band or an attribute key (CR-10 closes that way: "a quest may name a school and a band", never a character level).

### 3.6 What pays experience (Q6, Q7, the owner)

- **Only the player's own actions.** The verb's own active time, as built (active ms are already kept per player), including the combat verbs when they come (a fight's active ms pay the weapon's school; COMBAT 4.3 reads the hand). Nothing another player does pays this player's experience, except the two bounded terms of the group rule below.
- **A quest pays a school** (Q6 = A). A quest reward may carry `xp: { school, seconds }`, paid to that school at completion, bounded by the quest's own active time with the effort weight (R6: a reward is an activity record; nothing pays more than the time it took), and for each player by that player's own active time on the quest: a quest done beside a veteran pays the newcomer for what the newcomer did. It never pays the character directly. This is how a quest line of the city teaches smithing to one who has never swung a hammer (Skyrim's quest skill rewards), with one spine.
- **A teacher is a place to train, not a shop** (Q7 = A). A character marked as a teacher of a school offers a lesson: an activity with active time, a minigame of the school's own kind, paying experience at the school's ordinary rate (nothing more, so it is never a shortcut) and asking nothing but standing with the character (the reputation standings) and, for the upper bands, a thing brought. Never gold for a level. Decision 39's "books and teachers" lands here; G39 forbids Skyrim's trainers (gold for levels), and this is the form that keeps both.
- Nothing shortens a wait: a respawn, a growth, a night are capacity, and no node, lesson or point touches them (R6, DECISIONS 2026-10-10 "The world and its clocks").

### 3.7 Help, never a carry: the group rule (Q7, the owner)

The owner, 25.10: help is welcome, a full carry is not, above all in multiplayer. In a group, each player earns from their own work, and a newcomer with a stronger player gets two bounded terms on top; the veteran's reward is standing, not experience. Per school `k`, over a span of play in one group (the terms are the owner's; the neighbourhood, the "stronger" test, the pair schedule and the numbers in brackets are proposed):

```
own[k]       = the newcomer's own active ms in k in the span                      as built; the base of everything
share[k]     = min( group[k] / (members - 1),  own[k] * group_share_max_permille / 1000 )
               group[k] = what the other members earned in k in the span          at most a quarter of own (250)
bonus[k]     = own[k] * mentor_bonus_pct / 100   while a stronger player is near    +20% (FFXIV's mentor, rested XP)
paid[k]      = own[k] + pair_factor * (share[k] + bonus[k])
pair_factor  = 1 for the first pair_full_min (60) active minutes of the same pair in a real day,
               1/2 for the next 60, 0 after; the day resets at 00:00 UTC (the daily caps' clock, 10.10)
```

- **Bounded by the newcomer's own active time.** Both terms are multiples of `own[k]`: a newcomer who stands idle while a veteran works earns nothing, and a newcomer who gathers while the veteran fights gets no share of the fight's school, because a quarter of nothing is nothing.
- **Stronger** (proposed): the other member's level in school `k` is at least `mentor_band_gap` (1) band above the newcomer's; **near**: in the same group, within `mentor_reach_tiles` (12) tiles. The bonus is one, however many veterans stand near.
- **The veteran earns standing and a line on the giving board** (the boards of 9.10 rank giving), never experience, for the time spent beside a newcomer: the giving board counts the newcomer's `share + bonus` paid while the veteran was the stronger one near.
- **Diminishing returns for the same pair** are the `pair_factor` above, so two accounts that always play together get the help for an hour a day, not for a lifetime.
- **Selling carries** (gold for a run beside a veteran) falls under "An exploit loop costs its accounts and the gold it made" (9.10): the server's books see the pair, the pattern and the gold.
- The +20% is the one multiplier on experience the game has, and it is declared as such in the conflict table (R6 reads a reward as an activity record; this is a bonus on one). No body state, node or item adds another: the body clocks' bonuses ([BODY_CLOCKS.md](BODY_CLOCKS.md)) move work and health, never experience.

## 4. The schools: the catalogue to aim for, and how a tree grows to a thousand nodes

### 4.1 The tree's shape, kept

Decision 38 as written: the race is the vertical axis (three wings), the schools the horizontal, a shared centre of attributes and small nodes, corner nodes where a race meets a school, books from a foreign wing. This page adds the band ring (3.3) and the branch (4.3) inside each school, and the cross-link (6.5) between schools, so that the picture of S1 (the tree of wings, DECISIONS 2026-10-23) stays the picture at a thousand nodes: the centre, three race wings, sixteen school spokes, each spoke four bands deep and forking past its second band.

### 4.2 The catalogue (proposed names; the five built schools keep theirs)

Sixteen schools in five families. "Now" is built or in flight; "foundation" waits for the first hand-made map and the server; "with combat" waits for G35 to lift. What a school's nodes may change is its **effect list**, a closed list the kernel applies (GROWTH 3.5); the lists below are the target, each name core-only and added with its first node, never before.

**Gathering** (verbs that take from the world; their nodes move speed, yield, sight and reach)

| School | State | What its nodes may change (effect list) |
|---|---|---|
| Foraging | now | `gather_speed_pct`, `see_ripe` (ripe plants glow after dark), `rare_find_pct`, `second_hint`, `night_pick` (pick by dark), `root_read` (what lies under a plant) |
| Woodcutting | now | `gather_speed_pct` (felling), `fell_facing` (a tree falls the way you face; across a stream it is a bridge), `log_split` (one more log per tree), `timing_window_pct`, `bark_find` (bark and resin as a second yield) |
| Digging | now | `dig_speed_pct`, `dig_depth` (the dig game shows how deep the find lies), `timing_window_pct`, `rare_find_pct`, `clay_eye` (clay and sand read from the surface) |
| Mining | in flight | `dig_speed_pct` (the pick), `vein_sense` (ore shows through the face), `ore_grade` (a second roll on the vein's grade), `rock_fall_window` (the warning before a fall is longer), `rare_find_pct` |
| Fishing | in flight | `timing_window_pct` (the bite), `fish_depth` (what swims where), `line_hold` (a big fish does not break the line), `bait_keep`, `rare_find_pct` |
| Hunting | with combat | `track_read` (a trail shows for a beat), `quiet_step` (noise radius smaller; round 4), `harvest_yield` (hide, meat, bone per kill), `clean_kill` (a kill that spoils nothing), `cone_beat` (a predator's cone shows when it turns) |

**Crafting** (the one craft verb; their nodes move the chance, the speed, the quality roll and the chain)

| School | State | What its nodes may change |
|---|---|---|
| Cooking | now | `craft_speed_pct`, `meal_fill_pct`, `meal_keeps` (a camp meal keeps through a night), `warm_meal` (a meal that holds off cold for a while; 4.5), `portion` (one more portion per cook) |
| Handcraft | now | `craft_speed_pct`, `craft_chance_pct`, `quality_pct` (the quality roll, 5.3), `cord_twice` (a second cord from one reed), `mend` (a worn tool mended at the bench) |
| Woodcraft | foundation | `craft_chance_pct`, `quality_pct`, `shaft_true` (a staff, bow or handle of one tier higher from the same wood), `joinery` (camp parts and furniture take less wood), `bow_draw` (the bow's draw reads from agility less) |
| Tailoring | foundation | `craft_chance_pct`, `quality_pct`, `warmth_pct` (cloth against the cold, 4.5), `light_cut` (a garment weighs less), `dye_fast` (a dye that keeps) |
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
| Travel | foundation | `walk_step_pct` on a kind of ground (trail, scree, snow; the W9 form, past the first third of the school), `load_pct` (the light-load limit higher), `camp_quick` (a fire laid faster), `path_read` (a shortcut shown for a beat) |
| Survival | foundation | `cold_pct` (cold creeps slower; if Q8 keeps a cold clock), `fed_long` (a cooked meal's Fed lasts longer; there is no hunger drain to slow, G32), `tent_warm`, `dark_sight` (a longer sight in the dark; the torch's light is still the item's), `fall_soft` (a drop costs less) |
| Climbing | foundation (the drops of the south need gear and a hand) | `climb_reach` (a one-level drop crossed with rope), `rope_uses`, `grip` (a fall from a climb is not a fall), `ledge_read` |

**Social and trade** (nodes change capacity and reading, never a price: R8, GROWTH 5.4)

| School | State | What its nodes may change |
|---|---|---|
| Trade | with the market (CR-19) | `stall_slots` (more listings at once), `price_memory` (yesterday's price shown), `haul` (a trade cart's places), `read_stock` (a shop's stock seen before entering); never the band of R8 |
| Lore | foundation; the ancient language of 9.10 ⏸ lives here if magic comes | `read_old` (an inscription read without firelight), `book_fast` (a book read in one sitting), `map_mark`, `riddle_hint` (a `riddle` step's second clue) |
| Company | later (pets with a skill each, companions: GAP section 9) | `pet_slot`, `pet_carry`, `ally_hold` (a companion stands longer); the format leaves the place, the content waits |

Sixteen schools (Company is the seventeenth and outside the count until its format exists). Every school is core-only content (`CORE_ONLY_TYPES`, GROWTH 3.1); a creator proposes a book, later a node, never a school.

### 4.3 How a school grows: the main line, branches, the crown

A school at the first full catalogue (proposed sizes, all params with ranges):

- **Main line:** twelve nodes over the four bands (three a band): per band two small and one major, the second band's major being the school's signature verb change; costs 4 * (1 + 1 + 2) = 16 points.
- **Corner nodes:** three, one per race, each needing the first major (as the placeholders of 23.10 have it), 3 points each; a player takes only their race's, 3 points.
- **Branches:** past band 2 the school forks into two (later three) named **branches** of eight nodes each (bands 3-4, four a band: three small, one major; the branch's first node is its major), 2 * (3 + 2) * 2 = 20 points a branch. Handcraft forks into Reedwork and Stonework; Smithing into Blades, Armour and Tools; Cooking into the Hearth and the Road (meals that keep); Travel into the Trail and the Pack.
- **The crown:** one node at mastery (level 21), 3 points, a technique that is the school's name made flesh (the forager who hears a plant; the smith whose blade does not dull), and the race's third corner answer if its wing names one.

Count: 12 + 3 + 2 * 8 + 1 = 32 nodes, 16 + 3 + 40 + 3 = 62 points a school; a player's reachable share (own race only) 59. Sixteen schools: 512 nodes. The race wings: three wings of eight nodes each (two small and two major a band for bands 1-2, the wing's verb changes), 24 nodes. The shared centre: six attributes as pips (not nodes; `spend`) and twelve small nodes any race may take (a wider bag pocket, a steadier hand). **First full catalogue: about 550 nodes, about 1,000 points of cost; a character's lifetime is 320.** With a third branch in every school (+128) and the combat schools' technique rows (+~60) the map holds about 750; a thousand and more comes only the way Skyrim's and Path of Exile's did, by more branches as data, never by longer main lines. The skill screen in flight should be sized for 1,000 nodes, not 300.

### 4.4 What a node may be (the closed effect grammar)

Every node's effect is one name from one closed list the kernel applies; a creator's content never reads a node (GROWTH 5.4). The lists of 4.2 grow by one rule: **a new effect name arrives with its first node, its kernel line, its property test and its check row, in one pull request**, the way a new verb arrives (kernel review 8.4). Four kinds of effect, by what the kernel does with them:

| Kind | Examples | Where the kernel reads it | Capped by |
|---|---|---|---|
| A rate | `gather_speed_pct`, `craft_speed_pct`, `cold_pct` | the activity's active time (R9) | the power cap with everything else |
| A roll | `rare_find_pct`, `craft_chance_pct`, `quality_pct`, `ore_grade` | the draw (R4) | `craft_luck_max_permille` and its siblings; never above the recipe's own ceiling |
| A sight | `see_ripe`, `dig_depth`, `vein_sense`, `track_read`, `cone_beat` | the state the client is allowed to show | none; a sight is information, not power, and it is why major nodes feel like Skyrim's perks |
| A verb change | `fell_facing`, `meal_keeps`, `climb_reach`, `clockwork` | the verb's own step | the verb's own rules (a bridge is a crossing of G68) |

A node never changes a recipe's output or a price (R9, R8). A sight node is the cheapest way to make a major node felt in a minute (G11) and is preferred over a rate node for every band-1 major.

### 4.5 The long way's gates, for the schools above

The 25.10 answer makes the south a set of made readinesses, not a door: dark (a torch, an ember), cold and food (clothing, cooked food), drops (climbing gear), creatures (a weapon, later). This page gives each a clock or a check it hangs on, so that Survival, Tailoring, Cooking and Climbing have a thing to move:

- **Cold** (Q8, open): the one body clock this map would add. Health is the only bar today and nothing drains by the clock (G32; `satiety_drain_per_min` is 0 since 11.10), so cold cannot sit "beside hunger": there is no hunger. [BODY_CLOCKS.md](BODY_CLOCKS.md) reads the big games' clocks against that and recommends a place clock (cold rises only in cold places, settles where worn warmth puts it, falls at a fire), with bonuses for a cooked meal and a night slept. Tailoring's `warmth_pct` moves where it settles, Survival's `cold_pct` how fast it gets there; a grade does nothing to it. The owner's call is Q8.
- **Dark**: the light rule in `params.light` as built; a torch is a hand-slot item with uses; `dark_sight` lengthens the player's own sight a little and never replaces the torch.
- **Drops**: the height layer (`levels`, DECISIONS 2026-10-25 "One height layer"); a crossing of the kind `rope` is walkable only with rope in the bag and `climb_reach` learned at the drop's depth.
- **Creatures**: combat, when it comes; until then they are hazards escaped (G34).

### 4.6 The check (added rows, proposed)

Every row of GROWTH 4.5, with these on top: every `xp_levels` table equals the formula within rounding; every node names a band its school has; a band's nodes are reachable (its `needs` sit in the same or a lower band); a school's main line costs at most `main_line_points_max` (20); a school's total nodes at most `nodes_max` (now 60, up from 12) and its branches at most `branches_max` (3); the whole tree's point cost is at least `tree_buyable_max_permille` over a maximum character's points; every rate effect is in the power cap's sum; every new effect name has a kernel reader (a static grep in the check: a name in content with no reader is red).

## 5. Gear: crafted weapons, armour and clothing on the map

### 5.1 The slots and the classes

Slots as built plus the back: `head, top, legs, outfit, feet, jewelry1, jewelry2, hand, back`. The hand holds a tool or, with combat, a weapon (G44; COMBAT 4.3); the back holds a bag or a quiver (the 23.10 bag answers); one base tool at the belt is free. Classes (the material grammar, extended as content): weapons `blade, blunt, spear, staff, bow, thrown`; armour `cloth, leather, mail, plate` on head/top/legs/feet; `outfit` the look layer over them; jewelry as built. Every class names the school that makes it: cloth from Tailoring, leather from Leatherwork, mail and plate from Smithing at the city's forge, bows and staves from Woodcraft, blades and blunt from Smithing (and the stone blade from Handcraft's Stonework, tier 1-2, as today).

### 5.2 Two axes of a made thing, kept, and a third

- **Tier** (how advanced; open-ended; `tier_min_level` and `craft_chance_bp` by tier as built): decides the cap of its worn effects (`wear_effect_max_pct` [5, 8, 12] and onward), its weight class, and, for a weapon, its reach and harm band (COMBAT fixes the numbers).
- **Rarity** (how often; the four of 9.10): the source's capacity. A rare material makes a rare thing; the rarity budget prices it (kernel review 8.2).
- **Quality** (proposed; the third axis, Skyrim's fine/superior/exquisite and Dimraeth's six): rolled at the craft, four steps, `plain, fine, true, master`. Quality moves the thing inside its tier's cap (a fine piece reaches more of `wear_effect_max_pct`; a master piece reaches all of it and may carry a second worn effect), never past it, so the power cap and the trader's day cap hold exactly as they do. Quality is the thing a school's node opens (5.3): without the family's `quality_pct` node every craft is plain.

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
- **Cross-links** (proposed, the one change to GROWTH's "same school only"): a node may carry `needs` across schools for a **bridge node**: Leatherwork's first branch needs Hunting's `harvest_yield`; Smithing's `alloy_read` needs Mining's `vein_sense`; Travel's Pack branch needs Handcraft's bag. At most `cross_links_max` (2) per school and never into a combat school from a trade (a smith need not fight). Cross-links are the edges that make the tree a graph the in-flight screen already draws, and they are the breadth pull in shape, as 3.4 is in points.
- **Books**: as GROWTH 3.7; the rarity budget prices them; a book for a bridge node teaches it without its cross-link.

## 7. Kernel shape (proposed; additive; integer; FORMAT_VERSION unchanged)

- `Player.xp` as built; `xp_levels` to twenty entries per profession, generated.
- `Player.respecs?: number`, `Player.books?: Id[]` (GROWTH 4.3); the body clocks' fields only if Q8 takes them (BODY_CLOCKS.md section 6).
- Group play (3.7, with presence): per player per span `own`, `share`, `bonus` by school, and a pair ledger `{ partner, day, active_ms }` for the pair schedule; the server's books, not the save.
- A node gains `band: 1..4 | 'crown'` and may gain `branch: Id` and cross-school `needs`; a school gains `branches: [{id, title}]` and `crown: Node`.
- A technique gains nothing here; its format is GROWTH 3.5 and COMBAT 4.3.
- Items gain `quality?: 'plain'|'fine'|'true'|'master'` on an instance (a stack of made things splits by quality the way it splits by tier), `guard_pct`, `quiet_wear` in `WORN_EFFECTS` when their schools land (`warmth` with Q8); `weapon?: {reach, harm_band, school}` with combat; `attrs?: Partial<Record<Attribute, number>>` and `req?: { school, level, attr? }` (5.6). A new read `attrTotal` (base + the active part of worn bonuses) for the verbs; `attrAt` stays the base for keys and requirements.
- Recipes gain `family: Id` (the quality node names a family, not a recipe).
- Quests gain `xp?: {school, seconds}` in the reward; characters gain `teaches?: {school, band_max}`.
- Actions: `unlearn` (6.3), `lesson` (3.6); `learn_node` checks the band; `craft` rolls quality.
- Params (`growth`): `t1_min_s` (25), `t1_max_s` (30), `catalogue_hours_min` (800), `band_size` (5), `slot_levels` re-spaced, `power_cap_step_permille`, `power_cap_max_permille`, `main_line_points_max`, `nodes_max`, `branches_max`, `cross_links_max`, `tree_buyable_max_permille`, `key_max`, `respec_free`, `respec_mg`, `quality_bp` by band, `attr_bonus_max` by tier and its step, `group_share_max_permille` (250), `mentor_bonus_pct` (20), `mentor_band_gap` (1), `mentor_reach_tiles` (12), `pair_full_min` (60); each with min, max and step (R12). The body clocks' params wait for Q8.
- The state machine of a node, per player: `locked` (band or key unmet) -> `open` (buyable) -> `learned` (always on, or in the shelf) -> `slotted` (in the build; techniques only) -> `learned` again on unequip -> `open` again on unlearn (never back to `locked` while its school's band holds). The screen draws these five states and no number.

## 8. Rule lines proposed, in the form GAME_RULES uses

Numbers provisional (P1 onward; the rules pull request assigns G numbers after G92 of GROWTH.md).

- **P1 Rise by use opens, points buy.** A school's level rises only with the active time of its own verb, on one curve whose ratio is the game's difficulty step; every level anywhere pays one point; a node is bought with points in a band the school's level has reached. Nothing else pays a level and nothing shortens one.
- **P2 The character level is read by three things.** The power cap, the slots and the forms of travel; never a quest, a price, a foe or a recipe. A quest that wants a capable player names a school's band or a key.
- **P3 A band gates nodes, never verbs.** No level, band or node walls an attempt, a recipe, a region or a door; a band says which nodes are for sale, a node says how well.
- **P4 The tree cannot be bought whole.** The catalogue's cost stays above what a character of the highest level could hold (the check's permille), so every character is a choice; a school's main line stays inside the points its own levels pay, so a specialist is never forced to wander.
- **P5 A made thing has a tier, a rarity and a quality.** The tier caps it, the rarity prices it, the quality moves it inside the cap; the quality roll is what a crafting node opens, and the attempt needs knowledge, a place and materials and never a node.
- **P6 Knowledge is found, skill is done, lessons are time.** Recipes above tier 1 and books come from the world; a teacher gives time at the ordinary rate and asks standing, never gold for a level; a quest pays a named school, bounded by its own active time and each player's.
- **P7 The long way is made ready, never unlocked.** Cold, dark, drops and creatures each hang on a clock or a check that gear and schools move; none is a door.
- **P8 A school grows by branches.** Past its second band a school forks; a main line never grows longer than twelve nodes; a thousand nodes is more branches as data, never a longer trunk.
- **P9 A cross-link is a bridge, not a wall.** A node may need a node of another school only as a bridge between trades, at most two per school, never from a trade into combat; a book teaches a bridge node without its link.
- **P10 Gear lends attributes, one tier ahead.** Worn gear adds attribute bonuses that rise with tier, with no fixed cap; each item names a school level and an attribute it asks, read on the base; below it the item helps up to what gear one tier above the wearer's own gives, and says what unlocks the rest. Gear never meets a key, and a look never carries a bonus.
- **P11 Help, never a carry.** Experience comes only from the player's own actions. In a group a newcomer gets at most a quarter of their own earned experience as a share of the group's and a fifth more of their own while a stronger player is near, both falling for the same pair over a real day; the veteran earns standing and the giving board, never experience; a carry sold for gold is an exploit loop.

## 9. Direction calls: seven answered, one open

Each is the owner's. Seven were answered on 25.10, one at a time; each answer is its own ✅ entry in DECISIONS of that day and is folded into the sections named. The options as asked are kept in the entries.

| Call | His word (25.10) | Where it landed |
|---|---|---|
| Q1 How long is "complete" | **C**: `t1` 25-30 s, 45-55 active hours a school, 800+ h in all (RuneScape's band). Default `t1` 28 s | 3.2 (the curve, why 28, the catalogue's check row) |
| Q2 Combat schools now or with the first foes | **B**: Strike, Aim and Guard reserved now (names, shapes, effect lists, slots; three closed spokes on the screen); nodes with the first foe | 4.2 |
| Q3 The hybrid or points alone | **A**: the hybrid as built, sized: rise-by-use opens, points buy | 1, 3.1-3.4, P1 |
| Q4 Respec | **B**: limited; one node at a time at a safe place, three free then gold; attribute pips never | 6.3 |
| Q5 Attribute pips after the opening | **B with gear**: pips bought with points to 5, and worn gear adds attribute bonuses on top, rising with tier, no fixed cap; the panel shows "Might 7 = 5 + 2 gear"; each item states a wear requirement, and below it counts up to one tier above the wearer's own; looks never carry a bonus | 5.6, 6.4, P10 |
| Q6 Quests pay a school | **A**: a named school, bounded by the quest's own active time | 3.6 |
| Q7 Teachers | **A**: time at the ordinary rate, standing earned, never gold for a level; and no industrial carry: own actions only, a share of at most a quarter of one's own, +20% near a stronger player, the veteran on the giving board, diminishing returns for a pair, sold carries an exploit loop | 3.6, 3.7, P6, P11 |

**Q8. The body clocks (open).** The owner, 25.10: align the body clocks with the big games; research and cross-check before deciding. The research, the cross table and the recommended set are [BODY_CLOCKS.md](BODY_CLOCKS.md); the call, as one question:

- **A** (**recommended**): cold only, and only in cold places (a cold climate, the south's heights, a snowy night): it settles where worn warmth puts it and falls at a fire, so dressing right once is the answer, not a meter to top up. Two bonuses for being well kept, never a penalty for not: Fed after a cooked meal (a higher health cap for a while) and Rested after a night slept at an inn, a tent or one's own fire (a little faster work through the day). No hunger, thirst or tiredness bar. This is what Skyrim and Fallout do outside their opt-in survival modes, and Valheim's shape inside a cold biome; it gives Tailoring, Survival and the warm meal their work and keeps G32.
- **B**: A, plus an opt-in hard mode per character with hunger and tiredness that drain while playing and their stage penalties (Skyrim's Survival Mode, Fallout 4's Survival, New Vegas Hardcore all make it a choice). Needs G32 and the forbidden pattern "Hunger clock" rewritten for that mode only, and a second balance for everything food and sleep touch.
- **C**: no clock at all; cold stays a hazard of place escaped by a fire, as the game is today. Clothing's warmth then has no work but a look and a small percentage, and Tailoring and Survival lose their reason in the south.

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
| A cold clock (Q8 open) | G32 "Health is the one bar"; the forbidden pattern "Hunger clock"; G28; "The night ruins are revived" (25.10: "cold and food on the long way") | extends (A) or conflicts (B) | A is a place clock: never in a safe place, never while away, settles by warmth, so no bar empties by the clock in the valley; B's opt-in drains need G32 rewritten for that mode. The first draft read "three clocks" (10.10) as body clocks; they are the game's time bases, and cold would run on the game hour (BODY_CLOCKS.md 7) |
| Clothing and a fire as the answer to cold | G34 "the answer is a run, never gear"; the forbidden pattern "Gear answer" | **conflicts** | declared: the 25.10 answer ("readiness is made": a torch, clothing, cooked food, climbing gear) already bent it for the long way; the rules pull request writes G34 as "a hunting hazard is answered by a run; a place's clock by readiness" |
| Survival's `fed_long` in place of `hunger_pct` | G32; "P-5c ... the hunger clock stops" (11.10) | agrees | the first draft's `hunger_pct` slowed a drain that is 0 |
| Drops crossed with rope and a node | "One height layer" (25.10); G68 crossings | extends | a `rope` crossing kind |
| Trade nodes move capacity, never a price | "Prices and gold" (10.10); R8; GROWTH 5.4 | agrees | `stall_slots`, `price_memory`; the band is untouched |
| Travel nodes past the first third of the school | "The world's structure" (23.10, item 7); W9; G64 | agrees | GROWTH 5.2 kept |
| Sixteen core-only schools; creators never add a school | GROWTH 3.1; CRAFTING_AUDIT D-CRAFT-4 (CR-7) | agrees | a later decision may open it; not this page |
| No percentage on the skill screen; five node states | "No percentages on screen" (decision 39); "The skill screen is a tree of wings" (23.10) | agrees | the states are words; the number is a long press |
| The tree screen sized for 1,000 nodes | the tree-foundations stream (in flight; a 300-node fixture) | extends | a target for that stream, not a change to it |
| A death leaves a pack; gear is a soft gate | "Open ends of the world plan ... a death leaves a pack" (23.10) | agrees | section 5.5 |
| Power never sold: no node, recipe, quality or lesson in a shop | "Crafting and money: power is never sold" (9.10); G39, G41 | agrees | the catalogue adds no exception |

Three conflicts, declared. The mentor's +20% (P11) against R6 is the owner's own word and stands as written. Clothing as the answer to cold against G34 waits on Q8 and follows the 25.10 readiness answer. The third is the cross-link (P9) against the 23.10 format's "same school only". It is proposed because the owner's vision ties everything to skills that unlock, and a tree whose schools never touch cannot express "the smith who learned the ore's grade in the mine"; the alternative (books only) makes every bridge a rare find, which is a slower and lonelier tree. If the owner keeps "same school only", P9 falls and the bridges become books; nothing else on this page moves.

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
13. **Warmth** (Skyrim's survival mode, The Long Dark, Valheim): read in full in BODY_CLOCKS.md; Q8.
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

## 12. The order, and what this page does not do

- Now: this page; the owner's answers Q1-Q7 (25.10, seven ✅ entries) folded in; Q8 open on BODY_CLOCKS.md; the tree-foundations stream reads the thousand-node target, the five node states and the three closed combat spokes (Q2); the mining and fishing stream reads the band form and the effect lists of 4.2 as the shape to land in, with the placeholder sizes of 23.10 until the content wave.
- Next (the growth format's build, GROWTH section 9 stage 3): `band`, the generated `xp_levels` at `t1` 25-30 with the catalogue-hours row, the power cap formula, the slot values, `unlearn`, the quality roll, the cross-link check row, gear's `attrs` and `req` with the stats panel's split total. One pull request per piece.
- With presence and groups (PRESENCE builds): the group rule of 3.7 and the giving board's count of help.
- With the first hand-made map and the city: Travel, Survival, Climbing, Tailoring, Woodcraft, Smithing, Remedies, Lore as schools with real nodes; the body clocks as Q8 decides; quests that pay a school; teachers.
- With combat (G35 lifted): Strike, Aim, Guard, Hunting's kills, Leatherwork, armour's worn effects, weapons in the hand.
- Not done here: any real node (the content wave writes them to this map); the numbers beyond their ranges (tuning in play); pets and companions (the Company school waits for its format); magic (⏸ 9.10); creators proposing nodes or schools; any screen.
- Pages this map touches when its rules pull request lands: GAME_RULES (P1-P9 after G92), GROWTH.md 3.6 and 4.5 (bands, cross-links, slot values), COMBAT.md 4.3 (the hand's weapon record), CRAFTING_AUDIT CR-10, CR-20, CR-21, CR-32 (closed by sections 3.5, 5.3, 5.4), NEXT 19 (the difficulty reckoning reads the band and the quest's school experience), the tree-foundations stream's size target.

## Sources

- The Elder Scrolls V: Skyrim (Bethesda, 2011): eighteen skills raised by use, perks gated by skill level and bought with one point per character level, skill books, trainers, tempering by perk, legendary skill resets; its survival mode's warmth.
- Fallout 3 and New Vegas (Bethesda, Obsidian): condition on weapons and armour, fixed-difficulty zones (New Vegas), experience from everything into one pool (the model set aside in Q3).
- Fallout 4 (Bethesda, 2015): one perk point per level, perks gated by attribute (SPECIAL) and level; the flat point rate.
- Old School RuneScape: skills to 99 by doing, quest experience lamps, no classes; the per-skill time scale this page stays short of.
- The Witcher 3 (CD Projekt Red, 2015), Dimraeth (2025), Path of Exile (2013): the build and its slots, the tree of wings, attributes as keys and books across the class, the passive tree as one picture (GROWTH.md Sources).
- Red Dead Redemption 2 (Rockstar, 2018): hunting that skins and harvests what is killed (DECISIONS 2026-10-25).
- Final Fantasy XIV (Square Enix): the mentor system and level sync, where a veteran beside a newcomer is rewarded with recognition; World of Warcraft (Blizzard): rested experience, the character sheet's base and bonus, and honour's diminishing returns for the same victim.
- Diablo II and IV (Blizzard), Elden Ring and Dark Souls (FromSoftware): equipment requirements by attribute; the Souls games' under-requirement wielding at a penalty, the softer form taken in 5.6.
- The body clocks' sources (Skyrim's Survival Mode, Fallout 4 and New Vegas, The Long Dark, Valheim, Red Dead Redemption 2, Don't Starve, Minecraft, Stardew Valley, Old School RuneScape) are listed in BODY_CLOCKS.md.
