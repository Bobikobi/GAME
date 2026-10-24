# Presence: players seen in one world

Status: the design page for the presence step, players seen moving in one world without words, written 19.10.2026 on top of the single-player wire of [NEXT.md](../team/NEXT.md) section 18 and the first ring of section 19. Nothing here is built. Section 0 is the one question for the owner, the clock; the rest is the builder's proposal, which the owner has not yet seen, in the shape of the frames he has answered before (DECISIONS 2026-10-19, the combat entry). Every rule already decided is cited where it binds; this page adds no rule to those, only the shape that carries them.

Read with it: NEXT 18 (the wire: `POST /action`, `POST /moves`, the time proof, the pause on a dropped line), NEXT 19 d (chunk streaming), [DECISIONS.md](../../DECISIONS.md) 2026-10-10 "The shared world" (one hour for all, blocks, friends, nobody blocks a way), "The world and its clocks" (three clocks), "The game read as one line" (every time names its clock, the world seen at stage 7), 2026-10-18 "Accounts and a server: the owner's answers", 2026-10-19 "G35 is the demo's rule", [kernel-review-v1.md](../kernel-review-v1.md) (6e, R4, S1, K10), [REACTIONS.md](REACTIONS.md) section 10, [SETTLEMENT.md](SETTLEMENT.md) 3.9, GRUNT CR-47, CR-73, CR-74 and CR-93, and the stones F3, F16, F18, F21, F33, F34 and W1, W11, W12 of the foundation pages (FOUNDATIONS.md and WORLD_STRUCTURE.md, pull request #219, once it lands).

## 0. The clock when players see each other (the owner's question)

What is decided already:
- One hour for all from the presence step: "from stage 7, where players see each other, a world has one hour for everyone that no window pauses, and a player's own nodes and camp fire count that hour too" (10.10). Until then every valley keeps its own hour.
- Every time names its clock (10.10, CR-93): the game hour, the server's hour, the real calendar, real seconds while connected, active play.
- What runs while a player is away, the default of Q8 (FOUNDATIONS section 11): nothing at the camp or the fire; a fire found out on return costs nothing but the kept night if the vigil was on.
- The 2D world keeps the wall clock, capped at 250 ms a frame (18.10); the clock stops while a window is open until the presence step (7.10, superseded in part on 10.10).

What the code does today: `state.tick` is game milliseconds, one tick per real millisecond while the client runs; `day_length_ms` is 1,200,000, a day of 20 real minutes and an hour of 50 seconds; tick 0 is noon, so the first dusk falls in the first session; every reading of the hour (`hourOf`, `isNight`, `lastDusk`, `nightEnds`, `nightFalls`, `minuteOfDay` in `kernel/src/state.ts`) derives from the tick; a fire burns to a tick (`until`), hunger drains from `satietyAt` to the tick, work ends at `busyUntil`, a hunt paces by ticks, and the server of NEXT 18 a accepts the client's claimed tick advance under the time proof. So two players who meet carry two ticks with two phases: one's night is the other's noon, and a fire's dawn is a different instant in each state. The presence step cannot draw both of them at one fire.

The question: whose clock is the hour, from the presence step on? Three options; the first is recommended.

**A. The world's hour is the server's clock, and a player's clock joins it when they join the world (recommended).**
- One origin per world (`world.epoch`, a real instant stored with the world, set so that tick 0 was a noon). The world tick is the server's wall clock minus the origin, one tick per real millisecond, a day of `day_length_ms` as today, never paused by a window, a minigame or an absence. Every player's `state.tick` is set by the server to the world tick at every accepted action; the client's claimed tick is no longer an input. The hour-reading functions do not change, because the tick's phase is the world's.
- A return after an absence is one kernel action, `resume`, run by the server before the first action of a new session: it moves the player's tick to the world tick and shifts by the span away everything that counts the player's own elapsed time (a fire's `lit` and `until`, `satietyAt`, `busyUntil`, `movedAt`, own nodes' regrowth), so nothing ran while away (Q8). The vigil is the one exception Q8 names: `tendHolds` reads the world's last dusk and dawn, and a fire whose `lit` moved past that dusk did not keep that night. A player away through a night finds the fire as it was left and the night unkept.
- Leaving: outside a safe place the player stays `logout_countdown_s` real seconds (10.10), visible to others; the server then runs `leave`, which pays a hunt its bites for the countdown and ends it, walks the player out of an expedition place at its exit as the last bell would (G49: a walk-out takes nothing back), and marks the player away. In a safe place `leave` runs at once. The next `resume` lands where `leave` left the player.
- The opening keeps its own clock. It is the demo, played on the phone, tick 0 at the start, the first dusk in the first session (recut B), and the handover of NEXT 18 d replays it as it was played. Between the account and the presence step the player's clock stays their own under the time proof, as NEXT 18 a builds it; the seam is the first join of the shared world, in a town, by one `resume`. A builder may take the world clock already at NEXT 18 c (one seam fewer); this page holds either way.
- What it costs and gives: the time proof becomes free, since the server owns the tick and no hour can be claimed; a window no longer pauses anything for an account (10.10 decided it); a player who joins at the world's night arrives in a town at night, lanterns lit, nothing hunting at level 0 (the game read as one line); the long night's vigil waits for the world's dusk, as it waits for the valley's today; the day's length is one number for the whole world (20 minutes today, Minecraft's day), changed only for everyone at once.
- Like Minecraft's server, where the day runs on the server's tick for every player, and like Old School RuneScape, where the server's tick is the only clock.

