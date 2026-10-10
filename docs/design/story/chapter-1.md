# Chapter 1: the mist draws back

A draft for the owner, written against [STORY.md](../STORY.md) (rules S1-S6)
and the hook chosen on 2026-10-10 (DECISIONS.md, "The hook is the receding
mist"). Nothing here is built. After the owner's word on each beat, the
beats are played as a Twine draft on a phone, then become content.

## The question

- **The chapter asks:** who rings the bells?
- **It answers (a bone, S3):** *when* they ring. A bell rang once when the
  bridge was mended, once more at each place mended after it. The bells ring
  when someone mends.
- **It opens (S6):** the bells rang for the first ones who came back too.
  Who mended then, and why did they leave?

Nobody says *who* rings them. Each belief has its own answer, and none is
right.

## The beats

Session 1 follows the recut B of the opening (pull request #50, minutes 0-10)
and lays the hook over it. Days 2 and later are new.

| # | When | What the player does | Type | The mist |
|---|---|---|---|---|
| 1 | Minute 0 | Wakes in a clear pocket inside dark mist. One waking line for each starter (below). The starter's own first task: the forager picks, the digger digs up its axe, the explorer finds its axe by the senses. | the starter's own | The task pushes the pocket out a little. |
| 2 | Minutes 0-2 | The keystone strike mends the bridge. The "Mended by" sign is the returners' stone: the camera glides down the names to the last empty line, and the player carves theirs. | `skill` | Draws back from the bridge, the pockets join, one bell rings far off. |
| 3 | Minutes 2-4 | The dry log in the wet reeds, found by the senses. The fire. Maru comes to the smoke. | `investigation` | - |
| 4 | Minutes 4-6 | Pell's stall: the basket or the trowel, and the first rumour of why the mist moved. | the choice (G12) | - |
| 5 | Minutes 6-8 | The three stones name the hill lantern; at dusk it glows and lights the tile to dig. The old coin. | `riddle` | - |
| 6 | Minutes 8-10 | After dark, the arch shows a path to the threshold of the night ruins. Inside, a bell swings. Nobody is there. The session ends here. | `discovery` | - |
| 7 | Day 2 | Asks Pell the right question about the bell, and gets the three tellings (one for each belief). | `persuasion` | - |
| 8 | Day 2-3 | Maru's lanterns: keep the one by the ruins lit through one night, so the path stays open. | `tending` | - |
| 9 | Day 3 | The bell's rope in the ruins hall is frayed. Mend the rope and ring the bell, tie it still, or leave it as it is. Each leans toward one belief (section 4 of STORY.md), and all lead on. | `dilemma` | Whatever the choice, the hall is mended, and the mist draws back from the ruins. |

No two types in a row repeat (G17), and the first ten quests cover more than
five types. The fall, the hunt and the night's danger (P-5) stay outside
session 1: the night of beat 6 is at the town's safe edge.

## Who says what about the past (S1, S2)

The narrator says what is there now: "The bridge holds." "A bell rings, far
off." "The mist draws back." Every line about the past has a speaker:

| Speaker | Line (draft) | Belief |
|---|---|---|
| Maru, beat 3 | "The mist pulled back. I saw it from the square. It does that, when someone mends." | Menders |
| Maru, day 2 | "The bells rang the day the first ones came back. I was small. I remember the sound, not the hands." | Menders |
| Pell, beat 4 | "Why did the mist move? Three answers, one coin each. The first is free: you mended something." | none |
| Pell, the Wakers' telling | "Some say the bell is a waking call. Ring it enough and what sleeps down there gets up." | Wakers |
| Pell, the Keepers' telling | "Some say the bell is a warning. It rings when we dig where we should not." | Keepers |
| The returners' stone | Names, worn, one under another. The last line is empty. | - |

## How each belief reads the clues (S4)

| Clue | Menders | Wakers | Keepers |
|---|---|---|---|
| The mist draws back from a mended place | What is tended is remembered. | Something under the valley is waking. | We are waking what was better asleep. |
| A bell rings with nobody there | It thanks whoever mended. | It calls the sleepers. | It warns us off. |
| Names on the stone, older than anyone | Others mended before us. | They woke something, and it took them. | They dug too deep, and the mist took them back. |
| The lantern glows at dusk on its own | It keeps watch for us. | Something down there is still awake. | It marks a place to leave alone. |

## The waking lines (waiting for the owner)

One object, one plain fact. The idea is approved; this wording is not yet.

- Forager: "You wake with a basket on your arm. It isn't yours. It fits you perfectly."
- Digger: "Your trowel hits something. An axe, buried. Its handle fits your hand."
- Explorer: "You walk straight to a hidden axe. You knew it was there. You don't know how."
- All three, after it: "The mist stands close all around. Only around you is it clear."

## What it needs

- **The mist** (DECISIONS.md, the B2 look): drawn by the client from what the
  player has restored. Each restore names how far it pushes the mist back (an
  optional field on the restore, so the format stays 1). The kernel does not
  change.
- **The name at the bridge:** `start` accepts an empty name, and a new action
  sets it at the stone (kernel, integers and text only).
- **New content:** the persuasion, tending and dilemma quests of beats 7-9;
  Pell's three tellings; Maru's remarks with a `when` (S-1, pull request #51);
  the rope in the ruins hall as a restore. The dilemma waits for the lean and
  the choice step (S-4).

## Open for the owner

1. The waking lines above.
2. The dilemma of beat 9: three answers (ring, still, leave), or two.
3. The names already on the stone: a few written names of the first ones, or
   only worn marks nobody can read.
