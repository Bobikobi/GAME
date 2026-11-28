# Effects in the valley

Every action and encounter a player can do or meet in the first valley, what it showed before the valley-effects lane (public #918),
and what it shows now. The valley stage's row "effects in the valley": every moment gets its effect before the whole world comes in.
Things a player meets are listed by `pnpm valley:inventory` (`docs/design/VALLEY_INVENTORY.json`); this file lists the *moments*.

Lines are `game/src/scenes/world.ts` unless a file is named, as of the lane's first pull request.

## 1. How the effects are built (one layer)

- **One layer.** Every effect of the world plays through `game/src/effect-layer.ts`: the pack's sheets (`effects.ts` `EFFECTS`), and
  the code-drawn parts of a *moment* (`effects.ts` `MOMENTS`): a `burst` of the scene's own pixel textures, the ground's own bits
  (`ground`: dust on a path, leaves on grass, grit in a ruin, nothing on water; thrown from both sides of the feet and drawn over the
  figures, since a body standing on its own dust hides it), the water's `ring` (`ring.ts`), the soft `light` of a
  success (`jolt.ts` `SUCCESS_LIGHT`), and a struck body's white `flash`. The work's bursts, the walk's puff, the sinking stone's rings
  and the success light that `world.ts` drew on its own now go through the same layer, one emitter per texture and flight.
- **The event adapter.** `momentsOf(events)` turns a batch of the kernel's events into moments and where they lie (on the player, a
  tile, a hearth or a foe). The jump's takeoff and landing and the fish's catch are laid by the scene, which knows when they happen.
