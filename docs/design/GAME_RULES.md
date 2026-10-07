# Game rules: what keeps Mistvale fun

This page is the owner's (Motty, product). Developers, creators and AI agents
follow it the way `kernel/` follows its rules R1-R11: a request that breaks a
rule is not built quietly and the rule is not bent quietly. Section 6 says what
happens instead. A rule changes only by the owner's word, written the same day
in [DECISIONS.md](../../DECISIONS.md).

Why it exists (2026-10-07): three things shipped that break the loop. The
collection shelf is a menu built as a camp. The town quests are "repeat the
gather verb N times". The statue inscriptions are reads that pay nothing.
Developers bring ideas, and an AI given a free hand fills a quest with the
easiest thing that validates. The fun of this product is the reward landing at
the right step, and nothing in the repository guarded that. Now something does:
this page, the review checklist in section 7, and the `play` rules in
`pnpm check` (section 8).

Read with it: [FTUE_RESEARCH.md](../FTUE_RESEARCH.md) for the first five
minutes (its five principles are assumed here, not repeated) and
[TOOLKIT.md](TOOLKIT.md) for the free tools that help keep these rules.

## 1. Pillars

Five claims, each testable in a playtest. When two good ideas collide, the
pillar higher on this list wins. A feature that serves none of them is cut.

1. **Every minute pays.** In any ten minutes of play the player gets something
   new they can see at least every ninety seconds: a find, a line, a level, a
   door, a changed tile. Test: time the gaps in a recording.
2. **Doing beats reading.** The player learns by acting. No more than two lines
   of text before the next input; lore is asked for, never pushed.
3. **Every task is a question, and the next one is a different kind.** A quest
   is a small problem with a context: something to notice, choose or work
   out. A counter is not a question, and the same kind of question twice in a
   row is a counter.
4. **The world is the interface.** World objects carry play: they change what
   the player can do or where they can go. Menus carry information and live in
   buttons. Nothing is built in the world in order to open a menu.
5. **Effort is never wasted.** A miss keeps something, a wrong answer teaches,
   a walk has a find on the way.

## 2. The loop and the hook ladder

The core loop is: notice a cue, act with one timed verb, get a find that was
not fully expected, spend or build, which opens a new place or verb, which
shows the next cue. Daniel Cook's loops build mastery; arcs (the mist, the
bells, the statues) carry meaning. Both must be present in every session.

Each beat of the loop is a hook in Nir Eyal's sense: a trigger the player sees,
an action under fifteen seconds, a variable reward, and an investment that sets
the next trigger. The reward lands within a few seconds of the action, with a
sound, a name and where it went. The next goal is visible before the glow fades.

The ladder below says what must happen at each stage of a player's life in the
valley. A change that removes a rung, or moves its payoff later, is a product
question (section 6).

| Stage | The beat | The payoff | Never |
|---|---|---|---|
| 0:00-0:15 | The player moves and presses A at a river stone. | The strike minigame, a stone in the bag, the counter moves. | A lore screen, a naming wizard, more than one box of text. |
| 0:15-1:00 | The first stone. | Level 1, the jingle, a skill point to spend now. | A level with nothing to spend. |
| 1-5 min | The bridge mends, the fire is built, the first meal cooks. | A tile changes, a sign carries the player's name, a recipe works. | A build that only opens a panel. |
| 5-10 min | The town: Maru's story, Pell's stall, the first choice. | The basket or the trowel: a real choice, both lead on. | A fetch with a counter and nothing to notice. |
| 10-20 min | The first riddle: an inscription points to a dig. | A rare find, a recipe scrap, a place that opens. | A read with no payoff. |
| Session end | A visible mark of the day. | The day summary: what was found, built, learned; one open door. | Stopping in the middle of nothing. |
| Day 2 | Something changed overnight. | A respawned grove, a new line from an NPC, a bell at night. | The same valley as yesterday. |

## 3. The rules

Numbered so a review, a commit or a check can point at one. Rules G2, G4, G8
and G10 are the ones `pnpm check` can test today (section 8).

### Quests

- **G1 Every quest asks a question.** The summary names what is unknown, not
  the count. "Bring 3 redberries" is a counter; "Maru remembers berries grew
  where the bells rang" is a question with the same three berries.
- **G2 After the opening, no quest is repeat-the-verb.** The opening chain
  (`core/fix-the-bridge`, `core/first-fire`, `core/into-town`) may teach a
  verb by repetition. Every later quest has at least one beat that is not
  "do the verb N times": a find in a hinted place, a choice between two
  answers, a riddle read from the world, a timing twist, a trade-off. A `bring`
  of an item that only digging gives, with a hint, counts as a find.
- **G3 At most three steps visible at once.** The next step is revealed by the
  previous one; the journal shows the question, not the whole recipe.
