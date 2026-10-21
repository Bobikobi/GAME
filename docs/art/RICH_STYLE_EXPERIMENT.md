# The rich-style experiment (2026-10-21)

How close can an outside picture's richness get through `kit:gen` when the style line, the
palette and the importer change, and nothing else? Branch `exp/rich-style`, built on
`docs/prop-from-ref` (the procedure in [PROP_FROM_REF.md](PROP_FROM_REF.md) and its locks).

Result: the imported sprite went from about a quarter of the reference's colour richness
to about half to four fifths, in one round, on five objects from one clean 1920x1080 scene.
The sheet of our outputs: [2026-10-21-rich-style-sheet.png](frames/2026-10-21-rich-style-sheet.png);
the five imported sprites are under [frames/rich/](frames/rich/). The reference picture is
third-party art and is not in the repository.

## What changed, each behind `"style": "rich"` in a spec entry

| lever | where | what |
|---|---|---|
| 1. style line | `gen.ts` `buildPrompt` | "painterly pixel art: hue shifts inside a surface, ambient light, material texture, an outline that follows its surface" instead of "limited palette, two-tone shading" |
| 2. deeper palette | `palette_rich.ts` | 92 experimental colours: 13 hue families in 7-step ramps with a hue shift (cool darks, warm lights). `palette[0]` stays the outline navy |
| 3. dither on import | `import.ts` `dither` | a 2x2 ordered pattern between the two nearest palette colours where the source sits between them; a clear colour stays flat |
| 4. clean references | the spec | PNG crops at native resolution, never a re-encoded screenshot |
| 5. style examples | `style_refs` | two other crops from the same scene attached after the reference; the prompt says to match their shading, hue shifts, texture and outline |
| 6. best of three | three parallel `kit:gen` runs | the operator picked by eye; a judge model that only rejects is the next step |
| 7. grid by need | the spec | tree 128x144, bridge 256x128, bench 64x40, signpost 48x64, mushrooms 32x32 |

Kit references (`"style"` omitted) are untouched: the core palette, no dither, the old line.

## Measured

Significant colours = colours covering at least 0.4% of the pixels at 5 bits per channel, the
measure `DECISIONS.md` 2026-10-20 used. Ours is the imported sprite; the earlier row is the
same pipeline on the core palette the same evening (a barrel from another picture).

| object | reference | ours, rich | best of | model seconds | model tokens |
|---|---|---|---|---|---|
| autumn tree | 48 | 24 (37 distinct) | c3 | 166-206 | 36k-59k |
| stone bridge | 52 | 22 (42 distinct) | c2 | 149-191 | 32k-54k |
| bench | 46 | 19 (22 distinct) | c1 | 177-221 | 47k-54k |
| signpost | 42 | 35 (47 distinct) | c3 | 172-245 | 29k-39k |
| mushrooms | 35 | 21 (32 distinct) | c3 (two candidates timed out at 420 s) | 420 | - |
| barrel, core palette, earlier | 37 | 22 of a 32-colour palette | - | 160 | 59k |

13 of 15 images came back; the two timeouts were the smallest object. The grid warnings fired
on the tree in all three runs ("drawn on about 165x170, voted to 128x144") and on the
mushrooms; both would take the warning text as a second-round prompt.

By eye at 3x phone size: the signpost is close to its source; the bench and the bridge read as
the same objects in a cleaner hand; the tree keeps the cluster logic and the olive shadow but is
tidier than the source; the mushrooms are clean and too large. What remains is not colour, it
is hand: the source is deliberately dirty (single leaves, moss, wear) and the model draws clean.
That gap closes with a LoRA on such references or a per-object prompt from someone with an eye,
not with another lever here.

## What this is not

Not a kit change. `DECISIONS.md` 2026-10-20 records that the 32-colour palette, not the 64 px
grid, is the binding ceiling, and that changing it is an owner decision under GAME_RULES
section 6. This branch gives that decision its evidence: the same objects, the same model, the
same importer, only the palette and the style line differ. The owner's pick, when made, goes
into `DECISIONS.md` with its frame; until then nothing here reaches `content/`.

## To reproduce

1. Crops of the objects as PNG under `.scratch/outside/` (ignored), one spec entry each with
   `seen`, `confirmed_by`, `palette`, `style: "rich"`, `style_refs` and the grid. Start from
   `tools/kit-gen/example-outside.json`.
2. `pnpm kit:gen <spec> --out .scratch/kit-gen/rich-c1 --timeout 420`, and the same into
   `rich-c2` and `rich-c3` in parallel for best of three.
3. Open each `gallery.html`; pick by eye; write the pick and two sentences per object.

Cost today through the Codex agent: three to four minutes and 30k to 60k tokens per image. The
next step for volume is a direct image API call in place of the agent, not another lever on
the drawing.
