# Sand and grounded movement correction — 2026-10-29

Continues `c2ba13067` in the existing connected material laboratory. Owner
feedback: the sand looked like small clouds, the character felt pasted onto
the ground, and its animation did not match its movement. Technical checks of
the previous implementation did not establish visual acceptance.

## Changes

- Sand: one built-in image edit of the retained source removes the raised white
  strokes and their dark sidewalls. Pale sand, shallow ochre wind marks and small
  grains replace those shapes. `sand-source.png` and `sand-prompt.txt` preserve
  the exact output and prompt. The existing importer and border reconciliation
  make `sand.png`; `imports.json` records palette, hashes and matching borders.
  Previous sources/derivatives remain untouched.
- Gait: the old implementation reinterpreted all accumulated distance using the
  new direction's stride whenever the character turned. The new gait integrates
  one normalized cycle phase using actual collision-resolved movement, so turns
  preserve the phase. Stops and blocked steps consume no stride.
- Rendered movement: the picked human A model and its existing `Jog_Fwd_Loop`
  action were rendered again at the same 50-degree elevation and native scale.
  Thirty poses plus standing replace ten poses plus standing. Five rendered
  views, with their mirrored counterparts, cover eight directions. Diagonal
  model angles compensate for the ground projection, so they read as screen-plane
  diagonals. Every view has its own measured cycle distance. Playback at this
  fixture's unchanged 125 art px/s stays under 30 poses/s; each strip is 3968px
  wide, within 4096px. Production race sheets and their limits are unchanged.
- Contact: the four-row contact line now follows supporting shoes using the
  renderer's toe positions and alpha, rather than always following the sprite's
  lowest swinging toe. Overlapping contact spans are united before drawing.
  The retained silhouette cast shadow, original trees, water and geography stay.
  The bounded shadow cache now accommodates the denser directional cycle.

## Sources and reproduction

The source checkout is read-only `feat/races-in-game` at the commit and hashes in
`walk-metadata.json`. The model remains the Meshy Forager (CC BY 4.0); library
motion is Quaternius Universal Animation Library (CC0). Attribution is served at
`/art-review/world-character-2026-10-29/index.html`.

```
pnpm exec tsx tools/src/kit/render-world-study-walk.ts <race-checkout> --measure
pnpm exec tsx tools/src/kit/render-world-study-walk.ts <race-checkout>
pnpm exec tsx tools/src/kit/import-world-ground-materials.ts
```

The render adapter checks the retained renderer's SHA-256 and adds view angles
in memory; it never edits the source checkout. It uses two Blender threads.
`render-job.json`, `walk-metadata.json` and `projected-feet.json` retain the
settings, source hashes, final strips and projected geometry needed to reproduce
and inspect the result. The original models/library and renderer remain with
their source commit. Temporary supersampled renders are reproducible derivatives,
not the sole art originals.

A metadata-only `Walk_Loop` trial was rejected: its measured 37–49 art px cycle
would need too few displayed poses at the study's speed under the 30 poses/s
limit. Its job and cycle measurement remain in `walk-short-*`. The existing
jog action was retained and sampled more densely instead; no new body or outfit
was generated.

## Evidence and limits

Direct browser captures, the previous sand capture and a short recording are in
`game/public/art-review/world-2026-10-29/`. Use the explicit `index.html` path.
The recording preserves its actual capture timestamps; 63 source frames span
5.333 seconds. A 30fps video container repeats captured frames as needed and is
not a 30fps gameplay performance claim.

Validation and hashes are in `review.json`. Tests cover cycle continuity on
turns, diagonals, blocked movement, frame partitioning, supporting-foot contact,
non-darkening overlap and the reduced held-pose displacement at 60Hz. Pixel
inspection found a valid supporting-shoe contact in all 248 pose/orientation
combinations, including mirrored views (`contact-check.json`).

This reduces sampled-pose sliding; it does not claim perfect continuous foot
locking. The sprite still uses discrete poses, pointer headings between the
eight views choose the nearest view, and the sand field still repeats. Visual
acceptance remains with the owner. Paving/place composition and production map
integration retain their separate reviews.
