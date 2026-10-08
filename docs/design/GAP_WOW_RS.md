# Mistvale against World of Warcraft and RuneScape: the play gaps, the distance to multiplayer, the developer surface

Written 2026-10-08 for the owner, who asked three things: do the demo and the
concept carry the clear experiences those games carry (talking to a character,
a quest, a dungeon), and if not, what exactly is missing; how far a multiplayer
version is; and where the external developer surface and its site stand.
Facts about Mistvale are read from `develop` on 8.10; facts about the two
games are their public design as players know it. Sizes are by code complexity
(the spec's own measure, lines of code) and by hardware, never by hours.

## 1. The three games in one line each

- **World of Warcraft.** A persistent 3D world shared by everyone on a realm.
  Combat and gear are the engine; quests deliver story and progression in
  hubs; dungeons and raids are instanced group challenges with roles; classes
  and talents define a character.
- **RuneScape (Old School).** One persistent world shared by everyone. Skills
  with experience are the engine (23 of them, no classes); quests are
  hand-written adventures with puzzles, humour and their own dialogue, gated by
  skill levels; bosses, minigames and clue scrolls on top; a player economy.
- **Mistvale, the demo of 8.10.** A single-player browser valley of about ten
  minutes: gathering, digging and cooking with timing minigames; mending (the
  bridge, the fire); two characters with lines by standing and three topics
  each; six quests, all bring or visit; a journal; a kernel that prices every
  action by player time; saves in the browser; everything new arrives as data
  files through a community loop. The loop is the product; the valley is its
  first content.

What exists in code and content today: 12.7 thousand lines of TypeScript
(kernel 2.0k, client 5.5k, tools 4.1k, schema 1.1k; the spec's band for stage
1 is 10 to 15k), a 48x36 map with 18 slots and 36 props, 6 quests, 2
characters, 3 professions, 5 resources, 4 recipes, 3 camps, 2 dig sites, 1
restore, 1 shop, 2 starters.

## 2. The experiences, one by one

| Experience | World of Warcraft | RuneScape | Mistvale today | The gap | Where it sits in our plan |
|---|---|---|---|---|---|
| Talking to a character | Quest text and gossip options; accept or decline; the character is a dispenser. | Branching dialogue with choices, humour and personality; the talk is the quest. | Lines by standing (stranger to family), three topics per character, one box at a time; no answer of the player's own. Two characters. | Talk is read-only: the player picks a topic, never a stance. Two voices. Nothing a character says depends on what the player did except the standing. | Direction: yes. G19-G23 and the four voice sheets (approved 8.10). Answers with three stances come with P-2 ("the player pulls"); the lines with P-3; "a new line from a character on day 2" is a rung of the ladder. |
| A quest | Hubs of five to ten; kill, collect, escort, use; chains that carry a zone's story; rewards in gear, experience, reputation. | About 150, each unique: a story with puzzles, gated by skills, a journal with hints, quest points that unlock. | Six, all "bring N" or "visit"; one chain by `requires`; rewards in gold and reputation. The rules page calls this the breach. | No `find` or `riddle` step, no quest type, no answer choices, no hint in the journal, no gate by skill level, no reward that changes play. In RuneScape's terms: six fetches, no adventure. | Direction: yes, and written in detail. Pillar 3, G1-G18, the palette of twelve types (investigation, discovery, fetch with a twist, dilemma, skill, collection, tending, riddle, mastery, gamble, persuasion, errand). None of the twelve exists in content. P-2 is the schema, P-3 the content; both are open. |
| A dungeon | Instanced, five players, roles, bosses with mechanics, loot; the clearest "I am doing a thing" mode in the game. | Bosses, slayer, minigames, raids; dangerous places with a reason to go. | None. The ruins are the only "dangerous" place: dig sites, statues, bells at night, a mist that thickens after dark (the client already computes night and darkens the valley). Nothing happens there that cannot happen at noon. | No place with a structure: enter, a chain of problems, a climax, a reward that opens something, a way to fail softly. No clock inside a place. No danger of any kind. | Direction: no. Not in the rules, not in the spec's roadmap. The ingredients are in the palette (discovery at the arch at night, riddle on the ruin stones, gamble at a dig, tending the fire through a night); the container is not. Section 3 proposes it. |
| Combat | The core verb. | A core verb. | None, by decision: hunting without combat is the candidate for the first vote; combat is stage 8 and arrives as community code if at all. | Deliberate. Danger and mastery under pressure must come from timing windows, night and the mist, not from fighting. | Direction: decided. The expedition of section 3 is how the valley gets "a dangerous place" without a sword. |
| A character growing | Levels, class, talents, gear score. | Skills to 99, total level, no classes; the model Mistvale chose. | Professions with levels and skill points (three today), the camp (three builds), reputation standings, the collection in the journal. | Each profession is one minigame deep; no skill tree yet; the camp has no slots; one restore in the world. | Direction: yes. Stage 3 of the spec (camp slots, tree trunks and branches, a third starter, effort tiers). The loop adds professions as data files. |
| The world | Zones, flight paths, mounts; a world to cross. | One map, areas unlocked by quests, teleports. | One map, three areas (river, town, ruins), places that open when mended; 18 slots for the community to fill. | Small, as a demo should be. The opening mechanism (a slot is a ruin until someone restores it) is the right one and is unique to this game. | Direction: yes; the slots are the mechanism, the loop fills them. |
| Trade and economy | Auction house, professions, gold sinks. | Grand Exchange, player shops; a famous history of exploits. | Pell's stall at fixed prices; a kernel that caps what a second of play can earn (the review of 6.10 found and fixed the three leaks). | Trade between players is stage 4; a gold ledger on the server is stage 2a. On paper the foundation is stronger than RuneScape's was. | Direction: yes; the order (server, then market) is written. |
| Other players | Guilds, parties, chat, battlegrounds, a shared world. | One world, chat, trading, clans. | Nobody. Single-player in the browser; progress does not carry to an account, and the screen says so. | Everything. Section 4. | Staged by design: 2a accounts, 4 light presence, 7 live presence and chat. |
| Story | Cinematics and zone narratives on top of quests. | The quests are the lore. | Three arcs named (the mist, the bells, the statues) and carried by topics and inscriptions; the frame "a town is not gone while someone mends it". | The arcs are names, not written: seven inscriptions change nothing, four are cut until an arc names them. | Direction: yes; P-3 writes the first arc (the ruin stones); the loop writes the rest. |
| The session and the return | Dailies, weekly resets, events. | Daily tasks, long skill goals. | A day summary and a morning change are in the ladder; seasons are the long horizon. | P-4 is open; nothing marks the day yet. | Direction: yes, P-4. |

The short answer to the owner's first question: talk and quests have the
direction, written down to the rule and the type, and almost no content yet
(six fetches, two voices); dungeons have neither the direction nor the content.
A player of either reference game can name what they are doing at every
minute ("a quest", "a dungeon", "training fishing"). A Mistvale player today
can name "mending the town" and "gathering"; nothing else has a name yet.

## 3. What a Mistvale dungeon is, if the owner wants one

Not a cave with monsters. The valley has no combat and pillar 5 says effort is
never wasted, so the form is an **expedition**: a place entered under a clock,
a chain of three to five problems of different types inside it, a climax, a
reward that opens something, and a soft failure.

The first one writes itself from what exists: **the night ruins.** The bells
are the clock (they ring at a set hour; the client already knows the hour and
thickens the mist after dark); the player enters past the broken arch after
dusk; inside, a discovery (the arch opens a place only at night), a riddle (the
three stones name the order), a gamble (the dig under the hill-facing statue),
a tending beat (keep the lantern lit); the climax is the last bell; what the
player carries out stays, what was not found waits for the next night; the
reward is a place that opens by day (the elder's house, the hall). Rules it
keeps: G17 (no two of a type in a row), G28 (no punishment for absence; the
night comes back), pillar 5 (a miss keeps something).

What it needs, in order, after P-2: a container in the schema (a quest chain
with a `window` of the day and a `place` it must be played in, and the soft
failure as the default) - small; the client's clock as a rule, not a mood (a
window that closes, the mist that pushes the player out) - medium; the content
of the first expedition in P-3's style - medium. Hardware: none; it is
single-player. The owner's word is needed on one question: is the expedition
the valley's dungeon form (recommended yes, with the night ruins as the first,
after P-2 and P-3), or are dungeons not this game?

