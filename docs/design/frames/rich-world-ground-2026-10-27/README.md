# Loomvale — connected ground expansion, 2026-10-27

Continues the approved RICH world and tree collision checkpoint (`5e4d6569`) in the same authorized checkout and branch. This is the ground stage, ahead of a general vegetation library. The later vegetation library remains queued: reuse the existing trees, leaves, flowers, shrubs, grass and reeds first, then generate named gaps at its own stage. The site rename has already landed in `origin/develop` as `87cdc182`; this work does not duplicate that stream.

## Built

Three existing ground fields become a warm paved clearing, a worn stone clearing and a quiet inland sand patch inside the existing navigable sample. A three-tile spur joins the worn area to the main path; a four-tile branch continues south to the sand. Three new view buttons jump to the added ground patches. The original meadow, woodland, path, gravel banks and water remain present. No production map, quests, NPCs, rewards or story are added.

The world layout declares material regions. Rounded patch contours and the imported texture's own detail drive a four-step transition into surrounding ground. Stone patches take priority over the path inside them, so the route arrives at the paving instead of painting an earth stripe over it. Tall grass is omitted from the paving interiors. Land and collision masks remain independent of material colour.

## Reuse and repetition

`reuse-review.json` records exact existing sources, hashes, original prompts and agent choices separately from owner approval. `paving.png` and `worn.png` are reproducible derivatives of already committed raw fields. `sand-source.png` is an exact preserved raw draft from the earlier tile work, with its old64px derivative and successful generation record beside it; `sand.png` uses the existing importer with ordered dithering to preserve more of its subtle tone changes. Run `pnpm exec tsx tools/src/kit/import-world-ground-materials.ts` to reimport. The original paving and worn source files remain untouched in `../rich-world-2026-10-25/`.

Whole 128px fields stay registered. Only the opposite eight-pixel border strips are reconciled and palette-snapped, using the same helper as the earlier ground importer. A reflected-repeat trial was discarded after browser inspection because it made the worn stone too symmetrical. No new images or organic motifs were generated or drawn in code. The old five-field/tree importer was rerun after extracting the helper; its tracked image/report outputs did not change.

## Review and limits

Desktop and phone captures are beside this file. Use the `ריצוף` and `ריצוף שחוק` buttons at http://127.0.0.1:5189/world-study.html. These are ground material tests, not finished designed places: buildings, architecture, terrain height, other shore families and general vegetation-library work retain their own later stages. The ground fields still repeat over larger distances; this iteration proves connected material patches and seam handling, not an endless finished biome.

Checks are recorded in `review.json`. Visual acceptance of these added ground materials remains with the owner.

## Sand follow-up

The quiet inland sand patch uses an already-generated raw source from `art/tiles-64`, preserving its original bytes and manifest here. It is not a new beach family: the approved shoreline atlas and wave renderer were not replaced. The importer checks an opaque fill and zero border mismatches. The standard tile vote flattened much of the source contrast; the existing `importSprite` ordered dither retains ten palette colours in the study. The source still has subtler sand relief than the style goal; further sand relief is a named polish gap, not a claim of finished terrain. No new image calls were made.

A browser flood fill over the actual land and tree-footprint query reached 23,230 feet positions and all seven review viewpoints from the spawn. The phone navigation was tapped through the browser and checked for horizontal overflow.
