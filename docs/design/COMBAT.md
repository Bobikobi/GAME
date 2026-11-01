# The combat frame: what a fight is made of, where it stands, and what a fall costs (2026-10-20)

**Status:** Frame answered 20.10 (the five "Combat, round n" entries in DECISIONS, carried from #243); numbers revised 29.10 in one table (section 4.9); the owner's answers entered GAME_RULES the same day as G78, G81, G83, G84 and G86.

A decision page, answered. G35 says combat comes after the foundation as a core part of the game, and that "where it is fought, and its frame, are the owner's to approve before it is built" (GAME_RULES, G35; DECISIONS 2026-10-19, "G35 is the demo's rule"). FOUNDATIONS F17 and its question Q10 ask for one page that owes four things: the verbs, the foes, the tick, and what a fall costs. This is that page. Its five questions went to the owner on 20.10, one at a time, and his answers are recorded in DECISIONS (the five "Combat, round n" entries of 2026-10-20) and written into sections 3 to 5 here.

Design only. Nothing here is built: no kernel, schema, content, parameter or screen changes with it, and `pnpm check` holds nothing new until the rules pull request that carries section 5. Where the owner has spoken, the line cites his entry. Everything marked **proposed** is a reading of his word or a builder's shape, not his word.

How to read it: section 1 is the frame in one paragraph. Section 2 lists what was decided before this page, so nothing was asked twice. Section 3 holds the five questions as they were asked, with the three answers each, their costs, the recommendation, and the owner's word. Section 4 is the kernel shape a builder works from. Section 5 proposes the rule lines in the form GAME_RULES uses. Section 6 is the order.

## 1. The frame in one paragraph

A fight is **real time, as a regular multiplayer game, like League of Legends** (the owner, 20.10, round 1). The server runs every fight, against a creature or between players, on one fixed tick of its own (`combat.tick_ms`), as the one kernel; the phone streams its inputs over the live socket and draws what the server says, predicting only its own walk, as it does today. There is one shape for both kinds of fight, and no fight without the connection. A foe is an entity with health, breath, moves and one weakness; a hazard stays a rule. A foe shows its health and breath as bars over its head, and so does the other player inside the marked zone (round 3). Noise turns every head, a foe's and a predator's (round 4). A fall in a fight is G33, and it leaves a pack where the body fell, anyone's to take, first come (round 2). A fight reads the build's active slots as its techniques, the five attributes as small keys and the thing in the hand as the strike (round 5).

## 2. What was decided before this page

These were the walls. None of them was asked again. Where a round of 20.10 moved one, the last column says so.

| Decided | Where | What it fixes here |
|---|---|---|
| No fighting in the demo; combat after the foundation (accounts, the server, the first ring) as a core part; the frame goes to the owner before it is built | G35; DECISIONS 2026-10-19 "G35 is the demo's rule" | This page; nothing is built from it before the rules pull request |
| In the wild (danger 1 and up, G64) and in expeditions; never in a town, never on level-0 ground | W8 (WORLD_STRUCTURE section 8) | Where a foe may stand |
| Players fight each other only inside a marked zone in the wild, entered knowingly, a warning at its edge and the line readable from inside; everywhere else no player can hurt another | W8; SETTLEMENT 3.9 (entering is the consent); G76 proposed (the areas between players are the one exception to "never takes from another") | The zone and its edge |
| A fall in the zone costs what G33 says and nothing more | W8; F17 | A fall between players is a fall |
| A fall takes the outing: the finds, nothing spent back, each quest to the step it stood at; the player wakes in the last town | G33 | What a fall costs in a fight |
| The outing's finds lie where the body fell as a pack any player may take, first come, the dead player included; gone a game day later; "a fall gains nothing" holds | DECISIONS 2026-10-19 "Six open ends", answer 2 | Round 2 made it the one rule for the zone too |
| A hazard is a rule that is escaped; a foe is an entity that is fought; no hazard ever becomes a foe; the predator stays a hazard, its answer the run | G34; RULES_REVIEW case 1 | The wolf's round, the pit, the trap and deep water stay hazards; round 4 lets noise turn the wolf's head |
| The weapon waits for combat; the `hand` slot and the work clothes exist | G44; `WEAR_SLOTS` in `kernel/src/state.ts` | A weapon is a worn thing in the hand slot (round 5) |
| The line is PEGI 16 and ESRB T: blood where a hit lands, a predator drawn biting, a body that lies a moment; nothing close up, nothing dwelt on, no violence against someone who cannot act | DECISIONS 2026-10-19 "The line"; TONE.md sections 3 and 4 | What a hit and a fall may show |
| The death card says "You died." and "Your pack lies where you died."; the card and the fall's box change with this frame, not before | TONE.md section 4, "The death" | The words at a fall |
| Noise never turns a predator's head in the demo; asked again at combat | G47; REACTIONS section 9, Q1 (b) | Round 4 answered it the other way: noise turns every head |
| The play screen never shows a chance, a level, a difficulty, a danger or a time left as a number; the world shows them | G77 proposed (RULES_REVIEW case 8); DECISIONS 2026-10-09 "One internal difficulty scale"; SETTLEMENT 3.5 | A bar is not one of those numbers; round 3 puts bars over heads in a fight and keeps numbers off them |
| What is sent about a player never includes health, level or any number | PRESENCE section 4 | Round 3 opens one exception: inside the zone, the other player's bars |
| Players may destroy in the wild, and the valley repairs: a `breakable` thing carries its repair quest, who broke it is kept, a cap per player per day | DECISIONS 2026-10-19 "Six open ends", answer 1 | Section 4.8 |
| An encounter plays on the client at a fixed kernel tick and reaches the server as one batch with a `kind`, checked like `move` | NEXT 18 a; PRESENCE section 6 (the proposal the owner had not seen) | Superseded by round 1: the server runs every fight, nothing is replayed from a batch |
| A fight between players needs a server-side encounter run at a tick; an action inside the zone is refused unless the player's moves came through the relay | PRESENCE sections 5 and 6 | Round 1 extends the first to every fight; the second holds |
| The seed is the server's alone; a drawn outcome is the server's to say and the phone's to show | kernel-review R4; DECISIONS 2026-10-20 "A drawn outcome" | The phone draws a fight, never decides it |
| Do not synchronize by lockstep; the server holds the state and sends results | kernel-review 6e | The model of round 1 is this one |
| Quest step kinds reserved for combat: `defeat`, `hold`, `escort` | QUEST_GRAMMAR 3.7 | Section 4.7 |
| The hunters' board: honor for a marked player once a day, never between friends, a group or one person's accounts, only when the fall dropped finds; finds pass by a fall only between accounts past `new_account_hold`; falls traded back and forth are a loop's sign | DECISIONS 2026-10-10, the shared world | Section 4.6 |
| The expedition's last bell walks the player out, with no damage, before any other action | G49 | A fight ends at the bell (section 4.4) |
| Free movement comes first (eight directions, the kernel on tiles, an action on the faced tile) | DECISIONS 2026-10-19 "G35 is the demo's rule", proposed; GAP section 5 | The inputs act on the faced tile and the held direction |
| The growth frame: schools, a limited number of active slots, a build a player equips and changes, techniques that combine; its content waits | DECISIONS 2026-10-19 "Six open ends", answer 5; GROWTH.md (its own pull request) | Round 5 fixes what a fight reads from it |

What the page took from the gap study (GAP_DIMRAETH_DRAKANTOS section 3): stamina as a stance for both sides, so a stagger cuts both ways; foes that chain moves; a boss with one weakness; and what not to take: telegraphs so slow that hard is easy, repeated foes, and a wall of invulnerable frames. Its first line stands: "The first step needs no weapon."

## 3. The five questions, and the owner's answers

Each went to him one at a time on 20.10, three answers each with their costs, the recommendation first. His word is the last block of each. The six-line form of GAME_RULES section 6 was the message; this page was open beside it for the options.

### Q1. What a fight is made of: the verbs and the tick

The question: what are the moves a player has, and on what clock do they land, so that the fight against a creature and the fight in the zone are one kernel shape?

**A. Beats on the kernel's clock (recommended).** Beats of half a second; each beat each side names one verb (strike, guard, step, rest, a technique); breath that every verb but rest costs and a stagger when it runs out; a creature's pattern drawn once when it appears, so the fight is a function of the two sides' verbs with no roll inside it; against a creature the phone plays the beats and the server replays the batch, in the zone the server resolves each beat for the pair.
- Cost: turn-like at half a second; the beat has to be shown and heard; a slow line in the zone loses beats to rest.

**B. Real-time swings on the walk's clock, replayed from a log.** A swing lands as the button is pressed; the server validates by replaying a per-frame log.
- Cost: the log outgrows the wire's 64 KB body for any real fight, every timing in it is the client's claim, and the zone cannot run it without lockstep (kernel-review 6e).

**C. Turns, with the fight on its own time.** Each side acts in turn; the world's hour runs on around it.
- Cost: a second notion of time inside one state (W12); an opponent who walks away holds the other in a turn; reads as a menu.

**The owner's word (20.10): "real time, like a regular multiplayer game, like League of Legends."** His own answer, not one of the three. Read as (proposed): the model every live multiplayer game runs on, the server as the only simulation. The server advances every fight on a fixed tick of its own, `combat.tick_ms`; the phone sends its inputs as it makes them, over the live socket, and draws what the server sends back, predicting only its own walk as it does today (DECISIONS 2026-10-20 "A drawn outcome"); abilities have a wind-up and a cooldown in milliseconds, movement is continuous, and a hit lands when the server says it did. One shape for a creature and for the zone, since both run on the server. What it supersedes: the client-played encounter batch of NEXT 18 a and the "client-played" reading of the `encounter` kind PRESENCE section 6 reserved, both written as proposals he had not seen; the reserved kind is not needed for fights. What it costs, accepted with the answer: a fight needs the live connection (there is no fight on a dropped line, as there is no game on one, NEXT 18 c); the server simulates every fight, so its load grows with the fights running at once and is measured before the step ships (PRESENCE section 9's kind of numbers); a hit shows on the phone a round trip after the press, which the tick and the prediction of one's own walk keep short. Kernel-review 6e is kept whole: nothing is lockstep, no phone holds a simulation of outcomes.

