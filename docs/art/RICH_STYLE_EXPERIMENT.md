# The rich-style experiment (2026-10-21) and the palette decision it led to

How close can an outside picture's richness get through `kit:gen` when the style line, the
palette and the importer change, and nothing else? Branch `exp/rich-style`, built on
`docs/prop-from-ref` (the procedure in [PROP_FROM_REF.md](PROP_FROM_REF.md) and its locks).

Result: the imported sprite went from about a quarter of the reference's colour richness
to about half to four fifths, in one round, on five objects from one clean 1920x1080 scene.
The sheet of our outputs: [2026-10-21-rich-style-sheet.png](frames/2026-10-21-rich-style-sheet.png);
the five imported sprites are under [frames/rich/](frames/rich/). The reference picture is
third-party art and is not in the repository.

The owner's decision on that evidence, 21.10: **the palette deepens.** The shape is the one
ART_SYSTEM section 3 and `DECISIONS.md` 2026-10-20 already fixed: the 32 core colours stay as
they are, and the depth is ramps. What this branch adds is that the ramps of the world are
shared, in `tools/src/kit/palette.ts`, so no kit file has to declare them and no protected path
moves: `CORE_RAMPS`, 13 ramps of six steps (78 colours with the core), each passing the ramp
rule of `ramps.ts`, each core family inside its own ramp. The experimental 92-colour list of the
first run is gone; the measured ramps replaced it.

## What changed, each behind a spec entry

| lever | where | what |
|---|---|---|
| 1. style line | `gen.ts` `buildPrompt`, `"style": "rich"` | "painterly pixel art: hue shifts inside a surface, ambient light, material texture, an outline that follows its surface" instead of "limited palette, two-tone shading" |
| 2. deeper palette | `palette.ts` `CORE_RAMPS`, `"ramps": [...]` | the shared ramps a sprite draws in, one to four, the first gives the outline; the importer allows the 32 plus their steps. `rich` with no `ramps` means every shared ramp |
| 3. dither on import | `import.ts` `dither`, with `rich` | a 2x2 ordered pattern between the two nearest palette colours where the source sits between them; a clear colour stays flat |
| 4. clean references | the spec | PNG crops at native resolution, never a re-encoded screenshot |
| 5. style examples | `style_refs` | two other crops from the same scene attached after the reference; the prompt says to match their shading, hue shifts, texture and outline |
| 6. best of three | three parallel `kit:gen` runs | the operator picked by eye; a judge model that only rejects is the next step |
| 7. grid by need | the spec | tree 128x144, bridge 256x128, bench 64x40, signpost 48x64, mushrooms 32x32 |

An entry with no `ramps` and no `style` is untouched: the 32, no dither, the old line. Every
sprite of today names no ramp and stays valid, which `kit-ramps.test.ts` holds the check to.

## The shared ramps

| id | for | steps (dark to light) | core colours inside |
|---|---|---|---|
| grey | stone | #1b1a2e #3a3554 #5d6177 #8f94a8 #c6cad6 #f5f4ef | 6 |
| stone | stone | #1e2230 #333b4c #4a5668 #6f7d8c #9aa7b0 #d6ddd8 | 0 |
| green | vegetation | #15301f #1f3d2b #2e6b3b #4c9a3f #84c450 #c8e88a | 5 |
| moss | vegetation | #1b2a16 #2f4722 #4a6a2c #6f8d36 #9cb24c #cfd36e | 0 |
| rust | vegetation | #4a1d10 #7a2f14 #a9481a #cf6a23 #e9903a #f5b866 | 0 |
| wood | wood | #2a1810 #3d2618 #6e4226 #9e6b3c #c99a5e #ebd3a2 | 5 |
| bark | wood | #1f1210 #3f1e17 #5e2e20 #7f452a #a3633a #cc8e55 | 0 |
| water | water | #0f1c3b #172a52 #275a99 #3f8fd1 #7cc4ec #c4ecf8 | 5 |
| teal | water | #122b2c #1c4a49 #2a6c66 #3f8f84 #62b3a2 #93d6c2 | 0 |
| red | cloth | #3d1220 #5e1c28 #a8302f #e2533f #f6a07f #fbcaa6 | 4 |
| plum | cloth | #241238 #43204a #5b3373 #7c4593 #9a5bb0 #c28bc9 | 2 |
| fire | light | #6e2d14 #b8661f #e08a2a #eda83a #f8de62 #fff3a8 | 3 |
| skin | skin | #5a3528 #8a5540 #b4764f #d38c66 #f3c7a0 #fae3c8 | 2 |