**B. Each player keeps their own hour; presence shows the figures and nothing of their time.**
- The cheapest wire: others' positions arrive, and each client draws them under its own sky. Rejected by 10.10 (one hour for all) and by the world itself: two players by one fire would stand in different nights, the hazards and the mist would differ under one tile, and a tree on one chop timer or a wildfire fought together (19.10) need one clock. Kept here only to say why not.

**C. A game day is a real day: the world's night when it is night at the server.**
- Animal Crossing's clock. Rejected because the first dusk in the first session is the opening's hook, the vigil and the night ruins would be out of reach for anyone who plays at one fixed hour of the day, and nothing in the content is written for a 24-hour day. A longer day than 20 minutes is a parameter (`day_length_ms`, at most 40 minutes today), not this option.

The owner's word on A, B or C is the only thing this page waits for. With A, the lines above go into NEXT 18 a and c and into build b of section 7 as written.

## 1. What presence is, and is not

Presence is the first stage where one player's screen shows another player (W11, F33): the figure walking, standing, working, fallen or resting, the name over its head and the look it wears, and its fire's light at night; a crowd beyond a handful drawn faint (F34). It is the live part of "others in the world"; the stored part (another's camp, footprints, notes) comes with stage 4 and is state the server already holds. It is not chat (last, with its filter and ladder), not the trade window (stage 4's rule, F36), not a group's signals (CR-74, with friends), not combat (its frame first, 19.10), and not a list of who is online (there is none, 10.10).

## 2. The model in one paragraph

The server of NEXT 18 keeps holding every player's state and deciding every action. Presence adds a **relay**: a second process on the same box that keeps, in memory only, the last position and pose of every connected player, and sends each player the positions of the players near them, a few times a second. The relay owns no game state and decides nothing that lasts: it checks a position report for what a walk can do (the kernel's own reach rule), drops what a walk cannot do, fans out the rest, and hands the reports to the server in batches, where the kernel's check (G56's search) stays the judge. A relay that dies loses nothing but the figures on screen; play goes on through the server.

Why a relay and not the server's own socket: the server's work is per action and durable; the relay's is per frame and forgettable. Keeping them apart keeps the kernel pure and the database out of the hot loop, lets the relay restart at any time with no loss, and leaves one place to measure when the box runs short (W1: copies of the world only on a measurement, the owner's decision). The kernel review's 6e holds: no lockstep, no client holds the world; a client holds its own state and a dozen figures.

## 3. The wire

