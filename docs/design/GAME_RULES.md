# Game rules: what keeps Openfold fun

This page is the product owner's. Developers, creators and AI agents
follow it the way `kernel/` follows its rules R1-R12: a request that breaks a
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
5. **Effort is never wasted.** A miss turns up something, a wrong answer
   teaches, a walk has a find on the way.

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
question (section 6). Its minutes are minutes at the screen, and its Day 2 is
the valley's, never the calendar's.

| Stage | The beat | The payoff | Never |
|---|---|---|---|
| 0:00-0:15 | Each start wakes at its own place and does its own first task: the forager picks herbs on the west bank, the digger digs its axe out of the slid bank, the explorer follows its senses to its axe in the grass by the bridge. | Something in the bag at once, found the start's own way. | A lore screen, a naming wizard, more than one box of text. |
| 0:15-1:00 | The first strike, at the bridge's keystone in the shallows. | The strike minigame, taught once; level 1, the jingle, a skill point to spend now. | A level with nothing to spend. |
| 1-5 min | The bridge mends; a tree is felled with the axe each start holds or finds; the fire is built. | A tile changes, a sign carries the player's name, a purse: the price of one tool, in gold only. | A build that only opens a panel. |
| 5-8 min | The town: whom to help first, Maru or Pell; then Maru's coin; at dusk, the riddle. | A real choice: Maru pays with his old trowel, Pell with a recipe and coin, and the stall says what each tool opens. Both plants are open from noon until dark, so neither order waits. From 19:00 the hill lantern lights the tile to dig. | A fetch with a counter and nothing to notice. |
| 8-10 min | After dark, the broken arch at the edge of the ruins. | A way under the arch that rubble filled by day, to the threshold of the night ruins: a place that opens, the first sight of the expeditions (G36). | Something to fight or something that hunts (G35). |
| Session end | A visible mark of the day. | The day summary: what was found, built, learned; one open door. | Stopping in the middle of nothing. |
| Day 2 | The morning after the first night, slept or played through: something changed overnight. Away, the valley waits at the hour it was left (G28). | The morning toast, a respawned grove, a new line from an NPC, a bell at night. | The same valley as yesterday. |

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
  answers, a riddle read from the world, a timing twist, a trade-off. A `find`
  step is that beat: one of an item that only digging gives, or that one timed
  plant gives, with a clue (P-2, P-3).
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
  the game shows the difference before the choice (whom to help first is the
  model: each neighbour says what its errand gives, the two rewards differ in
  kind, and the other errand waits; DECISIONS.md, 10.10). A choice with one
  side greyed out, or two sides that play the same, is cut.

### Feel

- **G13 Every action answers.** Feedback within a tenth of a second: a flash, a
  sound, a number. A reward lands with a beat: the jingle, the item's name,
  where it went.
- **G14 Two lines, one box.** At most two lines per box, one box per beat, no
  box in the middle of a timed action.
- **G15 A miss turns up something, never an empty hand.** A missed strike
  gives something other than the node's item, from the node's own miss table:
  a bruised fruit, grit, now and then a rare find, now and then only a thorn.
  Every row of a table is a thing with a value. The jackpot strip stays the
  reward for precision. Three misses in a row show a hint. A creator adds a
  surprise by adding a row (DECISIONS.md, 10.10). Until the kernel reads the
  tables (CR-60) a miss keeps one unit half the time.

### Session

