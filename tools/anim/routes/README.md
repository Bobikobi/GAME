# Animation routes trial (#762): code that makes the routes repeatable

Python 3, offline, paths from arguments; numpy and Pillow only (plus ffmpeg for `video.py`). The one network piece is
`plclient.py`, which talks only to PixelLab with the paid account's token read from a file and never printed. Nothing here enters
the game or `content/`. Run the tests: `python3 -I tools/anim/routes/test_routes.py` and `python3 -I tools/anim/routes/test_measure.py`.

The scripts of the routes that did not win (`cutout.py` the 2D cut-out, `r6.py` in-betweens, `glbjoints.py` and `retarget.py` the library clip on a skeleton, with `test_attempts.py`) are not on this branch; they sit on the tag `attempt/2026-11-anim-routes-dropped` (`git show attempt/2026-11-anim-routes-dropped --stat`).

The test motion is the human felling a tree, left view, one looping swing; every route ends as 128 x 128 pixel frames of our figure.
The recommended route is R1e: a take's poses are read back as skeletons, re-timed to as many poses as wanted, and PixelLab redraws
our figure in each pose.

| File | What |
|---|---|
| `measure.py` | bars B1 to B4 from the delivered frames alone (height range, palette distance, foot drift, neighbour jump, loop close); `--ref` is the stance |
| `plclient.py` | one PixelLab job from a JSON spec; reads the balance before and after and writes both to `ledger.jsonl`; token arg `-` is the trial account |
| `skelinterp.py` | N poses from the 18-joint skeletons of a few drawn frames (`/estimate-skeleton`), cyclic Catmull-Rom; `--pin` keeps named joints (the ankles) where the stance has them |
| `skelspec.py` | the spec of one `/animate-with-skeleton-v3` job (3 to 15 poses) from those poses |
| `cutgrid.py` | R4 and R5 (Gemini grid, GPT GIF): a drawn grid (Gemini, a GIF's frames laid out) cut into frames: one scale, feet on the ground row, palette snapped to the stance, `--drop` removes a guide colour the drawer copied in |
| `strip.py`, `compare.py`, `video.py` | a contact strip for a look, the moving comparison page (self-contained), a looping MP4 per clip |

Per-clip recipe of R1e: (1) take the approved 16-frame take; (2) `/estimate-skeleton` on each frame (0.1 generation each, `plclient.py`);
(3) `skelinterp.py OUT.json 45 EST*.json --cycle --pin "LEFT LEG,RIGHT LEG" --pin-from STANCE_EST.json`; (4) `skelspec.py` three times with
`--pick 0..14`, `15..29`, `30..44` and the same seed; (5) `plclient.py` per spec; (6) the 45 frames are `p00.png ...` in order.
