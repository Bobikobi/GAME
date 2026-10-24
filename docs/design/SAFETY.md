# Safety and the account contract: presence, words, reports, minors, bots, leaving (2026-10-20)

What the game promises a player about being seen, being heard, being safe and leaving, written as one contract so the builders of the account (NEXT 18), of presence (PRESENCE.md) and of chat (last, W11) build to one page. Design only: no code, no schema, no content and no look changes here. The page builds on what is decided and does not say it again; section 2 points at every line it stands on. Wherever a line follows from a law, the law and its section are named (section 3). What the owner has not said is marked as proposed; one question bent a rule of his and went to him in section 12, answered on 20.10. The people who read the queue are a question of people and stay out of this page.

## 1. The contract in one paragraph

To the other players you are a name and a figure; to the server you are an email, a name, an age band and a country, and nothing more is kept than the game needs to run and to keep people safe; nothing is sold and nothing is shown about you that the screen does not show (PRESENCE section 4). Your words pass a filter before anyone reads them and a ladder after; you can mute and block anyone at once and for good; a report reaches a person, who tells you what was decided and why, and you may appeal once to another person. A dropped line costs you the moment and nothing else. One person has one account, and machines do not play. You may leave with everything deleted, from inside the game, within the month the law gives, and take one file with everything that is yours first. Where a line here follows from a law, the law and its section stand beside it.

## 2. What was decided before this page, and where it stands

| Decided | Where |
|---|---|
| What is sent about a player and what is never sent; the blocked pair faint and nameless; mute from the first presence stage; the player card (name, add friend, mute, block, report); the report's contents; one queue the owner reads; three reports hold an account's words, never its play; the overruled reporter; nobody is told who is online; the relay stores nothing, the action log 90 days, a report until read and `hold_max_days` after | PRESENCE section 4 |
| The threat table: teleport, speed, a false figure, a forged token (`presence.token_s`, one socket per account), who is online, flooding (`presence.rate_hz`), a bot reading the feed, the relay down, words through the name | PRESENCE section 5 |
| The lost socket: the client shows the others as gone and keeps playing through the API; the countdown of section 0 runs from the relay's `disconnect`; `revoke` when an account is held or closed | PRESENCE sections 0 and 3 |
| A dropped line in a fight: the figure stands, guards nothing and takes what lands for `combat.linger_ms`, then disengages | COMBAT.md section 4.4 |
| The moderation runbook for the owner: reading the queue, the three rungs as commands, the appeal to another person | PRESENCE section 7, build d |
| One account per person per world, one unique name read by the filter | FOUNDATIONS F4 (10.10) |
| Registration asks the least, after the opening: an email and the name; the age gates words, never play; the demo keeps nothing and asks nothing | F5; DECISIONS 2026-10-09, "An account asks for little" |
| The account comes back through the sign-in provider; the game keeps no password; support never enters a character | F6, W2 (19.10) |
| Machines do not play; a caught account is held, the owner decides, the gains are wiped and never the character; the signs of a loop and of a program, the hold, the person who decides, one appeal, `forfeit`; a program may advise and never act; the first offense two weeks, the second for good, a farm for good at once | F11; DECISIONS 2026-10-09, the exploit-loop and program entries |
| The age: 13, or the country's higher age of digital consent up to 16; a younger player plays the demo | DECISIONS 2026-10-09, the age entry; 19.10: with a parent's say |
| Words: notes in free text behind a filter that refuses rude words, links, addresses, phone numbers, email addresses, personal details and offers to trade for money; the same filter on chat; chat public and local in bubbles, never private; a reported note hides until a person reads it; `notes_max`; words kept only as long as a report may need them | DECISIONS 2026-10-09, players' words |
| Notes and chat only in the languages the game is offered in, each player seeing their own | DECISIONS 2026-10-10, the languages entry |
| Closing an account inside the game with 30 days to change one's mind, signing in undoes it; what burns with the reason `closed`; the name becomes "a traveller"; the ledger keeps its rows under a number; an under-age account closed at once; the neutral birth-date screen; notes and chat 30 days after they fade, logs 90 days then totals, the ledger for good without a name | DECISIONS 2026-10-10, the shared world |
| The ladder: hidden with a warning that quotes the word, a week without words, words off for good; threats, sexual words and personal details blocked by a person at once; one appeal to another person; moderation from the first stage where words reach another, two named people; a report counts once per account past `new_account_hold`; the filter reads every name and refuses the team's and the valley's names; a block; friends; the group's closed signals; a hold ends at `hold_max_days`; the trade rules and "the game never asks for a password" | the same entry |
| Deletion within 30 days, export as one JSON, a public privacy page in the repository | FOUNDATIONS F21, Q5 (19.10) |
| Presence before talk, talk last; a crowd fades; no voice; the trade window | F33, F34, F35, F36 |
| The age stored as the band `13-15`, `16-17`, `18+`, never a birth date; the session cookie httpOnly, secure, same-site; closing deletes the account's rows; the two books append-only | DECISIONS 2026-10-20, the database as built |
| The feedback button carries no name, no address and no account | DECISIONS 2026-10-10, feedback from inside the game |
| The line is PEGI 16 and ESRB T for the game's own text; the filter between players is unchanged, "chat is for players of 13" | TONE.md (19.10) |
| The server owns the clock and the movement credit; no client claims time | DECISIONS 2026-10-20, the server's wire as built |

