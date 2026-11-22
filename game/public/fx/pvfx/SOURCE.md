# PVFX Foundry effects (four sheets)

- **Pack:** PVFX Foundry 1.0.0, by Pixel VFX Studio. Licence **CC0 1.0** (`LICENSE.txt` here is the pack's own file; the pixelfx toolkit's MIT notice that ships with the pack is in `THIRD_PARTY_NOTICES.txt`).
- **Reached through:** github.com/Sunghwan0112/spritecast, commit `bb140db0f5e16189b691ea5e69f458bee827f81b` (v0.26.0), `skills/spritecast/effects/pvfx/<category>/<name>/sheet.png` and `manifest.json`.
- **Used unchanged** (no recolour, no resize; the sheets are copied byte for byte and played at the rich scale, 64 art px a tile):

| file | pack effect | frame (px) | frames | wrap | ms a frame | pivot |
|---|---|---|---|---|---|---|
| `hit-spark.png` | hit-spark | 64 x 64 | 8 | 8 | 80 | 32, 32 |
| `crit-hit.png` | crit-hit | 96 x 80 | 11 | 8 | 70 | 48, 40 |
| `landing-dust.png` | landing-dust | 88 x 46 | 12 | 8 | 70 | 44, 40 |
| `campfire.png` | campfire | 40 x 56 | 12 | 8 | 75 | 20, 50 |

- **Where each plays:** `game/src/effects.ts` (the numbers above, held to the real sheet sizes by `game/test/effects.test.ts`) and `game/src/effect-layer.ts`.
- **Palette:** the sheets carry the pack's own colours, which are not the 32 core colours of the kit, so they are not kit sprites and sit outside `content/kit/` (like the other `fx` pictures). `pnpm check` does not read them. Whether they should be mapped onto the core ramps later is the owner's call.
- **Not taken:** `metal-clang` waits until blades fight.
