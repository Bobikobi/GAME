# Rules review: every rule tagged for the open world

Status: a review for the owner, 19.10.2026. Nothing on the rule pages is deleted or reworded by this document. The owner approves the table line by line; a second pull request applies the approved lines. `pnpm rules` (section 6) prints the current word on every rule from `DECISIONS.md` and the rule pages, with superseded lines folded away, so the pages can be read as they stand today.

Inputs read before a line was written: `GAME_RULES.md`, `OPEN_WORLD.md`, `SETTLEMENT.md`, `STORY.md`, `REACTIONS.md`, `QUEST_PATTERNS.md`, the kernel review (section 3, R1-R12), `GRUNT.md` (the CR table), `NEXT.md` sections 18, 19 and 21, every entry of `DECISIONS.md` up to the 19.10 entries, and `tools/src/check.ts` with the checks it calls.

## 1. How to read the table

Every rule gets one line with seven columns.

- **id**: the rule's id on its page. The five pillars of GAME_RULES section 1 are P1-P5. The shared-world lines of the 10.10 entry, which have no id, are SW1-SW6 here. The ids proposed for the second pull request are in section 5.
- **pillar**: the proposed pillar the rule hangs under (section 2), A to E.
- **scope**: where the rule holds. `demo` is stage 1 as shipped; `foundation` is accounts, the server and the first ring; `open world` is the generated ground; `shared world` is one world state for many players; `whole game` is all of these.
- **holds at scale**: whether the rule still means something on a chunk nobody drew by hand, with many players, and in both doors. `per chunk` means the rule is a property a check can test on any chunk, the way G62 is. `no` names what breaks.
- **enforcement**: `checked` names the file; `code` means the kernel or the client holds it with no content check; `prose` means nobody checks it, and the line gives a one-line check idea when one exists.
- **verdict**: keep, narrow (to a named scope), merge (into a named rule), rewrite (the sentence is given in section 4 or in the line), delete.
- **why**: one line.

Both doors: a rule checked on content or held by the kernel holds in both doors by construction, since both doors run the same kernel on the same bundle. The column says "both doors" only where a rule touches what a client draws or plays (G13, G14, G24-G27, G29, G31, G32, G46, CR-17); for those the 3D door owes a twin, and the e2e is the check.

## 2. The proposed pillars