## 4. How far a multiplayer version is

"Multiplayer" means three different things, and the spec stages them on
purpose (section 16; the owner's decision of 6.10 moved the server to right
after the demo):

| Stage | What a player gets | What it needs | Spec size (lines) | Hardware | Built today |
|---|---|---|---|---|---|
| 2a. Accounts and a server | Progress that carries; gold and inventory the server decides; verified boards (wealth, collection, levels); the luck rolls on the server. Every player still in their own valley. | A server that replays the player's actions through the same kernel step and keeps only what comes out; sign-in; a database; a gold ledger; a simulated player in CI; backups and monitoring. | 8 to 12 thousand | The first paid machine: a server with a database | Nothing of the server. The two assets exist: the kernel is one pure function (state, action, clock in; state out) with a canonical random stream, which is what makes "replay on the server" possible at all; and the stage-1 service (M5, yes on 8.10) is the first server-side code, on Vercel Functions with Upstash. |
| 4. Light presence and the market | Others' camps, footprints and notes in your valley; shared prices that move with stock; a sales board; personal shops; houses; creator pay in gold. No live sync. | 2a, plus one shared world state and trade on verified property. | 7 to 10 thousand | The same server | Nothing. |
| 7. Live presence and chat | Players see each other move; chat; moderation. The thing most people mean by "multi". | A real-time server (websockets), position sync, a connection per player, moderation tools, someone who has built live sync before. | 5 to 8 thousand, plus operations | A real-time server and monitoring | Nothing. |