- **G16 A session ends on a mark and leaves a door.** The day summary says
  what was found, built and learned, and names one thing waiting for tomorrow.
  A valley's day ends when the player sleeps, or at 05:00 when the night is
  played through; the summary comes then, before the morning toast, and waits
  until the player stands in a safe place (G30; DECISIONS.md, 10.10).

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
| `skill` | Beats a timing or precision challenge with a harder window. | "Nailed it." | Competence, hard fun | Skyrim's lockpicking; Fallout's VATS | A rare node whose strike window is half the usual; a miss turns up something from the node's miss table (G15). |
| `collection` | Completes a set shown in one place. | "One more." | Completion, ownership | Skyrim's Stones of Barenziah; Fallout's bobbleheads | A set of treasures on a shelf that NPCs notice when it is full (the shelf's future, section 5 row 1). |
| `tending` | Keeps something alive or safe over time. | "They needed me." | Relatedness, care | Companions in Skyrim; animals in Stardew Valley | Keep the fire lit through one night; a sapling watered three mornings. |
| `riddle` | Reads clues in the world and answers with an action. | "Aha." | Insight, hard fun | Skyrim's pillar puzzles; The Witcher 3's riddles | The three ruin stones and the dig under the hill-facing statue. |
| `mastery` | Learns a technique and uses it on something harder. | "I am getting better." | Competence over time | Skyrim's smithing; The Witcher 3's alchemy | A stew that needs two techniques the player has levelled. |
| `gamble` | Takes a known risk for a rare find. | "Lucky me." | Thrill, variable reward | Fallout's luck | A dig spot with one rare find in five; luck changes the odds. |
| `persuasion` | Asks the right question or brings the right fact. | "I talked my way in." | Relatedness, autonomy | Fallout's speech checks; The Witcher 3's talks | The trade opens only after the player asks Pell about the mist. |
| `errand` | Repeats a known task for a known pay. | "Easy coins." | Routine, easy fun | Skyrim's radiant quests; The Witcher 3's notice boards | Pell's standing order for herbs, marked as an errand, only after the main beat (G4). |
| `maze` | Finds the way through a place whose shape is the question: dead ends, a landmark seen over the trees, a sign that tells the right turn. | "I found the way." | Competence, autonomy (the route is the player's own) | The Lost Woods in Zelda (the route is read from the world, a wrong turn sends you back); Tunic (paths hide in plain sight until a page shows them) | A tangle of forest beyond the ruins, drawn in the map alone: dead ends that cost a walk back, one landmark over the canopy, the moss side of the trunks for the player who looks; the step is a `visit` of the clearing at its heart, nothing new in the kernel. |
| `stealth` | Passes a hazard unseen: learns its loop, waits for the window, takes the route it does not watch. | "It never saw me." | Thrill, competence | Breath of the Wild's Yiga hideout (a walked loop with a window to cross); Untitled Goose Game (being seen costs a retreat, never a life) | The wolf's round at night, over G30-G35: a loop the player learns by its eyes in the dark, reeds and shadow that hide the player, running back to a safe place as the way out when it fails; seen means a chase and the walk back to the fire, never a fight (G35). |

`maze` and `stealth` entered on 9.10 by the owner's word (DECISIONS.md); each
joins `quest.type` with its first quest, and the schema's count follows.

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
  absence is never punished. One written exception, for the valley's
  holidays: a holiday falls on its real dates every year, and what it
  gives is that year's only, a look or a title marked with the year, bound to
  the character and never traded. A player who misses it does not get it
  later; the next year's holiday gives its own. This is the one "last chance"
  the game has, and it costs a look or a title, never a use, a recipe, a tool
  or a way forward (G42; DECISIONS.md, 10.10). The exception for scarce
  plots and houses in a shared town ([SETTLEMENT.md](SETTLEMENT.md) 3.2) is
  paused with player houses and plots, and comes back only with them
  (DECISIONS.md, 10.10).
- **G29 Playable by more people.** Text at 16 px or more and dialogue at 18
  (FTUE); colour is never the only signal (a glint has a shape, a tone has a
  word); reduced motion is honoured by every effect; one hand is enough on a
  phone; the strike window grows with agility so a slower hand still wins
  (G15).

### Danger and falling

Added 2026-10-08 on the owner's word (DECISIONS.md, that day's falling entry).
The valley has no combat; its danger is the hour, and what the player eats.

- **G30 The town and a burning camp are safe; the night and the mist hunt.**
  The town and all ground at danger level 0 are safe at every hour, and a camp
  is safe while its fire burns, another player's only for a guest whose stay
  its owner approved: any of these is a safe place, or a safe area,
  the one thing every rule below means (DECISIONS.md, 10.10). The fire eats
  wood through the night, more the deeper the area and none at danger level 0,
  where the opening's camp stands. A camp anywhere else outside the
  town is a tent the player buys and pitches, with wood enough for the night
  ([SETTLEMENT.md](SETTLEMENT.md) S2). Outside these the hazards that hunt (the
  wolf, the hidden pit, the trap, deep water) act after dark (the clock the
  world already keeps: dark from 20:00 to 05:00, with the dusk ramp drawn
  around it) and inside the mist; by day they show and can be walked around: the
  trap is visible, the wolf sleeps, the pit is lit. What the player picks or
  eats can hurt at any hour: a bad fruit takes health in daylight too, and a
  player can fall at noon from it.
- **G31 Nobody falls unwarned.** A countdown to nightfall or to the mist's
  coming, whichever is first, sits at the screen's edge while the player is
  outside a safe area (in the first levels, with a banner too). Entering the
  mist, the mist arriving, leaving a safe area after dark, or dark arriving
  outside one lights the player's lantern and opens one warning box (G14),
  once per night. A burning camp warns before its fire goes out.
  The lantern is the sign that the night has begun, not a shield: its light
  keeps nothing off, and only a safe place does (G30, G34).
- **G32 Health is the one bar.** The food bar becomes the health bar. Hazards
  take health; food, a first-aid kit and a night's sleep in town, at one's own
  burning camp or at another's as a guest with a deal give it back; low health
  slows work the way the empty bar did. A hunt outrun to a safe place gives
  back what its bites took, up to a share of the bar
  (`hazard.predator.refill_bp`, three quarters in the core); it never takes
  any, and health lost before the hunt is food's to give back. A hunt that
  ends at dawn, in a fall or at the last bell gives nothing back (DECISIONS.md,
  16.10).
  Nothing drains it by the clock (G28): there is no hunger timer, eating is how
  the player heals, and cooking keeps its purpose. Since P-5c (11.10) the
  core content sets `satiety_drain_per_min` to 0, in the same change that
  brought the first hazards; the field takes the name hp with the rename
  (DECISIONS.md, 10.10 and 11.10).
- **G33 A fall is clear, and it costs the outing.** At zero health the player
  falls: crosses for eyes, the body sinks into the ground, one plain box says
  what happened; no gravestone, nothing left in the world. The player reappears
  in the town they were last in, on a random tile inside its bounds (before the
  first town: where they started). An outing runs from leaving a safe place
  (G30) to reaching one again, or to a fall. What was gathered on that outing
  is lost, nothing spent on it comes back, each quest goes back to the step it
  stood at when the outing began, and a place found on it counts only once
  brought home; nothing marks where the fall was. The bag from before the
  outing, the camp, the gold, the levels and the quests already done are
  untouched. The cost is the lesson:
  a bad fruit eaten on the way means the basket is gone and the walk is made
  again.
- **G34 A hazard is a rule, not a roll, and the answer is a run, never gear.**
  Each hazard acts by a rule the player can learn, and no thing bought or made
  answers it (DECISIONS.md, 9.10 and 10.10). A hunting hazard (the wolf, the
  hidden pit, the trap, deep water at night) is escaped by running back to a
  safe place (G30: the town, all ground at danger level 0, or a camp whose fire
  burns), and the run is hard
  and possible; the rest are avoided by knowing the rule: the trap shows by
  day, the pit is where the floor is broken, the herb is bad raw and safe
  cooked, deep water is the river without its bridge at night. Food, a
  first-aid kit and a bandage give health back (G32); they heal, they do not
  answer a hazard. Chance, where a rule has it, runs through the kernel's own
  random stream so the server at stage 2a can replay it. Road thieves wait for
  weapons (G35).
- **G35 No fighting.** Predators are hazards, not enemies: the answer is to run
  back to a safe place, never gear. Combat stays where the spec puts it (stage
  8, or a community vote), and the road thieves of the boards entry wait for
  it.

- **G47 A watched road is a rule the eyes can read.** A predator that rounds
  after dark walks a closed loop at one pace, its place set by the clock
  alone; it sees a cone ahead of it, half as wide as it is long, and smells
  one tile around it; cover (reeds, tall grass) hides from the cone and never
  from the smell. Seen is the chase of G34, and the way out is the run back.
  The window to cross is learned by watching the eyes in the dark, never told
  by a number. The check holds a stealth quest to it: its target lies inside
  a round's watch, with cover on the way (section 8). Added 2026-10-13
  (DECISIONS.md, the entry on the three frames).
- **G48 A fire is kept by hand.** A fire holds a few logs and burns them on
  the game hour, only while the player is in the valley; feeding it by hand
  lights it or adds a log, a whole one or none (a fire with no room left for
  a whole log refuses it and the log stays in the bag: effort is never
  wasted), nothing bought or made makes it burn longer, and
  it warns before it goes out (G31), never before a log fits, and a prop may read by a fire (`lit_by`), its words shown only while it burns. A night kept by a fire is a night at the
  screen: nothing keeps a fire while the player is away (G28). Added
  2026-10-13 (the same entry); a log goes in whole since 2026-10-14
  (DECISIONS.md, the entry on the full fire).

### Expeditions

- **G36 An expedition is the valley's dungeon.** A place entered under a clock,
  three to five problems of different types inside (G17) with hazards among
  them, a climax, a reward that opens a place by day, and a soft failure: what
  was not found waits for the next night, what was carried out stays; a fall
  inside it is G33. The first is the night ruins under the bells.
- **G37 An expedition is never the only road.** The valley by day goes on
  without it; an expedition opens places sooner, never alone.

- **G49 The last bell walks you out.** Inside an expedition the bells are the
  clock on screen; at the last bell the mist walks the player to the exit
  with no damage, and the outing closes there. What the chain gained stays,
  the climax is reached once, and a quest of the chain begins only inside the
  place inside its window. An action other than a move made after the last
  bell is not made: the walk-out comes first. Added 2026-10-13 (DECISIONS.md,
  the entry on the three frames).

### Crafting

The owner's words of 2026-10-09 (DECISIONS.md, the crafting entries of that
day); the audit behind them is `docs/design/CRAFTING_AUDIT.md`.

