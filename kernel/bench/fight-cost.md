# Fight tick cost — 14 November 2026

Run from the repository root with `pnpm exec tsx kernel/bench/fight-cost.ts`.
No package script or dependency is added. Node v24.22.1, same managed Linux
machine for both runs; times are observations, never test assertions.

Each row measures 2,000 consecutive returned-world ticks after 200 warm-up
ticks. Times exclude input construction, appearance/rejoin setup and JSON
serialization. Percentiles use nearest rank; bytes are one UTF-8
`JSON.stringify` of the starting world. The before run uses unchanged develop
`df3270f3b080a35852b13d831f880a2e828fe871` (`fight.ts` SHA-256
`27a469b247db1e8668d6b18265552ba8438b3cb2b85e58650c5561fd99c775fd`).
The fixture was recorded and committed before the tick changed.

The map is the existing fight test's open meadow, enlarged to a 64 × 64 chunk.
Every account is constructed by `newState` and filled by `step` actions: legacy
forager start, gathering, dropping and retrieving goods, including automatic
quest accounting. A prepared account has all 12 bag places occupied, 80 node
records (36 still resting), one completed quest and one active quest. Herbs
have zero weight in live content, so the full bag remains legal without raising
might or changing capacity, item weights or timing parameters.

Idle rows have no inputs or engaged players, with up to 20 ordinary wolves
standing away from the accounts. Busy rows keep min(players, 20) independent
player/wolf pairs on a grid 12 tiles apart; other accounts stand at [62, 62].
Every engaged account sends one input each tick: strikes, held/released guard
and dodge. When a pair ends, constructors renew it outside the timed call;
otherwise the run would measure the wolves' long refill instead of busy ticks.
The grid, renewal rule, input schedule and account histories are identical in
both runs. All existing fight timing and damage values are retained, with the
same zero knockback used by the test arena.

## Before

| players | case | median µs | p95 µs | p99 µs | world bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | idle | 62.48 | 82.20 | 102.48 | 6616 |
| 1 | busy | 74.30 | 121.03 | 150.87 | 6655 |
| 20 | idle | 2643.10 | 3573.44 | 7472.53 | 131871 |
| 20 | busy | 3589.57 | 4824.38 | 5911.01 | 132771 |
| 50 | idle | 12490.90 | 14222.15 | 16713.94 | 317721 |
| 50 | busy | 14531.03 | 18270.48 | 36483.74 | 318621 |
| 200 | idle | 153305.01 | 167427.42 | 186843.23 | 1247071 |
| 200 | busy | 160384.23 | 177023.77 | 200099.80 | 1247971 |

## After

| players | case | median µs | p95 µs | p99 µs | world bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | idle | 10.08 | 15.69 | 31.05 | 6616 |
| 1 | busy | 21.27 | 62.24 | 109.85 | 6655 |
| 20 | idle | 38.11 | 66.78 | 123.80 | 131871 |
| 20 | busy | 178.84 | 481.33 | 1485.44 | 132771 |
| 50 | idle | 26.60 | 41.34 | 64.33 | 317721 |
| 50 | busy | 197.29 | 833.04 | 1442.63 | 318621 |
| 200 | idle | 36.15 | 50.61 | 66.22 | 1247071 |
| 200 | busy | 253.28 | 1429.10 | 2430.01 | 1247971 |

C4: busy 200 / busy 20 changes from 44.681× to 1.416× (limit 1.5×).
Idle 200 changes from 153305.01 µs to 36.15 µs (limit 50 µs).
World byte counts are identical in all eight rows.

Remaining copies: the changed top-level dictionary once per tick, small live
records and their mutable cooldown/participant/away/hit containers on first
write, State/player branches for position or fight-marker writes, and State/node
maps when a foe falls. The original rule writes a fallen foe's rest time into
**every** account, so those ticks still scale with the chunk. The unchanged
`fightHurt` and `fightBell` helpers deep-clone only the affected account State;
foe-fall events still copy their announced drops. Geometry is cached as before;
spatial and safety indexes live for one tick and never retain mutable worlds.

Golden replay: `kernel/test/fixtures/fight-golden.json` contains the unchanged
develop world hash and events hash for every tick of three seeded 1,000-tick
scripts. `record-fight.ts` refuses an overwrite or a changed implementation.
The regression runs all three with recursively frozen worlds and inputs,
compares all 6,000 hashes, and deep-compares every input against its prior copy.
The additional identity and boundary tests cover idle players/creatures,
guards, walking credit versus a step, resting-node writes, focus switching,
multiple foes on a fall, a bell, camp/fire safety and disabled combat.

Judgement calls:
- One presence chunk means 64 × 64; the existing arena's open meadow and zero knockback remain the test geometry.
- A legal full bag uses live zero-weight herbs; 36 recent log gathers supply the resting-node history.
- Continuous busy load renews completed pairs between timed ticks and sends one input per engaged account every tick.
- Percentiles use nearest rank; bytes measure the starting world once, outside timing.
- Resolution is re-ranked at phase boundaries; order is reused only within an ending pass where target tiles cannot change.
- A foe fall still touches otherwise idle accounts through the existing node-clock rule; this is preserved rather than silently removed for speed.
- Hurt and bell State copies stay in their existing helpers because changing `step.ts` is outside scope.
- The runtime identifies GPT-6 (Codex) and does not expose a reasoning-effort setting; the decision records that limitation.

The existing balance concern is left as recorded: one 8-point bare-hand strike
in the wolf's lunge-recovery window is doubled to 16 and fells its full 16 HP
(the unchanged weak-window test at tick 9 is the smallest case). No new combat
rule fault was found.
