# The combat frame: what a fight is made of, where it stands, and what a fall costs (2026-10-20)

A decision page for the owner. G35 says combat comes after the foundation as a core part of the game, and that "where it is fought, and its frame, are the owner's to approve before it is built" (GAME_RULES, G35; DECISIONS 2026-10-19, "G35 is the demo's rule"). FOUNDATIONS F17 and its question Q10 ask for one page that owes four things: the verbs, the foes, the tick, and what a fall costs. This is that page.

Design only. Nothing here is built: no kernel, schema, content, parameter or screen changes with it, and `pnpm check` holds nothing new until the rules pull request that follows the owner's answers. Where the owner has spoken, the line cites his entry. Everything marked **proposed** is not his word.

How to read it: section 1 is the frame in one paragraph. Section 2 lists what is already decided, so nothing is asked twice. Section 3 holds the five open questions, one at a time, each with three answers, their costs and a recommendation first. Section 4 is the kernel shape a builder works from once the answers are in. Section 5 proposes the rule lines in the form GAME_RULES uses. Section 6 is the order.

## 1. The frame in one paragraph

A fight is an **encounter**: two sides, a bounded run of **beats** on the kernel's own clock, on the tiles where it began. Each beat each side names one verb from a short closed list, and the kernel resolves the beat by rule, with no roll inside the fight. Against the world's creatures the encounter plays on the phone and reaches the server as one batch, which the server replays with the same kernel, the way it checks `move` reports today (NEXT 18 a, DECISIONS 2026-10-20 "The server's wire, as built"). Between players, inside the marked zone of W8, the server runs the same beats itself, one at a time, because a relay that holds no state cannot judge a fight and a batch replayed after the fact cannot either (PRESENCE section 6). A fall in a fight is G33 and the pack of 19.10, and nothing more.

## 2. What is decided already

These are the walls. None of them is asked again below.

