# Library motion to pixels

`pnpm anim` turns a clip of a free animation library into a sprite strip: retarget the motion onto a body, render
it, snap it to the palette, and measure it. Nothing it makes enters `content/`; every output lands in
`tools/.cache/anim/` (ignored), until the owner picks the look.

```sh
pnpm anim fetch            # download each library by URL, refuse it unless its sha256 matches, unpack the glb
pnpm anim list             # the clips, what each is made of, whether the libraries are fetched
pnpm anim render walk_torch chop      # or --all; needs Blender (below)
pnpm anim check            # the four measures of every rendered clip; exit 1 on a failure
pnpm anim render chop --target digger-f   # the same clip on another body of the cast (anim.json targets)
```

`--target <id>` moves a clip onto another target for render or check: the motion, prop, set pieces and frame stay,
the body, its scale and its ramps are the target's, and the output goes to `tools/.cache/anim/cast/<id>/<clip>/`.
A model whose skeleton lacks a bone its map drives is refused in one line before a frame is drawn.

Blender 5.2 (any recent 4.x or 5.x with the glTF importer should do) is found by `BLENDER`, else
`tools/.cache/anim/local.json` (`{"blender": "/path/to/blender"}`), else `blender` on the `PATH`. No add-on.
`ANIM_THREADS` sets the render threads (default: all cores but two). On a shared machine, run a render inside
whatever admission the machine uses for heavy jobs: a clip of eight poses in three views is about a minute of CPU.

## What is where

| File | What |
|---|---|
| `libraries.json` | each library: its itch.io page and upload name, exact bytes and sha256, licence, the in-place glb inside the archive, every action's length in frames |
| `anim.json` | the tile size (64 px: today's 16 px tile shown at 4x, the scale the cut-out demo draws at), the paces (read from `content/core/params.json`), the limits of the check, the targets (the forager and the rest of the cast of `game/public3d/models/`, each with its credit line; an optional 19-bone body rig from `ANIM_RIG_BLEND`) |
| `clips/<clip>.json` | one clip: the base action and its frames, an optional bone-mask layer, an optional IK overlay, a prop, set pieces and worn parts, the frame size and anchor, the views, the time per pose, locomotion playback |
| `blender/render.py` | the Blender half: retarget, layer, IK, props, two renders per view (lit, and a flat ID pass) |
| `tools/src/anim/` | the TypeScript half: configs, fetch (with the zip reader), snap, measures, the CLI |

Outputs, per clip, in `tools/.cache/anim/out/<clip>/`: `<clip>_<view>.png` (the strips, frames side by side, right =
left mirrored), `<clip>.json` (frame, anchor, `ramps` (the shared ramps the sheet draws in: what a kit entry for it names, so `pnpm check`'s rich rule takes it at density 4), time per pose; for locomotion the playback and the art px walked per
pose in each view, what a player needs to lock the feet), `measures.json`, `sprites/` (each frame), `raw/` (the
supersampled renders, the ID pass, the projected feet) and `job.json` (what Blender was given).

## A clip

```json
{
  "about": "Walking with the torch: the library walk, the torch arm taken from the torch idle at the same phase.",
  "target": "forager",
  "base": { "library": "ual1", "action": "Walk_Loop" },
  "frames": { "even": 8 },
  "layer": { "library": "ual1", "action": "Idle_Torch_Loop", "mask": ["arm_l"], "frame": "follow" },
  "prop": { "kind": "torch", "hand": "L" },
  "frame": { "size": [128, 128], "anchor": [64, 112] },
  "views": ["down", "up", "left"],
  "locomotion": { "playback": "distance" }
}
```

- `frames`: a list of the base action's frames, or `{ "even": n }` spread over the whole action (locomotion must be
  even: one step per pose). `ms` gives the time per pose; left out, a pose lasts until the next picked frame at the
  library's 24 fps.
- `layer`: the bones of each `mask` (`arm_l`, `arm_r`: clavicle to fingers) are taken from a second action, at a fixed
  `frame` or at the base's phase (`follow`). Local rotations, so the layered arm rides the base's spine.
- `ik`: one wrist moves along a Catmull-Rom curve through the `points` (metres, body axes: x outward on the tool side,
  y forward, z up), from the `shoulder`, offset from the library's own `wrist`, or at fixed spots by the body (`body`:
  from the floor under it, so the hand meets a plant on the ground; a point may then name a worn part, and the hand
  goes to its top); `t` places each pose on the curve (0 to 1); `pole` bends the elbow; `floor` keeps the hand that
  far above the lowest point of the body. Only the upper arm, forearm and hand are solved; every other bone keeps the
  library pose. No key is set by hand.
