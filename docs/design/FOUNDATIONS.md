# The foundations: base rules of a shared world, against RuneScape, World of Warcraft and Drakantos

Status: a clean page, proposed 19.10.2026 for the owner, read after [WORLD_STRUCTURE.md](WORLD_STRUCTURE.md) (the structure: one world, the ground, the edge, safety, fights, travel, who changes what). The target the owner set is a game of that family: one persistent world shared by many, a character that grows, quests, combat, a market, groups. This page starts from what every such game must settle, not from the rules already written. Each rule is one sentence a check or a test can hold; then what the three reference games do, where Openfold stands today (**settled** with the rule's id, **half** written in part, **open** needing a decision), and the pick. The open ones are the questions in section 11, asked one at a time; the ones answered on 19.10 are marked there.

Facts about the three games are their public design as players know it; where a game has not said (Drakantos is in beta), the cell says "not public". `GAP_WOW_RS.md` (8.10) and `GAP_DIMRAETH_DRAKANTOS.md` (18.10) hold the play and art comparisons; this page holds only the foundations. The line-by-line review of the rules already written is `RULES_REVIEW.md`; once the owner answers this page, the kept rules hang under it.

Short names: OSRS = Old School RuneScape; WoW = World of Warcraft; DRK = Drakantos.

## 1. Authority: who decides what is true

| Rule | OSRS | WoW | DRK | Openfold today | Pick |
|---|---|---|---|---|---|
| **F1. The server is the only truth.** The client proposes, the server computes every change with the same pure step, and a client that disagrees is corrected. | Yes; the whole world runs server-side on a 0.6 s tick, the client is a viewer. | Yes; the realm server owns the state. | Not public; an MMO of its kind has no other way. | **settled**: R1-R4; accounts and all gameplay state on the server (18.10); the opening carried by replay. | As is. |
| **F2. The same inputs give the same world on every machine.** One seed, integers, canonical order; a replay hashes the same on the server and the client. | Partly; the server is the only run, nothing is replayed on the client. | Same as OSRS. | Not public. | **settled**: R1-R4, reactions "read, never run". Stronger than either: the server can check a client by replaying it. | As is. |
| **F3. One clock for everyone, and nothing waits for a closed window.** | Yes; world events and resets are server time. | Yes; realm time, daily and weekly resets. | Day and night per world, by its site. | **settled**: one hour for all from stage 7 (10.10), every time names its clock (CR-93). **half**: what runs for a player who is away (camp, fire, holds). | Write F3's second half: see Q8. |

## 2. Identity: one person, one place in the world

| Rule | OSRS | WoW | DRK | Openfold today | Pick |
|---|---|---|---|---|---|
| **F4. One account per person per world, one unique filtered name.** | One account may hop between worlds; several accounts per person are allowed, trading between them is not. | Many characters per account, one name per realm. | Heroes are picked inside one account; names not public. | **settled**: one account per person per world (10.10); the name after the opening, unique, through the filter (3.8). | As is; stricter than OSRS and WoW on purpose, since one person with two accounts is the root of every economy exploit. |
| **F5. Registration asks the least, after play, and age gates words, never play.** | Email and password before play; age for chat and content. | A Battle.net account before play. | Steam account before play. | **settled**: 3.8 and the account's age (9.10): the demo has no account, the account comes when the opening ends. | As is; none of the three lets a player in before an account, Openfold does. |
| **F6. A player always gets the account back, and nobody else can.** | Jagex account with authenticator and recovery questions; a long history of hijacks before it. | Battle.net with authenticator; support never logs in as the player. | Steam's. | **settled** 19.10 (W2): an external login (Google, Apple, Steam; the 18.10 entry also names email and Discord), no password of the game's own; recovery is the provider's; support never enters a character. | As answered; DRK's road. |

## 3. Persistence: nothing a player did is lost

| Rule | OSRS | WoW | DRK | Openfold today | Pick |
|---|---|---|---|---|---|
| **F7. A save always loads, forward only; wealth after a migration is never above wealth before.** | Characters from 2013 still load; removed items are converted. | Same; old items converted or kept as legacy. | Beta wipes announced. | **settled**: R5, G67, G52, "a save always loads" (10.10). | As is. |
| **F8. Nothing is taken from a player who is away, and absence never destroys what they made.** | Nothing decays; a house stays. | Nothing decays; a guild bank may be emptied by its own officers. | Housing not public. | **settled**: G28, SETTLEMENT S1b (a plot returns with notice and a refund; the house stays the owner's), paused with houses. FFXIV's 45-day demolition is the counter-example. | As is. |
| **F9. A fall costs the outing, never the account.** | Death keeps three items; the rest waits at a gravestone for a fee and a timer. In the Wilderness the killer takes them. | A corpse run and durability loss; nothing lost for good. | Not public; co-op action games respawn with a small cost. | **settled**: G33, G65 (never more than a set walk home). | As is; Openfold loses the outing's finds only, never gear or made things, which is softer than OSRS and matches WoW. |

## 4. Fairness: the same rules for everyone

| Rule | OSRS | WoW | DRK | Openfold today | Pick |
|---|---|---|---|---|---|
| **F10. Power is never sold.** | Bonds: real money buys membership and bonds trade for gold, so money buys gold, not items directly; a standing argument. | The WoW Token: money buys gold. | Free to play; skins, styles and dyes sold; "no pay to win" stated. | **settled**: G39, two funds that never meet, a look may carry a premium marker. | As is; stricter than OSRS and WoW (no money-to-gold path at all), the same line as DRK. |
| **F11. Machines do not play.** Usage, votes and rewards count validated action logs; a client's own report earns nothing; one account at the ceiling earns the cap. | Detection and ban waves; bots are the oldest war in the game. | Detection, bans, the Token as a pressure valve. | Not public. | **settled** in the kernel: R10, the daily cap at the kernel's ceiling, the exploit-loop entries. **settled** 19.10: a caught account is held for review (its clocks stop, as 3.2 says) and the owner decides; the gains are wiped, never the character. | As answered. |
| **F12. Prices are one checked table, with a band between players; every mint and burn is bounded and has a reason.** | The Grand Exchange: a market with buy limits per item per 4 hours; item sinks (death fees, repair); the duplication exploits of 2000-2010 are the warning. | The auction house, gold sinks (repair, mounts), inflation managed by hand each expansion. | A market; details not public. | **settled**: R6-R12, "prices and gold" (10.10), the sale fee, `trade_max_permille`. | As is; the band between players is the one thing neither OSRS nor WoW has, and it is what keeps bots from setting prices. |
| **F13. Rate and reach are capped by level, never by payment or by hour of day.** | Experience rates by level and gear; members' content faster. | Same, plus paid level boosts (a counter-example). | Not public. | **settled**: R9, P(level). | As is. |

## 5. Interference: what one player may do to another

| Rule | OSRS | WoW | DRK | Openfold today | Pick |
|---|---|---|---|---|---|
| **F14. Progress is each player's own, except where the world says "between players".** | Resources are shared: a tree one player cuts is gone for all; competition for spots is part of the game. | Phasing and personal loot since 2008: most content is per player; some rare nodes contested. | Co-op dungeons are instanced; the field not public. | **settled**: 10.10 (SW1), 3.9: per-player nodes everywhere but the areas between players. | As is; WoW's model, not OSRS's, so a newcomer never finds the world used up. |
| **F15. What one player does never takes from another.** A player's act may open a way, a place or a node for others, and never closes, blocks, burns or empties what another can reach; only the world closes a way. The areas between players are the one exception. | No blocking of tiles (players walk through each other in most places); no building in the world. | No collision; no building in the world. | Housing exists; rules not public. | **half**: nobody blocks a way, each player's yield, the fire words (19.10); the general sentence is REACTIONS section 10's open line. | Q3: adopt the sentence as G76. |
| **F16. Nobody is hurt where they did not choose to be.** | PvP only in the Wilderness (a warning at its edge) and in minigames; everywhere else none. | PvP realms were replaced by War Mode: PvP is a switch the player flips in a city. | Ranked PvP, opt in. | **settled**: 3.9, protection levels safe / wild / contested; entering an area between players is the consent; 19.10 (W8): one marked zone in the wild where anyone may attack anyone, nowhere else. | As is; OSRS's model, confirmed 19.10. |
| **F17. Combat is between willing sides, and a fall there costs only the outing's finds.** | The killer takes what the victim would have lost. | Nothing lost in PvP. | Not public. | **settled** in words (3.9, G35 after the foundation 19.10). **open**: the combat frame (verbs, foes, the encounter tick, the fall cost). | Q10. |

## 6. Conduct: words, safety, age

| Rule | OSRS | WoW | DRK | Openfold today | Pick |
|---|---|---|---|---|---|
| **F18. Words pass a filter and a ladder; a player can mute and block anyone at once, for good; a report reaches a person.** | A profanity filter, an ignore list, a report button with reasons, player moderators, a mute ladder. | A filter, an ignore list, reports to Blizzard, squelch by reports. | Not public; a Steam game inherits Steam's block. | **half**: the words filter and ladder, the languages of notes (10.10); chat comes last (17.10). **open**: mute, block, reports, who reads them. | Q4. |
| **F19. The age rating is a line the content check holds.** | PEGI 7 / ESRB T, no blood. | ESRB T / PEGI 12. | Not rated yet. | **settled**: G46, menace with a limit, aim PEGI 12 / ESRB E10+. | As is. |
| **F20. No dark patterns: no timers that punish absence, no last chance, no loot boxes, no nagging mail.** | Treasure Hunter (a loot box) is RS3's, not OSRS's, by a player vote. | A monthly fee and a shop; no loot boxes. | Not public; free-to-play games live or die on this line. | **settled**: G28, the mail rule (3.8), G42. | As is. |
| **F21. A player's data is theirs: the least is kept, nothing is sold, and a player can leave with the data deleted.** | Jagex's privacy page, deletion on request. | Blizzard's, with export. | Steam's. | **open**: nothing written on deletion, export or a privacy page. | Q5. |

## 7. Growth: how the world and its content change

| Rule | OSRS | WoW | DRK | Openfold today | Pick |
|---|---|---|---|---|---|
| **F22. The world only grows; a shipped place is never removed and the opening never moves.** | The map has only grown since 2013; Lumbridge is where it was. | Cataclysm (2010) remade the old world: the counter-example players still argue about. | Beta; not public. | **settled**: G57, G59, "the world has no end" (17.10). | As is; OSRS's rule. |
| **F23. Content is data that passes one check, and anyone may propose it; one hand approves until five have landed.** | Content by the studio, but every change passes a player poll at 70% yes: the community decides, the studio builds. | The studio alone. | The studio alone. | **settled**: the loop, `pnpm check`, one approval until five creators (18.10). Openfold's own: the community builds, the check keeps it one world. | As is; add OSRS's half: Q11, a vote on direction once there is a community (D1 of the kernel review already says the first vote is after the foundation). |
| **F24. A change to the rules is one dated entry, and the pages say the latest word.** | Patch notes and polls. | Patch notes. | Dev blogs. | **settled**: DECISIONS.md, `pnpm rules`. | As is. |
| **F25. Resets and seasons run on the real calendar, told in advance; a holiday's reward is that year's only.** | Holiday events yearly, their rewards later returned (a counter-example). | Yearly holidays, weekly resets. | Seasons planned. | **settled**: daily 00:00 UTC, the week on Wednesday, seasons on the quarter, holidays (10.10). | As is. |

## 8. Growth of a character

| Rule | OSRS | WoW | DRK | Openfold today | Pick |
|---|---|---|---|---|---|
| **F26. A character grows by what it does, in skills the player picks, with no class locked at the start.** | 23 skills to 99, no classes; the model. | Classes and levels, talents inside the class. | 21+ heroes in place of classes; a player switches hero. | **settled** in direction: professions with levels, "skills like OSRS" (GAP_WOW_RS); the skill screen as built is generic (❌ 19.10), a tree proposed. **open**: the tree's frame. | The tree's frame as a still to the owner (already ordered); no rule change. |
| **F27. Gear helps work a little and never replaces skill; worn things wear out.** | Gear matters a lot in combat, little in skilling. | Gear is the progression. | Looks are skins and dyes, never gear drawn on the body. | **settled**: G44, G42, the upgrade (9.10); combat gear waits for the combat frame (CR-12). | As is; closer to DRK than to WoW. |
| **F28. A group is chosen, never forced: a quest may name a party, and a player may try it short-handed.** | Most content solo-able; raids and some bosses need a group. | Dungeons and raids need roles; solo play is the leveling path. | Co-op action; parties. | **settled**: 3.7 (party min/max, companions later). **open**: guilds, friends lists, a party finder. | Q6. |

## 9. The screen and the device

| Rule | OSRS | WoW | DRK | Openfold today | Pick |
|---|---|---|---|---|---|
| **F29. The world shows its values; the screen never shows a chance, a level, a difficulty, a danger or a time left as a number.** The player's own things keep their counts. | Numbers everywhere: levels, hit splats, experience. | Numbers everywhere; damage meters by addon. | Numbers on screen (levels, damage). | **half**: CR-17 (9.10), SETTLEMENT 3.5, 3.6; closed as a task, no rule page. Openfold's own line, against all three. | Q7: the rule on the page as G77. |
| **F30. Every rule holds in both doors, and the kernel is shared.** | One client (and a mobile one). | One client. | One client. | **settled** as a decision (pixel first, two doors, 18.10). **open**: a frame line on the rules page. | One line in GAME_RULES' frame, no line per rule. |
| **F31. A phone budget is measured on a device before a stage ships.** | OSRS mobile since 2018. | None on phones. | PC first. | **half**: the measure is named at each stage, no number written. | Q9. |
| **F32. Playable by more people: motion off, nothing only in sound or colour, targets a thumb can hit.** | Partial. | Partial, with addons. | Not public. | **settled**: G29, G27. | As is. |

## 10. Presence and talk

| Rule | OSRS | WoW | DRK | Openfold today | Pick |
|---|---|---|---|---|---|
| **F33. Players see each other before they can talk, and talk comes last.** | Chat from the first minute. | Chat from the first minute. | Chat from the first minute. | **settled**: the order of 17.10 (presence without chat, chat last). Openfold's own. | As is. |
| **F34. A crowd never hides the world: beyond a handful, others fade.** | Everyone drawn; a crowded bank is a wall of names. | Everyone drawn, with a slider. | Not public. | **settled**: 10.10 ("a crowd beyond a handful"). | As is. |
| **F35. No voice inside the game.** | None. | Built in since 2007, little used; Discord took it. | Not public. | **open**: not written. | Q12: yes, written now. |
| **F36. Trade between players is a window both confirm, with no take-backs after and no gift that beats the band.** | The trade window with two confirmations after a famous scam era. | Same. | A market. | **half**: a sale between players burns a fee, "goods given for nothing paid nothing" (10.10); the window itself is stage 4. | Q13. |

## 11. The open ones, in the order to ask

| # | Rule | The question | Recommended |
|---|---|---|---|
| 1 | F6 | How does a player get the account back? | **Answered 19.10:** through the external login (Google, Apple, Steam); support never enters a character. |
| 2 | F11 | What happens to a caught bot account? | **Answered 19.10:** a hold for review, the owner decides; a wipe of the gains, never of the character. |
| 3 | F15 | Adopt "what one player does never takes from another" as G76? | Yes, with the areas between players as the one exception. |
| 4 | F18 | Mute, block and reports: when and how? | Mute and block from the first presence stage, before chat exists; a report goes to one queue the owner reads; three reports hold an account's words, never its play. |
| 5 | F21 | Deletion, export and a privacy page before accounts open? | Yes to all three; deletion within 30 days; export as one JSON; the page in the repository, public like the rest. |
| 6 | F28 | Guilds, friends and a party finder: when? | Friends with presence (stage 4); guilds after chat, as the community asks; no party finder, a group forms at the quest's board. |
| 7 | F29 | CR-17 as a rule on the page (G77)? | Yes. |
| 8 | F3 | What runs while a player is away? | Nothing at the camp or the fire; a shared-town hold's clock runs with notice; a fire found out on return costs nothing but the kept night if the vigil was on. |
| 9 | F31 | Write the phone budget? | 60 frames a second at 2K on a two-year-old mid phone, under 150 MB of memory, measured before each stage, the number kept in the repository. |
| 10 | F17 | The combat frame before it is built? | Yes: a one-page frame to the owner; a fall in combat costs what G33 says and nothing more. **Half answered 19.10 (W8):** fights between players only in a marked zone in the wild; the frame still owes the verbs, the foes, the tick and whether the attacker takes the finds. |
| 11 | F23 | A player vote on direction once there is a community? | Yes, like OSRS's polls, at 70% yes, on direction only; rules and the economy stay with the owner and the checks. |
| 12 | F35 | No voice inside the game, written now? | Yes. |
| 13 | F36 | The trade window: two confirmations, a five-second lock after the last change, the band applied? | Yes, as the stage-4 rule, written now. |
