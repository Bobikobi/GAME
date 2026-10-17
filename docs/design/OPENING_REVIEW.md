# The opening, reviewed, and how to renew it

A review of the opening as it stands on `develop` (aa903eb, 2026-10-17), from the first frame to the entrance of the night ruins, and a proposal for its renewal. Docs only: nothing here is built, no rung of [GAME_RULES.md](GAME_RULES.md) section 2 moves (G59), and every look that changes goes to the owner as stills first (the direction rule). Asked by the owner on 17.10 as step 1 of "the order from here" ([DECISIONS.md](../../DECISIONS.md), 2026-10-17).

## תקציר (עברית)

1. הקרס שאושר ב-10.10 (ערפל שנסוג, אבן החוזרים, שורת התעוררות) עדיין לא נבנה. לשחקן אין סיבה משלו להיות כאן, והפתיחה נפתחת ב-3 תיבות טקסט, בעוד שהסולם מרשה תיבה אחת.
2. בריצת רובוט של הכפרי יש 254 שניות של שעון משחק בין המטלה האחרונה לחושך בלי שום תגמול במסלול הראשי (עמוד 1 מתיר 90). אדם איטי יותר ויחכה פחות; זה עוד לא נמדד על אדם.
3. "עשן מעל העיירה" שולחת לעקוב אחרי עשן שאי אפשר לראות מהמחנה, והכפרי מקבל שתי משימות "מיומנות" ברצף (עמוד 3). הפעמון שעל האבן המסומנת לא נשמע לפני כן אף פעם.
4. ההצעה: לבנות את הקרס כפי שאושר, B2 קודם; בתיקון הגשר הערפל נסוג לפחות 13 משבצות (7 שאושרו לא מחברים את שלוש הכיסים), פעמון רחוק נשמע, ועשן העיירה מופיע בקצה המסך. האבן הופכת למקום הראשון שבו יעמדו שמות של אחרים: עכשיו שמות כתובים, אחרי חשבונות שמות אמיתיים מאחורי מסנן.
5. שום שלב בסולם לא זז. שלוש שאלות לבעלים בסעיף 6: ניסוח שורות ההתעוררות; איך מוצאים מטרה ל-250 השניות לפני החושך; האם לשתול עשן רחוק מעבר לעמק עוד לפני שהקרקע שלו קיימת.

## 1. How it was timed

- **The run.** A copy of the opening e2e ([game/e2e/opening.ts](../../game/e2e/opening.ts)) in headless Chrome, with a recorder in the page that polls the player every 80 ms and logs each bag change, quest change, mended place, gold change, recipe, dialogue box, toast, minigame and level window with the session tick. The copy is a throwaway under `.scratch/` and is not committed.
- **Clock.** Times below are the play clock: one game hour is 50 s, the game starts at noon, dusk (19:00) is at 350 s, dark (20:00) at 400 s, and the clock stops while a box is open. A robot is a floor: it reads instantly and never doubts, so a human is slower in every row. Wall-clock seconds are not used, because the machine ran at a load of 10 to 14 (12 logical cores) while the runs went, which stretches the wall time and not the play clock.
- **What was measured.** The forager, on a phone-sized screen, from the first frame to the threshold of the night ruins (finished, 473 s of wall time, 412 s of play clock at the threshold). The digger and the explorer runs were queued behind other sessions' heavy jobs when this was written (`~/.claude/tools/heavy.sh` waits for CPU under 90%), so their columns below are **estimated** from the map and `walk_step_ms` (190 ms a tile), and are marked `est.`. Nothing in the gaps section rests on an estimate.
- **Not measured at all:** a human. The recording test of pillar 1 ("time the gaps in a recording") still wants a person playing the opening three times.

## 2. The map

One row per step. *Gap* is the play-clock time since the last new thing the player can see (a find, a line, a level, a door, a changed tile; pillar 1, at most 90 s). *Kind* is the question kind of the quest (pillar 3: the same kind twice in a row is a counter).

### The forager (measured)

