# Materials: from the animal to the worn thing

**Status:** Proposed 30.10, written for the owner. The companion of GAP_RDR2.md: that page reads the reference game, this one lays the valley's own table. Of what this page proposes, the fields of section 1 (the five classes, the grade, `min_grade`) and the check rows marked "foundations" in 4.2 are code in the hunt foundations pull request (DECISIONS 2026-10-30); the rest is not built.

What this page is: the atlas of the animal materials (which animal gives which good, at which grade, tier and weight), how the goods are processed in short steps, how a material shapes the thing made from it, what a worn thing gives, and what each item needs drawn and moved. What it is not: no creature behaviour (that is [HUNTING.md](HUNTING.md)), no fight (COMBAT.md waits for G35), no price (a hunted good is priced by the hunt value source, HUNTING.md section 9, never by a number on an animal).

Where the facts come from: the schema and the content on `develop` are cited by path; HUNTING.md is on `develop` and is cited as "HUNTING n"; PROGRESSION.md and BODY_CLOCKS.md are cited as "PROGRESSION n" and "BODY_CLOCKS n" and are only in #333; the traveller's cap, the worked example of a creator's garment, is only in #402. Every number this page adds is marked proposed and sits inside the range the existing params give.

## 1. The grammar this page uses

What exists, in five lines:

1. **The class tree.** Every item names a `class`: one of the thirteen base classes of `schema/src/index.ts` (`BASE_CLASSES`; `animal` reads "feathers, wool, hide, bone") or the id of a class a creator declares under one (`ClassDef`: id, name, base). `family` is one open word, `tags` up to eight words, `tier` 1 to 20, `rarity` one of four, `weight` 0 to 20 (`ItemDef`).
2. **Templates.** A template's input names a class and a `min_tier` (and a `family` if it wants); the assembler turns it into one recipe per fitting combination, in id order, at most `template_max_recipes` (12 today, range 1 to 64) (`TemplateBody`, `ClassInput`; `tools/src/assemble.ts`). The recipe's title carries the picked inputs' names, its output stays the one item the template named: `content/core/templates/dye-cord.json` makes "Dyed cord (Herb)" and always `core/dyed-cord`.
3. **Chains of short steps.** A long recipe is a chain of intermediate items, one tier per station step, every action inside `max_action_ms` (15 s, range 8 to 30) (G43; DECISIONS 2026-10-09 "A long recipe is a chain of short steps"). An output is at most one tier above its highest input (G41; `tools/src/check.ts`). A miss keeps `craft_miss_keep_pct` of the inputs (50, range 25 to 90) and makes nothing else (G40).
4. **Stations and tiers.** Two stations, `fire` and `workshop` (`STATIONS`). The workshop slot climbs by upgrade: work stone tier 1, workbench 2, workshop 3 (`content/core/camp/*.json`). The world has opened three tiers (`open_tiers` 3), levels [1, 3, 6] by tier, a sure craft at tier 1 and 8000 / 6500 basis points at tiers 2 and 3 (`content/core/params.json`).
5. **Extension reach.** A creator may add items, classes under a base class, recipes, templates, resources, treasures, camps on an existing station and quests; never a verb, a station, a profession, an effect or a parameter (G45; DECISIONS 2026-10-09 "Extension reach"). So the racks of section 3 are core work, and everything else on this page is content.

What this page adds, each proposed and additive (no field removed, FORMAT_VERSION unchanged):

- **Five core classes under `animal`:** `core/meat`, `core/hide`, `core/bone`, `core/sinew`, `core/feather`, one `ClassDef` each, as HUNTING 6 asks ("one class each under the existing class tree"). The family of a good is the animal's word (`hare`, `roe`, `boar`); sinew and feather carry no family in this atlas, except the fowl's down (section 2).
- **A grade of a good is an item of its own.** The animal's quality (HUNTING 5: 1 to 3, read as a pose, never a number) becomes the grade of its goods. The plain good is one item; a finer grade is a second item that names it, `grade: { of: "core/hare-hide", step: 2 }` (step 2 or 3), with the plain good's class, kind and tier, worth exactly the plain one in the value table; a stack is one grade (`place_stack` 10 holds one kind a place, DECISIONS 2026-10-23). A kind's drops name the plain good only; the carcass's grade picks the item, and a grade nobody drew falls back to the plain one. Words on screen, never a number, the schema's three: the bare name at grade 1 (plain), "fine" at 2, "true" at 3: "hare hide, fine hare hide, true hare hide"; "boar meat, fine boar meat, true boar meat". Ids `core/hare-hide`, `core/hare-hide-fine` (step 2), `core/hare-hide-true` (step 3).
- **`min_grade` on a template input,** beside `min_tier`: "any hide of grade 2 or better".
- **`trait` on a garment,** one word from the closed list of BODY_CLOCKS 6.1 (`cold_proof`, `snow_shod`, `storm_proof`, `ice_grip`, `heat_ward`), as PROGRESSION 7 proposes the field.
- **`attrs` on a garment,** as PROGRESSION 5.6 proposes (`attrs: { might: 2 }` beside the worn effects, capped by `attr_bonus_max` per tier).
- **The fur state is a tag,** `fur`, on a hide that kept its hair (section 3), because the one `family` word is the animal's. Section 8 asks whether it should be a family instead.

