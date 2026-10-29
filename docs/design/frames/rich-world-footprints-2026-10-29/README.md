# Sand footfalls — 2026-10-29

Continues the approved sand/motion result `f7a4d16d6`, recorded as approved in
`6f8c68615`. Footprints in sand, fading after twenty seconds, are the existing
STYLE section 7 cue 4. They are polish inside the picked direction.

The corrected sand, native human, gait phase, directional sheets, water, oak
family, collision and geography are retained. The new trail belongs only to
the connected material laboratory; it does not add gameplay or production map
content, and it does not begin the deferred general vegetation library.

## Behaviour

- Actual collision-resolved displacement and the current supporting-shoe data
  create footfalls. A planted foot stamps once; holding a direction against a
  trunk or standing still does not stamp. A minimum separation prevents repeated
  start/stop marks in place.
- The whole stamp is checked against the existing sand region and land mask.
  Marks are omitted on grass, paths, paving and water, and at an edge too narrow
  to contain the sole. Review shortcuts relocate the tracker without drawing a
  connecting trail or erasing existing marks.
- Marks use four opacity levels and expire at twenty scene seconds. Their clock
  is independent of the ambient water/plant motion toggle, so reduced motion
  does not make them permanent. At most 64 marks/images are retained.
- A layer checkbox hides/restores footprints. They sit below the player and
  existing shadows. Expiry and scene shutdown release their display objects.

The pure footfall/lifetime model is separate from the Phaser image adapter.
The 3D door remains paused by the existing decision: production integration
must carry this cue there with native foot contacts and floor decals, converting
the footprint size from art pixels to world units. This fixture addition does
not claim a game-wide 2D/3D rollout.

## Art and reproduction

The existing kit, art records and retained frame folders were searched for a
footprint/sole asset; no reusable stamp was found. One built-in image-generation
call produced `footprint-source.png`. `prompt.txt` is the exact prompt. The
existing sprite importer removes the background and produces an 8×12 binary-alpha
stamp in one existing sand colour. The engine mirrors and rotates that drawing;
it does not paint an organic sole in code. Sources and agent review are retained
in `reuse-review.json`; `import.json` carries hashes and pixel validation.

```
pnpm exec tsx tools/src/kit/import-world-footprint.ts
```

The new stamp is detail for review, not an owner pick of a different art direction.
The preceding sand and movement approval remains separate and is preserved.

## Proof

`review.json` records final checks. Direct desktop and reduced-motion phone
captures are served from
`/art-review/world-footprints-2026-10-29/index.html`. The dedicated browser check
uses real keyboard/touch walking, checks the trail, layer toggle and bounded
image allocation, then drives the effect clock beyond twenty seconds to verify
resource removal. Pure tests cover all four fade steps and edge rejection.

## Visibility correction after owner review

The owner reported no visible footprints. The initial 32% opacity was too close
to the sand grain. Fresh marks now use 80%, then 60%, 40% and 20%, with the same
twenty-second expiry. No source drawing or approved ground asset changed.
`/world-study.html?view=sand` opens directly on the existing sand viewpoint; the
default spawn remains unchanged. A real keyboard walk and same-frame layer
on/off capture measured 350 visibly darker pixels (at least 30 RGB levels),
rather than relying on display-object counts alone.
