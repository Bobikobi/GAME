# Game rules: what keeps Mistvale fun

This page is the product owner's. Developers, creators and AI agents
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

What it is for, in the owner's words (2026-10-07): to reach an end product the
game has to carry a community, so the foundations must be clear. This page
and the files beside it are those foundations. A creator who has never met the
team, a developer in a hurry and an AI with a free hand must all be able to
tell right from wrong here without asking, and must get the same answer.

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

### Dialogue and voice

Talk in the valley is short, in character, and always does work. The content
shape already says so: a character has a first meeting, one line or two per
standing (stranger, acquaintance, friend, family), and up to four topics the
player asks about. That shape is the rule: the player pulls, the character
answers, and every answer pays (G8). A box is one entry in those lists; on a
phone at the dialogue size a box holds about two lines, which is about 80
characters.

- **G19 Every line does one job.** It asks a question, gives a clue, shows
  who is talking, offers a choice, or lands a laugh. A line that only explains
  is cut; a fact the player needs is given by the world (a sign, a glow, a
  tile) before it is given by a mouth.
- **G20 One voice per character.** Each character has a voice sheet (how they
  talk, what they want, what they never say), and two of their lines next to
  two of another's are tellable apart with the names hidden. The sheets are
  below; the owner approves a new one before the character speaks.
- **G21 The player pulls.** A first meeting is at most three boxes; everything
  else waits behind a topic. A standing line is one box, two at most. A topic
  is at most four boxes. A new topic appears when the world changed (a quest
  done, a place mended), so coming back to a character pays.
- **G22 Plain words, all ages, the valley's own names.** A child of eight
  reads every line: no slang, no jokes about games, no brand names, no
  irony at the player's expense. The valley's words (the mist, the bells, the
  ruins, the hills, the grove) are the same in every mouth and on every sign.
  English only, the game and its files alike (owner, 8.10); a language field
  on content, never a copied folder, is the format decision for a day that
  may not come.
- **G23 Talk choices are real.** Topics are a choice of what to learn, never
  a quiz with one right pick. When the player gets answers of their own
  (P-2 or later), at most three, each a different stance (ask, doubt, offer),
  and each pays something the others do not.

The voice sheets, approved as written on 2026-10-08. The lines follow the
sheet, never the other way round; a sheet changes only by the owner's word.

| Voice | How they talk | What they want | Never | Status |
|---|---|---|---|---|
| Elder Maru | Slow. Short sentences. Speaks of "once" and of mending. Hints at the mist, does not explain it. Calls the player "you", never by name until friend. | The town back, one mended thing at a time. | Prices. Hurry. A straight answer about the bells. | Approved (8.10) |
| Pell | Quick. Counts everything. Every subject becomes a trade or a rumour. Jokes about prices, not about people. | Customers, and the roads open again. | Sentiment. Lore of her own; she repeats what travellers say. | Approved (8.10) |
| The narrator (the river text, toasts, the journal) | Second person, present tense, concrete nouns, one adjective at most. Says what is there, not what to feel. | Nothing; it is the valley speaking. | "You feel", "amazing", exclamation marks outside a level-up. | Approved (8.10) |
| Signs and inscriptions | Fewest words. A fact and a hook. No "you". | To be read twice. | A full sentence where a fragment does. | Approved (8.10) |

### Sound and music

The game's sound is synthesized in `game/src/audio`: two songs (the valley
by day, the night), three jingles (level, quest, found), day and night
ambience with wildlife, short effects, and a mute preference that survives a
reload. On a phone the browser unlocks audio on the first gesture; the opening
already handles that and the e2e run checks it.

- **G24 Every beat has a sound, every sound has a beat.** Each event the game
  shows as a toast (a pickup, a full bag, gold, a level, a journal entry, a
  recipe, a task opened or done, a place restored) has its own short effect,
  and no effect plays without a visible cause on screen. Hit and miss in the
  strike are two different sounds within a tenth of a second (G13).