## 2. The atlas

Rows are HUNTING 8's examples; young animals and pets are not prey (HUNTING 10) and have no row. Sizes follow HUNTING 6: a small carcass dresses in 6 think steps, a medium in 12, a large in 24; the foundations cut them in parts of six, one `dress` action a part, so a small animal is one action, a medium two, a large four, each inside `max_action_ms` (G43); the goods come with the last part, and what the bag cannot hold lies on the tile the player stands on. Goods follow BESTIARY.md where it names them; the hill sheep and the marmot are not in BESTIARY, so their goods are proposed. Tier of a good: 1 at d0, 2 at d1, 3 at d2 (proposed; `open_tiers` is 3, so the atlas fills the open ladder and nothing above it). Weight per unit (proposed, inside 0 to 20): raw hide 2, meat 1, bone 1, sinew 0, feather 0; the goods of a carcass taken whole fill 1 / 2 / 4 bag places by size (HUNTING 6: a place a part) and weigh their sum. The first station is where the raw good goes first (section 3). The goods per take are BESTIARY's counts and are not repeated here.

### 2.1 Ambient and flee (d0, and the d1 fleers)

| Animal | Size | Goods it gives | Tier | Weight per unit | First station | Where |
|---|---|---|---|---|---|---|
| Songbirds | small, not dressed | feather (a moult, from the ground) | 1 | 0 | workshop | d0 |
| Carrion crow | small, not dressed | feather (a moult; the meat is not eaten) | 1 | 0 | workshop | d0 |
| Field hare | small, 6 steps | meat, hide, bone: hare meat, hare hide, hare bone (good, fine) | 1 | 1 / 2 / 1 | fire; workshop | d0 |
| Ground fowl | small, 6 steps | meat, feather: fowl meat; fowl down, an item of class `core/feather` (family fowl, tag `down`, proposed), the fowl's one feather-class drop, since a kind drops each goods class once (the check) | 1 | 1 / 0 | fire; workshop | d0 |
| Roe deer | medium, 12 steps | meat, hide, bone, sinew: roe meat, roe hide, roe bone; sinew | 1 | 1 / 2 / 1 / 0 | fire; workshop | d0 to d1 |
| Hill sheep | medium, 12 steps | meat, hide (fleece on), bone, sinew (proposed) | 2 | 1 / 2 / 1 / 0 | fire; workshop | d1 |
| Highland goat | medium, 12 steps | meat, hide, bone, sinew: goat meat, goat hide, goat bone; sinew | 2 | 1 / 2 / 1 / 0 | fire; workshop | d1 |
| Marmot | small, 6 steps | meat, hide, bone (proposed) | 2 | 1 / 2 / 1 | fire; workshop | d1 |

The sheep's fleece is a fur-on hide of this atlas; the wool of BODY_CLOCKS 6.1 ("wool from the farm") is the farm's and not a hunted good. Fur, fat, horn and eggs come later with their animals (HUNTING 6); the boar's tusk, the wolf's fang and the cats' claws count as bone (BESTIARY.md).

### 2.2 Defend (d1)

| Animal | Size | Goods it gives | Tier | Weight per unit | First station | Where |
|---|---|---|---|---|---|---|
| Wild boar | medium, 12 steps | meat, hide, bone (the tusk): boar meat, boar hide, boar bone | 2 | 1 / 2 / 1 | fire; workshop | d1 |
| Dust adder | small, 6 steps | hide (scale), meat: adder hide, adder meat | 2 | 2 / 1 | workshop; fire | d1 |
| Wildcat | small, 6 steps | hide (fine fur), meat, bone (the claw): wildcat hide, meat, bone | 3 | 2 / 1 / 1 | workshop; fire | d2 |

