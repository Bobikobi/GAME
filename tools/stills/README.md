# Stills

The scripts that compose direction stills. One command re-makes the 2026-10-20 art ladder and checks every frame:

```sh
python3 tools/stills/compose.py
```

Pillow only. It reads the checked-in Pell sprites in `inputs/`, writes the eight frames to `docs/design/frames/`, and fails if a pixel is outside the ramps the frame declares or a frame is not 1170x2532. No network and no model call. The scene and the exact numbers are in [2026-10-20-art-ladder.md](../../docs/design/frames/2026-10-20-art-ladder.md).

The nature sheets (scale, climate, season, weather, shade) re-make the same square through the tables of `nature.json`, the tables of [NATURE.md](../../docs/design/NATURE.md) as data:

```sh
python3 tools/stills/nature.py
```

Twelve frames, one difference each, and the distinct colours of every frame printed. `compose.py` takes a `Sun` (where a shadow falls, how dark, the cloud and canopy shade) and the climate's own far bank, tree and grass; with none given it makes the ladder's frames unchanged. The sheets and their numbers: [2026-10-21-nature.md](../../docs/design/frames/2026-10-21-nature.md).

The lighting ladder (2026-10-30) composes over a real screenshot of the game instead of a drawn square. `lighting-shoot.mts` takes the base from a build in a headless Chrome; `lighting.py` (Pillow and numpy) lays the rule-placed layers over it and writes the four frames:

```sh
python3 tools/stills/lighting.py
```

The numbers are in [LIGHTING.md](../../docs/design/LIGHTING.md) section 3.

The tint comparison (LIGHTING.md section 5, question 1) renders the 17:30 and 19:00 squares at five tint strengths each, measures them and the references of `refs/refs.json` in CIELAB with `tools/src/light/tint.ts`, and writes the two boards `docs/design/frames/2026-10-30-tint-compare-1730.png` and `-1900.png`:

```sh
python3 tools/stills/tint_compare.py
```
