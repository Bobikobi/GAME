# Foundations alignment: the building laws against the games we measure ourselves by (track 7)

Written 2026-11-04 for issue #664. It records a blind audit of the building laws (STYLE.md, LIGHTING.md, the anim tool, the check), what the owner picked from it the same day (DECISIONS 2026-11-04, "Foundations alignment"), what stays open, and what every open pull request and unmerged branch owes the picks.

## 1. How it was measured

Four games: Stardew Valley, A Link to the Past, Eastward and Graveyard Keeper 2 (GK2). Two references: reference A and the anchor frame, the two pictures the track-7 judge scores against. Ours: the frozen frame v12 and the core kit. Public store and press screenshots were looked at and measured only: never an input to a model, never traced, none checked in.

| Law | Measured as |
|---|---|
| The figure's camera | the head's share of the body's height and how much of the crown shows, against a body rendered at 20, 35, 50 and 65 degrees |
| The camera of standing things | a canopy's width over its height, a roof's share of a house's height |
| The ground's angle | the ellipse of a round top (a well, a stump): its height over its width |
| Scale | a tree, a house and a bush in character heights |
| Light | where the cast falls and how long it is, its colour and edge, which side of a body is lit |
| Colour | distinct colours at 5 bits per channel for 95% of the pixels, saturation, warmth, the dark share |

## 2. The gaps, and how each closes

"Self-contradicting" means our own law and our own built frame disagree. A pick closes a gap; an A/B pair is one difference between two full-frame stills, blind-scored against v12 and the anchor before the owner sees it.

