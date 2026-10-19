# The quest forge: how quests are made at the scale of an open world

Status: the plan, written 19.10.2026 after the owner's yes to its three decisions (section 1) and his fourth word: nobody picks a land. Nothing here is built. Each phase in section 4 is one pull request with what to read, what to build, how it is proved and who does it; a session takes a phase, reads this page and the files it names, and nothing else up front. The design judgement sits in two phases (the grammar, the binder); everything else is work a capable worker does from the instructions here.

Read with it: [WORLD_STRUCTURE.md](WORLD_STRUCTURE.md) (the world the quests live in: lands of stamped places, W4), [GAME_RULES.md](GAME_RULES.md) sections 1-4 (the pillars, the loop, G1-G18, the type palette), [QUEST_PATTERNS.md](QUEST_PATTERNS.md) (the cards; section 7 was the reading list this page replaces), [STORY.md](STORY.md) S1-S6, the quest-designer skill (`.claude/skills/quest-designer`), and `pnpm quests` (`tools/src/quests/`).

## 1. What is decided

1. **One quest grammar, in one decision.** The kernel gains the step kinds the fourteen types need and the combat frame will need: `choose` (a dilemma), `ask` (persuasion), `set` (a collection shown in one place), `any` (one step met by any of several actions), a `repeat` flag (an errand), and with combat `defeat`, `hold`, `escort`. Today eight kinds exist and five of the fourteen types cannot be written (QUEST_PATTERNS section 8). The grammar is written once, as a whole, so the library (section 3) is written against the whole of it.
2. **Quests are bound per land, when the land is made, never at run time.** A deterministic binder (seed plus the land) picks storylets from the library and binds their roles (giver, place, object, want) from the land's own graph. The same land gives the same quests on every machine, the way a chunk gives the same ground. The output is content, committed and checked like any content.
3. **RuneScape in the quests, World of Warcraft in the size.** G2 stands: no repeat-the-verb after the opening. Density comes from bound storylets and from the world's own events, never from filler. A land ships with a few hand-made quests (the gold layer) and many bound ones; neither pretends to be the other.
4. **No human per land.** The gates decide whether a bound quest ships; the owner reads a digest when he wants to and retires a storylet with one line when he wants to. Nothing waits on him. The one human approval left is the library itself, once per batch of storylets, because a storylet is written once and bound a thousand times.

## 2. The shape of the machine

Seven links. Each names where it lives.

| Link | What it does | Where | State today |
|---|---|---|---|
| 0. The shapes catalogue | The quest shapes of the games the owner named and of the best single-player RPGs, mined as structure (step sequences, motivations, where the turn is, how many ways to the answer), never as text. A table of shapes with frequencies and one abstract example each. | `docs/design/QUEST_SHAPES.md`, `tools/src/forge/shapes.json` | Doran and Parberry's nine motivations are the seed (QUEST_PATTERNS section 2) |
| 1. The grammar | The step kinds of decision 1, in the schema and the kernel, with `questSatisfied` for each. | `schema/src/index.ts`, `kernel/src/step.ts`, `kernel/src/state.ts` | Eight kinds exist |
| 2. The land graph | What a land holds that a quest can bind to: people with wants, places with roles, objects, two tags per settlement (what it lacks, what it argues about), speakers and beliefs. | `content/*/lands/*.json` (new type `land`), the NPC files | NPCs have talk topics and a voice; no wants, no tags, no land file |
| 3. The storylet library | Quests written once with roles instead of names: a type, a card, constraints on each role, steps in the grammar, fallback lines for every box, a reward kind. | `content/core/storylets/*.json` (new type `storylet`) | None |
| 4. The binder | Seed plus land in; quests out. Picks storylets by type variety and freshness, binds roles from the graph, writes the quest files and a dependency chart, runs the gates, rebinds what fails, stops at a cap. | `tools/src/forge/bind.ts`, output under `content/generated/<land>/quests/` | None |
| 5. The gates | Every check a quest must pass, run by the binder and by CI: the G rules (`pnpm check`), the hand (one open quest per type), reach on foot, the pillar-1 walk, every past line has a speaker, the words filter, no two lands bound to the same text. | `tools/src/check.ts`, `tools/src/quests/`, `tools/src/forge/gates.ts` | The G rules, the hand (as an enumeration), reach and pillar 1 (planned in NEXT 19 g) |
| 6. The voice pass | A model rewrites the fallback lines in the giver's voice sheet under S1-S6; a second model critiques against GAME_RULES section 7; a line that fails falls back to the storylet's own line. Optional, behind a flag; the forge works without it. | `tools/src/forge/voice.ts`, keys at the owner's gate | None |
| 7. The digest and the loop | `pnpm forge digest`: a report of what was bound, charts and lines, and once the server counts play, the completion and abandonment per storylet; freshness weights fall for the tired and a storylet under the floor is retired by itself. A retire file the owner edits by hand when he wants. | `tools/src/forge/digest.ts`, `content/core/storylets/retired.json`, the stage-1 service counts | The stage-1 service (NEXT 10) counts pickups and reports; nothing per quest |

