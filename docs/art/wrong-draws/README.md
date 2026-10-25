# Wrong-object draws

A draw that came out as a different object than the one asked for is never thrown away (DECISIONS 2026-10-23, the owner's word). It is kept here for possible future use, with a one-line note of what it looks like and where it came from.

This folder is not part of the kit: the game does not load it, and `pnpm check` (the 16 px and rich checks) does not read it. To use a draw from here, import it into `content/kit/core` through the kit pipeline like any other sprite.

Every PNG is the 64x64 import the run produced, in the core palette plus the ramps of the entry it was drawn for. `library.jsonl` holds one line per file: what was asked, what it looks like, and its provenance (model, seed, round, spec ramps, the prompt).

| File | Asked for | Looks like | Model, seed, round |
| --- | --- | --- | --- |
| branch-sdxl-r4-s44.png | a single bare stick | a cutting board with a fork | SDXL + pixel-art-xl, seed 44, round 4 |
| branch-qwen-r5-s1.png | a single bare stick | two forked sticks crossed in an X | Qwen-Image 2512, seed 1, round 5 |
| branch-qwen-r5-s2.png | a single bare stick | a long stick with a three-pronged fork at one end, like a pitchfork | Qwen-Image 2512, seed 2, round 5 |
| hazard_pit-sdxl-r4-s41.png | a dark pit hole in the ground | a round wall of something ruined | SDXL + pixel-art-xl, seed 41, round 4 |
| rock_mossy-sdxl-r4-s43.png | a grey boulder with moss on top | a green lump with stones | SDXL + pixel-art-xl, seed 43, round 4 |
| sapling-sdxl-r4-s41.png | a young tree sapling | an ornamental pot plant for a festive place or indoors | SDXL + pixel-art-xl, seed 41, round 4 |
| campfire_unlit-sdxl-r3-s23.png | an unlit campfire | a campfire, lightly lit and much browner | SDXL + pixel-art-xl, seed 23, round 3 (the kit's unlit campfire until 2026-10-23) |
