# Layered water study, 2025-10-25

The four 128 px layers (`bed`, `body`, `foam`, `light`) and `provenance.json` are the owner's approved water of 25.10, a
Codex study kept on `art/rich-opening-ground` (commit `de7640f3f`, "Rebuild water study with layered depth light and
broad surf"). `pnpm art:water` reads them: it bakes the open-water tile from the body and light layers
(`tools/src/art/water.ts`) and writes `game/src/waterlayers.ts`, the bed and foam the shore reads per pixel
(`game/src/waterbody.ts`, `game/src/pathedge.ts`). Do not edit the PNGs by hand.