### Q2. What a fall costs in the zone, and who takes the pack

The question: W8 leaves one detail to this frame, whether the one who caused a fall takes the finds. SETTLEMENT 3.9 (9.10) says the finds go to the one who brought the player down; the open ends of 19.10 say the finds lie as a pack anyone may take, first come. One rule has to hold.

**A. One pack rule everywhere: first come (recommended).** The pack lies where the body fell, for a game day; whoever stands next to it with room in the bag takes it, the attacker a tile away and almost always first; a third player who runs in is the zone being the zone. The hunters' board counts the fall as 10.10 wrote it.
- Cost: an attacker can be robbed of the spoils; a pair that wants to pass finds by falls still can, as 10.10 foresaw, and the hold on new accounts closes the plainest case.

**B. The attacker takes the finds at once.** The 9.10 line as written: the finds move to the one who caused the fall, in the same step, no pack.
- Cost: two rules for one thing, a direct transfer path for a loop, an attacker who risks nothing on the way to the spoils, and a kernel that must say "who caused it" for a fall that two players shared.

**C. Nobody: the finds burn.** Ledger reason `forfeit`; the hunters' board carries the honor alone.
- Cost: the zone loses its reason beyond honor; "its nodes pay more for the risk" pays into a sink that gives nothing to anyone; the pack rule gains an exception.

**The owner's word (20.10): A.** One pack rule in the whole world, first come. SETTLEMENT 3.9's line of 9.10 on the attacker's finds is superseded; the page is pointed at this one when its pull request lands.

### Q3. How a fight reads on screen

The question: G77 keeps every chance, level, difficulty, danger and time left off the screen as numbers, and the world shows them; the player's own things keep their counts. A fight needs the player to read two bodies. How?