- `prop`: `hatchet`, `pick`, `torch`, `trowel`, `crate`, `seedbag`, `sprig`, `berries`, built by the renderer from
  boxes, cones and spheres, gripped from the library hand (`from: hand`) or laid along the IK arc (`from: ik`);
  `poses` shows it only on those poses (a sprig appears once it is picked).
- `set`: pieces fixed on the ground by the body, `herb` (a leafy tuft, about 0.32 m) and `bush` (a berry bush, about
  0.8 m), at `[x, y]` metres in body axes on the IK side, `size` scaling them. They turn with the body in each view.
- `worn`: parts carried on the hips, `pouch`, at `[x, y, z]` metres from the hips joint in body axes.

## The four measures, and what fails

1. **Palette**: every opaque pixel is in the clip's ramps (`tools/src/kit/palette.ts`), the fire ramp, the
   target's metal and leaf ramps, or the one ink `#1b1a2e`. Fails under 100 %.
2. **Outline**: every frame has the 1 px ink edge all round, and nothing touches the frame's edge. The ink colour and the
   edge are the kit's one definition (`tools/src/kit/ink.ts`), the same that `pnpm check` (`art.ink`) and `pnpm kit:ink`
   use; `anim.json` holds no outline setting of its own.
3. **Silhouette** (locomotion): the opaque area of each frame against the view's mean. Fails over 10 % (the jog
   and the sprint move it to 15 %: side-on their spread stride changes the area, with no limb lost).
4. **Foot slide at the game's pace** (locomotion): the ball of each planted foot, projected to art pixels by the
   renderer, against a foot fixed on the ground while the sprite moves at the game's light, steady and heavy pace
   (one 64 px tile per `load.light_step_ms`, `walk_step_ms`, `load.heavy_step_ms`). The travel per pose is fitted
   from the feet at every source frame. With `distance` playback the pose follows the distance walked, so the slide
   is the residual at whole pixels; with `time` playback the poses keep their own time and the slide is the drift
   over a planted run. Fails over 1 px. With `distance` playback it also fails when the clip needs more than 30
   poses a second at a pace (`poses_per_s_max`): each pose would be on screen for under two 60 Hz frames, which
   means the stride is too short for the speed.

A clip's own `limits` may move a line, with the reason in its `about`.

## How a frame is made

The libraries (Quaternius Universal Animation Library 1 and 2) share one 65-bone skeleton, so every action of both
plays on one source armature. Trunk, head and legs copy the source bone's world rotation relative to its rest pose;
arms and hands are aimed along the source's bone directions (the library is in a T pose, the forager in an A pose)
with the source's twist; the hips travel by the leg-length ratio; each pose is lowered until the body touches the
floor. The render is orthographic Cycles on the CPU at 4x the frame (flat albedo, one sun, a grey ambient), and a
second pass draws each object in one flat colour: body, flame, tool metal, leaves. The snap takes each sub-pixel to the
nearest colour (CIELAB) its class may use, each 4x4 block to one pixel by majority (opaque when at least half is),
and adds the outline outside the silhouette. The left view is rendered facing right and mirrored.

## Licences

- Universal Animation Library [Standard] and Universal Animation Library 2 [Standard], by Quaternius: **CC0 1.0**
  (`License.txt` in each archive; the itch.io pages say "Creative Commons Zero v1.0"). The archives are fetched,
  never committed. Quaternius' site now also shows a "Quaternius Asset License v1.0" (no reselling or
  redistributing the assets themselves); rendered frames are not the assets.
- The forager and the rest of the cast (`game/public3d/models/character-*.glb` but the two Kenney minis): made with
  Meshy, **CC BY 4.0**. A sprite rendered from one is a derivative and carries that model's credit line from
  `game/public3d/models/README.md` (each target's `credit` in `anim.json`, written into every `<clip>.json`).
- A target's body ramps: the two shared ramps, plus `skin`, whose steps leave the smallest mean CIELAB error over the
  model's colour map (for the forager this gives the hand-picked `wood`, `red`, `skin`).
- Blender is a tool (GPL); its output is ours. The props are built in `blender/render.py`.
