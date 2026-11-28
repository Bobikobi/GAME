# Clothing on every clip, round 2: report (public #952)

Round 1 (`docs/art/CLOTHING_LOOKUP.md`, #954) carried a piece placed once on the B stand frame to a clip through a dense body map. Round 2 asks for a route that
holds on every clip, tried as several different families, measured on clips the method never saw. 28.11.2026, branch `art/clothing-route-2`.

## The answer in six lines

- **No family reaches the stop line** (one route passing L2a, L2b, L3, L4 on 80% of the held-out frames). Best, on 150 held-out front frames of nine clips: **f2c, the
  pose map, 40.0% of frames dressed on all five pieces by the bars, 56.7% by eye**. Three other families: 22.7% to 31.3%.
- The lookup works near the stand pose and breaks far from it. By the bars f2c passes `idle` 100% and `hit_heavy` 82%; `run`, `sneak` 0%; `dig` 4%, `down` 17%.
  Per piece (f2c, 150 frames): trousers 94%, shirt 81%, boots 77%, gloves 75%, cap 46%.
- **The rebuild score L7 tells the good frames from the bad ones.** With the line chosen on the other eight clips, family 1's rebuild score calls the eye's verdict
  right on 142 of 150 frames (94.7%, AUC 0.99). The same score from family 3b: 88.0%; from the pose map itself: 71.3% (AUC 0.77).
- **Recommendation (one): family 2c, the pose map, goes to the clothing stage (#754)**, with family 1's L7 as the gate and the paid redraw (route b) behind it.
  Measured as one pair: of the 59 held-out frames that pass family 1's gate (39%), f2c passes the bars on 56 (95%) and the eye calls 54 right (92%).
  Cost: 0 generations on those frames; route b only for the 15-frame jobs that hold a frame below the line: 11 of 15 jobs, **44 of 60 generations instead of 60 (27% saved)**.
  That is a weak economy, and it is stated as one.
- Seconds a clip (45 frames, this laptop, no GPU): pose 10 s, map 0.7 s (pose map), carry 29 s a piece (145 s for five), so about 2.6 minutes for a whole outfit.
  Family 1's gate costs 82 s more, family 3b's 11 s.
- Not done, and not scheduled (the manager's ruling: round 2 ends with this PR): the left view and F6b. Gemini and PixelLab were not used: 0 and 0.
- **Status (manager's ruling):** the recommendation is a finding, not a build: f2c behind the f1 gate is the starting route for #754; nothing is built further now.
  **Named next step for #754: the cap measured against its own head's area** (not the body's), proven on its own held-out set. The cap bar is not changed in this round.

## L4 changed (the manager's ruling of 28.11)

L4 now reads each piece's area as a share of the frame's own visible body area, against the same share on the B stand frame, inside 0.8 to 1.25. The clip median is
retired: it failed correct frames when the whole clip lost area (feet lifted, squats). It is a **changed bar**, so every family was re-scored on it, and the old L4 is
kept beside the new one in every row (`L4_old`, `all_old`) so nobody reads it as a bar loosened to pass. Outfit = all five pieces pass L2a, L2b, L3, L4 on the frame.

Tune clips (jump 13 frames, hit 45), share of frames dressed, **new L4 / old L4**:

| family | jump | hit | note |
|---|---|---|---|
| f1 dense map (round 1, robust carry) | 0.308 / 0.000 | 0.578 / 0.578 | |
| f1b part-labelled match (tuning round) | 0.308 / 0.000 | 0.556 / 0.556 | no gain |
| f2 pose map | 0.308 / 0.308 | 0.822 / 0.822 | |
| f2b face box looks up the head only (tuning round) | **0.000** / 0.692 | **0.000** / 0.822 | the cap shrinks 40% on every frame (211 px against 360); the old L4 hid it, the new one does not. Seen by eye: the crown is gone and the hair shows through |
| f3 DIS flow | 0.692 / 0.385 | 0.444 / 0.444 | |
| f3b DIS fine, Lab (tuning round) | 0.692 / 0.538 | 0.467 / 0.467 | |
| f3raft RAFT (torch) | 0.308 / 0.308 | 0.622 / 0.622 | 90 s and 225 s of map, no better than DIS |
| **f2c** (derived: f2b for shirt, trousers, gloves, boots; f2 for the cap) | 0.692 | 0.822 | chosen on these two clips, see below |

f2c is a second adjustment after the tuning round, chosen on the tune clips only (f2b's cap fails on every frame there), and carried to the held-out clips without
any other choice. f2b itself scores 0.000 on the held-out clips (the cap again), shown below beside it. Code: `combine.py`.

## Held-out: clips the method never saw (front view, no retuning)

The nine human B clips drawn on 28.11 (`feat-figure-moves/.scratch/figure-moves/set-b/human/`, read only): die 19, run 8, hit_heavy 17, down 23, hit_behind 12,
sneak 12, idle 17, idle-v2 17, dig 25 frames; 150 in all. Share of frames with all five pieces passing, **new L4 (old L4 in brackets)**:

| clip | frames | f1 dense | f2 pose | f2b | f2c | f3b DIS |
|---|---|---|---|---|---|---|
| die | 19 | 0.21 (0.00) | 0.10 (0.00) | 0.00 (0.10) | 0.37 | 0.21 (0.05) |
| run | 8 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| hit_heavy | 17 | 0.71 (0.71) | 0.77 (0.88) | 0.00 (0.94) | **0.82** | 0.59 |
| down | 23 | 0.17 (0.00) | 0.17 | 0.00 | 0.17 | 0.17 |
| hit_behind | 12 | 0.25 | 0.25 | 0.00 (0.58) | 0.50 | 0.25 |
| sneak | 12 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| idle | 17 | 0.41 | 0.88 | 0.00 (1.00) | **1.00** | 0.41 |
| idle-v2 | 17 | 0.29 | 0.53 (0.59) | 0.00 (0.65) | 0.65 | 0.29 |
| dig | 25 | 0.04 (0.00) | 0.04 | 0.00 | 0.04 | 0.04 |
| **all 150** | | **0.240** | **0.313** | **0.000** | **0.400** | **0.227** |

Per piece, bars pass share over the 150 frames: f2c cap .46, shirt .81, trousers .94, gloves .75, boots .77; f1 .55 / .41 / .58 / .51 / .46; f3b .55 / .54 / .67 / .57 / .57.

## The eye and the rebuild score (L7)

Eye labels are the session's own (`ask-claude` refused: the credit is past its stop mark): numbered sheets at 2x, bare and dressed side by side, the frames where the
outfit is visibly wrong to a player (torn, floating, misplaced, missing, face covered). Done by one reader at 1300 px sheet width, so a ragged edge of two pixels is
not seen; where the bars and the eye disagreed on a cap I cropped heads at 4x and 7x and revised. f2c's labels are f2's, re-read on every f2c sheet but `idle-front`
(the same frames are wrong in both; two clips revised after the head crops). They are one reader's, not a panel's.

| family | eye right | bars pass | bars pass / eye wrong | bars fail / eye right | L7 AUC | L7 line (fitted on all 150, in-sample) |
|---|---|---|---|---|---|---|
| f1 | 42.0% | 24.0% | 0 | 27 | **0.990** | exact < 0.741 |
| f2 | 56.7% | 31.3% | 2 | 40 | 0.770 | exact < 0.571 |
| f2c | 56.7% | 40.0% | 4 | 29 | (f2's) | |
| f3b | 42.7% | 22.7% | 2 | 32 | 0.963 | exact < 0.775 |

**The line is fitted on these labels, so it is in-sample.** The honest figure is leave-one-clip-out: the line from the other eight clips, applied to the clip left out
(`.scratch/.../r2/bin/analysis.py`): L7 of f1 calls the eye's verdict right on **142/150 (94.7%)**, f3b **132/150 (88.0%)**, f2 **107/150 (71.3%)**. The pose map's
own rebuild score is the weak one because its pixels come from pose, not from colour matching: it can rebuild a frame inexactly and still look right.

**Which bar is wrong.** (1) L4 on the cap: it fails 25 frames the eye accepts (of the 29 bars-fail / eye-right frames of f2c). The cap is a rigid hat, and when the head tilts or the body lies its visible area falls
to 0.5-0.7 of the stand frame's while it still reads as a cap (die 15-18, down 3-5, dig 18-21, checked at 4x). Measured against the body's area it is the wrong
reference for a cap; its own head's area would be the right one. Not changed here: the band is the manager's ruling. The one place where L4 was right and my eye
was too soft: down frames 6-16 (cap 0.39, a brown mass with no brim), revised to wrong. (2) The bars let through 4 f2c frames the eye calls wrong, all of one kind:
a turned or tilted head where the cap and hair sit beside the head (hit_behind 8-9, idle-v2 6 and 12); no bar looks at the cap's place on the head.
(3) L2a part agreement is circular for the pose map (the same keypoints make the map and the check); the eye is the independent check, and the two agree on 78% of
frames for f2c.
`dig` is the widest gap: bars 4%, eye 64% (the cap L4 above, and gloves over the shovel handle; the shovel and dirt add only +-9% to the body area, so they are not the cause).

## Failure modes with frame numbers (eye, held-out, front)

| clip | f2c wrong frames | what | f1 | f3b |
|---|---|---|---|---|
| die | 8-12 | garments jumbled as the body folds | 7-18 | 4-18 |
| run | 0-7 | dark patch over the face, ragged legs: a running figure is far from the stand | 0-6 | 0-6 |
| hit_heavy | 11 | ragged cap edge and boot specks | 7-9 | 7-9 |
| down | 2, 6-20 | lying: cap mostly gone (6-16), crouch frames ragged (17-20) | 2-19 | 2-19 |
| hit_behind | 3-9 | the head turns away: shirt and hair over the chin | 3-7 | 3-6 |
| sneak | 0-11 | a deep crouch, head down: shirt and cap over the face | 0-11 | 0-11 |
| idle | none | | none | none |
| idle-v2 | 6-12 | the head turns and tilts: cap and hair off the head | 6-12 | 6-12 |
| dig | 6-14 | gloves and sleeves jumbled at the shovel handle | 2-24 | 5-24 |

Why: one stand frame carries every pose. Where a part is hidden on the stand frame (the back of the hand, the face turned away, a leg behind the other) there is no
source pixel, and where the pose is far from standing (a crouch, lying) the dense matchers pair the wrong parts. Dense matching (f1, f3) tears the garment into
specks there; the pose map moves whole parts and degrades more gently, which is why it leads on the bars and on the eye.

## The families, in one line each

1. **f1 dense map, improved** (overhang rides the nearest part): best rebuild score on held-out (L7 0.99) but the worst eye result on far poses (garments tear). Tuning
   round (part-labelled match): no gain. 82 s of map for 45 frames.
2. **f2 pose map** (RTMPose-x on the frames scaled 3x, pose padded 40 px, each part moved by its bone): best share, 0.7 s of map. Tuning round (face box looks up the head
   only): fixed the face, shrank the cap 40% on every frame. f2c takes the cap from f2.
3. **f3 optical flow**: DIS (3.9 s of map), RAFT on torch (90-225 s on the tune clips): no better than DIS on the bars. RAFT was not run held-out (cheap re-score
   done on tune only).
4. **F4 hybrid** (priced from the measurements above, no new draw): see the recommendation.
5. **F5 the paid anchor** (route b, DECISIONS 2026-11-21, one 45-frame clip, one outfit, left view): 12 generations (3 jobs of 15 frames at 4.0), 45 of 45 frames dressed,
   S4 9.2%. Priced, not redrawn. That the redraw is right on the frames below the gate is assumed from this one clip, not measured on any of the nine.
6. **F6 priced only.** (a) A 3D proxy body that gives an exact map: a rigged proxy per race with B's proportions, about 1-3 builder days (unchecked), 0 generations;
   it gives an exact map only if its silhouette matches the drawn B to a pixel, which a hand-drawn body will not, so it would meet the pose map's limit; not built.
   (b) A mask-edit image model: one request edits a grid of 15 frames inside the wear-place masks, 3 requests a clip and outfit, on a daily quota of 7 requests per account;
   it is F6b below. **F6b (Gemini frame grids, GPT animated GIFs) was not run** (no Gemini on the day: account 1 at its limit, account 2 restricted) and is not scheduled.

## What it costs: 9 outfits x 6 pieces x the clips a player sees

- **Separate pieces (hat, top, trousers, gloves, footwear, jewellery) are only possible through the lookup.** Route b redraws a whole outfit; it cannot give a piece alone.
  The lookup gives any piece, in any combination, from one map: 0 generations, about 29 s a piece on a 45-frame clip. 54 pieces (9 x 6) are 26 minutes of carry per clip
  and view on this laptop before any speed-up; the carry has not been optimised and a vectorised version should be several times faster (unchecked).
- **Whole outfits on the clips the gate rejects:** route b at 12 generations a clip and outfit: 108 for 9 outfits, per clip and view. With the gate, 73% of the jobs
  remain on the nine measured clips: about 79 generations a clip and view (instead of 108). For the three views multiply by three (left and back are not measured yet).
- A clip the gate rejects mostly (run, sneak, dig, down, die: 5 of the 9 verbs, 58% of the frames) gets no separate pieces from either route today. That is the open
  problem; F6b and a second stand frame per pose family are the free candidates for it (neither measured).

## What differs most to the eye (at the game's zoom, against the stand-frame dressed figure)

A loose edge: specks of garment one to two pixels wide around gloves and boots, and a cap that sits beside the head instead of on it when the head turns. The bars
catch the specks (L2a stray, L2b misfit) more strictly than the eye does (bars fail / eye right: 29 frames of f2c), and miss the head turn (above).
Shade and strength of colour were not touched: the pieces are the Gemini reference's own colours.

## Loose cloth

The outfit has no loose piece (`LOOSE = {}` in `pieces.py`): no cape, robe or long hair. When one arrives, tag it loose in the same data and name its body anchor so the
world's wind can drive it later (not built, as briefed).

## Files and how to rerun

`tools/art/clothing/lookup/`: `pose.py` (RTMPose-x), `parts.py`, `overhang.py`, `bars2.py` (L2a, L2b, L3, L4 new and old, L5, L6, L7), `route2.py` (the driver),
`posemap.py` (f2), `flowmap.py` (f3), `densemap.py` (f1), `combine.py` (f2c), `eyejudge.py` and `agree.py` (the eye and L7), tests `test_route2.py` (23 tests).
Data stays in `.scratch/clothing-lookup/r2/` (not in git): maps, keypoints, results per family, 4x sheets for f1 and f2c on hit_heavy, idle-v2 and die, the zoom-3
preview `preview/f2c_held_zoom3.gif` (13.9 s: hit_heavy at the kit's 50 ms a frame, idle at 150 ms, die at 60 ms). The torch install (torch 2.15.0, CPU) is in the install audit log.