Two of these moved by building: the 10.10 screen "keeps only whether the age passed" became the band of 20.10, which this page reads, since minors' defaults (section 6) need the band and not the date.

## 3. The laws this page follows, and where each lands

The game is offered in English to anyone with a phone, so a player may sit in the European Union, the United Kingdom, the United States or Israel. Where the laws differ the stricter line is taken, so one design holds everywhere, as the owner's age rule of 9.10 already does.

| Law | Section | What it asks | Where it lands here |
|---|---|---|---|
| GDPR (Regulation (EU) 2016/679) | Art. 3(2)(a) | applies to a service offered to people in the Union, wherever it runs | the whole page |
| GDPR | Art. 5(1)(c), 5(1)(e) | the least data; kept no longer than its purpose needs | section 9, the retention table |
| GDPR | Art. 6(1)(b), 6(1)(f) | the account and play rest on the contract with the player; the logs, the ledger's trail and the reports on the game's legitimate interest in keeping people safe and the economy honest | section 9 |
| GDPR | Art. 8 | a child's consent to an online service is valid from 16, and a state may set 13 to 16 | section 6, the country's age (9.10) |
| GDPR | Art. 12(1), 12(3); Art. 13 | plain words, in particular for a child; an answer within one month, two more if complex; what a notice must say (purposes, recipients, how long, the rights) | section 9, the privacy page, closing and export |
| GDPR | Art. 15(4), Art. 20 | a copy must not harm another's rights; portable, in a machine-readable format | section 9, the JSON and what it leaves out |
| GDPR | Art. 17(1), 17(3)(b), 17(3)(e) | erasure without undue delay, except what a legal obligation or legal claims need | section 9 |
| GDPR | Art. 25, 32, 33 | protection by design and by default; security; a breach told to the authority within 72 hours | sections 6 and 10 |
| Digital Services Act (Regulation (EU) 2022/2065) | Art. 2(1), 3(g)(iii), 3(i) | notes and chat stored for players and shown to the public make the game a hosting service and an online platform to players in the Union | sections 5 and 7 |
| DSA | Art. 14(1), 14(3), 14(4) | the terms say how words are moderated, in plain words; a service minors use explains them so minors understand; restrictions applied with care and in proportion | section 7; section 9, the privacy page |
| DSA | Art. 16 | a way to flag illegal content, easy to find, electronic, with what the reader needs | section 5, the report |
| DSA | Art. 17(1), 17(3), 17(4) | a clear and specific statement of reasons at every restriction of words or of an account: what was restricted, the facts, whether a machine decided, the ground, the redress | section 5, the card; section 7, the rungs |
| DSA | Art. 18 | a suspected crime that threatens a person's life or safety is told to the authorities at once | section 5 |
| DSA | Art. 19 | Section 3 (Arts. 20 to 28: the complaints system, trusted flaggers, measures against misuse, the protection of minors, among them) does not bind a micro or small enterprise (under 50 staff and EUR 10 million, Recommendation 2003/361/EC); Section 2 (Arts. 16 to 18) binds every hosting service | the duties here are Section 2's; Section 3's shape is kept where it costs nothing (misuse, minors) |
| COPPA (15 U.S.C. 6501 to 6506; 16 CFR Part 312, amended 2025, in force 23.6.2025, compliance by 22.4.2026) | 312.2, 312.3, 312.5 | a service directed to children, or one with actual knowledge of a child under 13, collects nothing from the child without a parent's verifiable consent | section 6: no account under 13 |
| COPPA | the FTC's COPPA FAQ, D.7 and H.3 (a neutral age screen), H.6 (actual knowledge) | ask the age neutrally, never defaulting to 13 or over, and keep a child from going back to change it; on actual knowledge, delete or get consent | section 6, the age screen and the under-age closing |
| COPPA | 312.10 | a written retention policy, in the notice itself; keep only as long as needed | section 9, the retention table in the privacy page |
| UK Data Protection Act 2018 | s. 9 | the age under Art. 8 is 13 in the UK | section 6 |
| UK DPA 2018 s. 123, the ICO's Age appropriate design code (the Children's code) | standards 7 (default settings), 8 (data minimisation), 10 (geolocation), 11 (parental controls), 12 (profiling), 13 (nudge techniques) | high privacy by default for anyone under 18, the least data, no location by default, say whether parental controls exist, no profiling, no nudges | section 6 |
| UK Online Safety Act 2023 | s. 4 (links with the UK); s. 7(2): ss. 10, 20, 21; s. 12 | proportionate systems against illegal content; a way to report; a complaints procedure; children's safety duties for a service likely accessed by children | sections 5 and 7 |
| Israel, Protection of Privacy Law 5741-1981 (Amendment 13 in force 14.8.2025) | s. 11 | a request for information says whether giving it is a duty, its purpose and who receives it | section 9, the sign-up notice |
| Israel, the same law | s. 13, s. 14 | a person may inspect their data; what is wrong, incomplete or stale is amended or deleted on request | section 9: the export, the name change, closing |
| Israel, the same law; the Protection of Privacy (Data Security) Regulations 5777-2017 | s. 17; the regulations' security levels | the owner, holder and manager of a database answer for its security; the level sets the duties (the definition document, access rights, the record of incidents) | section 10, the incident line |
| Apple, App Store Review Guidelines | 1.2 (user-generated content) | filter objectionable material; let users report, with timely responses; let users block; publish contact information | sections 5 and 7 |
| Apple, App Store Review Guidelines; App Review Help, "Account deletion" | 5.1.1(v) | deletion begun inside the app; deactivation is not enough; say how long it takes and confirm when done; say what the law makes you keep; confirming the intent is fine | section 9 |
| Google Play, User Data policy (account deletion, 2024) | the deletion requirement | an in-app path and a web link; the associated data deleted; what is kept for security, fraud or the law disclosed; a reasonably quick completion | section 9 |
| Google Play, User Generated Content policy | the UGC requirements | in-app reporting and blocking of content and users, action on reports, terms accepted before posting | sections 5 and 7 |