- **G25 The rare find is heard.** The found jingle plays only for a find the
  player could not count on: a rare dig, a recipe scrap, a riddle solved. An
  ordinary pickup gets the ordinary click. A jingle used for everything says
  nothing.
- **G26 Music is the clock, not a loop you notice.** The valley song by day,
  the night song after dusk, a crossfade at the change; the ambience carries
  the place (riverbank, grove, ruin). Music ducks under a jingle, silence is
  allowed, and a song never restarts because a panel opened.
- **G27 Nothing important lives only in sound.** Every beat has its visible
  twin (G13), the mute control is one tap away and remembered, and on phones
  haptics mirror the beats (FTUE gap 3). In stage 1 an extension brings no
  sounds of its own: the kit's effects are the palette, like the colours.

### Fairness and access

- **G28 No dark patterns.** The valley waits. No punishment for being away,
  no timer that runs out while the player sleeps, no fake scarcity, no "last
  chance", nothing to pay for. A return is rewarded (the ladder's Day 2); an
  absence is never punished.
- **G29 Playable by more people.** Text at 16 px or more and dialogue at 18
  (FTUE); colour is never the only signal (a glint has a shape, a tone has a
  word); reduced motion is honoured by every effect; one hand is enough on a
  phone; the strike window grows with agility so a slower hand still wins
  (G15).

### Danger and falling

Added 2026-10-08 on the owner's word (DECISIONS.md, that day's falling entry).
The valley has no combat; its danger is the hour, and what the player eats.

- **G30 The town and the camp are safe; the night and the mist hunt.** The town
  and the player's camp are safe at every hour. Outside them the hazards that
  hunt (the wolf, the hidden pit, the trap, deep water) act after dark (the
  clock the world already keeps: dark from 21:00 to 04:00, fading over two
  hours each side) and inside the mist; by day they show and can be walked
  around: the trap is visible, the wolf sleeps, the pit is lit. What the player
  picks or eats can hurt at any hour: a bad fruit takes health in daylight too,
  and a player can fall at noon from it.
- **G31 Nobody falls unwarned.** A countdown to nightfall sits at the screen's
  edge while the player is outside a safe area (in the first levels, with a
  banner too). Leaving a safe area after dark, or dark arriving outside one,
  lights the lantern and opens one warning box (G14), once per night.
- **G32 Health is the one bar.** The food bar becomes the health bar. Hazards
  take health; food, a first-aid kit and a night's sleep at camp give it back;
  low health slows work the way the empty bar did. Nothing drains it by the
  clock (G28): there is no hunger timer, eating is how the player heals, and
  cooking keeps its purpose.
- **G33 A fall is clear, and it costs the outing.** At zero health the player
  falls: crosses for eyes, the body sinks into the ground, one plain box says
  what happened; no gravestone, nothing left in the world. The player reappears
  in the town they were last in, on a random tile inside its bounds (before the
  first town: where they started). What was gathered on that outing is lost,
  and a quest that was in progress starts again from its first step; nothing
  marks where the fall was. The bag from before the outing, the camp, the gold,
  the levels and the quests already done are untouched. The cost is the lesson:
  a bad fruit eaten on the way means the basket is gone and the walk is made
  again.
- **G34 A hazard is a rule, not a roll.** Each hazard acts by a rule the player
  can learn, and each has one thing to buy and one thing to make that answers
  it: the wolf keeps off a lit lantern, thrown food holds it, the road ends the
  chase (lantern oil to buy; a torch from wood to make); the pit is where the
  floor is broken (a rope); the trap shows by day (nothing to buy: look); the
  herb is bad raw and safe cooked (an antidote; a bandage from herbs); deep
  water is the river without its bridge at night. Chance, where a rule has it,
  runs through the kernel's own random stream so the server at stage 2a can
  replay it.
- **G35 No fighting.** Predators are hazards, not enemies: light, food and feet
  are the answers. Combat stays where the spec puts it (stage 8, or a community
  vote).

### Expeditions

