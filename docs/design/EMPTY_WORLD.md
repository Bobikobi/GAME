# The empty world: one world, endless lands, dozens of players, and what fills the streets (2026-10-20)

A decision page. The world is one for everyone (W1), it has no end (17.10), and at first a few dozen players will walk it, so for a long time most streets are empty on any screen. The owner's words set the bar: from the first session a player must feel "this world is huge" (17.10), the other players are planted in the first session (the order of 17.10), and he asked for players the game runs (CR-100, 11.10). Three answers exist, each with a cost; this page lays them side by side, recommends an order, and put one question to him, answered on 20.10 (section 5). Design only: nothing is built here, and no number below is a promise, only an estimate to compare by.

## 1. The question in one paragraph

A screen shows about 240 tiles; the first ring holds about 37,000 (192 by 192, 17.10), and later rings more. With a few dozen players online, spread over the ring, a screen holds a fraction of a player on average: the streets are empty, and a player who walks for an hour may meet nobody. The world cannot be made smaller (the owner wants it huge) and the players cannot be made more by a build. So the question is which of three things fills a screen: figures the game runs, places where the live players are funnelled together, or the traces the players leave behind them, which scale with the accounts that ever played and not with the players online now.

## 2. What was decided before this page, and where it stands

| Decided | Where |
|---|---|
| One world for everyone; copies only on a measurement, the owner's call | W1 |
| The world has no end; the first ring about 3 by 3 chunks around the valley; pillar 1's ceiling, no empty stretch past 90 seconds; authored places stamped on generated ground (a lake, a cave, a town; the boathouse with its keeper first) | DECISIONS 2026-10-17, "The world has no end"; NEXT 19 |
| A town or a fort per land, level 0; small safe pockets between; the promise relaxes with distance | W6 |
| An outing ends at the chest in town or at a camp; one store reached from every town; a fire anywhere is a safe place while it burns | W7; DECISIONS 2026-10-10, one store; 19.10, a fire anywhere |
| Presence before talk: others' camps, footprints, notes, then players seen moving, then chat; a crowd beyond a handful fades | W11; F33; F34 |
| Light presence (others' camps, tracks and notes) comes with the market, stage 4, before or after live presence as set when step 3 closes | DECISIONS 2026-10-17, the order; 2026-10-09, players' words |
| Characters keep hours; at dark they go home or to the inn; a quest is offered and handed in while its giver is awake; the night has faces of its own (a watchman on a round, a drunk, a smuggler); the inn sells beer and the night's road food | DECISIONS 2026-10-19, six open ends, 3 |
| What a death leaves: a pack where the body fell, any player may take it, gone a game day later | the same entry, 2; COMBAT.md G81 |
| Players may destroy in the wild and the valley repairs by a shared quest that eats goods and gold | the same entry, 1 |
| The sinks are the world's prices, in one table that is measured (`pnpm books`, gold made against gold burned per world per month); no upkeep, no tax on trade | the same entry, 6 |
| Only activity code mints; one ledger; a daily cap per account on the trader's pay; the trader's shares step down when mints beat burns; two funds that never meet; every mint and burn bounded with a reason | DECISIONS 2026-10-09, gold entering a world; 2026-10-10, prices and gold |
| A free market: a stock per item per world, drained by the world's demand on the server's hour; the shop and the trader as market maker inside the band | DECISIONS 2026-10-09, the crafting economy and the free market; 10.10 |
| Players the game runs (CR-100): NPC characters that play like everyone, gathering, crafting, buying and selling; fewer as real players join; open for the owner: visible or only in the market's numbers, their gold bounded, how many, how they give way, never a place, a quest or a rare find a real player wants | GRUNT CR-100 (the owner, 11.10) |
| No dead props: a sprite that looks workable must be workable | DECISIONS 2026-10-10, no dead props |
| A reaction is read, never run: a pure function of the content, the entity, the tick and the seed; nothing runs off screen, so an endless world costs nothing unseen | DECISIONS 2026-10-19, world reactions; REACTIONS.md |
| Players leave marks, never change the map | W10 |
| The returners' stone and a seen player's name are the names shown to other players before chat | DECISIONS 2026-10-17, the order, retry line |
| The world's hour is the server's clock and a player joins it by one `resume` (the owner, 20.10, PRESENCE section 0, A); a player who joins at the world's night arrives in a town at night | the clock entry of 20.10; PRESENCE 0 |
| A player who quits outside a safe place stays `logout_countdown_s`; a figure beyond the near ones is drawn faint | DECISIONS 2026-10-10; PRESENCE 8 |

## 3. The three answers, and what each costs

### 3.1 A. Characters the game plays (CR-100)

Figures that walk the world and look busy: gathering at a node, carrying a basket to town, standing at the market, drinking at the inn. CR-100 reads them as players who play like everyone and trade; the page splits that into two shapes, because the cost sits in the trade and not in the figure.

**A1, figures on routes, read never run.** Each is a character of the valley with a name, a look and a route: a list of places by the game hour (a node at 7:00, the market at noon, the inn after dark), computed from the tick and the seed the way a predator's round and the watchman's round are (19.10), so nothing runs off screen and the server keeps no state for them. They hold no gold, take nothing from a node, list nothing and buy nothing; the market's demand that drains the stock (9.10) is shown on their backs, a basket going out of town, and that is the one book they touch, by look alone. They are the valley's own people, named, with lines; they never pretend to be players, so a player card opens nothing on them and no name of theirs could be a player's. Fewer as the ring fills? Not by a rule: they are content, placed by the content's hand, and a town where real players crowd simply shows them less (F34 fades a crowd, and the content's own figures fade first). This is the reading the owner confirmed on 20.10 (section 5).

**A2, players the game runs, as CR-100 reads it.** Figures with a purse and a bag who sell to the trader, buy from the shop, list on the board and buy players' listings; "fewer as real players join" by a count the server keeps per world. Refused by his word of 20.10; it stays on the page as the cost it would have carried.

What A costs:

| | A1 routes, read never run | A2 players that trade |
|---|---|---|
| Kernel | a `route` on a character (`[{at, hour}]`) and one reader, `characterAt(tick, seed)`, the shape of `predatorAt` (small) | an actor with state, gold, a bag and a decision loop run on the server each hour (large); a new kind of entity beside player and foe |
| Content | a name, a look, a route and a line or two per figure; the first ring's town would want ten to twenty | the same, plus what each one wants and makes |
| Client | the figure drawn from the reader, as a character on a round is | the same, plus a shop sign and a board entry |
| The books | nothing: no mint, no burn, no stock moved | every sale to the trader is a mint outside every account's cap, every purchase of a player's listing is gold entering a purse from nowhere, every listing is supply that lowers the price for a real maker (the step of 9.10 would read it as a flood); each needs a bounded reason in the ledger and a line in the sinks table of open end 6, a third fund beside the two that never meet (10.10), and a cap of its own; `pnpm books` must subtract them to show what real players did |
| Rules | "no dead props": a figure that gathers at a node must leave the node as it was for the player, which the per-player yield already does; a figure never takes a place, a quest or a rare find (CR-100's own line) | the same, and R6 (only activity code mints) breaks unless their play counts as activity, which makes a machine mint, against F11 |
| What the player feels | a town with people in it, who keep hours and answer to a name; the wild still empty between towns, as it should be | a lived-in world until the player learns the figures are the game's, which every game that did it saw happen (bot-filled lobbies read as a cheat when found) |
| When | with the first ring's town and the night's faces (open end 3), the same schema line (`hours`, `night_at`) grown by one field | with the market, after a third fund is designed |

### 3.2 B. Towns as nodes everyone passes through

Nothing new is invented: the town is already where every outing ends (W7, the chest; one store reached from every town), where a quest is handed in by day and refused at night (open end 3), where the night is spent at the inn by its fire when the vigil is not kept outside, where a player who joins at the world's night arrives (PRESENCE 0), where the board sells for the absent (10.10), where the street is restored by many hands and the sign names them (10.10), where the returners' stone stands. This answer only says it out loud and keeps it true as the world grows: the few live players are pulled to the same few tiles at the same hours, and that is where a screen fills.

What makes it a funnel, by what exists: dusk pulls everyone to level 0 (the hunt at night, G30 relaxed far out); the inn sells the night (open end 3); the chest and the board sit on one square; the trainers, the shop and the workshop are stalls on that square (11.10); the first ring's stamped places each hold a keeper and an errand (NEXT 19, Q6), so between towns the pockets of W6 are the small nodes. One number keeps it a funnel: a town's square is small (`town.square_tiles`, about 30 by 30), so eight players in town fill a screen and eighty read as a crowd, which F34 fades past a handful.

What B costs: content (the inn and the night faces, already decided and planned with the forge's first phase), no kernel, no books. Its risk is the one it does not solve: between towns the world stays empty, and a world that is huge on purpose has long roads. Its gift is that live presence (build c of PRESENCE) shows figures at all: a relay that fans out positions over an empty ring shows nothing, and a town at dusk shows everyone.

### 3.3 C. Light presence: the traces of others

What a player leaves behind stays in the world for others to find, whether or not that player is online: the camp where a fire burned, the footprints in sand and snow, a note, the pack where someone fell (G81), the stump and the repaired footbridge with the names of the hands (open end 1), the returners' stone, the sign of a restored street. These scale with the accounts that ever played, not with the players online now, which is the only quantity that grows while the live count stays small. It is Dark Souls' model (bloodstains, messages, the ghosts of other players' moments), Journey's, and Death Stranding's (the structures and the ladders others left), and it is already the first stage of W11 and stage 4 of the order.

What a trace is, proposed:

| Trace | Left by | Stays | Shown as |
|---|---|---|---|
| a camp | a fire pitched and left (W7) | `trace.camp_days` (3) after the fire died, as cold ashes and a tent-ring | the fire sprite dark, a ring of stones, the name on a tap |
| footprints | every walk in sand and snow (the depth cue of 18.10) | `trace.steps_ms` (one game day), fading | the cue already planned, drawn from the chunk's trace list instead of the player's own walk alone |
| a note | a player's free text behind the filter (9.10) | `notes_max` standing; fades unless marked helpful | the note prop; the words on a tap; mute, block, report from it (SAFETY.md 7) |
| the pack | a fall (G81) | one game day | the pack sprite; `take` when adjacent |
| a stump, a felled grove, a broken bridge | a felling in the areas between players (10.10), a breakable thing (open end 1) | until regrowth or the repair quest | the prop's broken state; the names on the repair's sign |
| the returners' stone, the street's sign | the opening's return (17.10), a group restore (10.10) | for good | the names carved |
| a moment | the tile and the pose a player stood in when a quest step closed (the clue, the find, the bridge), a few per player per day | `trace.moment_days` (7) | a faint figure that plays its pose once when seen, nameless, as Dark Souls shows a ghost; the only trace that is not a thing |

How it works, proposed: traces are rows of one table on the server (`marks`: kind, chunk, tile, the account's number, a small payload, `until`), written by the kernel's events the server already sees (`kindle`, a note placed, `fall`, `fell`, a step closed) and read with the state at load and at every chunk crossing, a chunk's list at a time, capped per chunk (`trace.per_chunk`, 64, oldest out) so a ring never fills with ashes. No relay is needed; the relay later tells the room of a new trace as it tells of a `placed`. A blocked player's traces are hidden (10.10); a trace carries the name the world shows and nothing else (PRESENCE 4); a moment carries no name at all. The client draws from the chunk's list what it already knows how to draw: the fire, the tent-ring, the note prop, the pack, the figure with a pose.

What C costs: one table and one route on the server; the kernel's events as they are (`kindle`, `fall`, `take`, the note's place) plus one event for a closed step; the client's drawing of what exists, and one new small thing, the faint figure of a moment; content nothing. The books nothing: no trace is worth anything, a pack holds only what the outing found (G81), a camp is cold. The risk is a littered ring, held by the caps, and a privacy question already answered by SAFETY.md (the name on a tap, mute, block, report from any trace).

How the three fill a screen, an estimate by which to compare, the first ring, a screen of 240 tiles, three standing notes and one camp per account and a few moments:

| Online now | Accounts ever | A screen in the wild holds | A screen in town at dusk holds (B) | Traces per screen (C) |
|---|---|---|---|---|
| 12 | 100 | 0.1 player | 2 to 4 players | 3 |
| 40 | 500 | 0.3 player | 8 (a crowd fades past a handful) | 10, capped by the chunk |
| 200 | 3,000 | 1.3 players | the square is full | the cap |

## 4. The recommendation

C first, B said out loud and kept true, A as A1 only and never A2.

- **C fills the screen with the quantity that grows.** At a few dozen players online, only the traces of the few hundred who ever played can make the wild read inhabited, and they cost a table and a route. They are the first stage of W11 already, and they are honest: everything a player finds was left by a person.
- **B is where live presence shows anything.** A relay over an empty ring shows nobody; a town at dusk shows everyone, and the pieces (the inn, the hours, the chest, the board, the stone) are decided or built. The page adds only the square's size as a number and the reading that a town is the funnel on purpose.
- **A1 gives the town its own people** and costs one field on a character the night's faces already need. A2 is refused as a recommendation: its cost is a third fund in the books and a cap of its own, and its gift lasts until a player learns the figures are the game's. The owner asked for CR-100 on 11.10 before the hours of 19.10 and the traces of W11 existed; asked in section 5 whether A1 is his reading, he said A1 (20.10).

The order: C with the market stage (stage 4 of the order, as W11 has it), B's square and the inn with the forge's first phase, A1's routes with the first ring's town and the night faces; A2 never (his word, 20.10).

## 5. The question to the owner, in the section 6 form

```
To the product owner, a product question in the game:
Asked: whether the players the game runs (CR-100, your word of 11.10) are the valley's own people on routes, named, holding no gold and trading nothing (A1), rather than figures that play and trade as players do (A2)
Breaks: CR-100 as written, "play like everyone, gathering, crafting, buying and selling": A1 keeps the look and drops the trade
The player would feel: a town with people who keep hours and answer to a name, and never the moment of learning a "player" was the game's
My recommendation: A1, with the traces of others (C) and the town as the funnel (B) first; A2 only if you want the market moved by figures, and then with a third fund in the books
Needed from you: A1 / A2 / other
```

**His word (20.10): A1.** Recorded in DECISIONS.md in its own entry; sections 3.1, 4 and 8 follow it, and CR-100's trade line is superseded in part.

## 6. Parameters (every time names its clock, CR-93)

| Parameter | Value to start | Clock | What it does |
|---|---|---|---|
| `town.square_tiles` | 30 | - | the side of a town's square, the funnel's size |
| `trace.per_chunk` | 64 | - | traces a chunk keeps, oldest out |
| `trace.camp_days` | 3 | real days | cold ashes after a fire died |
| `trace.steps_ms` | one game day | the world's hour | footprints fade |
| `trace.moment_days` | 7 | real days | a moment stays |
| `trace.moments_per_day` | 3 | the world's hour | moments one player leaves a day |
| `notes_max`, `logout_countdown_s`, `presence.near`, `presence.faint` | as their pages | as their pages | read here |

## 7. Rule lines proposed, in the form GAME_RULES uses

Numbers provisional (G100 onward, after G99 of SAFETY.md); the rules pull request assigns them.

- **G100 No figure pretends to be a player.** A character the game runs is the valley's own, named, on a route read from the clock, holding no gold, taking nothing and trading nothing; it never carries a player's card, and no name of a character could be a player's (10.10). Fewer figures where players crowd is the content's hand and F34's fade, never a count the server keeps.
- **G101 A trace is a person's, worth nothing, and capped.** What a player leaves in the world (a camp, footprints, a note, a pack, a repaired thing's sign, a moment) is written by the kernel's events, kept per chunk under a cap, carries at most the name the world shows, and holds no value beyond what the outing found. The world is filled by what people did, never by what a machine pretended.

What the check enforces: a character with a `route` has `hours` and no `shop`, no purse and no listing (G100); every trace kind names its `until` and its clock (G101, CR-93); `trace.per_chunk` is bounded.

## 8. The order, and what this page does not do

- Now: this page; the owner's one answer (section 5), A1, recorded on 20.10.
- With the market stage (stage 4 of the order): the traces of C, the `marks` table and route, the client's drawing of what exists, the moment as the one new figure; with light presence as W11 has it.
- With the forge's first phase (open end 3): the inn, the hours, the night faces; the square's size.
- With the first ring's town: A1's routes (his word, 20.10).
- Numbers to measure before the step ships, in PRESENCE section 9's way: traces per chunk in a week of play, how many a screen shows in the wild and in town, the share of players who tap a trace, and the share of a session spent in town at dusk.
- Not done here: the figures' routes and names (content); the stills of a town at dusk and of a trace on the ground (a direction decision of its own, two or three phone stills before any sprite); copies of the world (W1, on a measurement); the relay's part (PRESENCE build a); chat (last).
- Pages this page touches when its rules pull request lands: GRUNT CR-100 (closed by his answer of 20.10: the trade line out, the route line in); W11's list of traces (the moment added); PRESENCE section 10 (pointed here); SETTLEMENT (the square); REACTIONS.md section 10's open line (after #223, the pointer pull request).

## Sources

- Dark Souls (FromSoftware, 2011): bloodstains, messages and the ghosts of other players' moments fill a world with few live players; Journey (thatgamecompany, 2012): one companion at a time and the marks of the others; Death Stranding (Kojima Productions, 2019): the structures and signs other players left, in a world walked alone.
- Old School RuneScape: the bank and the Grand Exchange as the squares where everyone stands; World of Warcraft: the capital city at the expansion's hour, empty zones in between.
- Valheim (Iron Gate, 2021): the model of 17.10, one seed and places stamped in; its servers of a few friends on a huge map, the empty-world question in its plainest form.
- The games that filled lobbies with figures of their own and were found out: the player's trust once lost over a figure that was not a person, the reason A2 is refused here.