- **G38 Crafting is a road, not the road.** A player who never crafts
  progresses by the roads already written: hard quests, treasure and digging,
  riddles, mastery of the minigames, the expedition and reputation, fenced by a
  profession or character level where a road needs it. War, theft and robbery
  stay out (G35, G28), except later in the areas between players that a player
  chooses to enter, once combat comes ([SETTLEMENT.md](SETTLEMENT.md) 3.9).
- **G39 Power is never sold.** No crafted ability, recipe, material or tool is
  sold or gated for money or premium currency. Only a look item with no effect
  may carry the premium marker, and it keeps a way to get it in the game. A
  look bought with money or premium currency is bound to the account: never
  traded, never sold to the trader, so money never turns into gold. The same
  look found in the game trades like any item (DECISIONS.md, the entry on
  bought looks). Premium currency is bought with money only, and is never
  bought with gold, traded, given or turned into gold; it counts on no board.
  Gold never turns into money either: the creators' money fund and the gold
  pool of D5 stay apart (DECISIONS.md, the entry on prices and gold).
- **G40 A craft can miss, and a miss keeps something.** Skill decides the
  chance and luck only tilts it; a miss is never nothing (G15): it keeps part
  of the inputs and makes nothing else. The value table prices a recipe at
  perfect execution, and luck closes the gap to that output without passing
  it (R9). A recipe's level is no wall: each missing level takes a step off
  the chance, down to nothing, a try at nothing still runs and misses, and
  the screen never shows the chance or the level a recipe wants.
