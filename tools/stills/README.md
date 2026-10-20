# Stills

The scripts that compose direction stills. One command re-makes the 2026-10-20 art ladder and checks every frame:

```sh
python3 tools/stills/compose.py
```

Pillow only. It reads the checked-in Pell sprites in `inputs/`, writes the eight frames to `docs/design/frames/`, and fails if a pixel is outside the ramps the frame declares or a frame is not 1170x2532. No network and no model call. The scene and the exact numbers are in [2026-10-20-art-ladder.md](../../docs/design/frames/2026-10-20-art-ladder.md).

The stepping-stone library has its own command:

```sh
python3 tools/stills/stones.py
```

It writes 18 original 1x stones and a manifest to `tools/stills/stones/`, and the two 390x844 (3x) sheets `2026-10-20-stones-options.png` and `2026-10-20-stones-recipes.png` to `docs/design/frames/`. It never writes the game's content and calls no model.

The ladder's path uses recipe A from the library: 12 stones on the trail and 4 loose, with random sizes. The `compose.py` run draws it; there is no separate proposal file.