The wildcat is written at danger 1 as BESTIARY_LANDS reads it (a small animal never hunts the player, the check; BESTIARY's "avoided" is a defender's bluff); it keeps BESTIARY's d2 ground and its goods stay tier 3. Until the fight is built a defender bluffs and is not taken (HUNTING 11, question 1), so these three rows are the atlas's second wave.

### 2.3 Hunt (d2)

| Animal | Size | Goods it gives | Tier | Weight per unit | First station | Where |
|---|---|---|---|---|---|---|
| Forest wolf | medium, 12 steps | hide, bone (the fang), meat: wolf hide, wolf bone, wolf meat | 3 | 2 / 1 / 1 | workshop; fire | d2 |
| White bear | large, 24 steps | meat, hide (thick fur), bone (the claw): bear meat, bear hide, bear bone | 3 | 1 / 2 / 1 | fire; workshop | d2 |

A hunter is a hazard until the fight lands (G34, G35; HUNTING 8 places hunters only with the fight or the pit trap), so the wolf and the bear wait longest.

Counted: 11 meat families, 10 hide families, 9 bone families, sinew, feather, and the fowl's down (a feather-class item of its own). At three grades that is 33 + 30 + 27 + 3 + 3 raw items and one ungraded down (a grade nobody drew falls back to the plain item): 97 raw items, all content.

## 3. Processing: the chain of short steps

Every step is one recipe or template, active for less than `max_action_ms` (15 s); the longest existing craft is 12 s (`content/core/recipes/fine-basket.json`). A wait on a rack is capacity, never paid time (R6), so the cure and the drying cost nothing and the active seconds are the hanging. A miss keeps 50% of the inputs by default (`craft_miss_keep_pct`). Status: **today** nothing of this exists; **content** means a recipe or template at the fire or the workshop, which a creator may add (G45); **core** means a new station, which only a core release brings (HUNTING 7, G45). The grade of the input is the grade of the output on every step, so a fine hide makes fine leather (proposed).

### 3.1 Meat

| Step | Station, tier | Active | Inputs | Output | Miss keeps | Status |
|---|---|---|---|---|---|---|
| Raw meat -> cooked meat | fire, 1 | 4 s (as `grilled-fish.json`) | 1 meat, 1 branch | cooked meat (a meal, by grade) | 50% | content |
| Raw meat -> dried meat | drying rack, 1 | 3 s to hang | 1 meat | dried meat, does not spoil | 50% | core (new station) |

Raw meat spoils in 3 game days, a raw hide must be scraped within 6, the cold highland doubles both (HUNTING 6); rain stops the rack while it falls (HUNTING 7). Raw meat heals a little, cooked more (HUNTING 6; G32), so `food.satiety` rises with the step and with the grade (proposed; the numbers are the dish wave's). Cooked and dried meat are one item per grade, not per animal (proposed): the family word is for dishes, which read the raw meat's tags (BODY_CLOCKS 7.3).

### 3.2 Hide

| Step | Station, tier | Active | Inputs | Output | Miss keeps | Status |
|---|---|---|---|---|---|---|
| Raw hide -> scraped hide | workshop, 1 (the work stone) | 6 s | 1 raw hide, 1 stone flakes | scraped hide, weight 1 | 50% | content |
| Scraped hide -> leather | tanning rack, 1 | 4 s to hang; cure about 5 game days | 1 scraped hide, 1 herb (the tannin) | leather, hair off, weight 1 | 50% | core (new station) |
| Scraped hide -> fur | tanning rack, 1 | 4 s to hang; the same cure | 1 scraped hide, 1 herb | fur, hair on, tag `fur`, weight 1 | 50% | core (new station) |

The scraper is `core/stone-flakes` spent as an input (it exists, tier 1), not a new tool kind: `TOOL_KINDS` is a closed list and a new kind is core-only. The tannin is `core/herb` until a bark item exists (proposed). Oiled or waxed leather, the `storm_proof` material of BODY_CLOCKS 6.1, waits for an oil or wax item; none exists today. The rack's tier follows the hide: a d1 hide cures on the same rack into tier-2 leather, because the step is sideways, not up (G41 allows an output below its input's tier plus one).

