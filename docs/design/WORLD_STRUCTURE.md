# The world's structure: the page every agent reads first

Status: written 19.10.2026 from the owner's decisions of 16-19.10 and the owner's answers of 19.10 to the structure questions (section 13). This page says what the world is: one world or several, what the ground is made of, where it ends, where it is safe, where players fight, how they travel, who changes it. The older pages hold the detailed rules and stay in force; where an older line says otherwise (OPEN_WORLD's 1024-tile cap, its closed edge, its crossings as the only way on), this page is the current word and the older line is being rewritten through [RULES_REVIEW.md](RULES_REVIEW.md). An agent that finds a contradiction between this page and another cites the two lines in its hand-back and builds nothing on the older one.

The target the owner set: a game of the family of RuneScape, World of Warcraft and Drakantos, which means one persistent world shared by many, a character that grows, quests, combat, a market and groups. Each section below ends with what those three do, so a reader sees the choice and not only the rule. Short names: OSRS = Old School RuneScape; WoW = World of Warcraft; DRK = Drakantos (in beta; "not public" where it has not said). [GAP_WOW_RS.md](GAP_WOW_RS.md) and [GAP_DIMRAETH_DRAKANTOS.md](GAP_DIMRAETH_DRAKANTOS.md) hold the play and art comparisons; [FOUNDATIONS.md](FOUNDATIONS.md) holds the base rules every shared world settles (authority, identity, persistence, fairness, conduct), with the same three columns.

Ids: W1-W12 are this page's. They are structure, not play rules; a play rule stays a G (GAME_RULES, OPEN_WORLD), a kernel rule an R, a story rule an S. A W line that needs a check names the G or R that holds it.

## 1. One world

**W1. One world for everyone.** Every player lives in the same persistent world: one map, one economy, one community, one clock. A player who meets a place meets the same place every other player meets. The world is split into copies only if a measurement, on the live server, shows that one server cannot hold the players; then it is split as copies of the same world, and the owner decides, never a build.
- Why: pillar E of the review (one world, the same for everyone) and the economy's band between players (R6-R12) both assume one market. A split by design doubles every world event and halves every community.
- Holds: the server is the only truth (R1-R4); accounts and all state on the server (18.10); one account per person per world (10.10).
- OSRS: dozens of identical worlds, a player hops between them with the same character; the market (the Grand Exchange) is one across all of them. WoW: realms, a character belongs to its realm; since 2014 realms are joined and sharded behind the scenes so a zone never looks empty. DRK: not public. Openfold starts where WoW ended up: one world, splitting only under measured load.

**W2. One account, reached through an outside door.** A person signs in through an external account (Google, Apple or Steam; the entry of 18.10 names email, Google and Discord, and the owner's answer of 19.10 adds Apple and Steam) and the game keeps no password of its own. Getting the account back is the provider's job; support never enters a character. The demo needs no account; the account comes when the opening ends (3.8, 9.10).
- OSRS: its own account with an authenticator and recovery questions, after a long history of hijacks. WoW: Battle.net with an authenticator. DRK: Steam's account. Openfold takes DRK's road.

## 2. What the ground is made of

**W3. A hand-made valley at the centre, generated ground around it.** The valley (`core/world`) is the first region and the opening never moves (G59, with its one-time exception of 18.10). Around it lies ground generated from one seed, the same for every player and every load, integer-only in the kernel (17.10). The ground is cut in chunks of 64 x 64 tiles; the first ring is about 3 x 3 chunks, measured on a phone before the next ring is opened.

**W4. The unit a player knows is the place, and places make a land.** The world grows by authored places stamped onto the generated ground at chosen spots: the core team's and the creators'. Places are grouped into lands, each with a name and its own small story (the D3 decision of 16.10: the valley is the first region of the first land; G7 and G22 read "the region's"). Rings are the build order and the budget, never something a player is told about or sees as a line on the ground. A land may span rings; a ring may hold parts of several lands.
- Holds: G57 (the world grows by region files through the loop), G62 (pillar 1's ceiling per chunk), G64 (danger rises with distance from town, area by area).
- OSRS: the whole map drawn by hand, kingdoms with their own stories, danger by distance in the Wilderness. WoW: zones by level band, each with a story, all hand-made. DRK: hand-made, not public beyond that. The closest model for the generated part is Valheim (one seed, biomes harder with distance, hand-made locations stamped in). Openfold keeps OSRS's two halves, hand-made places and danger by distance, and only the ground between the places is generated.

## 3. Where the world ends

**W5. A soft edge: mist, near-blindness, a countdown.** The built world has no wall. Past the last opened ring the mist thickens until the player sees almost nothing; a countdown to a fall starts, in the world's own signs (the mist, the cold, the screen), never as a number (CR-17). Turning back ends it; staying ends the outing by the fall rule (G33, G65). When the next ring opens, the mist lifts over it and whatever the ground already held there (trees, rocks, water) stays as it was: the player who walked into the mist walked on ground that was already true.
- Holds: G66 (mist is not a border; here it is the edge's sign, not its mechanism: the countdown is), G53 (every edge is readable), G65 (a fall never costs more than a set walk). OPEN_WORLD's G54 (three border kinds, a closed grid edge) is superseded by this line.
- OSRS: fences, cliffs and water; the map simply ends. WoW: the open sea, where a fatigue bar fills and the swimmer dies: exactly this model, with the countdown drawn as a bar. DRK: not public. Openfold takes WoW's sea and puts it on land, with the countdown told by the world and not a bar.

## 4. Where it is safe

**W6. Towns and forts per land, small safe pockets between, and the promise relaxes with distance.** Each land has a town or a fort, where nothing hurts (level 0). Between them lie small safe pockets. Near the valley the promise of G30 holds whole: a safe place is always within a run. Far out it relaxes on purpose: the owner wants a large world, and a safe place within every run would give too many escape hatches. Far out the answers are a fire of one's own (19.10: a fire anywhere outside town is a safe place while it burns), healing, and the land's fort; the player who goes far accepts that the way back is long.
- Holds: G30 (narrowed as above), G48 and G47 as the review splits them, G64, G65.
- OSRS: banks and towns everywhere in the settled kingdoms, nothing in the Wilderness. WoW: inns and flight points spaced by zone; the far zones are long walks. DRK: not public. Openfold is OSRS near the start and WoW far out.

**W7. Where an outing ends.** An outing ends at a safe place where its finds are kept. The store chest in town keeps everything. A fire of one's own keeps the night and, in the middle form, part of the finds. The owner left two forms open on 19.10 and the builder picks none without the owner's word:
- the middle form: a fire keeps part of the finds, the chest keeps all (recommended: it needs no new item, and it matches the 19.10 entry that dropped the tent);
- a fire with a tent: setting it up costs time and resources and the tent takes bag space; in return it keeps the whole outing. If this form is wanted, the tent is an earned thing under W9, not a starting item.
- OSRS: a bank keeps everything; death keeps three items. WoW: nothing is ever lost, a corpse run and repair. DRK: not public. Openfold loses only the outing's finds, never gear or made things (G33), softer than OSRS and matching WoW.

## 5. Where players fight

**W8. Combat after the foundation; a marked zone for fights between players.** Combat is a core part of the game and is built after the foundation (19.10): in the wild (danger level 1 and up, G64) and in expeditions, never in a town and never on level-0 ground. Players fight each other only inside a marked zone in the wild, entered knowingly, with a warning at its edge and a way to read the line from inside; there anyone may attack anyone. Everywhere else no player can hurt another. A fall in the marked zone costs what G33 says and nothing more; whether the one who caused it takes those finds is a detail of the combat frame, not of this page.
- Holds: 3.9 (protection levels safe / wild / contested; entering an area between players is the consent), G33, G35 (the demo's rule), G76 as the review proposes (nobody's act closes the world for another; the marked zone is the one exception).
- OSRS: the Wilderness, with a level line at its edge and a warning: the model taken here. WoW: War Mode, a switch the player flips in a city, so a flagged player can be attacked in most of the world. DRK: ranked PvP, opt in, in its own place. Openfold takes OSRS's zone, not WoW's switch, because a zone is a place the kernel can hold and a switch is a state that follows the player everywhere.

## 6. How players travel

**W9. Walking is the base; every faster way is earned by level.** Every step costs time (D5, settled this far). Any faster way the developers propose is legitimate: an item, a branch of a skill, a mount that runs faster, a teleport to a place the player has been or to a new one. Each is earned at a level that fits it; some are easy to reach, some are hard; none is bought with money (G39) and none is free of the world's danger by distance. A proposal names the level it is earned at and what it costs to use, and the check holds that no way lets a level-one character cross the far rings. A new way to travel is a content proposal under W10, not a rule change.
- Holds: G60 (walking priced on foot from the nearest town), G61 (shortcuts and fast routes come later, in this shape), R9 (rate and reach capped by level).
- OSRS: teleports learned as spells and carried as jewellery, each costing runes or charges, the far ones gated by quests. WoW: flight points found on foot once, then paid per flight; mounts at a level and a price. DRK: mounts (its griffin), not public beyond that. Openfold allows all of them, on the one condition that each is earned.

## 7. Who changes the world

**W10. Creators propose, checks run, the core team reviews; players leave marks, never change the map.** A creator proposes a change to an existing area the same way an extension is proposed: by pull request. The automatic checks run on it (`pnpm check`, the world lock G59, the per-chunk checks of G62 and G64). A change that passes raises an alert to the core team, which reviews it before it lands; one approval, the owner's, until five creators have had an extension merged (18.10). A player changes the world only through what the rules let a player leave (a fire, a camp, a note, a mended way) and never by editing ground, buildings or a place; what one player leaves never closes a way for another (pillar E, G76). A shipped place is never removed and the opening never moves (G57, G59).
- OSRS: the studio alone changes the map, and every change passes a player poll at 70% yes. WoW: the studio alone, in planned patches; one remake of the old world (2010) is the counter-example players still argue about. DRK: the studio alone. Openfold is the one where the community builds, and the check plus the review keep it one world.

## 8. How players meet

**W11. Presence before talk, talk last.** The order of 17.10: accounts and the server, then the first ring, then presence without chat (others' camps, footprints, notes, then players seen moving), then chat with its filter, ladder, mute and block. A crowd never hides the world: beyond a handful, others fade (10.10).
- OSRS, WoW and DRK: chat from the first minute. Openfold's own order; the reason is that every word a player can type needs the filter, the ladder and a person reading reports, and none of that is foundation.

## 9. The frame every line above sits in

**W12. One game, two doors, one kernel, one clock.** Every rule and every decision on this page holds in the pixel game and in the 3D game alike (18.10); the pixel game gets the effort first. The kernel stays pure, integer and on tiles with free movement on top (18.10). One hour for all, every time names its clock (10.10, CR-93). The screen never shows a chance, a level, a difficulty, a danger or a time left as a number: the world shows its values (CR-17, proposed as G77).

## 10. The five pillars the rules hang under

From [RULES_REVIEW.md](RULES_REVIEW.md) section 2, in one line each, so this page is complete on its own:
- **A. Every minute pays.** No stretch of play passes 90 seconds without something that pays (pillar 1's ceiling, G62 per chunk).
- **B. The world answers by rules, learned by watching, never told by a number.**
- **C. Every task is a question** the player answers with what they know, never "repeat the verb N times".
- **D. Effort is never wasted:** a fall costs the outing, never the account; a save always loads.
- **E. One world, the same for everyone, and nobody's act closes it for another.**

## 11. The three games in one table

| Question | OSRS | WoW | DRK | Openfold |
|---|---|---|---|---|
| One world or many | Many identical worlds, free hopping, one market | Realms, joined and sharded behind the scenes | Not public | One world; copies only under measured load (W1) |
| Account | Its own, authenticator | Battle.net | Steam | An external login, no password of its own (W2) |
| The ground | All hand-made | All hand-made | Hand-made | A hand-made valley, generated ground, stamped places in named lands (W3, W4) |
| The edge | Fences and water | The sea and fatigue | Not public | Mist, near-blindness, a countdown (W5) |
| Safety | Banks everywhere, none in the Wilderness | Inns by zone | Not public | Towns per land, pockets, relaxed far out (W6) |
| What a fall costs | All but three items | Nothing for good | Not public | The outing's finds (W7, G33) |
| Players against players | The Wilderness | A switch (War Mode) | Ranked, opt in | A marked zone in the wild (W8) |
| Travel | Teleports that cost runes | Flight points, mounts | Mounts | Walking; faster ways earned by level (W9) |
| Who changes the map | The studio, after a poll | The studio | The studio | Creators by pull request, checks, the core team's review (W10) |
| Chat | From the first minute | From the first minute | From the first minute | Presence first, chat last (W11) |

## 12. What the older pages become

- [GAME_RULES.md](GAME_RULES.md) stays the rule page for play; the review's approved lines land there in the second pull request.
- [OPEN_WORLD.md](OPEN_WORLD.md) keeps G51-G53, G56-G69 as detailed rules under W3-W9. G50 (the 1024-tile cap), G54 (a closed grid edge) and G55 (crossings as the only way on) are superseded by W3 and W5 and carry a note at the top of that page until the rewrite.
- [docs/kernel-review-v1.md](../kernel-review-v1.md) R1-R12: unchanged; W1, W9 and W12 cite them.
- [FOUNDATIONS.md](FOUNDATIONS.md): the base rules with their open questions; the answers of 19.10 (the account, a caught bot, the fight zone) are written there.
- [AGENTS.md](../../AGENTS.md) points here before any work on the map, the ground, rings, lands, travel, safety or who may change what.

## 13. The owner's answers of 19.10, as given

Each question was asked with the three games' choices beside it; the answer is kept here in its substance so a later reader knows what was decided and what was left open.
1. **The unit of content:** an authored place stamped on generated ground, grouped into lands with a name and a story. Rings are the build order only. (W4)
2. **The edge:** a soft border. Crossing it, the player vanishes into mist and sees almost nothing, with a countdown toward a fall. When the map grows, the mist lifts and what was there (trees, for example) stays. (W5)
3. **Safety far from town:** towns and forts per land with small safe pockets, but the rule that a safe place is always within a run may be relaxed; healing is an answer; a large world must not have too many escape hatches. (W6)
4. **Where an outing ends:** either the middle form (a fire keeps part, the chest keeps all) or a fire with a tent that costs time and resources and takes bag space. Left open; the recommendation is in W7. (W7)
5. **One world or several:** one world for everyone; a split only if a measurement says the server cannot hold. (W1)
6. **Changing existing areas:** creators ask to change what exists the way they ask to extend the game; it goes through the automatic checks and raises an alert to the core team for review. (W10)
7. **Fights between players:** a marked zone in the wild where anyone may attack anyone, like OSRS. (W8)
8. **Travel in a large world:** every form the developers want is legitimate, but each must be earned by player level: an item, a skill addition, a mount, a teleport to new or visited places; some easy, some complex. No single form picked, none ruled out. (W9)
9. **The account:** through an external login (Google, Apple, Steam). (W2)
10. **A caught bot:** the account is held for review, the owner decides; the gains are wiped, not the character. (FOUNDATIONS F11)

Open after this page, for the owner: the pick in W7; whether the marked zone's fall gives the finds to the attacker (the combat frame); the rest of FOUNDATIONS section 11.