**A. Posture, breath and wounds as pictures (recommended).** The foe shows nothing but itself: four postures, breath as a heave, a wound as blood where the hit landed and a limp afterwards, its coming move as a wind-up pose, its weakness as a pose; the player's own bar and a breath meter of their own. Monster Hunter's model.
- Cost: four postures and one wind-up per move for every foe; a player who cannot read a pose has only the rule's plainness.

**B. A bar over every head.** Health and breath as bars over the foe and, in the zone, over the other player.
- Cost: G77's spirit bends (the world was to show it); a bar over another player sends their health, which PRESENCE section 4 lists among what is never sent; the pose matters less.

**C. Words under the figure.** "Winded", "Staggered", "Wounded" as a line of text.
- Cost: a word is a number in disguise, unreadable at speed on a phone, and one more string per language.

**The owner's word (20.10): B, a bar over every head.** Read as (proposed): a foe carries its health and its breath as two small bars over its head while it is engaged, and so does the other player inside the marked zone; outside the zone no bar stands over another player, and nothing about their health travels, so PRESENCE section 4 keeps its list with this one exception, inside the zone and only while the fight runs. No number is printed on any bar (G77 holds for numbers). The poses of A are not lost: a wind-up is still drawn before a move lands (G31, nobody falls unwarned; the telegraph of NEXT 12 c), blood still shows where a hit lands at the sprite's size (TONE section 3), and the weakness still opens as a pose; the bars add to the figure, they do not replace it. The player's own bar stays as it is, and gains a breath meter of its own.

### Q4. A foe's attention: does noise turn a head?

The question: the owner said no to noise in the demo (REACTIONS section 9, Q1 b) and the retry line names combat, "where reading a foe's attention is part of the fight". Is it?

**A. In a fight, yes; outside a fight, the demo's rule stands (recommended).** A foe in a fight watches or is turned; a strike on the unwatched side lands harder; a landed strike or a step on noisy ground turns its head. The predator on its round stays a hazard set by the clock alone.
- Cost: two readings of "noise" in one world, one for hazards and one for foes.

**B. Noise turns every head, hazards too.** The predator on its round hears felling and running.
- Cost: reverses the word of 19.10 and G47's "set by the clock alone"; stealth must be relearned with sound in it; in a shared world one player's noise can turn a predator onto another's stealth (REACTIONS section 10).

**C. No attention at all.** A foe always faces the player; position never matters.
- Cost: timing alone; no flank, no reason to step; chained moves have no state to chain from.

**The owner's word (20.10): B, noise turns every head, hazards too.** It supersedes his answer of 19.10 to REACTIONS Q1 (b) and G47's "noise never turns a predator's head in the demo" and "its place set by the clock alone". Read as (proposed): a predator's place on its round is still set by the clock, and its head is turned by noise: a noisy act (felling, digging, running, a strike that lands) within `hazard.noise_tiles` turns the predator's heading toward the sound for `hazard.noise_ms`, so its cone swings there; cover still hides from the cone and never from the smell; the turn is drawn, as the eyes and the fog are, so the rule stays one the eyes can read (G47's core). A foe in a fight has a facing and a heed as A described, and the same noise turns it. Where it lands: with the combat frame, the earliest this page builds anything (section 6), and in the demo only if the owner pulls it forward; in a shared world a noise is every player's, so a predator turned by one player's felling may find another's stealth, which is now a rule of the world and not an accident. The check's G47 rows (the loop's shape, cover inside the watch) stand; a stealth quest's target must still be reachable in silence, so a quest that asks for felling inside a watch is refused.

### Q5. What combat reads from the growth frame

The question: the growth frame (GROWTH.md) is schools, a few active slots, a build a player equips, techniques that combine; its content waits. What does a fight read from it, so that the two pages are built in the right order?

**A. The build's active slots, the five attributes as small keys, and the thing in the hand (recommended).** A technique in an active slot is a combat ability with its own cost, wind-up, cooldown and effect from a closed list, so the build is what a player can do beyond the base verbs, and two combine when one's `after` opens the other's window. The five attributes stay small and read in the fight: stamina the breath cap, agility the dodge and the stagger, senses how early a wind-up shows, luck the draw of what a foe leaves, carry nothing. The thing in the `hand` slot sets the strike's reach and harm, inside the level's power cap as every worn thing is (G44, R9). Nothing reads the character level directly.
- Cost: GROWTH.md must fix the technique's format before any foe is written; the hand slot gains a role; the power cap formula gains a combat column.

**B. Attributes and the hand only; the tree touches work, not fights.**
- Cost: the tree loses the thing the owner named first for it, and a build changes nothing in the part of the game he called core.

**C. The tree only; the hand is a look.**
- Cost: G44's weapon waits forever; the stall and the workshop sell nothing for a fight; a second power cap for techniques alone.

**The owner's word (20.10): A.** The order is fixed: GROWTH.md's technique format first, then combat content. The hand slot gains the strike; the five attributes keep their names and their smallness.

## 4. The kernel shape, so a builder can build

Written for the answers of section 3. Every name is proposed. Integer math throughout, as the kernel is (kernel-review R1). The one kernel holds the fight's rules as pure functions in `kernel/`; only the server calls them with the live inputs, and the phone calls none of them for an outcome (R4; DECISIONS 2026-10-20 "A drawn outcome").

### 4.1 Entities: a foe is content

A new content type `foe`, core-only at first (`CORE_ONLY_TYPES` in `schema/src/index.ts`), additive, `FORMAT_VERSION` unchanged:

```json
{
  "type": "foe", "id": "core/bank-boar", "title": "Bank boar",
  "level": 2,
  "health": 120,
  "breath": 80,
  "reach": 1,
  "pace_ms": 240,
  "hearing": 6,
  "moves": [
    { "id": "swipe", "windup_ms": 300, "reach": 1, "harm_pct": 10, "breath": 15, "recover_ms": 400, "cooldown_ms": 1200 },
    { "id": "lunge", "windup_ms": 700, "reach": 2, "harm_pct": 20, "breath": 30, "recover_ms": 900, "cooldown_ms": 4000 }
  ],
  "patterns": [["swipe", "swipe", "lunge"], ["lunge", "swipe"]],
  "weak": { "after": "lunge" },
  "drops": [{ "item": "core/boar-hide", "weight": 60, "qty": 1 }, { "item": "core/boar-meat", "weight": 40, "qty": 2 }],
  "hours": [20, 5],
  "respawn_ms": 600000
}
```

