# Animation: the movement set, the feel layer and how a body is made to move

The owner, 28.10: "movements for everything, smooth and rich ... and the demo activity itself: design, animation, and jump, crouch, run." This page is the frame for that work: what a body can do (the verbs), how each verb is made (drawn, rendered or code), what it costs in frames, and the numbers of the code layer that makes a few frames feel rich. It sits under [STYLE.md](STYLE.md) (the grid and the look), [ART_SYSTEM.md](ART_SYSTEM.md) section 4 (the alive layer of props and the format of clips) and [GAP_DIMRAETH_DRAKANTOS.md](GAP_DIMRAETH_DRAKANTOS.md) section 7 (the art as a production system), and it changes none of them.

**Where it stands (2026-10-29)**
- Decided (the owner, 29.10, the direction gate of section 6): the code bob on the human walk is in (A), four poses are enough for a wolf's walk (B), and two poses plus the code layer is not (C): the code layer sits on top of real poses, at least four a loop, and never replaces them. The rest of the page is the builder's frame, marked **proposal** where a number is a starting point.
- Built: the feel layer's pure module (`game/src/feel.ts`, not yet in the scene) and the gait params (`gait` in `params.json`, `gaitStepMs`, `noiseRadius`). Next: the feel layer into the scene, the quadruped target as a four-pose sheet target.
- The hop (section 2) waits for its own pick.
- Fights wait for COMBAT (G35: no fighting in the demo); the hitstop and shake of section 4 are written and kept unused until a blow lands on a creature (DECISIONS 2026-10-26, the hit feel is not for gathering).

## 1. What exists

- **Humans** are made industrially: a rigged Meshy body, the Quaternius Universal Animation Libraries (CC0), Blender, then a snap to the shared ramps and a scripted ink line. `pnpm anim render <clip>` and `pnpm anim check` run it; the clips are `tools/anim/clips/*.json` and the tool is described in [tools/anim/README.md](../../tools/anim/README.md). Three views are rendered (down, up, left); right is left mirrored.
- **The walk** is free movement over tiles ([walking.ts](../../game/src/walking.ts)): the body moves at pixel precision, the kernel hears of each tile the feet enter, and a step takes `walk_step_ms` (190 ms) a tile. Today the body shows a three-frame stride, one leg per tile ([work.ts](../../game/src/work.ts) `strideFrame`), and people breathe with a 4 percent scale of height.
- **Reduced motion** is read once into `RICH.motion` ([config.ts](../../game/src/config.ts)); every feel effect honours it (G29).
- **The stealth beat** (G47) is a sneak past the wolf's round. **The height walk** (G68) lets a step change level only across a `crossing`.
- **No animal has a body that moves.** The wolf is a pair of eyes by night and a 32 x 16 sleeping prop by day; the clip tool takes humanoid targets only (`mixamo` and `rig19`).

## 2. The verbs

A verb is one thing a body does that the player or the world can read. A new verb that changes the rules is core-only (G45); a verb that only changes how a thing is drawn is content.

| Verb | Status | Made by | Poses | Notes |
|---|---|---|---|---|
| idle | built (breath) | rendered + code | 4 | code: breath and blink (section 4); a creature has four poses at least |
| walk | built | rendered, distance-locked | 8 | **at 190 ms a tile the library walk is far too slow a cycle, see 5.1: the walk-pace clip is `jog`** |
| run | proposal | rendered, distance-locked | 8 | the `gait: run` of the kernel (step time halved) |
| sneak / crouch | proposal | rendered (library `Crouch_Fwd_Loop`) | 8 | the `gait: sneak` (step time doubled); the stealth beat reads it |
| gather / work | built (2 frames) | drawn or rendered | 2 now, 4 target | chop, dig, mine, pick |
| hurt | later | rendered + code | 2 | with fights |
| death / fall | later | rendered | 5 | with fights |
| swim | later | rendered, above a code-drawn waterline | 4 | with the sea crossing |
| hop | **owner's pick** | rendered (library `Jump_*`) | 3 | down one level anywhere, never up, and across a one-tile gap, costing breath; never in the first minute. It changes `makeStepRule` and nowhere else. Versus no hop: crossings only (G68) |

**The gaits** are three paces of one body, carried by the kernel's `move` as `gait: walk | run | sneak` and set by the `gait` group of `content/core/params.json`: a walk is the pace the load allows (`walk_step_ms`, 190 ms a tile when steady), a run takes that divided by `gait.run_div` (2: 95 ms), a sneak times `gait.sneak_mul` (2: 380 ms), every one a whole number of milliseconds. Each is heard at a radius of tiles from the shared noise table: still 2, sneak 3, walk 5, run 8 (`gait.noise_*`; the hunting rules read the same table). On a phone the run is held (one thumb) and the sneak is a toggle button. The run's breath cost waits for the breath bar of COMBAT; until it lands a run costs nothing and the demo's opening has no reason to forbid it.