- **G36 An expedition is the valley's dungeon.** A place entered under a clock,
  three to five problems of different types inside (G17) with hazards among
  them, a climax, a reward that opens a place by day, and a soft failure: what
  was not found waits for the next night, what was carried out stays; a fall
  inside it is G33. The first is the night ruins under the bells.
- **G37 An expedition is never the only road.** The valley by day goes on
  without it; an expedition opens places sooner, never alone.

### What this page covers, and what lives elsewhere

| Topic | Where | State |
|---|---|---|
| The opening and onboarding | [FTUE_RESEARCH.md](../FTUE_RESEARCH.md) | Written; roadmap phases 2 and 3 open. |
| Loop and hook, quests, riddles, reading, builds, choices, feel, session, variety, dialogue, sound, fairness, access, danger, expeditions | This page | Rules G1-G37. |
| Economy and balance | The kernel rules R1-R11, `content/core/params.json`, `pnpm values` | Enforced by code. |
| Art and sprites | [docs/creators/README.md](../creators/README.md) | Enforced by the kit check. |
| Community: requests, votes, merges, conduct | [CONTRIBUTING.md](../../CONTRIBUTING.md), [docs/loop/README.md](../loop/README.md) | Live. |
| Difficulty curve and pacing beyond the ladder | Not written | After P-3, with play data from the hub's usage section. |
| Performance budget on a phone | Not written | Measure on a real device first (DECISIONS.md, the Phaser entry); then a number here. |
| A second language | Not written | No (owner, 8.10): English only, see G22. |

## 4. Forbidden patterns

Named so a review can point at one in two words.

| Pattern | What it looks like | Rule |
|---|---|---|
| Click-until-done | A counter with no question: bring 3, bring 4. | G1, G2 |
| Menu in disguise | A world build whose only effect is opening a panel. | G10 |
| Free read | Text with no payoff: a statue that says something and nothing follows. | G8 |
| Christmas tree | More than two open quests lit up at once. | G3 |
| Empty tab | A bag, log or tab shown before it has anything in it. | FTUE 3 |
| Lore wall | More than two lines before the next input, or a first meeting past three boxes. | G14, G21 |
| Gold for gold | A reward that is only coins, outside a marked errand. | G4 |
| Reward without a beat | Progress with no sound, name or place. | G13 |
| Double back | A leg of the map with nothing on it. | G5 |
| Fake choice | One side greyed out, or both sides the same. | G12 |
| Typed answer | A riddle solved in a text box. | G6 |
| Same again | Two quests in a row of one type, or three items in a row got by the same motion. | G17, G18 |
| Silent night | A fall with no countdown and no warning box before it. | G31 |
| Breadcrumb | A fall that leaves a stash, a pin or a line saying where to go back to. | G33 |
| Hunger clock | A bar that empties by the clock, awake or asleep. | G32, G28 |
| Quiz talk | A topic list with one right pick, or a line that exists to explain. | G19, G23 |

## 5. Known breaches on 2026-10-07

Found by the owner playing the preview. He ruled on five the same evening and
on the sixth row on 8.10 (the "decision" column); the GRUNT items P-1 to P-4
carry the work.

