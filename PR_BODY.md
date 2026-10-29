Title: feat(kernel): the move carries a gait - run on hold, sneak as a toggle, the wolf hears by the gait (kernel +1)

## What changed and why

The second gaits pull request (after #410's params). The kernel's `move` action now carries `gait: 'walk' | 'run' | 'sneak'`; the field is optional and absent reads walk, so an old save, an old log and an old client behave as before. A run takes `walk_step_ms` divided by `gait.run_div` (190 ms to 95), a sneak times `gait.sneak_mul` (to 380), both from `gaitStepMs`, and the reach a move may cover in the time that passed follows the gait (also in the server's `validateTravel` check). The wolf's cone (`sees`) reads the gait through one new function, `hearingOf`: the wolf's eyes (5) moved by the noise table (still 2, sneak 3, walk 5, run 8), so a run is seen at 8 tiles, a walk at 5, a sneak at 3; cover and adjacency rules are unchanged. `KERNEL_VERSION` 0.21.0 to 0.21.1 (pins in hp, height-walk, keyed-luck tests updated in one pass).

Client: the thumb held on the stick past 400 ms runs (default hold, one thumb; Shift on a keyboard), a "Sneak" toggle beside A and B (frame D, 16 px, 44 px tap target) sneaks; the body's tween speed is `gaitStepMs`. The local session logs a gait only when it is not a walk. Reduced motion is untouched. ANIMATION.md 5.4 gets the measured wolf pace (walk 293, run 427 px/s) and the pose-count-to-step-time paragraph; DECISIONS.md has the entry.

## Breath decision

No breath bar exists in the player's state (breath is only a refill rate in a fight, `breathRefillPermille`), so a run is free and `gait.run_breath_cost` is not added; it comes with the fight kernel.

## Tests

`pnpm check` 0 errors; `pnpm typecheck` clean; `pnpm vitest run kernel/test game/test`: 86 files, 1047 tests passed; eslint clean on touched files. New tests: step times exact (run = walk/2, sneak = walk x 2), noise table, old move without gait = walk and the reach follows the gait, a bad gait is refused, the wolf sees a run at 8 and not a sneak at 4 (also as a real move). The stealth beat's existing tests pass unchanged (walk is the default).

## Open

- The hop is the owner's; not in this PR.
- The server's move report (`/moves`) carries no gait, so online a run is still validated at the walk's pace; the wire needs the field in a follow-up.
- A standing player is still watched at the walk's cone: the still radius (2) is in the table but nothing reads it yet.
- The sneak button and the 400 ms hold want a phone look from the owner.

Quest review: clear (no quest or content change; the stealth beat keeps its steps).
Story review: clear (no text a player reads except the button's one word).
Source: drawn in code, no picture.
Tree: none: a movement verb on the kernel's clock; nothing a player can grow in changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PpsERvKxa55XKeu8FBTcXZ