- **G41 Two ladders.** The tier says how advanced a thing is, the rarity how
  often it appears. A recipe climbs one tier at a time, at a station of its
  tier and at a level inside the tier's band. From tier 3 up a thing comes
  only from a gated source - a level gate (the node's, or the band of the
  recipe that makes it, below which its chance falls), a slow respawn, a find
  table or a quest reward - and no shop sells it.
- **G42 Rare is capacity and gates, never a timer.** How many nodes, how slowly
  they return, their hours, the level and the tool they ask, the find tables.
  Waiting is never paid (R6), no event timer or "last chance" makes a thing
  rare (G28), and the rarity bonuses of the whole world share one budget. Two
  written exceptions, both on the real calendar (DECISIONS.md, the entries on
  the calendar). The valley's holidays: what only a holiday gives is a look or
  a title marked with the year, that year's only, bound to the character and
  never traded; the holiday comes back every year and gives its own that year
  (G28). Things of one season of the year, back every year: each shares its
  class with a thing found all year, so no recipe, quest step or tool waits
  for a season, and missing one costs a wait, never a use.
- **G43 A long recipe is a chain of short steps.** Intermediate things made at
  stations, one tier per station step, every action inside the action cap.
  The journal shows the question, not the whole chain (G3).
- **G44 Worn things help work, a little.** A hat, a top, trousers or one full
  outfit, shoes, two pieces of jewelry and the tool in hand. Each gives a
  small bonus to gathering or crafting from the closed list of effects, a full
  set a little more, all through the one calculator under the level's power
  cap; nothing raises the output of a craft (R9). A look layer sits on the
  same slots, apart. A weapon waits for combat (G35).
