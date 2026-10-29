# fix(content): the hall's road stays open after the log is felled - measured by reach, no fix needed

## Measurement: no fix needed

Measured with the kernel step rule (`makeStepRule`) through `walkBitmap` and `walkFrom` (the BFS the reach tool and the difficulty reckoning use), on the valley as it stands, each state with the ready logs taken off the map in a copy of the bundle.

| From | To | Log standing | Log felled | Detour |
|---|---|---|---|---|
| north-meadow wake (7,6) | hall | 63 steps | 63 steps | 0 |
| slid-bank wake (9,23) | hall | 54 steps | 54 steps | 0 |
| west-bank wake (6,17) | hall | 55 steps | 55 steps | 0 |
| hall (open tile beside it) | town square | reachable | reachable | 0 |

Why: `core/fallen-logs` is not `solid` (only a tree is, DECISIONS 2026-10-10), and `makeWalkable` blocks only solid resource nodes. Felling the log at 45,25 (`core/fallen-logs#2`) therefore moves no foot. The terrace gap at 39,29 has no crossing, but the way never ran through the log. All three wakes reach the hall and the hall reaches the town in both states. The step rule is symmetric, so reachability holds both ways. The longest detour is 0 tiles.

Added `tools/test/hall-road.test.ts`: the reachabilities (3 wakes to the hall, hall to town, each with the log standing and felled) plus an assertion that felling changes no distance. It guards against anyone making the log solid.

No content changed, so the opening's steps and stills are untouched, `game/e2e/opening.ts` is not touched, and no DECISIONS entry is written.

Checks: `pnpm check` passes (0 errors, no new `!` lines). `pnpm typecheck` reports 2 errors, both a missing generated `bundle.json` in `game/`, not from this change. The new test passes. No `docs/team/state-tests` script exists in this tree, so none ran.

## Open for the owner
Nothing. The finding in #405 is not a real stuck state.

Quest review: clear (the opening's steps unchanged; the hall's road measured open by day in every state).
Story review: clear (no text a player reads; no claim about the past).
Source: none (a measurement, no picture).
Tree: none: a road's crossing; nothing a player can grow in changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PpsERtN5WAx4NfCacXPLoK