In plain words: a shared live world of the World of Warcraft or RuneScape kind
is stages 2a, 4 and 7, roughly twice to two and a half times the code that
exists today by the spec's own estimate, plus the first paid hardware at 2a
and a second kind of server at 7. Nothing of it is built. What shortens the
road: the kernel was designed for it from the first line, and the 8.10 yes to
the stage-1 service puts the first server code on the path that 2a can grow on.

One recommendation that departs from the spec's text: the spec says 2a needs a
dedicated server with its own database (section 15). The 8.10 decision runs
the stage-1 service as functions on the static site's host with a managed
store. The same shape (functions plus a managed database such as Postgres on
Neon or Supabase, or Turso) covers 2a with no machine to operate, and the
dedicated server can wait for stage 7, which is the first stage that needs a
live connection per player. Decide it when 2a is designed, with the stage-1
service's numbers in hand.

## 5. The external developer surface and its site

The developer surface is the hub and the MCP server; the site is the `web/`
package around the game. All of it is written as mechanical work in
`docs/team/GRUNT.md`, and the four answers of 8.10 unblocked it:

| Block | Items | What a developer or creator gets | Size | Waits for |
|---|---|---|---|---|
| M1 data | 1 (done), 2 (in progress), 3 | The board without hours; the token sheet in the game; the one hub-data document | S | Nothing |
| M2 the site | 4 to 9 | One Astro build with the game at `/play/`, a home page, a way back from the game, the hub shell, an API folder with `llms.txt`, CI that runs the expensive steps only when their paths changed | M | Nothing since 8.10 (Astro: yes) |
| M3 hub pages | 10 to 14 | The loop page, the boards, the rules page (P-1's public page), the docs pages, an hourly refresh | M | M1 and M2 |
| M4 the MCP server | 15, 16 | A server any agent runs from a clone or over npx, answering `rules`, `check` and the other seven tools, with registration and the snippet | M | M1; npx needs the public repository (yes on 8.10, with the checklist) |
| M5 the stage-1 service | 17 to 19 | Visits, pickups, stops and reports per extension; the creator's data page | L | M3 |

Nothing in this table waits on a decision any more. The one thing that touches
all of it is the name: the save key, the package names and the site URL carry
it, and the vote should close before the first public link (DECISIONS.md 8.10,
the shortlist).

## 6. The order this page recommends

1. P-2 (the `find` and `riddle` steps, `quest.type`, ids on props): the
   schema that every row of section 2 waits on.
2. P-3 with the approved voice sheets: the six quests rewritten across the
   palette, Maru in three boxes, the ruin-stones riddle, the first arc. This is
   where "a quest" and "talking to a character" become real experiences.
3. The owner's word on the expedition (section 3); if yes, its schema rides
   the first pull request after P-2 and its content follows P-3.
4. M2 and M3 in parallel with the content work, in their own worktrees: the
   site and the hub are independent of the valley's content.
5. M4 after the repository goes public; M5 after M3.
6. The design of 2a only when the stage-1 service is live and has numbers;
   the choice between functions with a managed database and a dedicated
   server is made then (section 4).
