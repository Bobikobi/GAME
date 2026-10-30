# Triage of the restored art pool, 2026-10-30

The four restored draft folders (props wave 1, tiles 64, the ground-64 woodland bank, the Codex rich-opening folder) were swept once. This is a **suggestion** by an agent, made on the owner's instruction "sort what in your judgment passes, based on what I approved" (relayed 2026-10-30). Nothing here is owner-approved, nothing enters the live kit, and every review line says so in `review_by`.

## Where things are

- **The pictures** are in the private repo `Bobikobi/GAME-art-drafts`, one release per source (`run-backfill-art-props-wave-1`, `run-backfill-art-tiles-64`, `run-backfill-codex-rich-opening`; the ground-64 bank and the earlier runs were already stored by the 27.10 back-fill). Identical bytes are one draft; the index keeps every source that made it.
- **The decisions** are in `tools/kit-gen/drafts.jsonl`, as amendment lines: `review` (keep, reuse-parts, rework, archive), `review_by`, and `review_note`, which reads `[family=...; group=...; tags=...; sheet=group:number] reason`. The index has no field for family or tag yet, so they live in the note; a field is a small schema change for a later PR if wanted.
- **The sheets** are the PNGs beside this file, one group each, 800 px wide, in pages. A border says the status: green keep, yellow reuse-parts, orange rework, red archive. `legend.json` maps `group:number` (the yellow number on a sheet) to the draft id.

## Counts

Files found in the four folders: 2983 images, 1570 with different bytes. Of those, 764 are drafts (a raw picture, with its import when there is one) and are triaged below. The rest are references fed to the models (239), screenshots and recorded frames of the game (151), and five resnapped imports of scene crops, all derivatives that stay in their folders. The 623 audit candidates of 26.10 are covered: 618 are drafts below, the other five are those resnaps.

| Group | Drafts | keep | reuse-parts | rework | archive |
|---|---|---|---|---|---|
| characters and worn pieces | 56 | 44 | 6 | 0 | 6 |
| props, trees and statues (props wave 1) | 228 | 95 | 10 | 73 | 50 |
| items, inn and tents | 31 | 25 | 0 | 3 | 3 |
| ground tiles and rich-opening ground sources | 57 | 13 | 12 | 13 | 19 |
| woodland bank (stones, statues, trees, plants) | 82 | 75 | 2 | 4 | 1 |
| walk-cycle renders (310 frames, one item) | 310 | 310 | 0 | 0 | 0 |
| **all** | **764** | **562** | **30** | **93** | **79** |

## Rules applied

1. **Mechanical.** `pnpm art:measure` limits for a sprite (palette of the shared ramps within 2%, at least five colours, detail between flat and noise, at most six pieces, stands on its tile) and for a ground tile (seam, echo, detail). A sprite icon or scatter is not held to the foot rule. A failure makes the draft `rework`, with the numbers in the note, unless the sheet shows a worse fault.
2. **The owner's recorded direction.** Rich 64 look; olive and earth ground, not clean green (green grass, forest-green meadow and the clean-green sources are `archive`); no hard seams; no shadow drawn into a sprite; the old campfire is `archive`; a whole-scene crop is not a sprite; a sprite under a third of its spec size is superseded by the rich one beside it; the repeated small trees the owner rejected on 26.10 are `rework`.
3. **Room for all the good ones.** Variants that pass are all kept, not one per subject, so the per-place variants of decision 8 (22.10) have a pool.
4. **Characters.** A clean character that failed its brief is `keep` with the tag `future-npc` (owner, 26.10). A worn piece (pack, quiver, satchel) is `reuse-parts`.
5. **Parts.** `reuse-parts` names the part in its reason (a flame, a cracked head, loose leaves, an earth path source).
6. **Walk renders.** 310 raw 3D frames are one item (`walk-forager-render`), kept as the source of the pixel walk; the forager race is retired.

6. **Size against the entry.** The measure ran at each picture's own canvas, not at the pool entry's size. A `keep` here is not proof that the picture fits an entry: the pool drafts of `lantern_post` (64x128 against 64x192), `broken_statue` (64x128 against 64x160), `market_stall` (128x128 against 128x192) and `house_small` (192x192 against 192x320) are good looks on a short canvas, and `art:measure` would refuse them for the entry.

Sheets are read by eye at 800 px; an agent's read of a 64 px sprite is rough, so the yellow and orange are the ones to check first.