| t | Step: what the player does | The world's reason: who asks, why now, what for | Hook: what pulls to the next step | Gap | Kind |
|---|---|---|---|---|---|
| 0 | Wakes. Three boxes, six taps: "You wake by the river at noon, a basket on your arm and an axe at your belt." / "Herbs grow on the bank to the west. Pick a few while the sun is high." / "The bridge east lost its keystone to the shallows. The valley lies beyond." | Nobody asks. The player's own reason is not stated. | A place to go (the west bank) and a place after it (the bridge). | start | none |
| 4 | Picks two herbs on the west bank (the timed pick). | The intro: "while the sun is high". | Level 2 and a skill point at 7.7 s; the bridge is named in the intro. | 4.0 | skill (`bring`) |
| 10-13 | Walks to the bridge, strikes the keystone free (`core/keystone`, +1). | The intro: the keystone is in the shallows. | The keystone fits the bridge. | 8.5 | skill |
| 14-20 | Mends the bridge. Box: "The bridge holds. You scratch "Mended by {name}" into its sign." / "Under it hangs a purse: thirty gold, a tool's price. Fell a tree before dark." | The purse hangs there; nobody hung it. The deadline is the dark. | A new task: a fire before dark. | 0.0 (pays at once) | skill (second in a row) |
| 30-40 | Fells a tree (3 logs), builds the campfire at the camp. | "Before dark": at danger level 0 the fire burns no wood and nothing hunts (G30), so the deadline has no stake. | New task: "Smoke over the town". | 10.6 | mastery |
| 45 | Walks to the town square. Box: "Two neighbours could use a hand: Elder Maru by his house, and Pell at her stall." / "Each says what the help is worth. Whom you help first is yours to choose." | "Follow the smoke": no smoke is in the frame from the camp (section 3, G4). | Two named people. | 5 | discovery (`visit`) |
| 50 | Meets Maru. Three boxes. Asks for berries; "Whom you help first is yours." (the same sentence, third time). | Maru: his berries, "where the bells rang". | Reward named: a trowel. | 5.4 | fetch_twist |
| 54-61 | Reads a ruin sign at 54.3 s, picks three bellberries at 60.7 s. | Maru's request. | A walk to the berry patch. | 10.4 | fetch_twist |
| 73 | Hands in the berries; gets the trowel and a new quest at once: a coin buried under a lantern. | Maru: he buried a coin the day the bells first rang. | Reward named: 20 gold and a recipe. | 12 | riddle |
| 77-127 | Reads the marked stone (89 s), the lantern statue (100 s), digs under the hill lantern at dusk (127 s). | Maru's riddle, three stones. | Each stone narrows the lantern. | 12.2 and 11.4, then 17.0 | riddle |
| 144 | Hands in the coin: 20 gold, the herb tea recipe, and "They say the broken arch shows a way after dark." | Maru. | The arch, after dark. | 10 | discovery (`riddle`) |
| 154-400 | **Waits for the dark.** Nothing on the main path. | The arch only opens after dark. | None. | **254.5** | none |
| 400-412 | Dark box at the lantern. Arch: "The mist draws back from the broken arch. A way runs under it now." Threshold: "Past the arch the ruins go on, darker and deeper than by day. Far below, a bell rings once." | The night. | The ruins beyond. | 4.2 | discovery |

### The digger and the explorer (estimated; first minute only)

| Step | Digger (wakes at 9,23) | Explorer (wakes at 7,6) |
|---|---|---|
| Wake text | Three boxes: "You wake south of the broken bridge at noon, a trowel in your hand." / "The bank slid in the night. Something hard lies in the turned earth." / "Dig it out, then make for the bridge: its keystone lies in the shallows." | Three boxes: "You wake on the high ground north of the river at noon, a staff in your hand." / "Your senses are sharp. Walk, and they lead you to what others pass by." / "Make for the broken bridge: its keystone lies in the shallows." |
| First task | Dig the slid bank at (11,25), 4 tiles away (`core/buried-axe`, discovery). `est.` first pay under 10 s. | Walk to the glint at (11,19), 13 tiles south and 4 east, and pick up the axe by hand (`core/glint-by-the-bridge`, investigation). `est.` 3 s of walking, first pay under 10 s. |
| Then | The bridge strike (skill), the same as the forager from here. The bank to the keystone at (12,18) is about 8 tiles. | The bridge strike (skill), the same from here. |
| Kind chain | discovery, skill, mastery, discovery, fetch_twist: no repeat. | investigation, skill, mastery, discovery, fetch_twist: no repeat. |

From the bridge on, all three starters share the road: fire, town, whom to help first, Maru's coin, the arch. The measured forager's row is the floor for all three from the fire on. The explorer's first walk crosses 13 empty tiles with the pocket not drawn yet, so it is the start most at risk once B2 draws it (section 4.1).

