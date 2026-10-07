# kernel-toy

The small executable model behind `../kernel-review-v1.md`. It is not game code. It exists so that every number in the review can be reproduced, and because three parts of it are first drafts of checks the real CI will need.

## Run

```
python3 toy_econ.py     # values, income bound, power, clamp test, small-step drift   (about 7 s)
python3 toy_misc.py     # shop trade search, rounding, determinism, seed-reading bot  (about 6 s)
node js_traps.mjs       # JavaScript number and ordering behaviour
python3 toy_effort_rarity.py   # effort weights and the rarity budget, runs E6 to E8  (under 1 s)
```

Python 3.10 or later, standard library only. Node 18 or later.

## What is worth keeping for the real kernel

| Part | File | Becomes |
|---|---|---|
| `simplex` (exact rational LP) and `income` | toy_econ.py | The CI check of rule R7 and R9: the best mixed strategy of one player must earn exactly k*r, and at most k*r*P with every effect switched on. |
| `cons(..., "hard")`, `fixed_point_lp`, `T`, `reachable` | toy_econ.py | The value table of rule R7: active time only, joint outputs split by shares, reachability first. In production: iterate, round once, then verify the inequalities in integers. |
| `shop_search` | toy_misc.py | The CI check of rule R8: exhaustive search for gold from trading alone on the real pricing function. |
| `keyed`, the "ambient" test, the time-skip test | toy_misc.py | Rule R4 (draws keyed per entity) and rule R1 (no step without an action). |
| `value_table` (w*t + b), `budget_used` | toy_effort_rarity.py | The owner decisions of review section 8: effort weights inside rule R7, and the rarity budget check that must run on every merge result. |

## What is only a demonstration

`knuth` (shown to be wrong for this problem), the "naive" valuation modes, the seed-reading bots, the creator-pool arithmetic, and the whole content set in `base_content()`.

## Content set

13 items, 14 activities: a node with yield above one (berry), a production cycle (seed, sprout, three seeds), a by-product (fillet and bone), a probabilistic drop table (dig), a tool that wears (pick, 50 uses), and a node with a long respawn (crystal). Times are active seconds; `wait` and `respawn` are elapsed time.