The gold layer (hand-made quests per land, by a creator or the quest-designer skill in a land mode) sits beside the forge and uses the same grammar and gates; it is section 4, phase 10.

## 3. The rules the forge keeps

- **Structure is mined, text is not.** A catalogue row holds a shape, never a name, a line, a place or a story from another game. Wiki text is under licences that forbid it (the OSRS wiki is CC BY-NC-SA; Wowpedia is CC BY-SA; the games' lore is their owners'), and the valley's past has its own speakers. A session that mines reads the licence of each source first and writes it in the catalogue.
- **The library is canon; the voice pass is varnish.** Every storylet carries fallback lines a person approved once. The voice pass may vary them and may be switched off; a failed or missing voice line is the fallback, never an empty box. So no text reaches a player that no person ever approved in some form.
- **A bound quest is content.** It lives in a file, passes `pnpm check`, is regenerated by `pnpm forge bind <land>` and CI refuses a land whose committed quests differ from a fresh bind (the way `values.lock.json` is held). Nobody edits a bound quest by hand; the fix goes into the storylet or the graph and the land is bound again.
- **Determinism, integers, the world seed.** The binder draws from the same canonical stream the kernel uses (`kernel/src/rng.ts`), keyed by the land's id, so a bind is the same on every machine and in any order. No `Math.random`, no wall clock.
- **Variety is a gate, not a hope.** A land's bound set covers at least eight types; no two bound quests of one type can be open at once for one character (the kernel hand gate of phase 2); two lands never share a storylet with the same binding of giver and place.
- **No filler.** A storylet whose honest summary is "bring N" or "do the verb N times" fails G1/G2 at the gate like any quest; an errand (`repeat`) exists only after its main beat and pays gold and standing alone (G4).
- **The owner's three levers, none blocking:** the library's approval per batch; the retire file; the digest. A land binds and ships with none of them touched.

## 4. The phases, each one pull request

Rules for every phase: branch off `origin/develop` into `develop`, never stacked; a shared-file change (`schema/src/index.ts`, `NEXT.md`, `GAME_RULES.md`) is its own small pull request first; the schema stays additive and `FORMAT_VERSION` stays 1; `pnpm verify` green before the push and CI's opening e2e green before the landing; the pull request body names what went to Codex or Gemini and how many corrections it needed. "Design" means judgement a session with the strongest available model gives once; "build" means work a worker (Codex or a smaller session) does from these instructions with the proof named.

### Phase 0. The shapes catalogue (build; can start now)