Five pillars, A to E. Every kept rule hangs under one of them (the table's second column). The present pillars P1-P5 map onto them; P2 and P4 fold into B.

- **A. Every minute pays.** No stretch of play is empty: at most ninety seconds between pays, on the hand-made valley and on every generated chunk. The check is G62, per chunk. Rules: P1, G5, G11, G16, G43, G55, G62, G63, G69.
- **B. The world answers by rules, learned by watching and never told by a number.** A hazard, a fire, a predator, a reaction, danger and safety are rules the eyes can read; the screen shows the world, not its values. Rules: P2, P4, G7, G8, G9, G13, G14, G18-G21, G24-G27, G30, G31, G32, G34, G47, G48, G53, G64, G66, G68, S3 (settlement), CR-17, the reactions frame.
- **C. Every task is a question, never an answer.** A quest asks, a riddle hides, a choice is real, a clue fits two readings, and no hint points at the answer. Rules: P3, G1, G2, G3, G6, G12, G17, G23, G36, G37, STORY S1-S6, the quest designer's hand rule.
- **D. Effort is never wasted.** What a player did stays done: a miss turns up something, a fall costs only the outing, a reward changes what the player can do, a gate opens by deed, nothing is sold that work earns. Rules: P5, G4, G10, G15, G28, G33, G38, G40-G45, G49, G52, G58, G65, R5, R6, SETTLEMENT S1, S1b.
- **E. One world, the same for everyone, and nobody's act closes it for another.** The same seed, the same hour, the same prices and the same rules for every player; a player's act may open things for others and never closes, blocks or takes what another can reach, outside the areas a player enters by choice. Rules: R1-R4, R7-R12, G22, G29, G39, G46, G50, G56, G57, G59, G67, SETTLEMENT S4, SW1-SW6, CR-93, the REACTIONS section 10 line.

Not a pillar: "pixel first, two doors" (18.10). It is a build order, not something a player feels, and a rule that holds only in one door is a bug, not a scope. Recommended: one line in the frame of GAME_RULES ("Every rule holds in both doors; the kernel is shared, and a client-side rule has an e2e twin in the 3D door"), and no line under each rule. The "both doors" note in the table's fourth column marks the rules that need the twin.

## 3. Rules that contradict each other

Each pair is a collision in the pages as they stand today. The case number points to section 4, where the line and the recommendation are.

1. **G30 against G33.** A fire anywhere outside the town is a safe place while it burns (19.10), and G33 says an outing runs from safe place to safe place. Read together, lighting a fire banks the outing's finds anywhere. Case 3.
2. **G30 and G48 against G31.** G31 allows the lantern one box a night; the fire warns before it goes out (G30, G48). Two warnings a night, unless the fire's warning is drawn and never a box. Case 3.
3. **G30 against SETTLEMENT S2.** S2 still carries the tent of 9.10 as its first answer and the 19.10 supersession as a second paragraph. Case 3 and case 9.
4. **G35 against the 19.10 combat entry.** G35 says "no fighting in the demo"; the combat rule is spread over three DECISIONS entries (9.10 "No combat yet", 10.10 "a hazard is escaped, road thieves wait for weapons", 19.10 "G35 is the demo's rule"). Case 1.
5. **G47 and G48 against #209.** The page texts say "set by the clock alone" and "nothing makes it burn longer"; the owner's 19.10 answers add fog and rule out noise and weather. Case 2.
6. **G50, G54, G55 and G58 against "the world has no end" (17.10).** The 1024-tile grid, the stitched region files, the grid's edge and crossings as the only way on are overruled by the entry, and the page says so in its header only. Case 4.
7. **G54's fog band against G66 and CR-103.** A border drawn as mist collides with "mist is not a border" and "no visible borders". Case 4.
8. **G65's tent against the 19.10 fire.** G65 and D4 reason about "the player's tent"; the tent is dropped. Case 4 and case 6.
9. **D4 against the 19.10 fire entry.** The fire entry answers CR-102, and NEXT 21 reads D4 as answered by it; but a fire is never lit during a chase, so it cannot be the safe place G34's run check needs. D4 is still open. Case 6.
10. **G22 and G7 against D3 (16.10).** "The valley's own names" and the valley as the one place; D3 option 3 makes the valley the first region of a named land and orders G7 and G22 rewritten to "the region's". Not done yet. Case 10.
11. **G6 against #214.** The reactions wave added "no cue within two tiles of a riddle's answer" as a test; G6's text does not carry it, and creatures (19.10) and marks (phase C) will need the same line. Case 7.
12. **CR-17 against the creators' tools and the attributes screen.** "No chance, level, difficulty on screen" sits in a task table, while the sheet, the hub, `pnpm values` and the hint reach show numbers to creators and to players. Case 8.
13. **Two S families.** STORY S1-S6 and SETTLEMENT S1-S5 share ids; DECISIONS lines such as "S2" or "S3" cannot be resolved without the page name. Case 9.
14. **G42 and G58 against the holiday exception.** "Never a timer", "never by date", and a holiday's reward that is "that year's only" (10.10), written as an exception under G28 only. Case 11.
15. **G47's "never in the demo" against the shared-world reason.** Noise is refused for the demo on the page, but REACTIONS section 10 gives a reason that holds in every shared world: one player's noise would turn a predator onto another player's stealth. Case 2.

## 4. The cases the brief named

Each case: what collides, one line, one recommendation. A sentence in quotes is the proposed rule text.

**Case 1. G34, G35 and combat after the foundation.** The 9.10 line "no gear against a hazard, no stronger lantern" is a hazard rule: it says what answers a hazard, and the answer stays the run whether or not combat exists. It belongs to G34 and stays there. Combat is a separate class of thing: a foe is an entity that is fought, a hazard is a rule that is escaped, and no hazard ever becomes a foe. Recommended: G35 becomes one sentence that carries the three entries: "Nothing is fought in the demo. Combat comes after the foundation (accounts, the server, the first ring): in the wild and in expeditions, never in a town, and never as the answer to a hazard (G34)." Scope: the first sentence demo, the second whole game. The three DECISIONS entries stay as history; the rules page is the one place that states the rule.

**Case 2. G47 and G48 after #209.** One rule each, with the answer inside the sentence, never a rule plus a list of exceptions: an exception list grows, a sentence with its clause is what the check tests. Recommended G47: "A watched road is a rule the eyes can read: a predator's place and eyes follow the clock and the weather, never the player's noise, and its round never touches safe ground." Recommended G48: "A fire is kept by hand, with wood alone: nothing bought, made or weather-born makes it burn longer or shorter; its wood for a night follows the area's danger, never shown as a number, and it warns only while it needs wood." The "never the player's noise" clause is whole game, not demo: REACTIONS section 10 gives the shared-world reason, and the combat retry is a DECISIONS line, not a scope on the page.

**Case 3. G30 as changed by #208 against G31, G33, G48 and SETTLEMENT S2.** G30 today holds six rules in one paragraph (level-0 ground is safe; a camp is safe while its fire burns; a guest with a deal; a fire anywhere with its two refusals; the hunters' hours; the wolf's day), and that is why it collides with its neighbours. Recommended: split it. G30 keeps safety alone: "Safe is read from the ground and the fire, never set by hand: a town and level-0 ground are safe at every hour, a fire of one's own is safe while it burns, another's camp is safe only for a guest with a deal, and the hunters act after dark and in the mist, outside safe ground." The fire's lines (anywhere outside the town, never lit during a chase or inside a round, wood by danger, dims and warns) move into G48 (case 2). The wolf's day moves into G47. Against G33: a fire is safe from the hunt but is not home, so an outing does not end there; see G33's line in the table (its one open question for the owner, question 3 at the end). Against G31: the fire warns by its flame and one line, never a box, so G31's one box a night stays the lantern's. Against S2: S2 shrinks to one sentence that cites G30 and G48 (case 9).

**Case 4. OPEN_WORLD G50, G54, G55, G58 against "the world has no end" (17.10), with G59 and G60.** Each rule in one line:
- G50: the grid cap and the stitched origin are gone; what stays is "the hand-made valley sits at the centre of ground generated from one seed, the same for every player, and its origin never moves". Rewrite.
- G54: the three border kinds are gone with the stitched map; the fog band collides with G66. Delete; the one surviving thought ("ground that cannot be walked looks so and says so") joins G66.
- G55: "a far bank is a promise" survives as a property any chunk can be tested on: "Nothing is drawn past the walkable that the feet cannot reach in the end, and nothing promises what is not built." The 17.10 smoke column is this rule's first instance. Rewrite.
- G58: "gates open by deed, never by date" is a whole-game property and holds on generated ground; only "crossing" narrows it. Keep, with "a gate, wherever the story puts one" for "crossing".
- G59: holds whole; the one-time exception (18.10) is a decision, not a rule, and leaves the page after the re-anchor. Keep; strip the italic then.
- G60: it is D5's option 1 written as a rule before the owner picked. Narrow: move it under D5 as the recommended option; it becomes a rule when D5 is answered.

**Case 5. REACTIONS section 10, "a player's act may open things for others, but never close or destroy them."** Weighed against the fire words (a wildfire the seed lights, fought together, pays; a fire a player lights burns only what it was lit in; fire on purpose waits) and "nobody blocks a way" (10.10): all three are instances of one rule, and the rule is already pillar E's second half. Recommended wording: "What one player does never takes from another: a player's act may open a way, a place or a node for others, and never closes, blocks, burns or empties what another player can reach. Only the world closes a way. The areas between players, which a player enters by choice, are the one exception." What it forbids: a fire that spreads from a player's hand (fire on purpose, when it comes, is a retry of this line, not an exception written now); a placed thing on a way (already `place_clear_tiles`); a node emptied for others outside the areas between players (already each player's own yield); a lapse or a loss caused by another player's act. What it allows: opening a crossing for all, a trunk over a stream, a mark in mud, fighting a wildfire together, and competition inside the areas between players.

**Case 6. D4, the safe place far from a town.** The 19.10 fire does not answer it: a fire is never lit during a chase, so a hunted player cannot run to one, and the static check (hazards.ts, a safe place within a run of every hunting tile) cannot count on a fire. Recommended: D4 option 1 as OPEN_WORLD proposes, a level-0 pocket stamped on the generated ground, named in content and excepted by the order check (G64). The fire is the stay a player plans; the pocket is where the run ends.

**Case 7. G6 against #214.** "No cue within two tiles of a riddle's answer" is one instance of a rule that creatures (19.10) and marks (phase C) will need too. Recommended: a general clause on G6: "No hint the world draws (a cue, a creature, a mark, a light) stands within two tiles of a riddle's answer unless the riddle itself placed it." The check: the reactions test generalized in `tools/src/reactions.ts` to every drawn-hint kind, against the riddle answers of the bundle. It is a property on any chunk.

**Case 8. CR-17, no numbers on screen, against the creators' and players' need to read values.** CR-17 is closed and its row is gone from GRUNT; the rule lives only in the 9.10 crafting economy entry and in SETTLEMENT 3.5 and 3.6, which is one more reason to give it a line on the rules page. The rule concerns the play screen and the world's hidden values: chance, level, difficulty, danger, time left, the wood a fire needs. It never concerned the player's own things: the bag's counts and gold are the player's and stay numbers. Creators read values in the tools (the sheet, `pnpm values`, the hub), which are not the play screen. Recommended: promote CR-17 from a task row to a rule under pillar B: "The play screen never shows a chance, a level, a difficulty, a danger or a time left as a number; the world shows them, and the screen shows class, tier and station in words. The player's own things keep their counts." Check idea: an e2e that greps the rendered HUD and dialogue text for digits outside the bag and the gold line.

**Case 9. The two S families.** Recommended: STORY keeps S1-S6 (they are rules). SETTLEMENT's S1, S1b, S2, S3, S4, S5 become ST1, ST1b, ST2, ST3, ST4, ST5 (they began as questions, and three became rules). The old id stays in brackets on the page for one release, and `pnpm rules` resolves both. S2 is rewritten to one sentence under its new id: "ST2. The town is safe at every hour and its street heals as a camp does; outside the town a fire the player builds is the camp (G30, G48)."

**Case 10. G22 and G7 after D3.** The 16.10 decision orders both rewritten to "the region's"; not done. Recommended: G22 "Plain words, all ages, the region's own names", G7 unchanged in text ("Light means light") with "the valley" read as "the region" in its body, in the second pull request.

**Case 11. The holiday exception.** G42 ("never a timer") and G58 ("never by date") are property rules; a holiday reward that is that year's only (10.10) is a date gate on content, not on a place or a node. Recommended: the exception stays written once, under G28 where it is, and G42 and G58 each get "(a holiday's content is the one exception, G28)" so a reader of either does not find a contradiction.

