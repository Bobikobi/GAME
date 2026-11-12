# Weapon matrix: hundreds of hands from form, material and tier (2026-11-01)

Status: Proposed 01.11 by an outside developer, as the stream's next pull request that WEAPONS 5.3 (#609) names ("Scale": a matrix of form, material and tier); re-framed 02.11 to #598, the combat foundations on develop: the fight has one base, the built `bare_base` 8, and the starter hand is bare hands (decision 42). Every number on this page is proposed unless it carries a file and line; the anchors are on develop ebd425b2c. Nothing here is content. What can land now is this page, its source file, the report that expands it, the test that pins the two together and the word amendments to pages that are on develop (section 15; appendix), each on the owner's merge; every amendment to WEAPONS or CLOTHING, pages of the open pull request #609, waits for a follow-up once #609 lands.

**What it does not change.** No weapon content lands before combat: G35 ("nothing of a fight is built before the server and the presence relay", docs/design/GAME_RULES.md:405-406), G44 and decision 42 (the weaponless start, a safe demo) stand as written. The weapon block stays WEAPONS 3's seven fields (`tempo` quick | standard | heavy, `windup_t` 2..10, `reach` 1..2, `harm` 0..1000, `range?` 2..12, `ammo?` a class id, `noise?` 0..12) and the seven classes stay WEAPONS 2's (content classes under `tool`, beside the built `TOOL_KINDS`, schema/src/index.ts:53, and `BASE_CLASSES`, :95); a form is an item inside a class, never an eighth class, and a row's tier is the item's `tier` field (schema/src/index.ts:216). Harm stays fixed per hand under its tier's cell (WEAPONS 4, G79). No hand wears (WEAPONS 7, owner question 7 there). Bonuses and traits on found weapons (WEAPONS 8.1) and signature techniques on a few named weapons (WEAPONS 9.1) ride on top of a matrix hand and never change its block. A foe move's wind-up is the foe's, from a band of its style by its danger (proposed; the combat foundations draft's Q-5, unpublished, not in #598 or #609); the matrix only makes sure that every tier offers the player an answer to each style (section 9). Predators become foes with combat and the weaponless start stays safe (WEAPONS owner question 9).

**How to read it.** Ids in tables leave out the `core/` prefix. `bar(t)` in an input list is the line material or part of the row's own tier: at tier 5 `bar(t)` is `iron-bar` and `spearhead(t)` is `iron-spearhead`; `pouch(t)` names the hide line's material of the tier (at tier 5 `fiend-hide`), not a part. Inputs name distinct ids with a count when more than one. The source is one file (tools/src/balance/weapon-matrix.json, proposed); every table below is that file expanded, and every count is the generator's print, copied. WEAPONS, CLOTHING, QUARRYING, BUILD_SET and GAP_RS_GEAR are pages of the open pull request #609, not yet on develop: they are cited by page and section only ("WEAPONS 4 (#609)" at a first mention, then "WEAPONS 4"); a page or file on develop is cited with its line.

## 1. The matrix in one paragraph

A **form** is a hand of one class with one fixed shape (tempo, feel, noise, reach or range, ammunition class). A form runs a span of tiers; at tiers 1 to 3 each tier names its own inputs (the stone ages: flint, slate, greenstone, fang, hide, horn), and from tier 4 a form takes its **line's** material of the tier (a bar, a horn or a hide), so every new material brings a whole set: the bronze bar alone opens 36 of tier 4's 43 rows, iron 43 of tier 5's 51, steel 44 of tier 6's 52. The matrix holds 49 forms (blade 11, blunt 9, spear 6, staff 6, bow 7, thrown 6, sling 4), 9 part rows and 6 ammunition rows, and expands to 407 recipes: 70 at tiers 1 to 3 and 337 at tiers 4 to 10 (section 10), inside the direction's 70 to 80 and 300 to 350. One entry teaches a form; every higher tier of it is found at the bench by the try (section 7), so hundreds of recipes need 64 taught entries (16 known from the start, WEAPONS 5.4's 4 cache scraps, 44 quest rewards), not hundreds of scraps against the rarity budget. At tiers 2 and 3 the try amends a decided owner rule (owner question 5).

## 2. The grid: cells, shapes and prices

**The cell (WEAPONS 4, restated).** A hand's harm sits under its tier's cell: `max(0, r * 128 * swing // 8000 - 128)`, with `r` the tier's `hand_rate_max_permille` (1100, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000 for tiers 1 to 9), `swing` the built `swing_quick_t` 8, `swing_standard_t` 10 or `swing_heavy_t` 12 for quick, standard and heavy (#598's combat group, content/core/params.json:1110, :1096, :1102; the divisor 8000 is 1000 times the quick swing), and a ranged hand reading `r * 750 // 1000`. Tier 10 reads 3250: `hand_rate_max_permille` gains a tenth tier entry (proposed, a core param under G45; owner question 2a), and WEAPONS 4's stated range for it, "each 1000 to 3000", widens to 1000 to 3250. The power cap is a separate table, read by character level, not by tier: `power_cap_permille` has 14 entries, the last 3000 from character level 14 (content/core/params.json:66), and R9 clamps every rate multiplier with it (kernel/src/state.ts:559-564). A 15th entry of 3250 would raise the clamp on rare finds (kernel/src/step.ts:214), craft luck (:236) and gather speed (:1870-1872) for every character at level 15 or more, not only the strike, so the matrix leaves the cap at 3000 (owner question 2b): until the owner lifts R9 for all rates, a tier-10 hand strikes at most at the 3000 cap, as its form's tier-9 hand, and tier 10 adds its bonuses. The top is the most a shot of the tier adds (section 6): the key cell minus its half, rounded down, where arrows and bolts key on the ranged heavy cell and sling stones on the ranged standard cell.

| Tier | Rate (permille) | Close quick | Close standard | Close heavy | Ranged quick | Ranged standard | Ranged heavy | Top: arrow, bolt | Top: sling stone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1100 | 12 | 48 | 83 | 0 | 4 | 30 | 15 | 2 |
| 2 | 1250 | 32 | 72 | 112 | 0 | 21 | 51 | 26 | 11 |
| 3 | 1500 | 64 | 112 | 160 | 16 | 52 | 88 | 44 | 26 |
| 4 | 1750 | 96 | 152 | 208 | 39 | 81 | 123 | 62 | 41 |
| 5 | 2000 | 128 | 192 | 256 | 64 | 112 | 160 | 80 | 56 |
| 6 | 2250 | 160 | 232 | 304 | 87 | 141 | 195 | 98 | 71 |
| 7 | 2500 | 192 | 272 | 352 | 112 | 172 | 232 | 116 | 86 |
| 8 | 2750 | 224 | 312 | 400 | 135 | 201 | 267 | 134 | 101 |
| 9 | 3000 | 256 | 352 | 448 | 160 | 232 | 304 | 152 | 116 |
| 10 | 3250 | 288 | 392 | 496 | 183 | 261 | 339 | 170 | 131 |

**The shape.** A form's tempo and feel give its wind-up in ticks (quick 3, 5, 7; standard 4, 6, 8; heavy 6, 8, 10 for snap, even and drawn), inside the block's 2..10 and, tighter, from the built bare hand's wind-up `bare_windup_t` 3 (#598, content/core/params.json:1134) to under its tempo's built swing, `swing_quick_t` 8, `swing_standard_t` 10, `swing_heavy_t` 12 (:1090, :1096, :1102; WM-GRID, section 13): the swing and the wind-up floor are #598's, built on develop; the matrix reads them from the content and never restates or proposes them. Its noise is hushed 2, plain 4 or loud 6, inside the built `strike_noise` range 2 to 6 (content/core/params.json:650).

