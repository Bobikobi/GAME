# The scale audit, 31.10.2026

Every sprite a player sees in the world (props, characters, creatures; not ground tiles and not inventory icons), measured against the adult. Made by `pnpm art:scale --write`; the rule is NATURE section 1 and STYLE 1b (`tools/src/kit/scale.ts`).

The adult: frame 0 of `chars/human_hit_front`, the human's base body, 67 art px of opaque height at density 4 (at its fit), 16.75 world units. One character is that height. A sprite's drawn height is its opaque box (not the canvas), its tallest frame, divided by its density and by the adult's.

Verdicts: under 34 · over 15 · in range 164 · no rule 63 (276 sprites).

A range with one number is a floor and the size of the common one; bigger is open (STYLE 1b), so only a kind with a top in NATURE can be over. A height up to a tenth under its floor is in range (the tolerance, NATURE section 1). `no rule` is a kind no page gives a height: it is listed, not judged. The open list is also what `pnpm check` prints as `!` lines.

| Sprite | Kind | Drawn px | Density | Characters | Range | Verdict | Out by |
|---|---|---|---|---|---|---|---|
| `props/fig_bush` (ceosisrael) | oak | 58 | 4 | 0.87 | 3+ | under | 1.83 |
| `props/fig_bush_empty` (ceosisrael) | oak | 58 | 4 | 0.87 | 3+ | under | 1.83 |
| `props/tree_oak` | oak | 104 | 4 | 1.55 | 3+ | under | 1.15 |
| `chars/elf_fish_left` | fish | 109 | 4 | 1.37 | 0.1 to 0.3 | over | 1.07 |
| `chars/elf_fish_back` | fish | 101 | 4 | 1.27 | 0.1 to 0.3 | over | 0.97 |
| `chars/elf_fish_front` | fish | 101 | 4 | 1.19 | 0.1 to 0.3 | over | 0.89 |
| `chars/human_fish_left` | fish | 108 | 4 | 1.16 | 0.1 to 0.3 | over | 0.86 |
| `props/young_tree` | young tree | 73 | 4 | 1.09 | 2+ | under | 0.71 |
| `chars/human_fish_front` | fish | 96 | 4 | 1 | 0.1 to 0.3 | over | 0.7 |
| `props/dead_tree` | dead tree | 105 | 4 | 1.57 | 2.5+ | under | 0.68 |
| `chars/skeleton_fish_left` | fish | 111 | 4 | 0.93 | 0.1 to 0.3 | over | 0.63 |
| `chars/skeleton_fish_back` | fish | 97 | 4 | 0.81 | 0.1 to 0.3 | over | 0.51 |
| `chars/skeleton_fish_front` | fish | 96 | 4 | 0.81 | 0.1 to 0.3 | over | 0.51 |
| `chars/skeleton_dodge_back` | adult | 97 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_dodge_front` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_dodge_left` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_guard_front` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_guard_left` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_left` | adult | 54 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_pickup_back` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_pickup_front` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_pickup_left` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_push_back` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_push_front` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_push_left` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_quarry_front` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_strike_back` | adult | 97 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_strike_left` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_throw_back` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_throw_left` | adult | 96 | 4 | 0.81 | 1+ | under | 0.09 |
| `chars/skeleton_guard_back` | adult | 98 | 4 | 0.82 | 1+ | under | 0.08 |
| `chars/skeleton_reed-walker_down` | adult | 55 | 4 | 0.82 | 1+ | under | 0.08 |
| `chars/skeleton_reed-walker_left` | adult | 55 | 4 | 0.82 | 1+ | under | 0.08 |
| `chars/skeleton_reed-walker_up` | adult | 55 | 4 | 0.82 | 1+ | under | 0.08 |
| `chars/skeleton_throw_front` | adult | 98 | 4 | 0.82 | 1+ | under | 0.08 |
| `creatures/crow_idle_back` | bird | 31 | 4 | 0.23 | 0.1 to 0.15 | over | 0.08 |
| `chars/skeleton_hit_left` | adult | 99 | 4 | 0.83 | 1+ | under | 0.07 |
| `chars/skeleton_strike_front` | adult | 99 | 4 | 0.83 | 1+ | under | 0.07 |
| `chars/skeleton_down` | adult | 56 | 4 | 0.84 | 1+ | under | 0.06 |
| `creatures/crow_idle_front` | bird | 24 | 4 | 0.21 | 0.1 to 0.15 | over | 0.06 |
| `creatures/crow_walk_back` | bird | 29 | 4 | 0.21 | 0.1 to 0.15 | over | 0.06 |
| `creatures/crow_walk_front` | bird | 24 | 4 | 0.21 | 0.1 to 0.15 | over | 0.06 |
| `chars/skeleton_hit_back` | adult | 101 | 4 | 0.85 | 1+ | under | 0.05 |
| `chars/skeleton_fell_back` | adult | 102 | 4 | 0.86 | 1+ | under | 0.04 |
| `creatures/crow_walk_left` | bird | 26 | 4 | 0.18 | 0.1 to 0.15 | over | 0.03 |
| `creatures/sparrow_idle_back` | bird | 26 | 4 | 0.18 | 0.1 to 0.15 | over | 0.03 |
| `creatures/sparrow_walk_back` | bird | 26 | 4 | 0.18 | 0.1 to 0.15 | over | 0.03 |
| `chars/skeleton_hit_front` | adult | 105 | 4 | 0.88 | 1+ | under | 0.02 |
| `chars/skeleton_quarry_back` | adult | 105 | 4 | 0.88 | 1+ | under | 0.02 |
| `chars/elder` | elder | 21 | 1 | 1.25 | 0.9+ | in range |  |
| `chars/elder_blink` | elder | 21 | 1 | 1.25 | 0.9+ | in range |  |
| `chars/elf_carry_back` | adult | 135 | 4 | 1.69 | 1+ | in range |  |
| `chars/elf_carry_front` | adult | 138 | 4 | 1.63 | 1+ | in range |  |
| `chars/elf_carry_left` | adult | 132 | 4 | 1.65 | 1+ | in range |  |
| `chars/elf_dodge_back` | adult | 101 | 4 | 1.27 | 1+ | in range |  |
| `chars/elf_dodge_front` | adult | 100 | 4 | 1.18 | 1+ | in range |  |
| `chars/elf_dodge_left` | adult | 100 | 4 | 1.25 | 1+ | in range |  |
| `chars/elf_down` | adult | 79 | 4 | 1.18 | 1+ | in range |  |
| `chars/elf_fell_back` | adult | 103 | 4 | 1.29 | 1+ | in range |  |
| `chars/elf_fell_front` | adult | 105 | 4 | 1.24 | 1+ | in range |  |
| `chars/elf_fell_left` | adult | 114 | 4 | 1.43 | 1+ | in range |  |
| `chars/elf_guard_back` | adult | 102 | 4 | 1.28 | 1+ | in range |  |
| `chars/elf_guard_front` | adult | 101 | 4 | 1.19 | 1+ | in range |  |
| `chars/elf_guard_left` | adult | 100 | 4 | 1.25 | 1+ | in range |  |
| `chars/elf_hit_back` | adult | 107 | 4 | 1.34 | 1+ | in range |  |
| `chars/elf_hit_front` | adult | 104 | 4 | 1.23 | 1+ | in range |  |
| `chars/elf_hit_left` | adult | 100 | 4 | 1.25 | 1+ | in range |  |
| `chars/elf_left` | adult | 84 | 4 | 1.25 | 1+ | in range |  |
| `chars/elf_lift_back` | adult | 135 | 4 | 1.69 | 1+ | in range |  |
| `chars/elf_lift_front` | adult | 134 | 4 | 1.58 | 1+ | in range |  |
| `chars/elf_lift_left` | adult | 130 | 4 | 1.63 | 1+ | in range |  |
| `chars/elf_pickup_back` | adult | 101 | 4 | 1.27 | 1+ | in range |  |
| `chars/elf_pickup_front` | adult | 100 | 4 | 1.18 | 1+ | in range |  |
| `chars/elf_pickup_left` | adult | 100 | 4 | 1.25 | 1+ | in range |  |
| `chars/elf_push_back` | adult | 102 | 4 | 1.28 | 1+ | in range |  |
| `chars/elf_push_front` | adult | 100 | 4 | 1.18 | 1+ | in range |  |
| `chars/elf_push_left` | adult | 100 | 4 | 1.25 | 1+ | in range |  |
| `chars/elf_quarry_back` | adult | 103 | 4 | 1.29 | 1+ | in range |  |
| `chars/elf_quarry_front` | adult | 100 | 4 | 1.18 | 1+ | in range |  |
| `chars/elf_quarry_left` | adult | 109 | 4 | 1.37 | 1+ | in range |  |
| `chars/elf_reed-walker_down` | adult | 80 | 4 | 1.19 | 1+ | in range |  |
| `chars/elf_reed-walker_left` | adult | 85 | 4 | 1.27 | 1+ | in range |  |
| `chars/elf_reed-walker_up` | adult | 85 | 4 | 1.27 | 1+ | in range |  |
| `chars/elf_strike_back` | adult | 100 | 4 | 1.25 | 1+ | in range |  |
| `chars/elf_strike_front` | adult | 105 | 4 | 1.24 | 1+ | in range |  |
| `chars/elf_strike_left` | adult | 100 | 4 | 1.25 | 1+ | in range |  |
| `chars/elf_throw_back` | adult | 101 | 4 | 1.27 | 1+ | in range |  |
| `chars/elf_throw_front` | adult | 109 | 4 | 1.29 | 1+ | in range |  |
| `chars/elf_throw_left` | adult | 102 | 4 | 1.28 | 1+ | in range |  |
| `chars/elf_up` | adult | 100 | 4 | 1.49 | 1+ | in range |  |
| `chars/elf_w_down` | adult | 79 | 4 | 1.18 | 1+ | in range |  |
| `chars/elf_w_left` | adult | 81 | 4 | 1.21 | 1+ | in range |  |
| `chars/elf_w_up` | adult | 99 | 4 | 1.48 | 1+ | in range |  |
| `chars/human_carry_back` | adult | 143 | 4 | 1.58 | 1+ | in range |  |
| `chars/human_carry_front` | adult | 145 | 4 | 1.51 | 1+ | in range |  |
| `chars/human_carry_left` | adult | 134 | 4 | 1.44 | 1+ | in range |  |
| `chars/human_die_back` | adult | 98 | 4 | 1.08 | 1+ | in range |  |
| `chars/human_die_front` | adult | 96 | 4 | 1 | 1+ | in range |  |
| `chars/human_die_left` | adult | 96 | 4 | 1.03 | 1+ | in range |  |
| `chars/human_digger-leathers_down` | adult | 67 | 4 | 1 | 1+ | in range |  |
| `chars/human_digger-leathers_left` | adult | 68 | 4 | 1.01 | 1+ | in range |  |
| `chars/human_digger-leathers_up` | adult | 72 | 4 | 1.07 | 1+ | in range |  |
| `chars/human_dodge_back` | adult | 96 | 4 | 1.06 | 1+ | in range |  |
| `chars/human_dodge_front` | adult | 96 | 4 | 1 | 1+ | in range |  |
| `chars/human_dodge_left` | adult | 96 | 4 | 1.03 | 1+ | in range |  |
| `chars/human_down` | adult | 73 | 4 | 1.09 | 1+ | in range |  |
| `chars/human_fell_back` | adult | 99 | 4 | 1.09 | 1+ | in range |  |
| `chars/human_fell_front` | adult | 110 | 4 | 1.15 | 1+ | in range |  |
| `chars/human_fell_left` | adult | 114 | 4 | 1.22 | 1+ | in range |  |
| `chars/human_guard_back` | adult | 96 | 4 | 1.06 | 1+ | in range |  |
| `chars/human_guard_front` | adult | 99 | 4 | 1.03 | 1+ | in range |  |
| `chars/human_guard_left` | adult | 96 | 4 | 1.03 | 1+ | in range |  |
| `chars/human_hardened-leathers_down` | adult | 67 | 4 | 1 | 1+ | in range |  |
| `chars/human_hardened-leathers_left` | adult | 69 | 4 | 1.03 | 1+ | in range |  |
| `chars/human_hardened-leathers_up` | adult | 72 | 4 | 1.07 | 1+ | in range |  |
| `chars/human_hit_back` | adult | 97 | 4 | 1.07 | 1+ | in range |  |
| `chars/human_hit_front` | adult | 101 | 4 | 1.05 | 1+ | in range |  |
| `chars/human_hit_heavy_back` | adult | 98 | 4 | 1.08 | 1+ | in range |  |
| `chars/human_hit_heavy_front` | adult | 103 | 4 | 1.07 | 1+ | in range |  |
| `chars/human_hit_heavy_left` | adult | 99 | 4 | 1.06 | 1+ | in range |  |
| `chars/human_hit_left` | adult | 100 | 4 | 1.07 | 1+ | in range |  |
| `chars/human_jump_back` | adult | 98 | 4 | 1.08 | 1+ | in range |  |
| `chars/human_jump_front` | adult | 96 | 4 | 1 | 1+ | in range |  |
| `chars/human_jump_left` | adult | 96 | 4 | 1.03 | 1+ | in range |  |
| `chars/human_land_back` | adult | 96 | 4 | 1.06 | 1+ | in range |  |
| `chars/human_land_front` | adult | 96 | 4 | 1 | 1+ | in range |  |
| `chars/human_land_hard_back` | adult | 99 | 4 | 1.09 | 1+ | in range |  |
| `chars/human_land_hard_front` | adult | 98 | 4 | 1.02 | 1+ | in range |  |
| `chars/human_land_hard_left` | adult | 98 | 4 | 1.05 | 1+ | in range |  |
| `chars/human_land_left` | adult | 98 | 4 | 1.05 | 1+ | in range |  |
| `chars/human_left` | adult | 69 | 4 | 1.03 | 1+ | in range |  |
| `chars/human_lift_back` | adult | 139 | 4 | 1.54 | 1+ | in range |  |
| `chars/human_lift_front` | adult | 142 | 4 | 1.48 | 1+ | in range |  |
| `chars/human_lift_left` | adult | 134 | 4 | 1.44 | 1+ | in range |  |
| `chars/human_pickup_back` | adult | 96 | 4 | 1.06 | 1+ | in range |  |
| `chars/human_pickup_front` | adult | 96 | 4 | 1 | 1+ | in range |  |
| `chars/human_pickup_left` | adult | 96 | 4 | 1.03 | 1+ | in range |  |
| `chars/human_push_back` | adult | 97 | 4 | 1.07 | 1+ | in range |  |
| `chars/human_push_front` | adult | 96 | 4 | 1 | 1+ | in range |  |
| `chars/human_push_left` | adult | 96 | 4 | 1.03 | 1+ | in range |  |
| `chars/human_quarry_back` | adult | 97 | 4 | 1.07 | 1+ | in range |  |
| `chars/human_quarry_front` | adult | 96 | 4 | 1 | 1+ | in range |  |
| `chars/human_quarry_left` | adult | 114 | 4 | 1.22 | 1+ | in range |  |
| `chars/human_reed-walker_down` | adult | 68 | 4 | 1.01 | 1+ | in range |  |
| `chars/human_reed-walker_left` | adult | 71 | 4 | 1.06 | 1+ | in range |  |
| `chars/human_reed-walker_up` | adult | 72 | 4 | 1.07 | 1+ | in range |  |
| `chars/human_run_back` | adult | 106 | 4 | 1.17 | 1+ | in range |  |
| `chars/human_run_front` | adult | 101 | 4 | 1.05 | 1+ | in range |  |
| `chars/human_run_left` | adult | 102 | 4 | 1.09 | 1+ | in range |  |
| `chars/human_strike_back` | adult | 96 | 4 | 1.06 | 1+ | in range |  |
| `chars/human_strike_front` | adult | 100 | 4 | 1.04 | 1+ | in range |  |
| `chars/human_strike_left` | adult | 97 | 4 | 1.04 | 1+ | in range |  |
| `chars/human_throw_back` | adult | 97 | 4 | 1.07 | 1+ | in range |  |
| `chars/human_throw_front` | adult | 109 | 4 | 1.14 | 1+ | in range |  |
| `chars/human_throw_left` | adult | 96 | 4 | 1.03 | 1+ | in range |  |
| `chars/human_up` | adult | 84 | 4 | 1.25 | 1+ | in range |  |
| `chars/human_w_down` | adult | 70 | 4 | 1.04 | 1+ | in range |  |
| `chars/human_w_left` | adult | 66 | 4 | 0.99 | 1+ | in range |  |
| `chars/human_w_up` | adult | 78 | 4 | 1.16 | 1+ | in range |  |
| `chars/player_idle_down` | adult | 23 | 1 | 1.37 | 1+ | in range |  |
| `chars/player_left` | adult | 24 | 1 | 1.43 | 1+ | in range |  |
| `chars/player_work_left` | adult | 32 | 1 | 1.91 | 1+ | in range |  |
| `chars/skeleton_carry_back` | adult | 135 | 4 | 1.13 | 1+ | in range |  |
| `chars/skeleton_carry_front` | adult | 130 | 4 | 1.09 | 1+ | in range |  |
| `chars/skeleton_carry_left` | adult | 128 | 4 | 1.07 | 1+ | in range |  |
| `chars/skeleton_fell_front` | adult | 107 | 4 | 0.9 | 1+ | in range |  |
| `chars/skeleton_fell_left` | adult | 111 | 4 | 0.93 | 1+ | in range |  |
| `chars/skeleton_lift_back` | adult | 133 | 4 | 1.12 | 1+ | in range |  |
| `chars/skeleton_lift_front` | adult | 130 | 4 | 1.09 | 1+ | in range |  |
| `chars/skeleton_lift_left` | adult | 127 | 4 | 1.07 | 1+ | in range |  |
| `chars/skeleton_quarry_left` | adult | 112 | 4 | 0.94 | 1+ | in range |  |
| `chars/skeleton_up` | adult | 68 | 4 | 1.01 | 1+ | in range |  |
| `chars/trader` | adult | 23 | 1 | 1.37 | 1+ | in range |  |
| `chars/trader_blink` | adult | 23 | 1 | 1.37 | 1+ | in range |  |
| `chars/woman_idle_down` | adult | 23 | 1 | 1.37 | 1+ | in range |  |
| `creatures/crow_idle_left` | bird | 22 | 4 | 0.15 | 0.1 to 0.15 | in range |  |
| `creatures/hare_idle_back` | hen | 31 | 4 | 0.29 | 0.25+ | in range |  |
| `creatures/hare_idle_front` | hen | 23 | 4 | 0.27 | 0.25+ | in range |  |
| `creatures/hare_idle_left` | hen | 28 | 4 | 0.26 | 0.25+ | in range |  |
| `creatures/hare_walk_back` | hen | 33 | 4 | 0.3 | 0.25+ | in range |  |
| `creatures/hare_walk_front` | hen | 25 | 4 | 0.29 | 0.25+ | in range |  |
| `creatures/hare_walk_left` | hen | 27 | 4 | 0.25 | 0.25+ | in range |  |
| `creatures/roe` | - | 66 | 4 | 0.99 | no rule | no rule |  |
| `creatures/roe_idle_back` | - | 88 | 4 | 1.37 | no rule | no rule |  |
| `creatures/roe_idle_front` | - | 71 | 4 | 1.19 | no rule | no rule |  |
| `creatures/roe_idle_left` | - | 64 | 4 | 0.96 | no rule | no rule |  |
| `creatures/roe_walk_back` | - | 85 | 4 | 1.33 | no rule | no rule |  |
| `creatures/roe_walk_front` | - | 68 | 4 | 1.14 | no rule | no rule |  |
| `creatures/roe_walk_left` | - | 64 | 4 | 0.96 | no rule | no rule |  |
| `creatures/sparrow_idle_front` | bird | 21 | 4 | 0.13 | 0.1 to 0.15 | in range |  |
| `creatures/sparrow_idle_left` | bird | 21 | 4 | 0.13 | 0.1 to 0.15 | in range |  |
| `creatures/sparrow_walk_front` | bird | 22 | 4 | 0.14 | 0.1 to 0.15 | in range |  |
| `creatures/sparrow_walk_left` | bird | 24 | 4 | 0.14 | 0.1 to 0.15 | in range |  |
| `creatures/trout_idle_back` | - | 30 | 4 | 0.43 | no rule | no rule |  |
| `creatures/trout_idle_front` | - | 30 | 4 | 0.44 | no rule | no rule |  |
| `creatures/trout_idle_left` | - | 13 | 4 | 0.19 | no rule | no rule |  |
| `creatures/trout_walk_back` | - | 30 | 4 | 0.43 | no rule | no rule |  |
| `creatures/trout_walk_front` | - | 30 | 4 | 0.44 | no rule | no rule |  |
| `creatures/trout_walk_left` | - | 13 | 4 | 0.19 | no rule | no rule |  |
| `creatures/wolf_idle_back` | wolf | 86 | 4 | 1.28 | 0.55+ | in range |  |
| `creatures/wolf_idle_front` | wolf | 59 | 4 | 0.88 | 0.55+ | in range |  |
| `creatures/wolf_idle_left` | wolf | 47 | 4 | 0.7 | 0.55+ | in range |  |
| `creatures/wolf_walk_back` | wolf | 84 | 4 | 1.25 | 0.55+ | in range |  |
| `creatures/wolf_walk_front` | wolf | 59 | 4 | 0.88 | 0.55+ | in range |  |
| `creatures/wolf_walk_left` | wolf | 46 | 4 | 0.69 | 0.55+ | in range |  |
| `props/broken_statue` | standing stone | 153 | 4 | 2.28 | 1.5+ | in range |  |
| `props/bush_berry` | bush | 63 | 4 | 0.94 | 0.5+ | in range |  |
| `props/bush_berry_b` | bush | 63 | 4 | 0.94 | 0.5+ | in range |  |
| `props/bush_berry_c` | bush | 64 | 4 | 0.96 | 0.5+ | in range |  |
| `props/bush_empty` | bush | 42 | 4 | 0.63 | 0.5+ | in range |  |
| `props/campfire_lit` | - | 58 | 4 | 0.87 | no rule | no rule |  |
| `props/campfire_lit_b` | - | 55 | 4 | 0.82 | no rule | no rule |  |
| `props/campfire_lit_c` | - | 61 | 4 | 0.91 | no rule | no rule |  |
| `props/campfire_unlit` | - | 51 | 4 | 0.76 | no rule | no rule |  |
| `props/canopy_1` | - | 32 | 1 | 1.91 | no rule | no rule |  |
| `props/canopy_2` | - | 32 | 1 | 1.91 | no rule | no rule |  |
| `props/canopy_3` | - | 32 | 1 | 1.91 | no rule | no rule |  |
| `props/chest` | - | 32 | 4 | 0.48 | no rule | no rule |  |
| `props/counter` | - | 66 | 4 | 0.99 | no rule | no rule |  |
| `props/dig_spot` | - | 34 | 4 | 0.51 | no rule | no rule |  |
| `props/door_mat` | - | 26 | 4 | 0.39 | no rule | no rule |  |
| `props/fallen_branches` | - | 64 | 4 | 0.96 | no rule | no rule |  |
| `props/fence` | - | 48 | 4 | 0.72 | no rule | no rule |  |
| `props/fence_post` | - | 64 | 4 | 0.96 | no rule | no rule |  |
| `props/flour_sack` | - | 54 | 4 | 0.81 | no rule | no rule |  |
| `props/flowers` | tall grass | 22 | 4 | 0.33 | 0.25+ | in range |  |
| `props/flowers_blue` | tall grass | 53 | 4 | 0.79 | 0.25+ | in range |  |
| `props/flowers_white` | tall grass | 22 | 4 | 0.33 | 0.25+ | in range |  |
| `props/fog` | - | 25 | 1 | 1.49 | no rule | no rule |  |
| `props/glow_mushrooms` | - | 64 | 4 | 0.96 | no rule | no rule |  |
| `props/grass_tall` | tall grass | 31 | 4 | 0.46 | 0.25+ | in range |  |
| `props/grass_tall_b` | tall grass | 64 | 4 | 0.96 | 0.25+ | in range |  |
| `props/grass_tall_c` | tall grass | 64 | 4 | 0.96 | 0.25+ | in range |  |
| `props/hazard_pit` | - | 54 | 4 | 0.81 | no rule | no rule |  |
| `props/hazard_trap` | - | 56 | 4 | 0.84 | no rule | no rule |  |
| `props/hazard_wolf` | wolf | 12 | 1 | 0.72 | 0.55+ | in range |  |
| `props/hearth` | - | 172 | 4 | 2.57 | no rule | no rule |  |
| `props/herb_plant` | - | 64 | 4 | 0.96 | no rule | no rule |  |
| `props/herb_plant_b` | - | 64 | 4 | 0.96 | no rule | no rule |  |
| `props/herb_plant_c` | - | 64 | 4 | 0.96 | no rule | no rule |  |
| `props/house_small` | house | 209 | 4 | 3.12 | 3+ | in range |  |
| `props/jar_shelf` | - | 101 | 4 | 1.51 | no rule | no rule |  |
| `props/lantern_post` | street lamp | 192 | 4 | 2.87 | 2+ | in range |  |
| `props/log_fallen` | - | 41 | 4 | 0.61 | no rule | no rule |  |
| `props/log_mossy` | - | 35 | 4 | 0.52 | no rule | no rule |  |
| `props/market_stall` | market stall | 175 | 4 | 2.61 | 2+ | in range |  |
| `props/mushroom_crate` | - | 58 | 4 | 0.87 | no rule | no rule |  |
| `props/mushroom_patch` | - | 43 | 4 | 0.64 | no rule | no rule |  |
| `props/mushrooms_small` | - | 64 | 4 | 0.96 | no rule | no rule |  |
| `props/pear_barrel` | - | 65 | 4 | 0.97 | no rule | no rule |  |
| `props/pebbles` | - | 53 | 4 | 0.79 | no rule | no rule |  |
| `props/potted_herb` | - | 46 | 4 | 0.69 | no rule | no rule |  |
| `props/reeds` | tall grass | 64 | 4 | 0.96 | 0.25+ | in range |  |
| `props/rock_mossy` | - | 53 | 4 | 0.79 | no rule | no rule |  |
| `props/rock_small` | - | 37 | 4 | 0.55 | no rule | no rule |  |
| `props/rock_stones` | - | 49 | 4 | 0.73 | no rule | no rule |  |
| `props/room_wall_left` | - | 189 | 4 | 2.82 | no rule | no rule |  |
| `props/room_wall_right` | - | 189 | 4 | 2.82 | no rule | no rule |  |
| `props/rubble` | - | 54 | 4 | 0.81 | no rule | no rule |  |
| `props/ruin_arch` | - | 110 | 4 | 1.64 | no rule | no rule |  |
| `props/ruin_pillar` | standing stone | 115 | 4 | 1.72 | 1.5+ | in range |  |
| `props/ruin_wall` | - | 88 | 4 | 1.31 | no rule | no rule |  |
| `props/runner` | - | 256 | 4 | 3.82 | no rule | no rule |  |
| `props/sapling` | sapling | 60 | 4 | 0.9 | 1+ | in range |  |
| `props/scale` | - | 34 | 4 | 0.51 | no rule | no rule |  |
| `props/shelf` | - | 64 | 4 | 0.96 | no rule | no rule |  |
| `props/shop_cat` | hen | 30 | 4 | 0.45 | 0.25+ | in range |  |
| `props/shop_sign_food` | - | 61 | 4 | 0.91 | no rule | no rule |  |
| `props/shop_window` | - | 74 | 4 | 1.1 | no rule | no rule |  |
| `props/sign` | - | 48 | 4 | 0.72 | no rule | no rule |  |
| `props/standing_stone` | standing stone | 99 | 4 | 1.48 | 1.5+ | in range |  |
| `props/statue_head` | - | 110 | 4 | 1.64 | no rule | no rule |  |
| `props/stump` | - | 44 | 4 | 0.66 | no rule | no rule |  |
| `props/totem` | standing stone | 116 | 4 | 1.73 | 1.5+ | in range |  |
| `props/well_old` | - | 120 | 4 | 1.79 | no rule | no rule |  |
| `props/well_old_b` | - | 128 | 4 | 1.91 | no rule | no rule |  |