Read on 20.10 from the texts named in Sources. Amendment 13 of the Israeli law widened "personal information" to online identifiers, so a client's address in an access log is personal information there as it is under the GDPR; the numbering of ss. 11, 13 and 14 is taken from the 2014 translation and is checked against the amended Hebrew text when the privacy page is written. This page says what the privacy page and the terms must contain, not their wording: a person who practises the law reads both before they are public, and that reading is a gate of the account build (NEXT 18), not of this page.

## 4. Return after a disconnect

- **A drop and a quit are one thing to the server.** It cannot tell a lost line from a closed app, so it treats them the same: the relay's `disconnect` (PRESENCE 3.4), then outside a safe place the figure stands for `logout_countdown_s` and `leave` runs (section 0, option A), inside one `leave` runs at once; in a fight `combat.linger_ms` comes first (COMBAT 4.4). One rule for both means nobody gains by pulling the plug: a fight is not escaped by a drop, and a drop costs no more than a quit.
- **What the player sees.** The pause at once, "Waiting for the connection" (NEXT 18 e), and nothing played in the dark; the reconnect with backoff (3.1); the others back with the first frames. A line that returns inside the countdown never left: the same account's `connect` cancels the countdown and the figure has stood there the whole time (a line for build b). After the countdown the player returns where `leave` left them, by `resume`.
- **Nothing is lost by a drop.** An action waits for the API's reply (NEXT 18 a); one whose reply never came is not sent again, the client goes on from `GET /state` (`resumeFromServer`, 18 c), which is the truth, and the store's version check refuses a double apply in any case. The pack where a body fell stays its game day whether its owner is connected or not (G81); nothing ran at the camp while away (Q8), so a fire found out costs the kept night and nothing else.
- **A second device.** One socket per account (PRESENCE 5): a sign-in on another device ends the first socket and its session cookie; the first device shows the pause and, on reconnect, "signed in elsewhere" and the sign-in screen. The account screen shows the account holder, and nobody else, the doors linked to the account, the last sign-in's provider and date, and one button, "sign out everywhere", which revokes every session and relay token (`revoke`, 3.4). That date is the only "last seen" that exists, and it is never sent to another player (PRESENCE 4).
- **The account itself, after a lost phone or a lost provider.** W2: the provider gives the account back, the game keeps no password, support never enters a character. A player who loses the provider's account has lost the game's as far as the game can tell, so an account may link a second door while it is signed in (`sign_in_identities` takes several rows per account; a subject belongs to one account, F4). The account screen offers it once, after the first week of play, and never nags (G28).
- **A hold or a block survives the line.** The relay's `revoke` on a hold and the block list at every connect (3.4) mean a reconnect changes nothing about what a held or blocked account can do.

## 5. Reports: who reads, what is kept, for how long, the queue

What stands: the report's contents, the queue, the three-report hold, the overruled reporter and the report's retention (PRESENCE 4); the person's rungs, the appeal and the two named people (10.10); the runbook (build d). What this page adds is the shape around them.

