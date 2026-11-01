# Solo, co-op and multi: what each means for Loomvale, what it costs, and where it fits (2026-10-31)

Status: a proposal for the owner. Nothing here is built, and every number marked "estimate" is an estimate by analogy, not a measurement. The owner's word of 28.10 asked which of SOLO, CO-OP and MULTI fits the world. This page answers from the decisions already made, so most of the answer is "this was already chosen, here is where the name fits". What is new is marked as new, and the questions only the owner can answer are at the end (at most five, each with a default).

## 1. The finding in one paragraph

Loomvale has **one world for everyone** (DECISIONS 2026-10-23, "The world's structure", answer 4), **each player's progress is their own** (2026-10-10, "The shared world"), and a **group** is already specified as friends who share a quest, never a carry (PROGRESSION.md 3.7, SETTLEMENT.md 3.7). So the three names are not three separate games. They are three **layers of one world**, switched on in the order the owner chose on 17.10 (accounts and a server, then players who see each other without chat, chat last):

| Name | In Loomvale's terms | Already decided or new |
|---|---|---|
| SOLO | One character alone with the world: the demo on a phone, and later an account on the server whose walk nobody else sees | Decided. The demo is stage 1; one player alone on a server is NEXT.md section 18 |
| CO-OP | A small group of friends inside the one world: they see each other, share a quest, share a pack rule, and a newcomer gets the mentor's help | Mostly decided in pieces (groups, party quests, mentor rule, closed signals). The name and the order are new |
| MULTI | Everyone in the world sees everyone: crowds in the town, the market, the marked zone for fights, later chat | Decided in pieces (presence, market, zone, chat last) |

