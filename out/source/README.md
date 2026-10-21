# One prop from a reference: the round crate

Reference: `plum-crate-1x.png`, the plum round crate marked on `ref1.jpg`
(75x69, exact mask, lossless PNG crop of the only available image). The
exercise's reference path was a placeholder; `ref1.jpg` is a JPEG, so the crop
is PNG but the pixels carry JPEG noise, and detail finer than its 2-px art
pixels does not exist. Target 64x64 (DECISIONS 2026-10-18).

## Step 0: the palette answer

The object's dominant ramp is hue 333 deg, 15 steps, 99% of its pixels. The
32-colour core palette has no colour in that hue/saturation family: the
closest are the 4 reds (hue 349-17) and 2 purples (hue 278-284), and only 4%
of the reference's histogram falls in reachable bins (palette overlap ceiling
0.20). Answer: **(b) the hue family does not exist**.

The owner was asked (add a plum ramp, or restyle into an existing ramp) and
was unavailable in this session. The agent took the non-destructive option:
restyle the crate into the 4-step red ramp, no palette change, flagged for the
owner's confirmation.

## Style references (what the kit says)

`props/chest`, `props/well_old`, `props/market_stall`: one-pixel `#1b1a2e`
outline, flat two-tone shading, light from above (left and right even), a
readable silhouette and little texture noise. `style-3up.png` shows them beside
the reference.

## Rounds

`rounds.md` has the table. Three rounds, one change each:
1. the initial external crop and red-ramp prompt;
2. removed the invented metal bands, plank lid and staves, 64-pixel detail;
3. darkened the lid, added the horizontal seam and the knob.

Every round viewed: `style-3up.png`, `round1-3up.png`, `round2-3up.png`,
`round3-3up.png` (all at the same on-screen size), plus the gallery.