- **Who reads.** One queue, read by a person with the `moderator` right on their own account, which the owner grants; the two named people are a question of people and stay out of this page. The reader's page shows the report, the quoted lines, the reported account's rung and its past decisions (a year), the reporter's overrule count, and never an email, a country or an age band; the queue sorts by the band without showing it.
- **The reasons are a closed list**, the "short list" of PRESENCE 4 made concrete: `threat` (a threat to a person), `sexual`, `personal` (an address, a phone, a real name, an age under 13 named), `hate` (a slur), `scam` (money, a password, a link), `rude`, `cheat` (a program plays, a loop), `name` (a bad name). The list is content; `pnpm check` refuses a reason outside it. The first four are the grave reasons.
- **One grave report hides the lines it carries** at once, until a person reads it (the owner, 20.10, section 12): the notes and lines the report quotes leave every screen but the reader's, and three reports still hold the account's words. A false grave report hides one line for `report.read_days` at most and counts toward the reporter's overrule.
- **The queue's order and its clock.** Grave reasons first, then reports that touch a minor's account either way (section 6), then the rest, oldest first. The target for a grave report is `report.read_days` (2 real days); for the rest the hold's own end, `hold_max_days` (10.10), after which a hold lifts while the report stays open and the queue shows it red. A report counts once per account past `new_account_hold`, and `report.per_day` caps what one account may file.
- **The card at every hold is the statement of reasons.** The moment three reports hold an account's words, the account is told inside the game in one card: what is held (notes and chat, never play), why (reports by other players, which a person reads within the days named), that a rule counted and no machine decided, and how to answer (one appeal, to another person, from the same card). The same card carries every rung of the ladder (section 7) with the quoted word. A hold is a restriction of visibility, and the card is what Art. 17(1) and 17(3) of the DSA ask for, items (a) to (f), in the plain words 17(4) asks for. Proposed: the design had the ladder's warning quote the word; this makes every restriction carry its reasons and its appeal, held or decided.
- **The person's decisions** are the runbook's commands (build d): dismiss (the reporter's overrule count rises), hide and warn, a week, for good, close the account (an under-age account, a loop), tell the authorities. Each writes a row: who decided, when, the reason, the rung, the account's number, no quoted text. The reported player is told by the card; the reporter is told "read" and never the outcome, which is the reported player's own matter.
- **A threat to life or safety.** A report of reason `threat` that the reader takes as a real threat to a person's life or safety is passed at once to the law enforcement of the player's state where it can be known, else of the state where the game is established, or to Europol, with the report's contents (DSA Art. 18(1) and 18(2)); the runbook names the addresses. Rare, and written here because the law makes it a duty for every hosting service, whatever its size.
- **Misuse of the report** keeps the 10.10 line and gives it numbers: a reporter overruled `report.overrule_max` (3) times in `report.overrule_window_days` (30) loses the power to hold by report for `report.overrule_days` (30); their reports still reach the queue, last. Art. 23 of the DSA does not bind the game at its size (Art. 19); its shape, a warning before the loss and a proportionate period, costs nothing and is kept.
- **What is kept.** The report with what it carried until it is read and `hold_max_days` after (PRESENCE 4); the decision row for `report.decision_keep_days` (365), since the next rung needs the last; the rung an account stands on and until when as two columns of the account (`words_rung`, `words_until`). The quoted words leave with the report, and everything leaves with the account (section 9).

## 6. Minors' defaults

An account exists from 13, or the country's higher age up to 16 (9.10); below that the demo, which keeps nothing. The bands `13-15` and `16-17` (20.10) are minors: the Children's code and Art. 28 of the DSA call anyone under 18 a child, and their defaults are the quiet ones, set by the band and not by choice.

- **The age screen** is neutral (FTC FAQ D.7, H.3): the month and year of birth typed, no field defaulting to any age, the country taken from the phone's region with a chooser, no hint of the cutoff anywhere on the screen. A fail says only "an account is not available for you yet; the demo stays yours", and the install remembers it so the screen does not ask again (the FTC's cookie). The birth date is never stored (20.10): the band and the country are, and the rule reads `age.min` (13) and `age.by_country` (a country to an age from 13 to 16). The table is content, filled from each state's law when the privacy page is written and read by the person who reads that page; the check refuses an age outside 13 to 16 and asks that every state of the Union be listed.
- **What a minor's account does differently**, and nothing else: the filter's mask is on for their own screen and cannot be turned off (section 7); their reports, and reports about them, go first in the queue after the grave ones (section 5). Nothing is sent about them that is not sent about everyone, since nothing beyond the screen is sent about anyone (PRESENCE 4), and nobody is told who is online.
- **What is the same for every age, and so needs no setting:** the game never reads the device's location, the tile is the world's and not the earth's (Children's code standard 10); there is no advertising, so there is nothing profiled on a minor (DSA Art. 28(2), kept though it does not bind at the game's size); no nudges (G28, standard 13); no profiling of play beyond the economy's books (standard 12).
- **Parental controls: none exist**, and the privacy page says so in one line, as standard 11 asks; the 9.10 entry's retry line stands (a parent-controlled account when parents ask, as Minecraft and Roblox offer). A minor's own words pass the same filter as everyone's (F5: the age gates words, never play).
- **An account found under age** is closed at once (10.10), and "found" means a person read a note, a line or a report that says so: actual knowledge (FTC FAQ H.6), never a guess from how someone writes. Every row goes at once, with no 30 days, since there is no mind to change and COPPA asks for deletion; the ledger keeps its rows under the number as for every closing. The demo stays theirs.

## 7. The word ladder: the filter, the player, the report, a person

Four rungs, each a different hand. What stands: the filter's list and the languages (9.10, 10.10), the player card's mute and block (PRESENCE 4), the person's three rungs and the appeal (10.10). TONE.md's line on the filter between players holds: the rating is the game's own text, and the players' words stay at 9.10's line.

1. **The filter, a machine, before anyone reads.** It refuses at write time, and the writer sees the refusal with the word marked, so a line can be rewritten; nothing refused is stored. What it refuses, and why: threats, sexual words and slurs (the ladder, 10.10; Apple 1.2); addresses, phone numbers, email addresses, real names and ages (personal details, 9.10; the minors' safety); links and offers to trade for money (9.10); words that ask for a password (10.10); the team's names, "admin", "moderator" and the game's name (10.10); the valley's characters' names (10.10); a language the game is not offered in (10.10); and rude words (9.10). The list for slurs and sexual words is the one TONE.md's section on the game's own text names, shared. Proposed: rude words stay refused at write time for every age, since a note stands for anyone who passes, a player of the youngest band included, and the mask below is for the reader's screen, not the world.
2. **The reader's mask.** On a minor's screen (section 6) the filter runs again on what arrives and masks what slipped through, and the mask cannot be turned off; an adult's screen has the mask on by default and may turn it off in the settings. The mask changes what one screen shows, never what the world holds.
3. **The player: mute and block.** As PRESENCE 4, from the player card. One line added: mute, block and report work from a note too, by a long press, since notes come before figures (W11) and a note is the first word that reaches another.
4. **The report**, section 5.
5. **A person**, with the three rungs of 10.10: hidden and warned with the quoted word; `ladder.week_days` (7 real days) without notes or chat; words off for good. The grave reasons skip to a person at once, and one grave report hides the lines it carries until that person reads it (the owner, 20.10). Every rung comes on the card of section 5, and the one appeal goes from the card to another person within `ladder.appeal_days` (14), who sees the same page as the first reader. The week runs on the calendar, as a mute does in the games read, since a mute measured in play would be waited out by not playing.

What the filter never does: read private messages, because none exist (9.10); read anything on the device; keep refused text. It keeps one count per account, `filter_refusals`, and an account refused `filter.refusal_max` (20) times in one game day has its words paused until the next, with the card: that is the sign of a harasser or a program, not a slip.

## 8. Bots and second accounts

What stands: F4, F11, the signs, the hold, the person, the appeal and the forfeit (9.10); the hold's end and what it stops (10.10); the server's clock and movement credit (NEXT 18 a as built), the relay's caps and one socket per account (PRESENCE 5). What this page adds is the door and the walls.

- **One person, one door per account, kept at the door.** A provider's subject (the Google, Apple or Steam identity) links to one account for good: `sign_in_identities` is unique on provider and subject (20.10 as built), and a second sign-up from the same subject is refused with "you already have an account; sign in". An account may hold several doors (section 4). A closed account's door frees only when its rows go (section 9), the new account starts at zero (nothing carries, 10.10) and `new_account_hold` runs again, so closing is no road to a second account. The email is unique as well. Two providers in two people's hands are beyond the door, as in every game read, and are left to the signs and the ledger's trail (9.10).
- **Time is the server's.** With the clock anchor, the movement credit (NEXT 18 a) and the world's hour (PRESENCE 0, option A), no client claims time, so a program cannot claim hours; what it can do is press at a machine's pace, which is a sign (9.10) and runs into a cap.
- **Rate caps are the first wall**, each a parameter with its clock (section 10): per socket `presence.rate_hz`; per account `api.rate_per_min` on `POST /action` and `POST /moves` together; per account per day `report.per_day`, `friends.requests_per_day`, and the notes' `notes_max` standing. Over a cap the reply is a refusal in plain words, never a silent drop, and the count is a sign in the trail. The signs are the second wall (9.10) and a person the third.
- **The hold tells its reasons.** When a rule holds an account (9.10), the relay gets `revoke` (3.4), trade and transfer stop, the clocks stop (10.10), and the player is told on the card what is held, the sign in plain words (not the detector's detail), and the appeal; the hold ends at `hold_max_days` if nobody reads it (10.10).
- **Advice is not play** (9.10): nothing here forbids a guide or an assistant a player asks; the program that presses is the one that is caught.

## 9. Deletion and export

What stands: closing inside the game with 30 days and the sign-in undo, what burns, the name "a traveller", the under-age closing, the retention numbers (10.10); deletion within 30 days, one JSON, a public privacy page (Q5); closing deletes the rows (20.10). What this page adds is the table-by-table list, the law beside each number, and the file.

- **Closing, inside the game and from the site.** The account screen has "Close my account": one confirmation and the provider's sign-in again (Apple allows confirming the intent; the second sign-in keeps a stolen session from closing an account, F6), then the closing date shown, 30 days on, with "sign in before then to keep it" (10.10). The same page on the site, "Delete my account", signs in through the same provider and does the same, as Google Play asks for a web link. The 30 days are the month Art. 12(3) gives, so the closing date is the deletion date and never later. Proposed: a second button on the same screen, "close now", after the provider's check, done by the nightly job the next day, for the player who does not want the 30 days; Apple's wording asks for an immediate option beside a scheduled one, and Art. 17 asks for no undue delay. The 30 days stay the default.
- **What goes, table by table** (the schema of 20.10): the `accounts` row (email, name, band, country, created); every `sign_in_identities` row; `player_state` with its seed; the account's `boards` listings, burned with the reason `closed` (10.10); the notes; the chat lines; the reports about the player with their quoted words, and the reporter field of the reports they made; the ladder's decision rows; the mute, block and friend rows in both directions; the sessions and tokens. The `action_log` rows expire on their own clock (90 days, then daily totals with no account, 10.10). The `gold_ledger` rows stay for good under the account's number (10.10): the books are the proof of every other player's trades and the economy's audit (Art. 17(3)(e)), the triggers of 20.10 refuse their deletion, and once the `accounts` row is gone the number names nobody, since no screen ever showed it and no row maps it back. The name on a group restore's sign (10.10) reads "a traveller".
- **What is kept, how long, and why**: the table the privacy page carries (Art. 13(2)(a); 16 CFR 312.10, in the notice itself).

| Row | Kept | Why | The law |
|---|---|---|---|
| the account (email, name, band, country) | while the account is open, plus `account.close_days` | the contract, the notices of SETTLEMENT 3.8 | Art. 6(1)(b) |
| the session cookie and the relay token | the cookie's life (NEXT 18 e), `presence.token_s` | the connection | Art. 6(1)(b) |
| the save (`player_state`) | while the account is open | play | Art. 6(1)(b) |
| notes and chat | `words.keep_days` (30) after a note fades or a line scrolls, unless a report holds them (10.10) | reports | Art. 6(1)(f) |
| the action log | `log.keep_days` (90), then daily totals with no account (10.10) | the signs, the audit of a fight or a theft (14 days, 10.10) | Art. 6(1)(f) |
| the gold ledger | for good, under a number | the economy's books, the proof of trades | Art. 17(3)(e) |
| a report | until read, plus `hold_max_days` (PRESENCE 4) | the queue | Art. 6(1)(f); DSA Art. 16 |
| a ladder decision | `report.decision_keep_days` (365) | the next rung | Art. 6(1)(f); DSA Art. 17 |
| the access log at the box (the client's address) | `ops.access_log_days` (14) | security | Art. 6(1)(f); Art. 32 |
| backups | `ops.backup_days` (30); a closed account's rows live in them until they rotate, and the privacy page says so | recovery | Art. 32; Apple and Google allow disclosed retention |
| a feedback send | as a GitHub issue, with no account (10.10) | the team | - |

- **The export** is one file, from the account screen, made by the nightly job and ready the next day as a link that lives `export.link_days` (7), well inside the month of Art. 12(3) and in the format Art. 20 asks for and Israel's s. 13 lets a person inspect. It holds the account row, the doors' provider names (never the subjects), the save as the public state of 20.10 (never the seed, R4), the notes written, the chat lines of the last `words.keep_days`, the ledger rows under the number, the action log rows of the last `log.keep_days`, the reports made (reason and time, not the reported's words), the decisions about the player with the quoted words, which are their own, and the mutes, blocks and friends by the name the world shows. It leaves out anything of another player beyond that name (Art. 15(4), 20(4)), the seed, and the reporters of the reports about them.
- **The privacy page** (Q5) is public, in the repository under `web/`, linked from the sign-up screen and the account screen, in words a player of 13 can read (Art. 12(1); DSA Art. 14(3); G22). It says: what is collected and why, whether giving it is a duty and who receives it (s. 11: nobody but the chosen sign-in provider, the mail service of SETTLEMENT 3.8 and the box's host); the table above; the rights and their buttons (export, the name change, closing, both roads); the words' rules, the ladder and the card (DSA Art. 14(1)); the report route and the appeal (Arts. 16, 17); a contact address (Apple 1.2); the age and the countries' table; that there are no parental controls and no advertising; that a breach is told to the authority within 72 hours and to the players affected (Art. 33, 34). The sign-up screen carries one line of it: the email is for the account and its notices, the name is shown in the world, giving them is your choice and without them there is no account. The page changes in the pull request that changes a row, never after.

## 10. Parameters (every time names its clock, CR-93)

| Parameter | Value to start | Clock | What it does |
|---|---|---|---|
| `age.min` | 13 | calendar years at sign-up | the youngest account (9.10) |
| `age.by_country` | a table, 13 to 16 | calendar years at sign-up | the country's higher age (9.10) |
| `account.close_days` | 30 | real days | the change of mind before deletion (10.10) |
| `export.days` | 30 | real days | the latest an export may take (Art. 12(3)); the job makes it the next day |
| `export.link_days` | 7 | real days | the link's life |
| `words.keep_days` | 30 | real days after a note fades | notes and chat kept for reports (10.10) |
| `log.keep_days` | 90 | real days | the action log before daily totals (10.10) |
| `hold_max_days` | 7 | real days | a hold's end (10.10) |
| `report.read_days` | 2 | real days | the target for a grave report |
| `report.per_day` | 10 | real days | reports one account may file |
| `report.overrule_max`, `report.overrule_window_days`, `report.overrule_days` | 3, 30, 30 | real days | the overruled reporter's loss (10.10) |
| `report.decision_keep_days` | 365 | real days | the ladder's memory |
| `ladder.week_days` | 7 | real days | the second rung (10.10) |
| `ladder.appeal_days` | 14 | real days | the window for the one appeal |
| `filter.refusal_max` | 20 | the game day | refusals before words pause |
| `api.rate_per_min` | 120 | real minutes | actions and move batches per account |
| `friends.requests_per_day` | 20 | real days | requests one account may send |
| `ops.access_log_days`, `ops.backup_days` | 14, 30 | real days | the box's logs and backups |
| `presence.rate_hz`, `presence.token_s`, `logout_countdown_s`, `new_account_hold`, `notes_max`, `combat.linger_ms` | as their pages | as their pages | read here, set there |

The incident line, for the ops page (`docs/ops/GAME_SERVER.md`): a breach of the database is written down the day it is found, told to the supervisory authority within 72 hours and to the players affected without undue delay (Art. 33, 34); the Israeli regulations ask the same record of incidents at every level and a report to the Registrar at the medium and high levels, which the game's database does not reach at first and is re-read when it grows.

## 11. Rule lines proposed, in the form GAME_RULES uses

Numbers provisional (G93 onward, after G92 of GROWTH.md); the rules pull request assigns them. The owner's words of 9.10, 10.10 and 19.10 stand behind each; the division of hands in G95, the card of G94 and the door of G97 are this page's.

- **G93 A drop and a quit are one thing.** The server treats a lost line as a closed app: the countdown outside a safe place, at once inside one, `combat.linger_ms` first in a fight; a line back inside the countdown never left. Nothing is replayed, nothing runs in the dark, and the player goes on from the server's state.
- **G94 Every restriction comes with its reasons and its appeal.** A hold, a rung of the ladder, a held account, a refused line or a paused report is told to the player in one card: what is restricted, the facts (the quoted word, the sign in plain words), whether a rule counted or a person decided, and the one appeal to another person. There is no silent mute and no shadow.
- **G95 The filter refuses, the reader masks, and only a person climbs the ladder.** A machine refuses at write time what the list names, with the word marked; a reader's screen may mask more, by band or by choice, and changes nothing in the world; three reports hold words until a person reads them, and only a person moves an account up a rung.
- **G96 A minor's account is the quiet default.** The bands under 18 get the mask they cannot turn off and their reports first, nothing more is sent about them than about anyone, no parental control is pretended, and an account found under age closes at once with every row. The game never reads the device's location and shows no advertisement, at any age.
- **G97 One person, one door per account.** A provider's subject opens one account and an account may hold several doors; a closed account's door frees only with its rows. Machines do not play (F11): a rate cap is the first wall, the signs the second, a person the third, and a cap refuses in plain words.
- **G98 Leaving is whole, inside the game, within the law's month.** An account closes from the account screen and from the site's page, with 30 days to change one's mind by signing in or at once after the provider's check; every row goes, the ledger keeps its rows under a number that names nobody, and the player may first take one file with everything that is theirs and nothing of another's.
- **G99 What is kept is written where the player reads it.** The privacy page lists every row kept, for how long and why, in words a player of 13 can read, and changes in the pull request that changes a row.

What `pnpm check` and the server's tests enforce (GAME_RULES section 8's form): the report reasons list is closed (G95); every value of `age.by_country` lies in 13 to 16 and every state of the Union is present (G96); the `accounts` table has no birth-date column (G96, 20.10); the relay's route table lists no players (PRESENCE 4, exists); every parameter of section 10 names its clock (CR-93); the privacy page's table names every table of the migrations and every table has a row there (G99); a refused line, a cap and a hold each return a reason string and never an empty refusal (G94).

The review checklist (GAME_RULES section 7) gains one question: "Does every new row about a player stand in the privacy page's table with its days and its why, and does every new refusal, hold or rung show its card?"

## 12. The owner's question, in the section 6 form

One line of this page bent his word of 10.10 and went to him; everything else builds on his words or is marked proposed.

```
To the product owner, a product question in the game:
Asked: should one report with a grave reason (a threat, sexual words, personal details, a slur) hide the lines it carries at once, until a person reads it, where the rule asks three reports (this page, section 5)
Breaks: the shared-world entry of 10.10, "three reports hold an account's words": one report would hide lines, not hold the account
The player would feel: a threat is gone from the street before a third player sees it; a false report hides one line for two days at most and costs the reporter their power to hide
My recommendation: yes, one grave report hides the lines it carries and three still hold the account's words; the alternative that keeps the rule is a person reading grave reports within hours, which needs someone awake
Needed from you: yes / no / other
```

**His word (20.10): A, yes.** One grave report hides the lines it carries at once, until a person reads it; three reports still hold the account's words. Recorded in DECISIONS.md (2026-10-20, "Safety, one round"); sections 5 and 7 carry it.

## 13. The order, and what this page does not do

- Now: this page, with the owner's one answer (section 12) recorded on 20.10.
- The second rules pull request carries G93 to G99, after COMBAT.md's G78 to G86 and GROWTH.md's G87 to G92.
- Built with NEXT 18 (the account screen with its doors, "sign out everywhere", close, close now and export; the age screen; the privacy page and the terms before the first address is collected, 9.10; the sign-up line) and PRESENCE builds b and d (the reasons list, the queue's order, the cards, the decision rows, the runbook); the filter's refusal with the first notes, the mask with them, chat last (W11).
- Before the account build ships: the privacy page and the terms read by a person who practises the law; the countries' table filled; the contact address chosen.
- Not done here: the two named people and the moderator right's holders; the filter's vendor and its lists; the wording of the privacy page and the terms; a parental account (9.10's retry line); the values of the countries' table; the moderator's screen beyond the runbook; Section 3 of the DSA beyond its shape; the trade window (F36, stage 4); a voice channel (none, F35).
- Pages this page touches when its rules pull request lands: PRESENCE section 4 (the reasons list, the hold's card, the one-report hide of 20.10, after #221); FOUNDATIONS F18 and F21 (settled, after #219); F5's age line; TONE.md's filter line (the mask); NEXT 18 e (the account screen's buttons, after #220); SETTLEMENT 3.8 (the address's one use); the 10.10 shared-world entry stands, superseded in part by his answer of 20.10.

## Sources

- Regulation (EU) 2016/679 (GDPR), Arts. 3, 5, 6, 8, 12, 13, 15, 17, 20, 25, 32, 33, 34, Recital 26; the ICO's guidance on children and the UK GDPR (the age of 13 under DPA 2018 s. 9).
- Regulation (EU) 2022/2065 (the Digital Services Act), Arts. 2, 3, 14, 16, 17, 18, 19, 23, 28; the German Federal Criminal Police Office's FAQ on Art. 18 (every hosting service since 17.2.2024, whatever its size).
- COPPA, 15 U.S.C. 6501 to 6506 and 16 CFR Part 312 as amended (90 FR 16918, 22.4.2025; in force 23.6.2025, compliance by 22.4.2026); the FTC's "Complying with COPPA: Frequently Asked Questions", D.4, D.6, D.7, H.3, H.4, H.6.
- UK Data Protection Act 2018, ss. 9 and 123; the ICO's Age appropriate design code (in force 2.9.2020, 15 standards); the Online Safety Act 2023, ss. 4, 7, 10, 12, 20, 21.
- Israel, Protection of Privacy Law 5741-1981, ss. 11, 13, 14, 17 (the 2014 WIPO translation; the Hebrew text is the one that binds), Amendment 13 (in force 14.8.2025); the Protection of Privacy (Data Security) Regulations 5777-2017.
- Apple, App Store Review Guidelines 1.2 and 5.1.1(v); App Review Help, "Account deletion" (in force 30.6.2022).
- Google Play, "Understanding Google Play's app-account deletion requirements" (2024) and the User Generated Content policy.
- The games: RuneScape (the filter, mutes by rung, bans and appeals, "never asks for a password", 13 and up with open chat); World of Warcraft (the ignore list, the forced rename, twenty seconds outside an inn); Minecraft and Roblox (a parent-controlled account, the 9.10 retry line); Dark Souls (the fixed-phrase notes the owner set aside for free text behind a filter).
