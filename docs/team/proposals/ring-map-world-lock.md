# Ring map: proposed world-lock change

Status: owner decision required. `content/world.lock.json` was not edited.

Plan A2 moves the authored valley by `(+66,+84)` and sets map frame 2. The three locked wake labels would therefore move from `[7,6]`, `[6,17]`, `[9,23]` to `[73,90]`, `[72,101]`, `[75,107]`. The lock currently records 18, 10 and 11 steps to `core/old-bridge`; the moved map does not preserve those walks yet, and `pnpm check` correctly refuses the change under G59.

Proposed diff after the owner accepts the final geometry: keep every `pays` entry byte-for-byte; regenerate only the affected `legs` with `pnpm world:lock`, inspect that the three wakes and all later opening legs retain their intended effort, then commit the generated lock in the owner's re-anchor change. Do not re-anchor the current draft: the north wake is not walkable to the bridge and the other two legs fail the one-band effort check.
