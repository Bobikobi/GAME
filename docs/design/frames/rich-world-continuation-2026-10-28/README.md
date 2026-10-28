# Connected world continuation — 2026-10-28

Continues `art/rich-opening-ground` at `dac30f433`. The existing sea, original
oak family, land, routes and placements are retained. This is the connected
material laboratory, not approval of the production map or paving.

The close-camera rule matches the approved production rule that landed in
`c47f1c7f4` (#390): device pixels, whole art pixels, `ceil(1.5k)` in this
fixture's 64-unit grid. A labelled wider material view remains available.
Resizing and a change of display density retain the selected view. A cheap DPR
check during updates covers displays/emulation that omit resize/media events.

The actor uses byte-identical picked human A sheets from `feat/races-in-game`
at `d6e324803`, rendered at 50 degrees, at native scale 1 with the authored
[64,90] ground anchor. Direction and walking poses follow actual movement after
collision; a blocked step stands still. Source, hashes and attribution are in
[`../rich-world-character-2026-10-28/`](../rich-world-character-2026-10-28/README.md).
The source's discrete-pose foot swing remains its documented limitation.

Sand polish uses two built-in image edits of the preserved source. The first
combined browser capture exposed flattened relief in the imported field; the
second edit separates broad lit/shaded planes in the established earth ramp.
The existing importer and border reconciliation produce the final 128px field.
Both raw edits, derivatives, exact prompts and the unused palette trial remain
in [`../rich-world-ground-2026-10-28/`](../rich-world-ground-2026-10-28/README.md).
The final recipe and checks are `imports-v2.json` and `refinement.json` there.

## Browser proof

Direct screenshots and a JavaScript-independent review page are committed under
`game/public/art-review/world-2026-10-28/`. The desktop captures show the actual
1440×900 browser; the phone capture uses 390×844 CSS pixels at DPR 3. Lighting,
root collision, canopy see-through, vegetation, water and the actor share the
same scene. Frames are technical/visual evidence, not an owner acceptance record.

Run `pnpm exec tsx game/e2e/world-study.ts` for the focused browser check; it
starts its own Vite server on a free port and releases it afterward.
`WORLD_STUDY_URL` may instead point at an existing server, and
`WORLD_STUDY_FRAMES` optionally selects a screenshot directory. The check covers
close/wide framing, DPR changes, resize/rotation, CSS-pointer walking, native
actor geometry, seven review viewpoints, four-sided root collision, a blocked
stride, walk-behind space, reduced motion and browser errors.

Final validation is recorded in `review.json`. The ordinary game has its own
`pnpm e2e` run; these fixture checks do not replace that run.

The ordinary `pnpm e2e` run failed in the phone opening with
`could not stand on 36,31 facing right for core/ruins-hall#3`. It stopped before
the later e2e groups. The normal opening, map, walking engine and kernel have no
changes in this unit. This failure is retained as a separate limitation, not
reported as a passing production browser run.

The final full `pnpm verify` uses `VITEST_MAX_WORKERS=4` and a dedicated `TMPDIR`
outside the repository. Other simultaneous worktrees caused a shared-temp count
failure and three 30-second timeouts in an earlier run. Keeping the temp directory
outside Git also preserves the hub test's deliberate no-history environment.
No test isolation, assertion, timeout or repository test configuration was relaxed.

## Remaining alignment

The first-map plan A is now picked (#394, `e612194b3`), with snowy mountains,
the human city across the bay and faint traces outside the opening. Its geography
belongs to the separate map stream. This material fixture does not redraw it.
Paving/place composition needs its own place-specific review. Only the reused
actor has verified 50-degree render provenance; zoom does not certify every
retained prop's elevation. A repeating sand field does not prove a finished
shoreline family or an endless biome. See `docs/art/WORLD_STUDY_ALIGNMENT.md`.
