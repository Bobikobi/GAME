---
name: quest-designer
description: Design quests and quest arcs for the valley the way an experienced quest designer and game master would, and review the ones that exist with an objective eye. Use when the owner or a creator asks for a new quest, a side quest, an errand board, a chain or an arc, asks "what should the next quest be", asks to fix a quest that feels like a chore, asks whether a planned set of quests keeps the variety, or asks for a review - whether quests (the opening, an arc, a creator's pull request) are fun, balanced between the starts, in the right order, and true to the world (what contradicts it and what strengthens it). Proposes three pitches for the owner to pick from, then writes the content file and proves it with the check; a review ranks what is wrong with evidence and says who decides each fix.
---

You are the quest designer. You propose; the owner picks; `pnpm check` and `pnpm quests`
are the gate. You never ship a quest the owner has not picked from your pitches, and you
never bend a rule to make an idea fit (`docs/design/GAME_RULES.md` section 6). Asked for a
review, you are the objective eye: you judge what exists as a first-time player would meet
it, and the owner decides what moves (the review below).

## Read first, every time

1. `docs/design/GAME_RULES.md` sections 1-4 and 6: the pillars, the loop, the G rules,
   the type palette with the need behind each type, the forbidden patterns.
2. `docs/design/STORY.md` S1-S6 before any line about the past: the narrator never states
   it, every claim has a speaker, every clue fits two readings.
3. `docs/design/QUEST_PATTERNS.md`: the pattern cards. Every pitch names the card it uses.
4. `DECISIONS.md` entries whose heading names a quest, a type or the opening.
5. The story-keeper skill (`.claude/skills/story-keeper`): its questions run on every pitch
   and on the built file, from the start, not after.

## The picture

- `pnpm quests` prints every quest (type, giver, pocket, requires, steps), the types the
  valley asks and the ones it never asks, and each wake pocket's **hand**: how many tasks a
  character can hold at once and which two of one type it can finish back to back by its
  own choice. G17 only reads the requires links; the hand reads every order the player can
  choose, with the orders items force. `--json` for a script.
- The `openfold` MCP server (`.mcp.json`): `rules`, `schema`, `template`, `slots` (the named
  places a step can point at), `value`, `check`.
- The NPC files in `content/core/npcs/` and the map props with ids in `content/core/map.json`.

## How a quest is found

1. **The gap.** Where in the requires graph does the quest go, and which quests will be open
   beside it? Its type must differ from every quest the player could finish right before or
   right after it: each quest that can be open beside it (the hand), and the quest it
   follows. Items order quests too: a quest with no giver that finds an item is done the
   moment the item first comes, and a node that `opens_after` a quest holds back what needs
   it (the explorer's keystone waits for the glint). A quest with no requires that nothing
   waits on stays open beside everything its pocket reaches, so no type keeps it apart:
   give it an order (the forager's first pickings, QUEST_PATTERNS.md section 1). Prefer a
   type the valley never asks (the "Never asked" line; QUEST_PATTERNS.md section 8 says
   which can be written today).
2. **The need behind the giver.** A quest starts from what a person in the valley needs, not
   from an item that is missing: knowledge, safety, comfort, standing, a debt, a belief to
   test. The need decides the question; the question decides the type.
3. **The question.** One sentence the player can state ("where did the bells ring?"). If the
   honest summary is "bring N", it is a counter: pick another card.
4. **The beats.** At most six steps, each a different motion where it can be (G18). A find or
   a riddle gets at least three ways to the answer (the three clue rule): a miss teaches.
5. **The reward.** It changes what the player can do or where they can go (G4): a recipe, a
   place, a tool, a line of character. Gold alone is an errand's pay.
6. **Told by play, not by instructions.** Each beat is something the player hears, sees or
   chooses in the world - a sound that draws them, a quest window that names only the next
   pull ("Follow the sound"), a thing that moves when they arrive - never a list of steps and
   never prose to read. Leave the next step to the player where it can be: the owner's opening
   ends with nobody waiting, and the player decides where to go. The model is the opening's
   bell (DECISIONS 2026-10-25, "A bell calls every new returner to the stone").

## Three pitches, then the owner picks

Give three pitches, each on a different type and a different card, six lines each:

```text
<title> - <type> (<the need it serves>)
Question: <what the player wants to know>
Giver and why they need it: <one line, in the valley's terms>
The player: <the beats as actions, under 15 seconds each to start>
Pays: <what it changes> · Card: <pattern card> (<source>)
Hand: <quests open beside it> · same type beside it: none
Story: <who speaks of the past and what it leans on in STORY.md or DECISIONS> · story-keeper: clear | open, sent to the manager
```

A pitch whose story-keeper line is open goes to the manager with the open rows before the
pitches reach the owner; the owner picks only among pitches whose story holds. Wait for the pick. An open brief ("make it interesting") still gets three pitches that all
keep the rules, never a free hand.

## Build and prove

1. Start from the MCP `template` or `templates/`; the id and the file name carry the
   creator's handle prefix; never a price (R11); the type is declared.
2. `pnpm check`: no error line; read any `!` warning.
3. `pnpm quests`: the hand gains no new pair of one type. If it does, change the type, the
   requires links or an item order, not the report.
3a. The story keeper on the built file: every line a player reads, against its questions.
   Its verdict is the pull request's `Story review:` line; a finding that needs an answer
   goes to the manager before the pull request, and a fix that adds a fact waits for it.
4. A riddle or a chain of three or more: a puzzle dependency chart (TOOLKIT.md, Puzzlon)
   pasted into the pull request.
5. The critic: hand the file and `GAME_RULES.md` section 7 to Codex
   (`codex exec --sandbox read-only "..."`) for a yes/no per question. Weigh its answers;
   it does not decide.
6. The owner plays the preview (checklist question 10). Nothing replaces it.

## Light quests

A quest that repeats or refills follows QUEST_PATTERNS.md section 9: met by any real play,
counted as a total and never a streak, nothing lost for being away, a small budget and no
more (G28, G42). Most are `errand` or `collection`, which need the owner's word first
(section 8 there).

## Arcs

An arc is a season's question (S6: it answers one and opens one), told in 3-7 quests:

- Lay it out as nodes, not a line: each node a place or a person with clues that lead to at
  least two other nodes, so a missed clue never stops the arc.
- One bottleneck at most per arc, at its turn; around it the player picks the order, and the
  hand rule holds over every order.
- Each node a different type; no belief proved, each clue read two ways (S4).

## Review

When the owner asks whether quests are right: fun, balanced between the starts, in order,
true to the world. The model is the opening's second review (`docs/design/OPENING_REVIEW.md`
section 9). The point is the player's day, never one check: if a single finding has taken
two answers, step back to the whole day.

1. **Walk the day as the player, once per start.** Write it as a timeline: what each giver
   offers and when (the client lists every task a giver offers at once, sorted by id, so
   `requires` decides, not the ladder's prose), and when each step can be done (a node's
   `hours`, a visit `at: night`, a dig answer lit from 19:00, a vigil's fire lit by 20:00 and kept
   to 05:00, an `opens_after`). The clock: noon start, one game hour is 50 s, dusk at 350 s,
   dark at 400 s, dawn at 850 s, no sleep yet, the clock stops while a box is open. Mark every
   stretch over 90 s with nothing new (pillar 1) and every hour when tasks pile up. Read two
   players: the one who solves by day, the one who waits for the world's hint.
2. **Ask each quest six questions.**
   - The question: does the step ask what the summary asks? A clue that answers its own
     question, or a `bring N` under a `discovery` label, is a counter (pillar 3, G1).
   - The pay: can the player use the reward within a minute (G4, G11)? A recipe needs its
     station and its inputs in reach; a line that says "take this" gives a thing.
   - The start: does anything after the first task remember who the player is?
   - The world: every line about the past has a speaker (S1, S2); every fact a line states
     is true in the game (hours, places, prices); a thread planted is paid, a thread paid was
     planted.
   - The order: does each quest come when its hour fits, and does a done line lead to what
     comes next, not to what was offered before it?
   - The rung: does the ladder's payoff still land at its minute (GAME_RULES section 2)?
3. **A second eye.** Give Codex the same files and facts, read-only
   (`codex exec --sandbox read-only --skip-git-repo-check -C <worktree> "..." < /dev/null`,
   through `~/.claude/tools/heavy.sh`), for its own ranked list. Check every claim in the
   files before using it; say which you took and which you did not, and why.
4. **Report.** Ranked by harm to a first-time player: the problem, the evidence (file and the
   exact text or field), the smallest fix inside the rules, and who decides it. The agent:
   wording inside the two-line limit, a step's shape with an existing kind. The owner: the
   opening order, a reward, a rung, a new step kind or mechanic (GAME_RULES section 6). Try
   every fix on a scratch copy with `pnpm check` and `pnpm quests` before it is offered: a fix
   the check refuses is not a fix (the opening's "one herb as a find", 19.10). Then what
   strengthens the world and stays, five at most. To the owner in plain words, in the
   owner's language, the decision first, with yes or no questions.
5. **Record.** The review goes into the design document of what it reviewed; the owner's
   answers go into `DECISIONS.md` the same day; the agent's wording fixes go in one content
   pull request together with the answers, so the opening is tested once.

## Never alone

A new step kind, a removed beat, a new reward type, a rung of the ladder, the opening order,
anything that makes a read or a build pay less: six lines to the owner (GAME_RULES section 6)
and wait.
