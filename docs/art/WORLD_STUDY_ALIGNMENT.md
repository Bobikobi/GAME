# World-study alignment audit — 2026-10-27

Owner verdict: the paving, viewing distance, camera angle and character in the
full-area capture do not match the new design rules. This verdict overrides any
impression that the full-area capture represents the approved game look. The
approved sea and original oak are reusable components, not approval of the scene.

Audited study baseline: `2c0452ea9`, branch `art/rich-opening-ground`. Reads of
other branches/worktrees were read-only. Do not redesign geography here: the
owner assigned it to another agent.

| Area | Existing fixture | Verified target and source | Next integration requirement |
|---|---|---|---|
| Paving | Reused city/ruin texture fields placed as isolated sample patches; no approved place card | `docs/art/PLACE_LOOK.md` (`origin/develop`, #366); `docs/pre-rich-inventory:docs/art/PRE_RICH_REDRAW.md`, rows 22 and 27: town cobble follows the first map plan, ruin floor has no picked still | Wait for the place plan and reviewed materials; reuse existing candidates, but do not infer approval from valid colours or seamless edges. Do not invent another regional layout. |
| Viewing distance | Fixture defaults to zoom 1, toggle 2; overview capture was manually set to 0.75 | `origin/develop:DECISIONS.md`, 2026-10-25 “The camera comes closer; the character is the measure; tall props grow to the table”; `docs/next-motion-points:docs/team/NEXT.md`, `camera-closer` | Port the approved device-pixel zoom rule, not the overview zoom. Production coordinates use 16 units/tile, this fixture 64: convert by four. The approved examples are 12 production units on a 3× phone and 8 on a 1× desktop, equivalent to 3 and 2 device pixels/art pixel. Account for canvas DPR and resize. Do not enlarge the actor to fake a closer camera. |
| Camera angle | Flat sprite fixture with no evidence that the placeholder was rendered at the chosen elevation | `docs/next-motion-points:DECISIONS.md`, 2026-10-26 “Everything that moves is rendered at a 50 degree camera” | Adopt correctly rendered 50° sprites, including directional motion. A Phaser zoom or a rotation of the flat canvas cannot change a sprite's elevation. Rotation/HD-2D remain deferred by the separate 2026-10-26 decision on develop. |
| Character | `content/kit/core/chars/player_down.png`, 16×24 frame, scaled ×4; three downward frames for every movement direction | `docs/race-picks:DECISIONS.md`, 2026-10-27: human A, elf E4-A v3, skeleton round-2 B; approved reference frames are retained on that branch | Consume the race pipeline's reviewed sheets, correct origins, native body size, directional selection and distance-based stride. Do not substitute an enlarged old sprite or a cropped concept still. |

## Active parallel work, observed during this audit

`pnpm streams` was run. `docs/next-motion-points` remains a separate stream (#348).
The `feat-races-in-game` worktree has uncommitted changes to the race records,
render settings, character rendering, stride/sheet tooling and related checks.
Its anim configuration already declares `elev: 50`; that alone does not prove
that its outputs and runtime integration are complete or approved. Leave those
files and caches with that session. `docs/race-picks` preserves the owner's choices.

## Correct the reference, then integrate

The public study heading now calls it a material laboratory and explicitly says
its camera, character and paving are not the approved game presentation. The
overview capture is historical diagnostic evidence. Ground review records retain
the owner's rejection alongside the earlier test results; passing tests were
technical evidence, never a visual acceptance verdict.

The next valid whole-area presentation must combine the approved close-camera
framing and 50° race output with a place-specific material selection. Capture at
phone and desktop sizes, walk against roots and behind foliage, and inspect actual
ground/foot motion. Keep the approved water. Do not label a new whole-area capture
aligned while any of these four rows is still unresolved.

The family validator added in this branch checks registered sprite bytes,
palettes, frame sizes and explicit selections. It does **not** prove scene camera
settings, render elevation, actor identity or the suitability of a paved region.
Those gaps are not solved by its passing result.

## Continuation — 2026-10-28

The original audit and owner rejection above remain the historical baseline.
This continuation resolves the fixture's camera and old-player integration gaps:

- The default close view follows `4 * ceil(1.5k)` in production's 16-unit grid,
  divided by four in the fixture's 64-unit grid. The canvas uses device pixels;
  resizing and a DPR change retain the selected close/wide mode. The wide mode
  is labelled as a material-comparison aid.
- The actor reuses the picked human A sheets from `feat/races-in-game` at
  `d6e324803`, rendered at 50 degrees. Its 128px frame stays at scale 1, with
  ground anchor [64,90]. All three source views and right-facing mirroring are
  used. Strides follow actual collision-resolved distance; blocked walking uses
  the standing pose. Hashes, source metadata and attribution are retained in
  `docs/design/frames/rich-world-character-2026-10-28/`.
- Sand relief was edited from the retained source with the built-in image tool,
  then imported through the existing fill/border pipeline. Its source, exact
  prompt, derivative and unused palette trial are retained separately in
  `docs/design/frames/rich-world-ground-2026-10-28/`. This is material polish for
  review, not acceptance of a beach family or a new place.

Live refresh found that the close-camera change has now landed on develop as
`c47f1c7f4` (#390), with the same rule. The owner also picked the first-map plan A
(`#394`, `e612194b3`, `docs/design/FIRST_MAP.md`). That plan's snowy mountains,
far-bank human city and faint paths outside the opening belong to the geography
stream. This continuation leaves the fixture's land, routes and placements alone.
The plan pick does not approve the fixture's isolated paving samples.

Paving/place composition still needs its place-specific review. Only the reused
actor has verified 50-degree render provenance; a camera zoom does not certify
the elevation of every retained tree or material. The source race pipeline also
records discrete-pose foot swing between samples; importing its sheets does not
claim to remove that limitation. The whole fixture remains a material laboratory.

Current direct browser captures and the review page are served from
`game/public/art-review/world-2026-10-28/`. Their checks and limits are recorded in
`docs/design/frames/rich-world-continuation-2026-10-28/README.md`.