Every ramp rises at least 5 in light per step and moves its warmth by at least 0.03 across
(`rampProblems`); the core's own ramps are the model. The new families came from the two
references of the experiment: autumn leaves (rust), a stone bridge (stone), river water (teal),
bark, moss. A material these do not hold (a sand, a brass) is a new shared ramp in `palette.ts`,
by owner decision, before the sprite that needs it.

## Measured in the experiment

Significant colours = colours covering at least 0.4% of the pixels at 5 bits per channel, the
measure `DECISIONS.md` 2026-10-20 used. Ours is the imported sprite on the experimental
92-colour list of that evening; the earlier row is the same pipeline on the 32 (a barrel from
another picture). The shared ramps hold 78 colours in the same families, so the numbers carry.

| object | reference | ours, rich | best of | model seconds | model tokens |
|---|---|---|---|---|---|
| autumn tree | 48 | 24 (37 distinct) | c3 | 166-206 | 36k-59k |
| stone bridge | 52 | 22 (42 distinct) | c2 | 149-191 | 32k-54k |
| bench | 46 | 19 (22 distinct) | c1 | 177-221 | 47k-54k |
| signpost | 42 | 35 (47 distinct) | c3 | 172-245 | 29k-39k |
| mushrooms | 35 | 21 (32 distinct) | c3 (two candidates timed out at 420 s) | 420 | - |
| barrel, the 32, earlier | 37 | 22 of 32 | - | 160 | 59k |

13 of 15 images came back; the two timeouts were the smallest object. The grid warnings fired
on the tree in all three runs ("drawn on about 165x170, voted to 128x144") and on the
mushrooms; both would take the warning text as a second-round prompt.

By eye at 3x phone size: the signpost is close to its source; the bench and the bridge read as
the same objects in a cleaner hand; the tree keeps the cluster logic and the olive shadow but is
tidier than the source; the mushrooms are clean and too large. What remains is not colour, it
is hand: the source is deliberately dirty (single leaves, moss, wear) and the model draws clean.
That gap closes with a LoRA on such references or a per-object prompt from someone with an eye,
not with another lever here.

## The wave this opens

Nothing of today's content changes by itself. The depth arrives sprite by sprite, through the
same `kit:gen` path, and the existing inventory is its own reference: an entry whose `ref` is a
kit sprite id (`props/barrel`) redraws that sprite, same design and colours, with `ramps` naming
the materials it is made of and `style: rich` for the hand. The order:

1. The 64 px waves draw with ramps from their first sprite (ART_SYSTEM section 3, "Cost: no
   redraw"); wave a's grounds stay in the core ramps and are remapped per region later.
2. The existing props and items, from themselves: one spec per group (`tools/kit-gen/`), ramps
   per material, best of three, the gallery judged by eye, the picks into the kit with their
   `ramps` and `source`. About three to four minutes of model time per image through the Codex
   agent today; a direct image API call is the step that makes dozens a day cheap.
3. The cast waits for L1 (the outline pick), as decided on 20.10.

## To reproduce the experiment

1. Crops of the objects as PNG under `.scratch/outside/` (ignored), one spec entry each with
   `seen`, `confirmed_by`, `palette: "ramp-added"`, `ramps`, `style: "rich"`, `style_refs` and
   the grid. Start from `tools/kit-gen/example-outside.json`.
2. `pnpm kit:gen <spec> --out .scratch/kit-gen/rich-c1 --timeout 420`, and the same into
   `rich-c2` and `rich-c3` in parallel for best of three.
3. Open each `gallery.html`; pick by eye; write the pick and two sentences per object.

Cost today through the Codex agent: three to four minutes and 30k to 60k tokens per image. The
step for volume is a direct image call in place of the agent, not another lever on the drawing:
`--drawer gemini` ([DRAWERS.md](DRAWERS.md)), ten to twenty seconds per image, on a project with billing:
the free tier has no image quota (proven 21.10).
