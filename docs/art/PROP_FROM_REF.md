# A prop from an outside picture

How one object in a picture from outside the game becomes a kit-style sprite, through the
pipeline the repo already has: `pnpm kit:gen` draws it with the image model, `kit:import`
brings it onto the grid and the core palette, `gallery.html` shows it beside its reference.
This file is the procedure; `tools/src/kit/gen.ts` refuses an outside reference whose spec
entry skips steps 0a and 0b, so the order below is not optional.

Why it exists: an earlier attempt drew props by code (ellipses, cylinders, a brightness
nudge per round) and let a similarity score steer the rounds. The score rose while the
drawing never became the object, and one run compared a barrel with a stool because a file
name, not a look at the picture, had named the object. Two lessons, now rules: the eye
decides before any number does, and the object is named by looking.

## Rules that override everything else

1. **Nobody draws pixels by hand or by code.** No shape primitives, no hand-written letter
   grids for an organic prop, no "darken the bottom-left". The image model behind `kit:gen`
   draws; you own the reference, the spec, the import and the judgement.
2. **Every round you look before you decide.** Open `gallery.html` (reference beside result,
   3x phone size) and write two sentences on what is wrong. A score may sit beside the eye,
   never replace it. If your tooling cannot show you an image, stop and say so.
3. **Style-similar, not a copy.** The result reads as this kit, never as the source's asset.
   The reference says *what* the object is; existing kit sprites say *how* we draw.
4. The repo rules hold: `AGENTS.md`, `docs/team/PARALLEL.md`, a worktree per branch, the pull
   request into `develop`, nothing written into `content/`, never `kit:sketches`.

## Step 0a: name the object by looking (wait for confirmation)

Crop the region at native resolution (PNG, not a re-encoded JPEG) with an exact mask. Look at
the crop and write, in plain words: what the object is, its material, its proportions, where
the light comes from. Do not reuse a name from a file or an earlier run. Stop and wait for the
owner to confirm or correct. The confirmed words go into the spec as `seen`, the person into
`confirmed_by`; without both, `kit:gen` refuses the entry.

## Step 0b: the palette decision (before the first call)

Read the object's hue families and step counts from the crop and set them against
`tools/src/kit/palette.ts`: the 32 core colours, and the shared ramps of palette v2 (`CORE_RAMPS`,
13 ramps of six steps; `DECISIONS.md` 2026-10-21 "The palette deepens"). Answer in one line and
write it into the spec as `palette`:

- `fits`: the hues exist in the 32 with enough steps. Continue; the sprite names no ramp.
- `restyle`: they do not, and the owner accepts the object redrawn into the 32 (a plum object
  against two purples). The sprite names no ramp.
- `ramp-added`: the object draws in shared ramps; name them in the spec's `ramps` (one to four,
  the first gives the outline: `["wood", "green"]`). The importer allows the 32 plus those
  steps, the manifest line carries the names, and the sprite's kit entry repeats them in its
  `ramps`. A material no shared ramp holds is an owner decision: a new ramp in `palette.ts`,
  in its own pull request, before the first call.

`kit:gen` refuses an outside reference without one of the three, and `ramps` without `ramp-added`.

## Step 1: the references

- The crop, as `ref` in the spec (a PNG path from the repo root that is not under
  `content/kit/`; that is what marks the entry as an outside reference). `kit:gen` enlarges it
  onto flat magenta itself.
- Two or three existing kit props of the same class, open beside you as the style compass.
  Their outline weight, light direction and shading depth are what "our style" means in the
  prompt.

## Step 2: the spec and the call

One entry in a spec under `tools/kit-gen/`: `name`, `ref`, `what` (the confirmed words,
short), `seen`, `confirmed_by`, `palette`, the grid (64 x 64 per `DECISIONS.md` 2026-10-18
unless the class says otherwise), `anchor`, and `detail` that spells out the parts the model
should draw. Run `--dry` first and read the prompt and the prepared reference under `ref/`.
Then one real call. The prompt for an outside reference asks for the same object in our
style, not a copy, and carries the palette decision; see `buildPrompt` in `gen.ts`.

## Step 3: import and look

`kit:gen` imports the picture itself. Open `gallery.html` at 3x phone size, reference beside
result. Write down: silhouette, material, colours inside the allowed ramps, outline and seam
against the neighbouring kit props. The gallery's colour count must be all core palette.
Detail is judged only at this size: if the reference looks richer here, the gap is grid or
palette; if not, it was blur in the source.

## Step 4: at most three rounds

Each round changes one thing in `what`, `detail` or the crop, from what you saw, and records it:

| round | what I saw (two sentences) | the one change | verdict |
|---|---|---|---|

Stop when the sprite passes the eye or after round three. No score chase. Raw results stay
under the output folder; `manifest.jsonl` keeps each source.

## The pull request

- The gallery entry, reference beside result at size.
- The `seen` words and the `palette` answer, and who decided each.
- The rounds table.
- One honest line: ready for the kit by hand in a wave, or not, and why.
- `pnpm verify` 0 (and the e2e when `game/` changed).
