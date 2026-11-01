# The gear wave's build set: one list, by pull request (2026-10-31)

Status: Proposed 31.10 by an outside developer. Nothing here is built except row 1, the jackpot's experience (#592, merged 01.11); this page merges the build lists of [CLOTHING.md](CLOTHING.md), [WEAPONS.md](WEAPONS.md) and [QUARRYING.md](QUARRYING.md) into the pull requests that build them, each on the owner's merge.

**What it does not change.** This page adds no row, number, rule, check or owner question. Every row below is its page's, with that page's numbers, inputs, test and source; the page wins over this list, and a change to a row is made on its page first. The order is GAP_RS_GEAR 11's: the docs pull request (its row 1) builds no row, so the four groups here are its rows 2 to 5.

## 1. How to read it

- Four groups, in the order they merge: the kernel fix (1 row, built: #592, merged 01.11), the equipment foundations (5 rows), the stone chain (44 rows), the clothing chain (17 rows): **67 rows**. A later group may open while an earlier one waits, but it merges after it (GAP_RS_GEAR 11).
- Each row: its number here, its kind and id as its page writes them, the page and section that design it, and the step it lands in. Inputs, numbers and the test that proves a row are in its page's appendix, under the same id.
- What waits past the wave (the take verb, combat, the first shot, metal, the mend) is section 7, counted but not listed, except rows 68 to 81 (section 7.1): WEAPONS' check rows and matrix report from the 01.11 direction, numbered after the 67 so a later pull request can cite them. They are not in the 67.

## 2. The set holds together

Checked on the merged list against the repo copy (develop ea7fc12, which holds EQUIPMENT.md and PATHS.md as landed on 31.10); the anchors are on develop 431ed550e (01.11), which adds #592, a map frame for old saves (#588) and no content:

- **One id, one owner.** Every shared thing is defined on one page and cited by the others: `core/flint`, `core/slate`, `core/greenstone`, `core/whetstone`, `core/ochre`, `core/ochre-bank` and the class `core/pigment` are QUARRYING's (2.1, 3, 6); `core/sinew-thread`, `core/stone-studs` and `core/earth-dyed-cord` are CLOTHING's (4.2, 7.6, 10); `core/sinew-cord`, `core/bow-string`, `core/bow-stave`, the `mend` mark (for tools only: a hand never wears) and `mend_below_permille` {500, 250..750, 50} are WEAPONS' (5.4, 7); `jackpot_find_rolls` {2, 1..3, 1} is QUARRYING's (4.2); `itemCategory` and the check row "a found recipe has a teacher" are WEAPONS' (appendix; 16), read by the found recipes of all three pages; the find rows at `core/ruins-gate` and `core/ruins-deep` are CLOTHING's alone (CLOTHING 6), while WEAPONS and QUARRYING dig their scraps on spots of their own, `core/hunters-cache` and `core/ruins-yard`.
- **Every item has a source.** The stone chain's materials come from its own nodes and spots (QUARRYING 2.1, 4.1, 6), which pull request 4 lands together with the items so none stands alone (QUARRYING appendix, Order); the picks' and camp parts' other inputs (branch, reed cord, stone flakes, log) are built. The clothing chain's one new piece, the woven reed coat, takes the built woven mat and dyed cord (CLOTHING 4.1). No row of the 67 needs a carcass: everything that does waits for the take verb (section 7; kernel/src/hunt.ts:2-5).
- **Every found recipe has a teacher in the set.** The flint pick, the greenstone pick and dressed stone by the three scraps of `core/ruins-yard` (QUARRYING 6); the reed coat by `core/reed-coat-scrap` at the deep ruins (CLOTHING 6). Row 6's check proves it.
- **Every tier-3 thing is gated.** Greenstone: level 6, respawn 300000, hours 6 to 18 and a required pick (QUARRYING 2.1, 2.3). Garnet: finds at chance 3 on the seam and in the glint pocket, level 6 (QUARRYING 4.1, 4.2). The glint pocket: level 6, respawn 300000. The greenstone pick and the reed coat: found recipes in the band from level 6 (G41; QUARRYING 6; CLOTHING 6).
- **One tier up at most.** Flint (1) makes the flint pick (2); slate (2) dressed stone (2); greenstone (3) the greenstone pick (3); the woven mat and dyed cord (2) the reed coat (3). Scraps are tier-1 relics. The check row is built (tools/src/check.ts:407-409).
- **The rarity budget.** Today's world uses 87697 of 100000 ppm (measured on develop ea7fc12, unchanged at 431ed550e; the 34 wild creature spots add nothing). The stone chain takes it to 97531 (proposed, QUARRYING 2.4); the clothing chain adds nothing, since its scrap is rare at a spot whose bonus is already rare's (QUARRYING 2.4); the take verb's hunters' cache adds 2000 at respawn 300000, to 99531 (WEAPONS 5.4; GAP_RS_GEAR question 1, default A).
- **The value lock.** The kernel fix moved no value (#592), and the foundations move none. The stone chain moves no locked value: stone keeps 1000, and a new spot changes no existing find table (QUARRYING 2.1, 6). The clothing chain moves none now: the deep ruins' re-split keeps the idol at 36800 and leaves the coin and the shard priced by the gate (CLOTHING 6). A new id passes without a lock entry (tools/src/check.ts:659), and the lock stays a core maintainer's (AGENTS.md:45; CONTRIBUTING.md:35).

## 3. The kernel fix (1 row)

Built: #592, merged 01.11 (kernel 0.23.0). It waited on nothing and landed first, because the stone chain's pull request 2 also touches kernel/test/grades.test.ts (GAP_RS_GEAR 11).

| # | Kind | Id | Page and section | Lands |
|---|---|---|---|---|
| 1 | kernel function | jackpot experience: `JACKPOT_XP` gone, experience x1 at every grade | QUARRYING 9; appendix, pull request 1 | built: #592, merged 01.11, alone (DECISIONS 2026-10-25 "Balance prover finding 3", its Built note) |

## 4. The equipment foundations (5 rows)

Waits on the docs pull request. No item, recipe or node and no kernel change to a step (WEAPONS appendix); one content file changes, `content/core/params.json`, with three params: `wear_req_level` and `attr_bonus_max` (CLOTHING 7.4, 7.5) and `attr_bonus_step`, the "+2 a tier" past tier 5 (PROGRESSION 5.6), all three at the top level beside `wear_effect_max_pct` (content/core/params.json:128), not in the optional `growth` group (CLOTHING 7.4, 7.5; PROGRESSION 7). WEAPONS' appendix says "no param" of its own five rows; the three are the foundation fields' below.

| # | Kind | Id | Page and section | Lands |
|---|---|---|---|---|
| 2 | schema field | `Item.weapon`, seven fields, no `uses` (a hand never wears) | WEAPONS 3, 7 | with row 3 |
| 3 | check row | weapon waits for combat | WEAPONS 3, 16 | with row 2 |
| 4 | kernel function | `itemCategory(item)`: look, weapon, tool (a `tool` or `ammo` block), wear, consumable (food), quest (fragment, treasure), material | WEAPONS 6 (ammunition's category), 13 and appendix (the order); EQUIPMENT 3.1 | with row 5, its first reader |
| 5 | check row | shop by derived category | WEAPONS 13, 16 | with row 4 |
| 6 | check row | a found recipe has a teacher | WEAPONS 5, 16 | any time in the group |

The same pull request builds the fields the pages name as the foundations' and do not list as rows: `wear.req { school, level, attr? }`, the param `wear_req_level` [1, 6, 11, 16, 21] and the reader `wearOwnTier` (EQUIPMENT 3.3; PROGRESSION 5.6; CLOTHING 7.4); `wear.attrs`, `attr_bonus_max` with its step past tier 5, `attr_bonus_step` (PROGRESSION 5.6), and `attrTotal`, unwired and refused in content until their reader (CLOTHING 7.5); `wear.trait`, refused until G34's rewrite and the first place condition land (CLOTHING 7.6, 16 row 1); `bind` on the item, not in `wear`, with no reader, and only a look binds (EQUIPMENT 3.6; CLOTHING 11). Rows 62 and 67 read them, so the clothing chain's `req` and `wornValue` land after this group.

## 5. The stone chain (44 rows)

Waits on the kernel fix (GAP_RS_GEAR 11), merged 01.11 (#592), and for its content on QUARRYING questions 4 and 5 (default A each). Three pull requests, in this order (QUARRYING appendix, Order).

| # | Kind | Id | Page and section | Lands |
|---|---|---|---|---|
| 7 | kernel function | the one work predicate, with `playsMinigame` | QUARRYING 10 | QUARRYING pull request 2 |
| 8 | kernel function | grade 3 on automatic work | QUARRYING 10 | pull request 2 |
| 9 | kernel function | `bestTool` tie rule | QUARRYING 6 | pull request 2, before rows 14 to 17 |
| 10 | check row | tool without `work: "mine"` | QUARRYING 2, 16 row 1 | pull request 2 |
| 11 | check row | required tool reachable | QUARRYING 2, 16 row 2 | pull request 2 |
| 12 | check row | cover rocks, with the eight cover swaps (five stone, three reed) | QUARRYING 12, 16 row 6 | pull request 2 |
| 13 | check row | creature spots stay clear | QUARRYING 8, 16 row 7 | pull request 2 |
| 14 | item | `core/hammerstone` | QUARRYING 6 | pull request 2 |
| 15 | item | `core/knapped-pick` | QUARRYING 6 | pull request 2 |
| 16 | recipe | `core/hammerstone` | QUARRYING 6 | pull request 2 |
| 17 | recipe | `core/knapped-pick` | QUARRYING 6 | pull request 2 |
| 18 | schema field | `ResourceBody.finds` | QUARRYING 4.2 | QUARRYING pull request 3 |
| 19 | kernel function | `pickFind(finds, roll, gradePct, luckPermille, rankOf)` | QUARRYING 4.2 | pull request 3 |
| 20 | kernel function | side finds in `gather` | QUARRYING 4.2, 9 (the jackpot's one more draw) | pull request 3 |
| 21 | kernel function | `activitiesOf` for nodes with finds | QUARRYING 4.2 | pull request 3 |
| 22 | param | `jackpot_find_rolls` | QUARRYING 4.2, 9 | pull request 3 |
| 23 | check row | finds shape | QUARRYING 4, 16 rows 3-4 | pull request 3 |
| 24 | check row | V-2 counts node finds | QUARRYING 4, 16 row 5 | pull request 3 |
| 25 | class | `core/gem` | QUARRYING 3 | QUARRYING pull request 4 |
| 26 | item | `core/flint` | QUARRYING 2.1, 3 | pull request 4 |
| 27 | item | `core/slate` | QUARRYING 2.1 | pull request 4 |
| 28 | item | `core/greenstone` | QUARRYING 2.1 | pull request 4 |
| 29 | item | `core/dressed-stone` | QUARRYING 7 | pull request 4 |
| 30 | item | `core/rock-crystal` | QUARRYING 3, 4.1, 4.2 | pull request 4 |
| 31 | item | `core/agate` | QUARRYING 3, 4.1 | pull request 4 |
| 32 | item | `core/garnet` | QUARRYING 3, 4.1, 4.2 | pull request 4 |
| 33 | item | `core/flint-pick` | QUARRYING 2.2, 6 | pull request 4 |
| 34 | item | `core/greenstone-pick` | QUARRYING 2.2, 6 | pull request 4 |
| 35 | item | `core/flint-pick-scrap`, `core/dressed-stone-scrap`, `core/greenstone-pick-scrap` | QUARRYING 6 | pull request 4 |
| 36 | recipe | `core/flint-pick` | QUARRYING 6 | pull request 4 |
| 37 | recipe | `core/greenstone-pick` | QUARRYING 6 | pull request 4 |
| 38 | recipe | `core/dressed-stone` | QUARRYING 7 | pull request 4 |
| 39 | map slot | `core/scree-fan` | QUARRYING 8 | pull request 4 |
| 40 | map slot | `core/slate-ledge` | QUARRYING 8 | pull request 4 |
| 41 | map slot | `core/greenstone-seam` | QUARRYING 8 | pull request 4 |
| 42 | map slot | `core/glint-pocket` | QUARRYING 8 | pull request 4 |
| 43 | map slot | `core/ruins-yard` | QUARRYING 8 | pull request 4 |
| 44 | node | `core/scree-fan` | QUARRYING 2.1 | pull request 4 |
| 45 | node | `core/slate-ledge` | QUARRYING 2.1 | pull request 4 |
| 46 | node | `core/greenstone-seam` | QUARRYING 2.1, 2.2, 2.3 | pull request 4 |
| 47 | node (dig spot) | `core/glint-pocket` | QUARRYING 4.1 | pull request 4 |
| 48 | node (dig spot) | `core/ruins-yard` | QUARRYING 6 | pull request 4 |
| 49 | camp part | `core/stone-store` | QUARRYING 7 | pull request 4 |
| 50 | camp part | `core/stone-hearth` | QUARRYING 7 | pull request 4 |

Pull request 2 holds 11 rows, pull request 3 holds 7 and pull request 4 holds 26. Rows 25 to 50 cannot pass apart (QUARRYING appendix, Order).

## 6. The clothing chain (17 rows)

Waits on the equipment foundations for row 62's `req` and row 67 (GAP_RS_GEAR 11); the rest waits on nothing but the docs pull request. These are CLOTHING's rows before the take verb (CLOTHING 6, "Before the take verb"; GAP_RS_GEAR question 2, default A).

| # | Kind | Id | Page and section | Lands |
|---|---|---|---|---|
| 51 | schema field | `RecipeBody.family` | CLOTHING 6, 16 row 16 | first |
| 52 | schema field | `ProfessionBody.families` | CLOTHING 6 | first |
| 53 | profession content | `core/handcraft`, `families: ["cloth", "leather", "reed"]` | CLOTHING 6 | after rows 51 and 52 |
| 54 | check row | family declared | CLOTHING 17 row 1 | with the schema rows |
| 55 | check row | the three families from tier 2 are found | CLOTHING 16 row 5, 17 row 2 | with the schema rows |
| 56 | check row | set under the cap | CLOTHING 8, 17 row 3 | with the schema rows |
| 57 | check row | no common or legendary piece in a set | CLOTHING 8, 17 row 4 | with the schema rows |
| 58 | check row | a set is one family of one class | CLOTHING 8, 17 row 5 | with the schema rows |
| 59 | check row | a worn output never gains weight | CLOTHING 7.7, 17 row 6 | with the schema rows |
| 60 | class | `core/reedwork` | CLOTHING 3 | content |
| 61 | item edit | `core/reed-hat`, `core/reed-sandals` to `core/reedwork`, family `reed` | CLOTHING 3, 8 | content |
| 62 | item | `core/woven-reed-coat` | CLOTHING 4.1, 5, 7.5 | content; its `req` after the foundations |
| 63 | recipe | `core/woven-reed-coat` | CLOTHING 4.1, 6 | content |
| 64 | item | `core/reed-coat-scrap` | CLOTHING 6 | content |
| 65 | node | `core/ruins-deep` finds: the reed coat's scrap, shares 45/40/14 | CLOTHING 6 | content |
| 66 | kernel function | `wornStep(bundle, value)` | CLOTHING 14 | with any of them |
| 67 | kernel function | `wornValue` reads the soft requirement | CLOTHING 7.4, 8 | last, after the foundations |

## 7. What waits past the wave

Counted, not listed, except the numbered rows of section 7.1; each page's Waits holds the rows.

| For | Rows | Where |
|---|---|---|
| The take verb's kernel pull request (docs/design/HUNTING.md:9) | 62: CLOTHING's hide pieces, 43 (2 classes, the raw hides' family, 22 items, 16 recipes, 2 find rows), and WEAPONS' take tools with the hunters' cache, 19 (the bow and the cache also need the bow's first arrow, a feather item: WEAPONS 5.4 and its Waits) | CLOTHING appendix, Waits "For the take verb"; WEAPONS appendix, Waits "For the take verb" |
| Combat (G35, G44) | rows 68 to 76 (section 7.1; row 69 also waits for the first mend recipe, row 76 for GROWTH's technique format); not counted: the `combat` params, `handHarmMax`, `dual_use`, `weapon.trait?`, every weapon item and recipe, the found weapons and signature techniques, the first predator laid as a foe, the fight's other check rows | WEAPONS appendix, Waits "For combat" |
| The first shot (the take verb or combat, whichever spends a shot first) | rows 77 to 79 (section 7.1); not counted: the `ammo` block, its kernel read, the two ammunition classes and the assemble row the `ammo` block needs, the sling's loose stone as a shot, `core/shaped-stones`, the quiver | WEAPONS 6 and Waits "For the first shot" |
| A feather item | not counted: the arrows of WEAPONS 6.2, and with them the bow | WEAPONS Waits "For a feather item" |
| The first weapon content | rows 80 and 81 (section 7.1) | WEAPONS 5.5 and Waits "For the first weapon content" |
| The first mend recipe | the `mend` mark, for tools only (no hand is mended), `mend_below_permille`, `core/whetstone`, the mend recipes of the picks, trowels, axe and snare; row 69 (section 7.1) if it lands after combat | WEAPONS 7 and Waits; QUARRYING 6 and Waits |
| Metal and the city (G45; decision 51) | tiers 4 and 5 on all three pages | CLOTHING 5; WEAPONS 5.1; QUARRYING 13 |
| The owners' answers | each page's questions | CLOTHING 18; WEAPONS 17; QUARRYING 17; GAP_RS_GEAR 12 |

### 7.1 Rows 68 to 81: WEAPONS' rows from the 01.11 direction, past the wave

The check rows the direction added to WEAPONS 16 and the matrix report of WEAPONS 5.5. None is in the wave's 67 and none lands before what it waits for; each is WEAPONS' and follows its owner question's default (WEAPONS 17: question 7 for rows 68 and 69, 10 for the ammunition rows 70 to 72 and 77 to 79, 11 for rows 73 to 75, 8 for row 76, 12 for rows 80 and 81). Another answer changes a row on WEAPONS first, then here.

| # | Kind | Id | Page and section | Lands |
|---|---|---|---|---|
| 68 | check row | a hand states no `uses`: no `tool.uses` on an item with a `weapon` block | WEAPONS 7, 16 | combat: the pull request that lifts row 3 |
| 69 | check row | no `mend` recipe on a hand | WEAPONS 7, 16 | combat or the first mend recipe, whichever lands later (it reads the `mend` mark) |
| 70 | check row | launcher and ammunition agree: the `weapon.ammo` class (`core/arrow` for the bow, `core/sling-stone` for the sling) holds only ammunition whose `for` is the launcher's class | WEAPONS 3, 6, 16 | combat |
| 71 | check row | the harm sum: `harm_add` within its head's share of its tier's top, and the launcher's `harm` plus any `harm_add` it may fire within `handHarmMax` | WEAPONS 4, 6.1, 16 | combat |
| 72 | check row | the range sum: a launcher's `range` plus any `range_add` it may fire at most 12 | WEAPONS 6, 16 | combat |
| 73 | check row | no worn effect of `WORN_EFFECTS` on a weapon | WEAPONS 8.1, 16 | combat |
| 74 | check row | a weapon's bonus by its band: `wear.attrs` or `weapon.trait` only on a found weapon of tier 2 or more, not common, never made or sold, within its band's row | WEAPONS 8.1, 16 | combat |
| 75 | check row | a weapon trait from its class's list | WEAPONS 8.1, 16 | combat, with `weapon.trait?` |
| 76 | check row | signature techniques: a found weapon of tier 3 or more and rare or more, one technique an item, one weapon a class a tier | WEAPONS 9.1, 15, 16 (owner question 8, default B) | combat, once GROWTH's technique format has landed as WEAPONS 15 amends it (GROWTH 3.5, 4.2, 4.3, 4.5) |
| 77 | check row | an ammunition head from its class's list | WEAPONS 6.1, 16 | the first shot |
| 78 | check row | no ammunition above every launcher of its `for` class | WEAPONS 6.1, 16 | the first shot |
| 79 | check row | every launcher tier has a shot (the sling's loose stone counts) | WEAPONS 6.1, 16 | the first shot; it holds the bow until its first arrow, a feather item |
| 80 | report | `pnpm weapons`: class by tier and the ammunition matrix (tools/src/balance/weapons.ts and its CLI) | WEAPONS 5.5 | the first weapon content |
| 81 | test | the matrix page equals the print (tools/test/weapons.test.ts) | WEAPONS 5.5, 16 | with row 80 |

Rows 68 and 70 to 75 land together, in the pull request that lifts row 3 (WEAPONS appendix, Waits "For combat"), so each fixture fails only its own row; row 69 reads the `mend` mark, so it lands with them if the first mend recipe came first, else in the first mend recipe's pull request; row 76 lands once combat and GROWTH's technique format have both landed; rows 77 to 79 with the `ammo` block; rows 80 and 81 together.

## 8. New against existing rules

None from this page. The conflicts are the pages' own: CLOTHING 16, WEAPONS 15, QUARRYING 15 and GAP_RS_GEAR 9.

## 9. Check rows

None from this page. Rows 3, 5, 6, 10 to 13, 23, 24 and 54 to 59 build 16 messages: WEAPONS 16 (3 now), QUARRYING 16 (7) and CLOTHING 17 (6). Past the wave, rows 68 to 79 build 12 more, all WEAPONS 16's (9 with combat: 7 in the pull request that lifts row 3, row 69 also waiting for the first mend recipe, row 76 for GROWTH's technique format; 3 with the first shot); row 81 is a test that pins row 80's print, not a message.

## 10. Owner questions

None here. Each page asks its own, and none repeats on another of the four: CLOTHING 18 (5), WEAPONS 17 (12), QUARRYING 17 (6), GAP_RS_GEAR 12 (2, the two that cross pages).

## 11. Not here

The designs, numbers, inputs and tests of each row (the three domain pages); the measure against an outside game (GAP_RS_GEAR); the docs pull request, which builds no row (GAP_RS_GEAR 11, row 1); the take verb, combat and metal themselves.

## Sources

Ours, from the repo:

- This wave's pages: CLOTHING 3, 4.1, 4.2, 5, 6, 7.4-7.7, 8, 10, 11, 14, 16-18 and the appendix; WEAPONS 3, 4, 5, 5.4, 5.5, 6, 6.1, 6.2, 7, 8.1, 9.1, 13, 15-17 and the appendix; QUARRYING 2.1-2.4, 3, 4.1, 4.2, 6-10, 12, 13, 15-17 and the appendix; GAP_RS_GEAR 9, 11, 12 and the appendix.
- EQUIPMENT 3.1, 3.3, 3.6 (#492); PROGRESSION 5.6, 7; docs/design/HUNTING.md:9.
- GAME_RULES G35, G41, G44, G45; kernel rules R11 (the drift budget) and the rarity budget (8.2).
- DECISIONS 2026-10-25 "Balance prover finding 3: the grade-4 jackpot pays 3x experience in the kernel (proposed: pay in goods, experience x1)", and its Built note (#592, 01.11).
- Code: kernel/src/hunt.ts:2-5; tools/src/check.ts:407-409, :659; content/core/params.json:128; AGENTS.md:45; CONTRIBUTING.md:35.
