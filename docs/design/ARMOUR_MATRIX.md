# The armour matrix

Stage 2 of #789. The tables below propose the rows and their checks. The tree is Handcraft's `careful-work` and the `wear` group (`quick-seams`, `steady-needle`, then `even-cut` and `close-stitch` when their readers land). Metal wear joins Smithing's `wear`. Protection serves Guard. See `content/core/schools/handcraft.json:14–58`, `docs/design/CLOTHING.md:133–161`, `docs/design/PROGRESSION.md:171–181` and `DECISIONS.md:4570–4574`.

## 1. How the large games do it

Diablo II Resurrected's item tables hold 217 armour bases. Its 45 body armours use 15 visible looks, and helmets, shields, gloves, boots and belts use 26 more between them. Normal, exceptional and elite body armour share the same look within a type. Diablo II and Path of Exile roll rarity and quality over base types. [D2R armour table](https://github.com/blizzhackers/d2data/blob/master/json/armor.json), [Path of Exile data export](https://github.com/repoe-fork/repoe-fork.github.io).

The bronze catalogue studied here has 11 armour items, while the OSRS tradeable-item mapping counts 45 bronze base items across gear and other forms. Minecraft repeats four armour places across the main materials. This matrix uses a sparse material table and keeps a row only if its numbers, name and icon all tell it apart. The body drawing can be shared across several materials so the item choice can stay broad without drawing every piece on the character. [OSRS bronze catalogue](https://oldschool.runescape.wiki/w/Bronze_equipment), [OSRS price mapping](https://prices.runescape.wiki/api/v1/osrs/mapping), [Minecraft armour table](https://minecraft.wiki/w/Armor). See `docs/design/GAP_RS_GEAR.md:43–50,194`.

## 2. Rows and places

The axes are tier, leading material and its construction, body place, and weight family. Item class (`fur`, `leather`, `reedwork`, `cloth`, `mail`, `plate`) says what the thing is, item family says where the material comes from, and recipe family `wear` says what the player makes. Role, rarity, requirements, routes, and set are fields of the row. The place codes are H head, T top, L legs, F feet, G hands, O outfit. O takes both T and L. The held hand, jewelry and back have their own ledgers. Armour uses no shield slot. See `docs/design/CLOTHING.md:7–12,36–51,120–138`, `docs/design/EQUIPMENT.md:53–64`, `schema/src/index.ts:153–164`, `kernel/src/step.ts:1502–1526`.

Count one identity for a distinct name, an icon legible at bag size and a distinct worn result. A material or construction earns a place only where the table names it. Compare the signed effects, active attributes and traits, and carry weight across the entire table. Refuse a duplicate standalone block even with a different place, tier, price, requirement, set label or name. Also compare complete-set effects under the clamp. A new set piece needs a different standalone result too. Report dominance at the same place and tier under the clamp. A heavier piece or a second job must read in play. Count only one of each grade or quality, coat or dye, and purchase, find or recipe route. The bags, parts and ammunition have their own counts. A purely cosmetic item supplies a look and has no scored wear result. See the 21.11 counting decision (#794, `DECISIONS.md:4598–4606` on develop) and `docs/design/CLOTHING.md:280–305`.

### First three tiers

The first six T1 pieces, the reed hat and sandals, and the woven reed coat are the audit's nine recorded functional pieces. Keep their IDs and require icon proof. This table proposes changes to weight and effect where those IDs share a numeric block. Recheck starting fairness and saved gear before counting a changed carry-in. The following scored rows are the audit's functional seed plus the five ranked gaps. Sources: `docs/design/CONTENT_MATRIX_AUDIT.md:65–70`, `content/core/items/outfits.json:11–29,70–88`, `content/core/recipes/{hare-fur-hood,hare-leather-shoes,roe-leather-jerkin,roe-leather-leggings,reed-hat,reed-sandals,woven-reed-coat}.json:10–27`, `docs/design/CLOTHING.md:122–131,223–231,272–278`, `docs/design/CLOTHING_BALANCE.md:209–221`.

| T | Family | Piece and place | Weight look | Weight | Plain effects |
|---|---|---|---|---:|---|
| 1 | work cloth | Patched work clothes T | light | 2 | bench 5 |
| 1 | work cloth | Light cloak T | light | 2 | gather 5 |
| 1 | hare fur | Hare-fur hood H | light | 1 | bench 5 |
| 1 | hare leather | Hare-leather shoes F | medium | 1 | dig 5 |
| 1 | roe leather | Roe-leather jerkin T | medium | 2 | dig 5 |
| 1 | roe leather | Roe-leather leggings L | medium | 2 | find 5 |
| 1 | hare leather | Hare-leather gloves G | medium | 1 | hand 5 |
| 1 | reed | Woven reed cape T | light | 1 | find 5 |
| 2 | reed | Reed hat H | light | 1 | gather 5 |
| 2 | reed | Reed sandals F | light | 1 | gather 6 |
| 2 | roe leather | Boiled-leather cap H | medium | 1 | dig 6 |
| 2 | roe leather | Boiled-leather boots F | medium | 2 | dig 6 |
| 2 | hare fur | Fur-lined cloak T | light | 2 | bench 6 |
| 2 | roe leather | Boiled-leather leggings L | medium | 3 | dig 6 |
| 2 | hare fur | Hare-fur mittens G | light | 1 | bench 6 |
| 2 | reed | Reed leggings L | light | 2 | gather 6 |
| 3 | reed | Woven reed coat T | light | 2 | gather 8 |
| 3 | roe leather | Hardened jerkin T | medium | 3 | dig 9, find 9 |
| 3 | roe leather | Hardened breeches L | medium | 2 | dig 9, find 9 |

Bench is `craft_speed_pct`, hand is `craft_chance_pct`, gather is `gather_speed_pct`, dig is `dig_speed_pct`, and find is `rare_find_pct` (`schema/src/index.ts:163–166`). Their worn values use whole percentage points (`schema/src/index.ts:232–238`). The proposed effects `guard_pct` and signed `quiet_wear` would use the same unit. Positive quiet would mean less wear noise. The early choices put find on the leggings and cape, craft chance on the gloves, and more work on the thicker T2 gear. The T2 scores can use the top of their uncommon band to keep the early kit distinct. Keep the IDs of patched work clothes and the light cloak and their human and elf starting-outfit routes, with individual icon work due (`content/core/items/outfits.json:11–12`, `content/core/items/outfits.json:70–71`, `content/core/races/human.json:28–32`, `content/core/races/elf.json:28–32`).

### Tiers 4 to 10

Expand each cell once over its column's places. The column defines its job and construction. The first three columns change jobs at T8–9 and take two effects at T10. The lead names in future land columns are slots for the material atlas to fill. They stay in the report until their real material and source exist. Read metal/hide anchors against `docs/design/WEAPON_MATRIX.md:154–164` and the armour transitions against `docs/design/CLOTHING.md:120–131`.

| T | Open weave | Hard hide | Bench cloth | Finder weave | Finder hide | Stitch cloth | Quiet hide | Open links | Close armour |
|---|---|---|---|---|---|---|---|---|---|
| 4 | linen | wolf leather | wool | reed braid | bear leather | felt | hardened roe | bronze mail | bronze backed mail |
| 5 | fine linen | fiend hide | fine wool | silk weave | backed wolf hide | fine felt | oiled bear hide | iron mail | iron plate |
| 6 | land6 flax | land6 thick hide | land6 fleece | land6 cord | land6 split hide | land6 felt | land6 soft hide | steel mail | steel plate |
| 7 | land7 flax | land7 thick hide | land7 fleece | land7 cord | land7 split hide | land7 felt | land7 soft hide | land7 mail | land7 plate |
| 8 | land8 flax | drake hide | land8 fleece | land8 cord | land8 split hide | land8 felt | land8 soft hide | land8 mail | land8 plate |
| 9 | land9 flax | land9 thick hide | land9 fleece | land9 cord | land9 split hide | land9 felt | land9 soft hide | land9 mail | land9 plate |
| 10 | land10 flax | land10 thick hide | land10 fleece | land10 cord | land10 split hide | land10 felt | land10 soft hide | land10 mail | land10 plate |

| Column | Class and look | Places | Profile (ordered) | T8–9 change | T10 change |
|---|---|---|---|---|
| Open weave | cloth, light | HTLFG | gather | find | gather + hand |
| Hard hide | leather, medium | HTLFG | dig | quiet | dig + bench |
| Bench cloth | cloth, light | HTLFG | bench | hand | bench + find |
| Finder weave | reedwork, light | HTLFG | gather + find | same | same |
| Finder hide | leather, medium | HTLFG | dig + find | same | same |
| Stitch cloth | cloth, light | HTLFG | bench + hand | same | same |
| Quiet hide | leather, medium | HTLFG | gather + quiet | same | same |
| Open links | mail, mail | HTLF | guard + quiet | same | same |
| Close armour | mail at T4, then plate of that metal | HTLF | guard + noise | same | same |

The ordinary name is the material/construction followed by the form: light hood, coat, trousers, shoes, mitts. Medium cap, jerkin, breeches, boots, gloves. Mail coif, shirt, chausses, sabatons. Plate helm, cuirass, cuisses, greaves. Close armour at T4 uses the mail forms with a backing and the mail body drawings. At late tiers weight by H/T/L/F/G/O is light 1/2/2/1/1/3, medium 2/4/3/2/1/5, mail 3/5/4/3, plate 4/7/6/4. The backed bronze mail adds one unit at each place compared with open links. Open links favour quiet over guard. Close armour favours guard and carries negative quiet. A piece carries the weight of the cut and uses the score selection below.

### Named pieces that complete the table

Each named piece has its own row and icon. Set and quest rows expand exactly the printed place codes. The ordered profile uses the same tier table as ordinary rows. A set receives a bonus only when every piece is worn. No set includes O alongside T or L.

| Set prefix (H/T/L/F/G forms above) | T | Class, material and look | Profile | Whole set bonus |
|---|---:|---|---|---|
| Flint Digger | 4 | leather, hardened roe, medium | dig + hand | dig +2 |
| Loom Tender | 5 | cloth, fine felt, light | hand + gather | hand +2 |
| Ford Walker | 6 | leather, land6 split hide, medium | dig + quiet | quiet +2 |
| Ridge Binder | 7 | cloth, land7 fleece, light | bench + quiet | bench +2 |
| Drake Stitcher | 8 | leather, drake hide, medium | hand + quiet | hand +2 |
| Veil Mender | 9 | cloth, land9 felt, light | hand + find | find +2 |

| Quest line (placement brief) | T | Class, look and lead | Profile | Piece names, in H/T/L/F/O order |
|---|---:|---|---|---|---|
| Tarn Survey (tarn paths) | 4 | cloth, light, wool | find + hand | Tarn Sight Hood, Tarn Pocket Coat, Tarn Trail Trousers, Tarn Bank Shoes, Tarn Survey Wrap |
| North Pass (wood lookout) | 5 | leather, medium, fine wolf hide | quiet + dig | Pass Watch Cap, Pass Brush Jerkin, Pass Knee Breeches, Pass Ledge Boots, Pass Trail Suit |
| Hall Lamps (sunken hall) | 6 | cloth, light, land6 fleece | find + bench | Lamp Shade Hood, Lamp Pocket Coat, Lamp Step Trousers, Lamp Ash Shoes, Hall Lamp Wrap |
| River Sluice (city works) | 7 | leather, medium, land7 thick hide | hand + dig | Sluice Brim Cap, Sluice Strap Jerkin, Sluice Wader Breeches, Sluice Grate Boots, Sluice Crew Suit |

These are reward slots for separately reviewed quests. A second route, when supplied, grants the same row. The named boss pieces pair in order with the own-body boss table in [CREATURE_MATRIX.md](CREATURE_MATRIX.md). Each line uses the T7/T8/T9/T10/T10 and H/F/T/L/G order of that table. Use the tier's lead from the matching column. Boss clothing is a signature source, with no automatic copy on repeated spot ranks.

| Region | Column for its lead and drawing | Profile | Piece names |
|---|---|---|---|
| Valley | Hard hide | dig + guard | Split Tusk Cap, Sluice Grip Boots, Mill Beam Jerkin, Reed Jaw Breeches, Ford Ring Gloves |
| Highland | Quiet hide | guard + find | Crag Brow Cap, Tarn Step Boots, Ridge Hide Jerkin, Slate Back Breeches, Scree Knuckle Gloves |
| Elf wood | Bench cloth | quiet + find | Canopy Eye Hood, Root Step Shoes, Glade Fan Coat, Briar Fold Trousers, Pool Wing Mitts |
| Undead south | Finder hide | guard + hand | Bell Socket Cap, Vault Step Boots, Rib Latch Jerkin, Ash Wing Breeches, Hollow Grip Gloves |

At T10 only, give the following two series individual on-body drawings. Each uses the places H/T/L/F/G in order. These are earned through a land's specialist maker and trial, using the same row for every approved route.

| Class, lead | Profile | Piece names |
|---|---|---|
| cloth, land10 cord | quiet + hand | Open Fan Hood, Double Fold Mantle, Split Hem Trousers, Scalloped Shoes, Wing Cuff Mitts |
| leather, land10 soft hide | dig + quiet | High Crest Cap, Split Ridge Jerkin, Laced Knee Breeches, Hook Heel Boots, Fork Cuff Gloves |

### Count of the proposed table

| Tier | Ordinary | Set | Quest | Boss | Individual look | All |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 8 | 0 | 0 | 0 | 0 | 8 |
| 2 | 8 | 0 | 0 | 0 | 0 | 8 |
| 3 | 3 | 0 | 0 | 0 | 0 | 3 |
| 4 | 43 | 5 | 5 | 0 | 0 | 53 |
| 5 | 43 | 5 | 5 | 0 | 0 | 53 |
| 6 | 43 | 5 | 5 | 0 | 0 | 53 |
| 7 | 43 | 5 | 5 | 4 | 0 | 57 |
| 8 | 43 | 5 | 0 | 4 | 0 | 52 |
| 9 | 43 | 5 | 0 | 4 | 0 | 52 |
| 10 | 43 | 0 | 0 | 8 | 10 | 61 |
| All | 320 | 30 | 20 | 20 | 10 | 400 |

Early set members already in the ordinary column count once. These are design counts conditional on the row checks, icon proof and source proof. The gap from the ordinary rule to 400 is 80, all assigned above.

| Weight family | H | T | L | F | G | O | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Light | 37 | 40 | 36 | 36 | 34 | 2 | 185 |
| Medium | 31 | 32 | 33 | 32 | 29 | 2 | 159 |
| Mail | 8 | 8 | 8 | 8 | 0 | 0 | 32 |
| Plate | 6 | 6 | 6 | 6 | 0 | 0 | 24 |
| All | 82 | 86 | 83 | 82 | 63 | 4 | 400 |

There are 5/3/2 ordinary material lanes at T1/T2/T3 and nine at each later tier. Each late soft lane gives five pieces and each metal construction four, before the named additions. The full table's rarity design has 8 common, 99 uncommon and 293 rare rows. Rare is a limit on supply, so the merged capacity and rarity proof gates the size of each wave.

## 3. What the player sees

Each light or medium piece shares the drawing of its weight family and place. Mail and plate each use four drawings. So there are 20 shared drawings (six light, six medium, four mail, four plate) and ten individual T10 drawings. Estimate for the body art is **30 looks** before fitting to the races and views. Stage 5 should prototype fitted overlays on the rig, with O replacing both T and L. The heads and body pieces show the functional kit unless the player wears an overriding cosmetic on that place. Use mounts or material layers on the 3D door. See `docs/design/CLOTHING.md:301–339` and `docs/design/ANIMATION.md:13–15`.

A piece's lead material names its shared kit ramp and can carry the actual hide coat once that route lands. Swap ramp steps by index in the painted material mask, keeping light and dark in order, trim and ink separate. Use the 64 px rich grid and core plus declared shared ramps. For place-bound pieces the resulting ramp must fit that place's six-ramp limit. Never grade or price a coat or dye. A bag icon has its own shape and a visible construction cue such as a folded hem, loop, stud or scale edge. Check a contact sheet at actual display size in both doors, including in grey. A material tint alone cannot pass. See `docs/design/ART_SYSTEM.md:46–57`, `docs/art/PROP_FROM_REF.md:38–52`, `docs/art/PLACE_LOOK.md:40–49`, `docs/art/REUSE.md:7–30`, `docs/design/CLOTHING.md:288–296`.

## 4. Numbers and gates

| Tier | Effect cap | Uncommon score | Rare first / second | Wear level |
|---|---:|---:|---|---:|
| 1 | 5 | — | — | no requirement |
| 2 | 8 | 5 | — | 6 |
| 3 | 12 | 8 | 9 / 9 | 11 |
| 4 | 16 | 10 | 12 / 14 | 16 |
| 5 | 20 | 14 | 15 / 18 | 21 |
| 6 | 24 | 17 | 18 / 21 | 26 |
| 7 | 28 | 20 | 21 / 25 | 31 |
| 8 | 30 | 21 | 23 / 25 | 36 |
| 9 | 30 | 22 | 24 / 26 | 41 |
| 10 | 30 | — | 25 / 27 | 46 |

T1–3 caps and the wear ladder's first five entries come from `content/core/params.json:128–145`. T4+ and the scores in the table are proposals. Common gets one thing, uncommon one effect, rare two distinct effects. Reserve legendary for its own future row. Before the trait and attribute readers land, both are empty. Afterwards read slot and strength from the place conditions and `attr_bonus_max` from params. A common trait or attribute uses the piece's one allowance. See `docs/design/CLOTHING.md:182–249`, `schema/src/index.ts:183–195`, `content/core/params.json:1039–1068`.

At T4–10, an uncommon score can use the rounded-down endpoints of 500–750‰ of the tier cap. Each rare score uses 750–900‰. The preferred scores are in the table. Add 1 to uncommon top and glove scores; subtract 1 from legs and feet. For rare, head and hands add 1 to the first score and subtract 1 from the second. Legs and feet do the reverse. Top and outfit hold the table's pair. Reverse the preferred pair before that change for close armour. The proposed endpoint rule takes precedence over CLOTHING's proposed previous-tier floor where that floor would exhaust a late band's choices (`docs/design/CLOTHING.md:186–188`).

Expand in ascending tier, then ordinary, set, quest, boss, individual look, in the printed table order (ordinary columns left to right, places in row order). Leave the early rows fixed. Among the unused legal blocks at the given weight, choose least total distance from the preferred magnitudes, then smaller sum, then lower first and second magnitudes. Open links require guard strictly below quiet, close armour guard strictly above the magnitude of negative quiet. Refuse a cell with no block left. Use the signed effect keys in the comparison and retain this output when inserting rows later, so a new item never renumbers the gear already emitted.

The first effect points at its work profession. Find uses Digging, quiet uses Hunting, guard uses Guard when those readers exist. A piece is wearable below its listed level. The signed values are limited in magnitude to the cap one rung above the wearer's own, using base attributes and profession levels. A set bonus uses the active values, capped at the printed bonus, one fifth of the active sum (round down), and the remaining room under the set's ceiling. No attribute or trait stacks as a set reward. Each effect's complete-set sum stays at or under piece count × highest-tier cap, then the same R9 clamp as the other worn and learned effects. Earlier sets retain their recorded routes. Submit the T2 three-piece Reed Walker and Digger Leathers extensions together with their check results. See `docs/design/CLOTHING.md:203–217,260–278`, `docs/design/EQUIPMENT.md:82–112`.

## 5. Source of a piece and acceptance

- **Make.** One explicit recipe per craftable piece. H/F/G use one unit of cut lead, T/L use two, O uses three. Add one thread for soft work, or one same-tier backing for metal. A shaped or backed blank may combine those inputs first to keep the chain within three steps and preserve the valuable input on a miss. Require an input of at least tier minus one, real quantities and summed input weight at least the output weight. Soft at the tier's workshop, Handcraft `wear`; metal at the city's forge, Smithing `wear`. Use the tier's actual craft level band and speed/chance params. Keep early recipes and exceptions by their own IDs. See `docs/design/CLOTHING.md:133–139,252–258`, `docs/design/WEAPON_MATRIX.md:398–423`.
- **Buy.** Allow the approved plain T1 shelf and legal T2 shop sources after the solver and shop checks. Price via R8. T3 and above use finds, quests, boss drops or making under G41. A paid cosmetic cannot be a route to a scored item. The proposed town-rank weapon shop remains an owner ruling. See `DECISIONS.md:4563–4567`, `docs/design/WEAPON_MATRIX.md:575–592`.
- **Find.** Record a concrete find, quest or drop source and its capacity. A recipe scrap teaches an existing row. Exact item IDs travel across all routes. The gate-rubble T2 scraps wait for a live route, with finding independent of winning a fight. Use a one-time teacher or leave supply in a limited find or hunt where more scraps would break the rarity budget. T3 has a deep-ruins teacher where appropriate. A gated T1 recipe can be start-known; a found recipe uses its live route when the gate opens. See `docs/design/CLOTHING.md:133–140`, `DECISIONS.md:4563–4567`.
- **First wave after combat opens.** Reuse the four recorded T1 hide recipes and the local hare and roe sources, prove a carcass gives their inputs, the workshop and T1 teaching work, the shop gives the same ID, and the route still pays. Then open the T2 scraps and boiled pieces, followed by T3 hardened pieces once the teacher and station work. Bronze mail and town cloth wait for G45, forge and land input sources. Later cells stay as report rows until their inputs, stations, teachers and buyers or finds exist. Use the same rule in classic play and `/play3d/`. Weapon questions stay with the owner. This is the proposed wave for audit question 6. See `docs/design/CONTENT_MATRIX_AUDIT.md:65–70,104–108`, `docs/design/CLOTHING.md:133–140,394–408`.
- **Parity (audit question 2).** F1 compare the two small nodes and two reserved majors with other set-A families, retaining the two-small staging in `DECISIONS.md:4608–4612` on develop (#797). F2 use the shared craft XP and tier tables. F3 compare median per-unit craft time at most twice the peer median. F4 reject chains over three recipe steps. F5 hold each open family at two or more recipes and at most three times the smallest peer. Apply F3–F5 to the whole eligible wave, including existing items and peers, before choosing the next batch. A 43-row tier is capacity; it cannot open in bulk if peers fail F5. F6 prove family effects apply only to their family, including negative tests against tools and arms. See `docs/design/SKILL_FAMILIES.md:131–170`, `docs/design/CLOTHING_BALANCE.md:237–269`.

| Rule | What the report or release must prove |
|---|---|
| G35 | Stages 2–5 are reports and art planning. Generated rows reach content when combat opens. |
| G41 | Tier and rarity are separate. Require tier open, source gated at T3+, station at tier, profession and level inside band, climb at most one. |
| G44 | Correct wear places, soft requirements, at most two capped effects, compatible sets, and effect-free cosmetic layer. |
| G45 | Declared base classes, usable materials, no premature metal or new effect readers, and templates inside the bundle cap. |
| G34, G39, G40 | A trait answers a place condition. Power is earned in play. A miss keeps an input share and returns less than a success. |
| G42, G43 | Use capacity for rarity. Keep the shortest valid ingredient chain and each action within the active-time cap. |
| G17, G37 | Quest rewards wait for quest review, fair rotation and a route that keeps the day road open. |
| R2–R5 | Integer calculations, ordered IDs, seeded future rolls and stable canonical IDs with forward save mapping. |
| R6–R8 | Check activity bounds and shares, reachable inputs and the solver's certificate, and quote the shop floor from solved worth. At the recipe level, success value plus retained miss value, weighted by their chances, must reach input value. |
| R9, R11, R12 | Clamp combined rates, hold output of consumed inputs fixed, probe value drift and vary economy anchors within their bounds. |
| S1–S6 | S1 neutral names and lines describe present things. S2 a past claim has a speaker. S3 keep shared facts few and visible. S4 clues admit two readings. S5 a name cannot make a belief a joke or evil. S6 any linked season leaves a question open. |

Rules: `docs/design/GAME_RULES.md:179–183,403–431,484–545,765–770`, `docs/kernel-review-v1.md:91–122`, `docs/design/STORY.md:58–72`. Audit question 3 uses the separate danger and tier fields in [CREATURE_MATRIX.md](CREATURE_MATRIX.md). For question 4, a drop is a route to the same scored row, with its expected value checked against the encounter. The proposed signature-weapon drop and condition rules follow `docs/design/CREATURE_MATRIX.md:285` and the owner's rulings on NPC weapon drops, weapon wear and signature techniques (`docs/design/WEAPON_MATRIX.md:585`, `docs/design/WEAPONS.md:515–516`).

## 6. Stage 3 row contract

The source record is `tier, landSlot?, materialKey, leadItem, class, itemFamily, places[], weightFamily, profile, rarity, sourceKind`. Each allowed place makes one row carrying `id, name, slot, occupancy, weight, wear { effects[], req?, attrs?, trait?, set? }, icon { key, cue }, look { family, mask, ramp, override? }, sources[], waits[]`. A named row carries its own name, source label and place. A make source adds `recipeId, ingredients[{ id, qty }], station, stationTier, profession, family, level, activeMs, known, teacher?, gate?`. A non-make source carries its shop, find, quest, or boss slot and a value activity reference. Print a separate set record and slot list. Keep source keys stable when a land slot gets its eventual display name.

Reuse weapon tier/cell and input resolution, ordered row validation, integer arithmetic and configurable counts. Keep combat damage, weapon subclasses and price policy with their owners. Share `bandOf`, stack/input keys, row identity, small validators and count/report shapes where they apply. Deny a provisional row when its station, reader, route or proof is missing. Print rejected cells and reasons, then apply the ordinary content checks on a scratch bundle before any emission. See `docs/design/CONTENT_MATRIX_AUDIT.md:50–61`, `tools/src/balance/weapons.ts:342–368,398–439,461–467,866–928,1293–1323`.

## 7. Owner questions (open, to go to the owner as cards)

1. Should mail and plate trade more protection for more weight or noise? **Proposed: yes** because weight or noise gives extra protection a cost within the proposed caps.
2. Should six full working sets take 30 of the 400 places? **Proposed: yes** because each set has a job and each piece works on its own.
3. Should the ten named last-tier pieces each show their own cut on the character? **Proposed: yes** because a distinct cut makes each named piece recognizable when worn.
4. Should existing pieces with the same numbers get distinct weight or effects while keeping their names? **Proposed: yes** because keeping item IDs preserves saved references while the profiles become distinct. Recheck starting-outfit fairness (`docs/design/ARMOUR_MATRIX.md:19`).
