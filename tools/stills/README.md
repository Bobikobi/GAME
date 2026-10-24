# Stills

The scripts that compose the direction stills. The ladder's command re-makes the 2026-10-20 art ladder and checks every frame:

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

The nature sheets (scale, climate, season, weather, shade) re-make the same square through the tables of `nature.json`, the tables of [NATURE.md](../../docs/design/NATURE.md) as data:

```sh
python3 tools/stills/nature.py
```

Twelve frames, one difference each, and the distinct colours of every frame printed. `compose.py` takes a `Sun` (where a shadow falls, how dark, the cloud and canopy shade) and the climate's own far bank, tree and grass; with none given it makes the ladder's frames unchanged. The sheets and their numbers: [2026-10-21-nature.md](../../docs/design/frames/2026-10-21-nature.md).