### 3.1 The connection
- One socket per account, to `/live` (a WebSocket upgrade route in the same nginx site as the API). A second socket for the same account closes the first: one person, one place in the world.
- The client opens it with a relay token from `POST /session/live` on the API: short-lived (`presence.token_s`), signed by the API with a secret the relay shares, carrying the account, the world and a presence id for this session. The relay checks the signature and needs no database.
- The relay tells the API when an account connects and disconnects (the internal channel, 3.4); the API runs the countdown of section 0 from the disconnect.
- A lost socket reconnects with backoff; while it is down the client shows the others as gone and keeps playing through the API. Presence may fail; play never waits on it. Actions keep waiting for the API's reply, as NEXT 18 a decided; that pause is the server's, not the relay's.

### 3.2 Reports and rooms
- The client reports every tile it enters, as it reports to its own kernel today (P-5b), over the socket: `{ k: 'pos', at: [x, y], face, pose }`, with `pose` one of `idle | walk | work | fall | rest`. No tick travels: the relay stamps each report with the box's clock, and the box's clock is the world's (section 0, A).
- The relay keeps a room per world chunk (NEXT 19: 64 by 64 tiles). A player is in the room of their tile and subscribed to the 3 by 3 chunks around it, the same nine the client streams (19 d), so the interest area and the streamed ground are one thing. Crossing a chunk edge moves the subscription: the client learns of the players in the new column of chunks and forgets the old one.
- A report fans out to the subscribers of its chunk at most `presence.rate_hz` times a second per player; between frames the latest report wins. Others move on the client between reports by the walk rules the player's own figure uses (`game/src/walking.ts` once free movement lands), so a figure never jumps unless the relay says `snap`.
- The handful (F34): a client receives full updates for at most `presence.near` players, the nearest by tile; beyond them it receives a count and, once a second, the tiles of at most `presence.faint` more, drawn faint and nameless. Past that, nothing: a crowd never hides the world.

### 3.3 The live check and the batch check
- Live, at the relay, per report: the kernel's reach rule, `2 + floor(elapsed / walk_step_ms)` tiles of Chebyshev distance from the last accepted report, with `elapsed` on the relay's clock and the cap `move_reach_max` (G56). The rule becomes one exported function of the kernel, `moveReach(bundle, elapsedMs)` in `kernel/src/step.ts`, read by `moveTo` and by the relay alike (the refactor of build a), so the relay and the kernel never disagree on it. A report beyond reach is not fanned out; the relay answers `{ k: 'snap', at }` with the last accepted tile and the client snaps its figure there (the snap-back G56 already asks for).
- Batched, at the API: the relay forwards each player's accepted reports to `POST /moves` every `presence.batch_s` seconds and at once before any action of that player, under the relay's internal credential; the kernel runs G56's breadth-first search on the batch, and a refused batch rolls the player back to the kernel's tile and tells the relay, which snaps the client and the room. Once the relay exists, `POST /moves` from a client is refused for an account the relay reports as connected; the public path stays for the stage before the relay and for a relay that is down.
- After every accepted action the API tells the relay where the kernel put the player (an action names its tile; a fall wakes elsewhere; the last bell walks out), so the relay's picture is the kernel's within one reply.

### 3.4 The internal channel
Two HTTP routes on the box's private network, each under a shared secret, never through nginx: relay to API (`connect`, `disconnect`, `moves` batches) and API to relay (`placed` after an action, `blocks` when a block list changes, `revoke` when an account is held or closed). Nothing else: the relay never reads the database and the API never holds a socket.

## 4. What is sent about a player, and what is never sent