| Decided | Where | What it fixes here |
|---|---|---|
| No fighting in the demo; combat after the foundation (accounts, the server, the first ring) as a core part; the frame goes to the owner before it is built | G35; DECISIONS 2026-10-19 "G35 is the demo's rule" | This page exists; nothing is built from it until he answers |
| In the wild (danger 1 and up, G64) and in expeditions; never in a town, never on level-0 ground | W8 (WORLD_STRUCTURE section 8) | Where a foe may stand |
| Players fight each other only inside a marked zone in the wild, entered knowingly, a warning at its edge and the line readable from inside; everywhere else no player can hurt another | W8; SETTLEMENT 3.9 (entering is the consent); G76 proposed (the areas between players are the one exception to "never takes from another") | The zone and its edge |
| A fall in the zone costs what G33 says and nothing more | W8; F17 | A fall between players is a fall |
| A fall takes the outing: the finds, nothing spent back, each quest to the step it stood at; the player wakes in the last town | G33 | What a fall costs in a fight |
| The outing's finds lie where the body fell as a pack any player may take, first come, the dead player included; gone a game day later; "a fall gains nothing" holds | DECISIONS 2026-10-19 "Six open ends", answer 2 (the owner's own answer) | What a fall leaves; section 4.6 |
| A hazard is a rule that is escaped; a foe is an entity that is fought; no hazard ever becomes a foe; the predator stays a hazard, its answer the run | G34; RULES_REVIEW case 1 | The wolf's round, the pit, the trap and deep water are untouched by this page |
| The weapon waits for combat; the `hand` slot and the work clothes exist | G44; `WEAR_SLOTS` in `kernel/src/state.ts` | A weapon is a worn thing in the hand slot |
| The line is PEGI 16 and ESRB T: blood where a hit lands, a predator drawn biting, a body that lies a moment; nothing close up, nothing dwelt on, no violence against someone who cannot act | DECISIONS 2026-10-19 "The line"; TONE.md sections 3 and 4 | What a hit and a fall may show |
| The death card says "You died." and "Your pack lies where you died."; the card and the fall's box change with this frame, not before | TONE.md section 4, "The death" | The words at a fall |
| Noise never turns a predator's head in the demo; asked again at combat, where reading a foe's attention is part of the fight | G47; REACTIONS section 9, Q1 (b) | Question 4 below |
| The play screen never shows a chance, a level, a difficulty, a danger or a time left as a number; the world shows them | G77 proposed (RULES_REVIEW case 8); DECISIONS 2026-10-09 "One internal difficulty scale"; SETTLEMENT 3.5 | Question 3 below |
| Players may destroy in the wild, and the valley repairs: a `breakable` thing carries its repair quest, who broke it is kept, a cap per player per day | DECISIONS 2026-10-19 "Six open ends", answer 1 | Section 4.8: a fight may break what is marked breakable, under the same cap |
| An encounter plays on the client at a fixed kernel tick and reaches the server as one batch with a `kind`, checked like `move`, with caps from `params.json` on what one encounter can pay; a fight between players needs a server-side encounter run at a tick | NEXT 18 a; PRESENCE section 6 (`encounter` reserved, against the world's creatures only); DECISIONS 2026-10-20 "The server's wire" | Section 4 keeps to this shape |
| An action inside the zone is refused unless the player's moves came through the relay | PRESENCE section 5 | Section 4.5 |
| The seed is the server's alone; a drawn outcome is the server's to say and the phone's to show | kernel-review R4; DECISIONS 2026-10-20 "A drawn outcome" | Nothing in a fight is drawn on the phone (section 4.2) |
| Do not synchronize by lockstep; the server holds the state and sends results | kernel-review 6e | The zone's fight runs on the server |
| Quest step kinds reserved for combat: `defeat`, `hold`, `escort`; `defeat` counts the foes' fall events of an encounter batch | QUEST_GRAMMAR 3.7 | Section 4.7 |
| The hunters' board: honor for a marked player once a day, never between friends, a group or one person's accounts, only when the fall dropped finds; finds pass by a fall only between accounts past `new_account_hold`; falls traded back and forth are a loop's sign | DECISIONS 2026-10-10, the shared world | Section 4.6 |
| The expedition's last bell walks the player out, with no damage, before any other action | G49 | A fight ends at the bell (section 4.4) |
| Free movement comes first (eight directions, the kernel on tiles, an action on the faced tile) | DECISIONS 2026-10-19 "G35 is the demo's rule", proposed; GAP section 5 | The verbs act on the faced tile |
| The growth frame: schools, a limited number of active slots, a build a player equips and changes, techniques that combine; its content waits | DECISIONS 2026-10-19 "Six open ends", answer 5; GROWTH.md (its own pull request) | Question 5 below |

What the page took from the gap study (GAP_DIMRAETH_DRAKANTOS section 3): stamina as a stance for both sides, so a stagger cuts both ways; foes that chain moves; a boss with one weakness; and what not to take: telegraphs so slow that hard is easy, repeated foes, and a wall of invulnerable frames. Its first line stands: "The first step needs no weapon."

## 3. The five questions for the owner

Each goes to him one at a time, in the six-line form of GAME_RULES section 6, with this page open beside it for the options and their costs. The recommendation is always first. An answer is written into DECISIONS the same day, and the rule line of section 5 follows it.

### Q1. What a fight is made of: the verbs and the tick

The question: what are the moves a player has, and on what clock do they land, so that the client-played fight against a creature and the server-run fight in the zone are one kernel shape?

**A. Beats on the kernel's clock (recommended).** A fight runs in beats of `combat.beat_ms` (500 game milliseconds proposed, which is half a real second). Each beat each side names one verb: `strike` (the faced tile), `guard` (the faced side), `step` (one tile, any of eight ways), `rest` (breath comes back), or a technique from an active slot (question 5). Every verb but `rest` costs breath; a side with no breath staggers for `combat.stagger_beats` and can neither strike nor guard. A foe's moves follow a pattern drawn once by the server when the foe appears, so from then on the fight is a pure function of the two sides' verbs and the beat count. Nothing inside a fight is rolled: the fight is read, not rolled, as a hazard is a rule and not a roll (G34).
- Cost: a fight is turn-like at half a second; the beat has to be shown and heard (a breath, a drum), and that is design work on the screen. A phone on a slow line in the zone loses a beat now and then to `rest`. The beat is the kernel's tick times a constant, so it is not a second clock, but it is one more fixed cadence beside the walk's `walk_step_ms`.
- Why first: it is the only shape all three constraints accept at once: the phone can play it (no draw inside), the server can replay it beat by beat (NEXT 18 a), and the zone can run it live on the server with one verb per side per beat (PRESENCE section 6, kernel-review 6e). Dark Souls and Dimraeth both run on a stamina stance; the beat makes that stance checkable.

**B. Real-time swings on the movement clock.** A swing lands on the faced tile as soon as the button is pressed, with invulnerable frames on a dodge, at the walk's pace (190 ms a step). The server validates by replaying a per-frame log.
- Cost: the batch grows from one verb per half second to a log at frame rate, past the 64 KB body limit of the wire for any real fight; every timing in it is the client's claim, so a cheat is a cheap edit of the log; the zone cannot run it, because two phones' frames cannot be ordered by a server without lockstep (6e) or a trusted authority on each phone. It also makes the walk's clock the fight's clock, so every walk parameter becomes a balance knob.

**C. Turns, with the fight on its own time.** Each side acts in turn; the fight waits for the input; the world's hour runs on around it.
- Cost: the bells, the dusk and a hunt bite by the clock while the fight stands still, so the kernel would need a second notion of time inside one state (the one-clock rule, W12). In the zone an opponent who walks away from the phone holds the other in a turn. It reads as a menu, against the direction of 18.10 (free movement, the action on the faced tile) and against the gap study's "telegraphs so slow that hard is easy".

Six lines, as sent:

```
To the product owner, a product question in the game:
Asked: what a fight is made of and on what clock, so a creature fight on the phone and a zone fight on the server are one shape (the combat frame, F17 and Q10)
Breaks: nothing yet; G35 keeps the frame yours to approve before it is built
The player would feel: a fight read like the wolf's round is read, by watching, with a half-second beat under it
My recommendation: A, beats on the kernel's clock with strike, guard, step, rest and the build's techniques; the alternative that keeps every rule is none, B and C each break one (the wire's limit, or one clock)
Needed from you: A / B / C
```

### Q2. What a fall costs in the zone, and who takes the pack

The question: W8 says a fall in the zone costs what G33 says and nothing more, and leaves one detail to this frame: whether the one who caused it takes the finds. Two of the owner's own lines pull apart here. SETTLEMENT 3.9 (9.10) says the outing's finds go to the one who brought the player down. The open ends of 19.10 say the finds lie where the body fell as a pack anyone may take, first come. One rule has to hold.

**A. One pack rule everywhere: first come (recommended).** The pack lies where the body fell, for a game day, and whoever stands next to it with room in the bag takes it, the attacker, the fallen, or a third player. The attacker is a tile away and almost always first, so in practice the finds are theirs; a third player who runs in and takes them is the zone being the zone. The hunters' board counts the fall as 10.10 wrote it: only when it dropped finds, never between friends, a group or one person's accounts, and only between accounts past `new_account_hold`.
- Cost: an attacker can be robbed of the spoils by a third player; a pair that wants to pass finds by falls still can, as 10.10 foresaw (falls traded back and forth are a loop's sign, and the hold on new accounts closes the plainest case). SETTLEMENT 3.9's line is read as superseded by the later word.
- Why first: it is the owner's own later answer, it keeps one rule for a fall in the whole world (a death by a boar and a death by a player leave the same pack), and it keeps "a fall gains nothing" true for the attacker too: the pack holds no more than the outing found.

**B. The attacker takes the finds at once.** The 9.10 line as written: the finds move to the one who caused the fall, in the same step, no pack.
- Cost: two rules for one thing (a pack in the wild, a transfer in the zone), a direct transfer path for a loop with no walk to the pack where a third party could see it, and the attacker risks nothing on the way to the spoils. It also needs the kernel to know "who caused it" for a fall that two players shared, which is a rule of its own.

**C. Nobody: the finds burn.** A fall in the zone burns the outing's finds (ledger reason `forfeit`), and the hunters' board carries the honor alone.
- Cost: the zone loses its reason beyond honor; SETTLEMENT 3.9's "its nodes pay more for the risk" pays into a sink that gives nothing to anyone; the pack rule gains an exception.

Six lines, as sent:

```
To the product owner, a product question in the game:
Asked: who takes the finds when a player falls in the marked zone (the combat frame; W8 left it to this page)
Breaks: SETTLEMENT 3.9 of 9.10 (the attacker takes them) against your answer of 19.10 (a pack anyone may take, first come); one of the two gives
The player would feel: a death in the zone leaves the same pack a boar's would, and the one who felled them is standing next to it
My recommendation: A, the pack rule of 19.10 everywhere, first come; the alternative that keeps the older line is B, the attacker takes them at once, at the price of two rules for one fall
Needed from you: A / B / C
```

### Q3. How a fight reads with no numbers on screen

The question: G77 keeps every chance, level, difficulty, danger and time left off the screen, and the 9.10 difficulty entry keeps the scale invisible; the player's own things keep their counts. A fight needs the player to read two bodies, the foe's and their own. How?

**A. Posture, breath and wounds, as pictures (recommended).** The player's own health stays the one bar it already is (G32), and the player's breath is a second small meter of their own, since the player's own things keep their counts (G77). The foe shows nothing but itself: four postures (standing, pressed, staggered, down) drawn as sprite states, breath as a heave of the body, a wound as blood where the hit landed and a limp afterwards (TONE section 3: small, brief, at the sprite's size). A telegraph is the foe's own wind-up pose for the beats before its move lands, never a mark on the ground or an icon. The weakness opens as a pose too (the boar's head down after the lunge).
- Cost: four postures and one wind-up per move for every foe, which is sprite work the art stream must size; a player who cannot read the pose has no fallback but the rule's plainness, so the check holds every wind-up to one to three beats (section 4.9). Monster Hunter has run on this for twenty years: a monster limps, drools and falls over, and never shows a bar.
- Why first: it is G77 taken at its word, it keeps the foe a thing in the world rather than a widget, and it makes watching the skill, the way the wolf's cone is learned by watching the eyes (G47).