| # | Our law before | The games and the references | Ours as built | Verdict | Closes by | State |
|---|---|---|---|---|---|---|
| 1 | 64 px tiles; the phone frame (390 x 844, 6.1 x 13.2 tiles) as the measure | Stardew shows about 30 tiles across a 1920 frame | the kit at 64; the stills at phone size | same grid; the measure was the wrong screen | pick 3: the full frame, 1920 x 1080, one art pixel per device pixel | decided; the live desktop's zoom step is an A/B pair |
| 2 | Everything that moves at 50 degrees (DECISIONS 2026-10-26) | 20 to 25 in three games, about 45 in GK2; reference A about 30, the anchor 55 to 60 | the v12 figure about 60, the kit elf 60 and more: the crown, not the face | self-contradicting: the figure stands higher than the law, and the law's reason (the face reads) does not hold | pick 1: about 35 for everything that moves | decided; the cast is rendered again (step 1) |
| 3 | No angle law for trees and houses; they are drawn from the front | from the front in three games; GK2 lifts trees and houses to 35 to 45 with its figure | from the front (the kit house's roof 63% of its front) | self-contradicting across sprites: a high figure among front-view trees | pick 1: the standing things stay as drawn, the figure comes down to them | decided |
| 4 | The ground in plan view with a drawn height face | plan view in all four; bridges at about 50 with a railing side | the v12 bridge seen straight down, no railing side | different on the bridge | the art step: the bridge with its railing side | open, art |
| 5 | Oak at least 3 characters, bush half, small house 3 (STYLE 1b) | trees 1.3 to 5; houses 3.5 to 5; the references' bushes 0.8 to 1.1 | the kit oak 0.4 (a 32 px sprite beside the elf), bush 0.8, house 2.6 | the kit contradicts its own table; the bush differs from the references | A/B: the bush at 0.9 or 0.5; then the redraw waves to the table | open |
| 6 | Baked light from above, left and right even | top or top-left in three games; one side lit in GK2 and both references | the v12 body lit from the left while every cast falls down-left | self-contradicting inside v12 | A/B: the body's lit side faces the sun of the cast | open |
| 7 | The cast up-screen, behind its caster (DECISIONS 2026-10-21) | no sun casts in three games; GK2 down-right; the references down-left | v12 casts down-left | different from every source, and self-contradicting | up-screen is dropped; A/B: down-left or down-right | the side is open |
| 8 | Cast in ink `#1b1a2e` at 30%, whole pixels, a hard edge | dark brown and soft in the games; olive-brown feathered 2 to 3 px in the references | v12: a warm multiply with a soft edge | self-contradicting | A/B: warm and feathered, or ink and hard | open |
| 9 | A 1 px ink outline on every sprite but animals and ground | ink in Stardew and ALttP; none in Eastward, GK2 or either reference | the kit inks; v12 draws copies without it | self-contradicting | A/B: off or on; the check's ink measure follows the pick | open |
| 10 | 32 core colours and named ramps; an engine layer at most four steps | 460 to 790 colours in GK2, 670 on the SNES, 1000 to 1900 in Stardew and Eastward; the references 1900 to 2400 | v12 at 1966 colours, made by grade and relight layers over the sprites | self-contradicting: the frame that scored is built from what the law forbade | pick 2: sprites whole-pixel on the palette, the engine's layers continuous | decided; the built step ladders go continuous at the v14 lock |
| 11 | One grid per kit, 16 px sprites waiting by name | one scale per game | the kit mixes a 32 px oak, 16-grid figures and the 128 px elf frame | by design during the redraw | the redraw waves | open, art |
| 12 | One level is 32 px of face (half a tile), grey, ledges every 16 px | faces of one to two tiles; lit tops over dark faces; warm soil under a lit lip in reference A | a cobble wall of about 2 characters; the river terrace a hairline with no face | different, and self-contradicting between the law and the frozen recipe | one full-tile still in the art step | open, art |
| 13 | 64 px fill tiles, variants, scattered motifs, ragged edges | varied ground in all four; GK2 adds wide light pools | v12's meadow sparse except where the relight lands | same law; the build lags | the ground wave | open, art |
| 14 | One night darkness at 92%, pools cut in two hard steps | soft wide halos (Eastward, GK2) | no night frame in the judge set | different in kind | pick 2 allows soft halos; the night wave decides by stills | open, night wave |
| 15 | Depth cues: reflections, into the grass, cloud shade, footprints | the references and GK2 take their depth from the low sun's lit and shaded pools | v12's relight layer gives part of it | the list leaves out the cue the references live on | pick 2: the sun's pools are a layer; the night wave adds moonlight in water and rain lit by fire | open |

## 3. The order

| Step | What | Gate |
|---|---|---|
| 0 | This page, the DECISIONS entry, STYLE 1, 1b, 2, 4 and 6, and the pages that stated 50 degrees or a phone gate | merged |
| 1 | The cast rendered again at 35 (`elev` in `tools/anim/anim.json`, every target), the same bodies, no new drawing; one full-frame still beside v12 | the face reads at the full frame (the `density-64` measure); the blind score not below v12 |
| 2 | The six A/B pairs on the frozen frame, one knob each, after the v13 ablation gives each switch's delta | the owner picks each pair; written to DECISIONS and STYLE the same day |
| 3 | The recipe v14 locked with the picks: the check's ink rule, the step ladders made continuous, the cast's sun; this table re-run | every row reads "same" or "different by decision" |
| 4 | Art in order of cost at the full frame: the height face, the redraw waves to the 1b table, the bridge | each wave measured against 1b on the opening's first frame |
| 5 | Night and sparkle with the night wave | the wild stays dark (STYLE 5) and the town reads lit |
| 6 | The audit re-run from scratch by a fresh eye, the same method and sources | no row self-contradicting |

After step 3, three waves in this order: the track-7 toolkit cut to what moves a score or catches a defect; the drafts pool sorted into four bins (not usable, recyclable, good as it stands, to prepare), starting from the owner's hand sort with a reason per asset; compositions of pieces and of several materials wherever a composition replaces a generation.

## 4. Open pull requests and branches against the picks

Audited 2026-11-04 against develop at 08ce31df1. "Rebase with change" lists what the branch owes when it is next rebased; nothing here is pushed to anyone's branch.

| Pull request | What | State | The change it owes |
|---|---|---|---|
| #677 | the slim elf's walk and idle drafts, and its DECISIONS entry | rebase with change | its entry judges the drafts against 50 degrees: re-judge them beside a body rendered at 35 before any new camera run; CR-117's still at the full frame; the drafts' outline parameter follows the outline pick |
| #676 | the promote pipeline, piloted on a bush, a patch and a ruin | wait for v14 | the bush is 0.73 of a character, between the two A/B values: re-reduce it to the pick; all three carry a full ink edge (the outline pick); the scene's still at 1920 x 1080 and zoom 1, not 800 px at the largest whole zoom; its 50-degree comments |
| #675 | three shared ramps (sage, sandstone, olive) | unchanged | #676 carries the same commit: land #675 first or drop it from #676 |
| #673 | the weapon matrix | unchanged | none |
| #672 | one driver for drifting pieces, chimney smoke | unchanged | none: its continuous fade is now within the law (pick 2) |
| #611 | stone work rules | unchanged | none |
| #610 | gear foundations | unchanged | none |
| #609 | the gear wave's design pages | rebase with change | CLOTHING.md: the 50-degree lines to 35, the phone-size stills to the full frame, the "every people sprite takes the ink line" lines to the outline pick; WEAPONS.md the same |
| #510 | grass tufts | rebase with change | the density measured on phone frames is re-measured at the full frame or stated per tile; the tuft height rechecked if the cast at 35 changes the adult's height |
| #464 | music by game state (draft) | rebase with change | its e2e page at 1920 x 1080, not a 390 x 844 phone |
| #433 | the hare and the crow | rebase with change | `elev` 50 to 35 on its three targets, the clips and pick pages rendered again; rendered without ink, as develop already rules for animals |
| #404 | dried herbs | unchanged | its item icon follows the outline pick with the rest of `items/` |
| #391 | the inn (draft) | rebase with change | its e2e at 1920 x 1080; the phone run is no longer a gate |
| #24 | the valley in 3D (draft, do not merge) | stale | nothing while it rests |

Branches without a pull request:
- **The recipe prototype branch** (local, no pull request) owes the most: its layers' four-step ladders become continuous (pick 2); its compositor's tilt goes from 50 to 35 for moving things (pick 1); its window becomes a 1920 x 1080 frame at one art pixel per device pixel (pick 3); its cast must stop following the up-screen sun and take the A/B sides; its bush target becomes the two A/B values.
- **art/rich-opening-ground** (a world study): its family check is still expected by develop's production line, so that part lands alone with its pages reworded from 50 degrees and phone captures to 35 and the full frame; its dated phone frames stay as history, never as gates.
- About fifty other unmerged branches are the heads of squash-merged or closed pull requests: stale, no action.

## 5. Left on develop after this page

- `tools/anim/anim.json`: `elev` 35 on all 17 targets and the cast rendered again before any sheet enters `content/` (step 1). The shipped sheets are the 50-degree renders until then.
- `game/src/cast.ts`: the sun's direction follows the down-left or down-right pick (step 3).
- `tools/src/check.ts`: the ink measure follows the outline pick (step 3).
- The 30.10 lighting build's step ladders: continuous at the v14 lock (step 3).
- `tools/anim/blender/render.py`: a target with no `elev` renders at 50 by default; the default follows `anim.json` to 35.
- Phone gates in the code. P3 makes them information, not gates, but turning a CI job off or into a landscape run is a code change of its own, proposed to the owner, not done here:
  - the CI group `opening-phone` (`game/e2e/run.ts`), which every pull request must pass, and the phone legs of the camera, HUD, tree, load, map, shop and 3D e2e runs;
  - the desktop legs of the same runs sit at 1440 x 900 or 1280 x 800, not at the full frame;
  - `tools/test/ui-measurables.test.ts` judges tap targets at a 390 px portrait width.
- Still tools fixed to the phone frame: `tools/stills/compose.py` (390 x 844 at 3x, and it refuses any other frame), `lighting-shoot.mts` and `lighting.py`, `frame-time.mts` (1440 x 3120), `nature.py`, `tint_compare.py`, `game/e2e/stills/hud-frame-d.ts`, and `kit:gen`'s `PHONE_FRAME` and compare page (`tools/src/kit/gen.ts`). The v14 stills follow the full-frame spec; each tool takes a 1920 x 1080 frame when it is next touched.
- The richness, colour-per-window and composition checks judge 15 x 10 tile windows (`tools/src/richness.params.json`); the window is set against the full frame at the v14 lock.
- Frame-time budgets written for a phone profile (ART_SYSTEM 9, NATURE 7, NEXT 19, OPEN_WORLD stage 5) are re-based on a computer at the full frame when they are next measured; the phone keeps a budget of its own in the adaptation wave.
- Dated frames and records made at 390 x 844 stay as history, never as gates. Every page that set a phone-size still or a phone gate for future work is reworded in this pull request.
