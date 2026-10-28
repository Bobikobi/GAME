# The picked human in the connected material study

These three sheets are byte-identical copies of the human A output on
`feat/races-in-game` at `d6e324803`. The owner picked the human A look on 27 October
2026; that branch's `DECISIONS.md` records the pick and the distance-driven walk.
This is the Meshy forager, rendered at 50 degrees by `tools/anim`, with ten walking
poses followed by the standing pose. `provenance.json` carries hashes, source
paths, render metadata, measured travel per pose and the licence.

The study uses the native 128×128 frame at scale 1, with the recorded ground anchor
at [64,90]. Frame size includes transparent room around the body; enlarging the
character is not how the close-camera rule is implemented. Right mirrors the
reviewed left sheet. Movement is driven by actual collision-resolved distance,
using the source branch's nearest-pose rule, and a blocked walk stands still.

Reuse here completes the fixture's old-player replacement. It does not merge the
race engine or add a new race, and it does not approve paving or place composition.
The source branch retains the models, render settings, animation clips, rejected
race alternatives and the complete production integration.

Forager, generated with [Meshy](https://www.meshy.ai/),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); modified: posed with
library motion and rendered to pixels by tools/anim. Motion uses Quaternius
Universal Animation Library, CC0 1.0, retargeted to the forager's Mixamo rig.
The upstream attribution is in `game/public3d/models/README.md` and
`tools/anim/anim.json:targets.forager.credit`; generated `CREDITS.md` is not edited
by this fixture integration.