**B. A bar over every head.** Health and breath as bars over the foe and, in the zone, over the other player.
- Cost: G77's spirit goes (the world was to show it); a bar over another player sends their health, which PRESENCE section 4 lists among what is never sent about a player; the foe becomes a widget and the pose stops mattering.

**C. Words under the figure.** "Winded", "Staggered", "Wounded" as a line of text under the foe.
- Cost: a word is a number in disguise, read not seen; G77's "class, tier and station in words" is about things, not states of a fight; a line of words in a half-second beat is unreadable on a phone, and it is one more string per language.

Six lines, as sent:

```
To the product owner, a product question in the game:
Asked: how a player reads the foe's state in a fight with no numbers on screen (the combat frame; G77)
Breaks: nothing if A; B and C bend G77 (no chance, level, danger or time as a number; the world shows them) and B sends another player's health, which PRESENCE never sends
The player would feel: the boar's head drops after its lunge, and that is the opening; their own bar and breath stay their own
My recommendation: A, posture, breath and wounds as pictures, the player's own bar and breath as their own meters; the alternative that keeps the rule is none, B and C each bend it
Needed from you: A / B / C
```

### Q4. A foe's attention: does noise turn a head in a fight?

The question: the owner said no to noise in the demo (REACTIONS section 9, Q1 b) and the retry line names combat, "where reading a foe's attention is part of the fight". Is it?