- **G45 New materials join old recipes.** Every item names a class and a
  tier, and a recipe template asks for a class, so a new herb works in an old
  recipe. Extensions add items, classes under a base class, recipes,
  templates, resources, treasures, camps with an existing station and quests;
  a new verb, station, profession, effect or parameter comes in a core
  release. Metal waits for its discovery.

### Menace

Added 2026-10-10 by the sweep for holes, and changed the same day on the
owner's word (DECISIONS.md, the entry on menace with a limit).

- **G46 Menace with a limit.** Danger shows through shape, sound and the dark,
  and blood, a wound and a fallen body may show too, within a limit: nothing
  lingers, nothing is shown close up, no gore is there for its own sake, and no
  suffering is played for show. Blood and a wound show small and brief, at the
  sprite's own size. A person, the player or a character of the valley, never
  bleeds or shows a wound at the moment of harm: the hit shows the health it
  takes, and a wound on a person shows only afterwards, as a bandage or a torn
  sleeve. A fall keeps its look (crosses for eyes, a sinking into the ground,
  G33). It is visual only and changes no rule, number or state. The text says
  the player fell, never that they died or were killed, since the player wakes
  again in town. The aim is ESRB E10+ and PEGI 12.

### What this page covers, and what lives elsewhere

| Topic | Where | State |
|---|---|---|
| The opening and onboarding | [FTUE_RESEARCH.md](../FTUE_RESEARCH.md) | Written; roadmap phases 2 and 3 open. |
| Loop and hook, quests, riddles, reading, builds, choices, feel, session, variety, dialogue, sound, fairness, access, danger, expeditions, crafting, menace | This page | Rules G1-G49. |
| Economy and balance | The kernel rules R1-R12, `content/core/params.json`, `pnpm values` | Enforced by code. |
| Art and sprites | [docs/creators/README.md](../creators/README.md) | Enforced by the kit check. |
| Community: requests, votes, merges, conduct | [CONTRIBUTING.md](../../CONTRIBUTING.md), [docs/loop/README.md](../loop/README.md) | Live. |
| Difficulty curve and pacing beyond the ladder | [SETTLEMENT.md](SETTLEMENT.md) 3.6, one internal difficulty scale (S3, 9.10) | The scale is written; the pacing waits for play data from the hub's usage section, after P-3. |
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
| Hunger clock | A bar that empties by the clock, awake or asleep (the drain is 0 since P-5c). | G32, G28 |
| Gear answer | A thing bought or made as the answer to a hazard: oil, a torch, a rope, an antidote. | G34 |
| Empty miss | A missed strike that gives nothing at all. | G15 |
| Quiz talk | A topic list with one right pick, or a line that exists to explain. | G19, G23 |

## 5. Known breaches on 2026-10-07

Found by the owner playing the preview. He ruled on five the same evening and
on the sixth row on 8.10 (the "decision" column); the GRUNT items P-1 to P-4
carry the work. Rows 1 to 6 are closed in the content since 8.10 (P-1 and P-3,
one pull request); the "decision" column says how.

