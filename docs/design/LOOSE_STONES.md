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

- Stones are drawn by count: one, two or three small ones each its own picture; four or more small ones are one rubble heap (the existing `props/rock_stones`); with a large stone among them, a heap of five pictures. A small stone is its own drawing (`items/stone_small`, 28 x 24 art px), a large one the item picture `items/stone` (60 x 49).
- A thrown stone flies on an arc (a longer throw rises higher), touches, bounces twice (a small stone hops, a large one thuds), slides on along the line while it slows, and turns as it goes. A stone that sinks goes under, smaller and fainter. Its shadow stays on the ground and thins as the stone rises. All of it is numbers in `game/src/stone-art.ts`: no picture is drawn by code.
- The landing tile shows the stone only after the flight ends.
- Phone (844 x 390) and desktop use the same code; the phone e2e is the group `stones-phone`.

## Pictures and clips (DECISIONS 2026-11-23)

| Picture | Where | Notes |
|---|---|---|
| Stone, small | `items/stone_small`, drawn for this (PixelLab, draft b of three) | 28 x 24 art px, shown at 1:1 |
| Stone, large | `items/stone`, reused | 60 x 49 art px |
| Heap of 4+ small stones | `props/rock_stones`, reused | shown at 0.8 |
| Pebbles (2-3 stones) | `props/pebbles` considered and not adopted | one picture for 2 or 3 stones hides the count; each stone keeps its own drawing |
| Carry clip | `chars/<race>_carry_<view>`, 3 races x 3 views, 8 poses and the standing pose, 192 px frames | the figure walks with the stone over its head; the pose follows the distance walked at the walk's stride |
| Throw clip (small stone, overhand) | `chars/<race>_throw_<view>`, 9 frames at 78 ms | the stone leaves the hand at frame 4 (312 ms) |
| Push clip (large stone, two hands) | `chars/<race>_push_<view>`, 9 frames at 78 ms | the stone leaves the hands at frame 2 (156 ms) |
| Lift | the existing pickup clip, played for the lift's time | no new one |

Right and back-right views are the left ones mirrored (flips only left to right). The sink ring is still a plain splash puff in code (STAND-IN).

## Tree

Loose stones sit with two schools of PROGRESSION section 4 and `SYSTEMS_ALIGNMENT.md`:

- **Hunting `track-read`**: the small thrown stone is the P05 small hunt's tool (#819); `track-read` finds the game the stone is thrown at.
- **Travel carrying nodes** `steady-load`, `heavy-going`, `shoulder`, `belt-loop` (PROGRESSION 4.8): a large stone is weight, so more load raises how much can be lifted and `heavy-going` softens the slow walk under it.
- **Proposed: Travel `shoulder-stone`** (small, after `shoulder`, `lift_pct`, 25): "You lift a large stone that others leave lying." It would lower the weight a large stone counts as. Not built: the node format is a proposal until the Travel school file exists.

## The 3D door

Paused (DECISIONS 2026-10-26). Stones stay a 2D-door change; the 3D game carries them when it resumes, in its own means.