**A. In a fight, yes; outside a fight, the demo's rule stands (recommended).** A foe in an encounter has a facing and a heed: it watches the player or it is turned. A strike from the side it is not watching lands on an unguarded body (`combat.behind_permille`, double proposed); a strike that lands, or a step onto a noisy tile, turns its head toward the player on the next beat. Outside an encounter nothing changes: the predator on its round is a hazard, its place set by the clock alone, and noise never turns it (G47). The split is the one RULES_REVIEW case 1 already made: a foe is an entity, a hazard is a rule.
- Cost: two readings of "noise" in one world, one for hazards and one for foes, which a player must learn once; in a shared world a foe fought by one player hears only that player's batch (the fight is the player's own, section 4.2), so another player's noise cannot pull it, which is the feature REACTIONS section 10 wanted and also means two players cannot share one creature's attention until foes are shared objects (section 6).
- Why first: without attention a fight has no position play, and "foes that chain moves" (the gap study) need a state to chain from; with attention everywhere, stealth stops being learnable, which is what the owner protected in the demo.

**B. Noise turns every head, hazards too.** The predator on its round hears felling and running.
- Cost: reverses the owner's word of 19.10 and G47's "set by the clock alone"; stealth quests become unreadable; in a shared world one player's noise sets a predator on another's stealth (REACTIONS section 10).

**C. No attention at all.** A foe always faces the player; position never matters.
- Cost: the fight is timing alone; no flank, no reason to step; chained moves have no state to chain from; the zone's fights become a button race.

Six lines, as sent:

```
To the product owner, a product question in the game:
Asked: whether a foe's attention is read and turned in a fight, now that combat is designed (REACTIONS section 9, Q1 b, "revisit with combat")
Breaks: nothing if A, which keeps G47 for hazards; B breaks G47 ("set by the clock alone") and your word of 19.10
The player would feel: a boar that has not seen them yet takes a strike on its flank, and turns; the wolf on its round stays the wolf
My recommendation: A, attention inside a fight only, the hazards untouched; the alternative that keeps the rule is C, no attention, at the price of a fight with no position
Needed from you: A / B / C
```

### Q5. What combat reads from the growth frame

The question: the growth frame (GROWTH.md, its own pull request) is schools, a few active slots, a build a player equips, techniques that combine; its content waits. What does a fight read from it, so that the two pages are built in the right order?

**A. Three things: the build's active slots, the five attributes as small keys, and the thing in the hand (recommended).** A technique in an active slot is a combat verb with its own cost, window and effect from a closed list, so the build is what a player can do in a beat beyond the four base verbs, and two techniques combine when one's `after` opens the other's window. The five attributes stay small and read in the fight: stamina sets the breath cap, agility the reach of a `step` and the beats a stagger lasts, senses how many beats early a wind-up shows, luck the draw of what a foe leaves, carry nothing. The thing in the `hand` slot sets the strike's reach and harm, inside the level's power cap as every worn thing is (G44, R9). Nothing reads the character level directly: the level sets the cap, as it does for work.
- Cost: GROWTH.md must fix the technique's format (cost, window, effect list, `after`) before any foe is written, so the order is growth frame first, then combat content; the hand slot gains a role it does not have today; the power cap formula gains a combat column.
- Why first: it is the owner's direction for the tree read into a fight ("a build a player equips and changes, techniques that combine"), it keeps one growth system (the one scale, SETTLEMENT 3.6; not skills to 99), and it gives the weapon of G44 its place without a second stat block.

**B. Attributes and the hand only; the tree touches work, not fights.** A fight is the four base verbs, the weapon and the five attributes; techniques stay in gathering and crafting.
- Cost: the tree loses the thing the owner named first for it (techniques that combine), and a build changes nothing in a fight, so the schools frame has nowhere to show in the part of the game he called core.

**C. The tree only; the hand is a look.** A fight is the build; what is held is drawn, never counted.
- Cost: G44's "a weapon waits for combat" waits forever; the stall and the workshop (the main sinks) sell nothing for a fight; a second power cap for techniques alone.

Six lines, as sent:

```
To the product owner, a product question in the game:
Asked: what a fight reads from the growth frame (schools, slots, a build, techniques), so the two pages are built in order
Breaks: nothing; it fixes the order of two pages that are both yours
The player would feel: the techniques they equipped are the moves they have beyond strike, guard and step; the thing in hand sets the strike; their stamina is their breath
My recommendation: A, the active slots, the five attributes as small keys and the hand slot, under the one power cap; the alternative that keeps every rule is B, the tree touching work only, at the price of a build that changes nothing in a fight
Needed from you: A / B / C
```