### 3.3 Bone

| Step | Station, tier | Active | Inputs | Output | Miss keeps | Status |
|---|---|---|---|---|---|---|
| Bone -> bone needle | workshop, 1 | 4 s | 1 bone, 1 stone flakes | bone needle (a component) | 50% | content |
| Bone -> bone hook | workshop, 1 | 4 s | 1 bone, 1 stone flakes | bone hook (the trout line, BESTIARY) | 50% | content |
| Bone -> bone handle | workshop, 1 | 3 s | 1 bone | bone handle (a tool's grip) | 50% | content |
| Bone -> bone beads | workshop, 2 (the workbench) | 5 s | 2 bone, 1 reed cord | bone beads (a jewelry input) | 50% | content |

A component carries no grade (proposed): the grade stops where the bone stops being bone. The tusk, fang and claw are bone of their animal's family, so beads of wolf fang are "wolf beads" by M4.

### 3.4 Sinew

| Step | Station, tier | Active | Inputs | Output | Miss keeps | Status |
|---|---|---|---|---|---|---|
| Sinew -> sinew thread | workshop, 1 | 3 s | 1 sinew | 2 sinew thread | 50% | content |
| Sinew thread -> sinew cord | workshop, 1 | 3 s (as `reed-cord.json`) | 2 sinew thread | 1 sinew cord | 50% | content |
| Sinew cord -> bow string | workshop, 2 | 5 s | 2 sinew cord | 1 bow string (the T4 bow's, HUNTING 5) | 50% | content |

Sinew cord is the second cord of the snare (HUNTING 5: "fibre cord first, sinew cord later"), so a snare template names `class: fibre` or `core/sinew` and both fit.

### 3.5 Feather

| Step | Station, tier | Active | Inputs | Output | Miss keeps | Status |
|---|---|---|---|---|---|---|
| Feather -> fletching | workshop, 1 | 3 s | 3 feather | 1 fletching (the T4 bow's, HUNTING 5) | 50% | content |
| Down -> lining | workshop, 1 | 4 s | 4 down | 1 lining (a `cold_proof` material) | 50% | content |

### 3.6 What spoils, and what the step ends

| Good | Spoils in | In the cold highland | The step that ends it |
|---|---|---|---|
| Raw meat | 3 game days (HUNTING 6) | 6 | cooking at the fire, or the drying rack |
| Raw hide | 6 game days to scrape (HUNTING 6) | 12 | scraping at the work stone |
| Scraped hide | does not spoil (proposed) | | the cure |
| Bone, sinew, feather, down | never (proposed) | | |
| Cooked meat | never (proposed): a meal, as `grilled-fish.json` | | |

A spoiled good is gone from the bag with a line, never a hurt (G30 keeps the valley safe; a bad food that hurts is `food.hurt` and not this). The carcass left on its tile draws crows after 30 steps (HUNTING 6); a player who takes it all has three game days to reach a fire. Nothing runs while away (G28), so the clock counts played time only (proposed).

## 4. Combining: how a material shapes the made thing

Proposed, in the form GAME_RULES.md uses; numbers provisional until the rules pull request gives them G numbers.

- **M1 A recipe names classes, so any hide works.** A garment template asks `class: core/hide` (or `animal`), a `min_tier` and a `min_grade`; every hide of the atlas and every hide a creator adds later fits it (G45; `ClassInput`).
- **M2 The made thing's rarity is its rarest material's.** As the check computes rarity from the inputs today (`computedRarity`, `tools/src/check.ts`) and as PROGRESSION 5.2 states it: a rare hide makes a rare thing, and common things are plain (PROGRESSION 5.7: one effect at most, at the smallest step).
- **M3 Its tier is at most one above its highest input.** The check rule as it stands (G41; `tools/src/check.ts`): a d0 hide (tier 1) makes a tier-1 or tier-2 thing, never tier 3.
- **M4 The leading material names the thing.** The first input of class `core/hide`, `core/bone`, `core/sinew` or `core/feather` is the leading material; the made thing takes its family word in its name and its look variant: one template, "hide boots", makes "hare-hide boots" and "roe-hide boots". Proposed as an assembler feature: the output item is made per leading family (the assembler already titles the recipe by the picked inputs, `tools/src/assemble.ts`; today the output is one fixed item). The look variant is the family's ramp on one drawing (section 6).
- **M5 Grade moves the thing inside its tier's cap, as quality does.** PROGRESSION 5.2 rolls `plain, fine, true, master` at the craft, inside `wear_effect_max_pct` and never past it, and only once the family's quality node is learned (5.3). Proposed: the leading material's grade adds `grade_quality_bp` to that roll (500 a grade above 1, a param with min 0, max 2000, step 100), so fine hide makes a fine piece more often. Without the node every craft stays plain, grade or not.
- **M6 A trait comes from the material.** A garment's one trait (BODY_CLOCKS 6.1) is set by its leading material, not written per recipe (proposed, section 8 asks): fur (tag `fur`) or a down lining -> `cold_proof`; leather on the feet, cut high -> `snow_shod`; oiled or waxed leather -> `storm_proof` (waits for the oil item). `ice_grip` and `heat_ward` are stone, iron, linen and reed and not this atlas's. Strength by tier as BODY_CLOCKS 6.2: 1 at tiers 1 to 2, 2 at 3 to 4, 3 at 5; a common piece with a trait carries nothing else (PROGRESSION 5.7).
- **M7 Weight never grows.** A made thing weighs at most the sum of its inputs' weights, in the schema's whole numbers (0 for a herb, 1 most things, 3 a log; DECISIONS 2026-10-23); a processing step may lose weight (a raw hide 2, its leather 1) and never gain.
- **M8 A full set of one leading material gives the set bonus.** As built: every piece of a set worn, effects grow by `wear_set_bonus_pct` (20, range 0 to 50; `Wear.set`, `checkWear` G44). A set is one family: "roe-hide hood, roe-hide jerkin, roe-hide boots".

### 4.1 A worked example: two hares to a hood

A fire and a work stone stand; the tanning rack is built (core).

1. **The take.** Two field hares at d0, small, unaware, each by a thrown stone (HUNTING 5, T0). Each dresses in one `dress` action of 6 steps (a small animal is one part) and gives 1 hare meat, 1 hare hide, 1 hare bone (BESTIARY.md); the animals' quality was 2, so the goods are "fine hare hide" (grade 2, the step-2 item). The hare gives no sinew, so the thread comes from a roe deer taken earlier. Bag: 2 hides (weight 4), 2 meat (2), 2 bone (2), 1 sinew (0).
2. **Scraping,** work stone, 6 s each, 1 stone flakes each: 2 fine scraped hare hides, weight 1 each. Within 6 game days of the take.
3. **The cure,** tanning rack, 4 s to hang each with 1 herb, about 5 game days: either 2 fine hare leather (hair off) or 2 fine hare fur (tag `fur`).
4. **The thread,** work stone, 3 s: 1 sinew -> 2 sinew thread.
5. **The hood,** workshop tier 1, template "hide hood" (`class: core/hide, min_tier 1, min_grade 1, qty 2` and `core/sinew-thread, qty 1`), active 6 s (as `reed-hat.json`), known from the start. The leading material is the hide, so the output is "hare-hide hood" (M4), tier 1 (M3), common (M2), weight 2 (M7: 1 + 1 + 0). The grade-2 input adds 500 bp to the quality roll once the family's node is learned; before it the hood is plain (M5).
   - **From leather:** head slot, one worn effect inside tier 1's cap, `gather_speed_pct` 5 (`wear_effect_max_pct[0]`), as `core/light-cloak` carries today. No trait.
   - **From fur:** head slot, `cold_proof` at strength 1 (BODY_CLOCKS 6.1 puts `cold_proof` on head, top and back), and nothing else, because a common piece carries one effect and a trait counts as one (PROGRESSION 5.7). In calm snow (grade 1) it takes the frost to nothing (BODY_CLOCKS 6.2).
6. **The trader.** The hood is a made good: the trader pays at most `k_craft_permille` (750) of r times V and charges at least r times V (R8, `docs/kernel-review-v1.md`; `content/core/params.json`). Its V comes from the solver's fifth source, `hunt`, which the foundations add: a hunted kind priced at the solver's medium effort tier by its take and its dressing, no number on the animal (HUNTING 9; `kernel/src/values.ts`). The raw hides themselves have no price anywhere: `salePrice` returns nothing for a good of the hunt and the sale refuses it. Before the foundations land the hides have no value at all and the check refuses the chain, which is the right order.

### 4.2 The check rows the rules ask for

What `pnpm check` prints or would print, one error line each, in the form HUNTING 12 and PROGRESSION 4.6 use. "Foundations" marks a row that is code in the hunt foundations pull request (`checkHunt`, `tools/src/check.ts`); the rest is proposed and its field names are the schema's to fix:

- Foundations: `x map.creatures.kinds.<id>.hunt.drops.<n>.item: <item> is not a good: a drop is meat, hide, bone, sinew or feather (HUNTING 6, G45)`, and the same slot for a second drop of a goods class the kind already drops (`<item> is a second hide: each good once`: each goods class once per kind), a grade named as a drop, a tier above the animal's, or no item.
- Foundations: `x params.hunt.dress_step_ms: a part of the dressing is 6 steps and one action: keep 6 x dress_step_ms within max_action_ms (G43)`; `x params.hunt.meat_spoil_d: the meat goes before the rest: keep meat_spoil_d at or under hide_spoil_d (HUNTING 6)`.
- Foundations: `x items.<id>.grade.of: <plain> is a grade itself: point at the plain good`; `x items.<id>.grade: a grade keeps the plain good's class, kind and tier (<plain>)`; `x items.<id>.grade.step: <twin> is already grade <n> of <plain>`. The schema bounds the step to 2 or 3 and `min_grade` the same.
- Foundations: `x shop.sells.<n>: <item> is sold: no good of the hunt carries a price (HUNTING 9)`; the kernel's `salePrice` returns nothing for a good of the hunt, so the trader's list, the item detail, the wealth board and an opening's worth agree, `sell` refuses it ("Nobody buys that raw: make something of it."), and the value table prices every good through the `hunt` source or not at all.
- `x item.<id>: a class under animal that is not meat, hide, bone, sinew or feather (MATERIALS 1, HUNTING 6)`
- `x template.<id>.inputs: min_grade on an input that is not a good (MATERIALS 1)`
- `x item.<id>.wear: a trait not in the closed list, two traits, or a trait on a look (BODY_CLOCKS 6, MATERIALS M6)`
- `x item.<id>.wear: a common piece with a trait and an effect (PROGRESSION 5.7)`
- `x recipe.<id>: an output heavier than the sum of its inputs (MATERIALS M7)`
- `x station.<id>: a drying or tanning rack from an extension; a new station is core-only (G45)` (HUNTING 12's row, repeated here so the two pages agree)

## 5. What a worn thing gives

| Axis | Status | Where it lives | On screen |
|---|---|---|---|
| Weight | built | `ItemDef.weight`; limit 30 + 10 a might point; three paces (DECISIONS 2026-10-23) | the pace, never a number |
| Worn effects | built | `Wear.effects`: five work rates, capped by tier (`wear_effect_max_pct` [5, 8, 12]), two at most | a percent per effect |
| Set bonus | built | `Wear.set`; `wear_set_bonus_pct` 20 | the set's name |
| Look layer | built | `Wear.look`: shows, counts for nothing; `premium_later` only on a look (G39) | the drawing |
| Bag places, load bonus | built | `Wear.places`, `Wear.load_bonus`: a bag on the back only | places count |
| Trait, in words | proposed (#333) | `trait` from BODY_CLOCKS 6.1; strength by tier (6.2) | "keeps the cold off", a word, never a number |
| Attribute bonus, soft requirement | proposed, owner-answered (#333) | `attrs`, `req` of PROGRESSION 5.6; `attr_bonus_max` by tier | "Might 7 = 5 + 2 gear" |
| Protection, guard | waits for G35 | `guard_pct` named in PROGRESSION 7 and 5.4; COMBAT.md owns it | nothing until the fight |
| Durability | built for tools; never for armour | `tool.uses` wears by use; armour and clothing never wear out (PROGRESSION 5.4; DECISIONS 2026-10-09) | uses left on a tool |

Plainly: there is no warmth number and no protection number on the screen. A garment's answer to a harsh place is a word and a strength from a closed ladder ("there is no warmth number", BODY_CLOCKS 6.2); a fight's bars print no number (DECISIONS 2026-10-23, combat round 3); an animal's quality is a pose (HUNTING 5). Words and scales only.

## 6. Pictures

Every item is a 64 px icon on the kit grid (PRODUCTION_LINE.md; `density: 4`), drawn with at most four ramps a sprite (the kit's `ramps`, `maxItems: 4`, `schema/src/index.ts`; PRODUCTION_LINE.md "at most four shared ramps"). The rule of this page's count: one icon per item per grade, as the brief asks; the saving column reuses one icon across the three grades (the word on screen tells the grade; the kit reuses icons already, CRAFTING_AUDIT.md wave 3, CR-30).

| Group (shared ramps) | Items | Icons, one per grade | Icons, grades shared |
|---|---|---|---|
| Raw meat: a red ramp, a fat ramp, the ground shadow | 11 families x 3 | 33 | 11 |
| Raw hide: a tan ramp plus the animal's coat ramp | 10 families x 3 | 30 | 10 |
| Bone: a bone ramp, a shadow | 9 families x 3 | 27 | 9 |
| Sinew, feather, down: a pale ramp | 3 + 3 + 1 | 7 | 3 |
| Cooked and dried meat | 2 x 3 | 6 | 2 |
| Scraped hide, leather, fur: tan, the coat ramp, a wood edge | 3 x 10 x 3 | 90 | 30 |
| Bone components: needle, hook, handle, beads | 4 | 4 | 4 |
| Sinew thread, cord, bow string; fletching, lining | 5 | 5 | 5 |
| The carcass as a prop: small, medium, large | 3 | 3 | 3 |
| The racks as props: drying rack, tanning rack | 2 | 2 | 2 |
| Garments: hood, jerkin, boots, cloak, in leather and in fur | 4 x 2 | 8 | 8 |
| **Total** | | **215** | **87** |

The family changes the coat ramp on one drawing, not the drawing (proposed): a "hare-hide hood" and a "roe-hide hood" are one hood picture under two ramps, so the garment count stays 8 whatever the atlas grows to. The racks and the carcasses are props in the place's ramps (PLACE_LOOK.md).

The route: `pnpm kit:gen` on the `kaggle` route with `KAGGLE_MODEL=qwen`, from the sentence alone (DRAWERS.md: 93 to 112 s a picture on the free GPU, 29 of 30 draws the right object); waves of 12 through `pnpm art:wave <pool> --size 12` (PRODUCTION_LINE.md, step 4), a wave of N costing about 5 + 1.8 N GPU minutes; the owner picks; one pull request per wave of picks with its `Source:` line (the drafts' route and recipe) and a phone still. At 87 icons that is 8 waves and about 3 GPU hours; at 215 it is 18 waves. The pools get a `materials` pool seeded from section 2 (proposed).

Not drawn: nothing on the body. A worn thing shows on the character only at stage 6 (DECISIONS 2026-10-09 "The upgrade", retry line), so the hood is an icon and a wardrobe row until then. No blood: a take is a fade and a drop of goods, the carcass prop is a still shape, and the dressing shows the kneeling body and the knife, never the cut (HUNTING 10).

## 7. Movement

The clip tool (`tools/anim/README.md`) retargets a library clip onto a 3D body and renders it at a 50 degree camera into a sprite strip; the props it builds in `blender/render.py` are `hatchet`, `pick`, `torch`, `trowel`, `crate`, `seedbag`, `sprig`, `berries`. The library's clip lengths are in `tools/anim/libraries.json`: `Fixing_Kneeling` 124.8 frames, `Interact` 48, `PickUp_Table` 20. The budget: a work action is 4 poses (ANIMATION.md section 2, "2 now, 4 target"); a quadruped idle 4 / walk 4 / run 4 / hurt 2 / death 4, attack 4 when it bites (ANIMATION.md 5.2); a bird flap 4 / idle 2 / hurt 1 / death 2. The owner's pick of 29.10: four poses a loop at least, rendered; the code layer sits on top of real poses and never instead (DECISIONS 2026-10-29 "Movement").

| Gesture | Library clip nearest | New prop | Poses | Views (3) | Where it shows |
|---|---|---|---|---|---|
| Dressing a carcass | `Fixing_Kneeling` | knife (new in `render.py`) | 4 | 12 frames | kneeling at the carcass on its tile, 6 / 12 / 24 steps in one, two or four actions |
| Scraping a hide | `Interact`, a push-pull loop | none: `trowel` stands in for the flakes | 4 | 12 frames | at the work stone, 6 s |
| Stitching | `Interact`, standing | none: a needle is under a pixel at 64 px | 4 | 12 frames | at the workshop, 6 s |
| Hanging a hide or meat on a rack | `PickUp_Table`, then `Interact` | a hide sheet (new) | 2 to 4 | 6 to 12 frames | at either rack, 3 to 4 s |
| A quadruped's own loops | the body's own actions (`map: native`) | none | 4 / 4 / 4 / 2 / 4 (+ 4) | 54, 66 with a bite | hare, roe, sheep, goat, marmot, boar, wolf, wildcat, bear |
| A bird's own loops | the body's own actions | none | 4 / 2 / 1 / 2 | 27 | songbirds, crow, ground fowl |
| The adder (proposed budget) | its own body, a coil and a strike | none | idle 4, strike 4, hurt 2, death 4 | 42 | d1 rocks |

What each costs: a work gesture is 12 frames and reuses the human body, so it is a clip file, a render and `pnpm anim check` (palette, outline, silhouette, no foot slide). An animal costs a rigged body with its own actions first: the wolf has one (ANIMATION.md 5.4, the Meshy wolf), the other eleven do not, and the library is a human skeleton (`tools/anim/README.md`), so a quadruped is never retargeted from it. The animal count is HUNTING's and BESTIARY's; this page only states the sheet each one owes.

## 8. Open points for the owner

Each one sentence, with the default this page is written on.

1. **Grade words and shape.** Default: the schema's words, plain (the bare name) / "fine" / "true", and grade as three items per good (97 raw items); the alternative is a grade on the instance, as PROGRESSION 7 proposes for quality, which makes the same atlas about 35 raw items and keeps every template under the bound of 12.
2. **Fur-on against fur-off.** Default: one family (the animal) and the tag `fur` on a hide that kept its hair; the alternative is two families, which loses the animal's word in the name.
3. **The leading-material name.** Default: a template feature (one "hide hood" template, an output per leading family, and `template_max_recipes` raised to 64, the top of its range); the alternative is a recipe per family with the bound untouched, ten recipes a garment.
4. **Where a trait comes from.** Default: from the material (fur -> `cold_proof`, M6), so a creator's new fur garment keeps the cold off without a line; the alternative is a trait written per recipe, as BODY_CLOCKS 6.2 reads it ("set by its recipe, or added at the bench").
5. **The racks.** Default: one core pull request for both racks (one station kind `rack` with two camp parts, as the workshop slot climbs by parts); the alternative is two stations, `drying_rack` and `tanning_rack`, in two pull requests.

## Sources

- [HUNTING.md](HUNTING.md), on `develop` (sections 5, 6, 7, 8, 9, 10, 11).
- #333: docs/design/PROGRESSION.md (4.5, 5.1 to 5.7, 7, 8); docs/design/BODY_CLOCKS.md (6.1, 6.2, 7.3).
- #402: `travellers-cap.json`, a recipe in a creator's extension (a creator's garment: item, recipe, kit picture).
- `schema/src/index.ts`: `BASE_CLASSES`, `ClassDef`, `ItemDef`, `Wear`, `WORN_EFFECTS`, `TOOL_KINDS`, `STATIONS`, `RecipeBody`, `ClassInput`, `TemplateBody`, the kit's `ramps`.
- `content/core/params.json`: `max_action_ms`, `template_max_recipes`, `open_tiers`, `tier_min_level`, `wear_effect_max_pct`, `craft_chance_bp`, `craft_miss_keep_pct`, `wear_set_bonus_pct`, `k_craft_permille`, `load`, `place_stack`.
- `content/core/items/*.json`, `content/core/recipes/*.json`, `content/core/templates/dye-cord.json`, `content/core/camp/*.json`.
- `tools/src/check.ts` (the tier rule, `computedRarity`); `tools/src/assemble.ts` (template ids and titles).
- docs/design/CRAFTING_AUDIT.md (sections 5, 6; appendix A); docs/design/GAME_RULES.md (G32, G34, G35, G38 to G46); docs/design/BESTIARY.md; docs/design/COMBAT.md; docs/design/ANIMATION.md (2, 5.2, 5.4); docs/kernel-review-v1.md (R6, R8).
- DECISIONS.md: 2026-10-09 (the material grammar, two ladders, a long recipe, the upgrade, the workshop's tools, metal, extension reach); 2026-10-22 (start outfit, decision 42); 2026-10-23 (weight and the three paces; combat round 3); 2026-10-29 (movement).
- docs/art/DRAWERS.md, docs/art/PRODUCTION_LINE.md, docs/art/PLACE_LOOK.md; tools/anim/README.md, tools/anim/libraries.json.