- **G4 A reward changes what the player can do.** A recipe, a tool, a place,
  an ally, a line that opens a door. Gold and reputation alone are for
  repeatable errands, and those are marked as such.
- **G5 No empty leg.** A quest never sends the player across the map twice for
  nothing; each leg has something to notice on the way.

### Riddles and puzzles

- **G6 A riddle has a catch and a reveal.** One assumption to break, one clue
  in the world (an inscription, an NPC line, a shape, a time of day), and an
  answer that is an action in the world: dig here, bring this, stand there at
  night. Never a text box to type into.
- **G7 Light means light.** Solvable by a child of eight with no outside
  knowledge; the answer is in the valley. At most three clues, the first within
  two minutes of the question. A wrong try gives a hint, never a wall.

### Reading: signs, inscriptions, notes

- **G8 Every read pays.** An inscription or a note gives a clue to a riddle, a
  key to a place, a line of character, or a laugh. A note no quest, treasure
  or character refers to is cut. Two lines at most.
- **G9 Reading is never the task.** "Read the statue" is not a step; "do what
  the statue says" is.

### Interface and world

- **G10 A build changes play.** A camp is built only if it gives a station
  (recipes), capacity, a path, a light, a trade. A build that opens a panel is
  a button in disguise: the panel gets a button, the build goes.
- **G11 Felt within a minute.** Nothing is built, bought or unlocked that the
  player cannot feel within one minute of getting it.

### Choices

- **G12 A choice is real.** Neither side is strictly better, both lead on, and
  the game shows the difference before the choice (the basket or the trowel is
  the model). A choice with one side greyed out, or two sides that play the
  same, is cut.

### Feel

- **G13 Every action answers.** Feedback within a tenth of a second: a flash, a
  sound, a number. A reward lands with a beat: the jingle, the item's name,
  where it went.
- **G14 Two lines, one box.** At most two lines per box, one box per beat, no
  box in the middle of a timed action.
- **G15 A miss keeps something.** Today a missed strike keeps the stone half
  the time; it never keeps nothing. Three misses in a row show a hint.

### Session

- **G16 A session ends on a mark and leaves a door.** The day summary says
  what was found, built and learned, and names one thing waiting for tomorrow.

### Variety

Top-tier games (Skyrim, The Witcher 3, Fallout) keep a player for hundreds of
hours not because each quest is good but because the next one asks for a
different kind of effort and pays a different feeling. The need behind each
feeling is known: competence (I can), autonomy (I chose), relatedness (someone
needed me), and with them curiosity, completion and surprise. A chain that
pays the same feeling twice in a row is a counter even when every quest in it
passes G1-G5. The owner's words (2026-10-07): collecting in the game must not
be one style; different quests and their actions answer different player
psychology.

- **G17 No two in a row of the same type.** Every quest declares its type
  from the palette below (`quest.type`, P-2). Two consecutive quests in a
  chain never share a type, and the first ten quests of the valley cover at
  least five types. The check counts (section 8).
- **G18 Getting an item is not one motion.** Across a chain, the way an item
  is obtained varies: the timed strike, a spot found with senses, a time of
  day, a trade, a dig with a chance, a question asked right, a thing tended
  over days. Three quests in a row whose items come by the same motion are a
  counter in disguise.

The palette. "Feeling" is what the player says afterwards; "need" is the
psychology behind it (the three needs of Ryan, Rigby and Przybylski; Lazzaro's
four keys of fun); "model" is a game where the type is done well; "here" is
what it looks like in the valley.

