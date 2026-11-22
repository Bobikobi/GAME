# Loose stones (stages 1 and 2, #831)

Built from the owner's word in DECISIONS 2026-11-22 ("Loose stones in the world"). Kernel 0.35.0. Stage 3 (a pile that changes
the ground's height) is not built and waits for a building system.

## What a player does

| Press | Does |
|---|---|
| A on a tile with a stone | lifts it: a small stone into the bag, a large one over the head (both hands) |
| A on a tile with a pile | takes one stone from the pile |
| A while a large stone is held | sets it down on the tile |
| B | throws toward where the figure faces: the large stone if one is held over the head, else a small stone from the bag |
| Bag, "Put down" | sets small stones down on the tile (the existing drop); two or more make a pile |

A large stone is held over the head: the walk is slower (the load band of its weight), running is refused, and a throw goes short.

## Kernel rules

- **Sizes.** Small: thrown `small_range` tiles, rolls `small_roll` on. Large: `large_range` and `large_roll`. All are bounded params under `stones.*` in `content/core/params.json`.
- **Strength is `might`.** A stone is lifted only if the load limit (`loadMax`, which `might` raises) has room for its weight; a large stone weighs `large_weight` and counts in `loadWeight`, so it also sets the pace by the load band. No new attribute: the elf's might is 0 against the human's 1, so a figure with no might is refused a large stone ("That stone is too heavy for you.") ("too heavy").
- **Spots.** `map.stones.spots` in `content/core/map.json`: 20 spots in the valley, each a size. A spot with its stone taken stays empty until the stone returns.
- **A throw lands by direction and range.** The flight runs from the thrower toward the aim tile (a straight line, scaled by the power), stops short of a tile that cannot be stood on, then rolls on up to the roll tiles along the same line. Water takes the stone (it sinks, rests nowhere, and goes back to its spot after `return_ms` like any other). Power is permille of range; the full value 1000 is the only one built, so the charged throw of #827's track finds its place without a new action.
- **It comes home.** A thrown or set-down stone is on loan: after `return_ms` it leaves its tile and goes back to a spot of its size that was emptied.
- **An area holds at most `area_cap`.** The map is a grid of `area_tiles` squares (16); the stones in a square (spots with their stone, loose and lying) never pass the cap. A lift, throw or set-down that would is refused with a plain line.
- **Piles are numbers.** A pile is the count on a tile (`pile_max` at most). It can be taken apart one at a time and rearranged by lifting and setting down, and it never blocks a step.
- **The prey throw of #827 is unchanged.** The stone thrown at game is the same `core/stone` item, but its action and its numbers are not touched.

## Client

- Stones are drawn by count: one, two or three, and four or more (a heap of five pictures). A large stone is the same picture scaled up.
- A thrown stone flies on an arc (a longer throw rises higher), touches, bounces twice (a small stone hops, a large one thuds), slides on along the line while it slows, and turns as it goes. A stone that sinks goes under, smaller and fainter. Its shadow stays on the ground and thins as the stone rises. All of it is numbers in `game/src/stone-art.ts`: no picture is drawn by code.
- The landing tile shows the stone only after the flight ends.
- Phone (844 x 390) and desktop use the same code; the phone e2e is the group `stones-phone`.

## STAND-INs (marked `STAND-IN` in `world.ts`)

1. The large stone held over the head: the one stone picture above the figure's head, bobbing with the walk, until the carry clip is drawn.
2. The throw's lean: the drawn figure leans into the throw and settles back, until the throw clip is drawn.
3. The sink ring is a plain splash puff in code.

## Pictures the animation lane will need

No new picture is needed for stage 1 and 2 to play. These make it finished:

| Picture | Size | Notes |
|---|---|---|
| Stone, small (the item picture, scaled to 0.46, today) | about 28 x 24 art px at 64 art px per tile | its own drawing, so a pile reads as stones and not copies |
| Stone, large (the item picture, scaled to 0.95, today) | about 60 x 50 art px at 64 art px per tile | |
| Pile of 2-3 and heap of 4+ | one tile (64 x 64 art px) each | optional; the scaled stone picture stands in |
| Throw clip | the standard 8-frame clip, all eight directions, over-hand for a small stone, two-hand push for a large one | replaces the lean |
| Carry clip (walk with a large stone over the head) | the standard 8-frame walk, eight directions | replaces the stone riding above the standing frame |
| Lift clip | the existing pickup clip (DECISIONS 2026-11-20) serves both sizes | no new one |

## Tree

Loose stones sit with two schools of PROGRESSION section 4 and `SYSTEMS_ALIGNMENT.md`:

- **Hunting `track-read`**: the small thrown stone is the P05 small hunt's tool (#819); `track-read` finds the game the stone is thrown at.
- **Travel carrying nodes** `steady-load`, `heavy-going`, `shoulder`, `belt-loop` (PROGRESSION 4.8): a large stone is weight, so more load raises how much can be lifted and `heavy-going` softens the slow walk under it.
- **Proposed: Travel `shoulder-stone`** (small, after `shoulder`, `lift_pct`, 25): "You lift a large stone that others leave lying." It would lower the weight a large stone counts as. Not built: the node format is a proposal until the Travel school file exists.

## The 3D door

Paused (DECISIONS 2026-10-26). Stones stay a 2D-door change; the 3D game carries them when it resumes, in its own means.