- Sent to the players in the interest area, and only while both are in it: the presence id of this session (not the account id), the name (the filter-read name, unique in the world, 10.10), the starter's sprite and look index, the worn looks (what the body shows, G44: looks, never effects), the tile, the facing, the pose, and whether the player's own fire burns (its light, as the world draws it).
- Never sent: the account id, the email, the country, the age band, the level or any number, the gold, the bag, the quests, the health, the last-seen time, the client's address. The screen shows no number about a player (F29), so none is carried.
- A blocked pair (10.10): each receives the other as a faint, nameless entry with no look, both ways; the relay strips it at fan-out from the block list the API gives it at connect and on every change. A block also refuses the pair's friendship and invites (the API).
- A mute (Q4's default: from the first presence stage, before chat exists): hides the muted player's notes and, when they come, bubbles and signals, on the muter's screen; the figure stays. Mute and block hold until the player undoes them, from the player card alone.
- The player card: tapping a figure opens one small card with the name, "add friend", "mute", "block" and "report", nothing more; no profile, no stats, no last seen. A friend request refused is silent (10.10).
- A report (Q4's default): one queue the owner reads; a report carries the reporter, the reported, the tile, the world time, the reason from a short list, and the reported player's last notes and lines near the reporter (what the reporter could see), nothing of anyone else. Three reports hold an account's words, never its play, until a person reads them (the ladder, 10.10); a reporter often overruled loses the power to hold by report.
- Who is online: nobody is told, except mutual friends, who see each other's town through the API (10.10). The relay has no route that lists players; a test of build a asserts its route table.
- Retention: the relay stores nothing; a position exists in its memory while the socket is open. The server's action log keeps the move batches with the actions (90 days, then daily totals, 10.10). A report keeps what it carried until it is read and for `hold_max_days` after.

## 5. The threat model

| What a client could try | What stops it | Where |
|---|---|---|
| Teleport: a far tile in one report | the live reach rule, then G56's search on the batch | relay, kernel |
| Speed: more tiles than a walk makes | `elapsed` is the relay's clock, never the client's; the time proof of NEXT 18 a for the stage before the relay | relay, API |
| A false figure: show one place, act in another | moves have one door, the relay, while it is up; an action's tile is searched from the last accepted report; the server's picture is what others see | relay, kernel |
| A forged identity | the token is signed, bound to the account, the world and the session, and expires in `presence.token_s`; one socket per account | API, relay |
| Finding who is online, following a person | no list route; a client learns only of the players in reach of its own feet; presence ids change every session; a block makes the pair faint and nameless both ways; a report | relay, API |
| Flooding | a per-socket cap of `presence.rate_hz` with a small burst; over it the socket is dropped and the reconnect waits; fan-out cost is bounded by `presence.near` times the room | relay |
| A bot reading the feed | the feed holds what the screen shows, and nothing a bot could take from a player, since what one player does never takes from another (F15); a program that plays is caught by its signs (A1, 9.10) | - |
| The relay down or restarted | nothing is lost; the client plays through the API and shows nobody until it reconnects; the box restarts the container under its cap | ops |
| Words through the name | the filter reads the name at sign-up (10.10); the relay sends the name the API gave it, never a string from the client | API |

Accepted while nothing is taken from a player: the false-figure line has a gap when a client keeps the relay away from itself and reports through the public path; the harm is a wrong figure on others' screens and nothing more. When fights between players come (W8's marked zone), an action inside the zone is refused unless the player's moves came through the relay; the zone's frame says so.

## 6. Room for combat and chat

- The batch of NEXT 18 a already carries a `kind` per entry, `move` the only kind at that stage. Presence adds no kind. Reserved: `encounter` (a client-played fight at a fixed kernel tick, sent as one batch, the proposal of NEXT 18 a that the owner has not yet seen; against the world's creatures only) and `say` (a line of chat: the API reads it through the filter and the ladder, the relay fans it out to the interest area as a bubble for a few seconds and keeps nothing beyond the report window).
- The socket's frame kinds reserved: `bubble` (chat), `signal` (a group's closed set: here, come, wait, help, found it, done; CR-74) and `fx` (a swing, a fall, a fire lit; the pose carries the first two already).
- A fight between players (W8's zone) cannot be judged by a relay that holds no state, nor by a batch replayed after the fact: it needs a server-side encounter run at a tick. That is the combat frame's to design (F17, Q10), not this page's; the only promise here is that the wire's shape (one socket, rooms per chunk, a kind per batch entry and per frame) does not stand in its way.

## 7. The builds, each one pull request

Rules as NEXT 18: branch off `origin/develop` into `develop`, never stacked; a shared-file change first and small; every server step a production gate with three lines to the owner; `pnpm verify` green before the push. The stream is `presence` in `streams.json`, added when the first build starts (PARALLEL.md: a small docs pull request, the owner column `null` until he names a session). After NEXT 18 a to e and NEXT 19 d have merged, and after the owner's word on section 0.

a) **The relay** (`feat/presence-relay`). A new pnpm package `relay/` (Node, TypeScript, the same toolchain, no database): the socket route, the token check, rooms per chunk and the 3 by 3 subscription, fan-out at `presence.rate_hz` with the handful cap, the live reach check through the kernel's exported `moveReach` (the refactor of `moveTo` in the same pull request, with a test that both read one function), the per-socket cap, blocked pairs stripped, batches to the API, the internal channel's relay side. Tests with a fake API and fake clients: two clients in one ring see each other within one frame and a third beyond the ring never does; a far report snaps; the player past `presence.near` is faint; a blocked pair is nameless both ways; a flood drops the socket; the route table holds exactly `/live` and the internal routes.
b) **The server side** (`feat/presence-api`). The relay token route, the internal channel's API side, `connect` and `disconnect` with the countdown and the kernel actions `leave` and `resume` of section 0 (option A), `world.epoch` on the world row and the tick stamped by the server, the blocks, mutes and reports tables with the one queue and its reading route for the owner, the player card's data route (name and look only), and the `POST /moves` refusal for a connected account. Tests: the forged table of NEXT 18 a extended (another account's token, an expired token, a report flood); `resume` after a night keeps the fire and the hunger as left and the vigil unkept; a claimed tick is not an input any more; the queue holds words and never play.
c) **The client** (`feat/presence-client`). Others drawn: the figure with the name over its head, the facing and the pose, the worn looks, the faint crowd, the blocked faint and nameless, the fade at the edge of the interest area; movement between reports on the walk rules; the player card; the reconnect; the snap; the 3D door reads the same feed (one `Presence` interface beside `RemoteSession`). Tests: a state test with a recorded feed; `game/e2e/presence.ts` with two pages on one fake relay: the second figure appears within 300 ms of the first's report, and 12 figures on screen keep the frame budget of F31 (measured, the number in the pull request).
d) **Ops and the moderation runbook** (`feat/presence-ops`, docs and gates). `docs/ops/GAME_SERVER.md` gains gates 7 and 8: the relay container with its memory cap and restart rule, the nginx upgrade route, the shared secret, a load test of 200 fake clients from the builder's machine measuring fan-out latency and the box's CPU, the numbers written into section 9 here; and the moderation runbook for the owner (reading the queue, the ladder's three rungs as commands, the appeal to another person, 10.10). Nothing runs on the box without his yes.

## 8. Parameters (every time names its clock, CR-93)

| Parameter | Value to start | Clock | What it does |
|---|---|---|---|
| `presence.rate_hz` | 5 | real seconds while connected | reports fanned out per player per second |
| `presence.near` | 12 | - | players drawn in full |
| `presence.faint` | 40 | - | players drawn faint beyond the near ones |
| `presence.batch_s` | 2 | real seconds while connected | how often the relay hands a player's moves to the server |
| `presence.token_s` | 600 | real seconds | a relay token's life |
| `logout_countdown_s` | 20 | real seconds while connected | the stay outside a safe place after the socket closes (10.10) |
| `move_reach_max` | G56's | game ticks | the cap on one report's reach |
| `day_length_ms` | 1,200,000 | the world's hour (the server's clock under option A) | the day for everyone |

## 9. Numbers to measure before the step ships

- Fan-out latency on the box with 200 fake clients in one chunk: under 150 ms at the 95th percentile.
- The relay's memory with 1,000 sockets: under 200 MB, and its container cap set from it.
- The box's CPU with 200 clients at `presence.rate_hz`: the share written down, and the point at which W1's question of copies would be asked.
- The client's frame time with 12 near and 40 faint figures on a two-year-old mid phone (F31's budget).

## 10. What is not done here

Chat and its filter on the wire (the kinds are reserved; the building is the last stage); the trade window; a group's signals and friends' presence (with friends, stage 4); combat of any kind; the figures of the game's own players (CR-100, the empty-world question, its own page); copies of the world (W1, on a measurement); a voice channel (none, F35).
