# The first ten minutes, recut: two options for the owner's pick

A one-page recut of the opening, as the owner ordered on 9.10 (`DECISIONS.md`, "The owner added maze and stealth to the palette, and set the order of the variety work"). Nothing here is built yet. After the pick, the chosen beats become content, and they ship together with the maze, the next item in that order.

## The brief

- In the first ten minutes, five kinds of question, each with a different hand: one taught strike, one find by the senses, one real choice, one riddle, and one maze or night discovery.
- The minigame window appears once or twice in those ten minutes, not at every pick.
- Every beat is content that both valleys read: quests, steps, map slots, props and nodes. The 2D client and the 3D client draw the same beats, and no beat depends on one engine.
- What stays fixed: no fighting (G35), no gear tiers against hazards (9.10), a choice is real (G12), two quests in a row never share a type (G17), and getting an item is never one motion (G18).

## Today's opening (`develop`, 9.10)

| Order | Beat | Type | The hand | Windows |
|---|---|---|---|---|
| 1 | Three river stones mend the bridge | `skill` | strike | 3 |
| 2 | Three branches and two berries, a fire, a berry mash | `mastery` | snap, pick, cook | 3 |
| 3 | Follow the smoke to the town square | `investigation` | walk | 0 |
| 4 | Maru's bellberry, behind the ruins, by day | `fetch_twist` | pick | 1 |
| 5 | Pell's stall: the basket or the trowel | the choice | buy | 0 |
| 6 | Pell's sunleaf, on the open bank at noon | `discovery` | pick | 1 |
| 7 | The three stones name a lantern, and the coin is under it | `riddle` | read, dig | 1 |

That is about nine windows. Four of the seven beats are "press A at a node". The stall is the only choice. On the ladder (`GAME_RULES.md` section 2), the riddle lands after minute ten. Nothing happens at night.

## Option A: the valley by day, closing on the maze (recommended)

| Minute | Kind | Beat | Hand | Window |
|---|---|---|---|---|
| 0-2 | taught strike (`skill`) | The bridge waits on one keystone in the shallows. The strike is taught on it once, in one line, with a second try after a miss. The bridge mends. Its quest pays the price of one tool, together with a recipe, so the reward is not coins alone (G4). | strike | 1 |
| 2-4 | find by the senses (`investigation`) | The fire needs dry wood, and only one log in the wet reeds is dry. It glints once the player is near, and a senses point widens the circle (the dig-site hint the game already draws). It is picked up without a window. | look, walk | 0 |
| 4-6 | real choice (G12) | Pell's stall: the basket or the trowel. The stall shows what each opens: the basket opens the garden and the herbs, the trowel opens the dig. Both lead on. The garden pays 30 gold, the price of the trowel, and the coin pays the basket, so whichever road comes first pays for the other tool. | buy | 0 |
| 6-8 | riddle (`riddle`) | The three stones name the hill lantern, and the coin is under it. With the basket, this beat comes after the maze. | read, dig | 1 |
| 8-10 | maze (`maze`) | Maru's garden, where the bells rang, lies at the heart of a tangle of fallen walls behind the ruins. The tangle has dead ends that cost a walk back. The bell tower shows over the walls as the landmark, and moss grows on the side of the stones that faces the river. Reaching the heart is the step (`visit`). | find the way | 0 |

**What it needs.** Map tiles for the tangle and a slot at its heart. The keystone node. One dry log as a hidden spot that is taken without a window: one optional field, so the change stays additive. New text for the bridge, the fire and Maru's garden. The kernel does not change.

**What moves on the ladder.** The first meal leaves the first ten minutes and becomes the evening at the camp. Pell's herbs at noon come after minute ten. The riddle moves from minutes 10-20 to minutes 6-8.

## Option B: toward the first dusk, closing on a night discovery

| Minute | Kind | Beat | Hand | Window |
|---|---|---|---|---|
| 0-2 | taught strike (`skill`) | As in A. | strike | 1 |
| 2-4 | find by the senses (`investigation`) | As in A. | look, walk | 0 |
| 4-6 | real choice (G12) | As in A. | buy | 0 |
| 6-8 | riddle (`riddle`) | The three stones name the hill lantern. At dusk the lantern glows and lights the tile to dig. | read, dig | 1 |
| 8-10 | night discovery (`discovery`) | After dark, the arch in the mist at the edge of the ruins shows a path that is not there by day. Walking it reaches the threshold of the night ruins: the first sight of the expedition (G36), with nothing to fight and nothing that hunts yet. | walk at night | 0 |

**What it needs.** Everything A needs except the tangle, plus:

- The first day starts at noon, so the dark (20:00) falls near minute seven. The kernel's clock counts tick 0 as 6:00 (`hourOf`), so this is a kernel change, and it moves the clock of every save.
- The night visit itself exists already: a riddle's answer can be a `visit` at night. What the visit opens does not exist yet. It needs either a path that both clients draw only at night, or a place reward, which the schema does not have yet.

When the hazard system lands (P-5), the opening's first night has to stay at the town's safe edge.

## Why A

- A changes no kernel code.
- It builds the maze, the next item in the owner's order, so the recut and the maze land as one piece of work.
- It keeps the first night for the end of the first session, where the ladder already puts a mark of the day and a door left open.

B tells the stronger story, but it moves the clock for every save and brings the night in before the hazards that make the night mean something. The night discovery fits better as that first session's ending, after P-5.
