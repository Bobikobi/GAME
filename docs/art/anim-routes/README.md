# Animation routes trial (#762): proof stills and the table

One strip per route (12 frames, cropped; `R0` the approved take, `R1e` the recommended route, `R1f` poses from a Gemini grid, `R4a1` a Gemini grid, `R5` a GPT GIF, `R3b` a Blender body). The moving page and the MP4s are in `.scratch/routes/` of the lane (not in git).

# Animation routes: the table (#762, fell, human, left view, 20.11)

Frames are 128 x 128; the cycle is matched at 1440 ms (frame time = 1440 / frames) except R0 (90 ms x 16) and the 8-frame R4b8. Numbers come from `tools/anim/routes/measure.py` on the delivered frames, nothing re-snapped.

B1 = opaque height range over the cycle against the stance's 96 px (the baseline's own overhead frames reach 114, so 'within 2 px' cannot hold for any felling swing) and mean Lab distance to the stance's colours. B2 = planted-foot edge drift. B3 = largest and mean limb jump between neighbouring frames (symmetric Hausdorff of the figure masks, px) and the largest mean pixel change. B4 = last to first frame jump (limb), OK when it does not exceed the largest inner jump.

| Route | Frames @ ms | B1 height (px) / palette | B2 foot drift (px) | B3 limb jump mean / max, pixel change max | B4 loop close (px) | B5 cost | B6 hand work | Verdict |
|---|---|---|---|---|---|---|---|---|
| R0 R0 baseline | 16 @ 90 | 98-114 / 0 | 3 | 9.75 / 19.7, 13.104 | 6.4 (ok) | 4 gen per clip (2 jobs) = 288 gen for 72 | ~8 min eye per clip; the take is judged by eye, not a script | measured |
| R1e R1e (WINNER) | 45 @ 32 | 97-114 / 0 | 1 | 4.51 / 11.18, 8.844 | 4.47 (ok) | 17.6 gen per clip (take 4 + 16 skeleton reads 1.6 + 3 jobs x 4), 72 clips = 1267 gen, about 6 min wall | ~2 min eye; script after the take exists; needs an approved take first | PASS (recommended) |
| R1c R1c | 45 @ 32 | 96-113 / 0 | 4 | 4.43 / 11.4, 9.445 | 3.16 (ok) | 17.6 gen per clip, 1267 for 72 | ~2 min eye | pass, feet slide |
| R1b R1b | 30 @ 48 | 95-113 / 0 | 3 | 6.07 / 16.03, 10.262 | 3.61 (ok) | 13.6 gen per clip (take 4 + 1.6 + 2 x 4), 979 for 72 | ~2 min eye | pass, fewer frames |
| R1f R1f | 45 @ 32 | 89-110 / 0 | 7 | 5.11 / 17.46, 7.767 | 5.1 (ok) | 13.6 gen + 1 Gemini call per clip, 979 gen + 72 calls | ~3 min eye; no approved take needed | pass on look, feet 7 px, body turns to the viewer |
| R1d R1d | 45 @ 32 | 89-111 / 0.1 | 15 | 5.25 / 17.49, 9.306 | 5.1 (ok) | 13.6 gen + 1 Gemini call | ~3 min eye | feet slide 15 px |
| R4a1 R4 Gemini (a) | 16 @ 90 | 90-108 / 0 | 14 | 8.92 / 24.21, 14.829 | 11.05 (ok) | 1 call, no PixelLab; 72 calls, about 4 h of rig time at a 90 s gap | ~3 min: the cut is a script, the eye picks a good draw (2 of 2 worked) | pass on look; B2 fails |
| R4a2 R4 Gemini (a), second draw of the same prompt | 16 @ 90 | 83-103 / 0 | 12 | 9.52 / 17.2, 16.141 | 7.07 (ok) | 1 call | ~3 min | pass on look; B2 fails |
| R4b16 R4 Gemini (b) | 16 @ 90 | 81-105 / 0 | 0 | 11.21 / 19.1, 15.237 | 12.37 (ok) | 1 call | ~5 min: the drawn ground lines leaked into the picture and needed a colour drop | guide lines leak |
| R4b8 R4 Gemini (b) | 8 @ 180 | 90-108 / 0 | 0 | 13.74 / 16.28, 17.488 | 4.12 (ok) | 1 call | ~5 min | coarse |
| R5 R5 GPT animated GIF (1 request, 24 frames) | 24 @ 60 | 72-101 / 0 | 10 | 7.76 / 25.63, 14.885 | 4 (ok) | 1 request; the free plan allows about 6 a day: 72 clips = 12 days | ~3 min; the rig ran without the owner | pass on look; one swing |
| R3b R3 our-body-less 3D | 24 @ 60 | 94-96 / 8.6 | 1 | 4.49 / 16.16, 6.313 | 1 (ok) | 0 gen; about 3 min CPU per clip (216 min for 72) | recolour of skin and shorts and a real human body still to do; once per race | fails identity by eye |
| R7a R7 PixelLab one-call 40 frames from the stance, text only | 41 @ 35.1 | 81-108 / 0 | 0 | 3.29 / 22.2, 16.28 | 1 (ok) | 6.1 gen per clip, 440 for 72 | ~6 min: the swing is not the felling swing, a retry is needed | fails (not the felling swing) |
| R7L R7 with the stance as last frame (loop) | 41 @ 35.1 | 85-98 / 0 | 4 | 4.88 / 14.42, 16.954 | 0 (ok) | 13.6 gen per clip (7 for the loop) | ~6 min | fails (two swings) |
| R2 R2 2D cut-out | 32 @ 45 | 89-96 / 0 | 0 | 4.87 / 20.52, 9.775 | 1 (ok) | 0 gen; one rig per figure view by hand (~1 h) and keys per clip (~15 min) | high: needs redrawn limbs for the overhead swing | fails by eye |
| R6f R6 in-betweens by optical flow on R0 (32 frames) | 32 @ 45 | 98-114 / 0 | 5 | 6.65 / 18.79, 9.005 | 4 (ok) | 0 gen, CPU seconds | none, but unusable | fails (ghost limbs) |
| R6b R6 in-betweens by blend on R0 (32 frames) | 32 @ 45 | 98-114 / 0 | 3 | 8.11 / 19.7, 6.745 | 5.83 (ok) | 0 gen | none, but unusable | fails (doubled limbs) |

PixelLab balance (paid account trial1): before 3788.0, after 3705.7, 82.3 generations spent of the 150 cap. (Jobs overlapped, so a single job's before/after in a ledger can include another job; the two ends are the truth.) Gemini: 4 of 12 calls (slot 0). GPT: 1 of 3 requests (3 files, one a duplicate).

Set cost (72 clips = 3 races x 8 verbs x 3 views): R1e 17.6 gen a clip = 1267 gen (of which the approved take is 4 gen = 288); R1f 13.6 gen + 1 Gemini call = 979 gen + 72 calls; R0 alone 288 gen; R3 about 216 min of CPU; R5 about 12 days at the free plan's 6 a day.

Largest single-limb jump per route is measured on masks, so it includes a leg moving; it still ranks the routes the same as the pixel-change number.