| What | Rule | Proposed fix (recommended default) | Decision |
|---|---|---|---|
| `core/collection-shelf`: four branches and a shard build a shelf that opens the journal's items tab. | G10 | Remove the camp. The journal already has its Log button and the J key. The `shelf` slot stays empty with its sign until it has a real function (a trophy shelf whose placed finds change what NPCs say) or is dropped. | Yes (owner, 7.10). Remove the camp now; the slot's future is a separate question. |
| `core/three-fruits`: bring 3 redberries. `core/herbs-for-pell`: bring 4 herbs. Both are the gather verb repeated. | G1, G2 | Rewrite each around one thing to notice. Berries: Maru says they grew thickest where the bells rang; one bush near the bell ruin gives the three in one strike at the right time of day. Herbs: Pell says the best herbs stand where the mist is thin at noon; the herb that counts only yields at midday. Both need the `find` step (P-2). | Yes (owner, 7.10) to both rewrites, with the `find` step. |
| `core/a-coin-for-maru`: dig in the ruins for an old coin. | G2 (borderline) | It is already a find with a hint. Add the catch: the coin is under the statue that faces the hills, and the first dig elsewhere gives a shard and a hint. | Yes (owner, 7.10). Keep, add the catch with P-3. |
| The seven inscriptions (the carved marks, two lantern statues, the stone head, the scratched names, the cold arch, the totem with fresh grass). Reading any of them changes nothing. | G8, G9 | One riddle ties the three ruin stones: the marks name the order the town was restored in; at night the lantern of the statue facing the hills glows and lights the tile to dig. The other four are seeds of a later arc (someone was here recently): each stays only if P-3 names the arc it pays into, otherwise it is cut until that arc exists. Needs the `riddle` step and prop ids (P-2), then the content (P-3). | Yes (owner, 7.10). One riddle across the three ruin stones; the other four are cut until an arc names them. |
| `core/herbs-for-pell` and `core/a-coin-for-maru` reward gold and reputation only. | G4 | Herbs: Pell teaches herb stew. Coin: Maru opens the elder's house (a place). | Yes (owner, 7.10). As proposed. |
| Maru's first meeting is eight boxes, most over two phone lines; Pell's standing lines run to three boxes. | G14, G21 | Maru: three boxes at the first meeting (who he is, what he wants, where to go); the rest moves behind the three topics that already exist. Every box within two phone lines. Pell: two boxes per standing. | Yes (owner, 8.10). With P-3. |

## 6. When a request collides with a rule

This is the part written for AI agents and for developers in a hurry. Before
changing a quest, a camp, a map prop, an NPC line, a reward, a timing value or
the order of the opening: read sections 1-4, then run `pnpm check` and read the
`!` lines that cite this page.

When a request (from the lead, a creator, a reviewer, or your own idea) breaks
a rule, moves a rung of the ladder, or sits in a grey zone:

1. Do not build it, and do not change the rule to make it fit.
2. Do everything else in the task that does not depend on it.
3. Write to the owner, in plain words, six lines at most, in this shape:

```
To the product owner, a product question in the game:
Asked: <the request in one line, who asked>
Breaks: <rule number and its name in plain words, no jargon>
The player would feel: <one line>
My recommendation: <one line, with the alternative that keeps the rule>
Needed from you: yes / no / other
```

Those six lines are the whole message: no essay, no list of options, and one
word back.

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
   laugh, and can you tell who is speaking with the name hidden? (G8, G19,
   G20)
5. Does every new build change play, not open a panel? (G10)
6. Is every new choice real, with both sides shown before choosing? (G12)
7. Does every new action answer within a tenth of a second, land with a beat,
   and have both a visible and an audible twin? (G13, G24, G27)
8. Is every text box two lines or fewer, and never during a timed action? (G14)
9. Does a miss keep something, and does the change hold with reduced motion
   and without colour? (G15, G29)
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
| G14, G21 | A character's first meeting over three boxes, a standing over two, a topic over four; boxes over 80 characters, counted per character. | warning |
| G30 | A hunting hazard (predator, pit, trap, deep water) inside a safe area or with no window (`night`, `mist`); a bad fruit or herb needs none. | needs hazard props (P-5) |
| G34 | A hazard with neither a bought nor a made answer in the content. | needs P-5 |
| G36 | An expedition with two problems of one type in a row, or a hazard its window does not cover. | needs the `expedition` kind (P-6) |

When the `find` and `riddle` steps exist, G2 counts them as beats and G8 checks
each note against the riddles that cite it. Sound (G24-G27), fairness (G28),
access (G29), the warning and the fall (G31-G33, G35, G37) live in code, not in
content: the checklist covers them, and
the e2e run prints the audio state line on every pull request.

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
- Game Accessibility Guidelines (gameaccessibilityguidelines.com): the basic
  tier behind G29.
- Yu-kai Chou's Octalysis, the black-hat drives (scarcity, loss, avoidance):
  what G28 refuses.

The links and what each gives are in [TOOLKIT.md](TOOLKIT.md).
