# docs(design): the bestiary - the first twelve animals of the valley and the first ring

## What and why

Adds `docs/design/BESTIARY.md`, a design page for the first twelve animals of the valley and the first ring. It is built from `docs/research/research-hunting.md` and the game rules. The table gives each animal's tier, behavior, size, look, goods, hours, hearing, notice radius by the player's gait, tool gate, and pay and cap. A rules section covers no blood, no babies, no pets as prey, no spawn on safe ground, dusk go-to-ground and noise by gait. The page also covers the opening's ambient five, what it leaves undecided, and six open questions with the defaults it was built on. Docs only: no content JSON, no generated file touched.

## The twelve by tier

- d0 (ambient and flee): sparrow, carrion crow, trout, hare, roe deer (the five already placed, the ambient set of the opening), and ground fowl.
- d1 (defend): wild boar, dust adder. Highland goat (flees) also sits here.
- d2 (hunt): wolf, wildcat, white bear.

## Checks

- `pnpm install --frozen-lockfile` finished in seconds. `pnpm check`: 103 files checked, 0 errors, 54 warnings; a docs page changes nothing, so unchanged, N warnings as on develop (all warnings are art lines, none about this page).
- No em or en dash in the file (`grep -c -E '—|–'` prints 0); 84 lines.

Quest review: clear (no quest text).
Story review: clear (a design page, no text a player reads; no claim about the past).
Source: none (a design page, no picture).
Tree: none: a design page; nothing a player can grow in changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PpsERunKoRGm7s8QH4Y3Pu