The one thing this page recommends against, because it breaks a decision: **a private co-op world owned by a host** (Stardew Valley, Valheim, Don't Starve Together style). Loomvale's world is one valley that grows by pull request and is the moat (2026-10-26, "The moat"); a host's private copy would be the copy a fork starts with.

## 2. What the games of our size do

Each row is one fact, with its source. Sources are in section 8.

| Game | Players | Whose world | What is shared, what is each player's own |
|---|---|---|---|
| Stardew Valley | 4 on one farm (S1, S2) | A host's farm; others join through cabins (S2) | Money can be shared or separate, changeable later; each player keeps their own experience, crafting and recipes; quest difficulty follows the highest-level player (S2) |
| Valheim | up to 10 (S3) | A seeded world a host or dedicated server runs (S3) | Skills are the character's, to level 100, raised by use (S3, S10) |
| Core Keeper | up to 8, solo or co-op, hosted locally or on dedicated servers; cross-play since August 2025 (S4) | A hosted world | Skill trees that improve by use (S4) |
| Don't Starve Together | up to 6, public or private games, a separate product from the single-player game (S5) | A host's server | Characters and balance are tuned for multiplayer (S5) |
| Terraria | mobile local games up to 8; a host or a separate server (S6) | A host's world file, or a server that needs no player connected (S6) | PvP only when both players turn it on; boss loot goes to every player who hurt the boss (S6) |
| Animal Crossing: New Horizons | 4 local, 8 online (12 on Switch 2) (S7) | Your own island; visitors travel there by Dodo Airlines (S7) | Visitors can harvest and meet villagers on a vacant island (S7) |
| Old School RuneScape | many, one shared world with trade | Jagex's servers | Ironman accounts cannot trade with other players: a restricted way to play on the shared world (S8) |
| Albion Online | several servers (S9) | The studio's servers | A classless game where the gear defines abilities, a fully player-driven economy, full loot in the red and black zones (S9) |

Two patterns matter for us.

1. **The small games (Stardew, Valheim, Core Keeper, DST, Terraria) are all host-owned worlds of 4 to 10 players.** The host's machine or a rented server is the world. That is cheap and private, and it needs nothing from the studio.
2. **The large ones (RuneScape, Albion) are one world run by the studio, with solo as a choice inside it.** Old School RuneScape's Ironman is a precedent for a restricted way to play on a shared world rather than a separate product, though it only removes trade and hides nobody (S8).

Loomvale has already taken the second road, by the owner's word, so the first road's co-op does not carry over as it is.

## 3. What each mode asks of the kernel, the server and the rules

The rules below are in DECISIONS.md or the design pages; the paths say where.

| Concern | SOLO | CO-OP | MULTI |
|---|---|---|---|
| **Kernel.** Pure, integer, deterministic, replayed | The same kernel as the phone; `step`, `replay`, `serialize` (NEXT.md 18 a) | No new kernel idea: a group is a list of account ids the server holds, and the kernel reads it only for the quest chance and the share terms | The same; a fight is one simulation of the server's tick with players on both sides (COMBAT.md 4.5) |
| **Server.** What it holds | The only copy of the seed, the whole state, the action log (NEXT.md 18) | A group record, the closed signals, and each member's own quest steps (2026-10-10, "The shared world", its bullet "Friends and groups") | A presence relay in memory only, rooms by 64 by 64 chunk, the 3 by 3 chunks around a player as the area of interest (NEXT.md presence section, PRESENCE.md on branch docs/presence-wire) |
| **Time.** One clock or many | A valley keeps its own clock until players see each other | The world's hour for everyone from presence on; no window pauses it (2026-10-10, "One hour for all"; 2026-10-20, "The world's hour is the server's clock") | The same |
| **The pack rule and the fight tick** | A hazard is escaped, never fought (G34, G35) | One pack rule everywhere, first come (COMBAT.md Q2, 2026-10-23 "Combat, round 2"); a group shares the credit for a `defeat` (`credit_permille`, COMBAT.md 4.9) | The fight runs on the server's own tick over the live socket; any number may fight any number inside the marked zone (COMBAT.md 4.5) |
| **The quest grammar** | One player does every step; the tree starts every quest (2026-10-25, "Tree first, both ways") | A quest may name `party: { min, max }`; the chance falls with each missing member; each member who finishes a step gets its full reward once, never a split (SETTLEMENT.md 3.7; 2026-10-10 "Friends and groups") | The `hold` kind counts the side still standing in a place at each bell (COMBAT.md 4.5) |
| **Notes and chat** | None | The group talks in a closed set of signals: here, come, wait, help, found it, done (2026-10-10, "The shared world", its bullet "Friends and groups"); no free text | Notes first, bubbles over the head later, never private; chat is the last step of the order (2026-10-09, "Players' words"; 2026-10-17, "The order from here") |
| **The anti-bot rule** | A program may advise a player, never play for one (2026-10-09, "No bots") | A carry sold for gold is an exploit loop; the books see the pair, the pattern and the gold (PROGRESSION.md 3.7) | A caught bot is held for review, the gains wiped, never the character (2026-10-23, "The world's structure", answer 9) |

Where a mode needs something the owner has not decided, it is a question in section 7, not an assumption.

## 4. The comparison, on fixed rows

"Lines" is the size of the code, by analogy with GAP_WOW_RS.md section 4 (stage 2a, 8 to 12 thousand lines; stage 4, 7 to 10 thousand; stage 7, 5 to 8 thousand plus operations). All numbers in the "costs us" rows are estimates.

| Row | SOLO (a character alone on the server) | CO-OP (a group of friends in the one world) | MULTI (everyone sees everyone) |
|---|---|---|---|
| **What the player gets** | Progress that carries, a server that keeps the books, verified boards, nobody else on screen | Friends on screen, a shared quest, a mentor's bonus for the newcomer, closed signals | Crowds in the town, the market, the marked zone for fights, notes, later chat |
| **Costs us: code** | NEXT.md 18 as written, 8 to 12 thousand lines, mostly built | Estimate 2 to 4 thousand lines on top of presence: the group record, the invite, the party chance, the signals, the mentor terms (PROGRESSION.md 3.7) | Presence 5 to 8 thousand lines (stage 7's size, without chat) plus the market (stage 4, 7 to 10 thousand) plus combat (COMBAT.md section 4) |
| **Costs us: server load** | One state row per player; actions only | The same plus a group row; small | A relay with one socket per player and the fan-out of the interest area; the numbers to measure on the box are PRESENCE.md section 9 |
| **Costs us: moderation** | None past the sign-up rules | Names and a block list; no free text, so the ladder of warnings is rarely used | The full ladder: filter, reports, holds, two named people on the team from the first stage where words reach another player (2026-10-10, "The shared world") |
| **What it breaks in the decisions** | Nothing | A private host-owned world would break "one world for everyone". Groups inside the one world break nothing | The "empty world" answer is needed first: the valley's own people on routes, traces of others, the town as the funnel (2026-10-20, "The empty world") |
| **When in the order it fits** | Now: stage 3 of 17.10 | Right after presence, before chat (the owner's order has no co-op step; this is the new line) | Presence is stage 4 of 17.10; the market and the zone follow it; chat last |

## 5. What to build for CO-OP, if the owner says yes to the default

Everything below already has a decision behind it. The list is the work, in order.

1. **Presence first** (NEXT.md presence section): a figure per player, the world's one hour, no name over the head until the owner decides it.
2. **The friend and the group.** Friendship is mutual and a refusal is silent; a friend online shows their town; a group is invited from friends only (2026-10-10, "The shared world", its bullet "Friends and groups"). There is no list of who is online (2026-10-10 "The shared world").
3. **The closed signals.** Six words, seen by the group alone, beside the bubbles everyone sees. This is Journey's chime and Apex's pings, as the entry says.
4. **The party quest.** `party: { min, max }`, the chance falling with each missing member; nothing decays when nobody takes the quest (G28).
5. **Help, never a carry.** The share is moved from the others' own earnings, never made; the mentor's +20% is the one bonus; the same pair gets full help for an hour a day and half for the next (PROGRESSION.md 3.7).
6. **Visits.** Houses and plots are paused (2026-10-10), so there is nothing like Animal Crossing's island to visit yet. What a friend can visit now is the town and a friend's shop sign on the market board.

## 6. What stays out, on purpose

- **A host-owned private world.** Section 1 says why. If the owner wants it anyway, it is a new decision with its own price, because it reverses answer 4 of 23.10 (a split into copies only on a measurement), and it should be designed before it is promised.
- **A group's free text.** Chat is last; signals are enough for co-op.
- **Shared money.** Stardew's switch between a shared purse and separate ones (S2) does not fit: gold has one ledger, a daily cap and sinks (2026-10-09, "Gold entering a world"), and a gift between friends is a movement of gold with a reason `gift`, bounded (SETTLEMENT.md 3.9).
- **Difficulty that scales with the group's size.** Terraria's Expert and Master modes scale bosses with the player count (S6). Loomvale's difficulty is the one internal scale of the area, which no player count changes (SETTLEMENT.md 3.6); a group makes a place easier because there are more hands, which is the point of a group.

## 7. Recommendation and the owner's questions

**Recommendation.** Keep the order of 17.10. SOLO on the server now. Then presence (MULTI's first half). Then **co-op as a named next step**: friends, a group, closed signals, the party quest and the mentor, all inside the one world. Then the market and the marked zone. Chat last. The name CO-OP goes on the group layer, so the player and the website can say "play with friends" when presence ships, without a second kind of world.

The questions only the owner can answer:

1. **A private co-op world.** Do you want a world a group owns, in the way of Stardew or Valheim? **Default: no.** Co-op is a group inside the one world.
2. **A "solo" setting on the shared world.** May a player turn off seeing others and being seen, as Old School RuneScape's Ironman turns off trade (S8; it hides nobody, so the closer precedent is our own block rule)? **Default: yes, later,** after presence, as a setting; the block already hides one player, this hides all. It costs little and keeps the quiet game open to those who want it.
3. **Group size.** How many in a group? **Default: 4,** Stardew's size (S2); a quest's `party.max` may be lower.
4. **Where co-op sits in the order.** Should the group layer (friends, signals, party quests) ship before chat, as the first thing after presence? **Default: yes.**
5. **Visits while houses are paused.** Is a friend's town and shop sign enough for now? **Default: yes;** houses return when the owner un-pauses them, and a visit becomes Animal Crossing's island then (S7).

## 8. Sources

Outside games (read on 31.10.2026):

- S1: Stardew Valley, Wikipedia: multiplayer added in a later update, skills in farming, foraging, fishing, mining and combat. https://en.wikipedia.org/wiki/Stardew_Valley
- S2: Stardew Valley co-op guide, Pocket Tactics: four players on a farm, money shared or separate and changeable later, each player's own experience, crafting and recipes, quest difficulty from the highest-level player, a cabin for each player. https://www.pockettactics.com/stardew-valley/coop
- S3: Valheim, Wikipedia: co-operative play with up to ten people and optional PvP, skills to level 100. https://en.wikipedia.org/wiki/Valheim
- S4: Core Keeper, Wikipedia: solo or co-op with up to eight players, hosted locally or on dedicated servers, cross-play from August 2025, skill trees that improve with use. https://en.wikipedia.org/wiki/Core_Keeper
- S5: Don't Starve Together, Wikipedia: up to six players, public or private games, a separate game from Don't Starve. https://en.wikipedia.org/wiki/Don%27t_Starve_Together
- S6: Terraria wiki, Multiplayer: host and play versus a separate server, PvP by choice, teams, boss scaling in Expert and Master. https://terraria.wiki.gg/wiki/Multiplayer
- S7: Animal Crossing: New Horizons, Wikipedia: four local and eight online players, twelve on Switch 2, visits through Dodo Airlines. https://en.wikipedia.org/wiki/Animal_Crossing:_New_Horizons
- S8: Old School RuneScape, Wikipedia: Ironman accounts cannot trade with other players, Deadman Mode as a separate PvP server. https://en.wikipedia.org/wiki/Old_School_RuneScape
- S9: Albion Online, Wikipedia: classless, gear defines abilities, player-driven economy, full loot in red and black zones, several servers. https://en.wikipedia.org/wiki/Albion_Online
- S10: Valheim skills level up by use to 100 (second source, with Wikipedia): Prima Games, list of all skills, read as quoted in a search result (the page itself was not opened). https://primagames.com/tips/valheim-list-all-skills

Ours: DECISIONS.md entries cited by date and title above; [GAP_WOW_RS.md](GAP_WOW_RS.md) section 4; [SETTLEMENT.md](SETTLEMENT.md) sections 3.7, 3.9 and 5; [COMBAT.md](COMBAT.md) sections 4.3 to 4.6 and 4.9; [PROGRESSION.md](PROGRESSION.md) section 3.7; [EMPTY_WORLD.md](EMPTY_WORLD.md); [GAME_RULES.md](GAME_RULES.md) G28, G34, G35; NEXT.md sections 18 and the presence section (open docs pull request, branch `docs/next-presence-section`); PRESENCE.md on the branch `docs/presence-wire`, closed unmerged.
