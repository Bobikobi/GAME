# Ring map: rule conflicts found while exporting A2

- G59/world lock: moving frame 1 by `(+66,+84)` changes the locked opening coordinates. The lock needs the owner's explicit re-anchor; it was not edited.
- Opening effort: the rigidly moved wakes currently produce unequal first legs, and the north leg is disconnected. Changing the opening's legs or pays is outside this task, so the exporter does not bend the check.
- G69: `plan.py` measures each authored centreline at at most 7 straight tiles, but the runtime checker also sees adjacent/intersecting path tiles as longer combined runs (up to 13 in the current export). The raster must be polished so the actual ground, not only each source route, stays at 8.
- G71: the 192-tile A2 plan reaches its outer lands long before first dusk. NEXT 19 asks for the first map, while the current G71 check requires the road beyond each exit to carry the remaining first-night distance. That continuation is not present in A2 and must be decided before the map can pass.
- Existing creatures and two scatter slots still need placement reconciliation against the moved terrain. Removing them to make the check green would silently discard live content, so they remain visible as errors.