Animals and monsters have their own sets in BESTIARY (the animals session); this page gives them the same layers.

## 3. The three layers

1. **Drawn.** Faces, a hero frame, the still that is the identity of a creature. A face is about 20 px with 2 to 3 px eyes (STYLE.md section 1) and a small render loses it, so the head is kept from the still wherever a render would smear it.
2. **Rendered.** Body motion: a clip from a library on a rigged body, rendered at the frame size with no smoothing, snapped to the ramps, inked by script. A new clip or a new body costs a render and a check, never a drawing. Humans today; a four-legged body (the quadruped target) after the gate.
3. **Code.** The feel layer: small offsets on top of any sheet, from the clock and the kernel's state. It costs nothing per animal and is the only part that scales to "movement for everything".

## 4. The feel layer (proposal: the numbers are starting points, judged by eye on a preview)

`game/src/feel.ts`, a pure module: state and clock in, offsets out (no Phaser, no randomness except a seeded hash of the thing's id). The world scene applies the offsets to the player, NPCs and creatures. Every effect is zero at rest, so a frame at rest is the sheet's frame. All distances are art pixels at 64 px a tile; one art pixel is 3 device pixels on a 2K phone, so an offset may move in thirds. Under `RICH.motion === false` every row is off, except where the last column says otherwise.

| Effect | What | Starting numbers | Reduced motion |
|---|---|---|---|
| bob | the body rises and falls with the stride | a triangle wave, not a sine; per step 2 px down, 2 px more, then 4 px up back to zero, so 4 px peak to trough on a human (the 1, 1, 2 px of a 32 px figure, doubled for 64 px); rise faster than fall; never below the sheet's own ground. The jog clip's own head travel is already 4 px (measured), so the layer doubles it: gate A (section 6) judges it, and it is dropped for a clip that carries its own bob | off |
| breath | the chest lifts at rest | 1 px on the upper body, a period of 1.0 to 1.5 s, a phase from the id | off (the sheet's frame) |
| blink | two frames of closed eyes | 100 ms every 3 to 5 s, from a seeded hash | off |
| squash and stretch | on a landing, a hop, a hit, a pounce | 1 to 2 px on a 64 to 96 px body, volume kept, 1 to 2 frames | off |
| lean | the body leans into a turn or a run | 1 px along the velocity, eased over 2 to 3 frames | off |
| tail, ear, cloth | a part follows the body | a chain of 2 to 3 segments, one frame of lag each, positions snapped at render | off |
| anticipation, follow-through | a work or attack pose is held at the ends | anticipation 100 to 250 ms, strike 50 ms, follow-through 100 to 300 ms, recover 50 to 100 ms | kept (timing, not motion) |
| hit flash | a struck creature shows white | 2 frames | **off** (G29) |
| hitstop | the swing and the struck thing hold | 50 ms light, 100 ms heavy | halved |
| shake | the camera knocks | 2 px for 50 ms | **off** |

Hitstop, flash and shake exist for fights and monsters only, never for a gathered thing (DECISIONS 2026-10-26: the owner found them too strong on a tree and the flash turned a see-through tree into a white blot). The four strengths that were shown are on the tag `attempt/2026-10-hit-feel`; start from there when a blow exists.

Rotation of a drawn part breaks the pixel grid, so a code part moves by translation and by pre-rendered swap frames; a rotation (a lean of 2 px at the head, a tail swinging in an arc) is the owner's judgement on the live site.

**Measured.** 50 figures cost under 0.3 ms a frame on the reference laptop (a vitest benchmark, the number in the pull request); the opening's frame 0 is unchanged (the layer is zero at rest); frame time at 1440 x 3120 is stated before and after.

## 5. The pipeline in numbers

### 5.1 Pace: how many poses a second a body needs

A distance-locked clip shows the pose that matches the distance walked, so the feet do not slide. At 190 ms a tile the body moves 337 art px a second, and a clip needs `speed / travel_per_pose` poses a second, which must stay at or under 30 (each pose stays two 60 Hz frames; `poses_per_s_max` in [anim.json](../../tools/anim/anim.json)).

| Clip (8 poses, forager) | travel per pose, down / left | poses a second at 337 px/s | at 674 px/s (a run at half the step) |
|---|---|---|---|
| walk | 4.6 / 6.1 px | 74 / 55 (fails) | fails |
| jog | 18.0 / 23.6 px | 19 / 14 | 37 / 29 (down fails) |
| sprint | 19.8 / 25.8 px | 17 / 13 | 34 / 26 (down fails) |

Two consequences for the gaits. The walk-pace clip is `jog`, not `walk`: the library's walk is a stroll and the game's step is a jog. And a run at half the step needs a clip with at least 22.5 px a pose in the down view; the library sprint is 20, so a run needs either a longer-stride clip or a time-driven cycle at the cap with a measured foot slide. The run's step time is a parameter; the pace the owner prefers on a preview decides which.

### 5.2 Frame budgets

| Body | Poses per verb | Poses | Frames at 3 views |
|---|---|---|---|
| human | idle 4, walk 6 to 8, run 6 to 8, attack 6, hurt 2, death 5, gather 4, swim 4 | 37 | 111 (129 with a second attack) |
| quadruped | idle 4, walk 4, run 4, hurt 2, death 4 (attack 4 when it bites) | 18 to 22 | 54 (66 with the bite), inside the cap of 69 |
| bird | flap 4, idle 2, hurt 1, death 2 | 9 | 27 |
| fish | swim 5, idle 2, flop 2 | 9 | 9 to 18 |

Four facings, three of them drawn or rendered (down, up, left) and right mirrored. A hero or a body with asymmetric gear is checked before it is mirrored.

### 5.3 The checks

`pnpm anim check` holds every rendered clip to: the palette (100 percent of opaque pixels in the sheet's ramps), the outline on every frame, the silhouette's area within 10 percent of the view's mean, and foot slide at the game's pace within 1 px. A quadruped adds: four contacts instead of two, a four-beat order (the back leg follows the opposite front leg), and the pose count of its budget.

### 5.4 The quadruped target (proposal, built after the pick)

A body that carries its own actions (the Meshy wolves in `game/public3d/models`, CC BY 4.0, rigged with Idle, Walk and Run, 27 bones) needs no retarget. `anim.json` gains a target with `map: native`: the renderer plays the body's own action by name, samples it at the clip's poses, and skips the library and the retarget step; the camera, the 4x supersample, the snap and the ink line are the human line's. A clip names the body's action, the contacts to track (four feet) and the view.

Measured on the Meshy wolf, left view at 64 px: the walk cycle is 39.1 px of ground and the run cycle 56.9 px. At the wolf's round (`pace_ms` 600, 107 px/s) an 8-pose walk needs 22 poses a second, inside the cap of 30. The run cycle travels 7.1 px a pose, so the cap of 30 poses a second is reached at 213 px/s; a chase faster than that is time-driven (a fixed cycle rate with the foot slide measured), not distance-locked.

The wolf's frame budget is section 5.2's, on the owner's pick of 29.10: four poses a looping verb at least (idle, walk, run), hurt 2, death 4 and, if it bites, attack 4; at three views that is 54 frames or 66 with the bite, inside the cap of 69. The render may sample more than four poses to choose from; the sheet keeps four. The tail and the ears are separate bones, so the tail chain of section 4 can be a swap frame set instead of a rotation.

## 6. The direction gate (Step 0)

Movement for everything changes how every body looks in motion, so it is a direction (AGENTS.md "How work moves"). Three loops at phone size (a 480 x 480 px crop of a 1440 x 3120 frame, 2 s, under 2 MB), one named difference each:

- **A. The human walk-pace clip with the code bob, against the same clip without it.** Tests: does the layer add life or only wobble.
- **B. A quadruped from a library clip through Blender, against four stepped key poses of it.** Tests: does a rendered gait read better than a few poses. The four poses are picked from the render, so this tests frame count, not a hand-keyed drawing.
- **C. The wolf as two poses and the code layer only.** Tests: is the cheapest layer enough.

The loops are 2 s at 60 fps, each panel 160 art px shown at 3x on the game's own ground, the body fixed and the ground scrolling at the clip's pace, the pose chosen by the distance walked. A is a real render; B and C are stand-ins (labelled as such on the loop) because no wolf drawing exists.

**Result (the owner, 29.10, on the pick page, no notes):**
- **A: like.** The code bob is on the human walk-pace clip.
- **B: like.** Four poses are enough for a wolf's walk on a phone, so a quadruped sheet is four poses a loop, rendered through the native target of 5.4.
- **C: no.** Two poses plus the code layer reads cheap. Small animals get real poses too, four at least, with the code layer on top and never instead.

Recorded in DECISIONS.md (2026-10-29). Nothing here has a drawn wolf: the loops used a render of a Meshy wolf already in the repository (CC BY 4.0, rigged four-legged with Idle, Walk and Run) as the source of every pose, and said so; B is a pick about that stand-in.

## 7. Order

1. This page, and one cross-reference line in STYLE.md (this pull request).
2. The quadruped target in the clip tool and the wolf's clips, four poses a loop.
3. The feel layer, pure module first (landed), then applied in the world scene, the bob first.
4. The gaits (`walk`, `run`, `sneak`) in the kernel, params first and in their own small pull request, coordinated with COMBAT's breath and noise numbers.
5. The hop, only on the owner's yes.
6. The opening's activity pass: a run along the path to the bridge, the sneak past the wolf, the hop down the terrace if picked. `game/e2e/opening.ts` is protected; the change is sent to the manager first, and the state tests carry the rest.
