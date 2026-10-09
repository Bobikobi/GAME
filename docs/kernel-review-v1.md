# Kernel review v1

Date: 2026-10-06. Reviewed: the six kernel claims, read against product spec v4.5 (sections 10, 13, 15).
Method: a small executable model (13 items, 14 activities, exact rational arithmetic) plus reasoning. Section 6 says which is which.

## 1. Summary

The kernel is right at its base: one simulation, one unit (a second of a player's time), and a value that is computed, never declared. But as written today, three of its claims do not hold. Each has a numeric example that ran in the model.

1. The value computation overpays. An action that yields several items (digging) prices every item as if it had cost the whole time, and waiting time counts as work. In the model a player earned 3 to 30 times the ceiling. The fix: count active time only, and split the cost between the outputs.
2. Measuring power on a fixed route is blind. A fishing skill measured 0% and doubled income. The fix: a hard ceiling inside the calculator, per action, instead of a measurement.
3. Whoever sees the luck ahead exploits it (3.6 times in the model), and one price curve in the shop hands out gold without play. The fix: the rolls come from outside and stay secret on the server, and the shop never pays more than it charges.

What to do before the first line of code: adopt the 12 rules of section 3. Now they cost a field in the schema. Once there is content and saves, they cost a repricing of the whole game.
After the fixes there is a proof: a player cannot earn more than a fixed rate per second of play, whatever content the community adds. What the proof does not promise: how much gold enters the world as a whole when there are many accounts. Section 5 holds the open decision on that.
Added after the owner's feedback, in section 7: different pay for easy work and hard work, and what to keep now so that players can one day own a mine, build a town with laws of its own and fight over land.
The owner's decisions of 6 October, in section 8: a server and accounts already at stage 2, progress in the demo does not carry into an account, a pay gap of about 7 times between a veteran at hard work and a beginner at easy work, a small shop bonus for a rare thing out of a fixed budget, and code for the core from outside developers too. Ownership, conquest and towns are deferred: not in the spec now, decided when there is a community.

## 2. Verdicts and findings

### Verdict per claim

| Claim | Verdict |
|---|---|
| 1. One pure simulation, integers, seeded generator in the state, fixed order | Holds after R1-R5. One part does not hold at all once gold matters: the seed cannot live in state the player can read. |
| 2. V is the cheapest way to obtain, computed in Knuth/Dijkstra order | Does not hold as written. Three independent failures (order of computation, joint outputs, waiting). Holds after R6-R7 under a changed definition; then V exists and is unique (Theorem 1). |
| 3a. An extension may not lower a value by more than a fixed percentage | Holds after R11. As written it is defeated by small steps. |
| 3b. No profitable buy-craft-sell loop, gold per hour bounded | Does not hold as written. Holds after R6-R9 as Theorem 3: per account, per active second. It says nothing about the world total or about sinks. |
| 3c. Market band derives from V | Holds for shop quotes under R8. A band on player-to-player prices is not needed for the bound and is not recommended. |
| 4. Power is seconds saved on a fixed benchmark; cap checked on the whole build | Does not hold. Replaced by R9, which needs no benchmark and no enumeration of builds (Theorem 4). |
| 5. Creator reward is the share of player-seconds | Does not hold before the server or against idle accounts. R10 bounds the damage; it is a rule, not a proof of fairness. |
| 6a. CI check is a headless simulated player | Holds. Needs only same-build repeatability (R1-R4). |
| 6b. Trial world is a static deploy with another content set | Holds. Needs no determinism at all. |
| 6c. A bug report is a replay | Holds after R5. A state snapshot plus the last few hundred actions gives most of the benefit at a fraction of the cost. |
| 6d. The server runs the same module, clients send actions | Holds after R1 and R4. The server needs the same rules, not the same bits. |
| 6e. Live sync synchronizes actions | Do not build it this way. A shared economy world needs the server to hold the state and send results. Lockstep would force bit-exact determinism on every browser and hands every client the full state. |

### Findings

Stage numbers are those of spec v4.5 section 16 (1 small game, 2 the loop, 3 progression, 4 accounts and server saves, 5 shared economy, 6 decisions, 7 payments, 8 live presence, 9 creator code). Severity: C critical, H high, M medium, L low. "x3" means three times the intended income bound k*r.

| Id | Area | Failing scenario | Bites at | Sev | Smallest fix | Now vs later |
|---|---|---|---|---|---|---|
| V1 | Value | Knuth order finalizes the cheapest item first and never revises. Plank: found 10 s, sawn from a log (12 s + 2 s -> 4 planks) 3.5 s; Knuth says 10. Toy: seed 40 instead of 13.5, ore 60 instead of 21.8; selling seeds pays x11.4. | Stage 1, first recipe that outputs more than it takes | C | Do not use Knuth. Solve the min-cost equations as a fixed point and verify by inequality (R7). | Now: nothing. Later: every price moves. |
| V2 | Value | A drop table or by-product: each output is valued at the full cost. Dig 30 s -> 70% shard, 25% relic, 5% idol gives values 42.9, 120, 600: 90 s of value per 30 s dig, x3.0. Fish -> fillet + bone: x2.0, and x4.67 at k=0.9 by buying the fish. | Stage 1, digging is a launch profession | C | Every multi-output activity carries a split that sums to 100%; each output bears its share (R6, R7). | Now: one schema field. Later: re-price all dig content. |
| V3 | Value | Waiting counted as work. Growth wait in V: farming pays x5.3 (plant, walk away, sell the sprout). Respawn in V (the spec's "wait between executions"): x12 with one crystal node, x30 with twenty, and it grows with every node the community adds. | Stage 5; the size of the error grows with content | C | V counts active seconds only. Waits and respawns are capacity limits, never value (R6). | Now: a definition. Later: the whole price table. |
| V4 | Value | An item whose only source needs itself (seed only from plants) gets a finite value (13.5) although nobody can obtain one. An item with no source has no upper bound. | Stage 2 | M | Reachability pass before values; unreachable content is rejected (R7). | Trivial both ways. |
| V5 | Value | Integer iteration lands on 13 with floor and 14 with ceil; the exact value is 13.5. Two implementations disagree on prices. | Stage 1 | M | Store V as integers once, rounded outward; CI checks inequalities, not a solver (R7). | Cheap now. |
| V6 | Check a | Seven extensions each lower berry by 9.9%: every one passes a 10% limit, together -51.8%. | Stage 2-3 | H | Limit measured against an anchor table re-set on a schedule, not against the previous merge (R11). | Now: one lock file. |
| V7 | Check a | Two pull requests each pass alone and exceed the limit together. Removing content raises values: holders gain, and voters know before the merge. | Stage 2, stage 5 | M | Checks run on the merge result; the budget applies in both directions (R11). | Cheap now. |
| V8 | Value | Thin cycle: harvest gives 1.05 seeds per seed, value 140 s. A +4.8% yield node halves the cost: x2.0 income from a "5%" node. Sensitivity is 1/(g-1). | Stage 3 | H | Builds never change output of an activity that has inputs (R9). Content edits fall under R11. | Now: a rule in the effect list. |
| V9 | Value | Fixed costs (level gate, knowledge, a tool that never wears) spread over unlimited units are zero. The spec folds them into "difficulty" and so into price; that pays for something that costs no time. | Stage 3 | M | Gates never enter V. Rarity is a supply limit. Decision D1. | Product decision. |
| V10 | Value | If the satiety overhead is inside V, V(food) depends on itself and one better food moves every value in the game. | Stage 3 | M | The reference player is fed. Food is a cost of living, outside V. | Now: a definition. |
| V11 | Value | Walking is part of V, so a new shop or shortcut near the mine re-prices every mine item in one merge. | Stage 2-3 | M | Map changes go through the same value diff and budget (R11). | Cheap now. |
| G1 | Gold | One price curve between 0.5 and 1.5 of base with spread k. Exhaustive search over 14 moves: k=1/3 no gain; k=1/2 +40 gold per 100 base with zero play (buy when stock is high, wait, sell back); k=0.95 +49 with no waiting, repeatable without limit. | Stage 5, "shared prices" | C | The highest price the shop ever pays is at most the lowest price it ever charges, over all stock levels (R8). | Now: shape of one function. Later: an exploit in a live economy. |
| G2 | Gold | Berry worth 0.1 gold. Round half up per sale: stacks of 5 pay x2.0. Minimum price 1: x10. Floor per unit: unsellable. | Stage 1, harmful at 5 | M | Money in fixed point (milli-gold). Pay rounds down, charge rounds up, per transaction (R8). | Cheap now; a currency redenomination later. |
| G3 | Gold | Output bonus on a recipe with valuable inputs: cut gem (1 gem + 2 s), node +20% output, k=0.9: x18, and it scales with the input's value, not with time. Random builds with such bonuses: 267 of 300 break the cap. | Stage 3 | C | Same as V8: output effects only on activities without inputs (R9). | Now: a rule. Later: nerf live skill nodes. |
| G4 | Gold | Gold created outside V: quest rewards, treasure, starter gold, and gold for voting in polls (spec section 13). A poll vote costs no time: a faucet, and a reason to create accounts that also vote. | Stage 5-6 | H | Every gold source is an activity record with active time; poll rewards are not gold (R6). | Cheap now. |
| G5 | Gold | The reference player is "average"; a bot with perfect timing earns the full skill range above it. | Stage 5 | M | The reference is perfect execution; skill can only lose against it. Decision D2. | Now: a definition. |
| G6 | Gold | A single 8-hour action counted as active time: one click earns 8 hours of gold and of creator pool share. | Stage 3-5 | H | Maximum action length (for example 60 s). Anything longer is a wait in a slot (R6). | Cheap now. |
| G7 | Gold | Theorem 3 is per account. The shop's floor price never refuses, so 1,000 accounts mint 1,000 times as much. | Stage 5 | H | One ledger for every gold change now; a daily shop payout cap per account at stage 5. Decision D4. | Ledger is cheap now, painful later. |
| G8 | Gold | Nothing ties gold leaving to gold entering. The spec's lever "lower gold per minute" changes r, which only rescales prices and shifts wealth to those holding gold. | Stage 5-6 | M | Freeze r. Steer with k inside bounds (R12). Decision D4. | Now: a decision. |
| P1 | Power | Benchmark "gather 20, cook 5, dig 3". Angler (fishing -50%): 0% measured, x2.0 real. Deep digger (-40% dig): 13.8% measured, x1.43 real. Two output nodes: 0% measured, x1.5 real. | Stage 3 | C | Clamp the rate multiplier of every activity inside the one calculator (R9). | Now: where the cap lives. Later: rebalance the tree. |
| P2 | Power | "CI runs many combinations": 60 nodes, pick 20, is 4.19e15 builds. A sample proves nothing. | Stage 3 | H | With R9 the cap holds by construction; CI tests the clamp, not the builds. | Free with R9. |
| P3 | Power | Position in the tree derives from measured power, so changing the benchmark moves nodes and forces resets. | Stage 3+ | M | Position derives from the declared size of the effect and the scope class of its tag. | Cheap now. |
| P4 | Power | Powers that save no time on any single action: bag size, map information, satiety size. | Stage 3 | M | Express each as a rate multiplier under the same clamp, or put it in a "convenience" class with its own fixed budget. | Per effect type. |
| K1 | Kernel | Stepping the world 20 times a second. A tab asleep 8 hours owes 576,000 ticks. A server with 1,000 players makes 1.7 billion step calls a day against about 29 million when driven by actions. | Stage 1 (tab), stage 4 (server) | H | Time is an integer argument. State stores "ready at tick N", never countdowns. No step without an action (R1). | Now: a habit. Later: every timer in every save. |
| K2 | Kernel | One random stream. Adding one unrelated entity that takes one roll changed 90 of 200 later dig results; CI comparisons before and after an extension become noise. | Stage 2 | H | Draw = function(seed, entity id, per-entity counter); CI uses expected values (R4). | Now: one function. |
| K3 | Kernel | The seed is in state the player holds. A bot that reads the next roll and digs only on a gem: 25.2 gems an hour against 6.2, x3.64 income. With per-node streams and a readable seed: x2.4 at 20 dig spots, x6.0 at 200, x14.5 at 2,000. | Stage 4-5 | C | On the server the draws are a secret input; the client receives results (R4). | Now: step takes draws as an argument. Later: protocol change. |
| K4 | Kernel | JavaScript numbers: 94906267 squared is off by one; (2^31+5) or-ed with 0 is negative; twenty additions of 0.05 are not 1; NaN is saved as null. | Stage 1 | M | Safe-integer assert after every step in CI; one mulDiv helper; lint (R2). | Cheap now. |
| K5 | Kernel | Order leaks: object keys "2","10" jump ahead of "berry"; the same state built in another order serializes differently; default sort gives [1,10,9]; localeCompare orders ids differently per locale. | Stage 1-2 | H | Ids in a fixed ASCII set, compared by code unit; canonical serialization for hashes (R3). | Cheap now; silent desync later. |
| K6 | Kernel | sin, cos, pow, exp, log are allowed to differ between engines. | Stage 4 | M | Ban them in the kernel package (R2). | Lint rule. |
| K7 | Kernel | "Going back is pointing at the previous tag": a save that already holds new items cannot load there. A removal with a conversion field can turn a cheap item into a dear one. | Stage 2, first removal | H | Tags only move forward; a rollback is a new tag. Conversions may not gain value (R5). | Cheap now. |
| K8 | Kernel | A replay needs the exact kernel build and content tag; without them old bug reports stop reproducing after the next merge. | Stage 2 | M | Every tagged build stays deployed; replays name build and tag (R5). | Storage only. |
| K9 | Kernel | One JSON state for a shared world: hashing or saving it per action scales with the world, not with the action. | Stage 4-5 | M | Step reads and writes the acting player and the entities the action names (R1). | Now: API shape. |
| K10 | Kernel | The timing minigame is judged at frame precision; a 50 ms tick is too coarse, so the grade arrives as a claim. A bot always claims perfect. | Stage 4 | M | The grade is an input with a bounded effect; with D2 the bound is zero above reference. | Free with D2. |
| C1 | Reward | Play time is reported by the client until stage 4, and creator points feed vote weight. | Stage 2-4 | H | No money and no vote weight from client-reported usage (R10). | Policy now. |
| C2 | Reward | 100 real players, one hour a day. A creator runs 20 idle accounts: 82.8% of the pool at 24 h each, still 28.6% with a 2 h daily cap. | Stage 7 | H | Active seconds from the server's action log, a cap per account-day, weight by account standing (R10). Decision D5. | Design now, build at 7. |
| C3 | Reward | Equipment "touches" every action of its wearer and would collect a share of everything. | Stage 7 | M | A fixed attribution table by content type (R10). | Decision D5. |
| S1 | Server | Client-era saves can be edited, and a replayed action log proves legality, not elapsed time: a forged log of 100 perfect hours passes. | Stage 4 | H | Decide now what carries over. A signed time stamp from the stage-1 service makes time provable. Decision D3. | Stamps are cheap now, impossible to add backwards. |
| S2 | Server | Action flooding. | Stage 4 | L | "Busy until tick" in the state; step rejects earlier actions. | Free with R1. |
| N1 | Params | Parameters are coupled. With one price curve k must stay at or below 1/3; moving k to 1/2 by vote opens G1. A discount above 1-k opens a buy-sell loop. | Stage 6 | H | Parameters are data with a range and a maximum step; every change re-runs the kernel checks (R12). | Cheap now. |

## 3. The hardened kernel

Twelve rules. Each has the automated check that guards it.

**R1. Event time, pure step.** `step(state, action, tick, draws) -> state`. No clock, no I/O, no timers. State stores absolute ticks ("ready at"), never countdowns. Step touches only the acting player and the entities the action names; an action before the player's "busy until" tick is rejected.
Check: property test "time skip": N one-tick waits and one N-tick wait give the same state hash. Lint bans Date, performance, timers and Math.random in the kernel package. Step time with 10 times the entities stays within 1.2 times.

**R2. Safe integers, one arithmetic helper.** Every number in the state is a safe integer. Money and value arithmetic goes through `mulDiv` and `idiv` with a stated rounding direction. No float literals, no Math functions beyond floor, ceil, trunc, abs, min, max, sign, imul.
Check: lint; fuzz run asserting `Number.isSafeInteger` on every number after every step; the replay corpus runs on three browser engines and Node and the hashes must match.

**R3. Canonical order, canonical bytes.** Ids use lowercase ASCII letters, digits, underscore, slash and hyphen, and compare by code unit. Every loop over content or state walks sorted ids. A state hash is taken over a serialization with sorted keys.
Check: load the content in ten random orders; the state hash and the value table must be identical.

**R4. Draws are inputs.** A draw is `f(seed, entity id, per-entity counter)`. Single-player, CI and replays supply draws from a recorded seed. On the server the seed is never sent to a client. Value and power checks use exact expected values and never sample.
Check: add an unrelated entity; the outcomes of existing entities are unchanged. Server contract test: no seed in any message to a client.

**R5. Pinned versions, forward only.** A save or replay names the kernel build and the content tag. Saves move forward through migrations. A rollback is a new tag. Replays run on their own build, and every tagged build stays deployed. A removed item converts to something whose value is not higher.
Check: a corpus of golden saves runs the migration chain on every pull request: no unknown ids, wealth after is at most wealth before. CI rejects a conversion with V(target) * quantity > V(removed).

**R6. One activity format for every source.** Nodes, recipes, drop tables, quest rewards, treasure, starter kits and conversions are all activity records: active time between t_min and a maximum action length, inputs, expected outputs at perfect execution, and for several outputs a split in whole percent that sums to 100. Waits and respawns are capacity and never count as time. Gold changes only through one ledger: mint, burn, transfer, each with a reason.
Check: schema. Ledger conservation: gold in the state equals mints minus burns. Only activity code may call mint.

**R7. The value table is a checked certificate.** Nobody declares V. For every activity and each of its outputs: `yield * V(out) <= share * (time + sum of quantity * V(in))`, with equality for at least one activity per item. Items must be reachable from input-free activities. V is stored as integers, rounded once.
Check: CI recomputes V, verifies every inequality in exact integer arithmetic, verifies reachability, and solves the income problem on the merged content: the best mixed strategy of the reference player earns exactly k*r.

**R8. Shop invariant.** For every item: the highest price the shop pays, over all stock levels, discounts and rounding, is at most k*r*V, and the lowest price it charges is at least r*V. Money is fixed point; pay rounds down, charge rounds up, per transaction. Prices between players are free.
Check: evaluate the pricing function on its full grid; run the exhaustive trade search of appendix A9 on it; any gain fails the build.

**R9. Rate clamp in the one calculator.** A build can change the active time of any activity and the output of an activity that has no inputs. Nothing can change the output of an activity that has inputs. For each activity the combined rate multiplier is clamped to P(level).
Check: property test on the calculator with random effect sets. The build with every effect switched on earns at most k*r*P on the merged content.

**R10. Usage is counted by the kernel.** Creator weight is active seconds taken from validated action logs, split by a fixed attribution table, capped per account-day. Usage reported by a client earns no money and no vote weight.
Check: the shares of every action sum to its active seconds; the cap is applied in the accounting job; a test account at 24 h counts as the cap.

**R11. Drift budget against an anchor.** A merge or a parameter change may not move any existing V by more than X percent from the anchor table, in either direction. The anchor is re-set on a fixed schedule. Checks run on the merge result, one merge at a time.
Check: CI diffs the recomputed table against the lock file; the repository uses a merge queue.

**R12. Parameters are bounded data.** k, X, P(level), t_min, the maximum action length and the attribution table live in one file, each with a minimum, a maximum, a maximum step per decision and a cooldown. r is fixed for good. Every parameter change runs the checks of R7, R8 and R9.
Check: CI on the parameter file diff.

## 4. The math that survives

**Setting.** Items I. Activities A. Activity a has active time t_a >= t_min > 0, inputs q_a(i) >= 0 (tool wear is 1/uses), expected outputs y_a(o) > 0 at perfect execution, and shares s_a(o) > 0 summing to 1. This is a production system with one primary factor, player time.

**Definition.** For a reachable item o:
`V(o) = min over activities a that output o of  s_a(o) * (t_a + sum_i q_a(i) * V(i)) / y_a(o)`.

**Theorem 1 (V exists and is unique).** If every item is reachable and every t_a > 0, the equations have exactly one solution, and iteration from any start converges to it.
Sketch. Call the right side T. T is monotone and T(c*V) <= c*T(V) for c >= 1, strictly when t > 0. Reachability gives a finite vector with T(V) <= V (take any derivation order), so iteration from zero rises to a fixed point. If U and W were two fixed points, let c = max W/U, reached at item o, and take the activity that attains U(o): W(o) <= s*(t + c*sum q*U)/y < c*U(o), a contradiction unless c <= 1. By symmetry U = W.
Run: iteration from the Knuth values and from zero reached the same vector; the residual of the exact solution is 0.

**Where Knuth's algorithm applies.** Only if every activity's unit cost is at least the value of each of its inputs. Any activity that turns one thing into several cheaper things breaks this, with or without a cycle (appendix A1). Do not use it.

**Theorem 2 (no activity creates value).** For every activity, `sum_o y_a(o) * V(o) <= t_a + sum_i q_a(i) * V(i)`.
Sketch. V(o) is at most its share of the cost in a; multiply by y, sum over the outputs, the shares sum to 1.
This inequality is all that the bound below needs. That is why R7 checks an inequality on a stored table and does not trust a solver.

**Theorem 3 (bounded gold).** Assume: Theorem 2 for the content; builds under R9 with cap P; the shop under R8; every gold source is an activity whose gold output is counted at 1/(k*r) seconds per unit; the player does not know a draw before choosing. Define wealth `W = gold + k*r * sum_i V(i) * n_i`. Then over any play, expected W grows by at most k*r*P per active second.
Sketch. Activity with inputs, time t' >= t/P: W changes by k*r*(sum y*V(out) - sum q*V(in)) <= k*r*t <= k*r*P*t'. Input-free activity with y'/t' <= P*y/t: W changes by k*r*y'*V(out) <= k*r*P*t'. Selling to the shop at no more than k*r*V: W does not rise. Buying at no less than r*V (R8), more than the k*r*V this step needs: W does not rise. Transfers between players conserve gold.
Consequences. No sequence of trades and crafting yields gold without active time. Gold per active hour is at most 3600*k*r*P. With stopping rules the bound still holds in expectation.
Limits. Per account. Nothing about total gold in the world, nothing about sinks.
Run: under the hardened values the best mixed strategy earns exactly x1.000 at 1, 5 and 20 crystal nodes; the largest value gain per active second over all activities is exactly 1.

**Theorem 4 (caps compose).** Under R9 every legal build earns at most P times the reference income, whatever the combination of nodes and equipment.
Sketch. It is Theorem 3; the clamp gives its build assumption directly.
Run: 300 random clamped builds, worst income exactly x1.5000 at P = 1.5. With output bonuses on activities that have inputs, 267 of 300 exceeded P, worst x2.38.

**Theorem 5 (cascades fade).** Adding activities never raises any V. The largest relative drop is at an output of an added activity; every item downstream drops strictly less.
Sketch. Adding an activity adds a constraint. If the worst-hit item used an old activity, its cost is t plus inputs that dropped by at most the same fraction, and t > 0 did not drop.
So check (a) cannot be surprised far from the new content, and removal can only raise values.

**Cycles.** A cycle that returns g > 1 units per unit with active cost c per loop has V = c/(g-1). The relative change of V is the change of g divided by (g-1). Time changes pass through one to one; output changes are amplified. This is the reason behind the second half of R9.

**Shop curve.** With one curve whose multipliers lie in [m_min, m_max] and a spread k, gold from trading alone is impossible exactly when k*m_max <= m_min. For 0.5 to 1.5 that means k <= 1/3. Two curves, pay at most k*base and charge at least base, need no condition.

**What does not survive.** A canonical value for joint outputs: with several outputs the split is a free choice (the non-substitution theorem needs single-output activities), so R6 makes it an explicit field. Power as seconds on a benchmark. Any bound on world gold. Any guarantee that sinks match faucets.

## 5. Open decisions for the owners

Status after the owners' round of 2026-10-06 (section 8): D1 and D3 are decided, D6 is deferred by decision. D2, D4 and D5 are still open.

**D1. Does waiting or rarity ever raise a shop price?** Recommended: no. The shop pays for active time only. Rarity is a limited supply and shows only in prices between players. The review continues under this default.
Decided otherwise on 2026-10-06: both. A small shop bonus under a fixed budget, and most of the value in use. See 8.2.

**D2. Who is the reference player?** Recommended: perfect execution, no build, fed. Everyone else earns less than the reference, never more, and bots gain nothing from perfect timing.

**D3. What carries over from browser saves when the server arrives?** Recommended: skills, journal and looks carry over inside the caps; gold and tradeable items do not, and each player receives a starter kit sized by witnessed play time. Start signing time stamps in the stage-1 service so that play time is provable.
Decided on 2026-10-06: nothing carries over. Stage 1 is a demo and says so on screen from the first day; whoever played it receives a title and a cosmetic item with the account. No save import, no signed time stamps.

**D4. How is gold entering the world limited once there are many accounts?** Recommended: r is fixed for good; one ledger from stage 1; at stage 5 a daily cap on shop payouts per account and an automatic small adjustment of k, inside voted bounds, when minted gold exceeds burned gold two weeks running.

**D5. What exactly does the creator pool pay for?** Recommended: active seconds from server logs, at most 2 hours per account-day; 60% to the activity's creator, 20% to the slot, 20% to the quest; equipment is paid from its sale, not from the pool; no gold for voting in polls.

## 6. What was run, what was reasoned, what could not be verified

**Run** (Python with exact fractions, Node 20; the scripts are kept next to this file in `kernel-toy/`, because three of them are first drafts of the CI checks in R7, R8 and R9):
- Values under five rules (as written with Knuth order, exact, respawn counted, active time with full-cost outputs, hardened), with an exact linear program for the best mixed strategy of one player.
- Fixed point by linear program and by iteration from two starts; integer iteration with both rounding directions; reachability.
- Benchmark power against real income for five builds; the thin cycle; the cut-gem loop at three values of k; 300 + 300 random builds.
- Check (a) by seven small steps, with and without an anchor.
- Exhaustive search over shop trade sequences for two price functions and three values of k; rounding schemes.
- Replay twice, one extra roll, key order, time skip; a bot that reads the seed, with one stream and with per-node streams.
- JavaScript number and ordering behaviour on V8 11.3.
- Effort weights and the rarity budget of sections 7.1 and 8.2 (`toy_effort_rarity.py`, runs E6 to E8).

**Reasoned only:** server cost of ticking; lockstep against server state; how much determinism each consequence needs; creator attribution; import of client saves and time stamps; parameter coupling beyond the cases run; the sink side of the economy.

**Not verified:** differences between browser engines (only V8 was available; the claim rests on the language standard); browser timer throttling in background tabs; behaviour of real players; cost of the value computation at real scale (13 items here, solved in milliseconds; thousands of items should be fine with iteration plus the inequality check, but it was not measured); the toy has no map, so walking is a fixed number per activity.

Two readings of the spec were tested where the text allows both: whether "waiting" includes respawn, and whether the 0.5 to 1.5 band is one curve or two.

## 7. Addendum after owner feedback (2026-10-06)

Two objections from the owners. Both are accepted. Both were proposals when written. The owners decided on 2026-10-06: 7.1 is adopted with the recommended defaults, 7.2 is deferred. See section 8.

### 7.1 Equal pay per second is a ceiling, not a design

The objection: a long, hard task and an easy generic one should not pay the same, and the game must leave room for grinding and for becoming the richest player.

The objection is right. Defaults D1 and D2 together make every activity on a cheapest path pay exactly k*r per active second to a perfect player. The proofs never needed that. They need a ceiling.

**Proposed amendment to R6 and R7: effort weight.** Each activity gets an effort tier, derived by the check from data the file already holds (required level, tool tier, width of the timing window, risk of the zone). The tier maps to a weight w between w_min and 1 in the parameter file. The value table uses w*t in place of t.
Theorems 1 to 5 hold unchanged: w > 0 keeps Theorem 1, and since w*t <= t the inequality of Theorem 2 still gives the bound of Theorem 3 in true active seconds.

Run on the toy with weights 0.4 (easy gathering), 0.6 (farming, fishing), 0.8 (crafting), 1.0 (mining, digging, crystal):

| Player | Income, as a multiple of k*r |
|---|---|
| Beginner, easy gathering only | x0.400 |
| Farmer and cook | x0.650 |
| Everything unlocked, no build | x0.993 |
| Everything unlocked, build at cap P = 3 | x2.980 |

A capped veteran on hard content earns 7.5 times a beginner on easy content. The largest value gain per true active second over all activities stayed exactly 1.0.
Processing carries easy inputs upward (the cook earns 0.65, not 0.4). That is intended: processing is the way up.

**What the kernel never limited.** Hours: grinding pays in proportion to time and raises the level, which raises the ceiling. Wealth: Theorem 3 bounds gold minted by the shop per active second, not gold held; trade between players, rents and rare goods have no bound. Rewards that are not gold: a long quest pays mostly in skill points, rank, recipes and unique items.

**The tension.** Wider gaps make it harder for a newcomer to catch up and pay bots more at the top tier. Recommended defaults: w_min = 0.4, P at the top level = 3.

### 7.2 A player-run economy: ownership, conquest, cities with their own rules, lawless zones

The vision: a player who finds a cave can take control of it, others can try to steal or conquer it; a player can found a city and set its rules; other zones have no rules at all.

**It is compatible, and the kernel is what makes it worth playing.** Theorem 3 limits one thing only: gold created by the shops. Ownership, tax, rent, tolls, theft and conquest move existing gold and items between players. They are ledger transfers, not mints. Rule R6 gives every node a finite output per hour; that is exactly what makes control of a cave valuable. With unlimited nodes there would be nothing to fight for.

**What it needs later.** Control of an entity, contesting it, and local rules are new verbs: core releases, not before the live shared world (stage 8 and 9).

**What to reserve now, while each is one field in a schema:**
1. Every world entity has a `controller` (default: public) and an `access` rule from a closed list.
2. Every zone has a `ruleset` record: protection level (safe, contested, lawless), tax rate and who receives it, who may change it. Core zones are fixed as safe.
3. Ledger transfers carry a reason from a closed list that already includes tax, rent, toll and seizure.
4. The effort weight of 7.1 includes zone risk: safe zones pay below the ceiling, lawless zones at the ceiling.
5. Holdings carry upkeep that grows with the number held, and upkeep is burned. This is the sink that finding G8 lacked, and the brake on one group holding everything.

**Risks.** Players who lose what they built leave: keep a safe core where nothing can be taken. One strong group takes every cave: upkeep that grows with holdings. It needs a live server and many players: not before stage 8. City rules are chosen from a closed menu, as data; they are never code.

**D6 for the owners.** Is the long-term game a cooperative restoration world, or a competitive player-run economy with safe and lawless zones? Recommended: both, split by zone, and reserve the fields above at stage 1.
Decided on 2026-10-06: not in the spec for now. The world stays cooperative and the question returns when there is a community. The five reserved fields are therefore not a requirement. If the direction is taken later they arrive through a save migration (R5), which costs more than a schema field today but is possible.

## 8. Owner decisions of 2026-10-06 and what they change

Two rounds of four questions. Spec v4.6 carries the product side; this section carries the kernel side.

| # | Question | Decision | Effect here |
|---|---|---|---|
| 1 | Pay gap between a capped veteran on hard work and a beginner on easy work | About 7 times | 7.1 adopted: w_min = 0.4, P at the top level = 3. See 8.1 |
| 2 | What gives a rare thing its value | Both: a small shop bonus under a ceiling, and most of the value in use | Replaces the default of D1. See 8.2 |
| 3 | What gives competition in the first version | Bring the server forward: accounts and server-decided saves at stage 2 | See 8.3 |
| 4 | An outside developer who wants a new capability in the game itself | Submits core code; the team reviews and merges | See 8.4 |
| 5 | What carries over from stage 1 when accounts arrive | Nothing. Stage 1 is a demo; a title and a cosmetic item for whoever played it | D3 closed. Finding S1 no longer applies |
| 6 | What is built right after the server | Specialization, then the market | Stage numbers change. See 8.3 |
| 7 | Ownership, conquest, cities with their own rules, lawless zones | Not in the spec now; decided again when there is a community | D6 deferred. 7.2 stays on record only |
| 8 | Hundreds of AI-made submissions a day against three human testers | A quota of open submissions that grows with accepted extensions; later a full creator progression inside the game | See 8.5 |

### 8.1 Effort weight, adopted

R6: every activity record carries an effort tier, derived by the check and never declared. R7: the inequalities use w*t in place of t. R12: the tier weights live in the parameter file with bounds.
The gap is not a constant of the kernel. It is P(top) / w_min times the rate of a player with everything unlocked: two parameters. Run E6: x0.400 for the beginner, x2.980 for the capped veteran, a gap of 7.449.

### 8.2 The rarity budget (replaces the default of D1)

Two different things are called rare.
Rare by work: a low drop chance, depth, a tool. It is already in V through expected active time (the gem is worth 381.47). Nothing to add.
Rare by supply: few nodes and a long respawn. Under D1 this earned nothing in the shop: the crystal is worth 10, the seconds it takes to pick up.

**The rule.** An activity with a declared finite capacity (node count and respawn) may carry a rarity bonus b, in seconds, fixed per rarity tier. The value table uses w*t + b. On the merged world:
`sum over bonus-carrying activities of (nodes / respawn) * b <= beta`, with beta in the parameter file (proposed 0.10).
A bonus on an activity with no declared capacity is refused. The check runs on the merge result (R11), because nodes added by a later extension raise the capacity.

**Theorem 3 with a budget.** W grows by at most k*r*P*(1 + beta) per active second.
Sketch. One execution of activity a adds at most w*t + b to the value held. The first part sums to at most the active time, as before. The second part is at most capacity times b per second, summed over activities at most beta, and the output multiplier on a source is held to P by the clamp of R9.

Run E7, beta = 0.10, the crystal given the largest bonus the budget allows:

| Crystal nodes | Bonus | Crystal worth (was 10) | Income, no build (bound 1.100) | Build at P = 3 | P = 3 with a yield bonus on the crystal (bound 3.300) |
|---|---|---|---|---|---|
| 1 | 360 s | 370 | x1.093 | x3.079 | x3.279 |
| 5 | 72 s | 82 | x1.093 | x3.079 | x3.280 |
| 20 | 18 s | 28 | x1.093 | x3.080 | x3.280 |

Run E8, what the check must refuse: a bonus of 18 s on a source with no capacity limit (fishing) pays x2.100. The crystal bonus that fits 20 nodes, after a merge that brings the nodes to 40, uses 0.200 of the budget and pays x1.194; at 200 nodes x1.997.

**What it means for creators.** The rarity budget is a shared resource, like a slot. A new rare resource takes a part of it. When it is full, a new rare thing enters with no shop bonus and lives on its use, or the community moves beta by vote inside its bounds (R12).
**What stays true.** Most of the value of a rare thing is outside the shop: recipes, equipment, the camp, the journal, and from the market stage the price players set between themselves, which the kernel never bounded.
**Limit.** Before the world has shared resources, capacity is per account, so the ceiling is per account, as Theorem 3 always was. Gold entering the whole world with many accounts is still D4.

### 8.3 Accounts and server at stage 2

Stage order in spec v4.6: 0 validation; 1 demo on a static site; 2a accounts and server, 2b the loop, in parallel; 3 specialization; 4 market; 5 decisions inside the game; 6 cosmetics and payments; 7 live presence and chat; 8 mechanisms and creator code.
Stage numbers elsewhere in this review are the v4.5 numbers: old 2 is now 2b, old 3 stays 3, old 4 is now 2a, and old 5 to 9 are now 4 to 8.

**Moves to stage 2:** draws kept secret on the server (R4); the gold ledger (R6); validated action logs, the base of R10; every tagged build kept deployed (R5); the server deciding what a player obtained by running the action log through the same kernel module.
**Becomes cheaper:** no import of browser saves. The forward-only chain of R5 starts at the first server save, and the demo is a tuning period in which an economy hole harms nobody.
**Becomes urgent:** R1, R2 and R3 must hold in the first playable build, because the stage-2 server runs that same module. Determinism added after content exists is the expensive path this review warns about.
**D4 moves earlier:** it must be decided before the market stage (new 4), not at old stage 5. Between stage 2 and the market, gold has no path from one account to another, so farming with many accounts pays nothing yet.
**Leaderboards** rank accounts from server-validated state only. A board built from client reports would be the first thing to be forged.
**Hardware:** a server with a database, backups and monitoring from stage 2. Validation costs one step per action, not per tick (R1), so the load follows actions and not connected time. Not measured.

### 8.4 Core code from outside developers

One pure step function is what makes this safe to offer. A new verb arrives as a pull request with: the step code; its sources of items written as activity records (R6), so the value table, the rate clamp and the rarity budget cover it with no special case; property tests for time skip, canonical order and safe integers (R1 to R3); and one example content file that uses it.
CI runs the lint of R1 and R2 and the checks of R7, R8 and R9 on the merged content. The team reviews and merges; the founder's closed veto list applies.
The hole to guard: a verb that creates items or gold outside an activity record. "Only activity code may call mint" (R6) becomes a lint rule on every pull request, not a convention.

### 8.5 Submission quota and the local check

The quota is product policy and the kernel does not see it. One consequence does land here: the automatic check must run on the creator's machine in one command, with the same code as CI. An AI tool then fixes a submission before it is sent, and the quota is spent on human testing, which is the scarce part, and not on schema errors.

Still open from the spec: gold for a poll vote (A19). D5 recommends none.

## Appendix A. Counterexamples

Times in seconds. r = 1, k = 1/2 unless stated. "Caught by" names the rule in section 3.

| # | Minimal content | Result | Caught by |
|---|---|---|---|
| A1 | find_plank 10 -> 1 plank; cut_log 12 -> 1 log; saw 2 + 1 log -> 4 planks | Knuth: plank 10. Exact: 3.5. | R7 |
| A2 | forage 40 -> 1 seed; plant 2 (+20 wait) + 1 seed -> 1 sprout; harvest 5 + 1 sprout -> 3 seeds | Knuth: seed 40. Exact with wait: 13.5. Active only: 3.5. Selling seeds at the Knuth value pays x11.4. | R7, R6 |
| A3 | dig 30 -> 0.70 shard, 0.25 relic, 0.05 idol, no other source | Full-cost values 42.9, 120, 600: 90 s of value per dig, x3.0. With split 10/30/60 the dig is worth exactly 30. | R6, R7 |
| A4 | fish 12 -> 1 fish; fillet 4 + 1 fish -> 1 fillet + 1 bone | Full cost: fillet 16, bone 16, x2.0; at k=0.9 buy the fish from the shop, x4.67. With split 80/20: 12.8 and 3.2, x1.0. | R6, R7 |
| A5 | crystal node: 10 active, respawn 3600; berry bush: 6 active, respawn 60, 3 berries | Respawn counted: crystal 3610, berry 22. Income x12.0, x15.9, x30.4 with 1, 5, 20 crystal nodes. Active only: x1.0 at any count. | R6 |
| A6 | A2 without forage | The equations give seed 13.5; the reachable set does not contain seed. | R7 |
| A7 | seed = min(40, (seed + 27) / 3) in integers | floor: 13. ceil: 14. Exact: 13.5. | R7, R2 |
| A8 | seven new bushes, each 9.9% cheaper than the last | Each passes a 10% limit against the previous merge; total -51.8%. Against an anchor the second is blocked. | R11 |
| A9 | shop base 100, stock 0..10, one curve from 1.5 down to 0.5; pay = floor(k*curve), charge = ceil(curve) | 14 moves. k=1/3: +0. k=1/2: +40 using the shop's own consumption, +45 when others sell. k=0.95: +49 with no waiting. Two curves: +0. | R8 |
| A10 | berry priced 0.1 gold | Half-up per sale: stack of 5 pays 1, x2.0. Minimum 1 per unit: x10. Milli-gold with floor: exact. | R8 |
| A11 | cut 2 + 1 gem -> 1 cut gem; node: +20% output | k=1/2 and 3/4: no gain. k=0.9: x18.2. | R9 |
| A12 | forage 400; plant 2; harvest 5 -> 1.05 seeds; node: 1.05 -> 1.10 | Seed 140 -> 70: a +4.8% node gives x2.0. | R9 |
| A13 | benchmark: 20 gathers, 5 bakes, 3 digs (260 s) | Angler: 0% saved, x2.0 income. Deep digger: 13.8%, x1.43. Output nodes: 0%, x1.5. Digger plus miner: 13.8%, x1.64. | R9 |
| A14 | one random stream; one new entity takes one roll at load | 90 of 200 later dig results change. Keyed draws: 0. | R4 |
| A15 | bot reads the next roll; digs on a gem, gathers otherwise | 25.2 gems an hour against 6.2; x3.64. Per-node streams, readable seed, 240 digs a day: x2.4, x6.0, x14.5 at 20, 200, 2,000 spots (no walking modeled). | R4 |
| A16 | same state, keys inserted in another order | Plain serialization differs; sorted keys match. In JavaScript the keys "2" and "10" move ahead of "berry". | R3 |
| A17 | 94906267 * 94906267; (2^31 + 5) or 0; 0.05 added 20 times | 9007199515875288 instead of ...289; -2147483643; 1.0000000000000002. | R2 |
| A18 | 100 players at 1 h a day; one creator with 20 idle accounts | 82.8% of the pool at 24 h each; 28.6% with a 2 h cap. | R10 |
| A19 | gold for a poll vote; a quest paying more than k*r times its time | A source with no active time: Theorem 3 does not cover it. | R6 |
| A20 | item X (V 10) removed with "converts to" item Y (V 100) | Wealth rises tenfold on migration. | R5 |
| A21 | one recipe with active time 28,800 | One click, eight hours of gold and of pool share. | R6 |
| A22 | parameter vote moves k from 1/3 to 1/2 under one price curve | Opens A9. | R12 |
| A23 | rarity bonus of 18 s on fishing, which has no node limit | Income x2.100: no budget can cover an uncapped source. | R7 with the budget of 8.2 |
| A24 | crystal bonus sized for 20 nodes; a later extension adds 20 more | Budget used 0.200 against 0.100, income x1.194. | R11, budget checked on the merge result |