**The price.** A shape that gives something pays for it in harm, in permille of the cell: feel snap 80, even 40, drawn 0 (a faster wind-up costs); noise hushed 50, plain 25, loud 0; reach 2 costs 60; a range costs 20 for every 2 tiles past its class's shortest (bow and sling 6, thrown 3). The hand's harm is `cell * (1000 - price) // 1000`, and no shape may take more than a fifth (share floor 800; the dearest forms, the whirl-staff and the spear, pay 165). So no shape is free in harm: a snap, hushed dagger has less harm than a drawn, loud hatchet of the same tier and tempo (83 against 96 at tier 4), and the check of section 9 proves that no hand of a class, tier, tempo and ammunition is matched or beaten on every field by another in harm. A fight reads the hit, not the harm, and the hit is coarser: at the built `bare_base` 8 (#598, content/core/params.json:1140) one hit point is 16 harm points, so 44 pairs over the ten tiers price to the same hit, and there the cheaper shape buys its speed or quiet for nothing (13 of them at tiers 1 to 3; section 9 lists them; owner question 16). Measured, not hidden: in hits, a shape is free in those 44 pairs, and the count follows the base's grain inside its built range, 4 to 16: 82 ties at 4, 18 at 16.

**The price survives the clamp (amends WEAPONS 4).** WEAPONS 4 clamps a hand to the cell of a lower rate, under the soft requirement (`hand_rate_max_permille[own_tier + 1]`) and under the power cap (R9). Read as written, the clamp cuts every priced hand of a tempo to the same clamp cell, so a clamped hand loses its price and the cheap, fast or quiet shape matches or beats the dear one, the state the price exists to prevent: 144 dominated pairs one tier short (own tier t-2), 176 at cap 1000 (section 9). So the clamp is priced too: `eff_harm = min(harm, priced(clamp_cell))`, where `clamp_cell` is the lower of `harmAt(share(rate[own_tier + 1]), t)` and `harmAt(share(powerCap), t)`, and `priced(c) = c * (1000 - price) // 1000`; for a launcher the clamp applies to the launcher plus the loaded shot. It still softens power and never shape (WEAPONS 8), and the price is a fixed fact of the shape, readable from the block, so no field is added. Recomputed so, no pair is dominated at any own tier, nor at any power cap from 1200 to 3000 (or 3250). At caps 1000 and 1100 the quick cell is 0 or about 12 and the price rounds away: at character levels 1 and 2 the power cap flattens quick hands below the price's rounding, so the first two levels read shape alone (WM-CLAMP, section 9; owner question 15).

**A launcher (amends WEAPONS 6.1).** A launcher's own `harm` is its priced cell minus its tier's top, so the top shot of its own tier brings the pair to the priced cell exactly (a check, section 13), a lower-tier shot falls short, and the shape's price is paid by the pair as by a close hand. WEAPONS 6.1's "half its tier's cell" cannot stand once shapes are priced: half the cell plus the top passes the priced cell for every launcher that pays a price. The heads keep WEAPONS 6.1: barbed and shaped add the top, broad half the top, blunt and plain nothing.

## 3. The forms

Shape, wind-up, price, span, entry (section 7) and harm by tier; for a launcher the harm is its own, before the shot.

| Form | Class | Tempo, feel, noise | Reach or range | Wind-up | Price | Tiers | Entry | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| knife | blade | quick, snap, plain (4) | reach 1 | 3 | 105 | 1 to 10 | start | 10 | 28 | 57 | 85 | 114 | 143 | 171 | 200 | 229 | 257 |
| dagger | blade | quick, snap, hushed (2) | reach 1 | 3 | 130 | 2 to 10 | q-edge | - | 27 | 55 | 83 | 111 | 139 | 167 | 194 | 222 | 250 |
| seax | blade | quick, even, plain (4) | reach 1 | 5 | 65 | 2 to 10 | q-edge | - | 29 | 59 | 89 | 119 | 149 | 179 | 209 | 239 | 269 |
| hatchet | blade | quick, drawn, loud (6) | reach 1 | 7 | 0 | 1 to 10 | start | 12 | 32 | 64 | 96 | 128 | 160 | 192 | 224 | 256 | 288 |
| talon | blade | quick, drawn, hushed (2) | reach 1 | 7 | 50 | 3 to 5 | q-edge | - | - | 60 | 91 | 121 | - | - | - | - | - |
| sword | blade | standard, snap, plain (4) | reach 1 | 4 | 105 | 4 to 10 | q-forge-4 | - | - | - | 136 | 171 | 207 | 243 | 279 | 315 | 350 |
| sabre | blade | standard, even, hushed (2) | reach 1 | 6 | 90 | 5 to 10 | q-forge-5 | - | - | - | - | 174 | 211 | 247 | 283 | 320 | 356 |
| longsword | blade | standard, drawn, plain (4) | reach 1 | 8 | 25 | 5 to 10 | q-forge-5 | - | - | - | - | 187 | 226 | 265 | 304 | 343 | 382 |
| falchion | blade | heavy, snap, plain (4) | reach 1 | 6 | 105 | 4 to 10 | q-forge-4 | - | - | - | 186 | 229 | 272 | 315 | 358 | 400 | 443 |
| greatsword | blade | heavy, even, loud (6) | reach 1 | 8 | 40 | 6 to 10 | q-forge-6 | - | - | - | - | - | 291 | 337 | 384 | 430 | 476 |
| battleaxe | blade | heavy, drawn, plain (4) | reach 1 | 10 | 25 | 4 to 10 | q-forge-4 | - | - | - | 202 | 249 | 296 | 343 | 390 | 436 | 483 |
| club | blunt | heavy, snap, loud (6) | reach 1 | 6 | 80 | 1 to 3 | start | 76 | 103 | 147 | - | - | - | - | - | - | - |
| cudgel | blunt | quick, even, hushed (2) | reach 1 | 5 | 90 | 1 to 6 | start | 10 | 29 | 58 | 87 | 116 | 145 | - | - | - | - |
| hammer | blunt | quick, snap, loud (6) | reach 1 | 3 | 80 | 2 to 6 | q-stone | - | 29 | 58 | 88 | 117 | 147 | - | - | - | - |
| mace | blunt | standard, snap, loud (6) | reach 1 | 4 | 80 | 3 to 10 | q-stone | - | - | 103 | 139 | 176 | 213 | 250 | 287 | 323 | 360 |
| warhammer | blunt | standard, even, plain (4) | reach 1 | 6 | 65 | 4 to 10 | q-forge-4 | - | - | - | 142 | 179 | 216 | 254 | 291 | 329 | 366 |
| flail | blunt | standard, drawn, loud (6) | reach 1 | 8 | 0 | 5 to 10 | q-forge-5 | - | - | - | - | 192 | 232 | 272 | 312 | 352 | 392 |
| war-pick | blunt | heavy, even, hushed (2) | reach 1 | 8 | 90 | 5 to 10 | q-forge-5 | - | - | - | - | 232 | 276 | 320 | 364 | 407 | 451 |
| morning-star | blunt | heavy, even, plain (4) | reach 1 | 8 | 65 | 6 to 10 | q-forge-6 | - | - | - | - | - | 284 | 329 | 374 | 418 | 463 |
| maul | blunt | heavy, drawn, loud (6) | reach 1 | 10 | 0 | 2 to 10 | q-stone | - | 112 | 160 | 208 | 256 | 304 | 352 | 400 | 448 | 496 |
| spear | spear | standard, snap, plain (4) | reach 2 | 4 | 165 | 2 to 10 | cache | - | 60 | 93 | 126 | 160 | 193 | 227 | 260 | 293 | 327 |
| short-spear | spear | quick, even, plain (4) | reach 2 | 5 | 125 | 2 to 7 | q-hunt | - | 28 | 56 | 84 | 112 | 140 | 168 | - | - | - |
| boar-spear | spear | standard, even, loud (6) | reach 2 | 6 | 100 | 3 to 10 | q-staff | - | - | 100 | 136 | 172 | 208 | 244 | 280 | 316 | 352 |
| glaive | spear | standard, drawn, loud (6) | reach 2 | 8 | 60 | 4 to 10 | q-pole-4 | - | - | - | 142 | 180 | 218 | 255 | 293 | 330 | 368 |
| halberd | spear | heavy, even, loud (6) | reach 2 | 8 | 100 | 5 to 10 | q-pole-5 | - | - | - | - | 230 | 273 | 316 | 360 | 403 | 446 |
| pike | spear | heavy, drawn, plain (4) | reach 2 | 10 | 85 | 6 to 10 | q-pole-6 | - | - | - | - | - | 278 | 322 | 366 | 409 | 453 |
| quarterstaff | staff | standard, even, plain (4) | reach 2 | 6 | 125 | 1 to 10 | start | 42 | 63 | 98 | 133 | 168 | 203 | 238 | 273 | 308 | 343 |
| short-staff | staff | quick, drawn, plain (4) | reach 1 | 7 | 25 | 1 to 5 | start | 11 | 31 | 62 | 93 | 124 | - | - | - | - | - |
| crook | staff | standard, even, hushed (2) | reach 2 | 6 | 150 | 2 to 6 | q-staff | - | 61 | 95 | 129 | 163 | 197 | - | - | - | - |
| long-staff | staff | standard, drawn, plain (4) | reach 2 | 8 | 85 | 3 to 10 | q-staff | - | - | 102 | 139 | 175 | 212 | 248 | 285 | 322 | 358 |
| war-staff | staff | heavy, snap, loud (6) | reach 2 | 6 | 140 | 4 to 10 | q-pole-4 | - | - | - | 178 | 220 | 261 | 302 | 344 | 385 | 426 |
| whirl-staff | staff | quick, snap, plain (4) | reach 2 | 3 | 165 | 5 to 10 | q-pole-5 | - | - | - | - | 106 | 133 | 160 | 187 | 213 | 240 |
| short-bow | bow | heavy, snap, hushed (2) | range 6, fires arrow | 6 | 130 | 3 to 7 | q-silk | - | - | 32 | 45 | 59 | 71 | 85 | - | - | - |
| bow | bow | heavy, even, plain (4) | range 8, fires arrow | 8 | 85 | 3 to 10 | cache | - | - | 36 | 50 | 66 | 80 | 96 | 110 | 126 | 140 |
| longbow | bow | heavy, drawn, plain (4) | range 10, fires arrow | 10 | 65 | 4 to 10 | q-bowyer | - | - | - | 53 | 69 | 84 | 100 | 115 | 132 | 146 |
| horn-bow | bow | heavy, snap, plain (4) | range 8, fires arrow | 6 | 125 | 5 to 10 | q-pole-5 | - | - | - | - | 60 | 72 | 87 | 99 | 114 | 126 |
| light-crossbow | bow | heavy, even, hushed (2) | range 6, fires bolt | 8 | 90 | 4 to 10 | q-bowyer | - | - | - | 49 | 65 | 79 | 95 | 108 | 124 | 138 |
| crossbow | bow | heavy, drawn, loud (6) | range 8, fires bolt | 10 | 20 | 5 to 10 | q-pole-5 | - | - | - | - | 76 | 93 | 111 | 127 | 145 | 162 |
| arbalest | bow | heavy, drawn, loud (6) | range 10, fires bolt | 10 | 40 | 7 to 10 | q-pole-7 | - | - | - | - | - | - | 106 | 122 | 139 | 155 |
| throwing-stones | thrown | heavy, drawn, plain (4) | range 3 | 10 | 25 | 1 | start | 29 | - | - | - | - | - | - | - | - | - |
| rabbit-stick | thrown | heavy, even, plain (4) | range 5 | 8 | 85 | 1 to 3 | start | 27 | 46 | 80 | - | - | - | - | - | - | - |
| darts | thrown | standard, even, hushed (2) | range 5 | 6 | 110 | 2 to 7 | q-hunt | - | 18 | 46 | 72 | 99 | 125 | 153 | - | - | - |
| throwing-knives | thrown | quick, snap, hushed (2) | range 3 | 3 | 130 | 3 to 10 | q-edge | - | - | 13 | 33 | 55 | 75 | 97 | 117 | 139 | 159 |
| throwing-axe | thrown | heavy, even, loud (6) | range 3 | 8 | 40 | 3 to 10 | q-stone | - | - | 84 | 118 | 153 | 187 | 222 | 256 | 291 | 325 |
| javelin | thrown | heavy, drawn, plain (4) | range 7 | 10 | 65 | 4 to 10 | q-pole-4 | - | - | - | 115 | 149 | 182 | 216 | 249 | 284 | 316 |
| sling | sling | standard, drawn, plain (4) | range 6, fires sling-stone | 8 | 25 | 1 to 10 | start | 1 | 9 | 24 | 37 | 53 | 66 | 81 | 94 | 110 | 123 |
| braided-sling | sling | standard, even, hushed (2) | range 6, fires sling-stone | 6 | 90 | 2 to 10 | q-silk | - | 8 | 21 | 32 | 45 | 57 | 70 | 81 | 95 | 106 |
| long-sling | sling | heavy, drawn, plain (4) | range 8, fires sling-stone | 10 | 45 | 3 to 10 | q-hunt | - | - | 58 | 76 | 96 | 115 | 135 | 153 | 174 | 192 |
| staff-sling | sling | heavy, even, loud (6) | range 10, fires sling-stone | 8 | 80 | 4 to 10 | q-pole-4 | - | - | - | 72 | 91 | 108 | 127 | 144 | 163 | 180 |

Inputs by tier, who makes each band and the ids at tiers 1 to 3. From tier 4 a row's id is its line material's first word and the form (`bronze-knife`, `iron-longsword`, `antler-bow`, `hardened-sling`, `land7-pike`); `landN-` ids are slots, renamed when the land names its material.

| Form | Tier 1 | Tier 2 | Tier 3 | Tier 4 and up | Made by (tiers 1-3 / 4 up) | Ids at tiers 1-3 |
| --- | --- | --- | --- | --- | --- | --- |
| knife | flint, branch, reed-cord | slate, branch, sinew-cord | wolf-fang, branch, sinew-cord | bar(t), branch (line bar) | handcraft / smithing | flint-knife, slate-knife, fang-knife |
| dagger | - | boar-tusk, bone-handle | antler, bone-handle | bar(t), bone-handle (line bar) | handcraft / smithing | tusk-dagger, antler-dagger |
| seax | - | slate, bone-handle, sinew-cord | greenstone, bone-handle, sinew-cord | bar(t), bone-handle, sinew-cord (line bar) | handcraft / smithing | slate-seax, greenstone-seax |
| hatchet | 2 flint, branch, hare-hide | 2 slate, branch, hare-hide | 2 greenstone, branch, hare-hide | bar(t), branch, hare-hide (line bar) | handcraft / smithing | flint-hatchet, slate-hatchet, greenstone-hatchet |
| talon | - | - | claw, roe-hide, sinew-cord | bar(t), roe-hide, sinew-cord (line bar) | handcraft / smithing | claw-talon |
| sword | - | - | - | 2 bar(t), bone-handle, roe-hide (line bar) | - / smithing | - |
| sabre | - | - | - | 2 bar(t), bone-handle, hare-hide (line bar) | - / smithing | - |
| longsword | - | - | - | 3 bar(t), bone-handle, roe-hide, sinew-cord (line bar) | - / smithing | - |
| falchion | - | - | - | 2 bar(t), bone-handle, branch (line bar) | - / smithing | - |
| greatsword | - | - | - | 3 bar(t), branch, roe-hide (line bar) | - / smithing | - |
| battleaxe | - | - | - | 3 bar(t), log (line bar) | - / smithing | - |
| club | log | log, slate, sinew-cord | log, greenstone, roe-hide | - | handcraft / - | club, slate-club, greenstone-club |
| cudgel | branch, stone, reed-cord | branch, slate, roe-hide | branch, greenstone, roe-hide | bar(t), roe-hide (line bar) | handcraft / smithing | stone-cudgel, slate-cudgel, greenstone-cudgel |
| hammer | - | stone, log, reed-cord | greenstone, log, reed-cord | bar(t), log, reed-cord (line bar) | handcraft / smithing | stone-hammer, greenstone-hammer |
| mace | - | - | greenstone, 2 branch, sinew-cord | 2 bar(t), 2 branch, sinew-cord (line bar) | handcraft / smithing | greenstone-mace |
| warhammer | - | - | - | 2 bar(t), log, roe-hide (line bar) | - / smithing | - |
| flail | - | - | - | 2 bar(t), branch, roe-hide, sinew-cord (line bar) | - / smithing | - |
| war-pick | - | - | - | 2 bar(t), log, hare-hide (line bar) | - / smithing | - |
| morning-star | - | - | - | 3 bar(t), log, roe-hide, sinew-cord (line bar) | - / smithing | - |
| maul | - | 2 stone, branch, sinew-cord | 2 greenstone, log, sinew-cord | 3 bar(t), log, sinew-cord (line bar) | handcraft / smithing | stone-maul, greenstone-maul |
| spear | - | 2 branch, 2 flint, roe-sinew | wolf-fang, bow-stave, sinew-cord | bow-stave, spearhead(t), sinew-cord (line bar) | handcraft / woodcraft | spear, fang-spear |
| short-spear | - | 2 branch, slate, roe-sinew | 2 branch, antler, roe-sinew | branch, spearhead(t), roe-sinew (line bar) | handcraft / woodcraft | slate-short-spear, antler-short-spear |
| boar-spear | - | - | bow-stave, greenstone, roe-sinew | bow-stave, spearhead(t), fitting(t) (line bar) | handcraft / woodcraft | greenstone-boar-spear |
| glaive | - | - | - | log, spearhead(t), sinew-cord (line bar) | - / woodcraft | - |
| halberd | - | - | - | log, spearhead(t), fitting(t) (line bar) | - / woodcraft | - |
| pike | - | - | - | 2 bow-stave, spearhead(t), roe-hide (line bar) | - / woodcraft | - |
| quarterstaff | log, reed-cord | bow-stave, roe-hide | bow-stave, greenstone, sinew-cord | bow-stave, fitting(t), sinew-cord (line bar) | handcraft / woodcraft | quarterstaff, bound-staff, capped-staff |
| short-staff | branch, roe-hide | bow-stave, reed-cord | bow-stave, wolf-hide | bow-stave, fitting(t) (line bar) | handcraft / woodcraft | oak-short-staff, stave-short-staff, wolf-hide-short-staff |
| crook | - | bow-stave, hare-hide | bow-stave, antler | bow-stave, fitting(t), roe-hide (line bar) | handcraft / woodcraft | hide-bound-crook, antler-crook |
| long-staff | - | - | 2 bow-stave, sinew-cord | 2 bow-stave, fitting(t), roe-sinew (line bar) | handcraft / woodcraft | oak-long-staff |
| war-staff | - | - | - | log, 2 fitting(t) (line bar) | - / woodcraft | - |
| whirl-staff | - | - | - | bow-stave, 2 fitting(t), reed-cord (line bar) | - / woodcraft | - |
| short-bow | - | - | bow-stave, silk-string | limb(t), bow-string (line horn) | handcraft / woodcraft | silk-short-bow |
| bow | - | - | bow-stave, bow-string | limb(t), bow-stave, bow-string (line horn) | handcraft / woodcraft | bow |
| longbow | - | - | - | limb(t), 2 bow-stave, silk-string (line horn) | - / woodcraft | - |
| horn-bow | - | - | - | 2 limb(t), bow-string, sinew-cord (line horn) | - / woodcraft | - |
| light-crossbow | - | - | - | log, fitting(t), bow-string (line bar) | - / woodcraft | - |
| crossbow | - | - | - | log, fitting(t), limb(t), bow-string (line bar) | - / woodcraft | - |
| arbalest | - | - | - | log, 2 fitting(t), limb(t), silk-string (line bar) | - / woodcraft | - |
| throwing-stones | 3 stone | - | - | - | handcraft / - | throwing-stones |
| rabbit-stick | branch, stone | bow-stave, stone | bow-stave, wolf-fang | - | handcraft / - | oak-rabbit-stick, stave-rabbit-stick, fang-rabbit-stick |
| darts | - | 2 flint, branch | 2 greenstone, branch | bar(t), 2 branch, feather (line bar) | handcraft / smithing | flint-darts, greenstone-darts |
| throwing-knives | - | - | greenstone, hare-hide | 2 bar(t), hare-hide (line bar) | handcraft / smithing | greenstone-throwing-knives |
| throwing-axe | - | - | greenstone, branch, sinew-cord | bar(t), 2 branch, roe-sinew (line bar) | handcraft / smithing | throwing-axe |
| javelin | - | - | - | bow-stave, spearhead(t), feather (line bar) | - / woodcraft | - |
| sling | reed-cord, hare-hide | 2 sinew-cord, roe-hide | 2 sinew-cord, wolf-hide | pouch(t), 2 sinew-cord (line pouch) | handcraft / leatherwork | sling, sinew-sling, wolf-sling |
| braided-sling | - | 3 sinew-cord, hare-hide | 2 silk-string, hare-hide | pouch(t), silk-string, sinew-cord (line pouch) | handcraft / leatherwork | sinew-braided-sling, silk-braided-sling |
| long-sling | - | - | bow-string, wolf-hide | pouch(t), bow-string (line pouch) | handcraft / leatherwork | wolf-long-sling |
| staff-sling | - | - | - | bow-stave, pouch(t), fitting(t) (line bar) | - / woodcraft | - |

**Forms that end.** Eleven forms stop before tier 10 (the talon at 5, the short-staff at 5, the cudgel, the hammer and the crook at 6, the short-spear, the short-bow and the darts at 7, the club and the rabbit-stick at 3, the throwing stones at 1): each is a stone-age or early shape whose job a later form of its class takes over, and stopping it keeps the later tiers' shape pools distinct (section 9). Owner question 8.

## 4. Lines and the materials map

Three lines carry a form past tier 3: **bar** (Smithing's metal: every blade and blunt hand, the metal thrown hands, the shot, every head and fitting), **horn** (the bow limb, Woodcraft's), and **hide** (the sling hands, Leatherwork's: the tier's hide is the pouch itself, and the matrix has no pouch part). A form names one line; a row may also take another line's material or part (the staff-sling takes the tier's hide and a metal fitting).