**Case 12. "Pixel first, two doors".** Not a pillar, not a line under each rule; one frame line and the "both doors" marks in the table (section 2).

## 5. New ids proposed for the second pull request

- G70-G75 for the shared-world lines SW1-SW6 of the 10.10 entry, which have no home on a rule page today (the table names each).
- G76 for the REACTIONS section 10 line (case 5).
- G77 for CR-17 as a rule (case 8).
- ST1-ST5 for SETTLEMENT's questions (case 9).

## 6. The table

| id | pillar | scope | holds at scale | enforcement | verdict | why |
|---|---|---|---|---|---|---|
| P1 Every minute pays | A | whole game | per chunk, through G62 | prose; G62 not built; richness.ts warns on a window | keep | the ninety-second ceiling is the one number that survives a generated world (17.10) |
| P2 Doing beats reading | B | whole game | yes | prose; G8 and G9 carry it | merge into pillar B | it is the "watching" half of B |
| P3 Every task is a question | C | whole game | yes | checked in part: play.ts (G2, G17) | keep | pillar C as written |
| P4 The world is the interface | B | whole game, both doors | yes | prose | merge into pillar B | it is the "world answers" half of B |
| P5 Effort is never wasted | D | whole game | yes | prose; G4, G15, G33 carry it | keep | pillar D as written |
| G1 Every quest asks a question | C | whole game | yes, per quest file | prose; idea: a quest with no find, riddle or choice step is flagged by `pnpm quests` | keep | the reason G2 exists |
| G2 No repeat-the-verb after the opening | C | whole game | yes, per quest file | checked: play.ts | keep | |
| G3 At most three steps visible at once | C | whole game | yes | prose (CR-4); idea: count a quest's steps not hidden behind an earlier step, over three fails | keep | the check is cheap and CR-4 already asks for it |
| G4 A reward changes what the player can do | D | whole game | yes | checked: play.ts | keep | |
| G5 No empty leg | A | whole game | per chunk: a quest leg is a path, and G62's half-cap warning tests it | prose; idea: G62's warning run on each quest leg (starts.ts knows the legs) | keep | the generated ground makes empty legs likely, so the check matters more now |
| G6 A riddle has a catch and a reveal | C | whole game | yes; the #214 clause is per chunk | checked in part: reactions test (cue within two tiles) | rewrite (case 7) | the drawn-hint clause belongs on the page, not only in a test |
| G7 Light means light | B | whole game (per region) | yes | prose | keep; "the valley" read as "the region" (case 10) | |
| G8 Every read pays | B | whole game | yes | checked: play.ts (orphan note) | keep | |
| G9 Reading is never the task | B | whole game | yes | prose; idea: no quest step whose only act is a read | keep | |
| G10 A build changes play | D | whole game | yes | checked: play.ts | keep | |
| G11 Felt within a minute | A | whole game | yes | prose; idea: the first use of a reward lies within sixty seconds of the reference player's walk from where it is given | keep | hard to check, easy to playtest |
| G12 A choice is real | C | whole game | yes | prose; idea: two options of one choice never share the same `opens` and reward | keep | |
| G13 Every action answers | B | whole game, both doors | yes | code: client; idea: the e2e asserts a line or sound per verb | keep | the 3D door owes the twin |
| G14 Two lines, one box | B | whole game, both doors | yes | checked: play.ts (G14/G21) | keep (brief: as is) | |
| G15 A miss turns up something | D | whole game | yes | waits on CR-60 (miss tables) | keep; build the check | the one checked rule with no check yet |
| G16 A session ends on a mark and leaves a door | A | whole game | yes | prose; idea: every quest's last step names a place or opens one | keep | |
| G17 No two in a row of the same type | C | whole game | yes | checked: play.ts | keep | |
| G18 Getting an item is not one motion | B | whole game | yes | checked by `t_min_ms` in check.ts (R12) | merge into R12's floor | the floor is the rule; the sentence restates it |
| G19 Every line does one job | B | whole game | yes | prose | keep | |
| G20 One voice per character | B | whole game | yes | prose; idea: a banned-word list per voice, linted over the character's lines | keep | |
| G21 The player pulls | B | whole game | yes | checked: play.ts | keep | |
| G22 Plain words, all ages, the valley's own names | E | whole game | no: "the valley's" fails at region two | prose; the words ladder of 10.10 | rewrite: "the region's own names" (case 10) | D3 ordered it |
| G23 Talk choices are real | C | whole game | yes | prose | merge into G12 | one rule about choices, two sentences today |
| G24 Every beat has a sound | B | whole game, both doors | yes | prose; idea: every verb in the sound map, a test over the map | keep | |
| G25 The rare find is heard | B | whole game, both doors | yes | prose | merge into G24 | a clause of G24 |
| G26 Music is the clock | B | whole game, both doors | yes | prose | keep | |
| G27 Nothing important lives only in sound | B | whole game, both doors | yes | prose; idea: reactions.ts refuses a cue with a sound and no shape | keep | the reactions schema already pairs shape and sound |
| G28 No dark patterns | E | whole game | yes | prose | keep (brief: as is) | holds the holiday exception (case 11) |
| G29 Playable by more people | E | whole game, both doors | yes | prose; idea: an e2e with the motion group off | keep | |
| G30 The town and a burning camp are safe; the night and the mist hunt | B | whole game | per chunk: safe read from level and fire (dec 1141), hazards outside safe ground | checked: hazards.ts (level-0 safe, a safe place within a run); fire.test.ts | rewrite: split (case 3) | six rules in one paragraph collide with G31, G33, G48 |
| G31 Nobody falls unwarned | B | whole game, both doors | yes | prose; idea: every hazard kind names a warning cue and distance in content | keep; the fire warns by flame and a line, never a box (case 3) | |
| G32 Health is the one bar | B | whole game, both doors | yes | code: kernel (P-5c) | keep | |
| G33 A fall is clear, and it costs the outing | D | whole game | mostly; "safe place to safe place" is ambiguous with a fire anywhere | code: kernel fall(); tests | narrow: "an outing ends at a chest of the one store; a fire of one's own is safe from the hunt and does not end an outing" | question 3 for the owner |
| G34 A hazard is a rule, not a roll; the answer is a run, never gear | B | whole game | per chunk: a safe place within a run of every hunting tile | checked: hazards.ts | keep; the 9.10 gear line is G34's (case 1) | |
| G35 No fighting in the demo | - | demo, then whole game | n/a | prose | rewrite: one sentence (case 1) | three entries, one rule |
| G36 An expedition is the valley's dungeon | C | whole game | yes, per expedition; combat foes are entities, not hazards, so its "no hazard inside" row holds | checked: play.ts; expedition.test.ts | keep; "the valley's" read as "a region's" | |
| G37 An expedition is never the only road | D | whole game | yes | checked: play.ts | keep | |
| G38 Crafting is a road, not the road | D | whole game | yes | prose; R7's reachability from input-free activities covers the economic half | keep | |
| G39 Power is never sold | E | whole game | yes | checked: check.ts (premium marker, two funds) | keep | |
| G40 A craft can miss, and a miss keeps something | D | whole game | yes | checked: check.ts | keep | |
| G41 Two ladders | D | whole game | yes | checked: check.ts | keep | |
| G42 Rare is capacity and gates, never a timer | D | whole game | yes | checked: check.ts | keep; cross-reference the holiday exception (case 11) | |
| G43 A long recipe is a chain of short steps | A | whole game | yes | checked by `max_action_ms` in check.ts (R12) | merge into R12's ceiling | the ceiling is the rule |
| G44 Worn things help work, a little | D | whole game | yes | checked: check.ts (error) | keep | |
| G45 New materials join old recipes | D | whole game | yes | checked: check.ts | keep | |
| G46 Menace with a limit | E | whole game, both doors | yes | prose; idea: a sprite and word list the check refuses | keep | |
| G47 A watched road is a rule the eyes can read | B | whole game | per chunk: round tiles never touch safe tiles | checked: hazards.ts; stealth.test.ts | rewrite (case 2) | folds fog and noise in; the wolf's day joins it |
| G48 A fire is kept by hand | B | whole game | yes | checked: hazards.ts; fire.test.ts | rewrite (case 2) | folds weather, the fire anywhere and the wood-by-danger in |
| G49 The last bell walks you out | D | whole game | yes | code: kernel; expedition.test.ts | keep | |
| G68 A rock face blocks both ways | B | whole game | per chunk: a level step without a crossing is refused | code: kernel world.ts; idea: reach.ts proves every level has a crossing within reach | keep | the generator must place crossings; the check catches a chunk without one |
| G69 Paths wind | A | whole game | per chunk: no straight run over 8 tiles (12 on a bridge), one run in five | prose; idea: a straightness pass over generated paths, the G62 model | keep; build the check with the generator | |
| G50 One grid, the valley first | E | open world | no: the 1024 cap and the stitched origin are gone (17.10) | prose | rewrite (case 4) | |
| G51 Regions are authored, chunks are cut | E | open world | partly: region files gone, chunks stay | prose | rewrite: "The world is cut in 64 x 64 chunks; authored places are stamped on generated ground; nobody writes a chunk by hand" | |
| G52 Saves never land in the wrong place | D | foundation, open world | yes: a property of any save or server state | prose; idea: a test loads a save on a tile now solid and asserts placement with no fall counted | keep; "a save or the server's state" | the server (18.10) does not change it |
| G53 Every edge is closed and readable | B | open world | partly: "every edge" went with the stitched map; "never a silent wall" holds | prose | merge into G66 | one rule about what cannot be walked |
| G54 Three border kinds | - | open world | no (17.10; the lip waits for an edge that no longer exists) | prose | delete | its one surviving thought goes to G66 |
| G55 A far bank is scenery now and a promise later | A | open world | per chunk, as rewritten | prose; idea: every far prop or smoke column names the place behind it in content | rewrite (case 4) | |
| G56 Borders hold in the kernel at stage 2a | E | foundation | yes: a tile breadth-first move check; free movement keeps the kernel on tiles (18.10) | prose until 2a; idea: a kernel test refuses a far report | keep | |
| G57 The world grows by region files through the loop | E | open world, shared world | partly: files gone; "never removed, only outward" holds | prose | rewrite: "The world only grows: a shipped place is never removed, and the community adds places by pull request in the core's frame" | |
| G58 Gates open by deed, never by date | D | whole game | yes: no gate reads a calendar | prose; idea: the check refuses any gate condition that names a date or a season | keep; "a gate, wherever the story puts one" (case 4) | |
| G59 Growth never moves the opening | E | whole game | yes: leg lengths against a lock | prose; the world lock is not built; idea: starts.ts measures the opening legs against a committed lock | keep; the exception leaves the page after the re-anchor | |
| G60 Walking is priced from the nearest town, if D5 picks it | D | open world | yes if picked, per source | prose; values and R11 would check it | narrow: under D5 as option 1 | not a rule until D5 is answered |
| G61 Shortcuts, fast routes and other gates come later | - | open world | n/a | prose | delete as a rule; a note under D5 and dec 1346 | it is a list of later shapes, not a rule |
| G62 Pillar 1 gets a static check | A | whole game | per chunk: the model | not built | keep; build with the first ring | |
| G63 Entering pays | A | open world | yes | prose; idea: a kernel test that first entry adds to the seen list once and a fall never repeats it | keep | |
| G64 Danger rises with distance, area by area | B | open world | per chunk: d within one band of distance | not built (CR-38) | keep | the generator's own check |
| G65 A fall never costs more than a set walk | D | open world | per chunk: every walkable tile within `fall_walk_steps` of a town | not built | keep; drop its tent lines (19.10) | |
| G66 Mist is not a border | B | whole game | per chunk: no walkable tile wears a border look | prose; idea: a tile pass per chunk | keep; absorbs G53 and CR-103 | |
| G67 Additive only; FORMAT_VERSION stays 1 | E | foundation | yes | checked: schema tests | keep; "the schema grows by optional fields only" | |
| D1 How far the eye reaches, the edge's look | - | open world | - | - | close: answered 17.10 (one smoke column per region); the lip is gone with the edge | write the answer into G55 and G66 |
| D2 May a creator's request ask for new ground | - | shared world | - | - | keep open: creators by pull request (18.10); who "users" are and whether the valley may change wait for stage 3 | |
| D3 May a fold bring ground past the edge | - | whole game | - | - | close: option 3 (16.10); G7, G22 and STORY 35, 38 still owe the rewrite | case 10 |
| D4 A safe place far from a town | - | open world | - | - | keep open; recommend option 1, the level-0 pocket (case 6) | the fire does not answer it |
| D5 How walking enters V | - | open world | - | - | keep open; recommend option 1, the banded walk term (G60) | |
| R1 Event time, pure step | E | whole game | yes | checked: time-skip property test, lint | keep (brief: as is) | |
| R2 Safe integers | E | whole game | yes | checked: lint, fuzz, three engines | keep (as is) | |
| R3 Canonical order and bytes | E | whole game | yes | checked: ten load orders | keep (as is) | |
| R4 Draws are inputs | E | whole game | yes | checked: unrelated-entity test, no seed to a client | keep (as is) | |
| R5 Pinned versions, forward only | D | whole game | yes | checked: golden saves on every pull request | keep (as is) | |
| R6 One activity format | D | whole game | yes | checked: schema, ledger conservation | keep (as is) | the plot refund exception stays paused with houses |
| R7 The value table is a certificate | E | whole game | yes | checked: CI recomputes V | keep (as is) | |
| R8 Shop invariant | E | whole game | yes | checked: full grid, trade search | keep (as is) | |
| R9 Rate clamp | E | whole game | yes | checked: property test | keep (as is) | |
| R10 Usage counted by the kernel | E | shared world | yes | checked: shares sum, cap | keep (as is) | |
| R11 Drift budget | E | whole game | yes | checked: lock diff, merge queue | keep (as is) | |
| R12 Parameters are bounded data | E | whole game | yes | checked: parameter file diff (CR-3: step and cooldown not read yet) | keep (as is) | G18 and G43 hang here |
| S1 The narrator never states the past (STORY) | C | whole game, per region | yes | prose; idea: a lint for a narrator line in the past tense with no speaker | keep | the 19.10 words sweep applied it by hand |
| S2 Every claim about the past has a speaker | C | whole game | yes | prose; STORY section 5 says the check can read the source; idea: a required `speaker` on a past claim | keep | |
| S3 The bones are few and anyone can see them | C | whole game | yes | prose | keep | |
| S4 Every clue fits at least two readings | C | whole game | yes | prose; idea: a clue names two beliefs | keep | |
| S5 No belief is evil, and none is a joke | C | whole game | yes | prose | keep | |
| S6 A season answers one question and opens one | C | whole game, per region | yes | prose | keep | |
| S1 Absence in a shared town (SETTLEMENT) | D | shared world | yes | prose; paused with houses | keep paused; id ST1 (case 9) | |
| S1b What absence costs | D | shared world | yes | prose; paused | keep paused; id ST1b | |
| S2 The camp and the street | B | whole game | yes | prose | rewrite to one sentence; id ST2 (case 9) | superseded in part on 19.10 |
| S3 The internal difficulty scale | B | whole game | per chunk: d, quest and recipe levels on one scale | prose; idea: the band check of 3.6 once d is filled (CR-38) | keep; id ST3 | |
| S4 Cooperative, competing for places | E | shared world | yes | prose; reserved fields exist | keep; id ST4 | |
| S5 Who gets a plot that work opens | D | shared world | yes | prose; paused | keep paused; id ST5 | |
| SW1 Progress and nodes are each player's own, except in the areas between players | E | shared world | yes | code: kernel (per-player state) | keep; id G70 | no home on a rule page today |
| SW2 One hour for all from stage 7; no window pauses a world | E | shared world | yes | prose until stage 7 | keep; id G71 | |
| SW3 Nobody blocks a way; players pass through each other | E | shared world | yes: `place_clear_tiles` | prose; idea: the check refuses a placed thing within the clear tiles | keep; id G72; an instance of G76 (case 5) | |
| SW4 Another player's camp is safe only for a guest with a deal | E | shared world | yes | prose | keep; id G73 | |
| SW5 One store at every chest | D | whole game | yes | code: kernel | keep; id G74 | |
| SW6 One account per person per world; every time names its clock (CR-93) | E | shared world | yes | prose; idea: a lint on every time field for a clock name | keep; id G75 | |
| REACTIONS 10, "open for others, never close or destroy" | E | shared world | yes | prose; idea: the check refuses a reaction whose effect removes a tile, node or way for another player | rewrite (case 5); id G76 | pillar E's second half |
| QUEST_PATTERNS, the hand-variety rule | C | whole game | yes, per quest file | checked as a warning: `pnpm quests` | keep as a warning until the owner decides | not decided |
| CR-17 No chance, level or difficulty on screen | B | whole game, both doors | yes | prose; idea: an e2e greps the HUD and dialogue for digits outside the bag and gold | rewrite as a rule (case 8); id G77 | the row is closed in GRUNT; the rule has no page |
| CR-88 One safe place: the flag read from level and fire | B | whole game | per chunk | prose (task) | merge into G30 | the split G30 says it |
| CR-89 One mist | B | whole game | yes | prose (task) | merge into G66 | |
| CR-93 Every time names its clock | E | shared world | yes | prose (task) | merge into SW6 (G75) | |
| CR-103 No visible borders | B | open world | yes | prose (task) | merge into G66 | |
| CR-104 A map to look at | - | open world | - | task | not a rule; stays a task | G66's reveal list feeds it |
| CR-105 The wandering wolf | - | demo | - | task | not a rule; stays a task under G47 | |
| CR-2 to CR-109, the rest | - | - | - | tasks | not rules; out of this table | GRUNT's table is a work list |

## 7. Lessons for DECISIONS.md

One entry for this review, written in the same pull request: the long paragraph rule (G30) is where the collisions grow; a decision that changes a rule is written into the rule's sentence, not under it as an exception; and a rule that reads "the valley's" fails at region two.
