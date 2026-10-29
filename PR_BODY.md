feat(game): chunk streaming in the classic client - 3x3 around the player, idle-sliced page bake, the seam under the mist

## What changed and why

NEXT 19 item d. The classic client now streams the world in 64 by 64 tile chunks the way the first map needs: `ChunkStream` (`game/src/stream.ts`) holds the 3 by 3 chunks around the player's, loads on a crossing and drops what is beyond one ring first, so it never holds more than 9. The ground pages (16 by 16 tiles, NEXT 15) of that window are baked by an `IdleQueue`: the pages the view touches are baked at once, the ring around them one page per idle slice (`requestIdleCallback`, a timer where there is none; a slice shorter than the last page waits, at most 120 ms, then runs one page). `GroundChunks` only bakes pages of held chunks. The scene feeds the stream the player's tile; the valley is one chunk, so it plays as before. The kernel is untouched and the 3D door reads the same chunk files (nothing built there).

The seam is under the mist by distance: the window's edge is at least 64 tiles from the player and the mist is solid 11 tiles out, so a page that is not held is never on screen (asserted in a test).

## Measurables

Machine: a cloud sandbox (software canvas, headless Chromium, 480x1040 at device scale 3, camera zoom 12), walking 4.5 tiles a second across two chunk-page borders and the world chunk border at tile 64 on a generated 3x3 test world (192 by 192 tiles, density 4); 3 runs each.

- Chunks held: never more than 9, 9 at the peak, asserted in `game/test/stream.test.ts` on a walk through a 3x3 world crossing 10+ borders and on an 8-chunk walk.
- Blocking work per page: one page's blit (256 tiles of 64x64 into 1024x1024) is 1.1 ms median in vitest; the whole page bake in the browser (software canvas) was 8-11 ms longest, under 16.
- Frame time while walking across the border, p95: before (every ring page built in the update that needs it) 17.0, 17.1, 17.9 ms; after 17.1, 17.4, 19.2 ms. No gain at p95, the frames sit on the 60 Hz tick either way. Longest frame: before 46, 64, 73 ms; after 31, 32, 32 ms.
- Texture memory: 12 page textures, 50 MB, at the end of the walk, before and after (the stream bounds it; the whole 3x3 world baked at density 4 would be about 600 MB).
- The still: `docs/design/frames/ring-stream-border.png` (15 KB), the player on the chunk border at tile 64, the border's faint column runs unbroken across the page seams.

## Not covered

The valley is one chunk, so the live game never crosses a chunk border yet; the loader is synchronous (an async one waits for the chunk files of item e). The frame measure comes from a throwaway harness on generated ground, not the game; the manager's local run on a phone is still needed.

Quest review: clear (no content or quest change).
Story review: clear (no text a player reads).
Source: drawn in code (the still is a screenshot of the test world).
Tree: none: a loader; nothing a player can grow in changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PpsERvMHBzpStswRvDUxwH
