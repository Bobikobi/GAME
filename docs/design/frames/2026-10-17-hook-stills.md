# The hook, three sets of stills (2026-10-17)

Stills for the owner's pick, from section 7 of [OPENING_REVIEW.md](../OPENING_REVIEW.md). All frames are 390x844 (phone), taken on the real game from a fresh save (the real map, HUD, player and houses). Nothing is built: no game code changed.

## What is mocked

The real game does not have the hook yet, so these parts are drawn over the real frame by a throwaway rig (deleted after the shots):

- The B2 mist: clear for 5 tiles, then 6 tiles of thickening, at least 96% at the edge; `#3a3554`, `#5d6177`, `#1b1a2e`; an ordered 4x4 dither on game pixels. Matched to the 2026-10-10 frame. The HUD stays above it.
- The carved stone (48x64 game pixels, six names plus one carved line), the name field and the keyboard block (labelled, about 40% of the screen).
- The explorer's glint (a mote of light).
- The town's smoke column (64 px tall, bending at the top) at the view's edge and at the chimney.

## Set 1: B2 at wake, per starter

One difference: the pocket with its task in it.

| Frame | Starter, tile | Tests |
|---|---|---|
| `hook-1-forager` | forager, (6,17) | The 5-tile pocket around the wake tile, the task in it. |
| `hook-1-digger` | digger, (9,23) | The same pocket, the dig place inside it. |
| `hook-1-explorer-cue` | explorer, (7,6) | The pocket plus a glint at the circle's edge, a mote of light against nothing. |
| `hook-1-explorer-nocue` | explorer, (7,6) | The same frame with no glint: does the explorer read where to go without it? |

Waking lines (approved, Q1): three, the digger's second line "The bank south of you has slid down. Dig there." They are not drawn in the frames; the boxes are hidden so the mist is the subject.

Question: does the pocket read as "a small place in a big dark world, with one thing to do", and does the glint earn its place?

## Set 2: the stone

One difference: where the camera stops, and whether the carve is a beat or an interruption.

- `hook-2-stop-wide`: zoom 2 (the game's phone zoom), the stone small in a wide frame, name field and keyboard up.
- `hook-2-stop-close`: zoom 3, the camera moved in on the stone.
- `hook-2-carved`: the carve beat: "Tess" freshly cut, the real dialog "The bridge holds. You cut Tess into the stone. / Under it hangs a purse: thirty gold, a tool's price."

Question: wide or close at the stop, and does the carve with its box read as a beat of the moment (it replaces no input) or as a stop in the walk?

## Set 3: the smoke at the bridge

One difference: the marker at the edge against the smoke at its true place.

- `hook-3-retreat`: B2 drawn back to radius 7 around the bridge. Mist stays in the view's corners.
- `hook-3-day-edge`: the mist drawn back to 13 tiles (the view is clear) and the town's smoke as a marker at the view's edge, by day.
- `hook-3-night-edge`: the same frame at hour 21, the smoke dimmer.
- `hook-3-true-place`: the player nearer the town, the smoke drawn from the lower house's chimney where it really stands.

The retreat frame shows why the review asks for 13 tiles: 7 does not join the pockets and leaves mist in the corners; 13 clears the whole view. Per Q3 there is no far smoke yet: only the town's smoke and the far bell, both true today.

Question: is a marker at the edge enough to say "something lives there", or does it need to stand at its true place? And does it still read at night?

## After the pick

The pick goes into `DECISIONS.md` with its frame, as the compass for the polish loop. Nothing here is built until then.
