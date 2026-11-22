# The jump and the fall: where it sits in the skill tree

Tracker #826. Decision: DECISIONS 2026-11-22 "The jump and the fall". Built in kernel 0.34.0 (`kernel/src/jump.ts`, the `jump` action, the `jump` params block).

## 1. What the player does

A jump is a base verb of the body, free to every player from the first minute on (not the very first minute itself): one tile ahead, or across a gap of water one tile wide, costing a little breath. Up it climbs one level where a step is refused (G68). Down it falls from any height, and the fall hurts by its levels: 1 level nothing, 2 a fifth of the health cap, 3 half, 4 or more death (G33). The numbers are `params.jump` with bounds (basis points), not code.

## 2. Where the work sits in the tree

Read first: `content/core/schools/` (six live schools, all gathering or crafting: cooking, digging, fishing, foraging, handcraft, woodcutting) and PROGRESSION section 4.8 (Travel, a proposal; Climbing in the school table).

- **The jump itself is not grown.** It is the body's own verb, like a step, so it sits on no node. Nothing a player trains opens or closes it.
- **What grows is how the fall is taken.** No live school fits, and Travel (4.8) does not exist as a file yet. The proposal below extends the tree there. The pull request's line is `Tree: extends the tree: docs/design/JUMP_FALL.md`.
- **The overlap is settled (the manager's ruling, 22.11).** The free jump is the base everyone has; Travel's nodes stay and grow on top of it. `scramble` keeps its id as the safe form of the one-level step up: no breath spent and no jump arc. `leap` widens to a gap two steps wide, because a gap one tile wide is now free. PROGRESSION 4.8's `scramble` and `leap` rows and the `leap` node text change in the same pull request.

## 3. The proposed node

A major node in Travel's Trail branch, after `ledge-walk`, in the school file's format:

```json
{
  "id": "soft-landing",
  "name": "Soft landing",
  "text": "You land as if one level lower: a drop of three levels hurts as a drop of two.",
  "size": "major",
  "needs": ["ledge-walk"],
  "effect": "fall_levels_less",
  "value": 1,
  "icon": "to be chosen with the node"
}
```

- `fall_levels_less`: an integer count of levels taken off a fall before `fallHarm` reads it. 2 levels become 1 (nothing), 3 become 2 (a fifth), 4 become 3 (half instead of death). It never lowers the drop below 0 and never changes where a jump may go.
- A second, later copy of the effect may sit on a piece of gear (a soft sole): the effect adds, to a ceiling of 2 levels, so a drop of 5 or more is death at any rate.
- Climbing's `grip` ("a fall from a climb is not a fall") is a different thing: it is about a rope, not a jump.
- Not built here: the effect id, the node and its icon need the schema's effect list and the Travel school file, which are their own small pull request (PARALLEL.md: a shared file lands first and alone).