## 4. The kernel shape, so a builder can build

Written for the answers recommended above; a different answer changes the part it names and nothing else. Every name is proposed. Integer math throughout, as the kernel is (kernel-review R1).

### 4.1 Entities: a foe is content

A new content type `foe`, core-only at first (`CORE_ONLY_TYPES` in `schema/src/index.ts`), additive, `FORMAT_VERSION` unchanged:

```
{
  "type": "foe", "id": "core/bank-boar", "title": "Bank boar",
  "level": 2,
  "health": 120,
  "breath": 80,
  "reach": 1,
  "pace_beats": 1,
  "moves": [
    { "id": "swipe", "windup": 1, "reach": 1, "harm_pct": 10, "breath": 15, "open": 1 },
    { "id": "lunge", "windup": 2, "reach": 2, "harm_pct": 20, "breath": 30, "open": 2 }
  ],
  "patterns": [["swipe", "swipe", "lunge"], ["lunge", "swipe"]],
  "weak": { "after": "lunge" },
  "drops": [{ "item": "core/boar-hide", "weight": 60, "qty": 1 }, { "item": "core/boar-meat", "weight": 40, "qty": 2 }],
  "hours": [20, 5],
  "respawn_ms": 600000
}
```

- `level` is on the one scale (SETTLEMENT 3.6): the check holds a foe to the `d` of the area it stands in, within the band, as it holds a recipe.
- `health` and `breath` are points, kept in milli-points in the state like the player's bar.
- A move: `windup` is the beats its pose shows before it lands (1 to 3, held by the check: nobody falls unwarned, G31, and no telegraph so slow that hard is easy); `reach` in tiles; `harm_pct` of the player's health cap, as `bite_pct` is; `breath` the cost; `open` the beats the foe stands open after it, where a strike lands double (`combat.weak_permille`) if the move is the one `weak.after` names.
- `patterns` is a closed list of move orders; the server draws one index when the foe appears (R4), sends it beside the appear list as the appear nodes travel today (DECISIONS 2026-10-20 "A drawn outcome"), and from then on the foe's next move is the pattern's next entry, repeated. The phone plays the fight with no seed.
- `drops` are drawn by the server at the foe's fall, one draw, weights as treasures use them, the player's luck counted as it is in a dig.
- Where a foe stands: in a `foes` block of the map beside `creatures` (DECISIONS 2026-10-19, ambient creatures), one spot per foe id with an optional `round` as predators have; `hours` optional. The check refuses a foe on level 0, inside a town's bounds, inside a camp's safe tiles, or inside a fire's `safe_tiles`.
- The predator (`hazard` prop) is untouched: it never gains moves, never joins an encounter, and the chase stays as P-5 built it.

### 4.2 The encounter in the state

On `Player`, additive, `null` in saves from before:

```
encounter: {
  foe: Id,                 // the foe's spot id, or the other player's presence id in the zone
  at: Tile,                // where the foe stood when the fight began
  since: number,           // the tick of beat 0
  beat: number,            // beats resolved so far
  pattern: number,         // the index drawn at appear (a foe); absent for a player
  foeHealth: number,       // milli-points
  foeBreath: number,
  foeFacing: Facing,
  foeHeed: boolean,        // watching the player, or turned
  foeOpen: number,         // beats the foe still stands open
  breath: number,          // the player's, milli-points
  stagger: number          // beats the player still staggers; the foe's own is read from foeBreath
} | null
```

The player's breath cap: `combat.breath_base + per_point.breath * attrs.stamina`, in milli-points, refilled by `combat.breath_refill` each beat (all of it on `rest`). Health is the one bar (G32): a hit takes from `satiety` through the kernel's `hurt`, by `harm_pct` of the cap, so a fall is the same `fall` the hazards use, with the pack added (4.6).

Why the foe's state lives on the player: against the world's creatures a fight is the player's own, like a node's state is (DECISIONS 2026-10-09, each player gathers their own yield). Two players fighting one boar are two fights with two boars drawn the same; a shared foe is section 6's. In the zone the other side is a player, and both players' states carry the encounter, the server stepping both under one lock (4.5).

### 4.3 The verbs and the beat

One pure function, `fight(bundle, state, verb, foeVerb, beat)`, called once per beat; it returns the next state and the beat's events. The player's verb per beat is one of:

| Verb | Shape | Breath | Effect |
|---|---|---|---|
| `strike` | `{ v: 'strike', dir }` | `combat.strike_breath` | Lands on the foe if it stands within the hand's reach in `dir` and is not guarding that side; harm = the hand's `harm` (bare hands `combat.bare_harm`) times `behind_permille` when the foe's heed is off that side, times `weak_permille` when `foeOpen > 0` after the weak move; a strike into a guard costs the striker `combat.guard_stagger` breath and the guard a third of it |
| `guard` | `{ v: 'guard', dir }` | `combat.guard_breath` | The side `dir` takes no harm this beat; breath does not refill |
| `step` | `{ v: 'step', dir }` | `combat.step_breath` | One tile in `dir` (eight ways, G56's walk rules, never onto a solid or across a level change without a crossing, G68); the step is the only verb that moves `at`, and it spends the movement credit like a report |
| `rest` | `{ v: 'rest' }` | none | Breath refills by `combat.breath_refill` |
| `tech` | `{ v: 'tech', slot, dir }` | the technique's | The technique in that active slot, a verb of the growth frame: its cost, its window (the beats it needs) and its effect from a closed list; two combine when one's `after` opens the other's window |

The foe's verb comes from its pattern: `moves[pattern[beat mod length]]` with its wind-up: for `windup` beats the foe shows the pose and does nothing else, then the move lands if the player stands within its reach ahead of its facing; a foe with no breath staggers like the player; a foe one tile out of reach steps toward the player at `pace_beats`. The foe's heed: on at the start; off when the player stands behind it for a beat without striking; on again the beat after a strike lands or a step onto a noisy tile (a `noisy` flag on ground, proposed, the same the reactions frame reads).

Ending: the encounter ends when a side falls, when the sides stand farther apart than `combat.break_tiles` for `combat.break_beats` beats (the run is always possible), when the player reaches a safe place (G30; a foe never enters one and stops at the line as the chase does), when the player's health reaches zero (a fall), or at an expedition's last bell (G49: the beats before the bell stand, the walk-out follows). A foe left standing keeps its health until `respawn_ms` on its node (`nodes[id].readyAt`), the way a dug spot rests.

### 4.4 The batch against a creature: the phone plays, the server replays

The batch kind reserved by PRESENCE section 6 and the wire of NEXT 18 a, with no new endpoint:

```
{ kind: 'encounter', at: Tile, foe: Id, since: tick, verbs: Verb[] }
```

One such entry carries one whole encounter or its first part; a long fight continues in the next batch with the same `since` and the verbs it adds. The server replays beat by beat: it sets the foe at `at` from the map and the drawn pattern, checks that the player stood within reach at `since` (the four-way walk check of `walkDistance` against the last `at`, as for a `move`), and calls `fight` per verb at `since + beat * beat_ms`. The clock check is the one `checkClock` already makes: the last beat's tick may not run ahead of the game time the anchor allows. The server's events are the fight's: the phone's own run was a prediction that matches when the batch is accepted and is thrown away when it is refused, with the snap-back the remote session already has (a refused walk takes the server's tile back). A refused batch costs nothing: the player stands where they stood at `since`, with the health they had, and the foe is as it was.

What the check refuses, each with a plain message: a `kind` other than the two; more verbs than `combat.max_beats`; a verb not in the list or a `tech` whose slot is empty; a beat past the clock; a foe not standing at `at` at `since` (hours, respawn, level-0 ground); a player not within reach at `since`; a player standing in a safe place; a second encounter while one is open; an encounter inside the zone against a creature while another player's encounter holds the same player.

### 4.5 The zone: the server runs the beats

Inside the marked zone (an area slot with `protection: contested`, the reserved field of SETTLEMENT 3.9), a fight between two players does not travel as a batch. Each player's verb per beat is a `fight` action over `POST /action`: `{ kind: 'fight', encounter, beat, verb }`. The server keeps the pair's encounter as one object with both players' states and resolves beat `b` when both verbs are in, or when `combat.beat_ms` plus `combat.beat_slack_ms` of real time has passed since beat `b - 1`, with `rest` for a side that did not speak. Each resolved beat writes both states under one optimistic lock (both versions in one `compareAndSet`) and goes to both phones as an `fx` frame on the live socket (the frame kind PRESENCE reserved), and as the patch in the next reply.

Rules of the zone:
- A strike at a player outside the zone, or from outside it, is refused; the line is drawn, and readable from inside (W8; the sign at every entry tile, G31).
- An action inside the zone is accepted only from a player whose moves came through the relay (PRESENCE section 5), so no one is teleported into a fight.
- One encounter per player at a time; a strike at a player already in one is refused with "They are fighting." A group's fight is pairs; the `hold` quest kind counts falls per side (QUEST_GRAMMAR 3.7).
- No player harms another in a town, a camp or a house, at any hour (SETTLEMENT 3.9); the zone is never within a town's bounds, never holds a camp slot, and its `d` is at least `combat.zone_min_d` (the check).
- A player who leaves the zone mid-fight ends the encounter as a run does (4.3); the one who stays may not follow across the line with a strike.
- What is sent about the other player is what PRESENCE section 4 sends and nothing more: the pose carries the posture, the figure carries the wound; health never travels (Q3).

### 4.6 A fall and the pack

A fall in a fight is the kernel's `fall` (G33): the outing's finds leave the bag, each quest goes back to the step it stood at, the player wakes in the last town with the bar full. What this frame adds is the pack of 19.10:

```
pack: { at: Tile, items: { item: qty }, until: tick }   // on the world in a shared world, on the player in their own valley
```

- Placed at `from` by the server at every fall (a boar's, a pit's or a player's alike), holding the `lost` list of the fall event, `until` = the fall's tick plus `day_length_ms`. Nothing else goes in: the pack holds no more than the outing found, so dying never pays (10.10, "a fall gains nothing").
- A `take` action for a player standing next to it with room in the bag: `{ kind: 'take', pack: Id, at }`; what is taken joins the taker's outing as a find, so a fall on the way home loses it again. First come, the dead player included (Q2, A).
- The pack is drawn as the body's pack lying in the grass, with no name on it; the death card says "Your pack lies where you died." (TONE section 4).
- The hunters' board (10.10) counts a fall in the zone once a day for a marked player, only when the pack held something, never between friends, a group or one person's accounts, and only between accounts past `new_account_hold`.
- Ledger: nothing moves in gold at a fall; gold stays with the player (G33). The pack that vanishes is a sink of goods, listed in the sinks table of open end 6.

### 4.7 Events and quests

New events, in the kernel's list: `{ e: 'beat', beat, foe }` once per resolved beat (the screen's drum), `{ e: 'hit', by: 'player' | 'foe', harm, at }`, `{ e: 'stagger', side }`, `{ e: 'foe_fall', foe, at, drops }`, `{ e: 'disengage', foe }`, `{ e: 'pack', at, until }` on a fall, `{ e: 'take', pack, items }`. The `hurt` and `fall` events stay as they are. `defeat { foe, count }` counts `foe_fall` events of accepted batches, `hold { place, bells }` counts the side still standing in the place at each bell, `escort { npc, from, to }` fails on the companion's fall by the fall rule of 8.10 (QUEST_GRAMMAR 3.7, SETTLEMENT 3.7).

### 4.8 What a fight may break

A strike or a technique whose effect is `fire` or `break` may break a thing marked `breakable` on the map (open end 1), under the same cap per player per day and with the same repair quest; the name of who broke it is kept. A fight breaks nothing unmarked.

### 4.9 Parameters and caps

A `combat` group in `content/core/params.json`, each with a range and a step as every number has:

| Name | Value | Holds |
|---|---|---|
| `beat_ms` | 500 (250 to 1000) | the beat, in game milliseconds on the kernel tick |
| `beat_slack_ms` | 400 | the zone's real-time wait for a side's verb beyond the beat |
| `max_beats` | 120 | the longest encounter one batch may carry (a minute) |
| `breath_base`, `breath_refill` | 60, 10 | the player's breath cap before stamina, and what a `rest` beat gives back |
| `per_point.breath` | 8 | breath per stamina point (beside `per_point.stamina`, which stays the health cap's) |
| `strike_breath`, `guard_breath`, `step_breath`, `guard_stagger` | 15, 5, 5, 20 | the costs |
| `stagger_beats` | 2 | beats a side with no breath stands open |
| `bare_harm_pct` | 5 | a strike with nothing in hand, of the foe's health |
| `behind_permille`, `weak_permille` | 2000, 2000 | the flank and the weakness |
| `break_tiles`, `break_beats` | 4, 4 | the run that ends a fight |
| `zone_min_d` | 5 | the lowest danger level a marked zone may stand in |
| `pay_per_beat_mg` | 25 | the cap on a foe's drops: the value of the drawn drops, at the trader's price, may not pass `pay_per_beat_mg` times the beats the pattern needs to fell the foe once (the check computes it); so a fight pays like a hard action of its own length and Theorem 3 of the kernel review keeps its bound |

What else caps what one encounter can pay: one pack per foe and the foe's `respawn_ms` on the player's own node (farming a boar is throttled like a bush); a drawn drop never passes the rarity budget of the area (`rarity_budget_permille`); drops join the outing and a fall loses them; the trader's day cap (`trader_day_cap`) is where hours turn into gold whatever the source.

The check (section 8 of GAME_RULES gains rows): every move has a wind-up of 1 to 3 beats; every pattern has at least one open beat per cycle and a cycle's total harm is below the health cap of a player at the foe's level, so a player at level with no technique can win by reading the pattern (the "hard and possible" of G34's run, restated for a fight); a foe's level fits its area's `d`; no foe on level 0, in a town, on a camp or inside a fire's safe tiles; a zone's `d` at or above `zone_min_d`, a sign at every entry tile, no town and no camp slot inside; a `defeat` step's foe stands within the quest's area; a drop table's value under `pay_per_beat_mg` times the kill's beats.

### 4.10 What the screen reads (for the art and the client, not decided here)

The beat as a sound and a small motion of both figures; the foe's wind-up pose, its open pose, its four postures; blood where a hit lands at the sprite's size and a limp after (TONE); the player's own bar and a breath meter of their own; the death card of TONE section 4 with the pack line; the zone's line drawn as stones or banners and its sign; the pack in the grass. A direction decision (the frame of a fight on screen) goes to the owner as two or three phone-size stills before a sprite is drawn, as every direction does (AGENTS.md).

## 5. Rule lines proposed, in the form GAME_RULES uses

Numbers provisional (G78 onward, after G77 of RULES_REVIEW); the second rules pull request assigns them. None is the owner's word until his answers of section 3 are in DECISIONS.

- **G78 A fight is read, not rolled.** A fight is an encounter: two sides, beats of `combat.beat_ms` on the kernel's clock, one verb a side a beat (strike, guard, step, rest, or a technique of the build), breath that every verb but rest costs and that a stagger follows. A creature's moves follow a pattern drawn once when it appears, so the fight is a function of the two sides' verbs, and nothing inside it is rolled; what it leaves is drawn once at the end.
- **G79 A foe is an entity; a hazard stays a rule.** A foe stands in the wild (danger 1 and up) and in expeditions, never in a town, on level-0 ground, at a camp or inside a fire's safe tiles; it never follows into a safe place, and the run always ends a fight. The predator, the pit, the trap and deep water are hazards (G34) and never foes.
- **G80 The marked zone is the only place a player can hurt another.** A zone lies far out and high on the scale, with a sign at every way in and its line readable from inside; entering is the consent. Inside it a fight between players runs on the server beat by beat, one encounter per player at a time, and only for players whose moves came through the relay. Outside it no action of one player takes health from another.
- **G81 A fall in a fight is a fall, and it leaves a pack.** At zero health the player falls by G33 and wakes in the last town. The outing's finds lie where the body fell as a pack any player next to it may take, first come, the dead player included, and the pack is gone a game day later. Nothing more is taken: not a tool, not a worn thing, not what the player made, not gold, and nothing from a player who is away.
- **G82 A fight pays by its time, and no more.** What a foe leaves is worth at most `combat.pay_per_beat_mg` for each beat its pattern needs, at the trader's price, inside the area's rarity budget; a felled foe rests for its `respawn_ms` on the player's own node; the drops join the outing and a fall loses them.
- **G83 A fight is read from the figure, never from a number.** The foe shows its state as posture, breath and wounds, its coming move as a wind-up pose of one to three beats, and its weakness as a pose; no bar, number or word stands over it. The player's own bar and breath stay their own meters.
- **G84 A foe's attention is part of the fight.** In an encounter a foe watches or is turned; a strike on the side it does not watch lands harder, and a strike that lands or a step on noisy ground turns its head. Outside an encounter G47 holds whole: noise never turns a predator's head.

The review checklist (GAME_RULES section 7) gains one question: "Can a player at the foe's level, with no technique, win by reading the pattern, and is the run always open?"

## 6. The order, and what this page does not do

- Built after NEXT 18 (accounts, the server) and NEXT 19 (the first ring), before live presence, with free movement first (DECISIONS 2026-10-19, "G35 is the demo's rule", proposed). The pack and `take` come first, with the fall (open end 2 names this frame as its builder); the foe type, `fight` and the batch second; the zone last, after the relay (PRESENCE build b), since the zone refuses what did not come through it.
- The growth frame fixes the technique's format before any foe is written (Q5); the first foes are the boar and a thief with one weakness each, in the first ring's danger-1 and danger-2 areas; the road thieves of the boards entry (CR-40) take the foe type.
- Not done here: the content of foes beyond the example; the techniques' list and effects (GROWTH.md); a shared foe two players fight at once (section 4.2 keeps a creature's fight the player's own; a shared one is a world object with its own lock and comes with the zone's machinery, if the owner wants raids); companions in a fight (SETTLEMENT 3.7's `companion` falls by the 8.10 rule); the stills of a fight on screen (a direction decision of its own); the words on the death card beyond TONE's; the numbers' tuning, which a playtest moves inside the ranges.
- Pages this frame touches when its rules pull request lands: SETTLEMENT 3.9 (the attacker's finds line, read by Q2's answer), G33's "nothing left in the world" (the pack, after #223), G44 (the weapon's role), G47 (the retry line answered), QUEST_GRAMMAR 3.7 (the counting of `foe_fall`), PRESENCE section 6 (`encounter` and `fight` named), GRUNT CR-12 and CR-40 (the weapon slot and the road thieves), the kernel review's sink table (the pack).

## Sources

- Dark Souls (FromSoftware, 2011) and Sekiro (2019): stamina and posture as the stance of both sides; a stagger that cuts both ways.
- Monster Hunter (Capcom, 2004 onward): no health bar on a monster; it limps, drools and falls, and the hunter reads it.
- For Honor (Ubisoft, 2017): a guard with a side; a strike into the open side.
- RuneScape's Wilderness (Jagex, 2001 onward): a marked zone with a line, entered knowingly, where a fall drops what was carried for anyone to take.
- Ultima Online (1997) and its 2000 split into a world without fights between players: what a zone without consent costs a game.
- Valve, Source Multiplayer Networking, and Gaffer On Games on deterministic lockstep: why the zone's fight runs on the server (cited in DECISIONS 2026-10-20, "A drawn outcome").
- Bettner and Terrano, "1500 Archers on a 28.8" (2001): what lockstep costs, cited by REACTIONS section 10 and kernel-review 6e.