| Tier | bar (Smithing; blades, blunt, heads, fittings) | horn (Woodcraft; bow limbs) | hide (Leatherwork; sling hands) | Id prefix of the tier |
| --- | --- | --- | --- | --- |
| 4 | bronze-bar (QUARRYING 13; tier 4) | antler (waits: the hart; tier 3) | hardened-leather (proposed by this page, amending CLOTHING; tier 3) | antler, bronze, hardened |
| 5 | iron-bar (QUARRYING 13; tier 5) | fiend-horn (HUNT_FAMILIES 4, 5: the fiend is tier 5; tier 5) | fiend-hide (HUNT_FAMILIES 4, 5: the fiend is tier 5; tier 5) | fiend, iron |
| 6 | steel-bar (QUARRYING 2.5; tier 6) | land6-horn (a land slot; tier 6) | land6-hide (a land slot; tier 6) | land6, steel |
| 7 | land7-bar (a land slot; tier 7) | land7-horn (a land slot; tier 7) | land7-hide (a land slot; tier 7) | land7 |
| 8 | land8-bar (a land slot; tier 8) | drake-bone (HUNT_FAMILIES 4, 5: the drake's scale and bones; tier 8) | drake-hide (HUNT_FAMILIES 4, 5: the drake's scale and bones; tier 8) | drake, land8 |
| 9 | land9-bar (a land slot; tier 9) | land9-horn (a land slot; tier 9) | land9-hide (a land slot; tier 9) | land9 |
| 10 | land10-bar (a land slot; tier 10) | land10-horn (a land slot; tier 10) | land10-hide (a land slot; tier 10) | land10 |

**Land slots.** Metals past steel and the horns and hides of lands not yet written are slots: QUARRYING 2.5 leaves the metals past steel to the next lands, and the matrix does not name them. 184 of the 191 recipes at tiers 7 to 10 rest on a land slot, and 194 of the 337 at tiers 4 to 10 (section 10); each opens when its land does, and a slot's ids are renamed then with no other change to its rows. Owner question 6 asks whether two named alloys should fill tiers 7 and 8 instead.