- **The rules held by test** (`game/test/moments.test.ts`): a success never flashes a body and no moment moves the camera (DECISIONS
  2026-10-18: the camera is `jolt.ts`'s alone, for danger); every burst throws a texture the scene makes; at most 12 bits a part, every
  flight under a second; with the motion group off only the light and the flash play.
- **The check before building the mechanism** (five minutes, memory, every fact `(unchecked)`): Phaser's particle emitters, Godot's
  one-shot `GPUParticles2D` beside an `AnimatedSprite`, and Unity's pooled VFX prefabs share one form: a named effect is data, an event
  spawns it at a point, the runtime pools and frees it. Ours was half of it (the sheets had a table, the code bursts were calls scattered
  through `world.ts`). The meeting point: a table of named moments, an event adapter and one pooled layer, which is what was built; the
  research file `open-tools-1124/answers/10-effects.md` names the same form (its step 1, here at about a third of its size).

## 2. How the leading games show the same moments (five minutes, memory)

Every fact is `(unchecked)`: no page was open.

- **Path of Exile 2** (the level bar): a struck enemy flashes white for a frame or two; a heavy blow freezes the frame a moment; the dodge
  roll throws dust; a level is a column of light on the character with a sound; loot lands with a sound and a short beam. `(unchecked)`
- **Diablo IV:** footsteps raise dust by ground; a level is a burst of light on the hero; gold flies to the purse; a struck body flashes;
  a death throws the body and dust. `(unchecked)`
- **Hades:** a struck enemy flashes white; a crit freezes the frame; the player's hurt reddens the edges of the screen; the dash leaves
  dust and an after-image. `(unchecked)`
- **Stardew Valley** (for the work): a chop throws wood chips and leaves, a rock break throws stone bits, a hoe throws dirt, a tree falls
  with a small shake; a fish caught leaps out of the water in a splash with drops; food eaten shows only the bar rising. `(unchecked)`

**The gap, three lines.** (1) A struck body's own white flash, which all four have, was missing: now built (`hurt`, `foe-hurt`).
(2) A level showed only on the screen's banner, never on the one who rose: now a light and rising sparks on the figure. (3) The
frame-freeze on a heavy blow (hit-stop) is not built: the fight is not wired into the game yet, so it waits for it (§5).
Not significant enough to stop for: it goes in the pull request bodies.

## 3. The table

State: **had** an effect before the lane; **new** built by the lane; **none** still has none (with why).
"Sound only" or "a word only" counts as no effect on the world; the screen's own words (banners, toasts, the purse) count as an effect.

### Work and gathering

| # | Moment | Before | Should have | Now |
|---|---|---|---|---|
| 1 | A blow on a tree | chips, leaves past 40 %, the tree shakes and leans (`blow` 4249) | as is | had |
| 2 | The tree falls | it falls away from the cutter, leaves, dust, a small shake (`fall` 4301) | as is (an impact, not a success) | had |
| 3 | A blow on a stone | dust, sparks, chips growing with the work (`blow` 4249) | as is | had |
| 4 | The stone splits | chips, dust, sparks thrown wide, a small jolt (`breakStone` 4289) | as is | had |
| 5 | A blow of the spade | dirt, the spot squashes (`blow` 4249) | as is | had |
| 6 | A dig spot dug out | a burst of dirt (`finishWork` 4243) | as is | had |
| 7 | Picking (berries, herbs, mushrooms, reeds) | leaves on each pull and at the end (`blow`, `finishWork`) | as is | had |
| 8 | Fishing: cast, wait, reel | the rod, the line, the float, a ring where it lands, fish shapes (`fishing-view.ts` 55) | as is | had |
| 9 | A fish caught | the plop's sound only | a ring and drops where it comes out | **new** `fish-catch` (4191) |
| 10 | An item gained | its picture rises over the head and fades (`celebrate` 4383) | as is | had |
| 11 | Bag full | a sound and the kernel's words | as is (a refusal is a word) | had |
| 12 | Cooking or making at a station | the made thing rises over the head (`gain`), a sound | as is | had |
| 13 | Food eaten | a sound only | a few motes rising off the body | **new** `eat` |
| 14 | A tool breaks | a crack's sound only | splinters and a spark at the hand | **new** `tool-broke` |
| 15 | A level | the jingle and a banner across the screen (`ui/feedback.ts` 39) | also a light on the one who rose, sparks going up (a success: no shake, no flash) | had + **new** `level` |
| 16 | Coins earned or spent | coins fly to the purse, the sum floats (`ui/feedback.ts` 146) | as is | had |
| 17 | A first find, a recipe learned | a sound and the journal's page | as is (a page of the journal is quiet, G24) | had |

### Water and stones

| # | Moment | Before | Should have | Now |
|---|---|---|---|---|
| 18 | A step | a puff of the ground's own kind at the feet (`puffAt` 3336) | as is | had |
| 19 | A jump's takeoff | a sound only | the ground kicked back where the feet left it | **new** `jump-off` (4436) |
| 20 | A jump's landing | the pack's landing dust on dry ground, leaves on grass (`dustAt` 3329) | as is | had |
| 21 | A hard landing (two levels or more) | the red flash and the shake (`jolt.ts` 14) | also more ground thrown out, the body's flash | had + **new** `hard-landing` (4725), `hurt` |
| 22 | A deadly fall | the body sinks, crossed eyes, the screen fades (`fallDown` 4041) | as is | had |
| 23 | A small stone lifted | the pickup clip and a sound | also the ground it left | had + **new** `stone-lift` |
| 24 | A large stone lifted | the lift clip across the lift's time (4527) | also the ground it left | had + **new** `stone-lift` |
| 25 | Carrying it | the carry clip | as is | had |
| 26 | A large stone set down | a sound only | a thud of ground to both sides, dust | **new** `stone-down` |
| 27 | An object pushed | nothing (it is on the new tile) | the ground it scrapes onto | **new** `stone-push` |
| 28 | The charged throw held | the aim line grows on the ground | as is | had |
| 29 | The throw | the clip; the stone leaves the drawn hand | as is | had |
| 30 | A stone lands on ground | dust or the ground's puff (`dustAt` 3329) | as is | had |
| 31 | A stone sinks | three rings on the water (`ring.ts`, now drawn by the layer, `splashAt` 4698) | as is (DECISIONS 2026-11-23: a splash is a ring) | had |
| 32 | Rain | streaks and their landings (`rain.ts`, 2982) | as is | had |

### Fight and danger

The fight is not wired into the game yet (no attack action reaches the kernel from the valley; DECISIONS 2026-11-25). Its moments are
built and tested by event, and light up when it is.

| # | Moment | Before | Should have | Now |
|---|---|---|---|---|
| 33 | The chase's bite | the pack's starburst on the player, the red flash, the shake | also the body's own white flash | had + **new** `hurt` |
| 34 | Hurt by a hazard (thorns, cold) | the red flash, the shake (`jolt.ts`) | also the body's flash | had + **new** `hurt` |
| 35 | The player's blow lands (fight) | the spark or the starburst, the number, the foe's bar (`effects.ts` `spawnsOf`, `foe-bar.ts`) | also the foe's body flash | had + **new** `foe-hurt` (waits for the fight) |
| 36 | A foe's blow lands (fight) | the starburst, the number | also the body's flash | had + **new** `hurt` (waits for the fight) |
| 37 | A miss | the word MISS (`fightwords.ts`) | as is | had |
| 38 | A dodge | the word DODGE | also the ground kicked at the feet | had + **new** `dodge` (waits for the fight) |
| 39 | A guard | the word BLOCK | also sparks off the guard | had + **new** `guard` (waits for the fight) |
| 40 | A foe falls | its bar goes | the ground it hits, dust | **new** `foe-fall` (waits for the fight) |
| 41 | A predator notices the player | the jolt, the "!" over it, the growl (3827) | as is | had |
| 42 | A wolf's eyes in the dark | their glow and flare | as is | had |
| 43 | A hunt ends in a safe place | a sound only | a small light, a breath out | **new** `safe` |
| 44 | Small game taken by a stone, a snare checked | nothing | a spark where the stone strikes, the catch | **none**: the small game is not drawn (36 creature rows `missing` in the inventory); waits for its art |
| 45 | An animal fleeing | birds lifting from a tile (`liftBirds` 3109) | the hare and the roe bolting | had for birds; **none** for the rest: not drawn |
| 46 | A fish rising | a ring on the water (`ripple` 3138) | as is | had |

### The world's moments

| # | Moment | Before | Should have | Now |
|---|---|---|---|---|
| 47 | A quest taken | a sound and the toast (`toasts.ts`) | as is | had |
| 48 | A quest step done | the toast, the marker moves on | as is | had |
| 49 | A quest done | the jingle and the toast | also a soft light and sparks on the player | had + **new** `quest-done` |
| 50 | A mend or a build | dust, sparks, the soft light, the jingle (`celebrate` 4366) | as is | had |
| 51 | A fire lit | sparks on the hearth, the flame, its light (4378) | as is | had |
| 52 | A fire burning | the pack's camp fire loop or the drawn flame, smoke, light (1531, 1437) | as is | had |
| 53 | A fire out | the douse's sound only | a little smoke from the hearth | **new** `fire-out` |
| 54 | Dawn | the light turns, the day's summary (`light.ts`, `toasts.ts`) | as is | had |
| 55 | Night and day | the light layer, the lantern, motes and flies | as is | had |
| 56 | A place entered first | its name on a plaque (`ui/feedback.ts` 98) | as is | had |
| 57 | The far bell after the first mend | heard only | as is (it is far away) | had |

### The count

- **57 moments.**
- **Had an effect before: 48.** No effect on the world before: 9 (rows 9, 13, 14, 19, 26, 27, 43, 44, 53).
- **Have one now: 56** (for the fight's rows 35 to 40, once the fight is wired). Without one: row 44 and the hare's and roe's flight in
  row 45, both waiting for the small game's art.
- New moments built: 17 (`effects.ts` `MOMENTS`), every one by code, no new picture.

## 4. Pictures

Code reaches every moment above at the game's pixel scale; no moment needed a new picture, so no PixelLab generation was spent. A
picture would earn its place for the fight's slash arc and a hit-stop's flash once the fight is wired (DECISIONS 2026-11-02 names both
as lite effects), and for the small game's own flight once it is drawn.

## 5. Open

- The fight's moments (rows 35 to 40) and a hit-stop on a heavy blow wait for the fight to be wired into the game.
- Rows 44 and 45 wait for the small game's art.
- The 3D door is paused (the owner, 26.10): the moments' table is door-agnostic; `/play3d/` would play the same `momentsOf` through its
  own means when it resumes.