- `level` is on the one scale (SETTLEMENT 3.6): the check holds a foe to the `d` of the area it stands in, within the band, as it holds a recipe.
- `health` and `breath` are points, kept in milli-points like the player's bar.
- A move: `windup_ms` is how long its pose shows before it lands (200 to 1000, held by the check: nobody falls unwarned, G31, and no telegraph so slow that hard is easy); `reach` in tiles; `harm_pct` of the player's health cap, as `bite_pct` is; `breath` the cost; `recover_ms` how long the foe stands open after it, where a strike lands double (`combat.weak_permille`) if the move is the one `weak.after` names; `cooldown_ms` before the same move again.
- `patterns` is a closed list of move orders; the server draws one index when the foe appears (R4), and from then on the foe's next move is the pattern's next entry, repeated, each when its wind-up can start (reach, breath, cooldown). The fight is read, not rolled: no chance decides a hit, a stagger or a move inside it; the only draws are the pattern at appear and the drops at the fall, both the server's.
- `pace_ms` is the foe's walk, one tile per `pace_ms`, toward the player it heeds while they are within `combat.engage_tiles`; `hearing` is the tiles within which noise turns its head (round 4).
- `drops` are drawn by the server at the foe's fall, one draw, weights as treasures use them, the player's luck counted as it is in a dig.
- Where a foe stands: in a `foes` block of the map beside `creatures` (DECISIONS 2026-10-19, ambient creatures), one spot per foe id with an optional `round` as predators have; `hours` optional. The check refuses a foe on level 0, inside a town's bounds, inside a camp's safe tiles, or inside a fire's `safe_tiles`.
- The predator (`hazard` prop) is untouched except for round 4: it gains `hearing` (default `hazard.noise_tiles`), never moves, never joins a fight, and the chase stays as P-5 built it.

### 4.2 The fight on the server

A fight is the server's simulation of a chunk's engaged figures, advanced on `combat.tick_ms` (100 game milliseconds proposed, ten a second; the range allows finer), run by one pure kernel function per tick:

```text
fightTick(bundle, world, inputs, tick) -> { world, events }
```

`world` is the chunk's live combat state (the server's, never saved as a player's state and never sent whole): per engaged foe its instance (`spot`, `pattern`, `health`, `breath`, `at`, `facing`, `heed`, `move`, `phase`, `since`, cooldowns) and per engaged player a small record (`breath`, `facing`, `guarding`, `move`, `phase`, `since`, cooldowns, `stagger`). `inputs` are the players' inputs received since the last tick, each stamped with the tick it arrived on, in arrival order. Health stays where it is: a hit on a player goes through the kernel's `hurt` on the player's own state, with `fall` at zero, in the same tick, so a fall in a fight is the fall the hazards already use; a hit on a foe takes from the instance.

On a player's state, additive and `null` in saves from before: `fight: { foe?: Id, zone?: Id, since: tick } | null`, set while the player is engaged, so the rest of the kernel can refuse what a fight refuses (no `craft`, no `kindle`, no `restore` while engaged, as the chase already refuses them) and so a resume after a dropped line knows the player was in one (section 4.4).

Why the server, and why per chunk: round 1. The relay holds no state (PRESENCE section 3), so the simulation is the API's; a chunk is the room PRESENCE already subscribes a phone to (3x3 of 64x64), so the fight frames go where the figures already go. A creature fought by two players is one instance both hit (the fight is shared, unlike a node, because the server runs it; what it leaves is one pack, first come); the per-player node rule of 9.10 still holds for gathering.

### 4.3 The inputs