| What | Rule | Proposed fix (recommended default) | Decision |
|---|---|---|---|
| `core/collection-shelf`: four branches and a shard build a shelf that opens the journal's items tab. | G10 | Remove the camp. The journal already has its Log button and the J key. The `shelf` slot stays empty with its sign until it has a real function (a trophy shelf whose placed finds change what NPCs say) or is dropped. | Yes (owner, 7.10). Remove the camp now; the slot's future is a separate question. Done 8.10 (P-1): the camp is gone, the slot stays empty. |
| `core/three-fruits`: bring 3 redberries. `core/herbs-for-pell`: bring 4 herbs. Both are the gather verb repeated. | G1, G2 | Rewrite each around one thing to notice. Berries: Maru says they grew thickest where the bells rang; one bush near the bell ruin gives the three in one strike at the right time of day. Herbs: Pell says the best herbs stand where the mist is thin at noon; the herb that counts only yields at midday. Both need the `find` step (P-2). | Yes (owner, 7.10) to both rewrites, with the `find` step. Done 8.10 (P-3): "Where the bells rang" finds a bellberry in the garden behind the ruins (05:00 to 20:00), "Herbs for Pell" a sunleaf on the sun bank up the river (11:00 to 14:00, with a basket). Both are new timed plants with items of their own, since a find of what the stall sells or what grows in three places is a counter with a clue on it. |
| `core/a-coin-for-maru`: dig in the ruins for an old coin. | G2 (borderline) | It is already a find with a hint. Add the catch: the coin is under the statue that faces the hills, and the first dig elsewhere gives a shard and a hint. | Yes (owner, 7.10). Keep, add the catch with P-3. Done 8.10 (P-3): "The coin under the lantern", a riddle over the marked stone and the two lantern statues, answered by a dig under the hill lantern; a dig elsewhere while it is open gives what that spot gives and "Not here. Read the stones again." |
| The seven inscriptions (the carved marks, two lantern statues, the stone head, the scratched names, the cold arch, the totem with fresh grass). Reading any of them changes nothing. | G8, G9 | One riddle ties the three ruin stones: the marks name the order the town was restored in; at night the lantern of the statue facing the hills glows and lights the tile to dig. The other four are seeds of a later arc (someone was here recently): each stays only if P-3 names the arc it pays into, otherwise it is cut until that arc exists. Needs the `riddle` step and prop ids (P-2), then the content (P-3). | Yes (owner, 7.10). One riddle across the three ruin stones; the other four are cut until an arc names them. Done 8.10 (P-3): the three carry ids and clues of two lines; the four notes are cut, the props stay. |
| `core/herbs-for-pell` and `core/a-coin-for-maru` reward gold and reputation only. | G4 | Herbs: Pell teaches herb stew. Coin: Maru opens the elder's house (a place). | Yes (owner, 7.10). As proposed. Done 8.10 (P-3): herb stew for the herbs. The coin gives Maru's basket, the stand-in for a place: the schema has no place reward yet, and the quest needs a trowel, so the basket opens the grove to a player who chose the ruins first. |
| Maru's first meeting is eight boxes, most over two phone lines; Pell's standing lines run to three boxes. | G14, G21 | Maru: three boxes at the first meeting (who he is, what he wants, where to go); the rest moves behind the three topics that already exist. Every box within two phone lines. Pell: two boxes per standing. | Yes (owner, 8.10). With P-3. Done 8.10: Maru three boxes, the rest behind his three topics; Pell two per standing; every box within 80 characters. |

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

For every pull request that touches play. Twelve questions, yes or no; a "no"
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
9. Does a miss turn up something, and does the change hold with reduced motion
   and without colour? (G15, G29)
10. Did the owner play the preview, or did the reviewer play it for him and say
    so in the pull request?
11. Does any blood, wound or fallen body stay small, brief and never there
    for show, with none on a person at the moment of harm, does it change no
    rule or number, and does the text say the player fell, never died? (G46)
12. Does the valley by day still go on without every expedition: does each
    item, place and quest it touches have a road by day as well, and is its
    place entered one way, through its exit? (G36, G37)

## 8. What the check enforces

`pnpm check` runs the `play` rules (`tools/src/play.ts`) on every content
file, core and extensions alike. They were warnings (`!` lines) on 2026-10-07,
when the core content itself broke them; since P-3 (8.10) the core content
passes and every line is an error that stops the check. What a rule cannot
test stays with the checklist above.