| Type | What the player does | Feeling | Need | Model | Here |
|---|---|---|---|---|---|
| `investigation` | Reads the scene, follows marks, deduces where. | "I worked it out." | Competence, curiosity | The Witcher 3 contracts (witcher senses) | Moss, footprints and a glow lead to the right dig; senses shortens the search. |
| `discovery` | Goes where nothing sends them and finds a place. | "I found it myself." | Autonomy, wonder | Skyrim's far peaks and cave mouths | A place in the mist that opens when you stand at the arch at night. |
| `fetch_twist` | Brings a thing that is not where it should be, or that someone else wants too. | "So that is where it was." | Competence, surprise | Fallout's "simple" deliveries | The berries grow only where the bells rang (three-fruits after P-3). |
| `dilemma` | Chooses between two answers with no right one; both lead on. | "That was my call." | Autonomy, meaning | The Witcher 3's choices; Fallout's water chip | Give the old coin to Maru, or trade it with Pell; the valley remembers either. |
| `skill` | Beats a timing or precision challenge with a harder window. | "Nailed it." | Competence, hard fun | Skyrim's lockpicking; Fallout's VATS | A rare node whose strike window is half the usual; a miss still keeps half. |
| `collection` | Completes a set shown in one place. | "One more." | Completion, ownership | Skyrim's Stones of Barenziah; Fallout's bobbleheads | A set of treasures on a shelf that NPCs notice when it is full (the shelf's future, section 5 row 1). |
| `tending` | Keeps something alive or safe over time. | "They needed me." | Relatedness, care | Companions in Skyrim; animals in Stardew Valley | Keep the fire lit through one night; a sapling watered three mornings. |
| `riddle` | Reads clues in the world and answers with an action. | "Aha." | Insight, hard fun | Skyrim's pillar puzzles; The Witcher 3's riddles | The three ruin stones and the dig under the hill-facing statue. |
| `mastery` | Learns a technique and uses it on something harder. | "I am getting better." | Competence over time | Skyrim's smithing; The Witcher 3's alchemy | A stew that needs two techniques the player has levelled. |
| `gamble` | Takes a known risk for a rare find. | "Lucky me." | Thrill, variable reward | Fallout's luck | A dig spot with one rare find in five; luck changes the odds. |
| `persuasion` | Asks the right question or brings the right fact. | "I talked my way in." | Relatedness, autonomy | Fallout's speech checks; The Witcher 3's talks | The trade opens only after the player asks Pell about the mist. |
| `errand` | Repeats a known task for a known pay. | "Easy coins." | Routine, easy fun | Skyrim's radiant quests; The Witcher 3's notice boards | Pell's standing order for herbs, marked as an errand, only after the main beat (G4). |

## 4. Forbidden patterns

Named so a review can point at one in two words.

| Pattern | What it looks like | Rule |
|---|---|---|
| Click-until-done | A counter with no question: bring 3, bring 4. | G1, G2 |
| Menu in disguise | A world build whose only effect is opening a panel. | G10 |
| Free read | Text with no payoff: a statue that says something and nothing follows. | G8 |
| Christmas tree | More than two open quests lit up at once. | G3 |
| Empty tab | A bag, log or tab shown before it has anything in it. | FTUE 3 |
| Lore wall | More than two lines before the next input. | G14 |
| Gold for gold | A reward that is only coins, outside a marked errand. | G4 |
| Reward without a beat | Progress with no sound, name or place. | G13 |
| Double back | A leg of the map with nothing on it. | G5 |
| Fake choice | One side greyed out, or both sides the same. | G12 |
| Typed answer | A riddle solved in a text box. | G6 |
| Same again | Two quests in a row of one type, or three items in a row got by the same motion. | G17, G18 |

## 5. Known breaches on 2026-10-07

Found by the owner playing the preview. He ruled on all five the same evening
(the "decision" column); the GRUNT items P-1 to P-4 carry the work.

| What | Rule | Proposed fix (recommended default) | Decision |
|---|---|---|---|
| `core/collection-shelf`: four branches and a shard build a shelf that opens the journal's items tab. | G10 | Remove the camp. The journal already has its Log button and the J key. The `shelf` slot stays empty with its sign until it has a real function (a trophy shelf whose placed finds change what NPCs say) or is dropped. | Yes (Motty, 7.10). Remove the camp now; the slot's future is a separate question. |
| `core/three-fruits`: bring 3 redberries. `core/herbs-for-pell`: bring 4 herbs. Both are the gather verb repeated. | G1, G2 | Rewrite each around one thing to notice. Berries: Maru says they grew thickest where the bells rang; one bush near the bell ruin gives the three in one strike at the right time of day. Herbs: Pell says the best herbs stand where the mist is thin at noon; the herb that counts only yields at midday. Both need the `find` step (P-2). | Yes (Motty, 7.10) to both rewrites, with the `find` step. |
| `core/a-coin-for-maru`: dig in the ruins for an old coin. | G2 (borderline) | It is already a find with a hint. Add the catch: the coin is under the statue that faces the hills, and the first dig elsewhere gives a shard and a hint. | Yes (Motty, 7.10). Keep, add the catch with P-3. |
| The seven inscriptions (the carved marks, two lantern statues, the stone head, the scratched names, the cold arch, the totem with fresh grass). Reading any of them changes nothing. | G8, G9 | One riddle ties the three ruin stones: the marks name the order the town was restored in; at night the lantern of the statue facing the hills glows and lights the tile to dig. The other four are seeds of a later arc (someone was here recently): each stays only if P-3 names the arc it pays into, otherwise it is cut until that arc exists. Needs the `riddle` step and prop ids (P-2), then the content (P-3). | Yes (Motty, 7.10). One riddle across the three ruin stones; the other four are cut until an arc names them. |
| `core/herbs-for-pell` and `core/a-coin-for-maru` reward gold and reputation only. | G4 | Herbs: Pell teaches herb stew. Coin: Maru opens the elder's house (a place). | Yes (Motty, 7.10). As proposed. |

## 6. When a request collides with a rule

This is the part written for AI agents and for developers in a hurry. Before
changing a quest, a camp, a map prop, an NPC line, a reward, a timing value or
the order of the opening: read sections 1-4, then run `pnpm check` and read the
`!` lines that cite this page.

When a request (from the lead, a creator, a reviewer, or your own idea) breaks
a rule, moves a rung of the ladder, or sits in a grey zone:

1. Do not build it, and do not change the rule to make it fit.
2. Do everything else in the task that does not depend on it.
3. Write to the owner, in plain Hebrew, five lines at most, in this shape:

```
מוטי, שאלת מוצר במשחק:
מה ביקשו: <the request in one line, who asked>
מה זה שובר: <rule number and its name in plain words, no jargon>
מה השחקן ירגיש: <one line>
ההמלצה שלי: <one line, with the alternative that keeps the rule>
צריך ממך: כן / לא / אחרת
```

In English, for the record: who asked for what, which rule it meets and what
that rule protects, what the player would feel, the recommendation with the
alternative that keeps the rule, and the one word needed back.

4. Wait for the word. The answer is written in `DECISIONS.md` the same day; if
   a rule changed, this page changes in the same pull request.

Grey zones that always go to the owner: an idea that is fun but delays a
payoff; a shortcut ("make it a counter for now, we will add the riddle later");
a creator's quest that is a fetch; an open brief to "make it interesting",
which the agent answers with two options that both keep the rules, never with
a free hand.

What an agent decides alone: wording inside the two-line limit, which clue a
riddle uses, numbers inside the ranges in `content/core/params.json`, art and
sound. What it never decides alone: a new step kind, a removed beat, a reward
type, a rung of the ladder, the opening order, anything that makes a read or a
build pay less.

## 7. The review checklist

For every pull request that touches play. Ten questions, yes or no; a "no"
names the rule and the pull request waits.

1. Does every new or changed quest ask a question the player can state? (G1)
2. After the opening, is there a beat that is not repeat-the-verb? (G2)
3. Does the reward change what the player can do? (G4)
4. Does every new sign, note or line pay in a clue, a key, a character or a
   laugh? (G8)
5. Does every new build change play, not open a panel? (G10)
6. Is every new choice real, with both sides shown before choosing? (G12)
7. Does every new action answer within a tenth of a second and land with a
   beat? (G13)
8. Is every text box two lines or fewer, and never during a timed action? (G14)
9. Does a miss keep something? (G15)
10. Did the owner play the preview, or did the reviewer play it for him and say
    so in the pull request?

## 8. What the check enforces

`pnpm check` runs the `play` rules (`tools/src/play.ts`) on every content
file, core and extensions alike. On 2026-10-07 they are warnings (`!` lines),
because the core content itself breaks them; they become errors in the same
pull request that fixes the content (P-3). What a rule cannot test stays with
the checklist above.

| Rule | What is tested | Today |
|---|---|---|
| G2 | A quest outside the opening chain whose steps are all `bring` or `visit`, where no `bring` is a dig-only find. | warning |
| G4 | A quest outside the opening chain that rewards gold and reputation only. | warning |
| G8 | Map props with a `note` that nothing refers to (today nothing can; the `riddle` step and prop ids come with P-2). | warning, one line with the count |
| G10 | A camp with neither a station nor a bag bonus. | warning |
| G17 | Two consecutive quests of one type in a `requires` chain, or fewer than five types among the first ten quests. | needs `quest.type` (P-2) |

When the `find` and `riddle` steps exist, G2 counts them as beats and G8 checks
each note against the riddles that cite it.

## 9. Sources

- [FTUE_RESEARCH.md](../FTUE_RESEARCH.md): the first five minutes, already in
  this repository.
- Daniel Cook, "Loops and Arcs", Lost Garden (2012): the loop in section 2.
- Nir Eyal, "Hooked" (2014): trigger, action, variable reward, investment.
- Mark Brown, Game Maker's Toolkit, "What Makes a Good Puzzle?": the catch and
  the reveal in G6.
- Pawel Sasko, GDC 2022, "10 Key Quest Design Lessons from The Witcher 3 and
  Cyberpunk 2077": a quest is a story with a question, not a list.
- Jeff Kaplan, GDC 2009, on World of Warcraft's quest mistakes: the Christmas
  tree, the fetch with no context.
- Celia Hodent, "The Gamer's Brain" (2017): usability and engage-ability,
  behind G13-G15.
- Richard Ryan, Scott Rigby and Andrew Przybylski, "The Motivational Pull of
  Video Games" (2006): competence, autonomy and relatedness, the "need" column
  of the palette.
- Nicole Lazzaro, "Why We Play Games: Four Keys to More Emotion Without Story"
  (2004): hard fun, easy fun, serious fun, people fun.

The links and what each gives are in [TOOLKIT.md](TOOLKIT.md).
