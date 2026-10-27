# Executable sprite-family checks

`PLACE_LOOK.md` describes a place. `docs/art/families/*.json` registers the actual
sprite families being checked. Start with an existing approved family and reuse
its assets before drawing. The first fixture is `rich-world-oak`: the original
detailed oak is the owner's anchor; the broader rejected oak stays as a comparison.
This is study coverage, not a new geography plan or production-map approval.

## Run it

```sh
pnpm check
pnpm exec tsx tools/src/art/cli.ts
pnpm exec tsx tools/src/art/cli.ts --out game/public/art-review
```

The first command includes hard family failures in the usual check (and therefore
`pnpm verify`). Comparison warnings, including known rejected examples, stay in the dedicated art report. The second command emits JSON without writing anything. The third also
builds self-contained HTML sheets and `report.json`, one directory per family.
With the study server running, open `/art-review/rich-world-oak/index.html`.
Reports are disposable generated output; edit the manifest, never the report.
The HTML contains existing image bytes. It neither generates art nor recolours it.

## Data and algorithm

`tools/src/art/family.ts` parses the versioned records before reading images.
Unknown ramps, duplicate asset ids, unknown scene selections, invalid dimensions,
missing ownership/style fields and malformed review states fail. All source,
provenance and evidence paths must resolve inside this checkout, including symlinks.

For every registered asset, the checker:

1. Reads the PNG and compares its SHA-256 to the revision named in the record.
   Changed bytes invalidate the recorded revision even when colours and size match.
2. Compares the actual frame with the declared frame, rejects empty sprites and
   partial alpha, and checks every visible RGB against core colours plus the
   family's at-most-six existing shared ramps. RGB below zero alpha is ignored.
3. Requires owner approval for the anchor and every `sceneAssets` entry. `rework`
   and `unreviewed` candidates remain available for comparison, never selection.
   Evidence must exist. The checker validates declarations; it cannot authenticate
   a human decision. Agents must not manufacture owner approval or refresh a hash
   to conceal a changed drawing.
4. Measures the opaque bounding-box aspect ratio, opaque fill, colour count and
   colour-edge density (different-colour horizontal/vertical opaque neighbours
   divided by all opaque neighbour pairs). It compares aspect and edge density
   with the anchor using `max(a,b)/min(a,b)`. Empty images fail before comparison.
5. Emits structured findings with asset id, code, severity and explanation. Hard
   failures return exit code 1. Shape/detail deviations are warnings requiring
   visual comparison; they do not approve or reject an artistic direction.

The oak's warning ratios (1.3 aspect, 1.5 edge density) are provisional review
thresholds tested against one known rejected candidate, not learned universal
style limits. Native pixel resolution, dithering, silhouette and subject all affect
these measurements. A matching score cannot prove matching leaf clusters, camera
angle or quality. Do not compare different plant species as if they were oak
variants; each coherent family needs its own anchor. Extend metrics only against
documented positive and negative examples, retaining the manual scene check.

## Data used by the scene

`game/src/world-study-tree-family.ts` consumes the same JSON for selected ids,
frame ratio, display heights, permitted width scales, mirroring, origin and root
ellipse. Root values are fractions: offsetY and radiusY of displayed height,
radiusX of displayed width. Existing alpha occlusion and silhouette-shadow code
remain the supported policies. No new tree artwork or map layout is introduced.

The allowed transform list describes the existing study treatment, not approval
for new drawings. A new asset needs provenance, a reviewed hash and evidence before
it can enter `sceneAssets`. The study preload must also include its source folder;
an absent import fails explicitly. Other scenes must adopt a family consumer to
receive this runtime protection; checking this manifest does not scan arbitrary
runtime imports, maps or all drafts automatically.

## Working sequence and evidence

Run `pnpm streams`, read the family's owner/branch, and inspect the relevant draft
index. This prevents accidental duplication where work is visible; the record is
not a cross-session lock. Preserve source/review records under `REUSE.md`.

Build one family at a time: anchor, a small variation set, shared sheet, then live
scene proof. For vegetation, extend to shrubs, ground plants, flowers and leaf
pieces only as their family is needed. Do not claim the collection exists merely
because there is a row for it.

The permanent regression tests include the rejected broad oak (same allowed
palette, different shape/detail), modified approved bytes, forbidden scene
selection, malformed records, colour/alpha/frame failures and collision across
seeded display sizes. Browser proof must still check front/back occlusion, root
collision, facings, contact shadows and phone size. Existing approved forest
captures live in `../design/frames/rich-world-trees-2026-10-26/`.

Shared-check changes should land separately before other streams adopt the data;
this implementation is in the RICH checkout until integrated into develop.