| Rule | What is tested | Today |
|---|---|---|
| G2 | A quest outside the opening chain whose steps are all `bring` or `visit`, where no `bring` is of a findable item (only digging gives it, or one timed plant). | error |
| G4 | A quest outside the opening chain that rewards gold and reputation only. | error |
| G8 | A note prop with an id that no riddle cites, one line per prop; note props without an id, one line with the count. | error |
| G10 | A camp with neither a station nor a bag bonus. | error |
| G17 | A quest with no `type`; two consecutive quests of one type in a `requires` chain; fewer than five types among the first ten quests. | error |
| G14, G21 | A character's first meeting over three boxes, a standing over two, a topic over four; boxes over 80 characters, counted per character. | error |
| G30 | A hazard prop (predator, pit, trap, deep water) with no id or touching safe ground (the town's cobbles, a slot marked `safe`, the first camp slot); a pit, trap or deep water that is solid, or any but a predator with a reach. The schema refuses a hazard with no window (`night`; `mist` comes with P-6); a bad fruit or herb needs none. | error |
| G15 | A node with no miss table, or a miss row that is not a thing with a value. | needs the miss tables (CR-60) |
| G34 | A predator with a walkable tile in its reach from which no road leads to a safe place, or from which the run to the nearest one costs a whole fall in bites. No field of the schema can name an item as a hazard's answer. | error |
| G36 | An expedition whose place is not an area slot, whose chain repeats a type, has a quest with no type, counts fewer than three or more than five or does not run each quest on the one before, with no hazard inside its place, with a bell outside the night or out of ring order, a quest of its chain with a giver or in another expedition's chain or opening a restore outside the place, a reward that opens something that is not a restore, a step of its chain outside its place (a visit's slot, a restore, a build, a riddle's props or its answer, a tend step's fire) or a find in it whose item nothing inside the place gives, an exit that is not safe ground (the camp's ground is not: no part of it may stand yet), a place that can be walked into from anywhere but its exit (on the map by day, and once every passable restore of the valley is mended) or whose exit leads into none of it by day, an exit whose corner tile, where the walk-out sets the player, cannot be stood on, or a climax slot outside its place. | error since the `expedition` kind (NEXT 14a) |
| G37 | A quest of the opening or of another creator in an expedition's chain; a restore whose input only an expedition gives (its reward or a quest of its chain), or a restore that opens by no hand and only an expedition's reward names, unless a quest outside every chain opens the place; a quest outside every chain that requires a quest of a chain, or that brings or finds what only an expedition gives. | error since the `expedition` kind (NEXT 14a) |
| G47 | A stealth quest whose target (the find's slot or the visit's slot) lies outside the watch of a predator's round; a round that is not a closed loop of adjacent tiles on walkable ground (its own den counted as ground), or that touches safe ground; a round with no cover prop inside its watch. G34's run to safety walks from every tile a round watches. | error since the round (NEXT 12a) |
| G48 | A `tend` step on a prop that is not a fire; a fire prop with no id; `lit_by` naming a prop that is not a fire; fire params whose warning opens before a log fits (`warn_min` over `cap - 1` logs of burn). | error since the fire (NEXT 13a) |
| G41 | An item with no class or tier, or a tier the world has not opened; an output more than one tier above its highest input; a recipe level outside its tier's band; no camp part giving the recipe's station at its tier; no craft profession for the recipe; from tier 3 up, a node with neither the tier's level nor a slow respawn, or a shop that sells it. | error |
| G42 | The rarity bonuses of the merged world over `rarity_budget_permille` (kernel review 8.2). | error |
| G45 | A class that is neither a base class nor declared under one; a metal item or a class under metal; a recipe template that fits nothing, has no class input, or fits more than `template_max_recipes` combinations. | error |
| G39 | The premium marker on anything but a look item with no effect, or on a look that nothing in the game gives. | error |
| G40 | A craft chance that rises with the tier; a miss worth as much as a success. The kernel keeps part of the inputs on every miss and makes nothing else. | error |
| G44 | A garment or jewelry piece that is not worn, or worn outside its places; the hand for anything but a tool; an effect over its tier's cap or named twice; a look with effects or a set; a set of one piece, of another creator, or that cannot be worn whole; a cap on worn effects that falls with the tier. | error |

Since P-2 (8.10) G2 counts `find` and `riddle` steps as beats, a `find` may name what
only digging gives or what one timed plant gives (P-3), and G8 checks each
note prop with an id against the riddles that cite it. Sound (G24-G27), fairness (G28),
access (G29), the warning and the fall (G31-G33, G35) and the rest of G37 live in code, not in
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
