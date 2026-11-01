# Clothing: worn gear that is not a weapon: cloth, leather, fur, reed, and the look layer (2026-10-31)

Status: Proposed 31.10 by an outside developer. Nothing here is built; the build list in the appendix is what the wave's pull requests build, each on the owner's merge.

**What it does not change.** The nine places on the body stay as built (kernel/src/state.ts:51-63); a new place for the hands waits for the owner (question 1). The five worn effects (schema/src/index.ts:160), their cap by tier `wear_effect_max_pct` [5, 8, 12] (content/core/params.json:128), the set bonus `wear_set_bonus_pct` 20 (:133) and the power cap table of 14 entries (:66-80) stay as they are. G44 holds: worn things help work, a little, through the one calculator, and nothing raises a craft's output (R9). The look layer still shows and counts for nothing (DECISIONS 2026-10-09 "The upgrade: work clothes with a small capped bonus, and a look layer on the same slots"). Jewelry stays as built. The race outfits of decision 42 are untouched (DECISIONS 2026-10-22 "Start outfit: three slot items over the bare body, no weapon"): no race's `outfit` gains a piece here, so the wave adds nothing to what a loaded save is handed. The adapter gives a race's outfit piece once, to a save that never held it, and never again after it was sold or dropped, since the journal keeps it (kernel/src/adapt.ts:40-50; kernel/test/adapt.test.ts:47, #495). No tier above `open_tiers` 3 (content/core/params.json:88), no metal (DECISIONS 2026-10-09 "Metal: the grammar is ready, the content waits for its discovery"; G45), no new station and no new profession: the pieces are Handcraft's, sorted by a recipe `family`. Garment traits and attribute bonuses get designs and per-piece plans here, but no content, because nothing reads them yet (section 7). The value lock is not touched (CONTRIBUTING.md:35). Clothing never wears out (EQUIPMENT 3.4). The weapon in the hand is WEAPONS.md's; stone, ochre and metal are QUARRYING.md's; the stone studs are this page's (section 7.6).

## 1. Scope and words

- **A piece** is an item with a `wear` block on a garment place: `head`, `top`, `legs`, `outfit`, `feet` (EQUIPMENT 3.2). Bags on the back are pieces too, as built (`places`, `load_bonus`). Jewelry and the held hand are outside this page.
- **The work layer** is what helps; **the look layer** is what shows (kernel/src/step.ts:1366-1390, `s.player.worn` and `s.player.looks`). A worn piece stays in the bag: it takes no place there, but its weight counts (schema/src/index.ts:165-202, the `Wear` description; kernel/src/load.ts:21-26).
- **Class** says what a piece is made of; an item's **family** is a group inside it (schema/src/index.ts:212, ItemDef `family`): for a hide and a garment, its leading animal or material (section 3). A recipe's **family** (proposed, section 6; a Word, conflict 16) says which craft inside a school makes it.
- **Tier** is how advanced; **rarity** is how often (G41; DECISIONS 2026-10-09 "Two ladders: an open-ended tier for how advanced, the four rarities for how often").

## 2. The places as built, and the hands question

| Place | Takes | As built |
|---|---|---|
| `head` | a hat, a hood, a cap | reed hat (tier 2) |
| `top` | a jerkin, a coat, a cloak | work clothes, light cloak (tier 1) |
| `legs` | leggings, breeches | nothing yet |
| `outfit` | one piece over the top and the legs; wearing it takes them off, and a top or legs takes it off (kernel/src/step.ts:1381) | nothing yet |
| `feet` | shoes, boots | reed sandals (tier 2); work boots and sandals as looks |
| `jewelry1`, `jewelry2` | jewelry, as built | herb pouch, remnant amulet, lucky charm |
| `hand` | one tool (tools/src/check.ts:497-498); with combat a tool or a weapon (WEAPONS 1) | rust pick, work hammer, walking staff |
| `back` | one bag or one quiver (DECISIONS 2026-10-23 "Bags on the back: 12, a satchel 24, a frame pack 36") | satchel, frame pack |

The schema names eight places (`jewelry` covers two; schema/src/index.ts:153) and the kernel nine (kernel/src/state.ts:51). The kit panel labels them in English (game/src/ui/panels.ts:105-115).

**The hands question.** Three written rules ask for something on the hands that is not the held tool, and two lists leave it out:
1. Decision 3 lists the upgrade places as "legs, torso, hands, jewellery, head, feet, weapon, tool" (DECISIONS 2026-10-22 "Characters are redesigned (decision 3 of 22.10)").
2. Balance finding 5, accepted 26.10, lets `ice_grip` sit on "the feet and the hands" (DECISIONS 2026-10-25 "Balance prover finding 5: deep snow and ice are both answered only on the feet"; BODY_CLOCKS 6.1: "crampons on the feet, claws in the hands").
3. G44's text lists the places as "A hat, a top, trousers or one full outfit, shoes, two pieces of jewelry and the tool in hand" (docs/design/GAME_RULES.md:508-509), with no gloves; its check row allows nothing but a tool in the hand (GAME_RULES section 8, G44 row; tools/src/check.ts:497-498); EQUIPMENT 3.2 says the hand takes "one tool or one weapon", never clothing. The upgrade entry's own list (DECISIONS.md:345, "a hat, a top, trousers or one full outfit that takes both, shoes, two pieces of jewelry, and the tool in hand") is already superseded in part by decision 3 (DECISIONS 2026-10-23 "Bookkeeping from the decisions audit: corrections to older entries").

The proposal (question 1, default A): a tenth place, `hands`, a garment place labelled "Gloves", beside the held `hand`. Gloves are clothing (worn effects, a trait, never wear); the hand keeps the tool. It costs one entry in `WORN_SLOTS`, `WEAR_SLOTS`, `SLOTS_OF` and `SLOT_LABEL`, and one kernel version step; a save needs no change (the worn record is keyed by place). Under A the rules pull request adds gloves to G44's list and a DECISIONS line records the tenth place (conflict 8). The equipment foundations pull request lists `ice_grip` on the feet only; the feet are the start under every answer, and the hands join with the place (conflict 17). No gloves are built in this wave.

## 3. Classes and families

| Class (proposed unless marked) | Base | What it is | Item families | In this wave |
|---|---|---|---|---|
| `garment` (built) | base | worn clothes (schema/src/index.ts:100-108) | none | the built pieces stay in it, except the reed pair (below) |
| `core/leather` | garment | a piece cut from tanned hide, hair off | the animal: `hare`, `roe` | 7 pieces, with the take verb (section 6) |
| `core/fur` | garment | a piece cut from tanned hide, hair on | the animal: `hare` | 2 pieces, with the take verb (section 6) |
| `core/reedwork` | garment | a piece woven from reed cord and mat | `reed` | the reed coat; the reed hat and sandals move here |
| `core/cloth` | garment | a piece from spun fibre: wool, linen, felt | the fibre | waits (question 4) |
| `core/mail`, `core/plate` | garment | metal over a leather base | the metal | wait for metal (section 5) |

Every rule written for `garment` holds for these (schema/src/index.ts:273-284, ClassDef: "Every rule written for the base class holds for it"), so checkWear's place rule (tools/src/check.ts:497-503) and G44's cap apply unchanged.

The materials keep the goods' classes (content/core/items/goods.json): every stage of a hide stays `core/hide`, with the animal as its `family` (`hare`, `roe`, `wolf`) and the stage as a tag (`scraped`, `tanned`, `fur`, `boiled`). The built raw hides carry no family today (goods.json:57-65, :93-101, and the wolf hide from :126), so this wave gives them theirs with the take verb (section 6), an item edit that moves no value (kernel/src/values.ts reads neither class nor family). Sinew thread stays `core/sinew` with no family ("sinew and feather carry no family in this atlas", docs/design/MATERIALS.md:21, #432). So a later garment template can ask `class: core/hide` and every animal fits (MATERIALS M1, #432, proposed), and the hide stays "the animal's" for its name and colour (sections 9 and 10). A garment carries its leading animal or material as its family too, so a set can be held to one family (section 8, M8). A template cannot yet filter by tag (schema/src/index.ts:460-471, `ClassInput`: class, family, tier, grade), so templates over tanned hide wait with M4 (Waits). Plain recipes name their inputs by id and need no filter.

**What the land allows.** The valley has reed (content/core/resources/reed-bank.json), the night's moonreed (content/core/resources/moon-reeds.json, hours 20 to 24, used today only by a quest), and the hides of the hare and the roe (content/core/map.json, `creatures`: 8 hare spots, 5 roe spots, 0 wolf spots, of 34 since #503). It has no fields and no forge (DECISIONS 2026-10-22 "Making in the neutral valley (decision 51 of 22.10)"), so no flax, no linen and no farm wool; the hill sheep's fleece is a hunted fur-on hide of the atlas, not wool (MATERIALS 2.1). Felt needs wool. So this wave's cloth is reed; wool, linen and felt wait for the land that gives them (question 4), and fine clothes wait for the town's tiers (DECISIONS 2026-10-07 "Era themes and fine clothes postponed to town progression tiers", paused).

## 4. The chains

Every step is short (G43: at most `max_action_ms` 15000, content/core/params.json:34), at the workshop, under Handcraft (section 6).

### 4.1 Fibre to cord to cloth (built, extended)

| Step | Active | Inputs | Output | Tier | Status |
|---|---|---|---|---|---|
| reed cord | 3 s | 2 reed | 1 reed cord | 1 | built, content/core/recipes/reed-cord.json |
| woven mat | 6 s | 3 reed cord | 1 woven mat | 2 | built, content/core/recipes/woven-mat.json |
| dyed cord | 4 s | 2 berries (class plant, family berry), 1 reed cord | 1 dyed cord | 2 | built template, content/core/templates/dye-cord.json |
| reed hat, reed sandals | 6 s, 5 s | dyed cord and 2 cords; 3 cords | the reed-walker pair | 2 | built |
| woven reed coat | 7 s (proposed) | 1 woven mat, 1 dyed cord | 1 coat | 3 | this wave |

Spun cloth (fibre to thread to cloth) has no fibre plant to start from; it waits (question 4).

### 4.2 Hide to scraped hide to leather, and fur

| Step | Active | Inputs | Output | Tier | Status |
|---|---|---|---|---|---|
| dress the carcass | 6 steps a part | a hunted hare or roe | hare hide; roe hide and 2 roe sinew | 1 | built, kernel/src/hunt.ts:14, :36-38; content/core/map.json kinds |
| scrape | 6 s (MATERIALS 3.2) | 1 hide, 1 stone flakes | 1 scraped hide | 1 | this wave |
| tan, hair off | 4 s (MATERIALS 3.2) | 1 scraped hide, 1 herb | 1 leather | 1 | this wave, at the workshop (conflict 6) |
| tan, hair on | 4 s | 1 scraped hare hide, 1 herb | 1 hare fur (tag `fur`) | 1 | this wave |
| sinew thread | 3 s (MATERIALS 3.4) | 1 roe sinew | 2 sinew thread | 1 | this wave, owned here; WEAPONS 5.4 builds its cord and string on it |
| boil | 5 s (proposed) | 1 roe leather, 1 branch | 1 boiled leather | 2 | this wave, `known: found` |

Every step after the dressing lands with the take verb, since nothing lays a carcass in play yet (section 6, "Before the take verb"). The scraper is `core/stone-flakes` spent as an input, not a tool kind (MATERIALS 3.2; `TOOL_KINDS` is closed). The tannin is `core/herb` until a bark exists. Roe fur is not made: one fur animal keeps the variants down until M4. A hide is taken from the carcass before `hide_spoil_d` (kernel/src/hunt.ts:62-64); a hide in the bag never spoils as built (MATERIALS 3.6 proposes a bag clock; Waits).

