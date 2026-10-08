# The asset path: pixel now, 3D sources as the cast grows, a 3D valley as the aspiration

Written 2026-10-08 for the owner, after the asset question of that day: which
tools draw and animate the valley, and how the art survives the game's growth.
The direction recorded here, which the merge of this page makes the owner's
word: the animation may change shape as the game grows; the aspiration is a
3D world of the World of Warcraft kind, on new engines; for now the concept is
built in pixel art.

Sizes are by code complexity and the hardware a step needs, never by hours.

## 1. Where the art stands today

- Items and tiles are 16x16, character frames 16x24, work poses 32x32 in two
  frames, props up to 64x64; the 32 colours of the core palette; every pixel
  fully clear or fully solid ([docs/creators/README.md](../creators/README.md)).
- `pnpm kit:import` snaps any picture to the grid and the palette, with an
  optional one-pixel outline. The kit check refuses what does not fit.
- The client is Phaser 4, 2D, tile maps, four facings (down, left, up; right
  is left flipped). Nothing in `content/`, `kernel/` or `schema/` knows the
  renderer.
- No tool draws a new sprite or a walk cycle. A creator draws by hand or
  pastes an AI picture into the importer, one frame at a time.

## 2. The sidecar: universal-modder

[universal-modder](https://github.com/rehan-remade/universal-modder) (MIT,
Python) is a toolkit for AI agents that mod PC games. Most of it is not for us:
engine recon, reverse engineering, Windows automation, mashups, a mod hub.
Three parts are exactly the gap in section 1, and they are the adopted slice
([TOOLKIT.md](TOOLKIT.md) section G, DECISIONS.md 8.10):

| Part | What it gives us | Needs |
|---|---|---|
| `um sprite` | `frames` (an idle from one frame: bob, squash, wobble, flash), `sheet` and `slice`, `fit` with nearest neighbour, `palette` (snap to a reference sprite), `pixelate`, `preview` | Python 3.10 or newer, Pillow, numpy. Free. |
| `um fal` | `sprite` (a transparent background from a prompt), `edit` (the same character in a new pose: the frames of a walk), `pixelate`, `rmbg`, `sfx`, `music`, `voice`; every generation logged with its seed in `fal_manifest.jsonl` | A fal.ai key, pay per use, on the creator's own account. |
| `um fal model3d`, `um fal rig`, `um render3d` | A textured 3D model from one picture, an auto-rig with walk, idle and die, frames rendered from the game's camera in 8 headings, consistent across the cast | Blender on one machine; a GPU helps, a CPU does at our sizes. |

Proven on 8.10 on a laptop with Python 3.14 and no GPU: `um sprite frames` on
`content/kit/core/chars/elder.png` gave three 16x24 frames, alpha 0 or 255
only, the eleven colours untouched; `um sprite sheet` packed them. Nothing ran
against fal (no key yet; recommendation 1).

How it is installed: in its own virtual environment, never as the Claude Code
plugin (a plugin puts eleven skills and the fal tools into every session's
prompt):

```
python3 -m venv um-venv
um-venv/bin/pip install git+https://github.com/rehan-remade/universal-modder
```

The fal key lives in the creator's shell (`FAL_KEY`) or a `.env` outside the
repository; the pre-commit gitleaks scan refuses a key in a commit. An agent
that wants fal's model search and prices inside a session can add fal's hosted
MCP server to its own user config, not to `.mcp.json` (every session in the
repository would pay for the tool definitions):

```
claude mcp add --transport http fal https://mcp.fal.ai/mcp --header "Authorization: Bearer $FAL_KEY"
```

The recipe for one character, which is also the first trial (Maru):

```
um fal sprite "elderly village elder, long brown coat, white beard, standing, facing the viewer, 16-bit pixel art, dark outline, flat white background, no shadow, no text" --name maru
um fal edit "same elder, left foot forward, mid-step, walking, frame 2 of 4" --ref assets/gen/maru.png --name maru_walk_2
pnpm kit:import assets/gen/maru_walk_2.png content/kit/core/chars/maru_walk_2.png 16 24
um sprite frames content/kit/core/chars/elder.png frames/ --n 3 --kind bob     # an idle, no key needed
um sprite preview frames/elder_1.png look.png --scale 8                        # look before shipping
```