A phone sends an input as it makes it, over the live socket, as a frame `{ k: 'input', v, dir?, slot?, tick }`; the relay forwards fight inputs to the API at once, outside the two-second move batch (PRESENCE 3.4's internal channel), and the API stamps each with the tick it arrived on, never the tick the phone claims past it (the clock anchor of NEXT 18 a holds). The verbs:

| Verb | Shape | Breath | What the server does on its tick |
|---|---|---|---|
| `move` | `{ v: 'move', dir }`, held or released | none | Walks the figure one tile per `walk_step_ms` in `dir` (eight ways, G56's walk rules, never onto a solid or across a level change without a crossing, G68), spending the movement credit as a report does; the phone predicts this one and snaps back when refused, as today |
| `attack` | `{ v: 'attack', dir }` | `combat.attack_breath` | Starts the hand's strike: the weapon's `windup_t` in ticks (bare hands `combat.bare_windup_t`), then it lands on the figure within the hand's reach in `dir`, unless that figure guards that side; harm is the hand's strike in points (the weapon's `harm` counted with `hand_offset`, 4.9), times `behind_permille` on an unwatched side, times `weak_permille` inside the foe's `recover_ms` after its weak move; a strike into a guard staggers the striker for `combat.guard_stagger_ms` and costs the guard `combat.guard_hit_breath`; then the rest of the hand's one swing, its `tempo` in ticks (`combat.swing_quick_t`, `swing_standard_t`, `swing_heavy_t`). Amended by the gear wave (WEAPONS.md 3 and 15): the weapon block in ticks and points, as 4.9 decided |
| `guard` | `{ v: 'guard', dir }`, held or released | `combat.guard_drain` per tick while held | The side `dir` takes no harm while held; breath does not refill; at zero breath the guard breaks and the figure staggers |
| `dodge` | `{ v: 'dodge', dir }` | `combat.dodge_breath` | Two tiles in `dir` over `combat.dodge_ms`, during which a strike misses; then `combat.dodge_cooldown_ms`; never through a solid or a level change (the gap study's warning: the window is short and it costs) |
| `tech` | `{ v: 'tech', slot, dir }` | the technique's | The technique in that active slot, an ability of the growth frame: its cost, its wind-up, its effect from a closed list, its cooldown; two combine when one's `after` opens the other's window (GROWTH.md fixes the format) |

Standing still refills breath by `combat.breath_refill` per tick; any verb but `move` stops the refill for `combat.breath_hold_ms`. Breath cap: `combat.breath_base + per_point.breath * attrs.stamina`. A figure at zero breath staggers for `combat.stagger_ms` and can neither strike nor guard; agility shortens the stagger and the dodge's cooldown by `per_point.agility_pct`. Senses lengthen nothing in the rule; they let the phone show the wind-up pose earlier by `per_point.senses` ticks of lead, which the server sends as the foe's `phase` (a display of the same truth, G24).

A foe's heed (round 4): on toward the player who last hit it or last made noise within its `hearing`; its moves land ahead of its facing; a strike from the side it does not face lands harder. Noise (a strike that lands, felling, digging, running) within `hearing` turns a foe's heading, and within `hazard.noise_tiles` a predator's, for `hazard.noise_ms`.

Ending: a figure is engaged from the first strike or the first move a foe starts toward a player within `combat.engage_tiles`, and disengaged when it reaches a safe place (G30; a foe never enters one and stops at the line as the chase does), when the sides stand farther apart than `combat.break_tiles` for `combat.break_ms` (the run is always possible), when a side falls, or at an expedition's last bell (G49: the walk-out comes first). A foe left standing keeps its health until its `respawn_ms` on the spot's node (`nodes[id].readyAt`), the way a dug spot rests; a foe that fell rests the same way.

### 4.4 The wire: frames, prediction, a dropped line

- Down: the server sends the chunk's fight frame after each tick with a change, `{ k: 'fight', tick, figures: [...] }`, through the relay to the room, carrying per figure its tile, facing, phase, and the two bars as permille of their caps (rounds 3); for another player, only inside the zone, else no bars (PRESENCE section 4). The frame kind `fx` PRESENCE reserved carries the blows: a hit with its tile and its harm as a size, a stagger, a fall.
- The phone predicts its own walk and shows its own wind-up at once; a hit, a stagger, a fall and a foe's move are drawn when the frame says so. Nothing else is predicted, by the owner's word on NEXT 18 c (a drawn outcome is the server's to say).
- A dropped line pauses the game at once on the phone ("Waiting for the connection", NEXT 18 e); on the server the figure stands still, guards nothing and keeps taking what lands for `combat.linger_ms`, then disengages as a run would, and a foe walks off. That is the price of the live model and it is the same for everyone; nothing is taken from a player who is away beyond that window.
- Every input and every hit is a row of the action log (NEXT 18 b), so a fight is audited after the fact the way an outing is; no batch is replayed, and the `encounter` kind reserved by PRESENCE section 6 is not used (it may stay reserved for a later use or be dropped when PRESENCE is edited).

### 4.5 The zone

Inside the marked zone (an area slot with `protection: contested`, the reserved field of SETTLEMENT 3.9), the same simulation runs with players on both sides:
- A strike at a player outside the zone, or from outside it, is refused; the line is drawn and readable from inside (W8; the sign at every entry tile, G31).
- An input inside the zone is accepted only from a player whose moves came through the relay (PRESENCE section 5), so no one is teleported into a fight.
- Any number may fight any number, as in a regular multiplayer game; a group's fight is one simulation, and the `hold` quest kind counts the side still standing in the place at each bell (QUEST_GRAMMAR 3.7).
- No player harms another in a town, a camp or a house, at any hour (SETTLEMENT 3.9); the zone is never within a town's bounds, never holds a camp slot, and its `d` is at least `combat.zone_min_d` (the check).
- A player who leaves the zone disengages as a run does; the one who stays may not follow across the line with a strike.
- Inside the zone the other player's two bars travel and are drawn over their head (round 3); their name, sprite and pose are what PRESENCE section 4 already sends; nothing more.
- The mark of the worth board's top (`marked_top`) is seen from afar inside the zone (DECISIONS 2026-10-09, the boards).

### 4.6 A fall and the pack

A fall in a fight is the kernel's `fall` (G33): the outing's finds leave the bag, each quest goes back to the step it stood at, the player wakes in the last town with the bar full. What this frame adds is the pack of 19.10, now the one rule everywhere (round 2):

```text
pack: { at: Tile, items: { item: qty }, until: tick }   // a world object the server holds; the player's own in their own valley
```

- Placed at `from` by the server at every fall (a boar's, a pit's or a player's alike), holding the `lost` list of the fall event, `until` = the fall's tick plus `day_length_ms`. Nothing else goes in: the pack holds no more than the outing found, so dying never pays (10.10, "a fall gains nothing").
- A `take` action for a player standing next to it with room in the bag: `{ kind: 'take', pack: Id, at }`; what is taken joins the taker's outing as a find, so a fall on the way home loses it again. First come, the dead player included.
- The pack is drawn as the body's pack lying in the grass, with no name on it; the death card says "Your pack lies where you died." (TONE section 4).
- The hunters' board (10.10) counts a fall in the zone once a day for a marked player, only when the pack held something, never between friends, a group or one person's accounts, and only between accounts past `new_account_hold`.
- Nothing moves in gold at a fall; gold stays with the player (G33). The pack that vanishes is a sink of goods, listed in the sinks table of open end 6.

### 4.7 Events and quests

New kernel events: `{ e: 'engage', foe | zone }`, `{ e: 'hit', by: 'player' | 'foe' | 'other', harm, at }`, `{ e: 'stagger', side }`, `{ e: 'foe_fall', foe, at, drops }`, `{ e: 'disengage' }`, `{ e: 'pack', at, until }` on a fall, `{ e: 'take', pack, items }`. The `hurt` and `fall` events stay as they are. `defeat { foe, count }` counts `foe_fall` events the player's hits earned (the last hit, or any hit above `combat.credit_permille` of the foe's health, so a group shares a kill), `hold { place, bells }` counts the side still standing, `escort { npc, from, to }` fails on the companion's fall by the fall rule of 8.10 (QUEST_GRAMMAR 3.7, SETTLEMENT 3.7).

### 4.8 What a fight may break

A strike or a technique whose effect is `fire` or `break` may break a thing marked `breakable` on the map (open end 1), under the same cap per player per day and with the same repair quest; the name of who broke it is kept. A fight breaks nothing unmarked.

### 4.9 Parameters and caps: the numbers in one table (revised 29.10)

A `combat` group in `content/core/params.json`, each number with a range and a step as every number has. The table reconciles the frame of 20.10 with the recommendations of the combat memo ([research-combat.md](../research/research-combat.md), its recommendation steps 0 to 13, cited "memo n"). Every duration is a whole number of fight ticks (memo 0: a duration in milliseconds becomes `ceil(ms / tick_ms)` ticks), so the frame's `_ms` names become `_t` names; where sections 4.1 to 4.4 still name a value in milliseconds, the tick count in this table is the number. Where the frame and the memo disagreed, the source column says which won and why, in one line. Nothing here is built: the group enters `params.json` with the fight's first kernel pull request.

| Name | Value | Range | Step | Source |
|---|---|---|---|---|
| `tick_ms` | 100 | 50 to 200 | 50 | Owner (round 1: the server's own tick); frame's value. Memo 0 won the range over the frame's 33 to 250: every duration below is a count of ticks, and 50 to 200 keeps a press to a drawn hit at 100 to 300 ms on a 100 ms line. |
| fight state | integers only; per figure `hp`, `breath`, a stance (idle, windup, active, recovery, stun) and one `stance_until` tick | fixed | none | Frame 4.2 (R1) and memo 1 agree. |
| order inside a tick | inputs by arrival tick, then distance to the target, then account id; players resolve before foes; the same order decides a pack two players reach on one tick | fixed | none | Memo 2 over the frame's arrival order alone: first come (round 2) needs a written tie rule. |
| authority | the server decides every hit and every bar; the phone predicts its own walk and shows its own wind-up pose, nothing else; no lag compensation, no rollback | fixed | none | Owner (round 1); memo 3. The frame was silent on lag compensation; slow, telegraphed foes make it unneeded, and round 1's retry clause brings any prediction rule back to the owner. |
| `swing_quick_t` | 8 | 6 to 10 | 1 | Memo 4. Agrees with the frame's `bare_cooldown_ms` 800. |
| `swing_standard_t` | 10 | 8 to 12 | 1 | Memo 4. |
| `swing_heavy_t` | 12 | 12 to 15 | 1 | Memo 4. |
| `swing_floor_t` | 6 | 4 to 8 | 1 | Memo 4: no hand swings faster than this, whatever its tier or a technique. |
| one cooldown for the hand | the next strike waits for the last one's swing; a swap of the thing in hand never skips it | fixed | none | Memo 4 over the frame's cooldown per weapon: a quick hand and a heavy one swapped would double the output (memo pitfalls). |
| `bare_windup_t` | 3 | 2 to 5 | 1 | Frame (`bare_windup_ms` 300); the memo is silent on the player's wind-up. |
| reach | 1 tile, no diagonal; 2 for a long hand | 1 to 2 | 1 | Memo 4; the frame's "the hand's reach" agrees. |
| `windup_t` (a foe's move) | 5 | 2 to 10 | 1 | Memo 5 for the value; the frame's 200 to 1000 ms is the same range in ticks. The wind-up is longer than a press's round trip, so a player who reacts can step out (G31). |
| `active_t` | 2 | 1 to 3 | 1 | Memo 5 over the frame, which had no active window: a move hits whoever stands in its reach on its active ticks, a rule and not a roll (G34). |
| `recovery_t` | 8 | 4 to 12 | 1 | Memo 5; the frame's `recover_ms` per move is the same window. |
| `rehit_t` | 2 | 1 to 3 | 1 | Memo 5: one swing hits one target once. |
| damage | `f = base div 8`; a draw from the kernel's stream in `base - f` to `base + f - 1`; at least 1 after defence | fixed | none | Memo 6 over the frame's `harm_pct` for a player's strike: a share of the target's cap fells every foe in the same number of hits whatever its size, and points let a tier be counted in hits. |
| hand compression, `hand_offset` | 128 (proposed): the hand's bonus counts as `bonus + hand_offset` | 96 to 256 | 32 | Memo 6: a bonus eleven times larger moves the hit under two times, so every tier stays under the one power cap (round 5). Amended by the gear wave (WEAPONS.md 4 and 15): memo 6's 64 was an outside game's maximum-hit constant, so the offset is our own number, chosen by its job. |
| a foe's harm to a player | a share of the bar, written as a divisor of `hp_cap` | fixed | none | Frame (`harm_pct`), kept: the bar is the one bar (G32) and a share reads the same at every level. |
| `bite_div` | 6 (a bite takes `hp_cap div 6`) | 4 to 8 | 1 | Memo 8: six unanswered bites fell a player. The hazard's `bite_pct` 25 stays the hazard's (G34) and does not change. |
| `behind_permille`, `weak_permille` | 2000, 2000 | 1000 to 3000 | 250 | Frame; the memo is silent. |
| `credit_permille` | 250 | 100 to 500 | 50 | Frame: a group shares a `defeat`. The claim below decides whose foe it is, not who shares the credit. |
| `mercy_t` | 8 | 6 to 10 | 1 | Memo 7 over the frame, which had none: without it two foes land in one tick on a slow line and a fall is never read. |
| `stun_t` | 3 | 2 to 5 | 1 | Memo 7: no input for three ticks after a hit. |
| `knockback_tiles` | 1 | 0 to 1 | 1 | Memo 7: one tile from the source, never into a solid tile or across a level change (G68). |
| invulnerability frames | none | fixed | none | Memo 7 over the frame's 250 ms dodge in which "a strike misses": Hyper Light Drifter cut its dash frames three days after adding them, and G34's answer is a run, never a trick. |
| dodge | two tiles over 3 ticks, then `dodge_cooldown_t` 15 | 10 to 20 | 1 | Frame (`dodge_ms` 250, `dodge_cooldown_ms` 1500, in ticks), without its miss window (the row above): a dodge moves the body out of reach and nothing else. |
| `breath_base` | 60 | 40 to 100 | 5 | Frame; the memo is silent. |
| `breath_refill` | 2 a tick | 1 to 4 | 1 | Frame. |
| `breath_hold_t` | 6 | 3 to 10 | 1 | Frame (`breath_hold_ms` 600). |
| `attack_breath`, `guard_drain`, `guard_hit_breath`, `dodge_breath` | 15, 1 a tick, 8, 12 | 5 to 30, 1 to 3, 4 to 16, 5 to 24 | 1 | Frame. |
| `per_point.breath` | 8 | 4 to 12 | 1 | Frame; the key it reads waits for the attribute map that round 5's note of 22.10 redoes with the combat wave. |
| `breath_stagger_t` | 12 | 8 to 15 | 1 | Frame (`stagger_ms` 1200): out of breath, no strike and no guard. It is not memo 7's stun, which follows a hit; both stay, named apart. |
| `guard_stagger_t` | 6 | 4 to 8 | 1 | Frame (`guard_stagger_ms` 600): the striker into a guard. |
| tier T1 | felled in 2 hits of a starter hand | 2 | none | Memo 8 (the first knight of A Link to the Past). |
| tier T2 | 6 to 8 hits | 6 to 8 | 1 | Memo 8. |
| tier T3 | 20 hits and more, wind-up 8 ticks | 20 to 30 | 1 | Memo 8. |
| `engage_tiles` | 6 | 4 to 8 | 1 | Frame; the memo starts a hunt on the cone, the smell or a noise, which [HUNTING.md](HUNTING.md) section 3 keeps for animals. |
| `leash_tiles` | 7, from the foe's spot or den | 5 to 10 | 1 | Memo 9 over the frame's `break_tiles` 8 from the player: a line measured from the den is a place a player can learn, and a foe that crosses back resets its health, so a run always ends a fight. |
| `give_up_t` | 50 | 30 to 80 | 10 | Memo 9 over the frame's `break_ms` 3000: five seconds out of sight ends a chase, and the leash is the hard line behind it. |
| `linger_t` | 30 | 20 to 50 | 10 | Frame (`linger_ms` 3000): a figure on a dropped line. |
| noise, by gait | still 2, sneak 3, walk 5, run 8 | 0 to 4, 1 to 6, 2 to 9, 4 to 12 | 1 | The gait params on develop (`gait.noise_still`, `noise_sneak`, `noise_walk`, `noise_run`, read by the kernel's `noiseRadius`), quoted. They hold over the memo's walk 0 and run 3 and over the frame's one `hazard.noise_tiles` 6: the table was built after both. |
| noise, a strike that lands | 4 | 2 to 6 | 1 | Memo 9; a new row of the gait group. |
| noise, felling or digging | 5 | 3 to 8 | 1 | Memo 9; a new row of the gait group. |
| `noise_turn_t` | 30 | 20 to 50 | 10 | Memo 9 over the frame's `hazard.noise_ms` 4000: three seconds is long enough to draw and read the turn, and shorter keeps a stealth crossing open after someone else's noise (round 4's retry clause). |
| `claim_lock_t` | 48 | 30 to 60 | 6 | Memo 10; the frame was silent. The first account whose strike lands holds the foe; each hit the holder deals or takes refreshes the lock; the bar turns grey for the rest. It never stops another from fighting. |
| bars | a 31 by 4 px frame, fill inset 1 px, 29 px at full; health over breath; at least 1 px of fill while alive; no number | fixed | none | Owner (round 3: two bars, no number); memo 11 for the size. The look is a direction: phone-size stills go to the owner before a sprite is drawn. |
| `bar_linger_t` | 50 | 30 to 80 | 10 | Memo 11: the bars stay 5 seconds after the lock ends. |
| `zone_min_d` | 5 | 3 to 8 | 1 | Frame. |
| `pay_per_s_mg` | 50 | 25 to 100 | 5 | Frame: the cap on what a fight pays, read through the value solver; a hunted drop needs the solver's fifth source, `hunt`, which does not exist yet ([HUNTING.md](HUNTING.md) section 9). No drop carries a price of its own. |

What else caps what one fight can pay: one pack per foe and the foe's `respawn_ms` on the spot's node (farming a boar is throttled like a bush); a drawn drop never passes the rarity budget of the area (`rarity_budget_permille`); drops join the outing and a fall loses them; the trader's day cap (`trader_day_cap`) is where hours turn into gold whatever the source.

The check (section 8 of GAME_RULES gains rows): every move has a wind-up of 2 to 10 ticks; every pattern has at least one recovery window per cycle in which a strike can land, and a cycle's total harm is below the health cap of a player at the foe's level, so a player at level with bare hands can win by reading the pattern (the "hard and possible" of G34's run, restated for a fight); a foe's level fits its area's `d`; a foe's tier fits its hits (T1 2, T2 6 to 8, T3 20 and more, counted against a starter hand); no foe on level 0, in a town, on a camp or inside a fire's safe tiles; a zone's `d` at or above `zone_min_d`, a sign at every entry tile, no town and no camp slot inside; a `defeat` step's foe stands within the quest's area; a drop table's value under `pay_per_s_mg` times the kill's seconds; a stealth quest's target reachable without a noisy act inside a watch (round 4).

### 4.10 What the screen reads (for the art and the client, not decided here)

The foe's two bars over its head, no number on them; the other player's two bars inside the zone only; the player's own bar as today and a breath meter of their own; the foe's wind-up pose and its open pose; blood where a hit lands at the sprite's size and a limp after (TONE); a predator's head turning to a noise; the death card of TONE section 4 with the pack line; the zone's line drawn as stones or banners and its sign; the pack in the grass. A direction decision (the frame of a fight on screen) goes to the owner as two or three phone-size stills before a sprite is drawn, as every direction does (AGENTS.md).

## 5. Rule lines proposed, in the form GAME_RULES uses

Numbers provisional (G78 onward, after G77 of RULES_REVIEW). The owner's answers of 20.10 stand behind G78, G81, G83, G84 and G86, and those five entered GAME_RULES on 29.10 under these numbers; G79, G80, G82 and G85 stay the frame's proposals here and keep their numbers until the owner reads them.

- **G78 A fight is real time, and the server runs it.** A fight runs on the server's own tick, against a creature and between players alike; the phone sends its inputs as it makes them and draws what the server says, predicting its own walk and nothing else. There is no fight without the live connection, nothing is replayed from a batch, and no phone holds a simulation of an outcome (the owner, 20.10).
- **G79 A fight is read, not rolled.** A strike lands by reach, side and timing; breath pays for every verb but standing, and a figure out of breath staggers; a creature's moves follow a pattern drawn once when it appears, with a wind-up the eyes can read before each lands and one weakness after one of them. The only draws are the pattern at appear and the drops at the fall, both the server's.
- **G80 A foe is an entity; a hazard stays a rule.** A foe stands in the wild (danger 1 and up) and in expeditions, never in a town, on level-0 ground, at a camp or inside a fire's safe tiles; it never follows into a safe place, and the run always ends a fight. The predator, the pit, the trap and deep water are hazards (G34) and never foes.
- **G81 A fall in a fight is a fall, and it leaves a pack.** At zero health the player falls by G33 and wakes in the last town. The outing's finds lie where the body fell as a pack any player next to it may take, first come, the dead player included, in the zone as anywhere, and the pack is gone a game day later. Nothing more is taken: not a tool, not a worn thing, not what the player made, not gold, and nothing from a player who is away (the owner, 20.10).
- **G82 The marked zone is the only place a player can hurt another.** A zone lies far out and high on the scale, with a sign at every way in and its line readable from inside; entering is the consent. Inside it any number may fight any number, on the server, and only players whose moves came through the relay are heard. Outside it no action of one player takes health from another, and no bar stands over another player.
- **G83 A fight shows its bars.** A foe carries its health and its breath as bars over its head while it fights, and so does the other player inside the marked zone; no number is printed on a bar, and the world still shows chance, level, difficulty, danger and time (G77). The bars add to the figure: a wind-up is still drawn before a move lands, a hit still bleeds where it landed, a weakness still opens as a pose (the owner, 20.10).
- **G84 Noise turns every head.** A noisy act (felling, digging, running, a strike that lands) turns the head of a foe within its hearing and of a predator within `hazard.noise_tiles`, for a while; the turn is drawn, and cover still hides from the cone and never from the smell. A predator's place on its round is set by the clock; its heading is set by the clock and by noise (the owner, 20.10; supersedes the demo's "never" of 19.10).
- **G85 A fight pays by its time, and no more.** What a foe leaves is worth at most `combat.pay_per_s_mg` for each second its pattern needs to fell it, at the trader's price, inside the area's rarity budget; a felled foe rests for its `respawn_ms` on the spot's node; the drops join the outing and a fall loses them.
- **G86 A fight reads the build, the five keys and the hand.** The techniques a fight offers are the build's active slots; stamina is the breath, agility the dodge and the stagger, senses how early a wind-up shows, luck the drop's draw, carry nothing; the thing in the hand sets the strike, under the one power cap (G44, R9). Nothing reads the character level directly (the owner, 20.10).

The review checklist (GAME_RULES section 7) gains one question: "Can a player at the foe's level, with bare hands, win by reading the pattern, and is the run always open?"

## 6. The order, and what this page does not do

- Built after NEXT 18 (accounts, the server) and NEXT 19 (the first ring), and after the relay of PRESENCE (builds a and b), since every fight now rides the live socket; before live presence as a feature if the relay lands first, with free movement first (DECISIONS 2026-10-19, "G35 is the demo's rule", proposed, with this one change of order read from round 1). The pack and `take` come first, with the fall (open end 2 names this frame as its builder); the foe type and `fightTick` second; the zone with them, since it is the same simulation; noise on the predator's head with the foe's hearing.
- The growth frame fixes the technique's format before any foe is written (round 5); the first foes are the boar and a thief with one weakness each, in the first ring's danger-1 and danger-2 areas; the road thieves of the boards entry (CR-40) take the foe type.
- Numbers to measure before the step ships, in PRESENCE section 9's way: the server's cost per fight per tick, the fights one process holds at the target frame time, the round trip a phone sees from a press to a drawn hit on a mobile line, and the fall rate in the first ring's fights.
- Not done here: the content of foes beyond the example; the techniques' list and effects (GROWTH.md); companions in a fight (SETTLEMENT 3.7's `companion` falls by the 8.10 rule); the stills of a fight on screen (a direction decision of its own); the words on the death card beyond TONE's; the numbers' tuning, which a playtest moves inside the ranges.
- Pages this frame touches when its rules pull request lands: SETTLEMENT 3.9 (the attacker's finds line, superseded by round 2); G33's "nothing left in the world" (the pack, after #223); G44 (the weapon's role); G47 (noise, after #218 and the reactions page's section 9 answer); REACTIONS section 9 Q1 (b) and section 10's noise line; PRESENCE sections 4 and 6 (the zone's bars; the `encounter` kind unused for fights; every fight on the relay, after #221); NEXT 18 a's encounter paragraph (after #220); QUEST_GRAMMAR 3.7 (the counting of `foe_fall`); GRUNT CR-12 and CR-40 (the weapon slot and the road thieves); the kernel review's sink table (the pack) and its 6e row (the model of round 1 is its own recommendation).

## Sources

- League of Legends (Riot Games, 2009): the model the owner named; a server-authoritative simulation at a fixed tick with inputs streamed from the client and abilities on cooldowns (Riot Games, "Peeking into VALORANT's Netcode", cited in DECISIONS 2026-10-20 "A drawn outcome"; Valve, Source Multiplayer Networking, the same model).
- Dark Souls (FromSoftware, 2011) and Sekiro (2019): stamina and posture as the stance of both sides; a stagger that cuts both ways.
- Monster Hunter (Capcom, 2004 onward): the posture reading that round 3 kept beside the bars.
- For Honor (Ubisoft, 2017): a guard with a side; a strike into the open side.
- RuneScape's Wilderness (Jagex, 2001 onward): a marked zone with a line, entered knowingly, where a fall drops what was carried for anyone to take.
- Ultima Online (1997) and its 2000 split into a world without fights between players: what a zone without consent costs a game.
- Bettner and Terrano, "1500 Archers on a 28.8" (2001), and Gaffer On Games on deterministic lockstep: the model the frame does not use (kernel-review 6e; REACTIONS section 10).
