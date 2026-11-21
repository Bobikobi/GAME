# The scale audit, 31.10.2026

Every sprite a player sees in the world (props, characters, creatures; not ground tiles and not inventory icons), measured against the adult. Made by `pnpm art:scale --write`; the rule is NATURE section 1 and STYLE 1b (`tools/src/kit/scale.ts`).

The adult: `chars/human_down`, 73 art px of opaque height at density 4, 18.25 world units. One character is that height. A sprite's drawn height is its opaque box (not the canvas), its tallest frame, divided by its density and by the adult's.

Verdicts: under 8 · over 0 · in range 107 · no rule 50 (165 sprites).

A range with one number is a floor and the size of the common one; bigger is open (STYLE 1b), so only a kind with a top in NATURE can be over. A height up to a tenth under its floor is in range (the tolerance, NATURE section 1). `no rule` is a kind no page gives a height: it is listed, not judged. The open list is also what `pnpm check` prints as `!` lines.

| Sprite | Kind | Drawn px | Density | Characters | Range | Verdict | Out by |
|---|---|---|---|---|---|---|---|
| `props/fig_bush` (ceosisrael) | oak | 58 | 4 | 0.79 | 3+ | under | 1.91 |
| `props/fig_bush_empty` (ceosisrael) | oak | 58 | 4 | 0.79 | 3+ | under | 1.91 |
| `props/tree_oak` | oak | 32 | 1 | 1.75 | 3+ | under | 0.95 |
| `props/young_tree` | young tree | 23 | 1 | 1.26 | 2+ | under | 0.54 |
| `props/dead_tree` | dead tree | 32 | 1 | 1.75 | 2.5+ | under | 0.5 |
| `chars/skeleton_left` | adult | 54 | 4 | 0.74 | 1+ | under | 0.16 |
| `chars/skeleton_down` | adult | 56 | 4 | 0.77 | 1+ | under | 0.13 |
| `props/sapling` | sapling | 60 | 4 | 0.82 | 1+ | under | 0.08 |
| `chars/digger_down` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/digger_idle_down` | adult | 22 | 1 | 1.21 | 1+ | in range |  |
| `chars/digger_idle_left` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/digger_idle_up` | adult | 22 | 1 | 1.21 | 1+ | in range |  |
| `chars/digger_left` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/digger_up` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/digger_w_down` | adult | 22 | 1 | 1.21 | 1+ | in range |  |
| `chars/digger_w_idle_down` | adult | 22 | 1 | 1.21 | 1+ | in range |  |
| `chars/digger_w_idle_left` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/digger_w_idle_up` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/digger_w_left` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/digger_w_up` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/digger_w_work_down` | adult | 31 | 1 | 1.7 | 1+ | in range |  |
| `chars/digger_w_work_left` | adult | 31 | 1 | 1.7 | 1+ | in range |  |
| `chars/digger_w_work_up` | adult | 31 | 1 | 1.7 | 1+ | in range |  |
| `chars/digger_work_down` | adult | 31 | 1 | 1.7 | 1+ | in range |  |
| `chars/digger_work_left` | adult | 31 | 1 | 1.7 | 1+ | in range |  |
| `chars/digger_work_up` | adult | 31 | 1 | 1.7 | 1+ | in range |  |
| `chars/elder` | elder | 21 | 1 | 1.15 | 0.9+ | in range |  |
| `chars/elder_blink` | elder | 21 | 1 | 1.15 | 0.9+ | in range |  |
| `chars/elf_down` | adult | 79 | 4 | 1.08 | 1+ | in range |  |
| `chars/elf_left` | adult | 84 | 4 | 1.15 | 1+ | in range |  |
| `chars/elf_up` | adult | 100 | 4 | 1.37 | 1+ | in range |  |
| `chars/elf_w_down` | adult | 79 | 4 | 1.08 | 1+ | in range |  |
| `chars/elf_w_left` | adult | 81 | 4 | 1.11 | 1+ | in range |  |
| `chars/elf_w_up` | adult | 99 | 4 | 1.36 | 1+ | in range |  |
| `chars/explorer_down` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/explorer_idle_down` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/explorer_idle_left` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/explorer_idle_up` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/explorer_left` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/explorer_up` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/explorer_w_down` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/explorer_w_idle_down` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/explorer_w_idle_left` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/explorer_w_idle_up` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/explorer_w_left` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/explorer_w_up` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/explorer_w_work_down` | adult | 32 | 1 | 1.75 | 1+ | in range |  |
| `chars/explorer_w_work_left` | adult | 32 | 1 | 1.75 | 1+ | in range |  |
| `chars/explorer_w_work_up` | adult | 32 | 1 | 1.75 | 1+ | in range |  |
| `chars/explorer_work_down` | adult | 32 | 1 | 1.75 | 1+ | in range |  |
| `chars/explorer_work_left` | adult | 32 | 1 | 1.75 | 1+ | in range |  |
| `chars/explorer_work_up` | adult | 32 | 1 | 1.75 | 1+ | in range |  |
| `chars/forager_down` | adult | 21 | 1 | 1.15 | 1+ | in range |  |
| `chars/forager_idle_down` | adult | 21 | 1 | 1.15 | 1+ | in range |  |
| `chars/forager_idle_left` | adult | 20 | 1 | 1.1 | 1+ | in range |  |
| `chars/forager_idle_up` | adult | 19 | 1 | 1.04 | 1+ | in range |  |
| `chars/forager_left` | adult | 20 | 1 | 1.1 | 1+ | in range |  |
| `chars/forager_up` | adult | 20 | 1 | 1.1 | 1+ | in range |  |
| `chars/forager_w_down` | adult | 21 | 1 | 1.15 | 1+ | in range |  |
| `chars/forager_w_idle_down` | adult | 21 | 1 | 1.15 | 1+ | in range |  |
| `chars/forager_w_idle_left` | adult | 20 | 1 | 1.1 | 1+ | in range |  |
| `chars/forager_w_idle_up` | adult | 20 | 1 | 1.1 | 1+ | in range |  |
| `chars/forager_w_left` | adult | 20 | 1 | 1.1 | 1+ | in range |  |
| `chars/forager_w_up` | adult | 20 | 1 | 1.1 | 1+ | in range |  |
| `chars/forager_w_work_down` | adult | 28 | 1 | 1.53 | 1+ | in range |  |
| `chars/forager_w_work_left` | adult | 28 | 1 | 1.53 | 1+ | in range |  |
| `chars/forager_w_work_up` | adult | 28 | 1 | 1.53 | 1+ | in range |  |
| `chars/forager_work_down` | adult | 28 | 1 | 1.53 | 1+ | in range |  |
| `chars/forager_work_left` | adult | 28 | 1 | 1.53 | 1+ | in range |  |
| `chars/forager_work_up` | adult | 28 | 1 | 1.53 | 1+ | in range |  |
| `chars/human_down` | adult | 73 | 4 | 1 | 1+ | in range |  |
| `chars/human_left` | adult | 69 | 4 | 0.95 | 1+ | in range |  |
| `chars/human_up` | adult | 84 | 4 | 1.15 | 1+ | in range |  |
| `chars/human_w_down` | adult | 70 | 4 | 0.96 | 1+ | in range |  |
| `chars/human_w_left` | adult | 66 | 4 | 0.9 | 1+ | in range |  |
| `chars/human_w_up` | adult | 78 | 4 | 1.07 | 1+ | in range |  |
| `chars/player_down` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/player_idle_down` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/player_idle_left` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/player_idle_up` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/player_left` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/player_up` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/player_work_down` | adult | 32 | 1 | 1.75 | 1+ | in range |  |
| `chars/player_work_left` | adult | 32 | 1 | 1.75 | 1+ | in range |  |
| `chars/player_work_up` | adult | 32 | 1 | 1.75 | 1+ | in range |  |
| `chars/skeleton_up` | adult | 68 | 4 | 0.93 | 1+ | in range |  |
| `chars/trader` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/trader_blink` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/woman_down` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/woman_idle_down` | adult | 23 | 1 | 1.26 | 1+ | in range |  |
| `chars/woman_idle_left` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/woman_idle_up` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/woman_left` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/woman_up` | adult | 24 | 1 | 1.32 | 1+ | in range |  |
| `chars/woman_work_down` | adult | 32 | 1 | 1.75 | 1+ | in range |  |
| `props/broken_statue` | standing stone | 153 | 4 | 2.1 | 1.5+ | in range |  |
| `props/bush_berry` | bush | 63 | 4 | 0.86 | 0.5+ | in range |  |
| `props/bush_berry_b` | bush | 63 | 4 | 0.86 | 0.5+ | in range |  |
| `props/bush_berry_c` | bush | 64 | 4 | 0.88 | 0.5+ | in range |  |
| `props/bush_empty` | bush | 14 | 1 | 0.77 | 0.5+ | in range |  |
| `props/campfire_lit` | - | 58 | 4 | 0.79 | no rule | no rule |  |
| `props/campfire_lit_b` | - | 55 | 4 | 0.75 | no rule | no rule |  |
| `props/campfire_lit_c` | - | 61 | 4 | 0.84 | no rule | no rule |  |
| `props/campfire_unlit` | - | 51 | 4 | 0.7 | no rule | no rule |  |
| `props/canopy_1` | - | 32 | 1 | 1.75 | no rule | no rule |  |
| `props/canopy_2` | - | 32 | 1 | 1.75 | no rule | no rule |  |
| `props/canopy_3` | - | 32 | 1 | 1.75 | no rule | no rule |  |
| `props/chest` | - | 32 | 4 | 0.44 | no rule | no rule |  |
| `props/counter` | - | 66 | 4 | 0.9 | no rule | no rule |  |
| `props/dig_spot` | - | 34 | 4 | 0.47 | no rule | no rule |  |
| `props/door_mat` | - | 26 | 4 | 0.36 | no rule | no rule |  |
| `props/fallen_branches` | - | 64 | 4 | 0.88 | no rule | no rule |  |
| `props/fence` | - | 48 | 4 | 0.66 | no rule | no rule |  |
| `props/fence_post` | - | 64 | 4 | 0.88 | no rule | no rule |  |
| `props/flour_sack` | - | 54 | 4 | 0.74 | no rule | no rule |  |
| `props/flowers` | tall grass | 22 | 4 | 0.3 | 0.25+ | in range |  |
| `props/flowers_blue` | tall grass | 10 | 1 | 0.55 | 0.25+ | in range |  |
| `props/flowers_white` | tall grass | 22 | 4 | 0.3 | 0.25+ | in range |  |
| `props/fog` | - | 25 | 1 | 1.37 | no rule | no rule |  |
| `props/glow_mushrooms` | - | 64 | 4 | 0.88 | no rule | no rule |  |
| `props/grass_tall` | tall grass | 31 | 4 | 0.42 | 0.25+ | in range |  |
| `props/grass_tall_b` | tall grass | 64 | 4 | 0.88 | 0.25+ | in range |  |
| `props/grass_tall_c` | tall grass | 64 | 4 | 0.88 | 0.25+ | in range |  |
| `props/hazard_pit` | - | 54 | 4 | 0.74 | no rule | no rule |  |
| `props/hazard_trap` | - | 56 | 4 | 0.77 | no rule | no rule |  |
| `props/hazard_wolf` | wolf | 12 | 1 | 0.66 | 0.55+ | in range |  |
| `props/hearth` | - | 172 | 4 | 2.36 | no rule | no rule |  |
| `props/herb_plant` | - | 64 | 4 | 0.88 | no rule | no rule |  |
| `props/herb_plant_b` | - | 64 | 4 | 0.88 | no rule | no rule |  |
| `props/herb_plant_c` | - | 64 | 4 | 0.88 | no rule | no rule |  |
| `props/house_small` | house | 209 | 4 | 2.86 | 3+ | in range |  |
| `props/jar_shelf` | - | 101 | 4 | 1.38 | no rule | no rule |  |
| `props/lantern_post` | street lamp | 192 | 4 | 2.63 | 2+ | in range |  |
| `props/log_fallen` | - | 41 | 4 | 0.56 | no rule | no rule |  |
| `props/log_mossy` | - | 35 | 4 | 0.48 | no rule | no rule |  |
| `props/market_stall` | market stall | 175 | 4 | 2.4 | 2+ | in range |  |
| `props/mushroom_crate` | - | 58 | 4 | 0.79 | no rule | no rule |  |
| `props/mushroom_patch` | - | 43 | 4 | 0.59 | no rule | no rule |  |
| `props/mushrooms_small` | - | 64 | 4 | 0.88 | no rule | no rule |  |
| `props/pear_barrel` | - | 65 | 4 | 0.89 | no rule | no rule |  |
| `props/pebbles` | - | 53 | 4 | 0.73 | no rule | no rule |  |
| `props/potted_herb` | - | 46 | 4 | 0.63 | no rule | no rule |  |
| `props/reeds` | tall grass | 64 | 4 | 0.88 | 0.25+ | in range |  |
| `props/rock_mossy` | - | 53 | 4 | 0.73 | no rule | no rule |  |
| `props/rock_small` | - | 37 | 4 | 0.51 | no rule | no rule |  |
| `props/rock_stones` | - | 49 | 4 | 0.67 | no rule | no rule |  |
| `props/room_wall_left` | - | 189 | 4 | 2.59 | no rule | no rule |  |
| `props/room_wall_right` | - | 189 | 4 | 2.59 | no rule | no rule |  |
| `props/rubble` | - | 16 | 1 | 0.88 | no rule | no rule |  |
| `props/ruin_arch` | - | 32 | 1 | 1.75 | no rule | no rule |  |
| `props/ruin_pillar` | standing stone | 31 | 1 | 1.7 | 1.5+ | in range |  |
| `props/ruin_wall` | - | 22 | 1 | 1.21 | no rule | no rule |  |
| `props/runner` | - | 256 | 4 | 3.51 | no rule | no rule |  |
| `props/scale` | - | 34 | 4 | 0.47 | no rule | no rule |  |
| `props/shelf` | - | 64 | 4 | 0.88 | no rule | no rule |  |
| `props/shop_cat` | hen | 30 | 4 | 0.41 | 0.25+ | in range |  |
| `props/shop_sign_food` | - | 61 | 4 | 0.84 | no rule | no rule |  |
| `props/shop_window` | - | 74 | 4 | 1.01 | no rule | no rule |  |
| `props/sign` | - | 48 | 4 | 0.66 | no rule | no rule |  |
| `props/standing_stone` | standing stone | 99 | 4 | 1.36 | 1.5+ | in range |  |
| `props/statue_head` | - | 31 | 1 | 1.7 | no rule | no rule |  |
| `props/stump` | - | 44 | 4 | 0.6 | no rule | no rule |  |
| `props/totem` | standing stone | 32 | 1 | 1.75 | 1.5+ | in range |  |
| `props/well_old` | - | 120 | 4 | 1.64 | no rule | no rule |  |
| `props/well_old_b` | - | 128 | 4 | 1.75 | no rule | no rule |  |