The importer is the last word on size and palette; `um` is upstream of it.
`um sprite fit --size 16x24 --anchor bottom --hard-alpha` goes before the
importer only when a picture's margins are uneven: scale pixel art once, with
nearest neighbour, never twice. One hero image, then edits for the frames; a
whole sheet from one prompt comes out uneven. Judge the result in the game at
1x on a phone, next to the stock sprites, before batching.

## 3. The three stages and what triggers each

| Stage | What the art is | Tools | Trigger to move on |
|---|---|---|---|
| 1. The concept (now) | Pixel art by the kit rules; idles from `um sprite frames`; walks from `um fal edit` frames through the importer; sounds from `um fal sfx` and `music` (rules G24-G27 want every beat to have a sound) | Section 2 | P-3 content is in and the first creators ship kits |
| 2. Growth: 3D sources, a 2D game | Every character and prop from a 3D model (`model3d`, `rig`), rendered to sprites in the `topdown` preset with `render3d`; walk, idle, work and die from the rig, the same across the cast; the game stays Phaser 2D and `content/` does not change | Blender on one machine; the GLB files kept as the sources | The cast outgrows what one hand keeps consistent, or the kit check starts failing on consistency; the owner's call, with the hub's usage numbers |
| 3. The aspiration: a 3D valley of the World of Warcraft kind, on new engines | A 3D valley on the same kernel and content | A browser 3D engine (section 4); the GLB sources of stage 2 are the models | A community and play data that carry it. A decision of the kind of ownership, conquest and towns (6.10): not in the spec now |

The size of stage 3 in plain words: a persistent 3D world with many players is
a different order of code (netcode, servers per region, a 3D art pipeline, a
client rewrite) and of hardware (game servers, not a static site). Nothing
here starts it. What this page does is keep it possible.

## 4. What to keep now so the later stages are cheap

1. Content and kernel never learn the renderer. True today; keep it in review
   (no Phaser type in `content/`, `kernel/` or `schema/`).
2. Every generated sprite keeps its source. An optional `source` field on a
   kit sprite entry: the concept image or the GLB it came from under
   `assets/gen/`, and its `fal_manifest.jsonl` line. Cheap now; in stage 2 the
   GLB is the asset and the PNG is a render of it.
3. World units are tiles of a known size; a 3D world maps tiles to metres.
   Already so.
4. Animation names, not frame indexes, in content when animation reaches the
   schema (`idle`, `walk`, `work`): the renderer resolves them, 2D now and 3D
   later.
5. Engines to look at when stage 3 is real, all browser-native and open:
   Three.js and Babylon.js (TypeScript, fit the monorepo and Vercel),
   PlayCanvas (engine MIT, editor hosted), Godot 4 web export (its own editor
   and language, a separate repository). Unity and Unreal in the browser are
   heavy downloads and do not fit a free game on a static site. No choice
   before the data.

## 5. Recommendations for the owner

1. Open a fal.ai account for the project and keep the key in your own shell.
   Prices change weekly: `um fal price <endpoint>` before a batch, a small
   prepaid balance for the first cast.
2. Run the Maru trial of section 2 and judge it in the game on a phone. If it
   holds, the recipe becomes the creators' path in docs/creators/README.md.
3. Add the `source` field to the kit schema in the next schema pull request
   (P-2 is open; a one-field addition rides along or follows it).
4. Keep Blender and the 3D route off the critical path until the stage-2
   trigger. One evening on one character is enough to know the route works on
   a CPU.
5. Choose the stage-3 engine only with data, and write the trigger in
   DECISIONS.md the day it fires.

## 6. Not adopted from universal-modder, and why

- The Claude Code plugin install: eleven skills and the fal tools in every
  session's prompt; the CLI in a virtual environment does the same work on
  demand.
- `um scan`, the reverse-engineering and game-automation skills, `um win`,
  mashups, `publish-mod`: for modding other people's games. We own ours.
- `um kb`, the shared field notes: a good pattern, already ours in another
  shape (the loop, the hub, the MCP server of M4).
- `um comfy` (a local ComfyUI server): needs a GPU; fal is the cloud route.
- The showcase-video skill and `um video`: later, for the site's trailer, when
  there is one to cut.
