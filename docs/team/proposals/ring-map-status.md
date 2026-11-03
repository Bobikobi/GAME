# Ring map status

## Done

- A repeatable exporter writes A2 as a 192x192 runtime map plus nine 64x64 chunk JSON files with ground, levels, stamps and crossing props.
- The runtime map carries `frame: 2` and `moved: {dx: 66, dy: 84}`; existing props, slots and the spawn move with the valley.
- `plan.py` now draws the long coastal walk to the far-bank roadhead while the human-city skyline remains solid scenery.
- A2 measures: no unreachable walkable tile; G62 worst pay distance 69 (limit 241); authored route maximum straight run 7; all three passes reachable; danger bands d0 4594, d1 6287, d2 866.
- The exporter was run twice and produced an identical map on the second run.

## Open

- `pnpm check` fails. The material errors are listed in `ring-map-conflicts.md`: owner-only world-lock re-anchor, opening-leg reach/effort, combined-ground G69 runs, G71 continuation, creatures and two scatter slots.
- `pnpm verify` and `pnpm e2e` were not run because the prerequisite check is red. No push or PR is appropriate while required CI is known to fail.

## Exact next step

The owner decides whether A2's frame move may re-anchor G59 and how the first-night G71 road continues beyond this 192x192 map. With that answer, repair the three opening corridors and the combined ground paths in `plan.py`, relocate creatures/slots without deleting content, run `python3 docs/design/first-map/plan.py`, `python3 docs/design/first-map/export.py`, then `pnpm check` until it has zero errors. Only then run `pnpm verify`, `pnpm e2e` once, push, and open the PR to `develop`.

## Checks

- `python3 docs/design/first-map/plan.py`: pass after idempotence repair.
- exporter twice + byte comparison: pass.
- plan metrics (G56/G62/G64/G68/authored G69): pass as listed above.
- `pnpm check`: fail; expected rule conflicts and placement errors documented.
- `pnpm verify`: not run (check prerequisite failed).
- `pnpm e2e`: not run (must be last after verify).
