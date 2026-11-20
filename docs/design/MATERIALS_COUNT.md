# Materials count: built, planned on develop, planned in the open gear pull request (#609)

Written 2026-11-01 by an outside developer for the owner, re-checked 2026-11-02. The count behind [GAP_MATERIALS.md](GAP_MATERIALS.md) and [PRODUCTION_MAP.md](PRODUCTION_MAP.md): what a material is, how many there are, in which state (built on `develop`, planned on a landed page, planned only in the open gear pull request #609), by family and by tier, with the review that set the number and the judgment calls behind it. Nothing here is built by this page.

Every number below is computed from one merged data set of three counts (the built content, the landed pages, the open gear pages), then corrected by a two-reader review (Review corrections). The data set is not committed; this page is the record.

**Rules.** A material is stuff whose role is to be an ingredient of making, raw or processed. One material is one distinct thing a player holds; grades fold into one; a raw and a cured form are two. MATERIALS' atlas animals give one plain sinew (built as `core/roe-sinew`) and one plain feather plus the fowl's down (MATERIALS 1); animals outside the atlas keep per-animal goods, as BESTIARY_LANDS names `core/dove-feather`. Status is the most-built of the sources: built > planned-landed > planned-open-pr.

**Anchors.** Repo-relative `path:line` is `develop` at ebd425b2c (02.11; the re-check below walked every anchor). `X.md:N (#609)` is a line of the open gear pages (CLOTHING, WEAPONS, QUARRYING, GAP_RS_GEAR, BUILD_SET) at their head a8e4915d1; they are not on `develop`.

## Totals

| Measure | Count |
|---|---|
| Unique materials | 158 (171 before the review) |
| built | 17 (before: 18) |
| planned-landed | 127 (before: 134) |
| planned-open-pr | 14 (before: 19) |
| raw / processed | 97 / 61 |
| Input rows (built + landed + gear) | 17 + 148 + 68 = 233 |
| Borderline (not in the total) | 55, of which 27 raw meats; call 'in' for 4; 6 moved here by the review |

Other readings:

- With the 4 borderline items called 'in' (herb (core/herb), ochre (core/ochre, proposed), chalk, charcoal): 162.
- MATERIALS 1's reading applied everywhere, one feather and one sinew for every animal: 146 (8 raw feathers and 6 raw sinews become 1 + 1).
- If HUNTING 5's words 'flint' and 'stave' are read as the new items: planned-landed 129, planned-open-pr 12 (same total).
- If the generic landed 'ore' is kept apart from iron ore: 159. Without the keystone: 157. Without steel (the rejected correction): 157. With GAP_RDR2's found fish bone as its own item: 159.

## Re-checked on 02.11

**158 holds on develop ebd425b2c and the #609 pages at a8e4915d1: built 17, planned in landed pages 127, planned only in the open gear pull request 14 (raw 97, processed 61).** No material was added, removed or moved between statuses since the count; every anchor of the 158 rows still resolves.

- **Built (17), unchanged.** Every JSON under content/ on develop was walked for item definitions: 136 ids, 36 of them `kind: "material"`. All 17 built ids are defined on develop with that kind (core/stone at content/core/resources/river-stones.json:13, core/keystone at content/core/resources/keystone.json:13, the seven goods at content/core/items/goods.json:57-137); none of the 141 planned ids is defined in content/. The other 19 `kind: "material"` ids are garments and jewelry (11; the schema has no garment kind, so a worn piece carries the material kind), consumables (3) and the five the borderline list already carries (herb in; moonreed, sunleaf, river fish, pottery shard out). Goods landed since the count: none; the landings that touch content (the tangle's oaks and mushroom nodes, DECISIONS.md:4174-4181; the extension's fig and sunleaf mushrooms) are nodes and food, not materials.
- **Planned in landed pages (127), unchanged.** Every row is still in at least one of the develop pages its sources name: 29 by the row's phrase on a line, 72 as an atlas or bestiary row carrying the animal and the part, 23 as a derived good (scraped hide, leather, fur) whose animal row and process row (docs/design/MATERIALS.md:85-87) both stand. Three rows match by the page's own words rather than the counter's name, as before: iron ore (docs/design/PROGRESSION.md:154 "the pick and ore", docs/design/CRAFTING_AUDIT.md:190 "ore from the ruins"), ash wood (docs/design/BODY_CLOCKS.md:141 "ash and gut, hide"), wooden handle (docs/design/EQUIPMENT.md:124 "Woodcraft (handles, staves)"). No new material: every core/ id in MATERIALS.md, BESTIARY_LANDS.md, HUNT_FAMILIES.md, GAP_RDR2.md and PROGRESSION.md that no row covers is a class, a node, a school or a file, and `core/hare-hide-fine` and `core/hare-hide-true` (docs/design/MATERIALS.md:22) are grades of one hide, which fold by rule.
- **Planned only in #609 (14), unchanged.** All 14 names stand on the #609 pages at a8e4915d1: bow stave (WEAPONS.md:585 (#609)), flint (QUARRYING.md:108 (#609)), boiled leather (CLOTHING.md:78 (#609)), slate and greenstone (QUARRYING.md:50-51 (#609)), dressed stone (QUARRYING.md:181 (#609)), whetstone (QUARRYING.md:176 (#609); WEAPONS.md:301 (#609)), spoil (QUARRYING.md:438 (#609)), earth-dyed cord (CLOTHING.md:296 (#609); QUARRYING.md:111 (#609)), felt (CLOTHING.md:127 (#609)), copper ore and tin ore (QUARRYING.md:97 (#609)), bronze bar (QUARRYING.md:274 (#609)), steel (QUARRYING.md:100 (#609)). The five pages name no uncounted material: the cloths of CLOTHING 3 (#609) are classes, the nine ammunition rows of WEAPONS 6.2 (#609) are made things with an `ammo` block, spent in a fight or a take, the pocket scraps are finds of kind treasure, and "lime for mortar" in the chalk row is a use named in passing with no row, recipe or class.

**Deltas (anchors only, no count change).**

1. Bronze bar: its WEAPONS.md:141 (#609) anchor now reads "Metal: copper and bronze (proposed words; QUARRYING writes the chain)", the word "bar" is gone from WEAPONS 5.1 (#609); the row holds on QUARRYING.md:274 (#609) ("2 bronze bars, tier 4") and is cited so in the metal table above.
2. Twelve anchors whose text looked moved are the generic process rows (docs/design/MATERIALS.md:85-87 scraping and tanning, :95-98 the bone components, :117 down to lining, :199-200 the atlas totals) and the bestiary's sparrow row (docs/design/BESTIARY_LANDS.md:28, the moult); each line reads today exactly as the row cites it. MATERIALS.md, BESTIARY_LANDS.md and HUNT_FAMILIES.md on ebd425b2c are line for line what the anchors describe.
3. The keystone's kind is content/core/resources/keystone.json:13 (the item); the node of the same id is :5. The keystone row's own anchors (:10, :22) stand as counted.

**What the numbers mean.** The totals every companion page agrees with stay 158 = 17 + 127 + 14, raw 97 / processed 61; the other readings above (162, 146, 157, 159) stand unchanged, since nothing they depend on moved.

## By family

| Family | built | planned-landed | planned-open-pr | total |
|---|---|---|---|---|
| stone | 4 | 1 | 6 | 11 |
| mineral | 0 | 2 | 2 | 4 |
| gem | 0 | 0 | 0 | 0 |
| metal | 0 | 1 | 2 | 3 |
| wood | 2 | 4 | 1 | 7 |
| plant-fiber | 4 | 3 | 1 | 8 |
| plant-other | 0 | 1 | 0 | 1 |
| hide-and-leather | 3 | 57 | 1 | 61 |
| bone-horn-antler | 3 | 33 | 0 | 36 |
| sinew | 1 | 9 | 0 | 10 |
| feather | 0 | 11 | 0 | 11 |
| meat-fat-organ | 0 | 1 | 0 | 1 |
| other | 0 | 4 | 1 | 5 |

## By tier

| Tier | built | planned-landed | planned-open-pr | total |
|---|---|---|---|---|
| 1 | 12 | 24 | 2 | 38 |
| 2 | 3 | 46 | 5 | 54 |
| 3 | 2 | 29 | 1 | 32 |
| 4 | 0 | 1 | 4 | 5 |
| 5 | 0 | 5 | 0 | 5 |
| 6 | 0 | 0 | 1 | 1 |
| 8 | 0 | 3 | 0 | 3 |
| unknown | 0 | 19 | 1 | 20 |

## stone (11)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| Keystone | core/keystone | raw | 1 | built | node core/keystone (no tool, level 1) at core/keystone | content/core/resources/keystone.json:10<br>content/core/resources/keystone.json:22<br>QUARRYING.md:14 (#609) |
| River stone | core/stone | raw | 1 | built | search core/branch-heap; search core/hollow-tree; node core/river-stones (no tool, level 1) at core/river-stones | content/core/resources/river-stones.json:10<br>docs/design/HUNT_LADDER.md:13<br>QUARRYING.md:13 (#609) |
| Stone flakes | core/stone-flakes | processed | 1 | built | work stone | content/core/recipes/stone-flakes.json:10<br>docs/design/MATERIALS.md:85<br>QUARRYING.md:24 (#609) |
| Stone blade | core/stone-blade | processed | 2 | built | workbench | content/core/recipes/stone-blade.json:10<br>docs/design/HUNT_LADDER.md:39<br>WEAPONS.md:139 (#609) |
| stone studs | core/stone-studs (proposed) | processed | 1 | planned-landed | workshop tier 1, 2 stone flakes -> 1 | docs/design/BODY_CLOCKS.md:143<br>CLOTHING.md:246 (#609)<br>QUARRYING.md:193 (#609) |
| flint | core/flint (proposed) | raw | 1 | planned-open-pr * | scree fan side find; ruins yard | docs/design/HUNTING.md:78<br>docs/design/HUNT_LADDER.md:39<br>QUARRYING.md:394 (#609) |
| slate | core/slate (proposed) | raw | 2 | planned-open-pr | core/slate-ledge, level 3 (the terraces on the first map) | QUARRYING.md:395 (#609)<br>QUARRYING.md:50 (#609) |
| greenstone | core/greenstone (proposed) | raw | 3 | planned-open-pr | core/greenstone-seam, level 6, hours 6 to 18, pick required | QUARRYING.md:396 (#609)<br>QUARRYING.md:51 (#609) |
| dressed stone | core/dressed-stone (proposed) | processed | 2 | planned-open-pr | workshop tier 2, 2 slate -> 1 | QUARRYING.md:397 (#609)<br>QUARRYING.md:181 (#609) |
| whetstone | core/whetstone (proposed) | processed | 2 | planned-open-pr | workshop tier 2, 1 slate | QUARRYING.md:176 (#609)<br>WEAPONS.md:301 (#609) |
| spoil (stone rubble) | - | processed | - | planned-open-pr | a second output of dressing slate | QUARRYING.md:190 (#609)<br>QUARRYING.md:438 (#609) |

## mineral (4)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| clay | - | raw | 1 | planned-landed | digging (`clay_eye`); a clay bank by the river or the tarn | docs/design/PROGRESSION.md:153<br>docs/design/CRAFTING_AUDIT.md:259<br>QUARRYING.md:110 (#609) |
| iron ore | - | raw | 5 | planned-landed | mining (a vein; 'ore from the ruins'); core/iron-vein | docs/design/PROGRESSION.md:154<br>docs/design/CRAFTING_AUDIT.md:190<br>QUARRYING.md:271 (#609) |
| copper ore | - | raw | 4 | planned-open-pr | core/copper-vein, the highland | QUARRYING.md:271 (#609)<br>QUARRYING.md:97 (#609) |
| tin ore | - | raw | 4 | planned-open-pr | core/tin-vein, across the bay | QUARRYING.md:271 (#609)<br>QUARRYING.md:97 (#609) |

## metal (3)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| iron bar | - | processed | 5 | planned-landed | the city's forge (Smithing, decision 51); the city furnace | docs/design/BODY_CLOCKS.md:143<br>DECISIONS.md:321<br>QUARRYING.md:274 (#609) |
| bronze bar | - | processed | 4 | planned-open-pr | the city furnace | QUARRYING.md:274 (#609) |
| steel | - | processed | 6 | planned-open-pr | a hotter furnace | QUARRYING.md:100 (#609) |

## wood (7)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| Dry branch | core/branch | raw | 1 | built | search core/branch-heap; search core/hollow-tree | content/core/recipes/split-log.json:10<br>docs/design/MATERIALS.md:76<br>WEAPONS.md:138 (#609) |
| Log | core/log | raw | 1 | built | node core/fallen-logs (tool axe, level 1) at core/fallen-logs + core/lone-log-1, core/lone-log-2, core/lone-log-3; node core/oak-trees (tool axe, level 1) at core/camp-oaks + core/lone-oak-1, core/lone-oak-2, core/lone-oak-3, core/lone-oak-4, core/lone-oak-5, core/lone-oak-6, core/lone-oak-7, core/lone-oak-8 | content/core/resources/oak-trees.json:10<br>docs/design/HUNT_LADDER.md:41<br>WEAPONS.md:139 (#609) |
| ash wood | - | raw | - | planned-landed | - | docs/design/BODY_CLOCKS.md:141<br>docs/design/PROGRESSION.md:511 |
| bark | - | raw | - | planned-landed | felling (Woodcutting `bark_find`) | docs/design/PROGRESSION.md:152<br>docs/design/PATHS.md:106<br>CLOTHING.md:80 (#609) |
| brush | - | raw | - | planned-landed | felling or forage | docs/design/HUNT_LADDER.md:28<br>docs/design/HUNT_FAMILIES.md:244 |
| wooden handle | - | processed | - | planned-landed | Woodcraft | DECISIONS.md:2590<br>docs/design/EQUIPMENT.md:124<br>docs/design/PROGRESSION.md:164 |
| bow stave | core/bow-stave (proposed) | processed | 2 | planned-open-pr * | workshop tier 2, 1 log -> 1 | docs/design/HUNTING.md:79<br>docs/design/HUNT_LADDER.md:47<br>WEAPONS.md:200 (#609) |

## plant-fiber (8)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| Reed | core/reed | raw | 1 | built | node core/reed-bank (no tool, level 1) at core/reed-bank | content/core/resources/reed-bank.json:10<br>docs/design/HUNT_LADDER.md:24<br>CLOTHING.md:51 (#609) |
| Reed cord | core/reed-cord | processed | 1 | built | workshop | content/core/recipes/reed-cord.json:10<br>docs/design/MATERIALS.md:98<br>CLOTHING.md:61 (#609) |
| Dyed cord | core/dyed-cord | processed | 2 | built | template dye-cord: 2 berries + 1 reed cord | content/core/templates/dye-cord.json:10<br>content/core/templates/dye-cord.json:39<br>CLOTHING.md:63 (#609) |
| Woven mat | core/woven-mat | processed | 2 | built | workshop recipe, 3 reed cord | content/core/recipes/woven-mat.json:10<br>content/core/recipes/woven-mat.json:33<br>CLOTHING.md:62 (#609) |
| linen | - | processed | 4 | planned-landed | the town | docs/design/BODY_CLOCKS.md:142<br>docs/design/BODY_CLOCKS.md:144<br>CLOTHING.md:51 (#609) |
| oiled cloth | - | processed | - | planned-landed | Tailoring | docs/design/BODY_CLOCKS.md:142 |
| rope | - | processed | - | planned-landed | basic making, every race | docs/design/HUNTING.md:80<br>DECISIONS.md:2590<br>docs/design/PROGRESSION.md:187 |
| earth-dyed cord | core/earth-dyed-cord (proposed) | processed | 1 | planned-open-pr | workshop, 1 ochre + 1 reed cord | CLOTHING.md:296 (#609)<br>QUARRYING.md:111 (#609) |

## plant-other (1)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| resin | - | raw | - | planned-landed | felling (Woodcutting `bark_find`) | docs/design/PROGRESSION.md:152<br>docs/design/PATHS.md:106 |

## hide-and-leather (61)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| Hare hide | core/hare-hide | raw | 1 | built | hunt drop of core/hare (tier 1, ways stalk/snare, 8 placed spots in core/map.json) | content/core/items/goods.json:57<br>docs/design/MATERIALS.md:38<br>CLOTHING.md:73 (#609) |
| Roe hide | core/roe-hide | raw | 1 | built | hunt drop of core/roe (tier 1, ways snare/stalk, 5 placed spots in core/map.json) | content/core/items/goods.json:93<br>docs/design/MATERIALS.md:40<br>CLOTHING.md:73 (#609) |
| Wolf hide | core/wolf-hide | raw | 3 | built | hunt drop of core/wolf (tier 3, ways fight/lure, 0 placed spots in core/map.json) | content/core/items/goods.json:126<br>docs/design/MATERIALS.md:61<br>WEAPONS.md:140 (#609) |
| ash bat hide | - | raw | 1 | planned-landed | undead south arch and hall roof, d1 | docs/design/BESTIARY_LANDS.md:70<br>docs/design/HUNT_FAMILIES.md:325 |
| barrow rat hide | - | raw | 1 | planned-landed | undead south stair and hall, d1 | docs/design/BESTIARY_LANDS.md:69<br>docs/design/HUNT_FAMILIES.md:311 |
| river otter hide | - | raw | 1 | planned-landed | elf wood banks, d1 | docs/design/BESTIARY_LANDS.md:54<br>docs/design/HUNT_FAMILIES.md:322 |
| badger hide | - | raw | 2 | planned-landed | valley edge, d1 | docs/design/HUNT_FAMILIES.md:348 |
| bone hound hide | - | raw | 2 | planned-landed | undead south hall doors, d1 | docs/design/BESTIARY_LANDS.md:73<br>docs/design/HUNT_FAMILIES.md:315 |
| dust adder hide | - | raw | 2 | planned-landed | valley rocks, d1; MATERIALS atlas (d1 to d2) | docs/design/MATERIALS.md:52<br>docs/design/BESTIARY_LANDS.md:36<br>CLOTHING.md:521 (#609) |
| highland goat hide | - | raw | 2 | planned-landed | east highland, d1; MATERIALS atlas (d1 to d2) | docs/design/MATERIALS.md:42<br>docs/design/BESTIARY_LANDS.md:34<br>CLOTHING.md:521 (#609) |
| hill sheep hide | - | raw | 2 | planned-landed | east highland, d1; MATERIALS atlas (d1 to d2) | docs/design/MATERIALS.md:41<br>docs/design/HUNT_FAMILIES.md:340<br>CLOTHING.md:521 (#609) |
| marmot hide | - | raw | 2 | planned-landed | east highland, d1; MATERIALS atlas (d1 to d2) | docs/design/MATERIALS.md:43<br>docs/design/HUNT_FAMILIES.md:338<br>CLOTHING.md:521 (#609) |
| red stag hide | - | raw | 2 | planned-landed | east highland, d1 | docs/design/HUNT_FAMILIES.md:339 |
| shade fox hide | - | raw | 2 | planned-landed | undead south, d1 | docs/design/BESTIARY_LANDS.md:72<br>docs/design/HUNT_FAMILIES.md:315 |
| silver fox hide | - | raw | 2 | planned-landed | elf wood, d1 | docs/design/BESTIARY_LANDS.md:56<br>docs/design/HUNT_FAMILIES.md:315 |
| snow fox hide | - | raw | 2 | planned-landed | east highland, d1 | docs/design/HUNT_FAMILIES.md:343 |
| stair viper hide | - | raw | 2 | planned-landed | undead south stair, d1 | docs/design/HUNT_FAMILIES.md:351 |
| tree marten hide | - | raw | 2 | planned-landed | elf wood, d1 | docs/design/BESTIARY_LANDS.md:55<br>docs/design/HUNT_FAMILIES.md:322 |
| wild boar hide | - | raw | 2 | planned-landed | valley, d1; MATERIALS atlas (d1 to d2) | docs/design/MATERIALS.md:51<br>docs/design/BESTIARY_LANDS.md:35<br>CLOTHING.md:521 (#609) |
| wood hog hide | - | raw | 2 | planned-landed | elf wood foot, d1 | docs/design/HUNT_FAMILIES.md:342 |
| brown bear hide | - | raw | 3 | planned-landed | elf wood, d2 | docs/design/HUNT_FAMILIES.md:344 |
| cinder imp hide | - | raw | 3 | planned-landed | undead south hall braziers, d1 | docs/design/BESTIARY_LANDS.md:74<br>docs/design/HUNT_FAMILIES.md:326 |
| crag ibex hide | - | raw | 3 | planned-landed | elf wood crest, d2 | docs/design/HUNT_FAMILIES.md:341 |
| tomb spider hide | - | raw | 3 | planned-landed | undead south hall corners, d1 | docs/design/BESTIARY_LANDS.md:75<br>docs/design/HUNT_FAMILIES.md:327 |
| white bear hide | - | raw | 3 | planned-landed | valley / highland, d2; MATERIALS atlas (d1 to d2) | docs/design/MATERIALS.md:62<br>docs/design/BESTIARY_LANDS.md:39<br>CLOTHING.md:521 (#609) |
| white hart hide | - | raw | 3 | planned-landed | elf wood glades, d2 | docs/design/BESTIARY_LANDS.md:58<br>docs/design/HUNT_FAMILIES.md:312 |
| wildcat hide | - | raw | 3 | planned-landed | valley, d2; MATERIALS atlas (d1 to d2) | docs/design/MATERIALS.md:53<br>docs/design/BESTIARY_LANDS.md:38<br>CLOTHING.md:521 (#609) |
| wood lynx hide | core/lynx-hide (proposed) | raw | 3 | planned-landed | elf wood rocks, d2 | docs/design/BESTIARY_LANDS.md:60<br>docs/design/BESTIARY_LANDS.md:98<br>docs/design/HUNT_FAMILIES.md:316 |
| barrow fiend hide | - | raw | 5 | planned-landed | undead south descent, d2 | docs/design/BESTIARY_LANDS.md:76<br>docs/design/HUNT_FAMILIES.md:326 |
| ash drake hide | - | raw | 8 | planned-landed | undead south descent's end, d2 | docs/design/BESTIARY_LANDS.md:77<br>docs/design/HUNT_FAMILIES.md:328 |
| hare fur | core/hare-fur (proposed) | processed | 1 | planned-landed | tanning rack (new core station); workshop | docs/design/MATERIALS.md:87<br>docs/design/MATERIALS.md:199<br>CLOTHING.md:483 (#609) |
| hare leather | core/hare-leather (proposed) | processed | 1 | planned-landed | tanning rack (new core station); workshop (MATERIALS proposes a tanning rack) | docs/design/MATERIALS.md:86<br>docs/design/MATERIALS.md:199<br>CLOTHING.md:481 (#609) |
| roe fur | - | processed | 1 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:87<br>docs/design/MATERIALS.md:199 |
| roe leather | core/roe-leather (proposed) | processed | 1 | planned-landed | tanning rack (new core station); workshop | docs/design/MATERIALS.md:86<br>docs/design/MATERIALS.md:199<br>CLOTHING.md:485 (#609) |
| scraped hare hide | core/scraped-hare-hide (proposed) | processed | 1 | planned-landed | work stone (workshop t1); workshop tier 1 | docs/design/MATERIALS.md:85<br>docs/design/MATERIALS.md:199<br>CLOTHING.md:477 (#609) |
| scraped roe hide | core/scraped-roe-hide (proposed) | processed | 1 | planned-landed | work stone (workshop t1); workshop tier 1 | docs/design/MATERIALS.md:85<br>docs/design/MATERIALS.md:199<br>CLOTHING.md:479 (#609) |
| dust adder leather | - | processed | 2 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:86<br>docs/design/MATERIALS.md:199<br>docs/design/HUNTING.md:100 |
| highland goat fur | - | processed | 2 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:87<br>docs/design/MATERIALS.md:199 |
| highland goat leather | - | processed | 2 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:86<br>docs/design/MATERIALS.md:199<br>docs/design/HUNTING.md:100 |
| hill sheep fur | - | processed | 2 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:87<br>docs/design/MATERIALS.md:199 |
| hill sheep leather | - | processed | 2 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:86<br>docs/design/MATERIALS.md:199<br>docs/design/HUNTING.md:100 |
| marmot fur | - | processed | 2 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:87<br>docs/design/MATERIALS.md:199 |
| marmot leather | - | processed | 2 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:86<br>docs/design/MATERIALS.md:199<br>docs/design/HUNTING.md:100 |
| scraped dust adder hide | - | processed | 2 | planned-landed | work stone (workshop t1) | docs/design/MATERIALS.md:85<br>docs/design/MATERIALS.md:199 |
| scraped highland goat hide | - | processed | 2 | planned-landed | work stone (workshop t1) | docs/design/MATERIALS.md:85<br>docs/design/MATERIALS.md:199 |
| scraped hill sheep hide | - | processed | 2 | planned-landed | work stone (workshop t1) | docs/design/MATERIALS.md:85<br>docs/design/MATERIALS.md:199 |
| scraped marmot hide | - | processed | 2 | planned-landed | work stone (workshop t1) | docs/design/MATERIALS.md:85<br>docs/design/MATERIALS.md:199 |
| scraped wild boar hide | - | processed | 2 | planned-landed | work stone (workshop t1) | docs/design/MATERIALS.md:85<br>docs/design/MATERIALS.md:199 |
| wild boar fur | - | processed | 2 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:87<br>docs/design/MATERIALS.md:199 |
| wild boar leather | - | processed | 2 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:86<br>docs/design/MATERIALS.md:199<br>docs/design/HUNTING.md:100 |
| scraped white bear hide | - | processed | 3 | planned-landed | work stone (workshop t1) | docs/design/MATERIALS.md:85<br>docs/design/MATERIALS.md:199 |
| scraped wildcat hide | - | processed | 3 | planned-landed | work stone (workshop t1) | docs/design/MATERIALS.md:85<br>docs/design/MATERIALS.md:199 |
| scraped wolf hide | - | processed | 3 | planned-landed | work stone (workshop t1) | docs/design/MATERIALS.md:85<br>docs/design/MATERIALS.md:199 |
| white bear fur | - | processed | 3 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:87<br>docs/design/MATERIALS.md:199<br>CLOTHING.md:523 (#609) |
| white bear leather | - | processed | 3 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:86<br>docs/design/MATERIALS.md:199<br>CLOTHING.md:523 (#609) |
| wildcat fur | - | processed | 3 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:87<br>docs/design/MATERIALS.md:199 |
| wildcat leather | - | processed | 3 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:86<br>docs/design/MATERIALS.md:199<br>docs/design/HUNTING.md:100 |
| wolf fur | - | processed | 3 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:87<br>docs/design/MATERIALS.md:199<br>CLOTHING.md:523 (#609) |
| wolf leather | - | processed | 3 | planned-landed | tanning rack (new core station) | docs/design/MATERIALS.md:86<br>docs/design/MATERIALS.md:199<br>CLOTHING.md:523 (#609) |
| oiled or waxed leather | - | processed | - | planned-landed | - | docs/design/MATERIALS.md:89<br>docs/design/MATERIALS.md:140<br>docs/design/BODY_CLOCKS.md:142 |
| boiled leather | core/boiled-leather (proposed) | processed | 2 | planned-open-pr | workshop tier 2, 1 roe leather + 1 branch | CLOTHING.md:489 (#609)<br>CLOTHING.md:78 (#609) |

## bone-horn-antler (36)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| Hare bone | core/hare-bone | raw | 1 | built | hunt drop of core/hare (tier 1, ways stalk/snare, 8 placed spots in core/map.json) | content/core/items/goods.json:68<br>docs/design/MATERIALS.md:38<br>WEAPONS.md:138 (#609) |
| Roe bone | core/roe-bone | raw | 1 | built | hunt drop of core/roe (tier 1, ways snare/stalk, 5 placed spots in core/map.json) | content/core/items/goods.json:104<br>docs/design/MATERIALS.md:40<br>WEAPONS.md:138 (#609) |
| Wolf fang | core/wolf-fang | raw | 3 | built | hunt drop of core/wolf (tier 3, ways fight/lure, 0 placed spots in core/map.json) | content/core/items/goods.json:137<br>docs/design/MATERIALS.md:61<br>WEAPONS.md:140 (#609) |
| ash bat bone | - | raw | 1 | planned-landed | undead south arch and hall roof, d1 | docs/design/BESTIARY_LANDS.md:70<br>docs/design/HUNT_FAMILIES.md:325 |
| barrow rat bone | - | raw | 1 | planned-landed | undead south stair and hall, d1 | docs/design/BESTIARY_LANDS.md:69<br>docs/design/HUNT_FAMILIES.md:311 |
| herring bone | - | raw | 1 | planned-landed | valley bay, d0 | docs/design/HUNT_FAMILIES.md:349 |
| trout bone | - | raw | 1 | planned-landed | valley river, d0 | docs/design/BESTIARY_LANDS.md:30<br>docs/design/BESTIARY.md:22<br>docs/design/HUNT_FAMILIES.md:323 |
| badger bone | - | raw | 2 | planned-landed | valley edge, d1 | docs/design/HUNT_FAMILIES.md:348 |
| bone hound bone | - | raw | 2 | planned-landed | undead south hall doors, d1 | docs/design/BESTIARY_LANDS.md:73<br>docs/design/HUNT_FAMILIES.md:315 |
| crag falcon bone | - | raw | 2 | planned-landed | east highland, d1 | docs/design/HUNT_FAMILIES.md:347 |
| highland goat bone | - | raw | 2 | planned-landed | east highland, d1 | docs/design/MATERIALS.md:42<br>docs/design/BESTIARY_LANDS.md:34 |
| hill sheep bone | - | raw | 2 | planned-landed | east highland, d1 | docs/design/MATERIALS.md:41<br>docs/design/HUNT_FAMILIES.md:340 |
| marmot bone | - | raw | 2 | planned-landed | east highland, d1 | docs/design/MATERIALS.md:43<br>docs/design/HUNT_FAMILIES.md:338 |
| red stag bone | - | raw | 2 | planned-landed | east highland, d1 | docs/design/HUNT_FAMILIES.md:339 |
| shade fox bone | - | raw | 2 | planned-landed | undead south, d1 | docs/design/BESTIARY_LANDS.md:72<br>docs/design/HUNT_FAMILIES.md:315 |
| silver fox bone | - | raw | 2 | planned-landed | elf wood, d1 | docs/design/BESTIARY_LANDS.md:56<br>docs/design/HUNT_FAMILIES.md:315 |
| snow fox bone | - | raw | 2 | planned-landed | east highland, d1 | docs/design/HUNT_FAMILIES.md:343 |
| tree marten bone | - | raw | 2 | planned-landed | elf wood, d1 | docs/design/BESTIARY_LANDS.md:55<br>docs/design/HUNT_FAMILIES.md:322 |
| wild boar bone | - | raw | 2 | planned-landed | valley, d1 | docs/design/MATERIALS.md:51<br>docs/design/BESTIARY_LANDS.md:35 |
| wood hog bone | - | raw | 2 | planned-landed | elf wood foot, d1 | docs/design/HUNT_FAMILIES.md:342 |
| wood pike bone | - | raw | 2 | planned-landed | elf wood pool, d1 | docs/design/HUNT_FAMILIES.md:350 |
| brown bear bone | - | raw | 3 | planned-landed | elf wood, d2 | docs/design/HUNT_FAMILIES.md:344 |
| cinder imp bone (also: horn) | - | raw | 3 | planned-landed | undead south hall braziers, d1 | docs/design/BESTIARY_LANDS.md:74<br>docs/design/HUNT_FAMILIES.md:326 |
| crag ibex bone | - | raw | 3 | planned-landed | elf wood crest, d2 | docs/design/HUNT_FAMILIES.md:341 |
| great eagle bone | - | raw | 3 | planned-landed | elf wood crest, d2 | docs/design/BESTIARY_LANDS.md:59<br>docs/design/HUNT_FAMILIES.md:321 |
| white bear bone | - | raw | 3 | planned-landed | valley / highland, d2 | docs/design/MATERIALS.md:62<br>docs/design/BESTIARY_LANDS.md:39 |
| white hart bone (the antler) | - | raw | 3 | planned-landed | elf wood glades, d2; the white hart (BESTIARY_LANDS) | docs/design/BESTIARY_LANDS.md:58<br>docs/design/HUNT_FAMILIES.md:312<br>WEAPONS.md:140 (#609) |
| wildcat bone | - | raw | 3 | planned-landed | valley, d2 | docs/design/MATERIALS.md:53<br>docs/design/BESTIARY_LANDS.md:38 |
| wood lynx bone | - | raw | 3 | planned-landed | elf wood rocks, d2 | docs/design/BESTIARY_LANDS.md:60<br>docs/design/HUNT_FAMILIES.md:316 |
| barrow fiend bone (also: horn) | - | raw | 5 | planned-landed | undead south descent, d2 | docs/design/BESTIARY_LANDS.md:76<br>docs/design/HUNT_FAMILIES.md:326<br>WEAPONS.md:173 (#609) |
| ash drake bone | - | raw | 8 | planned-landed | undead south descent's end, d2 | docs/design/BESTIARY_LANDS.md:77<br>docs/design/HUNT_FAMILIES.md:328 |
| shed antler | - | raw | - | planned-landed | found goods from nodes and digs (creator content, extensions) | docs/design/GAP_RDR2.md:246 |
| bone handle | - | processed | 1 | planned-landed | workshop t1; workshop tier 1 | docs/design/MATERIALS.md:97<br>docs/design/MATERIALS.md:200<br>WEAPONS.md:138 (#609) |
| bone beads | - | processed | - | planned-landed | workbench (workshop t2) | docs/design/MATERIALS.md:98<br>docs/design/MATERIALS.md:200 |
| bone hook | - | processed | - | planned-landed | workshop t1 | docs/design/MATERIALS.md:96<br>docs/design/MATERIALS.md:200<br>docs/design/HUNT_FAMILIES.md:190 |
| bone needle | - | processed | - | planned-landed | workshop t1 | docs/design/MATERIALS.md:95<br>docs/design/MATERIALS.md:200 |

## sinew (10)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| Roe sinew (also: hill sheep sinew, highland goat sinew) | core/roe-sinew | raw | 1 | built | hunt drop of core/roe (tier 1, ways snare/stalk, 5 placed spots in core/map.json) | content/core/items/goods.json:115<br>docs/design/MATERIALS.md:40<br>CLOTHING.md:77 (#609) |
| red stag sinew | - | raw | 2 | planned-landed | east highland, d1 | docs/design/HUNT_FAMILIES.md:339 |
| crag ibex sinew | - | raw | 3 | planned-landed | elf wood crest, d2 | docs/design/HUNT_FAMILIES.md:341 |
| tomb spider silk | - | raw | 3 | planned-landed | undead south hall corners, d1 | docs/design/BESTIARY_LANDS.md:75<br>docs/design/HUNT_FAMILIES.md:327 |
| white hart sinew | - | raw | 3 | planned-landed | elf wood glades, d2 | docs/design/BESTIARY_LANDS.md:58<br>docs/design/HUNT_FAMILIES.md:312 |
| barrow fiend sinew | - | raw | 5 | planned-landed | undead south descent, d2 | docs/design/BESTIARY_LANDS.md:76<br>docs/design/HUNT_FAMILIES.md:326 |
| ash drake sinew | - | raw | 8 | planned-landed | undead south descent's end, d2 | docs/design/BESTIARY_LANDS.md:77<br>docs/design/HUNT_FAMILIES.md:328 |
| sinew cord | core/sinew-cord (proposed) | processed | 1 | planned-landed | workshop t1; workshop, 2 sinew thread -> 1 | docs/design/MATERIALS.md:107<br>docs/design/HUNTING.md:76<br>WEAPONS.md:198 (#609) |
| sinew thread | core/sinew-thread (proposed) | processed | 1 | planned-landed | workshop t1; workshop, 1 roe sinew -> 2 | docs/design/MATERIALS.md:106<br>docs/design/MATERIALS.md:201<br>CLOTHING.md:487 (#609) |
| bow string | core/bow-string (proposed) | processed | 2 | planned-landed | workshop t2; workshop tier 2, 2 sinew cord -> 1 | docs/design/MATERIALS.md:108<br>docs/design/HUNTING.md:79<br>WEAPONS.md:199 (#609) |

## feather (11)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| feather (also: carrion crow feather, gull feather) | - | raw | 1 | planned-landed | valley, d0 (a moult on the ground) | docs/design/MATERIALS.md:36<br>docs/design/BESTIARY_LANDS.md:28<br>WEAPONS.md:234 (#609) |
| grey heron feather | - | raw | 1 | planned-landed | elf wood streams, d1 | docs/design/BESTIARY_LANDS.md:52<br>docs/design/HUNT_FAMILIES.md:320 |
| ground fowl down | - | raw | 1 | planned-landed | valley, d0 | docs/design/MATERIALS.md:39<br>docs/design/BESTIARY_LANDS.md:33<br>docs/design/HUNT_FAMILIES.md:318 |
| marsh duck feather | - | raw | 1 | planned-landed | valley bay's wet edge, d0 | docs/design/HUNT_FAMILIES.md:346 |
| wild goose feather | - | raw | 1 | planned-landed | elf wood pool, d1 | docs/design/BESTIARY_LANDS.md:53<br>docs/design/HUNT_FAMILIES.md:320 |
| wood dove feather | core/dove-feather (proposed) | raw | 1 | planned-landed | elf wood, d1 | docs/design/BESTIARY_LANDS.md:51<br>docs/design/BESTIARY_LANDS.md:98<br>docs/design/HUNT_FAMILIES.md:318 |
| crag falcon feather | - | raw | 2 | planned-landed | east highland, d1 | docs/design/HUNT_FAMILIES.md:347 |
| ptarmigan feather | - | raw | 2 | planned-landed | east highland, d1 | docs/design/HUNT_FAMILIES.md:345 |
| great eagle feather | - | raw | 3 | planned-landed | elf wood crest, d2 | docs/design/BESTIARY_LANDS.md:59<br>docs/design/HUNT_FAMILIES.md:321 |
| down lining | - | processed | - | planned-landed | workshop t1 | docs/design/MATERIALS.md:117<br>docs/design/BODY_CLOCKS.md:140 |
| fletching | - | processed | - | planned-landed | workshop t1 | docs/design/MATERIALS.md:116<br>docs/design/HUNTING.md:79<br>WEAPONS.md:279 (#609) |

## meat-fat-organ (1)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| gut | - | raw | - | planned-landed | hunting | docs/design/BODY_CLOCKS.md:141<br>docs/design/PROGRESSION.md:511 |

## other (5)

| Name | Id | Stage | Tier | Status | Place | Source |
|---|---|---|---|---|---|---|
| lens | - | raw | - | planned-landed | a dig find | docs/design/HUNT_LADDER.md:48<br>docs/design/HUNT_FAMILIES.md:246<br>docs/design/HUNT_FAMILIES.md:492 |
| wool | - | raw | - | planned-landed | the farm; the farm and the town | docs/design/BODY_CLOCKS.md:140<br>docs/design/PROGRESSION.md:511<br>CLOTHING.md:51 (#609) |
| oil | - | processed | - | planned-landed | - | docs/design/BODY_CLOCKS.md:142<br>docs/design/MATERIALS.md:89<br>CLOTHING.md:250 (#609) |
| wax | - | processed | - | planned-landed | - | docs/design/BODY_CLOCKS.md:142<br>docs/design/MATERIALS.md:89<br>CLOTHING.md:250 (#609) |
| felt | - | processed | 4 | planned-open-pr | the town | CLOTHING.md:51 (#609)<br>CLOTHING.md:127 (#609) |

\* Status set by judgment; see Judgment calls and field conflicts below.

## Review corrections

17 corrections from two verifiers, each checked against its source: 16 applied, 1 rejected.

| Kind | Name | Verdict | Why |
|---|---|---|---|
| missing | shed antler | applied | added by reading GAP_RDR2.md, which landed on develop after the first count (develop 4405cf379): planned-landed, bone-horn-antler, raw, tier unknown. A found good from nodes and digs, tied to no animal, so apart from the white hart's bone (the antler). The same line's dropped feathers are the plain moult; its fish bone stays read as the per-fish bones (an alternative reading below counts it apart) |
| duplicate | carrion crow feather | applied | folded into 'feather': MATERIALS.md:36-37 give the songbirds and the crow the same plain 'feather (a moult)'; MATERIALS.md:21 and :66 plan one family-less feather item (3 grades); HUNT_FAMILIES.md:319 'none: feathers only'; no source names a crow feather item |
| duplicate | gull feather | applied | folded into 'feather': HUNT_FAMILIES.md:361: the gull's only good is 'a moult by the dock's rocks, a resource node of feathers as the sparrow's'; the sparrow's moult is MATERIALS.md:36's plain feather. The gull's node is 'drawn one tier by its ground', which may make it a higher-tier copy; read here as the same item |
| duplicate | hill sheep sinew | applied | folded into 'Roe sinew': MATERIALS.md:41 'sinew (proposed)'; MATERIALS.md:21 sinew carries no family; :66 and :197 count one sinew item (3 grades); CLOTHING.md:49 (#609) keeps sinew family-less; the built valley sinew is core/roe-sinew |
| duplicate | highland goat sinew | applied | folded into 'Roe sinew': MATERIALS.md:42 'goat meat, goat hide, goat bone; sinew' drops the animal word for the sinew alone; MATERIALS.md:21, :66, :197 plan one sinew item; no page names a goat sinew |
| duplicate | horn | applied | dropped: the only planned horn is a bone-class drop, the cinder imp's 'bone 1 (the horn)' (BESTIARY_LANDS.md:74) and the barrow fiend's 'bone 2 (the horns)' (:76), both already counted; WEAPONS.md:173 (#609)'s horn bow waits for that horn (BESTIARY_LANDS #432). HUNTING.md:86 and MATERIALS.md:45 only say horn 'comes later with its animals', and HUNT_FAMILIES.md:514 names a horn class only in option C (default A). Recorded as an alias on both bones |
| not-planned | fat | applied | moved to borderline, call out: a deferred good with no making role: HUNTING.md:86 and MATERIALS.md:45 say only 'later with their animals', HUNT_FAMILIES.md:514 names fat only in option C (default A); its one use anywhere is torch fuel in the outside research memo (docs/research/research-hunting.md:543), and fuel is a borderline case anyway |
| not-planned | dust adder fur | applied | dropped: the adder's hide is scale (MATERIALS.md:52 'hide (scale)', BESTIARY_LANDS.md:36 'the scale'); the fur state is 'a tag, fur, on a hide that kept its hair' (MATERIALS.md:26), which a scale hide cannot be. The only support was the icon product 3 x 10 x 3 (MATERIALS.md:199), an icon budget, not a named item. Scraped dust adder hide and dust adder leather stay |
| not-a-material | moonreed | applied | moved to borderline, call out: built as kind material, class fibre, but its only consumer is a quest find step (content/core/quests/the-south-bank.json:19); no recipe, template or restore takes it (the one class template input is plant/berry, content/core/templates/dye-cord.json); CLOTHING.md:51 (#609) 'used today only by a quest'. Its one making role is a hand-off pointer in the unmerged #609, 'the moonreed variant of a reed piece' (CLOTHING.md:522 (#609)), with no recipe. Counted out on the same grounds as core/pottery-shard; it becomes a material the day a recipe takes it |
| not-a-material | rock crystal | applied | moved to borderline, call out: QUARRYING.md:109 (#609) and owner question 5 (default A, :344) make it kind 'treasure', 'a treasure find whose use is its price, as the ruins' old coin'; the build rows (:398-400) give kind treasure and the old-coin sprite; 'the gems have no consumer yet' (:175). Coins are excluded; a gem material arrives with a cut-and-set step (option C) or a jewelry page |
| not-a-material | agate | applied | moved to borderline, call out: QUARRYING.md:109 (#609) and owner question 5 (default A, :344) make it kind 'treasure', 'a treasure find whose use is its price, as the ruins' old coin'; the build rows (:398-400) give kind treasure and the old-coin sprite; 'the gems have no consumer yet' (:175). Coins are excluded; a gem material arrives with a cut-and-set step (option C) or a jewelry page |
| not-a-material | garnet | applied | moved to borderline, call out: QUARRYING.md:109 (#609) and owner question 5 (default A, :344) make it kind 'treasure', 'a treasure find whose use is its price, as the ruins' old coin'; the build rows (:398-400) give kind treasure and the old-coin sprite; 'the gems have no consumer yet' (:175). Coins are excluded; a gem material arrives with a cut-and-set step (option C) or a jewelry page |
| not-planned | lime (for mortar) | applied | dropped: named only as chalk's future use, QUARRYING.md:112 (#609) ('a white dye; lime for mortar with the settlement') and :438; no lime item, node, recipe or build row. Noted on chalk's borderline entry |
| not-planned | steel | rejected | QUARRYING.md:100 (#609) proposes it as the tier-6 rung of the metal ladder with inputs (iron with charcoal), a station (a hotter furnace) and a tier, and the page's own comparison row :295 states its charcoal input as the design ('steel takes charcoal from the valley's wood'). The brief counts what is proposed or listed, not only build-list rows; thin, but more than a word, unlike lime and flax |
| not-planned | flax | applied | dropped: named only as what the valley lacks (CLOTHING.md:51 (#609) 'no flax, no linen and no farm wool') and in outside-game comparisons (CLOTHING.md:355 (#609), :435; GAP_RS_GEAR.md:27 (#609)); question 4's default A brings 'wool, linen and felt' (CLOTHING.md:410 (#609)), not flax. Linen's raw fibre is unnamed (a gap) |
| not-planned | sand | applied | moved to borderline, call out: named only as what Digging's clay_eye reads from the surface (PROGRESSION.md:153) and in QUARRYING.md:104 (#609)'s quote of the schema's clay class; no use, item, node or recipe on any page. Out with brick, from the same schema quote |
| wrong-tier | wool | applied | tier 4 -> unknown. the 4 was CLOTHING.md:127 (#609)'s 'the town's cloth (wool, linen, felt)', the cloth, not the raw fibre; the only landed figure is a tier-1 wool hood 'from the valley's wool' (PROGRESSION.md:511); no source tiers raw wool |

## Merges

- carrion crow feather + feather: MATERIALS.md:36-37 give the songbirds and the crow the same plain 'feather (a moult)'; MATERIALS.md:21 and :66 plan one family-less feather item (3 grades); HUNT_FAMILIES.md:319 'none: feathers only'; no source names a crow feather item
- gull feather + feather: HUNT_FAMILIES.md:361: the gull's only good is 'a moult by the dock's rocks, a resource node of feathers as the sparrow's'; the sparrow's moult is MATERIALS.md:36's plain feather. The gull's node is 'drawn one tier by its ground', which may make it a higher-tier copy; read here as the same item
- hill sheep sinew + Roe sinew: MATERIALS.md:41 'sinew (proposed)'; MATERIALS.md:21 sinew carries no family; :66 and :197 count one sinew item (3 grades); CLOTHING.md:49 (#609) keeps sinew family-less; the built valley sinew is core/roe-sinew
- highland goat sinew + Roe sinew: MATERIALS.md:42 'goat meat, goat hide, goat bone; sinew' drops the animal word for the sinew alone; MATERIALS.md:21, :66, :197 plan one sinew item; no page names a goat sinew
- Keystone (built) + keystone (core/keystone) (gear borderline): gear counter: borderline (one-off opening piece); built counter: material. My call: material, a building input (the old-bridge restore, content/core/restores/old-bridge.json:16), kind material, class stone; not a key or a quest delivery
- hill sheep hide (landed) + hill sheep hide (fleece on) (gear): CLOTHING's fleece-on sheep hide is MATERIALS 2.1's hill sheep hide (fleece on, tag fur, MATERIALS.md:41)
- highland goat hide (landed) + goat hide (gear): MATERIALS 2.1 names the highland goat's hide 'goat hide' (MATERIALS.md:42)
- wild boar hide (landed) + boar hide (gear): MATERIALS 2.2: the wild boar gives 'boar hide' (MATERIALS.md:51)
- dust adder hide (landed) + adder hide (gear): MATERIALS 2.2: the dust adder gives 'adder hide' (MATERIALS.md:52)
- white bear hide (landed) + bear hide (gear): CLOTHING cites the atlas's hunters (MATERIALS 2.3), whose only bear is the white bear (MATERIALS.md:62); the brown bear is a HUNT_FAMILIES kind outside the atlas
- songbird (sparrow) feather (landed) + feather (gear): WEAPONS asks for 'a feather item' of class core/feather (WEAPONS.md:234 (#609)), not a new item; the gear counter anchored it on MATERIALS' songbird row, whose good is MATERIALS' plain 'feather' (MATERIALS.md:36, given to songbirds and the crow alike). Filed there; the total does not change whichever bird it is filed under
- white bear leather (landed) + bear leather (gear): as bear hide: CLOTHING's 'and the bear's' leather is the atlas's white bear (MATERIALS.md:62, :199)
- white bear fur (landed) + bear fur (gear): as bear hide: the atlas's white bear (MATERIALS.md:62, :199)
- fletching (landed) + fletching (gear borderline): gear counter folded fletching into feather; MATERIALS 3.5 (landed) makes it an item of its own from 3 feathers (MATERIALS.md:116), so it is a material and stays one entry
- white hart bone (landed) + antler (gear): WEAPONS 5.1 calls the antler 'the white hart's one bone good' (WEAPONS.md:140 (#609)); BESTIARY_LANDS.md:58 lists the hart's bone as the antler
- sand (landed) + sand, brick (gear borderline): gear counter: borderline, named only in the schema quote; the landed docs already plan sand (Digging's clay_eye, PROGRESSION.md:153). Sand joins that material; brick stays borderline
- ore (landed) + iron ore (gear): the landed docs name only a generic 'ore' (PROGRESSION.md:154, CRAFTING_AUDIT.md:190) and iron as the one metal (DECISIONS.md:321, BODY_CLOCKS.md:143); QUARRYING 13 names that ore iron ore (QUARRYING.md:271 (#609)). Judgment: kept as one, not a fourth ore
- iron (landed) + iron (bar) (gear): both are the worked metal: landed iron (BODY_CLOCKS iron cleats, Smithing at the city forge) is what QUARRYING 13 makes as the iron bar (2 iron ore + 2 charcoal, QUARRYING.md:274 (#609))
- moonreed (gear) + Moonreed (built borderline): built counter: borderline (no consumer today); gear counter: material, because CLOTHING plans a moonreed variant of a reed piece (CLOTHING.md:522 (#609)). My call: material, built item, its making role planned in #609
- River stone (built) + river stone (landed) + river stone (gear): same built id core/stone
- Stone flakes (built) + stone flakes (landed) + stone flakes (gear): same built id core/stone-flakes
- Stone blade (built) + stone blade (landed) + stone blade (gear): same built id core/stone-blade
- Log (built) + log (landed) + oak log (gear): same built id core/log
- Dry branch (built) + dry branch (landed) + branch (gear): same built id core/branch
- Reed (built) + reed (landed) + reed (gear): same built id core/reed
- Reed cord (built) + reed cord (landed) + reed cord (gear): same built id core/reed-cord
- Dyed cord (built) + dyed cord (gear): same built id core/dyed-cord
- Woven mat (built) + woven mat (gear): same built id core/woven-mat
- Hare hide (built) + hare hide (landed) + hare hide (gear): same built id core/hare-hide
- Roe hide (built) + roe hide (landed) + roe hide (gear): same built id core/roe-hide
- Wolf hide (built) + wolf hide (landed) + wolf hide (gear): same built id core/wolf-hide
- Hare bone (built) + hare bone (landed) + hare bone (gear): same built id core/hare-bone
- Roe bone (built) + roe bone (landed) + roe bone (gear): same built id core/roe-bone
- Wolf fang (built) + wolf bone (the fang) (landed) + wolf fang (gear): same built id core/wolf-fang
- Roe sinew (built) + roe sinew (landed) + roe sinew (gear): same built id core/roe-sinew
- marmot hide (landed) + marmot hide (gear): same name, same thing
- wildcat hide (landed) + wildcat hide (gear): same name, same thing
- scraped hare hide (landed) + scraped hare hide (gear): same name, same thing (gear id core/scraped-hare-hide)
- hare leather (landed) + hare leather (gear): same name, same thing (gear id core/hare-leather)
- hare fur (landed) + hare fur (gear): same name, same thing (gear id core/hare-fur)
- scraped roe hide (landed) + scraped roe hide (gear): same name, same thing (gear id core/scraped-roe-hide)
- roe leather (landed) + roe leather (gear): same name, same thing (gear id core/roe-leather)
- wolf leather (landed) + wolf leather (gear): same name, same thing
- wolf fur (landed) + wolf fur (gear): same name, same thing
- bone handle (landed) + bone handle (gear): same name, same thing
- sinew thread (landed) + sinew thread (gear): same name, same thing (gear id core/sinew-thread)
- sinew cord (landed) + sinew cord (gear): same name, same thing (gear id core/sinew-cord)
- bow string (landed) + bow string (gear): same name, same thing (gear id core/bow-string)
- bark (landed) + bark (gear): same name, same thing
- clay (landed) + clay (gear): same name, same thing
- wool (landed) + wool (gear): same name, same thing
- linen (landed) + linen (gear): same name, same thing
- oil (landed) + oil (gear): same name, same thing
- wax (landed) + wax (gear): same name, same thing
- horn (landed) + horn (gear): same name, same thing
- Wild herb (built borderline) + wild herb (core/herb, built) (landed borderline) + herb (core/herb) (gear borderline): same item, kept borderline
- Redberry (built borderline) + redberry (core/berry, built) (landed borderline) + berries (core/berry, class plant family berry) (gear borderline): same item, kept borderline
- River fish (built borderline) + river fish (core/river-fish, built) (landed borderline): same item, kept borderline
- Pottery shard (built borderline) + pottery shard (core/pottery-shard) (gear borderline): same item, kept borderline
- salt (landed borderline) + salt (gear borderline): same item, kept borderline

## Borderline (55), with the call

| Name | Status if counted | Call | Why | Source |
|---|---|---|---|---|
| herb (core/herb) | built | in | kind material, not eaten raw; a built workshop input (bandage) and the planned tannin of every leather and fur (MATERIALS 3.2, CLOTHING 4.2). Its tea and stew use is secondary | content/core/resources/wild-herbs.json:10<br>docs/design/MATERIALS.md:86<br>CLOTHING.md:75 (#609) |
| redberry (core/berry) | built | out | kind food, eaten raw (satiety 4); its making role is the dye of the built dyed cord, which the rules put in borderline | content/core/resources/berry-bushes.json:10<br>docs/design/HUNT_LADDER.md:17<br>CLOTHING.md:63 (#609) |
| bellberry (core/bellberry) | built | out | eaten raw; fits the dye template but no recipe names it | content/core/resources/bell-bushes.json:10<br>content/core/templates/dye-cord.json:27 |
| river fish (core/river-fish) | built | out | only consumer is a meal (grilled fish); the plans use it as bait | content/core/resources/river-fish.json:10<br>content/core/recipes/grilled-fish.json:30<br>docs/design/HUNT_LADDER.md:19 |
| sunleaf (core/sunleaf) | built | out | a quest find; at most a meal ingredient (the ceosisrael sunleaf-mushrooms meal) | content/core/resources/sun-herbs.json:10<br>content/core/resources/sun-herbs.json:23 |
| pottery shard (core/pottery-shard) | built | out | a ruin relic to sell; nothing consumes it and no plan makes it an input | content/core/treasures/ruins-gate.json:10<br>content/core/treasures/ruins-deep.json:40<br>CLOTHING.md:141 (#609) |
| hare meat | built | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | content/core/items/goods.json:43<br>docs/design/MATERIALS.md:38<br>docs/design/BESTIARY_LANDS.md:31 |
| ground fowl meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/MATERIALS.md:39<br>docs/design/BESTIARY_LANDS.md:33 |
| roe meat | built | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | content/core/items/goods.json:79<br>docs/design/MATERIALS.md:40<br>docs/design/BESTIARY_LANDS.md:32 |
| hill sheep meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/MATERIALS.md:41<br>docs/design/HUNT_FAMILIES.md:340 |
| highland goat meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/MATERIALS.md:42<br>docs/design/BESTIARY_LANDS.md:34 |
| marmot meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/MATERIALS.md:43<br>docs/design/HUNT_FAMILIES.md:338 |
| wild boar meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/MATERIALS.md:51<br>docs/design/BESTIARY_LANDS.md:35 |
| dust adder meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/MATERIALS.md:52<br>docs/design/BESTIARY_LANDS.md:36 |
| wildcat meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/MATERIALS.md:53<br>docs/design/BESTIARY_LANDS.md:38 |
| wolf meat | built | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | content/core/items/goods.json:148<br>docs/design/MATERIALS.md:61<br>docs/design/BESTIARY_LANDS.md:37 |
| white bear meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/MATERIALS.md:62<br>docs/design/BESTIARY_LANDS.md:39 |
| trout meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/BESTIARY_LANDS.md:30<br>docs/design/BESTIARY.md:22<br>docs/design/HUNT_FAMILIES.md:323 |
| wood dove meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/BESTIARY_LANDS.md:51 |
| wild goose meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/BESTIARY_LANDS.md:53 |
| river otter meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/BESTIARY_LANDS.md:54 |
| tree marten meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/BESTIARY_LANDS.md:55 |
| white hart meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/BESTIARY_LANDS.md:58 |
| wood lynx meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/BESTIARY_LANDS.md:60 |
| red stag meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/HUNT_FAMILIES.md:339 |
| crag ibex meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/HUNT_FAMILIES.md:341 |
| wood hog meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/HUNT_FAMILIES.md:342 |
| brown bear meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/HUNT_FAMILIES.md:344 |
| ptarmigan meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/HUNT_FAMILIES.md:345 |
| marsh duck meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/HUNT_FAMILIES.md:346 |
| badger meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/HUNT_FAMILIES.md:348 |
| herring meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/HUNT_FAMILIES.md:349 |
| wood pike meat | planned-landed | out | raw meat: kind food, eaten raw or cooked; MATERIALS 3.1 processes it only into food | docs/design/HUNT_FAMILIES.md:350 |
| salt | planned-landed | out | curing food and a bait lick; no making recipe | docs/design/HUNT_LADDER.md:22<br>docs/design/HUNT_FAMILIES.md:241<br>QUARRYING.md:113 (#609) |
| catmint | planned-landed | out | bait | docs/design/HUNT_LADDER.md:21<br>docs/design/HUNT_FAMILIES.md:241 |
| roots | planned-landed | out | bait and plant food | docs/design/HUNT_LADDER.md:18<br>docs/design/HUNT_FAMILIES.md:241 |
| leavings | planned-landed | out | bait; spoils in a day | docs/design/HUNT_LADDER.md:20<br>docs/design/HUNT_FAMILIES.md:241 |
| dye | planned-landed | out | a perk word (dye_fast), no item | docs/design/PROGRESSION.md:165 |
| peat | planned-landed | out | fuel in an illustrative quest card only | docs/design/QUEST_PATTERNS.md:268<br>docs/design/QUEST_PATTERNS.md:570 |
| planks | planned-landed | out | an illustrative quest card only | docs/design/QUEST_PATTERNS.md:152 |
| pitch | planned-landed | out | an illustrative quest card only | docs/design/QUEST_PATTERNS.md:276 |
| ochre (core/ochre, proposed) | planned-open-pr | in | a mined mineral whose only role is to be spent in making (CLOTHING's earth-dyed cord, QUARRYING 3); a dye, but no food role | QUARRYING.md:111 (#609)<br>CLOTHING.md:296 (#609) |
| chalk | planned-open-pr | in | a white dye first (QUARRYING.md:112 (#609)), a making input; its later use is lime for mortar with the settlement (QUARRYING.md:112 (#609), :438), which no page makes an item of, so lime is not counted apart | QUARRYING.md:112 (#609) |
| charcoal | planned-open-pr | in | made from logs and spent as a recipe input in every smelt (QUARRYING.md:274 (#609)); fuel, but a named input of the metal chain | QUARRYING.md:273 (#609)<br>QUARRYING.md:274 (#609) |
| grain | planned-open-pr | out | a food crop the quern grinds when farming comes | QUARRYING.md:192 (#609) |
| copper (the metal) | planned-open-pr | out | folded: QUARRYING smelts no copper bar; counted as copper ore and bronze bar | WEAPONS.md:141 (#609) |
| metal pick heads and tool heads | planned-open-pr | out | unclear whether parts or the finished tools; waits for metal | QUARRYING.md:275 (#609) |
| nettle fibre, its cord and a spun cloth | planned-open-pr | out | only option B of CLOTHING question 4; the default A waits | CLOTHING.md:410 (#609) |
| brick | none (schema class example) | out | only a word in the schema's clay class description; no item or use | QUARRYING.md:104 (#609) |
| fat | planned-landed | out | a deferred good with no making role: HUNTING.md:86 and MATERIALS.md:45 say only 'later with their animals', HUNT_FAMILIES.md:514 names fat only in option C (default A); its one use anywhere is torch fuel in the outside research memo (docs/research/research-hunting.md:543), and fuel is a borderline case anyway | docs/design/HUNTING.md:86<br>docs/design/MATERIALS.md:45<br>docs/design/HUNT_FAMILIES.md:514 |
| moonreed (core/moonreed) | built | out | built as kind material, class fibre, but its only consumer is a quest find step (content/core/quests/the-south-bank.json:19); no recipe, template or restore takes it (the one class template input is plant/berry, content/core/templates/dye-cord.json); CLOTHING.md:51 (#609) 'used today only by a quest'. Its one making role is a hand-off pointer in the unmerged #609, 'the moonreed variant of a reed piece' (CLOTHING.md:522 (#609)), with no recipe. Counted out on the same grounds as core/pottery-shard; it becomes a material the day a recipe takes it | content/core/resources/moon-reeds.json:10<br>content/core/resources/moon-reeds.json:22<br>CLOTHING.md:51 (#609) |
| rock crystal (core/rock-crystal) | planned-open-pr | out | QUARRYING.md:109 (#609) and owner question 5 (default A, :344) make it kind 'treasure', 'a treasure find whose use is its price, as the ruins' old coin'; the build rows (:398-400) give kind treasure and the old-coin sprite; 'the gems have no consumer yet' (:175). Coins are excluded; a gem material arrives with a cut-and-set step (option C) or a jewelry page | QUARRYING.md:398 (#609)<br>QUARRYING.md:109 (#609) |
| agate (core/agate) | planned-open-pr | out | QUARRYING.md:109 (#609) and owner question 5 (default A, :344) make it kind 'treasure', 'a treasure find whose use is its price, as the ruins' old coin'; the build rows (:398-400) give kind treasure and the old-coin sprite; 'the gems have no consumer yet' (:175). Coins are excluded; a gem material arrives with a cut-and-set step (option C) or a jewelry page | QUARRYING.md:399 (#609)<br>QUARRYING.md:109 (#609) |
| garnet (core/garnet) | planned-open-pr | out | QUARRYING.md:109 (#609) and owner question 5 (default A, :344) make it kind 'treasure', 'a treasure find whose use is its price, as the ruins' old coin'; the build rows (:398-400) give kind treasure and the old-coin sprite; 'the gems have no consumer yet' (:175). Coins are excluded; a gem material arrives with a cut-and-set step (option C) or a jewelry page | QUARRYING.md:400 (#609)<br>QUARRYING.md:109 (#609) |
| sand | planned-landed | out | named only as what Digging's clay_eye reads from the surface (PROGRESSION.md:153) and in QUARRYING.md:104 (#609)'s quote of the schema's clay class; no use, item, node or recipe on any page. Out with brick, from the same schema quote | docs/design/PROGRESSION.md:153<br>QUARRYING.md:104 (#609) |

## Judgment calls and field conflicts

- Dry branch, stage: found as it is (branch heap, hollow tree, a quest reward) and also split from a log; the landed and gear counters said processed, the built counter raw
- iron ore, family: QUARRYING 13 puts every ore in class core/ore under mineral (QUARRYING.md:97 (#609), :271), as copper and tin ore; the landed generic 'ore' was filed under metal
- iron ore, status: sources said ['planned-landed', 'planned-open-pr']; most-built kept
- wool, tier: unknown: the 4 was CLOTHING.md:127 (#609)'s 'the town's cloth (wool, linen, felt)', the cloth, not the raw fibre; the only landed figure is a tier-1 wool hood 'from the valley's wool' (PROGRESSION.md:511); no source tiers raw wool
- wax, stage: rendered from comb, the pair of oil; the landed counter said raw, the gear counter processed; no page says how it is got
- bow stave, status: the worked stave (core/bow-stave, 1 log at workshop tier 2) is WEAPONS' proposal. On develop HUNTING 5's 'stave' is built by HUNT_LADDER as core/branch 2 (HUNT_LADDER.md:47). Planned-landed only if HUNTING's word is read as this item
- flint, status: a raw flint item (core/flint, the scree fan's side find) is QUARRYING's proposal. On develop HUNTING 5's 'wood and flint' is built by HUNT_LADDER as core/branch + core/stone-blade (HUNT_LADDER.md:39) and its 'flint or bone head' as core/stone-flakes (HUNT_LADDER.md:50), so no landed page plans a separate flint. Planned-landed only if HUNTING's word is read as this item, as WEAPONS 5.1 reads it

## Sources

- `develop` at ebd425b2c (02.11), the files the rows cite by `path:line`: content/core (items, recipes, resources, templates, shops, treasures, quests, camp); docs/design/MATERIALS.md, BESTIARY.md, BESTIARY_LANDS.md, HUNTING.md, HUNT_FAMILIES.md, HUNT_LADDER.md, PROGRESSION.md, BODY_CLOCKS.md, EQUIPMENT.md, CRAFTING_AUDIT.md, PATHS.md, QUEST_PATTERNS.md, GAP_RDR2.md; DECISIONS.md; docs/research/research-hunting.md.
- The open gear pull request #609 at its head a8e4915d1: CLOTHING.md, WEAPONS.md, QUARRYING.md, GAP_RS_GEAR.md, BUILD_SET.md, cited as `X.md:N (#609)`; none of the five is on `develop`.
- The companion pages: [PRODUCTION_MAP.md](PRODUCTION_MAP.md) maps every counted material from the world to the thing made; [GAP_MATERIALS.md](GAP_MATERIALS.md) measures the 158 against nine crafting games and lays the improvement plan.