**The materials and where they come from.** Built on develop: `stone`, `log`, `branch`, `reed-cord`, `roe-sinew`, the hare's and the roe's hide and bone, `wolf-fang`, `wolf-hide`. Proposed by pages of this stream and landing with their first consumer: `flint` (tier 1), `slate` (tier 2) and `greenstone` (tier 3) by QUARRYING; `sinew-thread` by CLOTHING; `hardened-leather` (tier 3) by this page, amending CLOTHING (2 `boiled-leather` and 1 `herb`, Handcraft at the workshop of tier 3, level 6, found by the try; section 12); `bone-handle` by MATERIALS 3.3; `boar-tusk` and `claw` by HUNT_FAMILIES 5; `spider-silk` at tier 2 by HUNT_FAMILIES 4 and 5 (the tomb spider stands at d1, so its silk is tier 2 by the d-rule, and the tier-3 silk string climbs one tier from it); `fiend-horn` and `fiend-hide` (tier 5) by HUNT_FAMILIES 4 and 5 (the fiend is tier 5); `drake-bone` and `drake-hide` (tier 8) by HUNT_FAMILIES 4 and 5 (the drake's scale and bones); the fiend and the drake stand above the open ladder, and their goods take their own tier, not the d-rule's (section 12); `bronze-bar` and `iron-bar` by QUARRYING 13; `steel-bar` by QUARRYING 2.5. Two have no source yet and their rows wait: `antler` (the hart) and `feather` (no feather item exists; content/core/items/goods.json declares the class only).

## 5. Parts and who makes what

| Part | Tiers | Tier 1 to 3 inputs | Tier 4 and up inputs | Made by (1-3 / 4 up) | Entry | Ids |
| --- | --- | --- | --- | --- | --- | --- |
| sinew-cord | 1 | T1: 2 sinew-thread | - | handcraft / - | start | sinew-cord |
| arrow-shafts | 1 | T1: branch | - | handcraft / - | start | arrow-shafts |
| arrowheads | 1 to 10 | T1: 2 flint; T2: 2 slate, roe-bone; T3: 2 greenstone, roe-bone | 2 bar(t), roe-bone | handcraft / smithing | start | flint-arrowheads to land10-arrowheads (10) |
| bow-stave | 2 | T2: log | - | handcraft / - | cache | bow-stave |
| bow-string | 2 | T2: 2 sinew-cord | - | handcraft / - | cache | bow-string |
| silk-string | 3 | T3: 2 spider-silk | - | handcraft / - | q-silk | silk-string |
| spearhead | 4 to 10 | - | bar(t), sinew-cord | - / smithing | q-heads | bronze-spearhead to land10-spearhead (7) |
| fitting | 4 to 10 | - | bar(t), roe-sinew | - / smithing | q-heads | bronze-fitting to land10-fitting (7) |
| limb | 4 to 10 | - | bow-stave, horn(t), sinew-cord | - / woodcraft | q-bowyer | antler-limb to land10-limb (7) |

**The station split.** At tiers 1 to 3 Handcraft makes every row at the camp's workshop, the only craft the workshop has today (one craft profession per station, tools/src/check.ts:378-383). From tier 4, metal is Smithing's only, at the city's forge (EQUIPMENT 3.7; `STATIONS` is `fire` and `workshop` today, schema/src/index.ts:56, so the forge is a core release). Bows, staves and spears past tier 3 are Woodcraft's, at the workshop: Woodcraft buys or carries Smithing's spearheads, fittings and arrowheads and fits them to its staves, shafts and limbs, so the two crafts trade. Leatherwork makes the three sling hands from tier 4 from its hide line, and Woodcraft also makes the javelin, the staff-sling, the arrows and the bolts (section 12: EQUIPMENT 3.7 amended). Woodcraft and Leatherwork share the workshop with Handcraft by naming `profession` on each recipe (schema/src/index.ts:429, :449; the check reads it first, tools/src/check.ts:425).

## 6. Ammunition and launcher pairs

WEAPONS 6's block (`for`, `shots`, `harm_add`, `head`, `range_add?`) and its matching rule stand: a launcher fires its own ammunition class at a tier at most its own. The matrix adds a third ammunition class, `core/bolt` under `tool` beside `core/arrow` and `core/sling-stone`, fired by the three crossbows; a bow form names its class in `weapon.ammo` (owner question 4).

| Ammunition | Class | Head | Shots | range_add | Tiers | Entry | Tier 1 to 3 inputs | Tier 4 and up inputs | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| blunt-arrows | arrow | blunt | 10 | 0 | 1 | start | T1: arrow-shafts, hare-bone, feather | - | 0 | - | - | - | - | - | - | - | - | - |
| broad-arrows | arrow | broad | 10 | 0 | 1 to 10 | start | T1 to T3: arrow-shafts, arrowheads(t), feather | arrow-shafts, arrowheads(t), feather | 7 | 13 | 22 | 31 | 40 | 49 | 58 | 67 | 76 | 85 |
| barbed-arrows | arrow | barbed | 10 | 0 | 1 to 10 | start | T1: arrow-shafts, roe-bone, feather; T2: arrow-shafts, boar-tusk, feather; T3: arrow-shafts, arrowheads(t), roe-bone, feather | arrow-shafts, arrowheads(t), roe-bone, feather | 15 | 26 | 44 | 62 | 80 | 98 | 116 | 134 | 152 | 170 |
| broad-bolts | bolt | broad | 10 | 0 | 4 to 10 | q-bolts | - | arrow-shafts, arrowheads(t) | - | - | - | 31 | 40 | 49 | 58 | 67 | 76 | 85 |
| barbed-bolts | bolt | barbed | 10 | 0 | 4 to 10 | q-bolts | - | arrow-shafts, arrowheads(t), roe-bone | - | - | - | 62 | 80 | 98 | 116 | 134 | 152 | 170 |
| shot | sling-stone | shaped | 5 | 1 | 1 to 10 | start | T1: 2 stone; T2: slate, stone; T3: greenstone, stone | bar(t), stone | 2 | 11 | 26 | 41 | 56 | 71 | 86 | 101 | 116 | 131 |

Every launcher with its own harm and the best shot of its tier, the pair, and the cell in brackets (the pair is under the priced cell, which is under the cell):

```text
short-bow: T3 32+44=76 (88); T4 45+62=107 (123); T5 59+80=139 (160); T6 71+98=169 (195); T7 85+116=201 (232)
bow: T3 36+44=80 (88); T4 50+62=112 (123); T5 66+80=146 (160); T6 80+98=178 (195); T7 96+116=212 (232); T8 110+134=244 (267); T9 126+152=278 (304); T10 140+170=310 (339)
longbow: T4 53+62=115 (123); T5 69+80=149 (160); T6 84+98=182 (195); T7 100+116=216 (232); T8 115+134=249 (267); T9 132+152=284 (304); T10 146+170=316 (339)
horn-bow: T5 60+80=140 (160); T6 72+98=170 (195); T7 87+116=203 (232); T8 99+134=233 (267); T9 114+152=266 (304); T10 126+170=296 (339)
light-crossbow: T4 49+62=111 (123); T5 65+80=145 (160); T6 79+98=177 (195); T7 95+116=211 (232); T8 108+134=242 (267); T9 124+152=276 (304); T10 138+170=308 (339)
crossbow: T5 76+80=156 (160); T6 93+98=191 (195); T7 111+116=227 (232); T8 127+134=261 (267); T9 145+152=297 (304); T10 162+170=332 (339)
arbalest: T7 106+116=222 (232); T8 122+134=256 (267); T9 139+152=291 (304); T10 155+170=325 (339)
sling: T1 1+2=3 (4); T2 9+11=20 (21); T3 24+26=50 (52); T4 37+41=78 (81); T5 53+56=109 (112); T6 66+71=137 (141); T7 81+86=167 (172); T8 94+101=195 (201); T9 110+116=226 (232); T10 123+131=254 (261)
braided-sling: T2 8+11=19 (21); T3 21+26=47 (52); T4 32+41=73 (81); T5 45+56=101 (112); T6 57+71=128 (141); T7 70+86=156 (172); T8 81+101=182 (201); T9 95+116=211 (232); T10 106+131=237 (261)
long-sling: T3 58+26=84 (88); T4 76+41=117 (123); T5 96+56=152 (160); T6 115+71=186 (195); T7 135+86=221 (232); T8 153+101=254 (267); T9 174+116=290 (304); T10 192+131=323 (339)
staff-sling: T4 72+41=113 (123); T5 91+56=147 (160); T6 108+71=179 (195); T7 127+86=213 (232); T8 144+101=245 (267); T9 163+116=279 (304); T10 180+131=311 (339)
```

The matching rule allows 732 launcher and ammunition pairs across tiers; every one is under its launcher's priced cell, every ammunition tier has a launcher of that tier or more, every launcher has a shot (the sling also throws the loose stone, WEAPONS 6), and no range with `range_add` passes 12. With its own tier's top shot every pair equals its launcher's priced cell (section 2; a check, section 13), so launchers of one tempo rank by price alone. Any heavy launcher priced under the bow's 85 out-hits it at every tier where both exist: the long sling (45), the longbow (65), the staff-sling (80), the crossbow (20) and the arbalest (40); a tier-3 long sling with its shot counts 84, the bow 80. The drawn feel's slower wind-up (10 against 8) is bought as harm. Which cell the shot keys on changes only how the total splits between launcher and shot. This is the price working as designed; it stays an open point only in case the owner does not want a sling to out-hit the bow (owner question 1, option C). The order by tier, from the generator:

```text
-- launchers by tier: the pair with its own tier's top shot (= its priced cell), highest first; the price in brackets
T1  sling 3 (25)
T2  sling 20 (25), braided-sling 19 (90)
T3  long-sling 84 (45), bow 80 (85), short-bow 76 (130), sling 50 (25), braided-sling 47 (90)
T4  long-sling 117 (45), longbow 115 (65), staff-sling 113 (80), bow 112 (85), light-crossbow 111 (90), short-bow 107 (130), sling 78 (25), braided-sling 73 (90)
T5  crossbow 156 (20), long-sling 152 (45), longbow 149 (65), staff-sling 147 (80), bow 146 (85), light-crossbow 145 (90), horn-bow 140 (125), short-bow 139 (130), sling 109 (25), braided-sling 101 (90)
T6  crossbow 191 (20), long-sling 186 (45), longbow 182 (65), staff-sling 179 (80), bow 178 (85), light-crossbow 177 (90), horn-bow 170 (125), short-bow 169 (130), sling 137 (25), braided-sling 128 (90)
T7  crossbow 227 (20), arbalest 222 (40), long-sling 221 (45), longbow 216 (65), staff-sling 213 (80), bow 212 (85), light-crossbow 211 (90), horn-bow 203 (125), short-bow 201 (130), sling 167 (25), braided-sling 156 (90)
T8  crossbow 261 (20), arbalest 256 (40), long-sling 254 (45), longbow 249 (65), staff-sling 245 (80), bow 244 (85), light-crossbow 242 (90), horn-bow 233 (125), sling 195 (25), braided-sling 182 (90)
T9  crossbow 297 (20), arbalest 291 (40), long-sling 290 (45), longbow 284 (65), staff-sling 279 (80), bow 278 (85), light-crossbow 276 (90), horn-bow 266 (125), sling 226 (25), braided-sling 211 (90)
T10 crossbow 332 (20), arbalest 325 (40), long-sling 323 (45), longbow 316 (65), staff-sling 311 (80), bow 310 (85), light-crossbow 308 (90), horn-bow 296 (125), sling 254 (25), braided-sling 237 (90)
```

## 7. Teaching: one entry a form, then the try

**The rule (amends WEAPONS 5.2's `found`; at tiers 2 and 3 it also amends the owner's decision of 2026-10-10, "First-tier recipes are known from the start; higher tiers are dug up", section 12 and owner question 5).** Each row of the matrix (a form, a part or an ammunition) has one **entry**, its first tier, taught by `start`, by the hunters' cache or by a quest. Every higher tier of the row is **found by the try** at the bench. The try (proposed; the crafting discovery draft, unpublished, names it D1): an action at a station kind that takes 2 to `try_max_inputs` (4, proposed) distinct item ids, quantities not counted, and matches one recipe marked `discover` on `RecipeBody` (a proposed schema field, section 12) at that station kind, not yet known, **whose family the player knows one tier below**; the station is at least the recipe's tier (kernel/src/step.ts:222); an input set one id away from a match gives the "almost" hint (the draft's D6). The candidate rule is this page's: the draft's D2 (candidates: marked `discover`, at this station kind, not yet known) gains the family condition. The family is the item's `family` word (schema/src/index.ts:212), the form's name. There is no level condition on the try: the level bites through the chance, as every craft's does (schema/src/index.ts:428). In content each tier is `known: found` (schema/src/index.ts:453) with the proposed `discover` marker. This page restates every rule it takes from the draft, so it stands without it.

| Teacher | What it is | Tiers | Entries | Rows it teaches |
| --- | --- | --- | --- | --- |
| start | known from the first day (`known: start`) | 1 | 16 | arrow-shafts (T1), barbed-arrows (T1), blunt-arrows (T1), club (T1), flint-arrowheads (T1), flint-arrows (T1), flint-hatchet (T1), flint-knife (T1), oak-rabbit-stick (T1), oak-short-staff (T1), quarterstaff (T1), shaped-stones (T1), sinew-cord (T1), sling (T1), stone-cudgel (T1), throwing-stones (T1) |
| cache | core/hunters-cache, WEAPONS 5.4's dig spot as written: its four take-verb scraps, laid once with the take verb; 2000 ppm (kernel/src/values.ts:105-114) | 2 to 3 | 4 of 4 | bow-stave (T2), bow-string (T2), spear (T2), bow (T3) |
| q-stone | Handcraft quest, stone that strikes | 2 to 3 | 4 of 4 | stone-hammer (T2), stone-maul (T2), greenstone-mace (T3), throwing-axe (T3) |
| q-edge | Handcraft quest, the edge | 2 to 3 | 4 of 4 | slate-seax (T2), tusk-dagger (T2), claw-talon (T3), greenstone-throwing-knives (T3) |
| q-staff | Handcraft quest, the staff-maker (Woodcraft's when it lands) | 2 to 3 | 3 of 4 | hide-bound-crook (T2), greenstone-boar-spear (T3), oak-long-staff (T3) |
| q-silk | Handcraft quest, the silk (lands with spider-silk) | 2 to 3 | 3 of 4 | sinew-braided-sling (T2), silk-string (T3), silk-short-bow (T3) |
| q-hunt | Handcraft quest, the hunter's arms (lands with combat) | 2 to 3 | 3 of 4 | flint-darts (T2), slate-short-spear (T2), wolf-long-sling (T3) |
| q-forge-4 | Smithing quest at the city forge | 4 | 4 of 4 | bronze-battleaxe (T4), bronze-falchion (T4), bronze-sword (T4), bronze-warhammer (T4) |
| q-heads | Smithing quest, heads and fittings | 4 | 2 of 4 | bronze-fitting (T4), bronze-spearhead (T4) |
| q-pole-4 | Woodcraft quest, the pole-maker | 4 | 4 of 4 | bronze-glaive (T4), bronze-javelin (T4), bronze-staff-sling (T4), bronze-war-staff (T4) |
| q-bowyer | Woodcraft quest, the bowyer | 4 | 3 of 4 | antler-limb (T4), antler-longbow (T4), bronze-light-crossbow (T4) |
| q-bolts | Woodcraft quest, the bolt | 4 | 2 of 4 | bronze-barbed-bolts (T4), bronze-broad-bolts (T4) |
| q-forge-5 | Smithing quest | 5 | 4 of 4 | iron-flail (T5), iron-longsword (T5), iron-sabre (T5), iron-war-pick (T5) |
| q-pole-5 | Woodcraft quest | 5 | 4 of 4 | fiend-horn-bow (T5), iron-crossbow (T5), iron-halberd (T5), iron-whirl-staff (T5) |
| q-forge-6 | Smithing quest | 6 | 2 of 4 | steel-greatsword (T6), steel-morning-star (T6) |
| q-pole-6 | Woodcraft quest | 6 | 1 of 4 | steel-pike (T6) |
| q-pole-7 | Woodcraft quest | 7 | 1 of 4 | land7-arbalest (T7) |

So 16 rows start known (all tier 1), 4 come from the cache, 44 from 15 quests of at most 4 recipes each (a quest reward holds 4, schema/src/index.ts:729), and 343 from the try: 64 entries.

**The hunters' cache stays as WEAPONS 5.4 lays it.** The cache keeps WEAPONS 5.4's four take-verb scraps (the spear, the bow stave, the bow string and the bow), laid once with the take verb (WEAPONS, Waits), so its table is laid once and counted once: one rarity, its rarity bonus 2000 ppm (it reads the rarest find, kernel/src/values.ts:105-114), and the world stays at 99531 of 100000 (87697 built, 97531 with QUARRYING, 99531 with the cache). The four other early entries are quest rewards that land with their inputs: the silk short bow in q-silk, with the spider's silk; the flint darts, the slate short spear and the wolf long sling in q-hunt, the hunter's arms, with combat. Quests take nothing from the budget, so the 343 try rows and the 44 quest rows leave it at 99531.

**The skeleton.** From one tier to the next a row swaps at most two input ids (the larger of what leaves and what comes), so the next tier reads as the same thing in the next material and the "almost" hint (one item away; D6 of the unpublished draft, restated in the rule above) points the way. The spear's tier 2 to 3 is the one exception: the tier-2 spear is HUNT_LADDER's take tool, fixed by the hunt (WEAPONS 5.4).

**The try reads sets.** A try is a set of distinct ids (the rule above), so two recipes at one station kind with one input set cannot both be found by it. WM-TRY-SET holds every try-found recipe's set unique at its station kind (the workshop or the forge), against the whole matrix and every built recipe; WM-TRY-SIZE holds every try-found recipe at 2 to 4 distinct inputs. Taught recipes that share a set are reported, not refused, since a known recipe is made by its id: seven sets today, three from WEAPONS' own rows and four built:

```text
taught recipes sharing one input set (no try reads them): 7
  bow-stave = club (workshop)
  shaped-stones = throwing-stones = stone-flakes (built) (workshop)
  greenstone-mace = throwing-axe (workshop)
  fine-basket (built) = satchel (built) (workshop)
  fishing-rod (built) = reed-basket (built) (workshop)
  flint-trowel (built) = stone-blade (built) (workshop)
  reed-sandals (built) = woven-mat (built) (workshop)
```

**First touch.** The first time a player holds a line material of a new tier (the first bronze bar, the first antler), the bench's hint may say how many of the forms that player knows one tier below take it, never naming a set; a hint computed from content and what the player knows, as the "almost" hint is, never a teach. Owner question 13.

## 8. Levels, bands and professions

**Bands.** `tier_min_level` is `[1, 3, 6]` today (content/core/params.json:94), one entry per open tier (tools/src/check.ts:331-332); a tier's band runs from its entry to the next one's minus one, the last up to 20 (tools/src/check.ts:334; `RecipeLevel` 1 to 20, schema/src/index.ts:428). The matrix extends it to `[1, 3, 6, 8, 10, 12, 14, 16, 18, 20]` as tiers open (proposed, a core param): tier 3's band narrows from 6..20 to 6..7, which the 20 built recipes pass (checked), and tier 10 is level 20.

**Entry tier.** A profession's band index is its tier minus its entry tier plus one. Handcraft, Woodcraft and Leatherwork enter at 1 (tiers 1 to 3 hold work of theirs once they land: WEAPONS 5.3 counts about eight of the first slice as Woodcraft's); Smithing enters at 4, so a tier-4 Smithing recipe sits in band 1 (levels 1 and 2) and a tier-10 one in band 7 (14 and 15). A smith starts at level 1, as every crafter does, when metal opens. The check (tools/src/check.ts:334, :424, and its CR-16 chance, :429) and the base chance (kernel/src/step.ts:244, by the recipe's tier) read the band index instead of the tier, both places together: core (owner question 7).

**One step per form.** A row's level is its band's floor plus its form's step, 0 or 1, at every tier, so a form's place in the band reads the same along the ladder (the knife one over the floor, the spear on it).

| Profession | Station | Entry tier | Rows | Levels | Top today |
|---|---|---|---|---|---|
| Handcraft | workshop | 1 | 70 (tiers 1 to 3) | 1 to 7 | 9 (eight `xp_levels`; tools/src/check.ts:429) |
| Woodcraft | workshop, names `profession` | 1 | 158 (tiers 4 to 10) | 8 to 20 | not built; its curve grows to 20 |
| Smithing | forge | 4 | 158 (tiers 4 to 10) | 1 to 15 | not built; its curve grows to 15 |
| Leatherwork | workshop, names `profession` | 1 | 21 (tiers 4 to 10) | 9 to 20 | not built; its curve grows to 20 |

The matrix counts every row at tiers 1 to 3 as Handcraft's, as today's content allows (one craft per station); which of them move to Woodcraft when it lands is WEAPONS 5.3's word and Woodcraft's own page, and moves no count here. From tier 4 the matrix names each row's craft.

## 9. Distinctness, counted

**One block a tier.** No two hands of one tier share a block of the seven fields, across all classes (owner question 11): a hand is never another's recolour. Inside a class, a tier, a tempo and an ammunition class, no hand is matched or beaten on every field (harm, wind-up, reach, range, noise) by another in harm. Distinct harms are fewer than distinct blocks where two shapes price to one number; one near pair by block (one field apart) is left, at tier 2: the slate seax and the slate cudgel differ only in noise (the hushed price rounds away at cell 32; open point). The block-based near pairs are the recolour rule; the column beside them reads the hit in the harm's place (a launcher with its own tier's top shot), where a near pair is two hands one field apart in what a fight reads.

```text
-- by tier: hands, parts, ammunition; distinct blocks; distinct harms; near pairs (one field apart) by block and in hits
T1    9   3   4 | blocks   9 harms   8 near   0 near in hits   2
T2   17   3   3 | blocks  17 harms  14 near   1 near in hits  11
T3   26   2   3 | blocks  26 harms  24 near   0 near in hits  14
T4   34   4   5 | blocks  34 harms  30 near   0 near in hits  21
T5   42   4   5 | blocks  42 harms  42 near   0 near in hits  17
T6   43   4   5 | blocks  43 harms  43 near   0 near in hits  13
T7   41   4   5 | blocks  41 harms  41 near   0 near in hits  10
T8   38   4   5 | blocks  38 harms  38 near   0 near in hits   6
T9   38   4   5 | blocks  38 harms  37 near   0 near in hits   6
T10  38   4   5 | blocks  38 harms  38 near   0 near in hits   4
```

**In hits, a shape is sometimes free.** A fight reads `hit = bare_base * (eff_harm + hand_offset) div hand_offset` (WEAPONS 4 (#609); `bare_base` 8 is built, #598, content/core/params.json:1140, range 4 to 16, step 1; `hand_offset` 128 is #609's, section 15), so at 8 one hit point is 16 harm points and a price step under 16 can round away. WM-BLOCK reads the dominance test in hits at the built base, a launcher with its own tier's top shot, and prints the count at the range's ends, 4 and 16, beside it to show how sensitive it is. 44 pairs tie at 8 (13 of them at tiers 1 to 3): in each the first hand matches the second in hits and is faster, quieter, or reaches farther, so the second's price buys nothing a fight reads. They are listed in the source (`hit_ties_open`), and WM-BLOCK fails on any other pair and on a listed pair that stops tying; clearing them by spacing the prices, by starting a form only where its hit separates from its neighbours, or by a finer base (16 leaves 18 ties) is owner question 16. The hit line is a restatement of #609's until the kernel's own hand function lands with combat (G35): today the kernel reads bare hands alone (`hitsToFell`, kernel/src/fightmath.ts:13-16).

```text
-- WM-BLOCK in hits: pairs where a shape buys nothing in hits (same class, tier, tempo, ammunition), by bare_base (built 8; its range's ends beside it)
tier  bb4   bb8   bb16 
T1        2     2     2
T2        6     5     5
T3        7     6     3
T4        9     9     4
T5       16     6     2
T6       12     5     1
T7        9     3     0
T8        9     3     1
T9        5     2     0
T10       7     3     0
all      82    44    18
  T1 flint-knife (8, wind-up 3, noise 4) over flint-hatchet (8, wind-up 7, noise 6)
  T1 oak-rabbit-stick (9, wind-up 8, noise 4) over throwing-stones (9, wind-up 10, noise 4)
  T2 slate-knife (9, wind-up 3, noise 4) over slate-seax (9, wind-up 5, noise 4)
  T2 tusk-dagger (9, wind-up 3, noise 2) over slate-knife (9, wind-up 3, noise 4)
  T2 tusk-dagger (9, wind-up 3, noise 2) over slate-seax (9, wind-up 5, noise 4)
  T2 hide-bound-crook (11, wind-up 6, noise 2) over bound-staff (11, wind-up 6, noise 4)
  T2 sinew-braided-sling (9, wind-up 6, noise 2) over sinew-sling (9, wind-up 8, noise 4)
  T3 fang-knife (11, wind-up 3, noise 4) over greenstone-seax (11, wind-up 5, noise 4)
  T3 antler-dagger (11, wind-up 3, noise 2) over fang-knife (11, wind-up 3, noise 4)
  T3 antler-dagger (11, wind-up 3, noise 2) over greenstone-seax (11, wind-up 5, noise 4)
  T3 antler-dagger (11, wind-up 3, noise 2) over claw-talon (11, wind-up 7, noise 2)
  T3 capped-staff (14, wind-up 6, noise 4) over oak-long-staff (14, wind-up 8, noise 4)
  T3 fang-rabbit-stick (13, wind-up 8, noise 4) over throwing-axe (13, wind-up 8, noise 6)
  T4 bronze-knife (13, wind-up 3, noise 4) over bronze-seax (13, wind-up 5, noise 4)
  T4 bronze-dagger (13, wind-up 3, noise 2) over bronze-knife (13, wind-up 3, noise 4)
  T4 bronze-dagger (13, wind-up 3, noise 2) over bronze-seax (13, wind-up 5, noise 4)
  T4 bronze-dagger (13, wind-up 3, noise 2) over bronze-talon (13, wind-up 7, noise 2)
  T4 bronze-boar-spear (16, wind-up 6, noise 6) over bronze-glaive (16, wind-up 8, noise 6)
  T4 bronze-quarterstaff (16, wind-up 6, noise 4) over bronze-long-staff (16, wind-up 8, noise 4)
  T4 bronze-crook (16, wind-up 6, noise 2) over bronze-quarterstaff (16, wind-up 6, noise 4)
  T4 bronze-crook (16, wind-up 6, noise 2) over bronze-long-staff (16, wind-up 8, noise 4)
  T4 hardened-braided-sling (12, wind-up 6, noise 2) over hardened-sling (12, wind-up 8, noise 4)
  T5 iron-knife (15, wind-up 3, noise 4) over iron-seax (15, wind-up 5, noise 4)
  T5 iron-spear (18, wind-up 4, noise 4) over iron-boar-spear (18, wind-up 6, noise 6)
  T5 iron-quarterstaff (18, wind-up 6, noise 4) over iron-long-staff (18, wind-up 8, noise 4)
  T5 iron-crook (18, wind-up 6, noise 2) over iron-quarterstaff (18, wind-up 6, noise 4)
  T5 iron-crook (18, wind-up 6, noise 2) over iron-long-staff (18, wind-up 8, noise 4)
  T5 fiend-braided-sling (14, wind-up 6, noise 2) over fiend-sling (14, wind-up 8, noise 4)
  T6 steel-dagger (16, wind-up 3, noise 2) over steel-knife (16, wind-up 3, noise 4)
  T6 steel-war-pick (25, wind-up 8, noise 2) over steel-morning-star (25, wind-up 8, noise 4)
  T6 steel-boar-spear (21, wind-up 6, noise 6) over steel-glaive (21, wind-up 8, noise 6)
  T6 steel-crook (20, wind-up 6, noise 2) over steel-quarterstaff (20, wind-up 6, noise 4)
  T6 land6-braided-sling (16, wind-up 6, noise 2) over land6-sling (16, wind-up 8, noise 4)
  T7 land7-dagger (18, wind-up 3, noise 2) over land7-knife (18, wind-up 3, noise 4)
  T7 land7-war-pick (28, wind-up 8, noise 2) over land7-morning-star (28, wind-up 8, noise 4)
  T7 land7-boar-spear (23, wind-up 6, noise 6) over land7-glaive (23, wind-up 8, noise 6)
  T8 land8-dagger (20, wind-up 3, noise 2) over land8-knife (20, wind-up 3, noise 4)
  T8 land8-quarterstaff (25, wind-up 6, noise 4) over land8-long-staff (25, wind-up 8, noise 4)
  T8 land8-arbalest (24, wind-up 10, noise 6) over land8-crossbow (24, wind-up 10, noise 6)
  T9 land9-knife (22, wind-up 3, noise 4) over land9-seax (22, wind-up 5, noise 4)
  T9 land9-arbalest (26, wind-up 10, noise 6) over land9-crossbow (26, wind-up 10, noise 6)
  T10 land10-knife (24, wind-up 3, noise 4) over land10-seax (24, wind-up 5, noise 4)
  T10 land10-war-pick (36, wind-up 8, noise 2) over land10-morning-star (36, wind-up 8, noise 4)
  T10 land10-arbalest (28, wind-up 10, noise 6) over land10-crossbow (28, wind-up 10, noise 6)
```

**After the clamp (WM-CLAMP).** The same dominance test on `eff_harm` with the priced clamp of section 2: under the soft requirement at every own tier from 1 to t-2, and under every entry of `power_cap_permille` (content/core/params.json:66) and the level-15 option 3250 (owner question 2b). No pair under the soft requirement or at any cap from 1200 up; the pairs at caps 1000 and 1100 are the stated exception, character levels 1 and 2, where the power cap flattens quick hands below the price's rounding and the first two levels read shape alone (owner question 15). The last two lines are reports, not checks: the same sweep read in hits, where the rounding of the paragraph above grows under the clamp, and WEAPONS 4's clamp as written, unpriced, the reason for the amendment.

```text
-- WM-CLAMP: dominated pairs after the priced clamp (soft requirement: own tier 1 to t-2; power cap by entry)
tier  soft  1000  1100  1200  1300  1450  1600  1750  1900  2050  2200  2400  2600  2800  3000  3250
T1       0     1     0     0     0     0     0     0     0     0     0     0     0     0     0     0
T2       0     7     2     0     0     0     0     0     0     0     0     0     0     0     0     0
T3       0     9     2     0     0     0     0     0     0     0     0     0     0     0     0     0
T4       0     9     2     0     0     0     0     0     0     0     0     0     0     0     0     0
T5       0    11     2     0     0     0     0     0     0     0     0     0     0     0     0     0
T6       0     8     2     0     0     0     0     0     0     0     0     0     0     0     0     0
T7       0     9     2     0     0     0     0     0     0     0     0     0     0     0     0     0
T8       0     9     2     0     0     0     0     0     0     0     0     0     0     0     0     0
T9       0     9     2     0     0     0     0     0     0     0     0     0     0     0     0     0
T10      0     9     2     0     0     0     0     0     0     0     0     0     0     0     0     0
all      0    81    18     0     0     0     0     0     0     0     0     0     0     0     0     0
hits   271   151   144   139   135   115   119    68    64    63    57    49    51    49    43    44   (the same sweep read in hits at bare_base 8: reported, not a check)
WEAPONS 4 as written (the clamp unpriced): 144 pairs one tier short (own tier t-2), 176 at cap 1000
stated exception: caps 1000, 1100 (character levels 1 and 2)
```

**Counted in hits (WM-HITS; #598's bands, and what the matrix adds over them).** The starter hand is bare hands: a start carries no weapon (decision 42), and #598's check counts a foe's tier in bare-hand hits, `hitsToFell = ceil(health / bare_base)` (kernel/src/fightmath.ts:13-16; tools/src/fight.ts:64-68), against `FIGHT_TIER_HITS` (schema/src/index.ts:2130): T1 falls in exactly 2 hits, T2 in 6 to 8, T3 in 20 to 30, which at `bare_base` 8 is 9 to 16, 41 to 64 and 153 to 240 health. No row of the matrix is read as the starter hand, the quarterstaff included. WM-HITS holds those bands at the built base, recomputes from the matrix's own priced blocks what a hand adds (a tier-1 standard hand 10 a hit, a tier-1 heavy 12, a tier-2 standard 11, a tier-3 standard 13 to 14, a tier-3 bow with its top shot 13; all proposed, at full harm), and counts each band's top health against them: a 16-health T1 foe falls in 2 hits of a tier-1 standard hand, as of bare hands; a 64-health T2 foe in 6 of a tier-2 standard hand against 8 bare; a 240-health T3 foe in 18 to 19 of a tier-3 standard hand against 30. So "a hand shortens the count and never replaces the reading" (WEAPONS 4 (#609)) is a check: no hand hits under bare hands, and no top health takes more hits of a hand than of bare hands. WEAPONS 4 counts its hands from the unpriced cells (11, 13, 12, 15, 13; a 240-health T3 foe in 16); the matrix's priced blocks give the numbers above, an amendment listed in section 11.

```text
-- WM-HITS: #598's bands in bare-hand hits at bare_base 8 (FIGHT_TIER_HITS), and the matrix's hands over them (full harm)
bare hands 8 a hit: T1 exactly 2 hits (9 to 16 health); T2 6 to 8 hits (41 to 64 health); T3 20 to 30 hits (153 to 240 health)
matrix hands: T1 standard 10; T1 heavy 12; T2 standard 11; T3 standard 13 to 14; T3 bow, top shot 13   (WEAPONS 4 (#609) states 11; 13; 12; 15; 13)
top health: a 16-health T1 foe 2 hits of a T1 standard hand (2 bare); a 64-health T2 foe 6 hits of a T2 standard hand (8 bare); a 240-health T3 foe 18 to 19 hits of a T3 standard hand (30 bare)
```

**Shape pools.** The shapes a tier can hold: close reach 1 and reach 2 have 27 each (3 tempos, 3 feels, 3 noises), thrown 81 (and 3 ranges), the bow 54 (one tempo, 3 ranges, 2 ammunition classes, 3 feels, 3 noises), the sling 54 (2 tempos, 3 ranges, 3 feels, 3 noises). The fullest, close reach 1 at tiers 5 and 6, uses 18 of 27.

```text
-- shape pools per tier (close reach 1, close reach 2, thrown, bow, sling): used of capacity
T1   5/27  1/27  2/81  0/54  1/54
T2   9/27  4/27  2/81  0/54  2/54
T3  11/27  6/27  4/81  2/54  3/54
T4  14/27  8/27  4/81  4/54  4/54
T5  18/27 10/27  4/81  6/54  4/54
T6  18/27 11/27  4/81  6/54  4/54
T7  16/27 10/27  4/81  7/54  4/54
T8  16/27  9/27  3/81  6/54  4/54
T9  16/27  9/27  3/81  6/54  4/54
T10 16/27  9/27  3/81  6/54  4/54
```

**Every tier answers every style.** Each tier offers all three close tempos, at least one ranged hand, and wind-ups from 4 or under to 8 or over, so whatever band a foe's style and danger give its moves (proposed; the combat foundations draft's Q-5, unpublished, not in #598 or #609), a player of that tier has a quick answer and a heavy one.

## 10. Counts

The generator's print (default variant, with the built content read), copied; in the repository the report of the appendix prints the same blocks, and the test of section 13 pins them.

```text
-- counts by tier band and kind
T1-3: 52 hands + 8 parts + 10 ammunition = 70
T4-10: 274 hands + 28 parts + 35 ammunition = 337
all: 407 recipes, 49 forms, 9 part rows, 6 ammunition rows

-- hands by class and band
band    blade  blunt  spear  staff    bow thrown  sling
T1-3       11     11      5      9      2      8      6
T4-10      68     44     36     32     41     25     28
```

```text
-- by profession and band (today: Handcraft makes every tier 1 to 3 row)
handcraft T1-3: 70
leatherwork T4-10: 21
smithing T4-10: 158
woodcraft T4-10: 158
levels: handcraft 1-7; leatherwork 9-20; smithing 1-15; woodcraft 8-20

-- how a recipe is known
start 16, cache 4, quest 44, try 343
quests 15: q-bolts 2, q-bowyer 3, q-edge 4, q-forge-4 4, q-forge-5 4, q-forge-6 2, q-heads 2, q-hunt 3, q-pole-4 4, q-pole-5 4, q-pole-6 1, q-pole-7 1, q-silk 3, q-staff 3, q-stone 4

-- land slots: 184 of 191 tier 7-10 recipes rest on a land slot; 194 of 337 at tiers 4-10
```

Variants (recipes at tiers 1 to 3 / 4 to 10), each with WM-COUNT's verdict against the direction (70 to 80 at tiers 1 to 3, 300 to 350 at tiers 4 to 10): tier 10 stopped (owner question 2a B), the crossbows dropped (4 B), the rate held at 3000 at tier 10 (2a C), every form run to tier 10 (8 B), and the rate frozen past tier 5 (3 B). Two leave the direction, and two keep the count but repeat blocks: under the held rate 38 tier-10 hands repeat their tier-9 block, and under the frozen rate 194 of the 198 hands at tiers 6 to 10 repeat an earlier tier's block of their form (inside the per-tier rule, but the same cost as 2a C, wider). Run alone (`--variant`), stop-at-9 and all-to-10 fail WM-COUNT, and all-to-10 and freeze-at-5 also add hit ties the default's list does not hold (12 and 20 pairs at `bare_base` 8; WM-BLOCK); the default passes every check.

```text
-- variants (recipes T1-3 / T4-10; WM-COUNT against the direction for each)
default: 70 / 337 (in the direction)
stop-at-9: 70 / 290 (T4-10 under 300: leaves the direction)
no-crossbows: 70 / 306 (in the direction)
rate-10-3000: 70 / 337 (in the direction); 38 tier-10 hands repeat their tier-9 block
all-to-10: 72 / 389 (T4-10 over 350: leaves the direction)
freeze-at-5: 70 / 337 (in the direction); 194 of 198 tier 6-10 hands repeat an earlier tier's block of their form
```

## 11. The first slice: WEAPONS 5.2, 5.4 and 6.2 in the matrix

WEAPONS 5.3 makes its 18 hands the first slice and lets the matrix rename them. None is renamed: every id stands, and a row moves only where a hard rule of this page moves it. WEAPONS is a page of the open pull request #609, not on develop, so none of the amendments below can land with this page: each is listed here and applied in #609's page in a follow-up pull request once it lands (section 15); the same holds for CLOTHING's row in section 12. The 18 hands, the 3 parts and the 9 ammunition rows:

| WEAPONS row | Section | Matrix row | Tier | Level | Known by | Moves | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `core/flint-knife` | 5.2 | knife (hand) | 1 | 2 | start | none | - |
| `core/slate-knife` | 5.2 | knife (hand) | 2 | 4 | the try | none | - |
| `core/fang-knife` | 5.2 | knife (hand) | 3 | 7 | the try | none | - |
| `core/club` | 5.2 | club (hand) | 1 | 1 | start | none | - |
| `core/stone-maul` | 5.2 | maul (hand) | 2 | 4 | quest q-stone | none | - |
| `core/greenstone-mace` | 5.2 | mace (hand) | 3 | 6 | quest q-stone | none | - |
| `core/spear` | 5.2 | spear (hand) | 2 | 3 | the cache | none | - |
| `core/fang-spear` | 5.2 | spear (hand) | 3 | 6 | the try | level 7 to 6 | one step per form (section 8): the spear sits at its band's floor at tier 2 (level 3), so at tier 3 it is level 6 |
| `core/quarterstaff` | 5.2 | quarterstaff (hand) | 1 | 2 | start | none | - |
| `core/bound-staff` | 5.2 | quarterstaff (hand) | 2 | 4 | the try | none | - |
| `core/capped-staff` | 5.2 | quarterstaff (hand) | 3 | 7 | the try | level 6 to 7 | one step per form: the quarterstaff sits one over its band's floor at tiers 1 and 2 (levels 2 and 4), so at tier 3 it is level 7 |
| `core/bow` | 5.2 | bow (hand) | 3 | 6 | the cache | none | - |
| `core/throwing-stones` | 5.2 | throwing-stones (hand) | 1 | 1 | start | none | - |
| `core/flint-darts` | 5.2 | darts (hand) | 2 | 3 | quest q-hunt | none | - |
| `core/throwing-axe` | 5.2 | throwing-axe (hand) | 3 | 6 | quest q-stone | none | - |
| `core/sling` | 5.2 | sling (hand) | 1 | 2 | start | none | - |
| `core/sinew-sling` | 5.2 | sling (hand) | 2 | 4 | the try | none | - |
| `core/wolf-sling` | 5.2 | sling (hand) | 3 | 7 | the try | none | - |
| `core/sinew-cord` | 5.4 | sinew-cord (part) | 1 | 1 | start | none | - |
| `core/bow-stave` | 5.4 | bow-stave (part) | 2 | 4 | the cache | none | - |
| `core/bow-string` | 5.4 | bow-string (part) | 2 | 3 | the cache | none | - |
| `core/shaped-stones` | 6.2 | shot (ammo) | 1 | 2 | start | station tier 2 to 1 | a recipe names a station kind, not a camp part, and needs a built part of that kind of at least its tier (kernel/src/step.ts:792; tools/src/check.ts:432): a tier-1 recipe cannot require the workbench; it is made at the work stone or any better workshop |
| `core/blunt-arrows` | 6.2 | blunt-arrows (ammo) | 1 | 2 | start | inputs: arrow-shafts, feather, hare-bone | the shaft is a part (section 5), so every arrow and bolt shares one skeleton |
| `core/flint-arrows` | 6.2 | broad-arrows (ammo) | 1 | 2 | start | inputs: arrow-shafts, feather, flint-arrowheads | shaft and head are parts (section 5): one skeleton for every tier of the line, heads shared with the bolts |
| `core/barbed-arrows` | 6.2 | barbed-arrows (ammo) | 1 | 2 | start | inputs: arrow-shafts, feather, roe-bone | the shaft is a part; the bone barb stays |
| `core/slate-arrows` | 6.2 | broad-arrows (ammo) | 2 | 4 | the try | inputs: arrow-shafts, feather, slate-arrowheads | as flint arrows |
| `core/greenstone-arrows` | 6.2 | broad-arrows (ammo) | 3 | 7 | the try | inputs: arrow-shafts, feather, greenstone-arrowheads | as flint arrows; WEAPONS 6.2 gives it the same input set as barbed greenstone arrows, which no try can tell apart (WM-TRY-SET) |
| `core/barbed-greenstone-arrows` | 6.2 | barbed-arrows (ammo) | 3 | 7 | the try | inputs: arrow-shafts, feather, greenstone-arrowheads, roe-bone | the head is a part and the bone barb marks it (WM-TRY-SET against greenstone arrows) |
| `core/slate-shot` | 6.2 | shot (ammo) | 2 | 4 | the try | inputs: slate, stone | a try takes 2 distinct ids or more (WM-TRY-SIZE; the try as section 7 defines it) |
| `core/greenstone-shot` | 6.2 | shot (ammo) | 3 | 7 | the try | inputs: greenstone, stone | as slate shot |

**The amendments, each with its rule, its reason and the better rule.**

- **WEAPONS 4, the clamp.** Rule: `eff_harm = min(harm, harmAt(share(rate[own_tier + 1]), t), harmAt(share(powerCap), t))`. Reason: read as written, the clamp gives every priced hand of a tempo the same clamp cell, so the cheap, fast or quiet shape matches or beats the dear one: 144 dominated pairs one tier short, 176 at power cap 1000 (section 9). Better: the clamp is priced, `eff_harm = min(harm, priced(clamp_cell))`, with `priced(c) = c * (1000 - price) // 1000` and the shape's fixed price (section 2); no pair is then dominated at any own tier or at any cap from 1200, and caps 1000 and 1100 are a stated exception (WM-CLAMP; owner question 15).
- **WEAPONS 4, "Counted in hits" (to apply in #609's page, follow-up).** Rule: at `bare_base` 8 and full harm, bare hands 8, a tier-1 standard hand 11, a tier-1 heavy 13, a tier-2 standard 12, a tier-3 standard 15, a tier-3 bow 13; a 240-health T3 foe in 16 hits of a tier-3 standard hand. Reason: those hands are read at the unpriced cells (48, 83, 72, 112, 88), and the matrix's hands are priced (section 2), so a fight reads a smaller block. Better (all proposed): bare hands 8; a tier-1 standard hand 10 (the quarterstaff, harm 42); a tier-1 heavy 12 (the club, 76); a tier-2 standard 11 (the spear 60, the crook 61, the bound staff 63); a tier-3 standard 13 to 14 (the fang spear 93 and the antler crook 95 at 13, the capped staff 98 to the greenstone mace 103 at 14); a tier-3 bow with its top shot 13 (36 + 44); a 16-health T1 foe still in 2, a 64-health T2 foe in 6 against 8 bare, a 240-health T3 foe in 18 to 19 against 30 (WM-HITS, section 9). The bands in bare-hand hits and the health they mean stand as #598 built them, and the starter hand stays bare hands; the quarterstaff's price stays 125.
- **WEAPONS 5.2, levels.** Rule: the fang-tipped spear at 7, the capped staff at 6. Reason: one step per form (section 8). Better: 6 and 7.
- **WEAPONS 5.2, `Known` column.** Rule: every tier-2 and tier-3 hand `found`, each by a scrap of its own. Reason: 343 scraps need at least 43 dig spots of 8 finds (schema/src/index.ts:391), each near the cache's 2000 ppm, against 469 ppm left. Better: an entry per form and the try (section 7); in content still `known: found`.
- **WEAPONS 5.2, "Past tier 5".** Rule: "`hand_rate_max_permille` grows +250 a tier to tier 9" and, two sentences on, "past tier 5 a tier adds quality and attribute bonuses, never rate". Reason: the two disagree from tier 6 to 9. Better: "past tier 9" (owner question 3).
- **WEAPONS 5.2, "Tiers 4 and 5".** Rule: the bow climbs by a sinew-backed bow at 4 and a horn bow at 5; the sling's tier 4 waits for the next land's fibre. Reason: the matrix names its lines. Better: every bow form takes a limb of the tier's horn (antler at 4, fiend horn at 5, HUNT_FAMILIES 4 and 5), the horn bow is its own form from 5, and every sling hand takes the tier's hide, at 4 a hardened leather this page proposes (a tier-3 material of 2 boiled leather and 1 herb at the workshop, amending CLOTHING, which has none; section 12).
- **WEAPONS 5.3, "Scale".** Rule: "a form is taught once and is then made in every material its station and level can work". Reason: the direction keeps a discovery feel in crafting, and a form taught once leaves nothing to find past its entry. Better: the entry teaches the first tier and each higher tier is found by the try from the tier below (section 7), at no budget cost either way. Its other two rules stand: no two hands of a tier share a block (WM-BLOCK), and one data table writes the recipe and item files with a check that the files equal it (the report's write and verify, with the first content; Waits). Its counts become section 10's print.
- **WEAPONS 6.1, the launcher's harm.** Rule: half the cell. Reason: priced shapes (section 2). Better: the priced cell minus the tier's top; its compatibility table reprints from section 6 (a tier-3 bow 36 + 44 = 80 of 88; a tier-1 sling 1 + 2 = 3 of 4).
- **WEAPONS 6.2, arrows.** Rule: a branch, a head stone and a feather. Reason: WEAPONS' greenstone arrows and barbed greenstone arrows take one input set, which the try cannot tell apart (WM-TRY-SET), and the bolts need the same heads. Better: every arrow and bolt takes `arrow-shafts` and, past the blunt and the first barbed, the tier's `arrowheads`; the barbed keep a bone barb.
- **WEAPONS 6.2, slate and greenstone shot.** Rule: one input. Reason: a try takes 2 distinct ids or more (section 7, WM-TRY-SIZE). Better: the stone and a plain stone.
- **WEAPONS 6.2, shaped stones.** Rule: at the workbench, as HUNT_FAMILIES 3a :256 has it. Reason: a recipe names a station kind (schema/src/index.ts:56) and needs a part of that kind of at least its output's tier (kernel/src/step.ts:222, :792), so a recipe cannot name the workbench, and a tier-2 recipe would shut out the work stone. Better: the workshop kind at tier 1, made at the work stone or any better workshop; HUNT_FAMILIES 3a's word amended so.
- **WEAPONS 16, "a found recipe has a teacher".** Rule: a `known: found` recipe is named by a fragment's `unlocks` or a quest reward's `recipes`. Reason: 343 try rows have neither. Better: or it is marked `discover` and its family has a taught or started row one tier below (WM-TEACH).
- **DECISIONS 2026-10-10, "First-tier recipes are known from the start; higher tiers are dug up" (CR-61).** Rule: every tier-2 and tier-3 recipe is taught by a dug-up scrap. Reason: 343 rows past their entry would need a scrap each; at the cache's 2000 ppm a dig spot, the 469 ppm the rarity budget has left (QUARRYING 2.4) holds none of them. Better: tier 1 stays known from the start; a form's first tier past 1 is taught by an entry (the cache's four scraps stay dug up, as WEAPONS 5.4 lays them, and the quests' rewards), and the rest of tiers 2 and 3 is found by the try (section 7). The decision is the owner's own, so the page asks before it moves (owner question 5, A1 or A2).

## 12. Where this meets existing rules

| Rule | The clash | The resolution |
|---|---|---|
| G35 (docs/design/GAME_RULES.md:405-406), G44 (:513-514) | Hundreds of weapon rows with no fight to read them | Kept. Only the page, the source file, the report and its test land; every row waits for combat, the take verb or its material (section 15). |
| COMBAT 4.9's hand compression, `bonus + 64` (docs/design/COMBAT.md:258), against `hand_offset` 128 (WEAPONS 4 (#609); the owner's yes of 1.11, DECISIONS 2026-11-02 "The hand's bonus offset is 128", in #609's DECISIONS, not yet on develop) | The matrix's cells and hits are computed at an offset develop does not carry yet | The matrix reads 128 as #609 does, so its table equals WEAPONS 4's; at a hand's cap the offset cancels out of the hit (`hit` is `bare_base * rate * swing_t div (1000 * swing_quick_t)` there), so the bands in hits do not move with it. COMBAT 4.9's 64 is #609's pending amendment, not this page's. |
| #598's `hitsToFell` reads bare hands alone (kernel/src/fightmath.ts:13-16); the check counts a foe's tier in bare-hand hits (tools/src/fight.ts:64-68; `FIGHT_TIER_HITS`, schema/src/index.ts:2130) | The matrix reads the hit of a hand through WEAPONS 4's (#609) line, which no kernel function computes yet | Kept as built: the report's hit reading is a restatement until the kernel's own hand function lands with combat (G35), and WM-HITS proves the bands hold and that a hand only shortens the count. No kernel change here. |
| #598 built the swing and the wind-up floor: `swing_quick_t` 8, `swing_standard_t` 10, `swing_heavy_t` 12, `swing_floor_t` 6, `bare_windup_t` 3 (content/core/params.json:1110-1139, the combat group) | The cells, the prices and every hit of this page are computed from the swing, and the 01.11 draft filed those ticks as WEAPONS 4's (#609) proposals | The matrix reads them, it does not restate or propose them: they sit in the source's `built` block with their lines, the generator takes the swing from there, WM-BUILT fails when a copy differs from the content, and WM-GRID holds every form's wind-up from `bare_windup_t` to under its tempo's swing (section 13). The report takes the same values from the bundle's combat params. |
| WEAPONS and CLOTHING are pages of the open pull request #609, not on develop | The page amends WEAPONS 4, 5.2, 5.3, 6.1, 6.2 and 16 and CLOTHING (the hardened leather) | Listed in sections 11 and 12, applied in #609's pages in a follow-up pull request once it lands; the word amendments to EQUIPMENT 3.7, PROGRESSION 5.1 and HUNT_FAMILIES 3a, pages on develop, land with this one (section 15). |
| WEAPONS 5.2 "Past tier 5 ... never rate" against "grows +250 a tier to tier 9" | The page disagrees with itself from tier 6 to 9 | Read as past tier 9; amend the word (owner question 3). |
| WEAPONS 4's `hand_rate_max_permille`, nine tier entries, "each 1000 to 3000" | Tier 10 has no rate of its own: held at 3000, its 38 tier-10 hands repeat their tier-9 blocks (70 / 337, in the direction) | Default: a tenth tier entry, 3250 (proposed, a core param under G45), and the stated range widens to 1000 to 3250; or the matrix stops at tier 9 (70 / 290: under the 300 floor, leaves the direction). Owner question 2a. |
| R9, the one clamp (kernel/src/state.ts:559-564), and PROGRESSION 4.7's rising ceilings by band (the owner, 2026-10-25): `power_cap_permille` has 14 entries, one per character level, the last 3000 from level 14 (content/core/params.json:66) | A tier-10 hand's 3250 rate is clamped to 3000 at every level; a 15th entry of 3250 would raise the clamp on every rate multiplier (rare finds, kernel/src/step.ts:214; craft luck, :236; gather speed, :1870-1872) for every character at level 15 or more, not only the strike | Kept: the cap stays 3000, so a tier-10 hand strikes at most at the 3000 cap, as its form's tier-9 hand, and tier 10 adds its bonuses, until the owner lifts R9 for all rates. Owner question 2b. |
| WEAPONS 5.2 and 5.4: each found recipe has its own scrap or quest (the try as this page defines it, section 7, replaces that; the unpublished discovery draft's C5 and T1 read the same way) | 343 rows past their entry; the budget has 469 ppm left after the cache (QUARRYING 2.4; WEAPONS 5.4; `rarity_budget_permille`, content/core/params.json:82, summed by `rarityBudget`, kernel/src/values.ts:206, inside the value table of `computeValues`, :239, and refused over the limit at tools/src/check.ts:472) | One entry per form, the try for the rest (section 7); the cache keeps WEAPONS 5.4's four scraps at 2000 ppm. Owner question 5. |
| DECISIONS 2026-10-10 "First-tier recipes are known from the start; higher tiers are dug up" (CR-61; DECISIONS.md:977-981), with the `known` description at schema/src/index.ts:453-455 ("found": a scrap found by digging, or a quest) | The 33 tier-2 and tier-3 rows on the try (12 at tier 2, 21 at tier 3) are learned neither by a dig nor by a quest, and the 17 quest entries at tiers 2 and 3 are quested, not dug | Owner question 5: A1 keeps the decision (the try starts at tier 4; the 33 rows are taught by scraps or quests), A2 amends it (a tier-2 or tier-3 entry is dug up or quested; the later rungs of a known family are found by the try). |
| The schema (schema/src/index.ts:444-458, `RecipeBody`; :453-455, `known`) | The try needs a marker no recipe carries | A core schema change with the try's kernel pull request (unpublished): a `discover?` field on `RecipeBody` (proposed, section 7), and the `known` description at :454 adds "or by the try at a station". |
| WEAPONS 16, "a found recipe has a teacher" | The try rows have no fragment and no quest | Amend the row: or `discover` with a known family one tier below (WM-TEACH). |
| The try's candidates as this page defines them (section 7; the discovery draft's D2, unpublished, has candidates: `discover`, this station kind, not yet known) | Without a family condition a guess finds any row whose inputs the player holds, so a quest's or the cache's entry can be skipped | This page's rule adds "whose family the player knows one tier below", so an entry is never a candidate; a match also needs a station of at least the recipe's tier, as a craft does (kernel/src/step.ts:222). |
| The try as this page defines it (section 7: sets of 2 to 4 distinct ids; the discovery draft's D1, unpublished) against WEAPONS 6.2 | Two arrow rows with one set; two shot rows with one input | WM-TRY-SET and WM-TRY-SIZE; the six arrows and two shots move (section 11). |
| One band per tier (tools/src/check.ts:334, :424) and the base chance by tier (`craft_chance_bp` [10000, 8000, 6500], content/core/params.json:105; kernel/src/step.ts:244; the check's CR-16 reads it the same way, tools/src/check.ts:441) | Smithing opens at tier 4: a smith would start at level 8 with a 6500 base chance | Band and chance by entry tier, a core change (owner question 7). |
| `tier_min_level` `[1, 3, 6]` with `open_tiers` 3 (content/core/params.json:88, :94; tools/src/check.ts:331-332; an item above `open_tiers` is refused, :364) | Tiers 4 to 10 have no band | Extend to ten entries as each tier opens; tier 3's band narrows to 6..7 and the 20 built recipes pass it. |
| `STATIONS` `fire`, `workshop` (schema/src/index.ts:56); camps up to `open_tiers` (tools/src/check.ts:387-391) | No forge, and no workshop past tier 3 | The city's forge and workshops of the tier (decision 51), a core release before any tier-4 row. |
| One craft profession per station (tools/src/check.ts:378-383) | Handcraft, Woodcraft and Leatherwork at one workshop | Kept: Woodcraft and Leatherwork name `profession` on each recipe (schema/src/index.ts:429, :449; tools/src/check.ts:425); Handcraft stays the workshop's own. |
| Handcraft's top, level 9 (eight `xp_levels`; tools/src/check.ts:429) | None: Handcraft's rows reach 7 | Kept. Smithing's curve grows to 15, Woodcraft's and Leatherwork's to 20, when each lands. |
| QUARRYING 2.5 (metals past steel are the next lands') | Tiers 7 to 10 need a bar | Land slots, renamed when the land names its metal (owner question 6). |
| HUNT_FAMILIES 5 and MATERIALS 2: "a good's tier is 1 at d0, 2 at d1, 3 at d2" | The fiend and the drake stand above the open ladder at d2, so the d-rule gives their horn and hide tier 3; a tier-5 fiend limb or tier-8 drake hand made from them with tier-1 or tier-2 inputs would climb two tiers or more (G41, tools/src/check.ts:421) | A kind above the open ladder gives its goods at its own tier (the fiend 5, the drake 8; HUNT_FAMILIES 4, 5), inside the built cap (a drop at most its animal's tier, tools/src/check.ts:611) and BESTIARY_LANDS #432's "at most"; the d-rule keeps tiers 1 to 3, and the tomb spider follows it (d1, so its silk is tier 2). If the owner refuses, horn and hide at tiers 5 and 8 fall back to land slots, as the bar line does. |
| CLOTHING (no tier-3 leather material; its hardened jerkin and breeches are garments) | The tier-4 sling hands take a tier-3 hide, and the only built tier-3 hide, `wolf-hide`, is the tier-3 sling's own, so tier 4 would repeat tier 3's material | Amend CLOTHING to declare `core/hardened-leather` (proposed): a tier-3 material of 2 `boiled-leather` (tier 2, a one-tier climb) and 1 `herb`, Handcraft at the workshop of tier 3, level 6, found by the try, no rarity cost. The binder is the herb, not sinew thread, because {boiled leather, sinew thread} is already the input set of CLOTHING's boiled-leather cap and boots, and a try could not tell them apart (the rule WM-TRY-SET states for this page's rows). |
| EQUIPMENT 3.7's weapon row (docs/design/EQUIPMENT.md:125: Smithing blade and blunt, Woodcraft bow, staff and spear, Handcraft's Stonework the stone blade) and its leather row (:127, Leatherwork makes `wear` only); PROGRESSION 5.1 ("every class names the school that makes it", PROGRESSION.md:450); PROGRESSION 4.2's Leatherwork row (:166) | 3.7 names no maker for thrown or sling; from tier 4 the matrix names each form's maker by its line, so three crafts share a class: the sling, braided sling and long sling go to Leatherwork (21 rows); the javelin and the staff-sling to Woodcraft; the darts, throwing knives and throwing axe to Smithing (the thrown axe is already WEAPONS 5.2's); the shot to Smithing; arrows and bolts to Woodcraft, with Smithing's heads | Amend 3.7's weapon row in the same pull request: "Smithing (blade, blunt, metal thrown), Woodcraft (bow, staff, spear, the javelin, the staff-sling), Leatherwork (sling, from tier 4), Handcraft every hand of tiers 1 to 3"; its tool row: ammunition by "Woodcraft (arrows, bolts), Smithing (metal heads, shot)"; 5.1's class sentence to "a class names its makers by line"; Leatherwork's weapon role joins 4.2's node list when it lands (its state is already "with combat"). Owner question 14 if the owner prefers one craft per class. |
| WEAPONS 6: two ammunition classes, `core/arrow` and `core/sling-stone` | Crossbows fire bolts | A third content class `core/bolt` under `tool`; the matching rule reads `weapon.ammo` (owner question 4). |
| WEAPONS 6.1, a launcher's harm half its cell | Priced shapes push the top pair past the priced cell | The priced cell minus the tier's top (section 2). |
| WEAPONS 6.2 and HUNT_FAMILIES 3a :256: shaped stones at the workbench | A recipe names a station kind and needs a part of at least its tier (kernel/src/step.ts:792; tools/src/check.ts:432); it cannot name the workbench | The workshop kind at tier 1: the work stone or any better workshop. |
| WEAPONS 13 and 16, no shop sells a weapon of tier 2 or more; the built tier-3 shop row (tools/src/check.ts:455-467) | None | Kept: five tier-1 forms are sold (the knife, the club, the quarterstaff, the throwing stones, the sling); shops by town rank are owner question 10. |
| WEAPONS owner question 2 (duals) with `dual_use_max` 4 and `tool.tier` 1 to 5 (schema/src/index.ts:238) | A dual at every tier of three forms would pass both | Duals on the first rungs only: the sling at 1, the spear at 2, the bow at 3 (owner question 12). |
| `Word`: a family is lowercase, at most 24 characters (schema/src/index.ts:117); an id matches `ID_PATTERN` (:18) | 49 form names as family words; 407 ids | Checked: every form name fits, every id matches. |
| HUNT_LADDER's spear (tools/src/balance/hunt-ladder.json) | Its inputs break the skeleton into tier 3 | The spear's tier 2 to 3 is the skeleton's one exception. |

## 13. Check rows

Build now, over the source file, in tools/test/weapons.test.ts (no content reads them yet; WEAPONS 5.5):

- x WM-GRID: every hand's harm under its cell; a launcher's harm 0 or more; the share floor; the block's field bounds; every wind-up from the built `bare_windup_t` to under its tempo's built swing (`bare_windup_t <= windup < swing_<tempo>_t`, #598's values read from the source's `built` block); a close hand's rate at or over the bare hand.
- x WM-CLIMB: a recipe climbs one tier at most over its highest input (tools/src/check.ts:421, restated over the matrix).
- x WM-BAND: a row's level in its band by entry tier, and under Handcraft's top for Handcraft's rows (tools/src/check.ts:334, :424, :429).
- x WM-PROF: metal only in Smithing's rows; bows, staves and spears past tier 3 only Woodcraft's.
- x WM-BLOCK: no two hands of a tier share a block; no hand dominated in harm inside its class, tier, tempo and ammunition class; in hits at the built `bare_base` 8 (a launcher with its own tier's top shot), no pair dominated but the listed ties (`hit_ties_open`, 44), and a listed pair that stops tying fails too (it is dropped from the list).
- x WM-CLAMP: with the priced clamp (section 2), no hand dominated in `eff_harm` under the soft requirement at every own tier from 1 to t-2, nor under any `power_cap_permille` entry or 3250, but caps 1000 and 1100 (the stated exception, owner question 15); the hits sweep and the unpriced clamp are printed, not checked.
- x WM-HITS: #598's bands in bare-hand hits (`FIGHT_TIER_HITS`) hold at the built `bare_base`: T1 exactly 2 (9 to 16 health), T2 6 to 8 (41 to 64), T3 20 to 30 (153 to 240); the matrix's hands hit as the source states (a tier-1 standard 10, a tier-1 heavy 12, a tier-2 standard 11, a tier-3 standard 13 to 14, a tier-3 bow with its top shot 13) and never under bare hands; each band's top health falls in no more hits of a hand than of bare hands (16: 2; 64: 6 against 8; 240: 18 to 19 against 30).
- x WM-SKEL: at most two ids swapped from one tier to the next; no tier gap in a row.
- x WM-TEACH: start only at tier 1; sold only at tier 1; every teacher in its tiers and under its size (the cache 4, as WEAPONS 5.4 lays it; a quest 4); every try row has its row one tier below.
- x WM-TRY-SIZE: every try row has 2 to 4 distinct inputs.
- x WM-TRY-SET: every try row's set is unique at its station kind, against the matrix and every built recipe; taught pairs reported.
- x WM-AMMO: every ammunition tier has a launcher of that tier or more; every launcher has a shot; every pair under its priced cell, and a launcher with its own tier's top shot equal to it; no range with `range_add` past 12.
- x WM-DUAL: duals at most `dual_use_max`, none past `tool.tier` 5.
- x WM-Q5: every tier gives all three close tempos, a ranged hand, and wind-ups from 4 or under to 8 or over.
- x WM-BUILT: every built recipe inside the extended bands; every `built` value of the source whose anchor is content/core/params.json equals the content's value (and range) under that key, and the anchored line names the key (12 params today, the swing ticks, the wind-up floor and `bare_base` among them).
- x WM-COUNT: the counts inside the direction (70 to 80 at tiers 1 to 3, 300 to 350 at tiers 4 to 10) in every variant, the variant run alone failing when it leaves it; and section 10 of this page equal to the print.

With the first weapon content, in tools/src/check.ts (Waits): WM-TRY-SET and WM-TRY-SIZE over content's `discover` recipes; WEAPONS 16's teacher row as amended (WM-TEACH); the band and chance by entry tier (tools/src/check.ts:334, :424, :441); WEAPONS 16's own rows.

## 14. Owner questions

1. **Pricing shapes?** A: the price table of section 2 (feel, noise, reach and range cost harm; floor 800). B: no price: every hand takes its full cell, distinct by shape alone (the faster, quieter shape of each class and tempo then dominates the rest, WM-BLOCK). C: A, with a sling surcharge of 50 permille in the price table (proposed; at 45 the tier-3 long sling ties the bow, 80 against 80), so the long sling (95) and the staff-sling (130) sit under the bow's 85 at every tier where both exist; the hit ties of section 9 stay 44 (one leaves at tier 6, one arrives at tier 7); or the long sling at feel even (85, level with the bow). Under A, a sling or crossbow out-hitting the bow is the price working as designed (section 6). **Default: A.**
2. **Tier 10?** (a) The rate: A: `hand_rate_max_permille` gains a tenth tier entry, 3250 (proposed, a core param, G45; its stated range widens to 1000 to 3250). B: stop the matrix at tier 9 (70 / 290: under the 300 floor, leaves the direction). C: hold 3000 past tier 9 and let tier 10 repeat tier 9's blocks with its bonuses alone (38 tier-10 hands repeat). **Default: A.** (b) The power cap: A: `power_cap_permille` stays at its 14 character-level entries, top 3000, so a tier-10 hand strikes at most at the 3000 cap, as from character level 14 today, until the owner lifts R9 for all rates. B: a 15th entry, 3250 at character level 15, which raises the clamp on every rate multiplier (rare finds, craft luck, gather speed; kernel/src/step.ts:214, :236, :1870-1872) for every character at level 15 or more, not only the strike; the range widens with it. **Default: A.**
3. **WEAPONS 5.2's "past tier 5"?** A: read as past tier 9, where the rate table ends. B: freeze the rate past tier 5 and cut the table to five entries (194 of the 198 hands at tiers 6 to 10 repeat an earlier tier's block of their form; inside the per-tier rule, but the same cost as 2a C, wider). **Default: A.**
4. **Crossbows?** A: three crossbows and two bolt rows, `core/bolt` a content class under `tool`. B: no crossbows (70 / 306). **Default: A.** **Answered 12.11 (his note, "כן אבל בשלבים מתקדמים מאד ולא בהכרח יותר טובים מקשת"; the manager's reading of his note):** yes, A, with two conditions: crossbows exist only at very late stages of the game, and are a different choice from a bow, not a stronger one (so the table may not rank them above the bow at the same tier).
5. **How a recipe is taught?** A: one entry per form, the try for every higher tier (section 7). At tiers 2 and 3, A amends a decided owner rule (DECISIONS 2026-10-10, "higher tiers are dug up", CR-61; section 12), so it comes in two forms. A1 keeps the decision: the try starts at tier 4, and the 33 tier-2 and tier-3 try rows (12 at tier 2, 21 at tier 3) are taught by quests or scraps instead; quests cost no rarity budget and hold 4 recipes each, so about 9 more quests (8 once the free slots of q-staff, q-silk and q-hunt are used), and any extra scrap must fit the 469 ppm left. A2 amends the decision to read "a tier-2 or tier-3 entry is dug up or quested; the later rungs of a known family are found by the try". B: the form taught once and made in every material its station and level can work, as WEAPONS 5.3 has it (nothing left to find past the entry). C: two keys: the form's pattern (a scrap or quest) and the material's lesson (the first bar of a metal at the forge) teach the cell together. A scrap per recipe, as WEAPONS 5.2 reads, does not fit the budget (section 11). **Default: A, as A2, which needs the owner's explicit answer, since it amends the owner's own decision; with no answer, A1.** **Answered 12.11 (his note, "הכל מהכל, מגוון דרכים להדיג דרגות ברמת קושי תואמת לשמור על נדירות"; the manager's reading of his note, "להדיג" read as "להשיג"):** wider than every option. Every route is open at once: a recipe of a higher tier can be found, given by a quest, discovered in the workshop or taken from an enemy, each route's difficulty matching the tier so a rare thing stays rare, and the rarity of a tier equal across its routes. DECISIONS 2026-10-10 ("higher tiers are dug up", CR-61) is superseded by this; digging stays one route among several. Which routes each tier gets, and how hard each is, is design work for this table. The rows that read A1 or A2 wait on it.
6. **Metals past steel?** A: land slots, named with each land (QUARRYING 2.5). B: crucible steel and pattern steel at tiers 7 and 8, from steel and a land's flux, slots from 9. **Default: A.** **Answered 12.11 (the owner's pick, 12.11, in chat at 21:35, his words "כן אבל גם יהיהו מתכות בסיס גינריות בעולם (ברמות מתקדמוות המתכונים אולי עדיין מצריכים אותם)"): yes, A, with an addition.** Every land has a metal of its own, named together with its land, and beside them the world has generic base metals found everywhere; recipes of advanced tiers may still need the base metals.
7. **Smithing's entry tier?** A: Smithing enters at tier 4 at level 1; bands and the base chance by entry tier. B: one band per tier for every profession (a smith starts at level 8). **Default: A.**
8. **Forms that end?** A: eleven forms end before tier 10 (section 3). B: every form runs to tier 10 (72 / 389: over the 350 ceiling, leaves the direction; fuller shape pools at the top tiers, early shapes kept where a later form does their job, and 12 more hit ties at tiers 3 to 7 (section 10)). **Default: A.**
9. **Weapon patterns from foes?** A: none now; when foes drop, a pattern is an entry's second teacher and is priced in the rarity budget as a dig find. B: foes carry the entries in place of the cache. **Default: A.** **Answered 12.11 (his note, "כן, אם מדובר בNPC הנשק שלהם עם תכונות מעט שונות ומראה ייחודי לדמות שנלקח ממנה"; the manager's reading of his note):** yes, enemies are a source, and not only an entry's second teacher. When the enemy is a character (an NPC), what the player takes is that character's own weapon: its traits differ a little from the plain form and its look is unique to the character it was taken from. Whether a recipe is learned from it too is open. Differs from the default A (none now).
10. **Shops?** A: shops sell the five tier-1 forms only (WEAPONS 13, 16). B: shops by town rank sell up to tier 5 (as the unpublished discovery draft sketches). **Default: A.** **Answered 12.11 (the owner's pick, 12.11): B.** Shops sell by the city's grade, up to grade 5. Differs from the default A. **A point the table has to settle:** a shop of grade 5 must not undo rarity or the found weapon's bonus (WEAPONS 17 question 11, his yes of 12.11); the table says what a shop of each city grade may sell and what stays found or made only.
11. **Uniqueness across classes?** A: no two hands of one tier share a block across all classes. B: only within a class. **Default: A.**
12. **Duals?** A: the first rung of three forms only (the sling 1, the spear 2, the bow 3); later tiers are hands. B: every tier of the three forms up to `tool.tier` 5. **Default: A.** **Follows WEAPONS 17 question 2 (answered 12.11, the owner's pick, 12.11):** only the spear is a dual; the sling and the bow each have a separate combat version. So the rungs of the sling and the bow are hands, and the duals are the spear's first rung alone.
13. **First touch as a hint?** A: the bench counts the known forms a new line material answers, never a set. B: no hint beyond the "almost" hint of section 7. **Default: A.** **Answered 12.11 (the owner's pick, 12.11): B.** No hint in the workshop when a new material arrives, except "almost" when a trial is close. Differs from the default A.
14. **One craft per class?** A: a class names its makers by line from tier 4 (section 12, EQUIPMENT 3.7): the sling hands by Leatherwork, the javelin and the staff-sling by Woodcraft, the metal thrown hands and the shot by Smithing, arrows and bolts by Woodcraft with Smithing's heads. B: one craft per class, as EQUIPMENT 3.7 and PROGRESSION 5.1 read today (the sling's and the thrown class's maker then to be named, and the hide and wood rows of those classes moved to it). **Default: A.** **Answered 12.11 (the owner's pick, 12.11): A.** From tier 4 the maker follows the material: slings in leatherwork, the javelin in woodwork, metal throwing weapons in smithing, arrows in wood with heads from the smith.
15. **The first two character levels?** A: accept the stated exception: at power caps 1000 and 1100 (character levels 1 and 2) the clamp flattens quick hands below the price's rounding, so 81 and 18 pairs are dominated there and those levels read shape alone (WM-CLAMP, section 9). B: start the cap at 1200 (proposed), which clears both, a change to every rate at levels 1 and 2. **Default: A.**
16. **Hit ties?** A: accept and list the 44 pairs where a shape's price buys nothing in hits at the built `bare_base` 8 (13 at tiers 1 to 3; `hit_ties_open`, section 9); WM-BLOCK fails on any new one. B: space the prices (or start a form only where its hit separates from its neighbours) until none is left, which moves the price table and the blocks. C: a finer base inside #598's built range (16 leaves 18 ties, 4 leaves 82), a combat tuning that is the owner's, not this page's. **Default: A.**

## 15. What lands now and what waits

**Now (one pull request, based on develop ebd425b2c, on the owner's merge).** This page; the source file; the report and its command-line entry, run as the hunt ladder's is (`pnpm exec tsx tools/src/balance/weapons-cli.ts`, the `pnpm weapons` script waiting for the first weapon content, WEAPONS 5.5); the test; the word amendments to pages that are on develop: EQUIPMENT 3.7 and PROGRESSION 5.1 (section 12) and HUNT_FAMILIES 3a's shaped stones (section 11); a section with its Status line in docs/team/NEXT.md and an entry in docs/team/streams.json; a DECISIONS entry. The report's hit reading, `bare_base * (eff_harm + hand_offset) div hand_offset`, is a restatement of WEAPONS 4 (#609) until the kernel's own hand function lands with combat (G35): today the kernel's `hitsToFell` (kernel/src/fightmath.ts:13-16) reads bare hands alone, and the report takes `bare_base`, the swing ticks and the bare wind-up from the bundle's combat params (#598), never from a copy of its own. No content, no param, no schema field, no check row, no kernel change.

**Waits.**

- **For #609 to land (a follow-up pull request):** every amendment to WEAPONS 4, 5.2, 5.3, 6.1, 6.2 and 16 (section 11) and to CLOTHING, the hardened leather (section 12): pages of the open pull request #609, not on develop. `hand_offset` 128 is #609's pending amendment of COMBAT 4.9's 64 (DECISIONS 2026-11-02 in #609); the matrix reads 128 as #609 does, and at the hands' caps the offset cancels out of the hit, so no number of this page waits on it.
- **For combat (G35):** every hand and its `weapon` block; the kernel's hand function, which replaces the report's restated hit reading; WEAPONS' `combat` params beyond #598's, with `hand_rate_max_permille` growing to ten entries if owner question 2a is A (`power_cap_permille` only if 2b is B).
- **For the take verb:** the four take tools as WEAPONS 5.4 has them.
- **For the try (the discovery draft's kernel pull request, unpublished):** the `discover?` field on `RecipeBody` and the `known` description's "or by the try at a station" (a core schema change, section 12), and every try row; until then a try row cannot be learned, so none lands. At tiers 2 and 3, also owner question 5 (A1 or A2).
- **For a feather item:** every arrow, the darts from tier 4, the javelin.
- **For their materials:** each row with its first input (QUARRYING's stones and bars, CLOTHING's thread and leather, the hardened leather this page proposes, landing with CLOTHING's boiled leather, the hart's antler, HUNT_FAMILIES' animals).
- **For each tier past 3:** `open_tiers` (content/core/params.json:88; an item above it is refused, tools/src/check.ts:364, and from `GATED_TIER` 3 an item comes only from a gated source, :307), `tier_min_level`, the city's workshop and forge (decision 51), the Smithing, Woodcraft and Leatherwork professions with their curves, and the check and kernel reading bands by entry tier.
- **For each land:** its slot rows, renamed.
- **For the owner's answers:** every row an answer moves.

## 16. Not here

The value of each row (the kernel's solver prices it from its inputs once the inputs exist; G40 and CR-16 are checked then, tools/src/check.ts:433-438 and :439-452, and `max_action_ms` 15000 bounds each `active_ms`, content/core/params.json:34); the quests' text and placement; the foes; bonuses, traits and signatures (WEAPONS 8.1, 9.1); armour and clothing (CLOTHING).

## Sources

- WEAPONS, a page of the open pull request #609 (cited by section, never by line): sections 2 to 6.2, 13, 16 and 17; its 5.3 names this page. CLOTHING, QUARRYING, BUILD_SET and GAP_RS_GEAR are #609's too.
- #598 on develop (the combat foundations, ready and not switched on): content/core/params.json:1103 (the `combat` group), :1090, :1096, :1102 (`swing_quick_t` 8, `swing_standard_t` 10, `swing_heavy_t` 12), :1108 (`swing_floor_t` 6), :1114 (`bare_windup_t` 3), :1120 (`bare_base` 8, range 4 to 16, step 1); kernel/src/fightmath.ts:13-16 (`hitsToFell`); schema/src/index.ts:2130 (`FIGHT_TIER_HITS`); tools/src/fight.ts:64-68 (the tier check). COMBAT 4.9 (docs/design/COMBAT.md:236-295; the damage row :257, the hand compression :258, the T1 row :275).
- DECISIONS 2026-11-02 "The hand's bonus offset is 128", in #609's DECISIONS (not yet on develop).
- docs/design/GAME_RULES.md:405-406 (G35), :508-514 (G44, the weapon sentence at :513-514); G45, G79, decision 42 and decision 51 as WEAPONS 4 (#609) cites them.
- QUARRYING 2.4, 2.5 and 13; CLOTHING; MATERIALS 2 and 3.3; HUNT_FAMILIES 3a, 3.16, 3.18, 4 and 5; HUNT_LADDER section 1; EQUIPMENT 3.7 (docs/design/EQUIPMENT.md:125, :127); PROGRESSION 4.2 (:166), 4.7 and 5.1 (:450); BESTIARY_LANDS (#432).
- DECISIONS 2026-10-10 "First-tier recipes are known from the start; higher tiers are dug up" (DECISIONS.md:977-981; CR-61).
- The crafting discovery note (D1, D2, D6, C5, T1) and the combat foundations note (Q-5): unpublished drafts of this stream, in neither the repository at ebd425b2c nor #609; this page restates every rule it takes from them, so it stands without them; they land as their own pages later.
- Code on develop ebd425b2c (every anchor here is cited in the body at least once, as written): tools/src/check.ts:307, :331-332, :334, :364, :378-383, :387-391, :421, :424, :425, :429, :432, :433-438, :439-452, :441, :455-467, :472, :611; schema/src/index.ts:18, :53, :56, :95, :117, :212, :216, :238, :391, :428, :429, :444-458 (`RecipeBody`; `known` at :453-455), :729, :2130; content/core/params.json:34, :66, :82, :88, :94, :105, :630, :1083, :1090, :1096, :1102, :1108, :1114, :1120; kernel/src/values.ts:105-114, :206, :239; kernel/src/step.ts:214, :222, :236, :244, :792, :1870-1872; kernel/src/state.ts:559-564; kernel/src/fightmath.ts:13-16; tools/src/fight.ts:64-68.

## Appendix: the build list

What lands now: no content, no param, no schema. The source, the report and the test sit beside the hunt ladder's (tools/src/balance/hunt-ladder.json, hunt-ladder.ts, hunt-ladder-cli.ts; tools/test/hunt-ladder.test.ts).

| Kind | Id or path | What it holds or does | Placement | Test that proves it |
|---|---|---|---|---|
| design page | docs/design/WEAPON_MATRIX.md | this page | docs/design | the test: section 10's blocks equal the report's print |
| data file | tools/src/balance/weapon-matrix.json | the source: params (built ones with their file and line, WEAPONS' proposals, the matrix's own), the seven classes, three ammunition classes, four professions, two stations, every input item with its tier and status, the three lines, 49 forms, 9 parts, 6 ammunition rows, the teachers, the shop limit, the 30 first-slice rows as WEAPONS writes them, the built `bare_base`, swing ticks and bare wind-up (#598) each with its line, the hit ties left open (`hit_ties_open`, 44), and #598's bands in bare-hand hits with the matrix's hands over them (`anchors`) | tools/src/balance | the test parses it; every `built` value equals content at its line |
| report | tools/src/balance/weapons.ts | expands the source (form by tier into hands, parts and ammunition), prices each block and reads its hit (WEAPONS 4's (#609) cell and hit line, restated until the kernel's own hand function lands with combat; `bare_base`, the swing ticks and the bare wind-up read from the bundle's combat params, #598), runs the checks of section 13, counts, prints the tables; pure | tools/src/balance | weapons.test.ts |
| report entry | tools/src/balance/weapons-cli.ts | prints the report; `--tables`, `--variant`, `--json`; reads built recipes through the balance world loader (tools/src/balance/world.ts) | tools/src/balance | the test calls the report's function, not the command |
| test | tools/test/weapons.test.ts | the default variant passes every check, WM-CLAMP and WM-HITS included; every variant's WM-COUNT verdict as section 10 prints it; counts 70 and 337 and the class table; one fixture mutation per check family fails with its own message; the page's section 10 equals the print; the built recipes sit in the extended bands | tools/test | `pnpm test` |
| amendment | EQUIPMENT 3.7; PROGRESSION 5.1; HUNT_FAMILIES 3a | words only, as sections 11 and 12 list, on pages that are on develop | docs/design/EQUIPMENT.md, PROGRESSION.md, HUNT_FAMILIES.md | the report's first-slice print names each move or "as written" |
| stream row | docs/team/NEXT.md, docs/team/streams.json | a section for the weapon matrix with its Status line, and its stream entry | docs/team | none: words |
| decisions entry | DECISIONS.md | the matrix proposed on develop ebd425b2c, its owner questions with their defaults, and what waits for #609 | repository root | none: a dated entry |

Size: 8 rows: 1 page, 1 data file, 1 report with its entry, 1 test, 1 amendment, 1 stream row, 1 decisions entry.

### Waits

| Kind | Id or path | What | Waits for |
|---|---|---|---|
| amendments | docs/design/WEAPONS.md 4, 5.2, 5.3, 6.1, 6.2, 16; docs/design/CLOTHING.md (the hardened leather) | words only, as sections 11 and 12 list | #609 landing; a follow-up pull request |
| kernel | kernel/src/fightmath.ts | a hand's hit beside `hitsToFell`, replacing the report's restated reading | combat (G35) |
| check rows | tools/src/check.ts | WM-TRY-SET and WM-TRY-SIZE over content's `discover` recipes; WM-TEACH in place of WEAPONS 16's teacher row; bands by entry tier | the try's kernel pull request and the first weapon content |
| params | content/core/params.json | `tier_min_level` to ten entries; `hand_rate_max_permille` to 3250 at tier 10 (a tenth tier entry); `power_cap_permille` gains a 15th character-level entry only if owner question 2b is B; `craft_chance_bp` past tier 3 | each tier's opening; owner questions 2a, 2b and 7 |
| schema | schema/src/index.ts | `STATIONS` gains `forge`; `RecipeBody` gains `discover?` and the `known` description adds "or by the try at a station" (:453-455) | tier 4; the try's kernel pull request |
| class | content/core | `core/bolt` under `tool`, beside `core/arrow` and `core/sling-stone` | the first crossbow; owner question 4 |
| professions | content/core | Smithing (entry 4, curve to 15), Woodcraft and Leatherwork (curves to 20) | tier 4 |
| content | content/core | the 407 rows, each with its first input and combat | combat, the take verb, the try, the feather, their materials, their lands |
| script | package.json `weapons` | `pnpm weapons` | the first weapon content (WEAPONS 5.5) |
| report write and verify | tools/src/balance/weapons-cli.ts `--write`, `--verify` | writes the recipe and item files of the landed rows from the source, and fails when the files differ from it (WEAPONS 5.3, as `pnpm schemas --verify` does for the schemas) | the first weapon content |