## 3. The gaps

Each against logic (a reason the world gives), hook (what pulls on), pillar 1 (a new thing at least every 90 s), pillar 3 (the question kind) and the ladder.

| # | Against | Evidence | Weight |
|---|---|---|---|
| G1 | Hook, logic | No line gives the player a reason of their own. The three intros say where the player is and what to do, never why. The approved fix of 10.10 (the mist pocket, the mist drawn back by the bridge, the name carved at the bridge, a waking line) has no NEXT section and is not built: the only mist is a sprite at alpha 0.1 ([game/src/scenes/world.ts:988](../../game/src/scenes/world.ts#L988)), and DECISIONS 10.10 itself says "not built". | Biggest |
| G2 | Ladder (0:00-0:15), pillar 2 | The ladder says "Never: more than one box of text" for the first 15 s. Every starter opens with three boxes and the forager run counted six taps before the first move (the test logs "6 clicks for 6 advances"). | High, cheap to fix |
| G3 | Pillar 1 | **254.5 s** of play clock with nothing new on the main path, from the coin hand-in (143.7 s) to the dark (400.0 s). The longest gap before it is 17.0 s. The quest says "after dark" and the dark comes at a fixed 400 s whatever the player does. A human reaches the coin later on the play clock than the robot's 144 s, because the clock runs while a human walks and stops while a human reads, so the human's wait is shorter, by an amount nobody has measured. | High (a ceiling breach on a fast path) |
| G4 | Logic, hook | "Smoke over the town" says "Follow the smoke to the town square" ([content/core/quests/into-town.json](../../content/core/quests/into-town.json)). The smoke thread is drawn only while its chimney is on screen ([game/src/scenes/world.ts:768](../../game/src/scenes/world.ts#L768)). In the frame at the end of the fire (the camp, phone size) a house roof is in view and no smoke is. The cue the task names is not the cue the player sees. | Medium |
| G5 | Pillar 3 | The forager's first two quests are both `skill`: `core/first-pickings` then `core/fix-the-bridge`. The digger (discovery, skill) and the explorer (investigation, skill) do not repeat. | Medium, forager only |
| G6 | Logic | "Fell a tree before dark" and the purse's "before dark" have no stake at level 0: the fire "burns none at danger level 0, where the opening's camp stands" and the town and level-0 ground are safe at every hour (G30). Maru then says "Stay by the fire after dark. The mist is kinder by day." and the next rung sends the player to the arch after dark. The words push one way and the ladder the other. | Medium |
| G7 | Logic, hook | The marked stone reads "Bridge, fire, bell, cut in a row. Under the bell, a lantern facing the hills." The player has met the bridge and the fire and has never heard a bell: the only bell sound is the ruins' bed ([game/src/audio/ambience.ts:141](../../game/src/audio/ambience.ts#L141), every 60 to 120 s, in the ruins) and the one line at the threshold. The stone's third word has no referent until the end. | Medium |
| G8 | Pillar 2 | "Whom you help first is yours (to choose)" is said three times in a row: the `into-town` done box, Maru's first meeting and Pell's first meeting ("help whoever you like first"). | Low |
| G9 | Logic | The bridge's purse ("thirty gold, a tool's price") hangs at the bridge, and the first thing a player can spend it on is a stall 15 tiles away, reached about 30 s later. Nobody left it. A line cannot say who without stating the past (S1), so it needs a speaker (S2); the carved stone is that speaker (section 4.3). | Low |

What is **not** a gap, so nobody fixes it: after the first task the gaps are 5 to 17 s; every task has a named reward and an on-screen cue; whom-to-help-first is a real choice (G12): both plants are open from noon until dark; the ladder's rungs hold their order on all three starts.

## 4. The renewal

### 4.1 The hook, built as approved (G1, G2, G4, G7)

The four parts are the owner's of 10.10; nothing below changes them except the one number in the list of corrections.

1. **A mist pocket for each starter.** Each wakes in a clear circle of 5 tiles inside B2's mist (the look of [frames/2026-10-10-receding-mist.png](frames/2026-10-10-receding-mist.png): near-black `#3a3554`, an ordered 4x4 dither, clear for 5 tiles, then 6 tiles of thickening, at least 96% at the map's edge). Its first task pushes the mist back: the clear circle grows from 5 to 7 tiles while the herbs, the dug earth or the glint are taken.
2. **The bridge pushes the mist back.** The mend clears the mist around the bridge, the three pockets join into one valley, a bell rings once, far off, and every place restored after it pushes the mist back further.
3. **The name carved at the bridge.** The "Mended by" sign ([world.ts:2303](../../game/src/scenes/world.ts#L2303), [world3d.ts:1288](../../game/src/play3d/world3d.ts#L1288)) becomes the returners' stone: the camera glides down the names of those who came back before, to the last empty line, and the player carves their own.
4. **A plain waking line per starter**, replacing the three boxes (question Q1 for the wording).

**Corrections to the approved numbers** (a builder's detail; written into DECISIONS when the build lands, unless the owner objects):

- The approved criterion is "when the bridge is mended, the clear area reaches at least 7 tiles around it". The three wake tiles sit 8 (forager at 6,17), 8 (digger at 9,23) and 13 (explorer at 7,6) tiles from the bridge (14,17). A radius of 7 does not join any of the three pockets. The pockets would stay as islands, which is the opposite of "the three pockets join into one valley". **Proposal: at least 13 tiles**, which covers all three wakes; the town (15 tiles away) stays under the mist until the first town visit, which is a reason to go (section 4.2).
- The first-task push cannot lean on B2 alone: the explorer's glint is 13 tiles from the wake, outside a 7-tile pocket. The pocket must draw the glint's direction (a faint mote of light at the circle's edge, read as a sign by the senses attribute) or the explorer's walk goes through mist at 10% visibility. A still decides (section 7).

**What is needed to build it, in order** (each a small pull request off `origin/develop`, per [PARALLEL.md](../team/PARALLEL.md); a change to a shared file lands first):

0. **Stills** (section 7), then the owner's pick, then everything below. B2's look is already approved; the stills are what the changes around it look like.
1. **B2 first.** The classic client's mist layer: one layer in world space with the dither, the 5-tile clear circle and the thickening ring, with `world.ts:988`'s sprite removed. The 3D door draws its own fog (`play3d/scenery.ts`, per-slot mist planes) and has no pixel dither; B2 there is a separate look and not a part of this build. Tests: the criteria in section 5, run on a captured frame, not by eye.
2. **A schema step** (additive, format stays 1): a `mist` radius on a restore and a pocket radius on a starter, so the kernel stays integer-only and the client only draws what the content declares; the mist's state is a pure function of the save (the starter's wake, the first task done, the places restored), which is also why a reload keeps it.
3. **Pockets and the first push.** The three starters; the explorer's glint cue.
4. **The bridge's moment.** The 13-tile clearing in at most 3 s, the far bell (the `bell` sound exists in [game/src/audio/sfx.ts](../../game/src/audio/sfx.ts); a far one is the same sound, quieter and low-passed, no new asset), and the town's smoke at the edge of the view (4.2).
5. **The stone and the name.** Today `start` takes and checks the name and the title screen asks for it ([game/src/ui/title.ts](../../game/src/ui/title.ts); kernel `step.ts`, 1 to 16 letters, digits, spaces, `_`, `-`). Carving at the bridge means `start` accepts an empty name and a later action sets it; a save made before keeps its name and its stone line. The opening e2e asserts `Mended by Tess` and must be rewritten in one pass (AGENTS.md: grep every renamed string first, then the single test file, then `pnpm verify`, then `pnpm e2e` last).
6. **The waking lines and the one-box intro**, and the e2e's six-click assertion.

**Risks to name before building.** Typing a name on a phone mid-flow is a keyboard over the world: a long beat with no pay inside it. The mend's pay (the tile, the bell, the stone) lands first and the carve follows as the last beat, with a default so a player who does not want to type is not stopped; the owner decides the default's wording at the stills. The carved name is the first place a typed word reaches other eyes (section 4.3).

### 4.2 Plant the endless world in the first session (G4, G7, G9)

The owner's word of 17.10: from the first session a player must feel "this world is huge", while the opening never moves (G59) and nothing promises ground that is not built.

- **At the bridge's mend**, when the mist draws back and the pockets join, a column of smoke stands at the **edge of the view**, in the direction of the town: the smoke of the D1 pick (single puffs, bending a little at the top, held at the view's edge when its true place is off screen). The town is 15 tiles away, so at the first clear radius it is outside the view and the marker is the thing seen. It fixes G4 with no new content: "Smoke over the town" now has the cue it names, and its first appearance is the bridge, not the camp. It teaches the language the world will use for every far place: a column of smoke is somewhere to go.
- **The far bell** rings from a direction with no place in it. It promises sound and nothing drawn, and it makes the marked stone's "bell" (G7) true before the stone is read.
- **The edge of the valley keeps B2's thick mist**, at least 90%, a look that "will lift" (17.10: the part opened so far keeps still 1's look). It is a place the mist holds, never a wall that the player is told is final.
- **What waits for the first ring** (the owner's 17.10 entry: the first ring is about 192 x 192 tiles, built after v0.1.5): a second smoke beyond the valley. That is question Q3, because it is a promise.

### 4.3 Plant the others (G9, stage 2a)

The returners' stone is the first place where other players' names will stand.

- **Before accounts (stage 1, as now).** The stone shows six names cut by earlier hands, written content, one word each, and an empty line under them that the player carves. The stone is the speaker of every line on it (S2): it says that people came back and carved a name, nothing about why or when (S1). It agrees with Maru's "You are like the first ones who came back. They did not stay." and with his "Every house here was mended by someone. The signs say who." The names are written by the team, so a word filter is not needed yet, and the stone is local to the save.
- **After accounts (stage 2a).** The same stone shows the names of the players who mended this bridge in this world, oldest first, the player's own at the first empty line. The written six stay at the top as the first ones. The town's mended-by signs follow the same rule: the world shows who mended it. A name that reaches another player's screen needs a word filter first (10.10, part 3). DECISIONS 17.10 says the same in its retry clause: if showing names proves to need chat-level moderation, presence waits for it.
- **What the stone does not do**, before and after: no list of friends, no count of players, no chat, no rank. It is a mark of the valley, never a board (STORY section 1: "A player's mark is left in the valley, never in a prophecy").

### 4.4 What moves, and what does not

No rung moves. The bridge stays in the 0:15-1:00 and 1-5 minute rungs, the town and the coin in 5-8, the arch in 8-10; the wake tiles, the bridge, the camp, the town and the arch keep their places (G59). Everything above adds payoff inside a rung. Two things touch the ladder's words and are sent to the owner (section 6): the wait before the dark (G3), and a far smoke that would be a promise.

## 5. Criteria for the build

Each is something a test or a capture can check. The first four restate the owner's approved criteria of 10.10.

1. No mist inside the 5-tile circle around the character, at spawn, for each of the three starters (a frame test per starter).
2. At least 90% of the pixels at the map's border are mist; from the character outward the mist only thickens (a capture and a count).
3. When the first task is done, the clear radius is 7 tiles within 1 s and stays after a reload.
4. When the bridge is mended, the clear area reaches **at least 13 tiles around the bridge within 3 seconds** and stays after a reload (the 10.10 text says 7; section 4.1). All three wake tiles are inside it.
5. The bell rings once after the mend, never twice, and is not heard before it; the far bell is quieter than the threshold's bell.
6. The stone shows at least six written names above one empty line; the carved name is the player's; a save made before the stone loads with its old name on the stone.
7. The first box of the opening is one box of at most two lines of 80 characters (G14), and the first movement is possible after at most one tap.
8. In the timed run of each starter (forager, digger, explorer) no stretch passes 90 s of play clock without a pay between the wake and the threshold, **including the wait before the dark** (Q2). The timed run is the one in section 1; the human recording is the final word.
9. The smoke marker at the view's edge points at the town and moves with the player; at night it dims with the world.
10. Nothing hunts in the opening's ground: G30 and G31 stand as written.

What stays for the owner to judge on a real phone: the shade and density of the mist, how loud the bell is, how the dither shimmers while walking, whether the smoke marker reads as a compass.

## 6. Owner questions

Three, each with one recommendation, in the shape of GAME_RULES section 6.

**Q1. The waking lines**

```bash
To the product owner, a product question in the game:
Asked: the plain waking line for each starter (10.10, part 4: "the plain set waits for the owner"), by the opening review
Breaks: nothing; the 10.10 set was approved as an idea and its text is yours to give
The player would feel: one box, two lines, what they hold and what to do first, instead of three boxes
My recommendation: these three, each at most two lines of 80 characters, with the mist in the first
  Forager: "You wake in a clear patch of mist, a basket on your arm." / "Herbs grow on the bank to the west. Pick some."
  Digger: "You wake in a clear patch of mist, a trowel in your hand." / "The bank slid in the night, south of you. Dig there."
  Explorer: "You wake in a clear patch of mist, a staff in your hand." / "Something shines by the broken bridge, far to the south."
Needed from you: yes (the wording, or "change the second lines")
```

The bridge and the keystone then come from the task tracker, which already shows the quest's clue, so the third box of today's intros goes without losing the information.

**Q2. The 250 seconds before the dark**

```bash
To the product owner, a product question in the game:
Asked: what the player does between Maru's coin and the dark, a gap of 254 s in the robot's run, by the opening review
Breaks: pillar 1 (a new thing at least every 90 s), and the ladder's 5-8 minute line only if the answer is a later start
The player would feel: with nothing added, a wait or a walk with nothing in it; with the answer below, the second plant, and a reason to stay
My recommendation: keep noon and fill the wait. Maru's last box already points at the arch; add "Pell still waits for herbs" there, and let the unchosen plant (Pell's herbs, a stew, a recipe, 30 gold, all built and open from noon) carry the minutes. Alternative that keeps the rule: start the day at 15:00, dusk comes about 150 s sooner, but "past noon" and "at noon" are in the starters and the first-fire quest, the hill lantern's hour moves, and the ladder's table moves with it.
Needed from you: yes / no (keep noon and fill; or move the start)
```

I recommend filling because the fix serves every player, fast or slow, and the later start serves only the fast ones, while it changes the words of all three starts. The unchosen plant is already built (Pell's herbs, 30000 mg, the herb stew) and the timed run did not take it, which is why 254 s looks empty in the robot's run and is shorter for a player who does.

**Q3. A far smoke before its ground exists**

```bash
To the product owner, a product question in the game:
Asked: one more column of smoke, beyond the valley's edge, planted in the first session so the world feels huge (17.10, "from the first session a player must feel this world is huge"), by the opening review
Breaks: OPEN_WORLD draft G55, "A far bank is scenery now and a promise later" (a far view promises nothing that is not built and a shut line "says only what is true")
The player would feel: a place out there to go to, at the bridge's mend; if no place ever stands under it, a promise that was not kept
My recommendation: not yet. Plant the town's smoke and the far bell now (section 4.2: both are true today) and add the far smoke, one line of content, when the first ring's first stamped place exists, in the first release that carries it. Alternative that keeps the rule: plant it now and write in DECISIONS the place the first ring will stamp under it, and move the smoke with the place.
Needed from you: yes / no (now, or with the first ring)
```

## 7. Stills a changing look needs (not made)

Phone size, 2 or 3 each, each testing one named difference, picked by the owner before any build (the direction rule). They are **not** made here.

1. **B2 at wake, per starter.** Three frames, one per start (6,17), (9,23) and (7,6), at the first frame. The difference tested: what the pocket looks like with its starter's task in it, and the explorer's cue to a glint 13 tiles off (a mote of light at the circle's edge, or nothing).
2. **The stone.** The camera glide and the carve: the last empty line, the six written names, and the keyboard (or its default) at phone size. The difference tested: where the camera stops, and whether the carve is a beat or an interruption.
3. **The smoke at the bridge.** The mist drawn back to 13 tiles, the town's smoke at the view's edge (single puffs, bending at the top), and the same frame at night. The difference tested: the marker at the edge against the same smoke at its true place when it fits in view.

## 8. Notes

- **A flake in the opening e2e**, seen once on a loaded machine (load 12 to 13): "expected a choice 'I will do it', but no dialogue is open" at Maru's hand-in (the quest was accepted). A `talkThrough` race. Not touched here; whoever owns the e2e may want it.
- **The brief cited "G8: a promise must be kept".** GAME_RULES G8 is about notes that no quest, treasure or character refers to; the promise rule is the OPEN_WORLD draft's G55, which is what Q3 cites.
- **Human timing is still owed.** The digger and explorer runs and a person playing the opening are the missing evidence; the gaps in section 3 are the forager's robot floor and the content itself.
- **Rungs and rules checked:** G12 (a real choice), G14 (two lines, 80 characters), G17 and G18 (type and motion variety, not affected), G21 (a topic waits for the world: the stone's names change as the world changes), G30 and G31 (nothing new hunts), G59 (growth never moves the opening), the section 6 format and the direction rule.
