# Inland sand relief polish, 2026-10-28

This continues the existing RICH material laboratory. One built-in image-generation edit used the preserved 2026-10-27 sand source, strengthening its broken diagonal ripple bodies while retaining its warm ground and small pebbles. The square now fills its frame. No geography, shoreline, water, paving, vegetation or character assets changed in this material work.

`sand-source.png` is the untouched generated output; `sand-prompt.txt` is the exact edit prompt. `reuse-review.json` preserves the tool output metadata, target hash, source and derivative hashes, and the agent's review. The previous raw source, imported sand, and import report remain byte-identical in the 2026-10-27 folder.

`sand.png` is the 128px field consumed by the study. The existing fill importer and eight-pixel border reconciliation are used. Sand's palette is restricted to the existing earth and stone colours plus neutral glints, because the first conversion with every core colour turned warm crests pink. That comparison derivative remains as `sand-full-palette-candidate.png` and is not loaded by the scene. No organic motifs were painted in code.

Reproduce with `pnpm exec tsx tools/src/kit/import-world-ground-materials.ts`. The current import record is `imports.json`; the earlier record is preserved. The paving and worn fields regenerate byte-identically. `validation.json` records opaque fields, palette membership, hashes, matching opposite borders and unchanged previous bytes. The existing repeating-field test passed.

These are study materials pending owner review. One 128px field still repeats over large areas. A readable inland sand texture does not approve paving, a new beach family, geography or the presentation of the whole game.

## Browser refinement

The first combined browser capture showed that the first imported edit still flattened much of the raw relief. A second built-in edit made the broad lit and shaded planes use the established earth ramp directly, with less fine grain. The original edit and its derivative remain above as comparison material; the scene now consumes `sand-v2.png`, made from `sand-source-v2.png`. `sand-prompt-v2.txt` is the exact prompt; `refinement.json` carries source/output hashes, tool metadata, agent review and pixel validation. The current reproducible import report is `imports-v2.json` (the previous report remains unchanged). Two image-edit calls were used in this unit. No source image was overwritten.

Combined browser captures are served directly from `game/public/art-review/world-2026-10-28/`; the continuation's README records the final checks.
