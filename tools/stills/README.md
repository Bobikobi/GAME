# Stills

The scripts that compose direction stills. One command re-makes the 2026-10-20 art ladder and checks every frame:

```sh
python3 tools/stills/compose.py
```

Pillow only. It reads the checked-in Pell sprites in `inputs/`, writes the eight frames to `docs/design/frames/`, and fails if a pixel is outside the ramps the frame declares or a frame is not 1170x2532. No network and no model call. The scene and the exact numbers are in [2026-10-20-art-ladder.md](../../docs/design/frames/2026-10-20-art-ladder.md).
