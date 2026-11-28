# Clothing by lookup: a piece placed once, carried to a clip by a body map (public #952)

The question: can a piece placed ONCE on the B stand frame be carried to every frame of a B clip by a body map made once per clip, with
zero generations per piece afterwards, at a quality a player accepts? The route that draws every frame costs about 2,500 generations a
piece, route b about 12 a clip per outfit (DECISIONS 2026-11-12, 2026-11-20, 2026-11-21). The verdict is in DECISIONS 2026-11-28
("A piece placed once on the B stand frame..."): **worth retrying** (DECISIONS 🔁, the manager's ruling) - trousers and shirt read on both clips, the gloves fail where a hand leaves
the hip, and the overhang of Gemini's pieces fails L2 and L3 before any map is made.

## What was built (`tools/art/clothing/lookup/`, Python 3 with numpy and Pillow only, no model call)

| file | job |
|---|---|
| `pieces.py` | cuts a piece out of its Gemini cell: registers the cell on the stand frame by the overlap of the two skin masks, picks the piece by a colour rule, area-averages it onto the game grid and snaps it to the core 32 and the human ramps (wood, red, skin) |
| `partmap.py` | method (a): 11 parts of the stand frame (head, torso, pelvis, upper arms, forearms, thighs, shins), each found in a frame by its own shift, optionally a rotation, nearest neighbour |
| `densemap.py` | method (b): dense patch matching stand to frame; tracking frame to frame composed back to the stand; `chain_bi`, the chosen one |
| `carry.py` | carries a piece through a map, counts holes and never fills them, measures L2-L6 |
| `evalmap.py` | the map's own check: carry the stand frame itself through the map and compare with the frame |
| `trial.py`, `report.py` | the driver (maps cached in `.scratch`), the 4x sheets and the bar table below |
| `test_lookup.py` | a known shift gives the known piece; a hole is counted and left empty; no tool imports a network |

Run: `python3 tools/art/clothing/lookup/pieces.py` then `python3 tools/art/clothing/lookup/report.py --method bi70`. The inputs
(the Gemini pictures) are in `.scratch/clothing-lookup/in/` and in the drafts store; the cut pieces and the sheets are not in git.

## The chosen method, `bi70`

A dense match (a 7 x 7 patch in CIELAB, a window round the figure's global shift, median over the neighbours) from the stand frame to
each frame gives a map. Frames whose map rebuilds the bare frame at 0.70 or better (the pose is near the stand pose) keep it; every
other frame is tracked from the nearer such frame through the maps of its neighbours (small moves, so a hand stays a hand), composed
back to the stand frame and anchored to it by a +-2 px refinement. Cost: 24 s for the 13-frame jump, 69 s for the 45-frame hit, on a
laptop CPU, 0 generations.

## Bars (each frame of both clips, trousers / gloves / shirt)

| clip | piece | L1 gen/piece | L2 outside (bar 3%; stand floor) | L3 face px (bar 3; stand floor) | L4 area max/min (bar 1.25) | L5 on palette | L6 holes worst frame (mean) |
|---|---|---|---|---|---|---|---|
| human_jump_front | trousers | 0 PASS | 4.5% (4.5%) FAIL | 0 (0) PASS | 1.36 (627-851 px) FAIL | 100% PASS | 13 at frame 10 (3.6) |
| human_jump_front | gloves | 0 PASS | 59.0% (17.1%) FAIL | 0 (0) PASS | 6.04 (83-501 px) low: [7, 8, 9, 10] FAIL | 100% PASS | 4 at frame 6 (0.9) |
| human_jump_front | shirt | 0 PASS | 0.3% (0.3%) PASS | 5 (5) FAIL | 1.34 (806-1080 px) low: [3, 4, 5, 6] FAIL | 100% PASS | 5 at frame 6 (1.9) |
| human_hit_front | trousers | 0 PASS | 4.6% (4.5%) FAIL | 0 (0) PASS | 1.20 (757-906 px) PASS | 100% PASS | 11 at frame 20 (2.0) |
| human_hit_front | gloves | 0 PASS | 17.2% (17.1%) FAIL | 0 (0) PASS | 1.23 (332-408 px) PASS | 100% PASS | 11 at frame 23 (2.1) |
| human_hit_front | shirt | 0 PASS | 0.3% (0.3%) PASS | 9 (5) FAIL | 1.11 (1024-1132 px) PASS | 100% PASS | 3 at frame 21 (0.7) |

| clip | map rebuilds the bare frame (exact colour share) | silhouette IoU | body holes per frame |
|---|---|---|---|
| human_jump_front | 0.80 | 0.99 | 21 |
| human_hit_front | 0.80 | 0.99 | 27 |

L1 is 0 generations everywhere. L2 and L3 compare with the stand frame's own number in brackets: where they are equal the map adds
nothing and the piece is what overhangs. Frames named "low" are the ones under 0.8 of the median area (L4's hidden-in-a-pose list:
jump 7-10 are hands at the chest, where the gloves are lost, not hidden).

## Misfit of Gemini's body against B's outline (pixels, on the stand frame)

Skin masks of the cell and of B's stand frame differ by 706 px (trousers cell), 638 (gloves) and 1006 (shirt) of B's 1,578 skin pixels:
Gemini redraws the body, so the pieces are not pixel-exact. Nothing was painted in. The piece pixels outside B's body outline on the
stand frame: trousers 38, gloves 61.

## Not done / not proven

Other views, other races, the walk and loose cloth are out of scope. The anchor threshold was chosen on these two clips. The shirt
and the trousers were judged by eye only on the sheets named in the DECISIONS entry; the owner's eye on the live frame is still to come.