**The rules every step meets** (MATERIALS M1-M8, #432, proposed, as this wave applies them):
- M1 any hide fits a class input: kept for later templates; this wave names inputs by id.
- M2 a made thing's rarity is its rarest material's: the check computes it (tools/src/check.ts:198-224), and V-2 keeps the declared rarity within one rank (:276-285).
- M3 one tier up at most: built (tools/src/check.ts:407-409).
- M4 the leading material names the thing: not built (conflict 7); this wave makes one item per animal.
- M5 grade moves quality: waits with quality (section 9).
- M6 the trait comes from the material: the trait pieces of section 7.6 follow it.
- M7 weight never grows: a check row for worn outputs (section 17, row 6).
- M8 "A set is one family": section 8 holds a set to one class and one family.

### 4.3 What each step is worth

Computed by hand from `kernel/src/values.ts` (cost1000 = w x t + 1000 x b + the inputs' value, w by effort tier: craft tier 1 800, tier 2 and up 1000; `effort_permille`, content/core/params.json:40) and checked against CR-16 (tools/src/check.ts:427-440: chance x success + (10000 - chance) x kept on a miss >= 10000 x inputs, chance `craft_chance_bp` [10000, 8000, 6500], content/core/params.json:105). `pnpm check` computes the same numbers and holds R11 on the locked ones; a new id passes without a lock entry (tools/src/check.ts:659), and the lock stays a core maintainer's (CONTRIBUTING.md:35; AGENTS.md:45). The hides are priced by the hunt source (kernel/src/values.ts:160-185: hare hide 11760, roe hide 19440, roe sinew 4860 each) and carry no price at the trader (kernel/src/step.ts:977-979).

| Output | Tier | Active | Value | Inputs' value | Kept on a miss | CR-16 margin a try |
|---|---|---|---|---|---|---|
| scraped hare hide | 1 | 6000 | 20960 | 16160 | 11760 | 4800 |
| scraped roe hide | 1 | 6000 | 28640 | 23840 | 19440 | 4800 |
| hare leather | 1 | 4000 | 24760 | 21560 | 20960 | 3200 |
| hare fur | 1 | 4000 | 24760 | 21560 | 20960 | 3200 |
| roe leather | 1 | 4000 | 32440 | 29240 | 28640 | 3200 |
| sinew thread (2) | 1 | 3000 | 3630 each | 4860 | 4860 | 2400 |
| hare-fur hood | 1 | 5000 | 32390 | 28390 | 24760 | 4000 |
| roe-leather jerkin | 1 | 6000 | 44500 | 39700 | 3630 | 4800 |
| roe-leather leggings | 1 | 6000 | 44500 | 39700 | 3630 | 4800 |
| hare-leather shoes | 1 | 5000 | 32390 | 28390 | 24760 | 4000 |
| boiled leather | 2 | 5000 | 38040 | 33040 | 32440 | 3880 |
| fur-lined cloak | 2 | 7000 | 51590 | 44590 | 24760 | 1634 |
| boiled-leather cap | 2 | 5000 | 46670 | 41670 | 38040 | 3274 |
| boiled-leather boots | 2 | 6000 | 47670 | 41670 | 38040 | 4074 |
| woven reed coat | 3 | 7000 | 31332 | 24332 | 16200 | 1703 |
| hardened jerkin | 3 | 13000 | 70870 | 57870 | 38040 | 1509 |
| hardened breeches | 3 | 13000 | 70870 | 57870 | 38040 | 1509 |

Two built facts shape these recipes:
- A miss keeps `floor(qty x craft_miss_keep_pct / 100)` of each input (50, content/core/params.json:122), and only when every keep is 0 does one unit of the most valuable input come back (kernel/src/step.ts:243-254). So a tier-2 or tier-3 recipe takes **single units** of its valuable inputs: two of a cheap thread would keep one thread and lose the leather, and CR-16 would refuse it. The jerkin and leggings keep one thread on a miss; at tier 1 the chance is 10000, so the miss never happens at the recipe's level.
- A try must pay back on average, so the long tier-3 steps are long on purpose (13 s for the hardened pieces, under G43's 15 s).

## 5. The ladder

| Tier | Leather and fur | Reed (and cloth) | Effects, plain (section 7.2) | Where it comes from |
|---|---|---|---|---|
| 1 | hare-fur hood, roe-leather jerkin and leggings, hare-leather shoes; built: work clothes, light cloak | reed cord | common, one thing: an effect at 5 | known from the start; workshop tier 1 (the work stone) |
| 2 | boiled leather; boiled-leather cap and boots (set "digger leathers"), fur-lined cloak | woven mat, dyed cord; built: reed hat and sandals (set "reed-walker") | uncommon, one effect at 5, cap 8; an attribute beside it at the reader (section 7.5) | dug-up scraps at the gate rubble; workshop tier 2 (the workbench) |
| 3 | hardened jerkin and breeches (set "hardened leathers") | woven reed coat | uncommon 8, rare two effects at 9, cap 12; an attribute beside them at the reader | dug-up scraps in the deep ruins; gated by the recipe's band, level 6 and up (G41); workshop tier 3 |
| 4 | mail over leather; leather from the tier-3 hides of the hunters (wolf, bear; MATERIALS 2.3) | the town's cloth (wool, linen, felt) | cap 16 (proposed) | waits for metal (G45) and the city's forge (decision 51), and `open_tiers` 4 |
| 5 | plate over padding | fine cloth of the town's tiers | cap 20 (proposed) | waits for metal and the city |
| past 5 | the tier has no fixed top (DECISIONS 2026-10-09 "Two ladders"; schema tier 1 to 20, schema/src/index.ts:215-217) | | cap +4 a tier (proposed) until the power cap's top, 3000 permille, binds the whole kit anyway; past that a tier adds attribute bonuses (`attr_bonus_max`, +2 a tier past 5, PROGRESSION 5.6), trait strength (3 at tier 5, BODY_CLOCKS 6.2) and quality | far content |

Tiers 4 and 5 are armour's: the combat numbers `guard_pct` and `quiet_wear` (PROGRESSION 4.2, Leatherwork; EQUIPMENT 3.3: worn effects with a minus allowed inside the cap, CR-21) enter `WORN_EFFECTS` with the first foe (G35), and plate's `quiet_wear` is negative. Nothing of them is built here.

## 6. Making

- **Station.** The workshop, whose tier is the recipe's tier: "A recipe's tier: the highest tier among its outputs. It needs a station of that tier" (kernel/src/step.ts:205; tools/src/check.ts:418-420). The valley's one small workshop is decision 51's.
- **School.** Handcraft works the workshop and gates every recipe here (kernel/src/step.ts:201-203, `recipeProfession`). By today's decisions Tailoring is "foundation" and Leatherwork "with combat (needs hunting)" (PROGRESSION 4.2, :165-166), so cloth and leather are Handcraft's for now (EQUIPMENT 3.7 names the target). Each recipe carries a `family` (proposed): `leather` for hide work, `cloth` for fur and later spun pieces, `reed` for reed pieces (the Reedwork branch, PROGRESSION 4.3). Handcraft declares the families it holds (`families: ["cloth", "leather", "reed"]`, proposed). When a school splits out, its family's recipes name it in `profession` and need no new station (a recipe may name a profession, `RecipeProfession`, schema/src/index.ts:429-432). Fur is `cloth` because Tailoring makes `cold_proof` from wool and fur (BODY_CLOCKS 6.1). The built reed recipes carry no family in this wave (Waits, with CR-61).
- **Level bands.** A recipe's level sits in its tier's band, from `tier_min_level` [1, 3, 6] (content/core/params.json:94; tools/src/check.ts:411-412): tier 1 levels 1 to 2, tier 2 levels 3 to 5, tier 3 from 6 to Handcraft's top, 9 (content/core/professions/handcraft.json:14, 8 thresholds). Making has no level wall: each level under the recipe's takes `craft_level_step_bp` 500 off the chance (kernel/src/step.ts:223-235; G40; DECISIONS 2026-10-09 "The crafting economy: a miss keeps only inputs, a free market, no level wall").
- **Known or found.** Tier 1 is known from the start; tiers 2 and 3 are dug up (DECISIONS 2026-10-10 "First-tier recipes are known from the start; higher tiers are dug up"). A template is always start-known and makes one fixed item (schema/src/index.ts:474-492; tools/src/assemble.ts:499, :501), so every dug-up step here is a plain recipe with `known: found`, taught by a scrap (kind `fragment`, as `core/stew-scrap`, content/core/treasures/ruins-gate.json; kernel/src/step.ts:1354-1358). A save from before the wave learns the new start-known recipes when it loads (kernel/src/adapt.ts:35-39); it is never handed a piece or a scrap.
- **Before the take verb.** Nothing lays a carcass in play yet: "Nothing here takes an animal: a carcass is laid by whatever ends a hunt or a fight once the combat rules land (G35), and by tests until then" (kernel/src/hunt.ts:2-5). The check would pass the hide chain, because the solver prices the creature spots (kernel/src/values.ts:160-185), but no player could reach its first input. So, under GAP_RS_GEAR question 2 (default A), this page lands in two parts. Now: the schema and check rows, `wornStep` and `wornValue`, the class `core/reedwork` with the reed pair, and the woven reed coat with its scrap. With or right after the take verb's kernel pull request: the classes `core/leather` and `core/fur`, the raw hides' family, the six hide materials (scraped hare and roe hide, hare and roe leather, hare fur, sinew thread), the boiled leather, the nine leather and fur garments, their six scraps and their find rows (appendix, Waits, "For the take verb").
- **Where the scraps lie.** Tier-2 scraps are new rows at the gate rubble (content/core/treasures/ruins-gate.json: level 1, trowel, respawn 120000); tier-3 scraps at the deep ruins (content/core/treasures/ruins-deep.json: level 2, respawn 300000). The scrap is a tier-1 relic; what gates a tier-3 piece is its recipe's band, level 6 and up, below which its chance falls (G41, docs/design/GAME_RULES.md:490-493; tools/src/check.ts:411-412). A find table holds at most 8 rows (schema/src/index.ts:391). No other page appends here: WEAPONS puts its four scraps on a spot of its own, `core/hunters-cache` (WEAPONS 5.4), and QUARRYING its three on `core/ruins-yard` (QUARRYING 6). A dig walks its rows in order against one roll (kernel/src/step.ts:666-679), so the rows are appended after today's and the chances of a spot sum to at most 100; each new row takes `share_pct` 1 and today's shares are re-split to keep 100 (proposed). An item's value is its cheapest source (kernel/src/values.ts:4), so a re-split moves a locked value only where that spot is the cheapest source:
  - **Now**, the reed coat's scrap alone: the deep ruins go from 3 rows to 4 and from chance 55 to 59 (one row at 4), shares from 45/40/15 to 45/40/14 for coin, idol and shard. No locked value moves: the idol keeps 40 (36800), the coin keeps 45, and the shard from the deep ruins goes from 3450 to 3220, still above the gate's 2520, which prices it. The gate rubble is untouched.
  - **With the take verb**, the six hide scraps: the gate goes from 3 rows to 7 and from 75 to 95 (four rows at 5), shares from 40/30/30 to 38/29/29 for shard, coin and stew scrap; the deep ruins from 4 rows to 6 and from 59 to 67 (two more rows at 4), shares 44/40/13. The largest move of a locked value is 5 percent (the pottery shard, 2520 to 2394, priced by the gate; the coin 6300 to 6090 and the stew scrap 9450 to 9135), inside R11's 10 percent (tools/src/check.ts:648-669; `drift_budget_permille` 100, content/core/params.json:145); the idol keeps 36800, and the deep ruins' coin (6746) and shard (2990) stay above the gate's.

  A dig as built can turn up the scrap of a recipe already known (the 2026-10-10 line "a dig draws only among recipes neither known nor carried" is not built); reading it is refused ("You already know this recipe.", kernel/src/step.ts:1356), and it sells at its dig's value.
- **Scrap rarity.** A find at chance 5 or 4 computes as rare (tools/src/check.ts:209); the tier-2 scraps are declared uncommon (one rank, V-2) and stay out of the luck that lifts rare rows (kernel/src/step.ts:672-674); the tier-3 scraps are rare.
- **The Tree line.** The schema and check pull requests carry `Tree: extends the tree: docs/design/CLOTHING.md` (section 6.1 is the proposal); the content pull requests carry `Tree: core/handcraft-school/sure-hands careful-work quick-knots masters-eye`, the built nodes that already serve every Handcraft recipe (AGENTS.md:32-33; DECISIONS 2026-10-25 "Tree first, both ways").

### 6.1 The tree: a family node group for Handcraft (proposed)

AGENTS.md:32 asks that a proposal extending the tree be "a new branch or node group, in the school file's node format". The group below uses the fields of content/core/schools/handcraft.json (`id`, `name`, `text`, `size`, `needs`, `effect`, `value`, `slot`, `icon`) and two proposed keys: `band` (PROGRESSION 3.3, proposed there: band 1 levels 1-5, band 2 levels 6-10) and `family` (proposed here: the node helps only its family's recipes; without it a craft node helps every recipe of its profession, schema/src/index.ts:1093).

| id | name | text | size | needs | band | family | effect | value | slot | icon |
|---|---|---|---|---|---|---|---|---|---|---|
| `hide-work` | Hide work | Scraping, tanning and leather pieces go a little faster. | small | `careful-work` | 1 | `leather` | `craft_speed_pct` | 5 | - | `core/roe-leather` |
| `steady-needle` | Steady needle | Fur pieces fail less often. | small | `careful-work` | 1 | `cloth` | `craft_chance_pct` | 5 | - | `core/hare-fur-hood` |
| `even-cut` | Even cut | Leather pieces sometimes come out finer. | major | `hide-work` | 2 | `leather` | `quality_pct` | the quality pull request's | true | `core/hardened-jerkin` |
| `close-stitch` | Close stitch | Fur pieces sometimes come out finer. | major | `steady-needle` | 2 | `cloth` | `quality_pct` | the quality pull request's | true | `core/fur-lined-cloak` |

The reed family's quality node is the Reedwork branch's own major (PROGRESSION 4.3: a branch's first node is its major), written with that branch. None of the four is built in this wave: the two small nodes need the `family` key and its reader in `effectValue` (kernel/src/state.ts:679); the two majors need `quality_pct` in `EFFECTS` (schema/src/index.ts:1080-1090 has no such entry) and the roll (Waits). Band 2 opens at level 6, inside today's nine levels.

### 6.2 Against the PATHS floor

PATHS (docs/design/PATHS.md, #492) sets a crafting path's floor: 16 recipes with the top at level 7, 8 places, and 3 quests that each start from one of its nodes (:64, :66-67). Handcraft stands at 16 recipes, top 7, tiers 1 to 3, 3 places and 0 quests (:77), and its plan is "16 to 24, filling the two branches the map names (Reedwork and Stonework)" (:111).

| Measure | Floor | Handcraft today | After this wave | By family after |
|---|---|---|---|---|
| Recipes | 16, top at level 7 | 16, top 7 | 38, top 7: the built 16, this page's 17 and QUARRYING's 5 (GAP_RS_GEAR 3, counted); 22 before the take verb (section 6) | leather 13, cloth 3, reed 1; QUARRYING's 5 and the built 16 carry no family in this wave (section 17, row 1) |
| Tiers | 3 | 1 to 3 | 1 to 3 | leather 1 to 3, cloth 1 to 2, reed 3 |
| Places | 8 | 3 | 3 | - |
| Quests from a node | 3 | 0 | 0 | - |

- **The overshoot.** "16 to 24" is PATHS 5's plan for Handcraft's own branches, not a cap; the floor is a minimum (PATHS 4). Before the take verb Handcraft holds 22, inside the plan; the 16 hide recipes take it to 38. The 13 leather recipes are Leatherwork's in waiting, held by family until that school opens (section 6). The reed coat starts the Reedwork branch PATHS names; Stonework starts with the stone studs (section 7.6, Waits).
- **The split rule (proposed).** A family moves to its own school only when it holds the floor by itself; until then it stays in Handcraft and counts there. Leather lacks 3 recipes, 8 places and 3 quests of its own; cloth waits for its fibres (question 4).
- **A place (Waits).** The tanning rack of MATERIALS 3.2 (its question 5) as Handcraft's fourth place, raised at a camp; a new place follows PLACE_LOOK (AGENTS.md:19).
- **A quest (Waits).** One pitch through the quest-designer skill (AGENTS.md:40), starting from `hide-work` (section 6.1); the owner picks, and none is written here.
- **The rhythm** (PATHS 3: "a path unlocks visible things at a steady rhythm"): the tier-2 rung's step is named in conflict 21.

## 7. What a piece gives

### 7.1 Worn effects

The five rates of `WORN_EFFECTS` (schema/src/index.ts:160), at most two a piece and each once (:173-180), each at most its tier's `wear_effect_max_pct` (tools/src/check.ts:514-521). `wornValue` sums them over the work layer (kernel/src/state.ts:653-670), `effectValue` adds the techniques (:679), and every caller clamps the result under the power cap (R9). This page's pieces follow one idea each: **leather digs** (`dig_speed_pct`), **fur warms the bench** (`craft_speed_pct`), **reed gathers** (`gather_speed_pct`), and the hardened pair also finds (`rare_find_pct`).

### 7.2 Rarity bands, and the plain floor

PROGRESSION 5.7 sets how many effects a rarity carries and where in the tier's row each sits: common 1 at most, at the smallest step (5); uncommon 1, 500 to 750 permille of the tier's cap; rare 2, 750 to 900; legendary 2, 1000 (`rarity_effects_max` [1, 1, 2, 2], `rarity_band_permille`, content/core/params.json:957-980). Quality moves a piece inside its band, plain at the bottom. The band's bottom alone would put a plain uncommon tier-2 piece (4) under a common tier-1 piece (5). So (proposed) **a plain piece sits at the higher of its band's bottom and the cap of the tier below**, and quality lifts it toward the band's top:

| Tier, rarity | Band | Plain (this wave) | The top a master piece reaches |
|---|---|---|---|
| 1, common | the step, 5 | 5 | 5 |
| 2, uncommon | 4 to 6 | 5 (as the built reed hat and sandals) | 6 |
| 3, uncommon | 6 to 9 | 8 | 9 |
| 3, rare | 9 to 10 | 9, two effects | 10 |

Every piece of this wave is plain (no quality roll exists, section 9). The prover's `common_plain` and `rarity_band_permille` rows stay report-only (PROGRESSION 5.7); the equipment foundations pull request keeps it so. The plain tier-2 value equals the tier-1 one; what the rung adds instead is conflict 21.

### 7.3 The power cap

`powerCap` reads `power_cap_permille` by character level (kernel/src/state.ts:525-540): 1000 at level 1, 1100 at level 2, up to 3000. At level 1 no worn piece helps at all; a character one level up gets at most a tenth more from everything worn and learned together. A full kit of this wave (hood 5 craft, jerkin, leggings and shoes 15 dig) is bounded by the cap long before its sum, as G44's "a little" intends.

### 7.4 The soft wear requirement

The owner's rule (DECISIONS 2026-10-25 "The progression map, Q5: pips bought to 5, and worn gear adds attribute bonuses on top, with a soft wear requirement"; PROGRESSION 5.6): a piece names a school level, and below it the piece is worn and helps, gently, up to what gear one tier above the wearer's own gives. The equipment foundations pull request builds the field `wear.req { school, level, attr? }` (`school` a profession id, `level` the tier's entry of the ladder, `attr` thresholds read against the base attributes), the param `wear_req_level` [1, 6, 11, 16, 21], at the top level of the params beside `wear_effect_max_pct`, as section 7.5's two are, and the reader `wearOwnTier(bundle, state, piece)`; it accepts `req` in content and calls the reader nowhere. This page reads them for **worn effects** (PROGRESSION 5.6: "The same rule reads the item's worn effects (proposed: one rule for all of an item's power)"):

```
own      = wearOwnTier(bundle, state, piece)          the foundations' reader; a piece with no req is at its own tier
active   = value                                      if own >= the piece's tier
         = min(value, wear_effect_max_pct[own + 1])   otherwise (index by tier, from 1)
set      = wear_set_bonus_pct of the active values    section 8
```

- The school is the profession whose verb the effect serves: `core/digging` for `dig_speed_pct`, `core/foraging` for `gather_speed_pct`, `core/handcraft` for the craft effects (content/core/professions/*.json). A two-effect piece names the school of its first effect.
- Tier 1 states no requirement; tier 2 asks level 6; tier 3 asks level 11 (PROGRESSION 5.6, the same ladder WEAPONS 8 uses). Today's schools end at level 9 (8 `xp_levels`), so level 11 cannot be met yet and the foundations' warning row names it; it bites nothing at tiers 1 to 3, because a wearer at level 6 has own tier 2 and the tier-3 row is already the piece's whole value.
- What bites today: a tier-3 piece worn below level 6 of its school counts at most 8 per effect (the tier-2 cap): the hardened jerkin's dig 9 becomes 8, the reed coat's gather 8 stays 8. A newcomer who bought it on the market gets a real step ahead, not the late game.
- The requirement reads base attributes and school levels only, never worn bonuses (PROGRESSION 5.6), so gear never lifts a wearer into the gear above it.

### 7.5 Attribute bonuses

The equipment foundations pull request builds the field `wear.attrs` (one or more of the six attributes, each at most `attr_bonus_max` of the piece's tier), the params `attr_bonus_max` [1, 2, 3, 4, 6] and `attr_bonus_step` {2, 1..4, 1}, PROGRESSION 5.6's "+2 a tier" past tier 5, both at the top level of the params beside their twin `wear_effect_max_pct` (content/core/params.json:128), and the reader `attrTotal`, unwired: no caller moves from `attrAt` to `attrTotal`, and its gate refuses any `attrs` in content until a reader and the stats panel ("Might 7 = 5 + 2 gear", PROGRESSION 5.6) land. The callers to rewire then are `attrAt`'s (kernel/src/load.ts:31; kernel/src/step.ts:191, :196, :218, :1469; kernel/src/reactions.ts:144; kernel/src/state.ts:397; in the client game/src/text.ts:90, :138-139, game/src/scenes/world.ts:2786, game/src/ui/panels.ts:154 and game/src/ui/tree.ts:404). The owner has decided how an attribute counts (DECISIONS 2026-10-27 "An attribute bonus counts as a common piece's one effect (owner's pick)"): "A common piece carries one thing (+1 to one attribute, or one small worn effect, or a strength-1 trait); from uncommon up the attribute bonuses ride beside the effects". So the tier-1 common pieces keep their one worn effect and carry no attribute, and every uncommon and rare piece of this page adds one attribute beside its effects, which it keeps. The size follows section 7.2's rule on `attr_bonus_max`: the rarity's band of the tier's maximum, at least the tier below's maximum, so tier 2 uncommon 1, tier 3 uncommon 2, tier 3 rare 2 (proposed). The plan (Waits, at the reader):

| Piece | Tier, rarity | Effects, kept | Attribute beside them | Why |
|---|---|---|---|---|
| boiled-leather cap | 2, uncommon | dig 5 | `senses` 1 | a head piece for the one who looks around (`senses` is read at kernel/src/reactions.ts:144) |
| boiled-leather boots | 2, uncommon | dig 5 | `might` 1 | 10 more load (`per_point.might` 10, content/core/params.json:641-647) |
| fur-lined cloak | 2, uncommon | craft 5 | `stamina` 1 | waits also for the health rule below |
| woven reed coat | 3, uncommon | gather 8 | `agility` 2 | light reed (`agility` widens the minigame's zone, game/src/text.ts:90) |
| hardened jerkin | 3, rare | dig 9, rare find 9 | `might` 2 | leather on the shoulders carries: 20 more load |
| hardened breeches | 3, rare | dig 9, rare find 9 | `stamina` 2 | waits also for the rule on health above a lowered cap when a stamina piece comes off (kernel/src/state.ts:396-398) |

The built reed hat and sandals stay as they are; an attribute on them is a later content edit. `luck` stays off clothing, because luck already lifts rare finds (kernel/src/step.ts:673) and `rare_find_pct` is the worn road to them. No set bonus ever lands on an attribute (section 8).

### 7.6 Garment traits, and G34

The traits are BODY_CLOCKS 6.1's closed list (`cold_proof`, `snow_shod`, `storm_proof`, `ice_grip`, `heat_ward`), strength 1, 1, 2, 2, 3 by tier (`trait_strength_by_tier`, content/core/params.json:981; BODY_CLOCKS 6.2), the strongest piece of a trait counting and two never adding. The owner decided that a place's conditions are answered by what is worn (DECISIONS 2026-10-25 "The progression map, Q8: two bars only; places are harsh, gear answers them"), and that entry says the rules pull request writes G34 as "a hunting hazard is answered by a run; a place's condition by what is worn and eaten". That rewrite **has not landed**: G34 still reads "the answer is a run, never gear" (docs/design/GAME_RULES.md:387), the forbidden pattern "Gear answer" stands (:626), and G34's check row says "No field of the schema can name an item as a hazard's answer" (:735). No place condition is built either. So the equipment foundations pull request builds the field `wear.trait` (one of the five, one trait a piece, each on its trait's places) with no reader, and its gate refuses any `trait` in content until G34's rewrite and the first place condition land; no piece here carries a trait.

The plan puts every trait on **a piece of its own**, made at the bench from the plain piece and one more unit of the trait's material: the shape of Tailoring's `trait_sew` ("a recipe whose output is the same piece with the trait", PROGRESSION 4.2). So no built, held or set piece loses its effect: the reed hat, the boots and both sets stay whole, and a player chooses for a place between the effect and the trait. M6 says which trait (the material's); BODY_CLOCKS 6.2's "set by the recipe" says whether (a recipe makes the trait piece). A common trait piece carries the trait as its one thing (DECISIONS 2026-10-27); an uncommon one carries it as its one effect, with an attribute beside it.

| Trait piece (Waits) | Place | Tier, rarity | Made from | Trait | Beside it |
|---|---|---|---|---|---|
| lined fur hood | head | 1, common | hare-fur hood 1, hare fur 1; start | `cold_proof` 1 | nothing: one thing |
| high hare boots | feet | 1, common | hare-leather shoes 1, hare leather 1; start | `snow_shod` 1 | nothing |
| sun reed coat | top | 3, uncommon | woven reed coat 1, woven mat 1; found (a scrap at the deep ruins, its 7th row) | `heat_ward` 2 | `agility` 2 |
| studded shoes | feet | 1, common | hare-leather shoes 1, stone studs 1; start | `ice_grip` 1 | nothing |
| studded gloves | hands (question 1, A) | 1, common | hare leather 1, stone studs 1; start | `ice_grip` 1 | nothing |

**The stone studs are this page's.** QUARRYING hands them to "the garment traits" (QUARRYING 7), and BODY_CLOCKS names them Handcraft's Stonework, tiers 1 to 2 (docs/design/BODY_CLOCKS.md:143). The item (proposed, Waits): `core/stone-studs`, tier 1, common, weight 1, 2 stone flakes -> 1 at the workshop tier 1, 3000 ms, level 1, start-known, Handcraft; it lands with the first `ice_grip` piece and starts the Stonework branch's recipes (section 6.2).

**`ice_grip`'s place.** BODY_CLOCKS 6.1 puts it on the feet and the hands (docs/design/BODY_CLOCKS.md:143). The equipment foundations pull request lists it on the feet only until question 1 is answered; it asks no question of its own and proposes no amendment of BODY_CLOCKS. The studded shoes answer ice on the feet under every answer; the gloves add the hands under A, so a place with deep snow and ice is answered by the high boots and the gloves together (finding 5's case). Conflict 17 holds BODY_CLOCKS as written until question 1 is answered.

`storm_proof` waits for an oil or a wax (MATERIALS 3.2). A trait never adds experience (BODY_CLOCKS 6.2). On screen a trait is a word ("keeps the cold off"), never a number.

**Weapons mirror 7.1 to 7.6.** WEAPONS 8.1 reads this section for the hand: no worn effect, an attribute bonus sized as 7.5 sizes a garment's and one weapon trait from a closed list per class, only on found weapons of tier 2 or more, under the same power cap and soft requirement, gated until combat reads them (WEAPONS owner question 11, default A).

### 7.7 Weight

A worn piece's weight counts in the load (kernel/src/load.ts:21-26), and the load sets the pace against `load.base` 30 plus 10 a point of might (content/core/params.json:375-381; kernel/src/load.ts:28-32). So weight is the honest price of a heavier piece: the cloak, the reed coat and the hardened pair weigh 2, everything else 1, and no worn output weighs more than its inputs (M7; section 17, row 6). Tailoring's `light_cut` (a garment weighs less, PROGRESSION 4.2) is a later node.

## 8. Sets

**The one that exists.** `core/reed-walker`: the reed hat (head) and the reed sandals (feet), tier 2, uncommon, `gather_speed_pct` 5 each (content/core/recipes/reed-hat.json, reed-sandals.json). Worn whole, 10 grows by `wear_set_bonus_pct` 20 to 12 (kernel/src/state.ts:646-670, rounded down). checkWear holds that a set has two pieces at least, of one creator, wearable whole (tools/src/check.ts:522-550).

**The grammar (proposed).** A set is a promise that its pieces belong together, so it obeys four more rules, each a check row:
1. **Uncommon to rare.** A common piece carries one thing at most (PROGRESSION 5.7; DECISIONS 2026-10-27), so a set bonus would be its second. A legendary piece already sits at its tier's cap (`rarity_band_permille` legendary [1000, 1000], content/core/params.json:976-979), so any bonus would break rule 3. Common and legendary pieces belong to no set.
2. **One class and one family.** "A set is one family" (MATERIALS M8, docs/design/MATERIALS.md:142, #432): the check reads the pieces' class and item `family`, both built fields, so hare shoes and a roe jerkin never make a set.
3. **Under the cap.** A full set's total of one effect, its pieces' values plus the bonus, is at most the number of pieces times the cap of the set's highest tier: a set never gives more than its pieces could at their cap.
4. **Effects only.** The bonus grows worn effects; never an attribute (section 7.5), never a trait (BODY_CLOCKS 6.2: two pieces of one trait never add).

The set bonus is computed on the active values of section 7.4, so a set worn under its requirement grows from what is active.

| Set | Pieces | Class, family | Tier, rarity | Effect each | Full set | Rule 3 bound |
|---|---|---|---|---|---|---|
| `core/reed-walker` (built) | reed hat, reed sandals | `core/reedwork`, `reed` | 2, uncommon | gather 5 | 10 + 2 = 12 | 16 |
| `core/digger-leathers` | boiled-leather cap, boiled-leather boots | `core/leather`, `roe` | 2, uncommon | dig 5 | 10 + 2 = 12 | 16 |
| `core/hardened-leathers` | hardened jerkin, hardened breeches | `core/leather`, `roe` | 3, rare | dig 9, rare find 9 | dig 18 + 3 = 21; rare find 18 + 3 = 21 | 24 |

The reed pair moves to `core/reedwork` with family `reed` (section 3) so rule 2 holds for it; its values do not move (kernel/src/values.ts reads neither class nor family). The two leather sets land with the take verb (section 6); until then the reed-walker is the one set, and the rows of section 17 are proven on fixtures.

## 9. Quality and grade: one vocabulary, split stacks

- **Grade** is built in the schema: a finer good off a better animal, `grade { of, step }`, 2 fine and 3 true, each grade an item of its own so a stack splits by grade (schema/src/index.ts:250-262), asked for by `min_grade` (:465). The hunt draws it (`grade2_bp`, `grade3_bp`, kernel/src/bundle.ts:167). No graded hide exists in core content yet (MATERIALS question 1).
- **Quality** is proposed (PROGRESSION 5.2-5.3): a made thing's roll at the craft, `plain, fine, true, master`, inside its rarity's band (section 7.2), open only once the family's `quality_pct` node is learned. Its odds are open and its result is the server's, drawn from the seed like every roll (G102, docs/design/GAME_RULES.md:303-308). Handcraft has no such node (content/core/schools/handcraft.json: `sure-hands`, `careful-work`, `quick-knots`, `masters-eye`, `tinker`, `fine-fingers`, `patient-work`), so every piece of this wave is plain; section 6.1 proposes the two family nodes.
- **One vocabulary, split stacks** (EQUIPMENT 3.3b, kept): the words `plain, fine, true` serve both ladders, `master` is for made things only, and a quality is stored as grade is, an item of its own, so a "fine" coat is a thing a player sees and trades, with no hidden number on a stack.
- **Grade feeds quality, never tier** (MATERIALS M5, proposed there): a fine hide adds `grade_quality_bp` to the roll once the node is learned.
- What the quality pull request adds (Waits): `quality_pct` and the nodes `even-cut` and `close-stitch` (section 6.1), the quality twins of each piece (fine, true, master at the band's points of section 7.2), and the roll.

## 10. The hide's coat, and dye from the land

**The coat.** The owner (DECISIONS 2026-10-30 "The hide carries the coat: skinning gives a hide in the animal's colour, and a garment cut from it wears that colour"): a hide remembers the coat it came from, and a garment cut from it wears that colour, never a colour picked at the bench; "or for further works" is not yet precise, so a hide's colour is final until he says (question 3). Every hare and crow already wears one coat of its kind's list, the hare one of eight (DECISIONS 2026-10-30 "The deer and the hart keep their pixelled bodies; every hare and crow wears one coat of its kind's list"). As built, a hide item carries no coat, and a coat is look only: "no good, weight or value here reads one" (DECISIONS 2026-10-30 "The creature schema: behaviour, group and den fields; the hare, the crow, the roe deer and the wolf as data; the wild's check rows").

**Who builds it, and when.** The decision's retry names both: "the materials page (animal to garment) lands and the first garment recipes exist; the hunt stream builds the hide's colour then". This wave's recipes are those first garment recipes, so they are built to take the coat without a rewrite: each names its hide by id, one recipe per animal (section 4.2), and the coat adds outputs, not chains. Until it lands, a piece shows one kit icon (section 13). Conflict 18 records this.

How it can land (proposed to the hunt stream): the coat is a third split axis beside grade and quality, an item of its own per coat (as grade, schema/src/index.ts:250-262), so the bag shows "white hare fur" as a thing; the garment takes it through M4's leading material, one recipe or template per garment and an output per coat. Before M4, coats multiply items: the hare's 8 coats times this page's 7 hare items (the raw and scraped hide, leather, fur, hood, shoes, cloak) are 56 items, so this page advises M4 first. On the body, a coat is a ramp swap at draw time (docs/design/ART_SYSTEM.md:56), so it costs no new drawing. A garment takes the coat's colour, never the animal's look: three-tone shading with no outline is the `creatures/` group's alone (DECISIONS 2026-10-31 "The animals' look: three-tone shading, no outline, at the 3/4 camera"; "Animals wear no outline: the creatures group leaves the ink rule"), and a hide's or a garment's icon in `items/` keeps the one-pixel ink edge the check asks of every 64 px sprite outside `tiles/` and `creatures/` (tools/src/ink-check.ts:25).

**Dye from the land.** Built: the dyed cord, from berries and a reed cord (content/core/templates/dye-cord.json), an input of the reed hat and the lucky charm; nothing recolours a worn piece. Proposed: dye is a ramp swap on cloth and reed pieces only, by the dye's source:
- plant dyes from the berry family, as built (more plant families as the land's plants arrive, G45);
- **ochre** from QUARRYING.md, the link between the two pages: QUARRYING owns the item (class `core/pigment`, no family, QUARRYING 3), and this page owns one plain recipe, `core/earth-dyed-cord` (proposed): 1 ochre and 1 reed cord -> 1 earth-dyed cord, tier 1, common, start-known, recipe family `reed`. Both inputs are tier 1, so it sits under the found rule's tier 2 and needs no scrap; a template could not take it, since a template asks a class and family and ochre carries no family. The ochre item and this recipe land in one pull request, when the drawing pick (question 2) makes a colour visible, so neither page waits for the other;
- a hide piece keeps its coat (question 3, default A); Tailoring's `dye_fast` (a dye that keeps, PROGRESSION 4.2) is a later node.

## 11. The look layer, and binding

- **The look layer** (built): a piece with `look: true` goes on `s.player.looks` over the work clothes, shows, and counts for nothing; it has no effects and no set, and never sits in the hand (kernel/src/step.ts:1366-1390; tools/src/check.ts:509-513). A look may carry `premium_later` only with no effect and only if the game also gives it (G39; tools/src/check.ts:526-532).
- **Binding** (EQUIPMENT 3.6): the equipment foundations pull request builds the item field `bind` (`none`, `account` or `character`; on the item, not in `wear`; left out, `none`) with no reader, and its rows refuse a bound piece of power and let only a look bind: `none` for everything found or made, power included; `account` for a look bought with money (DECISIONS 2026-10-09 "A look bought with money is bound to the account; the same look found in the game trades"); `character` for a holiday's look. No piece of this page binds or states `bind`: it is made, sold to the trader with the made share (DECISIONS 2026-10-09 "The crafting economy as built: no level wall, and a made good sells for more"), and traded between players in the free market, inside R8's band, once that market lands; it is decided, not built (DECISIONS 2026-10-09 "The free market comes right after crafting wave 4, one per world, and the demo tunes it"; no market or stock code exists in kernel/src).
- **What the look layer is for here:** when the drawing lands (section 13), a look piece is the same drawing in its own ramps; a player can wear the hardened jerkin's power under a look piece's colours.

## 12. No wear, and no mending

Clothing never wears out: armour and clothing never wear (EQUIPMENT 3.4; PROGRESSION 5.4; DECISIONS 2026-10-09 "The crafting economy"). Tools wear by use; a weapon, under WEAPONS 7's proposal, never wears either (WEAPONS owner question 7, default A; EQUIPMENT 3.4's "tools and weapons wear by use" is amended with that answer, WEAPONS 15). The counter `s.player.wear` and `wearTool` are a tool's (kernel/src/step.ts:1754-1767), and a piece has no `uses`. So clothing needs no mend (the mend is WEAPONS 7's and Handcraft's, for tools only).

What takes a piece out of the world, and what does not:
- **The trader is a faucet, not a sink.** A sale removes the piece (kernel/src/step.ts:984) and mints its price in gold (`s.ledger.minted`, :986); the made share (DECISIONS 2026-10-09 "The crafting economy as built") makes the faucet bigger.
- **The chains** sink goods before a piece exists: every piece spends a hunt, a scrape, a tan.
- **Sinks of finished pieces (Waits):** the trait recipes of section 7.6, each consuming its plain piece; the upgrade recipe that lifts a piece one tier and consumes it (CR-20; PROGRESSION 5.4); the repair quest that "eats goods and gold" and the settlement (DECISIONS 2026-10-23 "Open ends of the world plan, the owner's answers of 19.10: players may destroy and the valley repairs, a death leaves a pack, characters keep hours, a lean opens doors, the sinks are the world's prices (carried from #223)", answers 1 and 5), which may ask for garments. Built today, nothing else removes a finished piece.

## 13. Drawing worn pieces on the body

**Today a worn piece is never drawn.** The world draws the race's sprite (game/src/scenes/world.ts:2121-2134, `playerFrame`); the kit panel's figure draws the same race sprite (game/src/ui/panels.ts:212-216) and each place shows the piece's icon (`slotButton`, :223-240). This wave draws nothing new: its pieces and scraps reuse item icons already in the base kit (appendix), `items/` sprites that owe no `scale` (tools/src/kit/scale.ts:65), so it adds no sprite to the scale or ink checks.

**What the written rules say, apart:**
- The upgrade entry (DECISIONS 2026-10-09 "The upgrade", DECISIONS.md:345, :347): worn items "are icons on the character screen until stage 6 brings visible looks", then "each one is drawn for every body build of the player roles"; its retry: "stage 6 draws worn items on the character". Stage 6 is cosmetics and payments.
- "Dyes are a ramp swap at draw time ... styles and dyes, never gear drawn on the body" (docs/design/ART_SYSTEM.md:56, 20.10).
- Decision 6 (DECISIONS 2026-10-22 "Lighting and animation (decision 6 of 22.10)"): "the unclothed base plus layered equipment, each layer in every pose and direction, is far cheaper from a 3D model"; decision 41: "a body on the shared rig plus wear in slots" (DECISIONS 2026-10-22 "Every character stands on the same rig and slots as the player"); decision 42: "Everything shows in the wardrobe".
- Everything that moves is rendered at a 50 degree camera (DECISIONS 2026-10-26 "Everything that moves is rendered at a 50 degree camera").
- Scale (NATURE 1, #509): every world sprite of a kit, not `tiles/` and not `items/`, declares `scale`, its drawn height in characters; `pnpm check` warns on a sprite with none or one under its kind's floor, and a `chars/` sprite that is no child and no elder is held to the adult's floor of 1, a tenth under still passing (docs/design/NATURE.md:53, :55; tools/src/kit/scale.ts:65-74). `pnpm art:scale` measures a sprite's opaque height against the adult human's.
- Ink: "The outline is the one-pixel ink line `#1b1a2e`, on every sprite" (DECISIONS 2026-10-23 "Every sprite has the dark ink outline"); the check holds every 64 px sprite outside `tiles/` and `creatures/` to it (tools/src/ink-check.ts:25). The animals left it for three-tone shading (DECISIONS 2026-10-31, the two entries of section 10); the people keep it.
- 3D is paused: "The 3D door stays paused" (DECISIONS 2026-10-26 "Camera rotation and a deeper HD-2D look are aims for the end of development; until then the pixel game shows the player through what covers it"; DECISIONS 2026-10-30 "The 3D door leaves the home page while 3D is paused; /play3d stays served"). Decision 6's 3D model is the pixel game's own route: the anim tool renders the characters from 3D sources into pixel sheets (the 26.10 camera's-turn entry above), at `elev` 50 (tools/anim/anim.json:16).

So the drawing has a gate, stage 6, and until then pieces stay icons in the kit, as built and as the upgrade entry says. Nothing here is built or drawn for the 3D door; a worn piece's 3D twin waits with the door. How they are drawn then is a direction (AGENTS.md:22: a change that shows everywhere, a look of a character), so the page does not decide it. It proposes **three stills for the owner at phone size when stage 6 opens**, one body (the human), one pose, the 50 degree camera, each pair testing one named difference:

| Still | What is drawn | The difference it tests |
|---|---|---|
| A | every worn piece as its own layer on the rig: head, top, legs, feet (and gloves with question 1) | against B: how many layers |
| B | only the pieces that change the silhouette: the head piece and the back (hat, hood, bag); the top keeps the race's start drawing | against C: a new shape or only a new colour |
| C | no new shapes: the worn top's ramps tint the start outfit's torso (ART_SYSTEM.md:56 as written) | the cheapest reading |

The builder leans to B: it reads at phone size and costs the fewest drawings. The cost of A, which is what the upgrade entry's "drawn for every body build" reads as: every piece x every body build (the three races, decision 9) x every rendered view x every pose sheet the rig renders, from the anim tool's 3D sources (decision 6; the pixel route, not the paused 3D door), with coats and dyes as ramp swaps on top (section 10). The pick is written to DECISIONS with its frame, and ART_SYSTEM.md:56 is amended if it is A or B.

**What a layer owes the art checks (proposed).** Under A or B a worn layer is a world sprite, so it owes a `scale` and the ink edge. A hat drawn alone measures far under one character, so a layer is drawn on its body's frame, in a group of its own (`wear/`, proposed, which no floor reads as an adult), and declares its body's `scale`; `pnpm art:scale` measures the body with the layer on, never the layer alone. Its edge takes the ink line, as every people sprite does. C adds no sprite. Conflict 22 records this; nothing of it is drawn before stage 6.

## 14. The kit panel's numbers, against decision 39

"No percentages on screen ... The number stays in the code (a long press shows it)" (DECISIONS 2026-10-22 "No percentages on screen (decision 39 of 22.10)"). The kit panel prints three:
- game/src/ui/panels.ts:342: each worn effect as `+${e.value}%`;
- :560: an item's facts as `${label} +${e.value}%.`;
- :583: a tool's line as `+${15 * (tier - 1)}% gathering speed`.

The fix (proposed): a pure kernel reader `wornStep(bundle, value)` returns 1, 2 or 3 by where the value sits against `wear_effect_max_pct` (up to the tier-1 cap, up to the tier-2 cap, above), and the panel writes the effect's name with "a little", "more" or "much" and one to three dots, so colour is never the only signal (G29); a long press shows the number. The tool's line names its tier's step in words ("faster", "much faster"), never a percentage. A set's line stays as built (:343), "Reed walker set 2/2 · full": a count of pieces, never a percentage.

## 15. Beyond RuneScape, on purpose

Each row says what this wave builds; most of the section is the road ahead, and the last column says which part.

| Link | RuneScape (Old School) | Loomvale, and why | This wave |
|---|---|---|---|
| Tanning | a tanner turns hides into leather for coins ([Tanner](https://oldschool.runescape.wiki/w/Tanner)) | the player scrapes and tans at the workshop, two short steps: no coin service, the hunt and the bench are the game; the hide's coat goes into the garment (section 10) | scrape and tan with the take verb (section 6); the coat waits for the hunt stream (DECISIONS 2026-10-30, retry) |
| Spinning and cloth | wool is spun from the first level, flax later ([Crafting](https://oldschool.runescape.wiki/w/Crafting)) | cloth comes from what the land gives: reed now, wool and linen with the town | the reed coat built now; wool and linen wait (question 4) |
| A level to make | leather items unlock at rising Crafting levels ([Crafting](https://oldschool.runescape.wiki/w/Crafting)) | no level wall: a recipe above the maker's level runs at a lower chance (G40); knowledge is dug up, not levelled into | built already; this wave's found recipes and scraps use it |
| A level to wear | a studded body needs Ranged and Defence levels to equip ([Studded body](https://oldschool.runescape.wiki/w/Studded_body)) | the soft wear requirement: worn at any level, its power active up to one tier above the wearer's own (section 7.4) | built now, on the foundations' reader |
| Dye | dyes from a dye-maker colour a few items, mostly capes ([Dye](https://oldschool.runescape.wiki/w/Dye)) | dye from the land (berries, ochre) as a ramp swap on cloth and reed; hide wears its animal's coat | the berry cord built already; the earth-dyed cord and the swap wait for the drawing pick (question 2) |
| Sets | a skilling outfit with a full-set bonus that can be recoloured ([Graceful outfit](https://oldschool.runescape.wiki/w/Graceful_outfit)) | sets from uncommon to rare, one class and one family, never past their pieces' cap (section 8); colour stays apart from power: a look piece shows over the worn one (section 11) | the grammar's check rows now; the two leather sets with the take verb (section 6) |
| Wear and repair | some equipment degrades and is repaired for a cost ([Item degradation](https://oldschool.runescape.wiki/w/Item_degradation)) | clothing never wears (section 12), and under WEAPONS 7's proposal a weapon neither; a worn tool is mended at the bench (WEAPONS 7) | built already (EQUIPMENT 3.4) |
| Places | eleven worn places, hands and a shield among them ([Equipment](https://oldschool.runescape.wiki/w/Equipment)) | nine, gloves on a tenth if the owner wants them (question 1); no off-hand (EQUIPMENT 3.2) | waits (question 1) |
| Beyond, with no row there | | weather traits that answer a place's conditions (section 7.6); grade from the animal and quality from the maker as two axes (section 9); the free market and no binding on power (section 11) | traits wait for G34's rewrite; quality waits for its pull request; the market is decided, not built (DECISIONS 2026-10-09 "The free market comes right after crafting wave 4, one per world, and the demo tunes it") |

## 16. New against existing rules

| Rule | The clash | The resolution |
|---|---|---|
| 1. G34 (docs/design/GAME_RULES.md:387), the forbidden pattern "Gear answer" (:626), G34's check row (:735) | a garment trait answers a place's condition, which G34 as written forbids | kept until the rules pull request writes Q8's wording (DECISIONS 2026-10-25 Q8); no trait content before it; the foundations' gate refuses `wear.trait` |
| 2. docs/design/ART_SYSTEM.md:56 "never gear drawn on the body" | decisions 3, 6, 41 and 42 of 22.10 ask for worn things on the body; the 2026-10-09 upgrade keeps them icons until stage 6, then every piece drawn for every body build | icons until stage 6; then the owner picks among the stills (question 2) and ART_SYSTEM.md:56 is amended if A or B |
| 3. Decision 39, no percentages on screen | the kit panel prints `%` at game/src/ui/panels.ts:342, :560, :583 | the code changes (section 14); the rule stays |
| 4. PROGRESSION 5.1: "`outfit` the look layer over them" | the code makes `outfit` a work place that takes the top and the legs (kernel/src/step.ts:1381; EQUIPMENT 3.2) | the code stays; question 5 settles what an outfit may give; PROGRESSION 5.1 is amended to match |
| 5. DECISIONS 2026-10-10: tiers 2 and 3 are dug up | ten built recipes of tier 2 or 3 and the dyed-cord template are known from the start (content/core/recipes/*.json; CR-61 open in GRUNT) | every new recipe of tier 2 or more in the three families is found (section 17, row 2); the old ones stay CR-61's |
| 6. MATERIALS 3.2 (#432, proposed): tanning on a new rack, a cure of about 5 game days | this wave tans at the workshop in one 4 s step | interim; when the rack lands (MATERIALS question 5) the three tan recipes move station, a content edit, and the rack is a Handcraft place (section 6.2) |
| 7. MATERIALS M4 (#432): one template per garment, an output per leading animal | templates make one fixed item and are start-known (tools/src/assemble.ts:499, :501) | one plain recipe per animal until M4; MATERIALS 4.1's two-hide hood becomes one fur and one thread here, single units so CR-16's miss returns the fur |
| 8. G44's text, "A hat, a top, trousers or one full outfit, shoes, two pieces of jewelry and the tool in hand" (docs/design/GAME_RULES.md:508-509), and its check row (tools/src/check.ts:497-498); the 2026-10-09 upgrade's slot list (DECISIONS.md:345) | `ice_grip` on the hands (finding 5, accepted 26.10) and decision 3's "hands"; both lists have no gloves (and no back) | a separate `hands` garment place (question 1, default A); the held hand stays a tool's. Under A the rules pull request adds gloves to G44's list and a DECISIONS line records the tenth place, finishing what decision 3 began (the upgrade's list is already superseded in part, DECISIONS 2026-10-23 "Bookkeeping from the decisions audit") |
| 9. PROGRESSION 5.6: tier 3 asks level 11 | schools end at level 9 as built (8 `xp_levels`) | kept: at tiers 1 to 3 only level 6 bites, and it is reachable; the foundations' warning row names level 11 until the twenty-step curve is applied |
| 10. BODY_CLOCKS 6.1: `cold_proof` and `storm_proof` may sit on the back | the back holds one bag or one quiver (DECISIONS 2026-10-23) | kept both: no piece of this page takes the back; the cloak is a top |
| 11. PROGRESSION 5.7: common things are plain | a set bonus on common pieces would be a second effect, and on legendary pieces it passes the cap | sets from uncommon to rare (section 17, row 4) |
| 12. PROGRESSION 5.7: plain at the band's bottom | the bottom of uncommon tier 2 (4) is under common tier 1 (5) | the plain floor of section 7.2: the higher of the band's bottom and the tier below's cap; PROGRESSION 5.7 amended with the quality pull request |
| 13. R11: a value moves at most 10 percent from the lock | the scrap rows re-split the dig shares | inside: none now, at most 5 percent with the take verb (section 6); the lock is left to a core maintainer (CONTRIBUTING.md:35) |
| 14. EQUIPMENT 3.7: cloth from Tailoring, leather from Leatherwork | neither school is open (PROGRESSION 4.2) | Handcraft makes both, by recipe `family`; a family moves to its school by `profession` once it holds the PATHS floor (section 6.2) |
| 15. MATERIALS M6 (trait from the material) and BODY_CLOCKS 6.2 (set by the recipe) | two readings of where a trait comes from (MATERIALS question 4) | M6 says which trait, the recipe says whether: a trait piece is its own recipe from the plain piece (section 7.6), so both read the same and no plain piece loses its effect |
| 16. PROGRESSION 7 (docs/design/PROGRESSION.md:551): "Recipes gain `family: Id`" | this page makes a recipe's family a Word | Word, as ItemDef `family` (schema/src/index.ts:212) and ClassInput `family` (:463); a family is named inside its profession's `families`, so a node names it as profession plus word; PROGRESSION 7 is amended to Word |
| 17. BODY_CLOCKS 6.1 (docs/design/BODY_CLOCKS.md:143): `ice_grip` on the feet and the hands | the equipment foundations pull request lists `ice_grip` on the feet only until question 1 is answered; it asks no question and proposes no amendment of BODY_CLOCKS | the feet are the start under every answer (the studded shoes, section 7.6); BODY_CLOCKS 6.1 stays as written until question 1 is answered: under A the hands join the trait places with the `hands` place, under C that answer amends 6.1 to the feet only. Question 1 is the only question on it |
| 18. DECISIONS 2026-10-30 "The hide carries the coat" (retry: the first garment recipes exist; "the hunt stream builds the hide's colour then") | this wave builds the first garment recipes, and no coat | kept: the decision names the hunt stream as the builder, after the materials page lands; these recipes name the hide by id, one per animal, so the coat adds outputs only (section 10) |
| 19. The find table's 8 rows (schema/src/index.ts:391) | the wave's three pages each add scrap rows | now the deep ruins hold 4 of 8 and the gate keeps its 3; with the take verb the gate holds 7 and the deep ruins 6 (7 with the sun reed coat's scrap, Waits); WEAPONS and QUARRYING use spots of their own (section 6) |
| 20. PATHS 4 (docs/design/PATHS.md:64-67): 8 places and 3 quests for a path | Handcraft stays at 3 places and 0 quests; its recipes go from 16 to 38 with QUARRYING's five (22 before the take verb), past PATHS 5's "16 to 24" | the floor is a minimum and 16 to 24 a plan; a place and a quest are proposed with their gates, and the split rule keeps each family in Handcraft until it holds the floor (section 6.2) |
| 21. PATHS 3: "a path unlocks visible things at a steady rhythm" | a plain tier-2 uncommon piece's value (5) equals a tier-1 common one's (section 7.2) | kept, with the step named: a new place filled (the head digs with the cap), the set's +2 (12 against 10), the attribute beside the effect (section 7.5, at the reader) and quality's headroom to 6; plain at the band's top would leave quality nothing to lift |
| 22. NATURE 1 (docs/design/NATURE.md:55, #509): every world sprite outside `tiles/` and `items/` declares `scale`, and a `chars/` sprite is held to the adult's floor (tools/src/kit/scale.ts:65-74) | a worn layer of still A or B never stands alone: a hat drawn by itself measures far under one character, and `pnpm art:scale --declare` would write that short height | a layer is drawn on its body's frame, in a group of its own (`wear/`, proposed), declares its body's `scale`, and is measured worn; this wave reuses built `items/` icons, so nothing changes before stage 6 (section 13) |
| 23. PROGRESSION 7 (docs/design/PROGRESSION.md:555): `attr_bonus_max` "by tier and its step" among the `growth` params | `growth` is an optional group (schema/src/index.ts:1629), and the foundations' check reads the cap in every world | `attr_bonus_max` and its step `attr_bonus_step` move to the top level of the params, beside their twin `wear_effect_max_pct` (content/core/params.json:128); PROGRESSION 7 is amended so (section 7.5) |

## 17. Check rows

What `pnpm check` prints, one error each, in `tools/src/check.ts` beside checkWear (:480) and the recipe loop (:401-441):

- x tools/src/check.ts: recipes.<id>.family: "<f>" is not one of <profession>'s families (<list>): name a family its profession declares (CLOTHING 6)
- x tools/src/check.ts: recipes.<id>.known: a <family> recipe of tier <t> is dug up: "known": "found" (DECISIONS 2026-10-10) (CLOTHING 6)
- x tools/src/check.ts: items.<id>.wear.set: the full set "<set>" gives <n> of <effect>, more than <pieces> pieces at the tier <t> cap (<m>): a set never gives more than its pieces could (CLOTHING 8)
- x tools/src/check.ts: items.<id>.wear.set: a <rarity> piece belongs to no set: sets run from uncommon to rare (PROGRESSION 5.7) (CLOTHING 8)
- x tools/src/check.ts: items.<id>.wear.set: the set "<set>" mixes <a> and <b>: a set is one family of one class (MATERIALS M8) (CLOTHING 8)
- x tools/src/check.ts: recipes.<id>.outputs: <item> is worn and weighs <w>, more than its inputs (<v>): a made piece never gains weight (MATERIALS M7) (CLOTHING 7.7)

Scoped on purpose: the weight row reads worn outputs only (the built herb tea weighs 1 from two herbs of weight 0); the found row reads the three families only (rule 5 above). The rows for `attrs`, `req`, `trait`, `bind` and the hand are the equipment foundations pull request's; this page adds none of them.

## 18. Owner questions

1. **The hands.** A: a tenth place, `hands`, a garment place labelled "Gloves", beside the held tool, where `ice_grip` can sit. B: claws as a held tool in the hand, which then grips and works but holds nothing else. C: no gloves; `ice_grip` on the feet only, as the equipment foundations pull request lists it, and finding 5 is reopened. **Default: A.** Until it is answered, the foundations list `ice_grip` on the feet only and BODY_CLOCKS 6.1 stays as written.
2. **Gear on the body, at stage 6.** A: every piece layered on the rig. B: only the head and the back drawn; the rest shows in the kit. C: a tint of the start outfit only. **Default: icons until stage 6, as the upgrade entry says; stills A, B and C at phone size go to the owner when stage 6 opens (section 13).**
3. **The hide's "further works".** A: final: a hide's colour goes whole into the garment. B: a dye may move it within its coat's ramp (lighter, darker). C: a full re-dye at the bench. **Default: A.**
4. **Cloth now or with the land.** A: wait: wool, linen and felt arrive with the farm and the town. B: a valley fibre plant now (a nettle node), its cord and a spun cloth at tiers 1 to 2. **Default: A.**
5. **What an outfit gives.** A: a work piece that fills the top and the legs, carrying one effect for each place it fills, each under its tier's cap and its rarity's count. B: a look only, as PROGRESSION 5.1 reads. **Default: A, with no outfit content until the owner answers.**

## 19. Not here

The weapon block, the hand in a fight, ammunition, the bonuses and traits of found weapons, and mending (WEAPONS.md); stone, ochre, minerals and the metal chain (QUARRYING.md); the measure against the depth reference, link by link (GAP_RS_GEAR.md); the hunt, the take and the dressing (HUNTING, HUNT_LADDER); the hide's coat (the hunt stream, DECISIONS 2026-10-30); the atlas of hides (MATERIALS, #432); the place conditions and their grades (BODY_CLOCKS 5); protection numbers (`guard_pct`, `quiet_wear`) and the fight (COMBAT); jewelry, bags and the quiver as built; the premium shop (stage 6); the market's screens; the value lock (a core maintainer's).

## Sources

Ours:
- DECISIONS 2026-10-07 "Era themes and fine clothes postponed to town progression tiers" (paused).
- DECISIONS 2026-10-09 "The upgrade: work clothes with a small capped bonus, and a look layer on the same slots"; "Two ladders: an open-ended tier for how advanced, the four rarities for how often"; "Metal: the grammar is ready, the content waits for its discovery"; "The crafting economy: a miss keeps only inputs, a free market, no level wall"; "The crafting economy as built: no level wall, and a made good sells for more"; "A look bought with money is bound to the account; the same look found in the game trades".
- DECISIONS 2026-10-10 "First-tier recipes are known from the start; higher tiers are dug up"; "The world and its clocks: what a fall keeps, three clocks, sleep, scraps and menace without gore" (recipe scraps).
- DECISIONS 2026-10-22 decisions 3, 6, 9, 39, 41, 42 and 51 of 22.10, by their titles above.
- DECISIONS 2026-10-23 "Weight and the three paces: places say how many, weight says how fast"; "Bags on the back: 12, a satchel 24, a frame pack 36"; "Open ends of the world plan, the owner's answers of 19.10" (answers 1 and 5, the sinks); "Bookkeeping from the decisions audit: corrections to older entries" (the upgrade's slot list); "Every sprite has the dark ink outline".
- DECISIONS 2026-10-25 "The progression map, Q5" and "Q8"; "The progression map: common things are plain"; "Balance prover finding 5"; "Tree first, both ways".
- DECISIONS 2026-10-26 "Everything that moves is rendered at a 50 degree camera"; "Camera rotation and a deeper HD-2D look are aims for the end of development; until then the pixel game shows the player through what covers it" (the 3D door paused).
- DECISIONS 2026-10-27 "An attribute bonus counts as a common piece's one effect (owner's pick)".
- DECISIONS 2026-10-30 "The hide carries the coat"; "The deer and the hart keep their pixelled bodies; every hare and crow wears one coat of its kind's list"; "The creature schema: behaviour, group and den fields; the hare, the crow, the roe deer and the wolf as data; the wild's check rows" (a coat is look only); "The 3D door leaves the home page while 3D is paused; /play3d stays served".
- DECISIONS 2026-10-31 "The animals' look: three-tone shading, no outline, at the 3/4 camera"; "Animals wear no outline: the creatures group leaves the ink rule".
- GAME_RULES G34, G39, G40, G41, G42, G43, G44, G45, G102, and section 8's check rows; R8, R9, R11, R12.
- PROGRESSION 3.3, 4.2, 4.3, 5.1-5.7, 7; BODY_CLOCKS 6.1-6.2; EQUIPMENT 3.2-3.7; NATURE 1 (#509); PATHS 3, 4, 5 (#492); MATERIALS 1-4 and 8 (#432, proposed); GAP_RDR2 question 7 (#432, proposed); ART_SYSTEM step 3; WEAPONS 1, 5.4, 7, 8, 8.1, 15, 16, 17; QUARRYING 3, 6, 7; GAP_RS_GEAR 3 and question 2; AGENTS.md:19, :22, :32-33, :40, :45; CONTRIBUTING.md:35.

Outside (read 31.10.2026), each for the row that cites it:
- Old School RuneScape wiki, Tanner: hides tanned into leather for coins. https://oldschool.runescape.wiki/w/Tanner
- Old School RuneScape wiki, Crafting: spinning wool and flax, leather items at rising levels. https://oldschool.runescape.wiki/w/Crafting
- Old School RuneScape wiki, Studded body: a level requirement to equip. https://oldschool.runescape.wiki/w/Studded_body
- Old School RuneScape wiki, Dye: dyes and what they colour. https://oldschool.runescape.wiki/w/Dye
- Old School RuneScape wiki, Graceful outfit: a full-set bonus and recolouring. https://oldschool.runescape.wiki/w/Graceful_outfit
- Old School RuneScape wiki, Item degradation: degrading equipment and its repair. https://oldschool.runescape.wiki/w/Item_degradation
- Old School RuneScape wiki, Equipment: the worn places. https://oldschool.runescape.wiki/w/Equipment

## Appendix: the build list

What the wave builds at tiers 1 to 3, in two parts (section 6, "Before the take verb"): the table below now, and the Waits table "For the take verb" with or right after that verb's kernel pull request. Both rest on the equipment foundations pull request (`wear.req`, `wear_req_level`, `wearOwnTier`, the gates on `attrs` and `trait`): every `req { ... }` below and the `wornValue` row land after it; until then a tier-2 or tier-3 piece builds without its `req` and passes today's check (no `Wear` field `req` exists yet, schema/src/index.ts:165-202). Every recipe row's `family` needs the schema row first. Item values are the hand computation of section 4.3; `pnpm check` computes the same and holds R11, and the lock is left to a core maintainer (CONTRIBUTING.md:35; AGENTS.md:45): a new id passes without a lock entry (tools/src/check.ts:659). New items live in `content/core/items/garments.json` (new) unless the row says otherwise; every recipe file is `content/core/recipes/<id>.json`, as built. Sprites are stand-in kit icons (CR-30), as the reed hat uses `core/base-kit:items/basket`; scraps use `core/base-kit:items/stew-scrap`. Both are built `items/` sprites, so the wave owes no `scale` (NATURE 1, #509) and adds nothing to the ink check (section 13).

| Kind | Id | Class | Tier | Rarity | Inputs or fields | Station and profession | Source or placement | Test that proves it |
|---|---|---|---|---|---|---|---|---|
| schema field | `RecipeBody.family` | - | - | - | optional Word: the craft family inside its profession (conflict 16) | - | schema/src/index.ts:444-458; `pnpm schemas` | schema test: `family: "leather"` validates; `"Leather"` fails the Word pattern |
| schema field | `ProfessionBody.families` | - | - | - | optional Word array, 1 to 12, unique | - | schema/src/index.ts:1096 | schema test: accepted; a repeated word fails |
| profession content | `core/handcraft` | - | - | - | `families: ["cloth", "leather", "reed"]` | - | content/core/professions/handcraft.json | `pnpm check` (section 17, row 1 reads it) |
| kernel function | `wornStep(bundle, value)` | - | - | - | 1 up to `wear_effect_max_pct[0]`, 2 up to `[1]`, else 3; integer | - | kernel/src/state.ts beside `wornValue` (:645); read by game/src/ui/panels.ts:342, :560; the tool line :583 in words | kernel test: 5 -> 1, 6 -> 2, 8 -> 2, 9 -> 3; a client test: no "%" in the kit panel's text |
| kernel function | `wornValue` reads the soft requirement | - | - | - | per piece `min(value, wear_effect_max_pct[own + 1])` below its tier (`wearOwnTier`, foundations); the set bonus from active values; KERNEL_VERSION minor step | - | kernel/src/state.ts:653-670 | kernel test on fixture pieces: a tier-3 piece (dig 9, req digging 11) at digging 1 -> 8, at 6 -> 9; a tier-2 piece at 5 at level 1 -> 5; the reed-walker whole -> 12; the reed coat (gather 8) -> 8 at any level |
| check row | family declared | - | - | - | section 17, row 1 | - | tools/src/check.ts, recipe loop (:401-441) | fixture: a Handcraft recipe with `family: "unlisted"`, a word no profession declares, fails with exactly this row |
| check row | the three families from tier 2 are found | - | - | - | section 17, row 2 | - | tools/src/check.ts, recipe loop | fixture: a start-known tier-2 leather recipe fails; the built reed hat (no family) passes |
| check row | set under the cap | - | - | - | section 17, row 3 | - | tools/src/check.ts, checkWear's set loop (:533-550) | fixture: two tier-2 pieces at 8 each (16 + 3 = 19 > 16) fail; the reed-walker passes, and the two leather sets of section 8 when they land |
| check row | no common or legendary piece in a set | - | - | - | section 17, row 4 | - | checkWear | fixture: a common piece with `set` fails; a legendary piece with `set` fails |
| check row | a set is one family of one class | - | - | - | section 17, row 5 | - | checkWear's set loop | fixture: a hare-leather cap and a roe-leather boot in one set fail; a leather cap and a reedwork shoe fail |
| check row | a worn output never gains weight | - | - | - | section 17, row 6 | - | recipe loop | fixture: a hood of weight 3 from inputs of weight 1 fails; herb tea (not worn) passes |
| class | `core/reedwork` | base `garment` | - | - | "Woven from reed cord and mat." | - | garments.json `classes` | `pnpm check`: G45's class row holds |
| item edit | `core/reed-hat`, `core/reed-sandals` | `garment` -> `core/reedwork`, family `reed` | 2 | uncommon | class and family only; effects, set and recipes unchanged | - | content/core/recipes/reed-hat.json, reed-sandals.json | `pnpm check`: set row 5 passes; no value moves (values.ts reads neither field) |
| item | `core/woven-reed-coat` | `core/reedwork`, `reed` | 3 | uncommon | `wear { top, gather_speed_pct 8, req { core/foraging, 11 } }`, weight 2; 31332 | - | garments.json | V-2: computed uncommon; tier 3 from a gated source: its recipe's band, level 6 (G41) |
| recipe | `core/woven-reed-coat` | - | 3 | - | `core/woven-mat` 1, `core/dyed-cord` 1 -> 1; 7000; level 6; found; `reed` | workshop 3; Handcraft | woven-reed-coat.json | band 6-9; one-tier climb from tier 2; CR-16 margin 1703 |
| item | `core/reed-coat-scrap` | `relic`, kind `fragment`, family `scrap` | 1 | rare | `fragment { unlocks: core/woven-reed-coat }`, weight 1 | - | ruins-deep.json `items` | V-2: computed rare (chance 4); the teacher row (WEAPONS 16) passes |
| node | `core/ruins-deep` finds | - | - | - | append the reed coat's scrap at `chance_pct` 4, `share_pct` 1; shares 45/40/14 for coin, idol, shard; chances sum 59; rows 4 of 8 | - | content/core/treasures/ruins-deep.json | `pnpm check` (schema row cap; R11: no locked value moves, the shard from here 3220 stays above the gate's 2520); a kernel test digs with a fixed seed and reads the scrap at its edge (55 to 59) |

Size: 60 rows in two parts. Now, 17: 2 schema fields, 1 profession content row, 2 kernel functions, 6 check rows, 1 class, 1 item edit, 2 new items (the reed coat and its scrap) with 1 recipe, and 1 find-table row. With the take verb, 43: 2 classes, 1 item edit, 22 new items (6 tier-1 materials, the boiled leather, 9 garments, 6 scraps) with their 16 recipes, and 2 find-table rows. No new param: every number added reads a built one (`wear_effect_max_pct`, `wear_set_bonus_pct`, `tier_min_level`, `craft_chance_bp`) or the foundations' `wear_req_level`. The order now: the schema and check rows first; then the reed pair's class, the reed coat with its scrap and the deep ruins' row; `wornStep` and the panel with any of them; the `wornValue` row and the reed coat's `req` after the equipment foundations pull request. With the take verb: the classes, the raw hides' family, the materials and the tier-1 pieces; then the found pieces with their scraps and the two find rows. Each content pull request is proven by `pnpm check` and its tests and leaves the value lock alone.

### Waits

**For the take verb (docs/design/HUNTING.md:9; GAP_RS_GEAR question 2, default A).** These rows land with or right after its kernel pull request, in the order above; their numbers are those of sections 4.3 and 6.

| Kind | Id | Class | Tier | Rarity | Inputs or fields | Station and profession | Source or placement | Test that proves it |
|---|---|---|---|---|---|---|---|---|
| class | `core/leather` | base `garment` | - | - | "Cut from tanned hide, hair off." | - | garments.json `classes` | `pnpm check`: G45's class row holds |
| class | `core/fur` | base `garment` | - | - | "Cut from tanned hide, hair on." | - | garments.json | the same |
| item edit | `core/hare-hide`, `core/roe-hide`, `core/wolf-hide` | `core/hide`, family `hare`, `roe`, `wolf` | 1, 1, 3 | as built | family only | - | content/core/items/goods.json:57, :93, :126 | `pnpm check`; no value moves |
| item | `core/scraped-hare-hide` | `core/hide`, family `hare`, tag `scraped` | 1 | common | material, weight 1; value 20960 | - | garments.json | `pnpm check` |
| recipe | `core/scrape-hare-hide` | - | 1 | - | `core/hare-hide` 1, `core/stone-flakes` 1 -> 1; 6000 ms; level 1; start; family `leather` | workshop tier 1; Handcraft | scrape-hare-hide.json | `pnpm check`: band 1-2, CR-16 margin 4800 |
| item | `core/scraped-roe-hide` | `core/hide`, `roe`, `scraped` | 1 | common | weight 1; 28640 | - | garments.json | `pnpm check` |
| recipe | `core/scrape-roe-hide` | - | 1 | - | `core/roe-hide` 1, `core/stone-flakes` 1 -> 1; 6000; level 1; start; `leather` | workshop 1; Handcraft | scrape-roe-hide.json | CR-16 margin 4800 |
| item | `core/hare-leather` | `core/hide`, `hare`, `tanned` | 1 | common | weight 1; 24760 | - | garments.json | `pnpm check` |
| recipe | `core/tan-hare-leather` | - | 1 | - | `core/scraped-hare-hide` 1, `core/herb` 1 -> 1; 4000; level 1; start; `leather` | workshop 1; Handcraft | tan-hare-leather.json | CR-16 margin 3200 |
| item | `core/hare-fur` | `core/hide`, `hare`, tags `tanned`, `fur` | 1 | common | weight 1; 24760 | - | garments.json | `pnpm check` |
| recipe | `core/tan-hare-fur` | - | 1 | - | `core/scraped-hare-hide` 1, `core/herb` 1 -> 1; 4000; level 1; start; `cloth` | workshop 1; Handcraft | tan-hare-fur.json | CR-16 margin 3200 |
| item | `core/roe-leather` | `core/hide`, `roe`, `tanned` | 1 | common | weight 1; 32440 | - | garments.json | `pnpm check` |
| recipe | `core/tan-roe-leather` | - | 1 | - | `core/scraped-roe-hide` 1, `core/herb` 1 -> 1; 4000; level 1; start; `leather` | workshop 1; Handcraft | tan-roe-leather.json | CR-16 margin 3200 |
| item | `core/sinew-thread` | `core/sinew`, no family (docs/design/MATERIALS.md:21), tag `thread` | 1 | common | weight 0; 3630 | - | garments.json; owned here, WEAPONS 5.4 cites it and builds `core/sinew-cord` on it | `pnpm check` |
| recipe | `core/sinew-thread` | - | 1 | - | `core/roe-sinew` 1 -> 2; 3000; level 1; start; `leather` | workshop 1; Handcraft | sinew-thread.json | CR-16 margin 2400 |
| item | `core/boiled-leather` | `core/hide`, `roe`, `tanned`, `boiled` | 2 | uncommon | weight 1; 38040 | - | garments.json | V-2: computed uncommon (found, +1) |
| recipe | `core/boil-leather` | - | 2 | - | `core/roe-leather` 1, `core/branch` 1 -> 1; 5000; level 3; found; `leather` | workshop 2; Handcraft | boil-leather.json | band 3-5; one-tier climb; CR-16 margin 3880 |
| item | `core/hare-fur-hood` | `core/fur`, family `hare` | 1 | common | `wear { head, craft_speed_pct 5 }`, weight 1; 32390 | - | garments.json | checkWear: under the tier-1 cap; a kernel test wears it: `wornValue('craft_speed_pct')` 5 |
| recipe | `core/hare-fur-hood` | - | 1 | - | `core/hare-fur` 1, `core/sinew-thread` 1 -> 1; 5000; level 1; start; `cloth` | workshop 1; Handcraft | hare-fur-hood.json | CR-16 margin 4000 |
| item | `core/roe-leather-jerkin` | `core/leather`, `roe` | 1 | common | `wear { top, dig_speed_pct 5 }`, weight 1; 44500 | - | garments.json | checkWear |
| recipe | `core/roe-leather-jerkin` | - | 1 | - | `core/roe-leather` 1, `core/sinew-thread` 2 -> 1; 6000; level 2; start; `leather` | workshop 1; Handcraft | roe-leather-jerkin.json | CR-16 margin 4800 |
| item | `core/roe-leather-leggings` | `core/leather`, `roe` | 1 | common | `wear { legs, dig_speed_pct 5 }`, weight 1; 44500 | - | garments.json | checkWear |
| recipe | `core/roe-leather-leggings` | - | 1 | - | as the jerkin | workshop 1; Handcraft | roe-leather-leggings.json | CR-16 margin 4800 |
| item | `core/hare-leather-shoes` | `core/leather`, `hare` | 1 | common | `wear { feet, dig_speed_pct 5 }`, weight 1; 32390 | - | garments.json | checkWear |
| recipe | `core/hare-leather-shoes` | - | 1 | - | `core/hare-leather` 1, `core/sinew-thread` 1 -> 1; 5000; level 1; start; `leather` | workshop 1; Handcraft | hare-leather-shoes.json | CR-16 margin 4000; a kernel test runs the chain from a hare and a roe to the worn shoes |
| item | `core/fur-lined-cloak` | `core/fur`, `hare` | 2 | uncommon | `wear { top, craft_speed_pct 5, req { core/handcraft, 6 } }`, weight 2; 51590 | - | garments.json (`req` after the foundations) | V-2: computed uncommon; checkWear |
| recipe | `core/fur-lined-cloak` | - | 2 | - | `core/hare-fur` 1, `core/woven-mat` 1, `core/sinew-thread` 1 -> 1; 7000; level 4; found; `cloth` | workshop 2; Handcraft | fur-lined-cloak.json | CR-16 margin 1634; weight 2 = inputs 2 |
| item | `core/boiled-leather-cap` | `core/leather`, `roe` | 2 | uncommon | `wear { head, dig_speed_pct 5, set core/digger-leathers, req { core/digging, 6 } }`, weight 1; 46670 | - | garments.json | V-2: computed rare, declared uncommon (one rank) |
| recipe | `core/boiled-leather-cap` | - | 2 | - | `core/boiled-leather` 1, `core/sinew-thread` 1 -> 1; 5000; level 4; found; `leather` | workshop 2; Handcraft | boiled-leather-cap.json | CR-16 margin 3274 |
| item | `core/boiled-leather-boots` | `core/leather`, `roe` | 2 | uncommon | `wear { feet, dig_speed_pct 5, set core/digger-leathers, req { core/digging, 6 } }`, weight 1; 47670 | - | garments.json | set rows: 12 within 16; one class, one family |
| recipe | `core/boiled-leather-boots` | - | 2 | - | `core/boiled-leather` 1, `core/sinew-thread` 1 -> 1; 6000; level 5; found; `leather` | workshop 2; Handcraft | boiled-leather-boots.json | CR-16 margin 4074 |
| item | `core/hardened-jerkin` | `core/leather`, `roe` | 3 | rare | `wear { top, dig_speed_pct 9, rare_find_pct 9, set core/hardened-leathers, req { core/digging, 11 } }`, weight 2; 70870 | - | garments.json | V-2: computed rare; checkWear: 9 under 12 |
| recipe | `core/hardened-jerkin` | - | 3 | - | `core/boiled-leather` 1, `core/woven-mat` 1, `core/sinew-thread` 1 -> 1; 13000; level 7; found; `leather` | workshop 3; Handcraft | hardened-jerkin.json | CR-16 margin 1509; 13000 within `max_action_ms` |
| item | `core/hardened-breeches` | `core/leather`, `roe` | 3 | rare | `wear { legs, dig_speed_pct 9, rare_find_pct 9, set core/hardened-leathers, req { core/digging, 11 } }`, weight 2; 70870 | - | garments.json | set rows: 21 within 24, both effects |
| recipe | `core/hardened-breeches` | - | 3 | - | as the jerkin | workshop 3; Handcraft | hardened-breeches.json | CR-16 margin 1509 |
| item | `core/boil-leather-scrap` | `relic`, kind `fragment`, family `scrap` | 1 | uncommon | `fragment { unlocks: core/boil-leather }`, weight 1 | - | ruins-gate.json `items` | V-2: computed rare (chance 5), declared uncommon |
| item | `core/fur-cloak-scrap` | as above | 1 | uncommon | unlocks `core/fur-lined-cloak` | - | ruins-gate.json | as above |
| item | `core/leather-cap-scrap` | as above | 1 | uncommon | unlocks `core/boiled-leather-cap` | - | ruins-gate.json | as above |
| item | `core/leather-boots-scrap` | as above | 1 | uncommon | unlocks `core/boiled-leather-boots` | - | ruins-gate.json | as above |
| item | `core/hard-jerkin-scrap` | as above | 1 | rare | unlocks `core/hardened-jerkin` | - | ruins-deep.json | V-2: computed rare (chance 4) |
| item | `core/hard-breeches-scrap` | as above | 1 | rare | unlocks `core/hardened-breeches` | - | ruins-deep.json | as above |
| node | `core/ruins-gate` finds | - | - | - | append the four tier-2 scraps at `chance_pct` 5, `share_pct` 1; shares 38/29/29 for shard, coin, stew scrap; chances sum 95; rows 7 of 8 | - | content/core/treasures/ruins-gate.json | `pnpm check` (schema row cap; R11 at most 5 percent: the shard 2520 to 2394, the coin 6300 to 6090, the stew scrap 9450 to 9135); a kernel test digs with a fixed seed and reads a scrap at its edge (75 to 80) |
| node | `core/ruins-deep` finds | - | - | - | append the two tier-3 hide scraps at `chance_pct` 4, `share_pct` 1; shares 44/40/13 for coin, idol, shard; chances sum 67; rows 6 of 8 | - | content/core/treasures/ruins-deep.json | `pnpm check`: the idol keeps 36800, the coin (6746) and the shard (2990) from here stay above the gate's; a kernel test as above (edges 59 to 63, 63 to 67) |

- **For the owner's answer:** the `hands` place and the studded gloves (question 1; until it is answered the foundations list `ice_grip` on the feet only); worn pieces drawn on the body at stage 6 and ART_SYSTEM.md:56's amendment (question 2); a hide's colour moved by dye (question 3); cloth from a valley fibre (question 4); any outfit content (question 5).
- **For the readers of the equipment foundations pull request (the stats panel, the attribute callers):** `attrs` on the six pieces of section 7.5.
- **For the rules pull request that writes G34 as Q8 declared, and the place conditions (BODY_CLOCKS 5):** the trait pieces of section 7.6 (the lined fur hood, the high hare boots, the sun reed coat with its scrap as the deep ruins' 7th row, the studded shoes), the stone studs `core/stone-studs`, and `wear.trait` on them; `storm_proof` after an oil or a wax.
- **For #432 (MATERIALS):** the tanning rack and the cure (its question 5), then the three tan recipes move and the rack becomes a Handcraft place; bag spoil of a raw hide (3.6); graded hides (its question 1) and `min_grade` inputs; M4, one template per garment with a tag or stage filter on `ClassInput`, `template_max_recipes` (content/core/params.json:99), and with it `TemplateBody.family` and its copy in the assembler (tools/src/assemble.ts:488-501); M5's `grade_quality_bp`; the atlas's hides (sheep, goat, marmot, boar, adder, wildcat, wolf, bear) and their pieces.
- **For the hunt stream, after #432 lands (DECISIONS 2026-10-30 "The hide carries the coat", retry):** the coat per hide and per garment (section 10), M4 first by this page's advice; the moonreed variant of a reed piece.
- **For the hunters (G34, G35; MATERIALS 2.3):** wolf leather and wolf fur (there are no wolf spots today), and the bear's.
- **With QUARRYING's ochre item, in one pull request, at the drawing pick (question 2):** `core/earth-dyed-cord` (section 10).
- **For the tree's `family` key and its reader:** the nodes `hide-work` and `steady-needle` (section 6.1).
- **For the quality pull request:** `quality_pct`, the nodes `even-cut` and `close-stitch` (section 6.1), the quality twins, the roll, and PROGRESSION 5.7's plain floor (section 7.2).
- **For the PATHS floor (section 6.2):** the tanning rack as a place; one quest pitch from `hide-work` through the quest-designer skill.
- **For the school split (PROGRESSION 4.2):** Tailoring and Leatherwork take their family's recipes by `profession` once a family holds the PATHS floor; their nodes `light_cut`, `dye_fast`, `trait_sew`, `tan_yield`; the upgrade recipe that lifts a piece a tier and consumes it (CR-20); the built reed recipes take family `reed` with CR-61, which makes the tier-2 ones found.
- **For the repair loop and the settlement (DECISIONS 2026-10-23, open ends 1 and 5):** a repair quest or settlement step that asks for garments, a sink of finished pieces (section 12).
- **For combat (G35; COMBAT):** `guard_pct` and `quiet_wear` as worn effects, and the `req` attribute threshold of armour.
- **For metal (G45; DECISIONS 2026-10-09 "Metal: the grammar is ready, the content waits for its discovery") and the city's forge (decision 51):** tiers 4 and 5, mail and plate, `wear_effect_max_pct` [16, 20] (proposed) with `open_tiers` 4 and 5; the town's fine cloth (DECISIONS 2026-10-07, paused); the frame pack's city twins.