Branch `docs/quest-shapes`. Reads first: QUEST_PATTERNS sections 2, 3, 5, 8, 10; GAME_RULES section 3's palette; Doran and Parberry 2011.
- Sources: the Old School RuneScape wiki's quest pages (the quick guides: a numbered list of steps per quest), the side quests of The Witcher 3, Fallout: New Vegas and Skyrim as their wikis list them, and the Doran and Parberry corpus. Not World of Warcraft's quest database: its mass is kill and collect, which G2 forbids, and it would skew the frequencies toward filler.
- For each quest read: the motivation (the nine), the sequence of step kinds in Openfold's grammar (`bring`, `make`, `restore`, `build`, `visit`, `tend`, `find`, `riddle`, `choose`, `ask`, `set`, `any`, `defeat`, `hold`, `escort`, and `other` with one word), where the turn sits, how many ways lead to the answer, what the reward changes, the number of givers. One row per quest in a scratch table that is not committed.
- The deliverable: `docs/design/QUEST_SHAPES.md`, a catalogue of shapes (a shape is a sequence of step kinds with a motivation and a turn position) with their counts per source, one abstract example per shape written in the valley's terms, and the licence of each source at the top; `tools/src/forge/shapes.json`, the same shapes as data (id, steps, motivation, turn, ways, weight).
- Measurable: at least 150 quests read; every shape in the JSON has a count and a source; no row in either file names a character, a place, an item or a line from another game (a grep for the sources' proper nouns, listed in the pull request, finds nothing); the JSON validates against a small TypeBox schema in `tools/src/forge/shapes.ts` with a test.

### Phase 1a. The grammar without combat (design, then build)

Branch `feat/quest-grammar` (shared files: the schema first in `feat/quest-grammar-schema`). Reads first: `schema/src/index.ts` QuestStep and QuestBody, `kernel/src/step.ts` `questSatisfied`, QUEST_PATTERNS section 8 and "One mystery, many roads", GAME_RULES G12, G19, G23, STORY section 4 (the lean).
- Design (one page in the pull request, before code): the exact fields of each new step kind and what completes it. The frame to start from:
  - `choose`: `{kind:'choose', options:[{give:{item,qty}|{nothing:true}, to:NpcId, lean?: 'mender'|'waker'|'none'}, {...}]}`, two options, each shown before the pick with what it gives (G12), completes on the pick, writes the lean (STORY section 4) and the option index into the player's quest record so later lines can read it.
  - `ask`: `{kind:'ask', npc:NpcId, topic:TopicId}`, completes when the player asks that topic, which must be a topic learned in the world (a `learn` on a prop, a note or a line), never a list with one right pick (G19, G23).
  - `set`: `{kind:'set', place:PropId, pieces:[{item,qty}...]}`, each piece placed at the place prop shows there (a `piece` event), the step completes when all are placed; the place changes when full (the `restore` machinery, one restore per set).
  - `any`: `{kind:'any', of:[QuestStep, QuestStep, ...]}`, two to four inner steps of different kinds, completes when any one does; the journal shows the question, not the list (G3).
  - `repeat` on the quest body: `{repeat:{after:'done', cooldown_days:int}}`, allowed only when the quest's type is `errand`, the reward holds gold and rep and nothing else (G4), and the quest requires a non-errand quest; the kernel offers it again after the cooldown with the same lines.
- Build: the schema (additive), `step.ts` for each kind, the player's quest record extended, tests in `kernel/test/grammar.test.ts` (each kind completes on its event and on nothing else; a replay agrees; `choose` writes the lean; `ask` refuses a topic not learned; `set` shows pieces; `any` closes on the first), `KERNEL_VERSION` up one minor. The client: a box for `choose` (two options with their gives), a journal line per kind in `game/src/text.ts`, the set's pieces drawn on the place. One content quest per new kind in the valley, each a card from QUEST_PATTERNS (a `dilemma` from "Two patrons", a `persuasion` from "Three clues", a `collection` from "A place that heals when its set is full", an `any` from "One mystery, many roads"), so `pnpm quests` says no type is never asked but `errand` and the combat ones.
- Measurable: `pnpm quests` "Never asked" lists only `errand` (until a main beat exists for one) and types that need combat; `pnpm verify` and the opening e2e green; the four new quests complete in an e2e each (`game/e2e/grammar.ts`).

### Phase 1b. The grammar's combat kinds (design with the combat frame; build after)

Branch `feat/quest-grammar-combat`, after the combat frame is decided (DECISIONS 2026-10-19, G35 is the demo's rule) and before combat content. `defeat` (a foe id and a count, counted from `hurt`/`fall` events of foes), `hold` (a place kept for a window against waves, the tending shape with foes), `escort` (an NPC walked from one slot to another, the stealth shape with a companion). The frame is one page in the pull request; the kinds follow the combat tick the frame picks, never the other way round. Nothing of it is built in 1a.

### Phase 2. The hand gate in the kernel (build)

Branch `feat/hand-gate`. Reads first: QUEST_PATTERNS section 1 (ranks 1 and 2, the simulation of 18.10), `tools/src/quests/hand.ts`, DECISIONS 2026-10-18 "The quest designer".
- The gate: a character holds at most one open quest per type; a giver whose quest's type is open says one waiting line instead of offering; the type just finished waits until another quest is done; when nothing else can be open, the quest is offered anyway. Params: `quest.one_per_type` (true), `quest.cooldown_done` (1).
- `pnpm quests` keeps its report for content authors but stops being the guarantee: its enumeration is bounded (`hand_max_states`, 20000) and prints "bounded" past it instead of running for hours. The guarantee is the kernel test.
- Measurable: kernel tests of the four clauses; the forager's three dead ends of 18.10 are offered anyway and the report says so; `pnpm verify` green; `KERNEL_VERSION` up one minor.

### Phase 3. The land graph (build; can start beside 1a)

Branch `feat/land-graph` (schema first). Reads first: WORLD_STRUCTURE W4, OPEN_WORLD G51 and G57, SETTLEMENT sections 2-3, QUEST_PATTERNS "A place described by its lack and its quarrel" and "Culture fills the blanks", STORY S2-S4, the NPC schema.
- A new content type `land`: id, title, the regions it holds, its story in two lines with a speaker, `lacks` (one tag from a closed list in the schema: timber, water, salt, light, cloth, iron, medicine, news, hands), `argues` (one tag: the planks, the ford, the old road, the bell, the seals, the strangers), `values` (one tag: craft, memory, trade, quiet, the river).
- NPCs gain `wants` (one to three of the nine motivations, each with the object kind it aims at), and `belief` (the STORY section 3 beliefs, already in the sheets, made a field). Places (slots and props with ids) gain `roles` (a closed list: hearth, store, ruin, water, high, hidden, crossing, grave, workshop, wild).
- `pnpm check`: every land names at least one settlement with both tags, at least three NPCs with wants and at least eight places with roles; a quest or storylet may cite a role only from the list.
- The valley becomes the first land file with its tags, and today's NPCs get their wants (Maru: knowledge, protection; Pell: reputation, wealth; the keeper: comfort), by the owner's sheets, in the same pull request.
- Measurable: `pnpm check` green with the valley as a land; a test that a land missing a tag is refused; the schema additive, `FORMAT_VERSION` 1.

### Phase 4. The storylet library, batch one (build; the one approval)

Branch `content/storylets-1`, after 0, 1a and 3. Reads first: QUEST_SHAPES, QUEST_PATTERNS (every card), GAME_RULES section 3's palette and section 7, STORY S1-S6, the quest-designer skill.
- A new content type `storylet`: id (handle prefix), type (the palette), card (a QUEST_PATTERNS heading), shape (a QUEST_SHAPES id), motivation, roles (`giver`, `place`, `object`, `second` and up to two more, each with constraints: the NPC's want, the place's role, the object's class or kind, a tag the land must have), `requires_role` (a storylet that must be bound before it in the land, by type, never by id), steps in the grammar with roles in place of ids, fallback lines for `offer`, `waiting`, `done` and one `remark` with `{giver}` `{place}` `{object}` holes and no other variable, a reward kind (recipe of class, tool of kind, a place opened by role, a line) never a price (R11), `tense` (true for a night or a danger beat, for the rhythm rule).
- Write 42 storylets: three per type for the eleven types the grammar can express without combat, plus nine errands (`repeat`) that each require a type. Each from a different card where the cards allow; every line under two lines (G14); every past claim with a speaker hole `{speaker}` bound to an NPC or a prop (S2).
- Prove: a storylet schema test; `pnpm check` on the library (a storylet is checked as a quest with its roles bound to placeholders); the Codex critic over GAME_RULES section 7 per storylet, its yes/no table in the pull request; a dry bind of the valley (phase 5 is not there yet, so a script in the pull request binds by hand five storylets to the valley's graph and the five quests pass `pnpm check` and `pnpm quests`).
- The approval: the owner reads the 42 as a table (type, card, question, the offer line) and says yes to the batch or strikes rows. This is the one human approval of the forge, once per batch. Later batches (10 to 20 a week by the quest-designer skill in a library mode) go the same way.
- Measurable: 42 files; every type but the combat ones has three; no two storylets share a shape and a card; the critic's table has no unanswered no.

### Phase 5. The binder (design, then build)

Branch `feat/forge-bind`, after 3 and 4 (2 may land before or after). Reads first: this page's section 3, `kernel/src/rng.ts`, `tools/src/assemble.ts` (how content loads), `tools/src/quests/hand.ts`, `tools/src/load.ts`, NEXT 19 g (the ring's checks).
- Design (one page in the pull request): the pick and the bind. The frame to start from:
  - Input: a land id, the world seed, the library minus the retire file, the land's graph (phase 3), the land's gold quests if any.
  - Budget per land from params: `forge.quests_min` (12), `forge.quests_max` (20), `forge.types_min` (8), `forge.errands_max` (3), `forge.attempts_max` (200).
  - The pick: walk the types in a fixed order shuffled by the stream keyed on the land; for each type take the storylet with the highest freshness weight (1.0 at birth; a storylet already bound in n lands weighs `1 / (1 + n)`; the retire file is 0; a tie breaks by the stream); bind its roles from the graph by constraints (a giver whose want matches, a place whose role matches, an object of the class, with the land's tags satisfied); refuse a bind that repeats a giver-and-place pair already used in this land or an identical binding in any other land; link `requires_role` to a bound quest of that type; alternate tense and calm along the requires links (QUEST_PATTERNS rank 5).
  - The write: one quest file per bound storylet under `content/generated/<land>/quests/`, ids `gen/<land>/<storylet>-<n>`, lines from the fallbacks with holes filled, a `bound` block (storylet, shape, the bindings) the gates and the digest read; one `CHART.md` per land with the dependency chart.
  - The gates (phase 6) run on the whole land; a failing quest is unbound and the pick moves to the next storylet; at `attempts_max` the bind stops with the quests that passed and a `!` line per hole left.
- Build: `tools/src/forge/bind.ts`, `pnpm forge bind <land>` and `pnpm forge bind --all`; CI runs `--all --verify` and refuses a land whose committed files differ from the fresh bind; tests with a fixture land and a fixture library (determinism across two runs and two orders, the budgets, the refusals, the freshness order).
- Measurable: the valley binds to between 12 and 20 quests of at least 8 types, byte-identical on two machines; `pnpm check` and `pnpm quests` green on the bound set; the opening's own quests untouched (a bound quest never requires an opening quest and never is required by one: a gate); `pnpm verify` green.

### Phase 6. The gates (build, beside 5)

Branch `feat/forge-gates`. Reads first: `tools/src/check.ts`, `tools/src/play.ts`, `tools/src/hazards.ts`, NEXT 19 g, STORY S1-S2, the words filter of the chat decision (DECISIONS 2026-10-10, the ladder).
- `tools/src/forge/gates.ts`, each gate a function `(land, quests, bundle) => Issue[]`, all run by the binder and by `pnpm check` on `content/generated`:
  1. the G rules as `pnpm check` runs them (no new code, called);
  2. the hand: one open per type reachable by the kernel gate; the enumeration bounded (phase 2);
  3. reach: every bound place on foot from the land's town within the pay-gap proxy of G62, through the ring's BFS;
  4. pillar 1: along each quest's legs no stretch over the ceiling without a pay (the walk check of NEXT 19 g, called per leg);
  5. speakers: every line that claims the past carries a speaker binding (the `{speaker}` hole filled by an NPC or a prop with a sheet);
  6. words: the filter and the ladder run over every line; a hit fails the quest;
  7. uniqueness: no identical binding across lands, no giver-and-place pair twice in a land;
  8. the opening is untouchable: no bound quest links to an opening quest or a slot inside the opening's area;
  9. reward: a bound reward changes what the player can do (G4) unless the quest is an errand.
- Measurable: a fixture per gate that fails and one that passes; `pnpm check` prints one `!` line per issue with the quest id and the gate's name; `pnpm verify` green.

### Phase 7. The voice pass (build, optional, flagged)

Branch `feat/forge-voice`, after 5. Reads first: STORY S1-S6, the NPC voice sheets, GAME_RULES section 7, DECISIONS 2026-10-18 "The quest designer" (the critic step), QUEST_PATTERNS "A model writes the words, the code owns the quest".
- `pnpm forge voice <land>`: for each bound quest, a prompt with the giver's sheet, the land's two lines, the quest's question and its fallback lines, asking for the same boxes in the giver's voice under the rules (two lines, a speaker for every past claim, no number, no name of a place that is not bound); a second call with GAME_RULES section 7 as yes/no questions; a line passes only with every yes and the gates of phase 6; a failed line keeps the fallback. The result is written into the quest file's lines with `voiced: true`; a rebind keeps voiced lines whose binding did not change.
- Keys and cost: an API key is the owner's gate (three lines to him, as NEXT 18 h); without a key the command prints "no key, fallbacks kept" and exits 0. Runs by a session or on the owner's machine, never in CI.
- Measurable: on the valley's bound set at least half the lines pass the critic on the first call (else the prompt is reworked before the pull request is ready); a fixture test with a fake model that returns a bad line proves the fallback; `pnpm verify` green.

### Phase 8. The digest and the retire file (build)

Branch `feat/forge-digest`, after 5. Reads first: `tools/src/sheet.ts` and `tools/src/board.ts` (how reports are written today), the stage-1 service's report shape (NEXT 10).
- `pnpm forge digest [--since <date>]`: a Markdown report of the lands bound since the date: per land the quests (type, storylet, giver, place, the offer line), the chart, the gates' `!` lines, the storylets most and least used, and, once phase 9 feeds it, completion and abandonment per storylet. Written to `docs/forge/DIGEST-<date>.md`; nothing waits on it.
- `content/core/storylets/retired.json`: a list of storylet ids with a reason and a date; the binder skips them; the owner adds a row by hand when he wants.
- Measurable: the digest for the valley lists every bound quest; a retired storylet is absent from a fresh bind and present in the digest's retired table; `pnpm verify` green.

### Phase 9. The loop from play (build, after the server)

Branch `feat/forge-loop`, after NEXT 10 (the counts) and NEXT 18 (accounts, the action log). Reads first: NEXT 10 and 18 g, `kernel-review-v1.md` R10.
- The server counts per quest id: offered, started, done, abandoned (open for 7 days without a step), from the verified action log only. A daily job writes `content/core/storylets/weights.json` (storylet, offered, done, abandoned, weight), with the weight falling as abandonment rises and recovering as the storylet rests (QUEST_PATTERNS rank 3, Wildermyth's rule: a quarter after a use, back toward one with rest). A storylet under `forge.retire_floor` (0.1) for `forge.retire_days` (30) is added to the retire file by the job with the reason "abandoned", and the digest says so.
- The binder reads the weights file when present; without it every weight is 1.
- Measurable: a test of the weight function; a fixture log that abandons one storylet retires it after the window; nothing of this touches the kernel.

### Phase 10. The gold layer per land (build, by the quest-designer skill)

Branch per land, after 5. The quest-designer skill gains a land mode: `pnpm quests --land <id>` prints the land's graph and its bound set; the three pitches bind to the land's people and places and must differ in type from the bound set's types most used; the gold quest's id carries the land; the gates run on it like a bound one. A land ships with one to three gold quests, written by a creator or by the skill with the owner's pick as today, and this is the only place the owner picks anything per land, by choice, never by need: a land with no gold quest ships.

## 5. The order and what can run at once

- Now, beside each other: phase 0 (docs and data), phase 3 (schema and content), the design page of phase 1a.
- Then 1a (build), 2 (any time), 4 (after 0, 1a, 3).
- Then 5 and 6 together, 7 and 8 after them.
- 9 waits for the server (NEXT 18); 1b waits for the combat frame; 10 runs per land once 5 is in.
- The first ring's boathouse (NEXT 19 f) keeps its one hand-written errand; the first land file (phase 3) covers the valley and the ring, and the first bind (phase 5) runs on it. Nothing in NEXT 19 waits for the forge.

## 6. Numbers to measure before the plan is trusted

Each is written as a target so the first run can say yes or no; none is a rule until the digest shows it.
- A library of 42 binds the valley plus the first ring without a hole; a second land shows repeats within three lands, so the library grows to about 100 before the third land.
- A bind of one land runs under 10 seconds on the laptop at 200 attempts.
- The voice pass passes at least half its lines on the first call.
- Abandonment per storylet under a third once play is counted; above it the storylet rests.

## 7. What is not done here

- No model writes a quest's steps, rewards or completion: the code owns the quest, the model owns at most the lines, and only with a fallback behind it.
- No text, name, place or lore from another game enters the repository; shapes and frequencies do.
- No bound quest is edited by hand; the storylet or the graph is.
- No per-land approval, no per-quest approval, no reviewer queue; the gates decide and the digest reports.
- The Nemesis-style remembering foe is patented until the mid 2030s and is not copied; the world remembers small things through reactions (QUEST_PATTERNS section 5), which is its own thing.
