# The content ladder: one world drawn at two strengths, and never a third (2026-10-30)

**Status:** Proposed 30.10, written for the owner. Nothing here is built, and nothing here moves the line: [TONE.md](TONE.md) stays the measure and G46 the rule. What this page adds is the rung below the line, who stands on it by default, and the one place a player may step down to it. It builds on what exists: the sign-up asks a full date of birth on a neutral screen and counts the exact age on the server (DECISIONS 2026-10-21, "The age gate aligned with the big companies"); the account then keeps "only whether the age check passed, and the country: no age band" (DECISIONS 2026-10-23, "Closing an account"; `server/migrations/0005_close_grace.sql` added `age_checked` and dropped `birth_band`); and the Settings window (#437) has an Accessibility group a row can join. One proposal here reopens the 23.10 line for one bit, and section 3 says so where it does.

The question behind it, asked 30.10: could the game draw at PEGI 18 for a player who says they are an adult, and stay at 16 for everyone else, with the stronger images as that player's extra? The answer is no, for three reasons that are each enough on their own (section 1), and the useful half of the idea points the other way: a milder drawing for the players under the line's age, with the same world under it (sections 2 to 5).

## 1. Why there is no rung above the line

- **A rating describes the strongest content in the game, not the default view.** PEGI and ESRB rate what the game contains; a switch that hides a scene does not take it out of the game. Cyberpunk 2077 ships a switch that covers nudity and carries PEGI 18 all the same. A game with an 18 rung is an 18 game: in every store that asks, for every parent who reads the label, for the open call and the community that are built on something that can be shown. TONE.md section 5 already says what happens when a store answers 18: "answered by cutting the scene that pushed it, never by moving the line."
- **A declared age is not an age check.** The sign-up asks a date of birth on a neutral screen, as the big companies do (DECISIONS 2026-10-21). That is the right tool for keeping a child out of an account, and the wrong tool for opening adult content to an adult: the UK regulator's January 2025 guidance lists self-declaration among the methods that are not highly effective age assurance. The methods it accepts (photo identity, facial age estimation, a credit card check, and the like) mean, in practice, a paid check by a third party; the project runs no such service and holds no child data at all (DECISIONS 2026-10-21), so a vendor check would be a new decision for the owner, not one already made. An 18 rung behind a date field would be an 18 game with a door that does not lock.
- **The world is shared, so a rung can only change the drawing.** Two players on one tile see one carcass, one wolf, one fall. The server steps the hunt once and pays once. If the rung changed anything the server counts (a drop, a grade, a take's seconds, a price), a player of fourteen would set the older date to earn more, and the older date is a line in a form. So whatever a rung is, it is a way of drawing the same state, and an extra that is only a drawing is not an extra that pays.

What stands: the line of 19.10, PEGI 16 and ESRB T, the tighter one holding (TONE.md). Below it, this page proposes one rung.

## 2. The two rungs, scene by scene

Two rungs, no third. **The line** is G46 as rewritten 29.10, nothing added. **Mild** is the line's drawing with its blood and its bodies left out: no blood, no wound, no body, close to the first entry of 10.10 ("Menace without gore", DECISIONS 2026-10-10, "The world and its clocks", superseded the same day by "Menace with a limit"), kept as a second eye on the same world. The game today draws no blood and no body at all, since no scene at the line has been built (TONE 6). The words are not on the ladder: the account is 13 or older by the country's rule, ESRB T allows the stall of TONE section 2, and a second script would double every line's checks and the story keeper's reading for no reader who needs it.

| Scene | Mild | The line (G46, TONE 3) | Not drawn at any rung |
|---|---|---|---|
| A hit on a person | The flinch, the health it takes, the sound | Blood where the hit lands, a few pixels at the sprite's size, gone with the scene | Blood that pools or sprays (PEGI 18's gross violence) |
| After the hit | Nothing stays on the body | A bandage, a torn sleeve or a scar that stays | A wound shown open |
| The predator's bite (the bank wolf, G34) | The same frame, the wolf at the player's side with its jaws on the sleeve, without the red mark | Drawn with its teeth in the player and a red mark on the sleeve (TONE 4, the bank wolf) | A mauling played out |
| The player's death (G33) | The fall as the combat frame draws it for both rungs, with no body left on the grass: the pack where it lay | The body lies in the grass for the card's seconds, then the pack where it lay | A body that is looted while the player watches it, a corpse dwelt on |
| A hunted animal's take | A fade and the goods (HUNTING 10) | A fade and the goods: HUNTING 10's default holds at the line too, no blood on an animal | Death throes, a cry, a finishing strike |
| The carcass while it is dressed | A neutral bundle on the tile until the dressing ends | The animal lying still, no blood, until the dressing ends (HUNTING 6; the dressing in parts is #431's, not yet merged) | Skinning shown, parts shown |
| A hurt animal's trail | None | None by default; TONE 3 allows "a trail of blood where a hurt animal went" and HUNTING 11 question 5 asks the owner | A wounded animal followed by its sounds |
| A stranger's body as a prop, bones by a ruin | Bones stay (they are a shape); a body is a cloak-covered shape or a cairn | A body on the ground as part of a place, never animated | A body arranged for effect |
| The dark, the wolf's eyes, the mist, the south's crows | As today, at both rungs | As today | Not a rating matter: menace is shape and sound (G46) |
| Alcohol at the inn, hard speech by sheet | As TONE 2, at both rungs | As TONE 2 | A joke about a drunk child, sexual words, slurs: TONE 2 already refuses them, as this game's own rule rather than a PEGI 18 criterion |

Three things the table shows:

- **Almost all of the line is a layer the mild rung skips.** Blood at a hit, the red mark of a bite, a bandage, a scar and a trail are drawn over the sprite; the mild rung draws the same sprite without them. The bite stays a bite at both rungs, so the shared words ("Teeth in your arm", TONE 4) match both drawings.
- **One thing is a substitution, not a layer:** the lying animal becomes the bundle while it is dressed. The bundle is the one new sprite the mild rung asks for, one per size (small, medium, large), with no species on it; and the player's body on the grass is simply left out.
- **The hunt is already at the mild rung at the line.** HUNTING 10 chose the stricter default for animals because PEGI 18 names "violence towards defenceless characters" and a grazing animal could be read so. The ladder changes nothing there: an animal's take is a fade at both rungs until the owner answers question 5 with a still, and the lying carcass is the only animal image the two rungs draw differently.

## 3. Who stands where

- **Why 16.** The tighter of the two ratings is ESRB T, 13 and up, and by that measure the line's images are 13-and-up images. The rung is set at 16 because PEGI's label is the one a European parent reads and the one the few boxed-sale laws enforce; open question 2 offers the account's own age as the boundary instead.
- **The account knows the age once, at sign-up, and keeps none of it.** The age is counted in the sign-up request and dropped (DECISIONS 2026-10-23: "no age band"). A rung by age therefore needs one bit kept on the account, `eye_line` (true at 16 or older), set in that same request. That bit is an age band of two values, the same 16 cut that `birth_band` carried: adopting it reopens the 23.10 line for one bit, and that is the owner's call (open question 1). Without it, the rung can only be a setting on the device, which a player under 16 can change.
- **The rung by default:** under 16, mild; 16 and older, the line. The opening every player plays before signing up, and the offline demo an under-age player gets instead of an account, are mild by necessity: no age is known there. The client receives the rung and never the age or the date: one word in the server's answer beside the public state, a field of `StateBody` next to `appears` (`server/src/api.ts`), never inside `PublicState`, which is the kernel's own type (DECISIONS 2026-10-20, "The public state as a type", draws that boundary).
- **One control down.** A player at the line may step down to mild in the Settings window (#437), one row in the Accessibility group: "Blood and bodies" with two values, shown and hidden, kept with the other settings and surviving a reload as they do. A player on mild by age has no row: the window shows the group without it, and nothing names an age. Nobody steps above the line.
- **One re-entry up, outside Settings.** An account that was under 16 at sign-up and has since turned 16 confirms its date of birth again on the account screen, a line every account has ("Confirm your date of birth"), which never mentions a rung; the same neutral screen and the same age rule set the bit, and nothing else is kept (open question 5).
- **Two players, one tile.** Player A at the line sees the hare lying and the red mark on player B's sleeve; player B on mild sees the bundle and the bite without the mark. Both see the same health bar move, the same goods appear, the same pack on the ground. The e2e proves it by capturing one saved state through both eyes (section 6).
- **A parent's answer in one line.** A player under 16 sees no image above the mild rung, on an account that already refused anyone under the country's age, with no date of birth held (DECISIONS 2026-10-21 and 2026-10-23). That is the sentence the open call and the stores get, and it costs one sprite, one bit and one word.

## 4. What the rung never touches

- **Nothing the server counts.** Drops, grades, the take's seconds, the dressing, spoilage, prices, the pack a fall leaves, the hazards, the hunt's cap: one value for every eye. The kernel does not have the word; only the server's answer carries it.
- **Nothing a rule needs seen.** The wolf's eyes, the player's pool, the fire's stage, the glint, the lantern post, the path and every tell of HUNTING 2 stay as visible on mild as at the line, under every weather (NATURE 4, "what never dims"). A rung hides blood and bodies; it never hides a warning.
- **Nothing in the words.** One script, one story keeper, one filter between players. The card reads the same on both rungs.
- **Nothing in the sound.** The bite's sound, the fall's thud and the card's hush are the same; a sound that only means gore (a wet tearing) is not made for either rung, since the line forbids it too ("nothing the camera, a sound or the screen dwells on", TONE 3).
- **No third value, ever.** A rung above the line is section 1's answer; a rung below mild would cut the menace itself, which G46 refuses ("danger shows through shape, sound and the dark").

## 5. The cost, and where it sits

- **Content:** three bundle sprites (small, medium, large), drawn once in the rich style through the kit route, picked by the owner from stills like every sprite. Everything else at the line is already planned as a layer.
- **Client:** one word in the server's answer; one `if` where a layer is drawn (blood, the bite's mark, wound, trail), the bundle for the lying carcass, the player's body left out; one Settings row. It joins the Settings window after #437 lands and the first scene at the line is built (TONE 6: the stills, then the sprites), not before: until a scene at the line exists, every player is on mild by construction and there is nothing to switch.
- **Server:** if question 1 is answered A, one boolean column `eye_line` set in the sign-up request from the exact age it already computes, one additive migration, and the field in `StateBody`; the re-entry is the same neutral screen and the same age rule. If it is answered B, nothing on the server.
- **Checks:** section 6's rows, one test each.

## 6. The check rows and the measurables

What the tests hold once the rung exists. The kit has no field for a rung today; the first two rows need one word on a kit sprite or layer in the kit manifest (`rung: 'line'`), which the pull request that builds the rung adds.

- `x kernel: the word "eye" or a rung value read anywhere in kernel/src (the rung is a drawing)`
- `x client: a kit layer marked rung 'line' drawn without reading the rung`
- `x client: a kit sprite marked rung 'line' that is a substitution (the lying carcass) with no mild counterpart named`
- `x settings: the "Blood and bodies" row shown to a session whose rung is mild by age`
- `x accounts: a column that holds a date of birth, or an age band beyond the one bit of question 1`

Measurables for the pull request that builds it:

1. One saved state, two captures at 390 x 844 (mild and the line) of the bank wolf's bite and of a hare's carcass under dressing: the same HUD, the same goods, different images; both in `docs/design/frames/`.
2. `grep -rn "eye\b\|'mild'\|'line'" kernel/src` finds nothing; in `server/src` it finds only the account column and the answer's field.
3. The Settings window at 16, 18 and 20 text with the new row: no text under 16 px, the row's control at 44 x 44 or more (#437's measures, repeated).
4. The e2e opening is untouched: the opening and the demo play on mild, and the opening's fall stays as built until the combat frame lands the card and the pack for both rungs (G33).

## 7. Open for the owner

Each one sentence, three options, A the recommendation, and the default this page is written on.

1. **The rung by age, at the price of one bit on the account.** A (recommended): keep `eye_line` at sign-up, reopening the 23.10 "no age band" line for that one bit and nothing more. B: the rung as a device setting only, mild for everyone until a player switches, nothing on the account. C: no rung; the line for every eye, and an under-16 account sees G46's images. Default: A.
2. **Where the boundary sits.** A (recommended): 16, PEGI's label. B: the account's own age, 13 or the country's, as ESRB T allows, which makes the rung a setting only for those who want it. C: 18, which would put 16 and 17 year olds on mild. Default: A.
3. **The opening and the demo, played before any age is known.** A (recommended): mild, and an account's opening is not redrawn afterwards. B: mild, and the opening is redrawn at the line once a 16-plus account takes it over. C: a question at the opening's start, which would be an age screen outside the account. Default: A.
4. **The bundle's look.** A (recommended): a tied cloth in the rich style, the size of the animal's footprint, no species on it. B: a shape under leaves. C: nothing on the tile, the dressing shown in the HUD only, which hides the dressing's place from other players. Default: A.
5. **The account that turns 16.** A (recommended): one re-entry of the date on the account screen's "Confirm your date of birth", which sets the bit and keeps nothing; an entry that gives an age under 16 does nothing. B: the bit is fixed at sign-up, and support changes it on request. C: keep the month the account reaches 16, which is the date of birth by another name. Default: A.

## Sources

- PEGI, "What do the labels mean?": PEGI 16 "once the depiction of violence (or sexual activity) reaches a stage that looks the same as would be expected in real life"; PEGI 18 "gross violence, apparently motiveless killing, or violence towards defenceless characters".
- ESRB, "Ratings Guide": T (13 and up) and M (17 and up) and their descriptors.
- Ofcom, "Guidance on highly effective age assurance" (16 January 2025): self-declaration is listed among the methods that are not highly effective.
- CD Projekt Red, Cyberpunk 2077: a nudity censor in the settings; PEGI 18, ESRB M.
- In this repository: [TONE.md](TONE.md) (the line, sections 1 to 6); [GAME_RULES.md](GAME_RULES.md) G33, G34, G46; [HUNTING.md](HUNTING.md) sections 2, 6, 10, 11 and 12; [NATURE.md](NATURE.md) section 4 ("what never dims"); DECISIONS.md 2026-10-10 ("The world and its clocks" and "Menace with a limit"), 2026-10-20 ("The public state as a type"), 2026-10-21 (sign-in as built; the age gate aligned with the big companies), 2026-10-23 ("Closing an account": no age band; "The line is PEGI 16 and ESRB T"); `server/migrations/0005_close_grace.sql`; `server/src/api.ts` (`StateBody`); pull requests #431 (the dressing in parts) and #437 (the Settings window).
