# Our work plan beside a studio's plan, from the idea to release

Written 2026-11-22 for the owner, who asked: "How does our work plan look next to the plans game studios use when a company
decides to build a game from zero: the foundational plan from the idea to execution, and then the chain of actions inside the
development itself?" Tracker: #804.

How it was made. Section 1 comes from web sources opened on 22.11; every claim there carries its link, and pages that would
not load were not used. Section 2 is read from our own files: `DECISIONS.md`, `AGENTS.md`, `docs/design/GAME_RULES.md`, the
product spec (`docs/spec/product-spec-v4.6.html`), `CHANGELOG.md`, and the manager's plan of record. The plan of record is
a file on the manager's desk, not in this repository, so it is cited by stage id with the date it was read. This page changes
no plan, lane or content file.

**The verdict.** Our build chain is as strict as a studio's, and in places stricter: automatic gates, staged deploys, a
decisions log and design rules a script enforces. Our phase plan has the right shape but lacks the two gates studios rely on
most. The first is player evidence: no outside player has played the game for us. The second is a playable vertical slice of
the wide world: the stage that led until 22.11 ended on how it looks, not on how it plays. A third risk follows from both. Since 9.11
the new world has been built outside the game players can open.

**The owner's answer, 22.11 (his words, translated).** "The problem really is the design. That is why we have now focused on
starting the base of the valley's look, which is what I tried to steer toward this week. The thing is that we also have the
developers' area, so reaching a first MVP takes a lot of effort, and you cannot make a valley base when you do not know where
it is going to expand. So first we wanted valid documentation for most of the game, and to develop the base according to it.
Write these gaps in one ordered summary place, and from there we give the manager an order to approve the relevant line, so
we can really start testing the game in the field: put most of the effort into developing the first valley, which is exactly
the real playtest."

So the order was a choice. The documentation of most of the game came first, so that the valley's base would not be built
blind. This matches the studio phase that produces design documents before the slice (section 1.1). What changes now is
where the effort goes: the first valley becomes the MVP. This page recommends a field test with outside players as the
valley's gate, and the manager set it as the end of a new `valley` stage in the plan of record on 22.11 at 09:14. Section 4
lists the gaps in order as the conditions that stage has to meet. DECISIONS 2026-11-22 records the owner's word.

---

## 1. How studios plan a game

### 1.1 The phases and what each produces

| Phase | What it produces | Sources |
|---|---|---|
| Concept / ideation | A high concept, a pitch and a concept document | [Wikipedia: Video game development](https://en.wikipedia.org/wiki/Video_game_development) |
| Prototype | Proof that the core is fun. Prototypes are thrown away ("fail fast and often") and are sometimes only on paper | [Game Developer: eight phases](https://gamedeveloper.com/audio/in-search-of-bigfoot-the-eight-elusive-phases-of-game-development-), [Wikipedia](https://en.wikipedia.org/wiki/Video_game_development) |
| Pre-production | A vertical slice: "a small piece of everything that is core: art, gameplay, systems". Also a defined pipeline, documentation and a style guide with asset budgets | [Game Developer: pre-production](https://www.gamedeveloper.com/game-platforms/what-you-should-take-out-of-pre-production), [Meta: art pre-production](https://developers.meta.com/horizon/design/art-preproduction/) |
| Production | Content made at the quality the slice set. "Not about exploration or finding new ideas" | [Game Developer: eight phases](https://gamedeveloper.com/audio/in-search-of-bigfoot-the-eight-elusive-phases-of-game-development-) |
| Alpha | Key features in, assets partly done. Usually ends with a feature freeze | [Wikipedia](https://en.wikipedia.org/wiki/Video_game_development), [Wikipedia: release life cycle](https://en.wikipedia.org/wiki/Software_release_life_cycle) |
| Beta | Features and assets complete, only bugs left. Outside testers hunt for bugs | [Wikipedia](https://en.wikipedia.org/wiki/Video_game_development), [Kitatus: production pipeline](http://kitatusandfriends.co.uk/general/productionpipeline/) |
| Release candidate, certification, gold | A build approved for release. On consoles the platform holder reviews it | [Microsoft: certification](https://learn.microsoft.com/en-au/gaming/game-publishing/concepts/certification/certification-overview) |
| Live operation | Patches and updates after release | [Wikipedia](https://en.wikipedia.org/wiki/Video_game_development) |

The phases overlap in practice, and the large milestones run in a waterfall order while features inside them are built in
agile sprints ([Game Developer: milestones](https://www.gamedeveloper.com/production/milestones-and-glass-houses-preventing-your-development-schedule-from-shattering-part-1)).

### 1.2 The gates and who decides them

- **The greenlight is the first playable.** Mark Cerny's method closes pre-production with a "publishable" first playable:
  two levels at release quality, scope defined, art direction in place, basic technology done. It spends about 30% of the
  budget before that gate, so a publisher risks 30% instead of 100%
  ([Cerny Method slides](https://www.slideshare.net/holtt/cerny-method),
  [Cerny at GDC Europe](https://www.gamedeveloper.com/marketing/conversations-from-gdc-europe-mark-cerny-jonty-barnes-jason-kingsley)).
- **The vertical slice is the gate into production**, and it must meet internal and outside goals
  ([GDC Vault, Volition](https://gdcvault.com/play/1022328/contactUs)).
- **Riot** passes a pitch through Incubation, Prototype, Pre-production and Production. About 10% of pitches reach Prototype,
  and none has passed a gate on its first try ([Riot: incubation](https://www.riotgames.com/en/r-and-d-office/incubation-exploration-with-a-plan)).
  To leave Prototype a team needs playtest evidence that players like the game. If the test fails, the team pivots or cancels
  ([Riot: prototype](https://www.riotgames.com/en/r-and-d-office/prototype-building-a-games-substance)).
- **Who decides.** At a publisher, the publisher decides, paying an advance at each of 3 to 20 milestones
  ([Wikipedia](https://en.wikipedia.org/wiki/Video_game_development)). At Supercell the team decides. The main test is the
  game's own metric goals, and Supercell dropped its old green-light document that every department had to sign
  ([PocketGamer.biz](http://www.pocketgamer.biz/5-lessons-from-ilkka-paananens-bafta-games-lecture/),
  [Supercell: learning from failures](https://supercell.com/en/news/learning-from-failures/)).
- **A milestone must be readable by an outsider.** A third person should be able to read it and know exactly what it
  delivers ([Game Developer: milestones](https://www.gamedeveloper.com/production/milestones-and-glass-houses-preventing-your-development-schedule-from-shattering-part-1)).
- **Restarting is allowed.** Insomniac stopped six months of pre-production and started again, and focus tests checked each
  further quarter of the game up to alpha ([Ratchet & Clank postmortem](https://www.gamedeveloper.com/game-platforms/postmortem-insomniac-games-i-ratchet-clank-i-)).

### 1.3 The chain inside a phase

- **Sprints and milestones.** Sprints run 1 to 4 weeks, planned around a playable build or a playtest, with a ranked backlog
  ([Codecks: sprints](https://www.codecks.io/blog/a-step-by-step-guide-to-planning-and-executing-a-game-development-sprint)).
  A team of five finishes 50-60% of a sprint's plan and expects to
  ([Codecks: Pixelsplit](https://www.codecks.io/blog/2025/how-pixelsplit-games-manages-production-deadly-day-roadtrip)).
- **Art and content.** A style guide is the artists' "source of truth", with asset budgets. The vertical slice is built at
  production quality and becomes "a quality benchmark for the full project"
  ([Meta](https://developers.meta.com/horizon/design/art-preproduction/)). Pre-production should be time-boxed, because
  teams "can iterate on it forever"
  ([Game Developer: pre-production](https://www.gamedeveloper.com/game-platforms/what-you-should-take-out-of-pre-production)). One team built "everything two times" (two items,
  two characters) to estimate the rest ([Pixelsplit](https://www.codecks.io/blog/2025/how-pixelsplit-games-manages-production-deadly-day-roadtrip)).
  The slice tells you what each level or character costs, so content can be fitted to the runway
  ([Codecks: pre-production](https://www.codecks.io/blog/2026/how-to-set-your-game-up-for-success-pre-production--forecasting)).
- **Playtesting** starts as soon as something is playable, before saving or multiplayer exist
  ([Wikipedia: Playtest](https://en.wikipedia.org/wiki/Playtest)). Bungie playtested a not-yet-alpha Halo 3 every afternoon
  ([Killscreen](https://www.killscreen.com/competitive-gaming-winning-cost-games/)). Blizzard built its data pipeline and
  build system "playtesting first" for Overwatch ([GDC Vault](https://gdcvault.com/play/1025012/Tools-Tutorial-Day-Playtesting-Overwatch)).
- **Build and QA.** Riot runs about 5,500 test cases on each build in about 18 minutes. Smoke tests decide whether a build is
  worth testing at all, and a failing build is not deployed
  ([Riot: automated testing](https://www.riotgames.com/en/news/automated-testing-league-legends)). With task branches, merge
  bots and CI, "the main branch is almost never down" ([Unity: Monster Closet](https://unity.com/blog/games/setting-up-scalable-devops-toolchain)).
  Bugs are triaged by severity, and blockers are fixed outside the sprint
  ([HacknPlan](https://hacknplan.com/blog/the-bug-triage-process)).

### 1.4 Large studios and small teams

- In 155 postmortems, 74% of teams had 20 people or fewer
  ([Washburn et al., ICSE 2016](https://thomas-zimmermann.com/publications/files/washburn-icse-2016.pdf)).
- **Small teams gate on fun and on finishing.** Rami Ismail would not greenlight a game that was not fun within two weeks.
  On a slower genre the "click" took 4-5 months. He also says the creative director cannot also be the producer
  ([Game Developer](https://www.gamedeveloper.com/design/what-rami-ismail-learned-with-his-return-to-game-development)).
  He puts Feature Complete about two thirds of the way in and Content Complete 8-12 weeks before launch
  ([Rami Ismail: milestones](https://ltpf.ramiismail.com/milestones/)). Derek Yu's advice is to learn to finish games
  reliably and not to stay on one project for years ([Game Developer](https://gamedeveloper.com/design/-i-spelunky-i-designer-want-to-be-an-indie-then-learn-how-to-finish-games-reliably)).
  Prototype first, because design documents "don't count as progress"
  ([GameDiscover](https://newsletter.gamediscover.co/p/how-spelunky-got-its-procedural-hook)). Another guide says to build
  a one-month prototype and decide right after it whether to go on
  ([Game Developer: starting small](https://gamedeveloper.com/business/the-guide-to-starting-small)).
- **Small-team playtests are cheap.** Brian Cronin runs one tester per live video session, notes on confusion and feeling, fed into a ranked
  tracker ([Game Developer: 1-on-1 playtesting](https://www.gamedeveloper.com/design/how-you-yes-you-can-benefit-from-1-on-1-synchronous-playtesting)).
  Eastshade paid small streamers for fresh-eyes playthroughs and polished its first area, about 20% of the map, as the slice
  ([Eastshade postmortem](https://www.gamedeveloper.com/business/postmortem-eastshade)).
- **Early access and open playtests act as the beta.** In Dead Cells' early access, an estimated 40-50% of changes came from
  players ([Game Developer](https://www.gamedeveloper.com/design/how-player-criticism-helped-make-i-dead-cells-i-the-game-it-is-today)).
  Steam Playtest is free and admits sign-ups in batches ([Steam](https://partner.steamgames.com/doc/features/playtest)).
- **Live operation is heavy for small teams.** Supercell called its own small-team model a mistake for running live games
  ([Game World Observer](https://gameworldobserver.com/2022/02/15/supercell-small-teams-mistake-nintendo-inspiration)).

**Which fits us.** We have one decision-maker, the owner, and up to about eight AI builder sessions at a time. That is a small
team's way of deciding with a mid-size team's output. The small-team gates fit us: fun proven early, outside players early,
finish before widening, and the owner as the greenlight. The large-studio build discipline also fits, and we already have it.

### 1.5 Why projects fail

- The most common problems in 155 postmortems were obstacles (37%) and schedule (25%). Schedule problems came from
  optimistic estimates and late design changes. "A single additional month in pre-production can make all of the
  difference" ([Washburn](https://thomas-zimmermann.com/publications/files/washburn-icse-2016.pdf)).
- Across 200 postmortems from 1997 to 2019, most root causes are people and decisions, not technology
  ([Politowski, Petrillo et al.](https://arxiv.org/abs/2009.02440)).
- Anthem spent 4-5 years "in idea land". Its core loop, story and missions were made in the last 12-16 months
  ([Kotaku](https://kotaku.com/how-biowares-anthem-went-wrong-1833731114)).
- Starting production before pre-production is done costs "rework, wasted assets, and scope collapse"
  ([Codecks](https://www.codecks.io/blog/2026/how-to-set-your-game-up-for-success-pre-production--forecasting)).

---

## 2. Our plan as it is

**The foundational plan.** The spec's roadmap has stages 0-8: validation, a demo, accounts and server, the community loop,
specialisation, market, voting, cosmetics, live presence, creator code. Each stage has a size in lines of code and an exit
test, and "there are no target dates" (spec html:693-710). The six milestones of stages 0, 1 and 2b end "when the test
passes, not when the code is done", each with a test someone outside the team can run (spec html:713). Stage 1's exit test is "five testers who
enjoyed it, three of them back within a week; one outside creator added an item through a PR from the README alone" (spec
html:700).

**The order now.** The owner's order of 17.10 (DECISIONS:1538) was superseded on 12.11. The wide world's foundation now
leads, because "the written order and the work had drifted apart for 12 days" (DECISIONS:4350). On 22.11 at 09:14, after
the owner's answer to this page, the manager added a `valley` stage that leads. The plan of record, as read on 22.11 at
09:20, has eight stages (the file is not in this repository):

| Stage id | State | Its exit test |
|---|---|---|
| `live` | done | "The first valley, the reworked opening, the three races, 64-pixel art - live" |
| `valley` | now | 5 outside testers enjoy the valley, 3 return within a week, and one outside creator adds an item by PR from the README alone (the spec's stage-1 gate). Seven blocks, taken from section 4 of this page, with #806 and #727 inside |
| `foundation` | beside (it led until 22.11) | "A first block of 9 joined pictures (3 by 3) that you walk in the live engine, with a full day of light, water and fog, produced with one command and no hand work - and you saw it and approved." Since 22.11 it serves the valley |
| `chain` | beside | Green gates on both trunks, daily merges, weekly private-to-public moves, a fixed release pace |
| `into-game` | next | "A version where a player leaves the valley and walks in a joined painted area, on a phone, with no freezes" |
| `play` | later | Quests, hunting and combat, animals, sound and weather for each region |
| `together` | later | An account, other players visible, chat last |
| `always` | later | Screen, community, releases, tools, order |

**The chain inside the work.** One tracker issue is one branch, one working folder and one session. Every branch starts from
`develop`, and a release is `develop` into `main` (AGENTS.md). `pnpm verify` runs schemas, content checks, lint, types,
tests and builds (package.json:68). CI proves the opening e2e (DECISIONS:1686). Deploys happen only from CI, in stages:
production on a release, `develop` on each landing, a preview on a label (DECISIONS:3988). A direction is never built
first: two or three stills go to the owner, his pick is recorded and becomes the compass (AGENTS.md:22). Design is held by
five pillars "each testable in a playtest" (GAME_RULES.md:30) and by rules that `pnpm check` enforces. Every abandoned
approach gets a ❌ or ⏸ entry with "retry when". There were 613 entries before the one this page added: 12 failed and 31
superseded (DECISIONS.md, counted 22.11). Twelve releases went out, v0.1.1 on 11.10 to v0.1.12 on 21.11, with none between 31.10 and 21.11
(CHANGELOG.md:5-296). Progress is counted in lines of code: about 140,000 of an estimated 400,000, about 35% (the manager's
plan-lines count, estimate of 13.11).

**Player evidence.** 96 entries in DECISIONS.md have a `Retry when:` line that names a playtest (89 of them say "a
playtest" in those words). No entry and no document records a playtest with people. The experience audit says outright
"Not played for this page" (docs/design/EXPERIENCE_AUDIT.md:19). The hub's counters file (`players-last.json` on the
manager's desk, built 2026-11-22 00:29 UTC) reads 0 visits, 10 pickups and no player count. The only playtest is automatic: a simulated player plays the
opening against the difficulty table (`pnpm map:playtest`, DECISIONS:3749).

---

## 3. Side by side

| Studio phase / practice | Ours | Match? | Deliberate or a gap |
|---|---|---|---|
| Concept, pitch, design document | Spec v4.6, GAME_RULES pillars, STORY, a DECISIONS log | Match, and fuller than most | - |
| Prototype that proves the fun, then thrown away | The valley demo shipped as the product. Fun was judged by the owner and by automatic checks, not by players | Partial | Gap: no player has confirmed the fun |
| Prototype gate on playtest evidence (Riot) | Stage 1's gate of five testers and three returners (spec html:700) became "live" (stage `live`, read 22.11) | Differs | Gap: the gate was swapped for a launch, and no decision records the swap |
| Pre-production: style guide and pipeline locked | The direction rule with stills and picks (AGENTS.md:22). The art scale changed 16 to 32 to 64 px (DECISIONS:1558, 1655), the camera changed (4286), the 3D door opened and paused (1356, 3906) | Partial | Deliberate: each change is a recorded owner pick. The risk is that pre-production has no end date |
| Vertical slice at final quality: art, gameplay and systems | The `foundation` stage's exit: a 3x3 painted block with light, water and fog. Quests, combat and creatures were in the later `play` stage (read 22.11). Since 09:14 the `valley` stage covers play |  Differs | Gap: a slice of the look and the pipeline, not of play |
| Greenlight into production by a decider | The owner sees and approves each stage's end (stage `foundation`, read 22.11) | Match | Deliberate (the owner is the greenlight) |
| Production replicates the slice's cost per asset | Content by matrix: 500 weapons, 400 garments, 700 monsters from tables (DECISIONS:4589, 4358), while today holds 0 weapons and 0 monsters | Early | Deliberate method. The order is a gap: the cost per item is set before a played slice |
| Time-boxed phases, milestones with dates | "No target dates" (spec html:710). Progress counted in lines of code | Differs | Deliberate. Lines of code do not say whether the game is fun |
| Sprints of 1-4 weeks around a playable build | Lanes run tracks continuously. The manager rules the order at each step boundary | Differs | Deliberate for AI lanes. A fixed playable review is missing |
| One build, main always green (Unity, Riot) | Gated `develop`, CI e2e, staged deploys (DECISIONS:1686, 3988) | Match, and strong | - |
| Smoke tests, automatic regression | `pnpm verify`, `pnpm check` play rules, the simulated player | Match | - |
| Daily integration of all work | The painted-world engine lives outside the public game build. About 5,000 lines are still needed to wire it in (stage `into-game`, its wiring block), and the private line is far ahead of public (stage `chain`, the weekly promotion block; both read 22.11) | Differs | Gap: since 9.11 the new world cannot be played in the game |
| Will to kill (Cerny, Supercell) | ❌ entries with attempt tags. Script-drawn trees dropped (DECISIONS:4014). 3D paused (3906) | Match | Deliberate |
| Alpha, beta, content lock | Not defined yet | Not yet | Expected at this stage. Name them when "play" opens |
| Beta / early access with outside players | The live site is open to all, but nobody is invited to play and report | Partial | Gap (same root as player evidence) |
| Live operation after launch | The community loop, votes and a developers' feed are built before an audience (spec stage 2b, spec html:702; the developers' feed, DECISIONS:4466) | Early | Deliberate (community-grown world). Running live systems with no players costs upkeep now |

### The three biggest gaps by risk to the game

These were written before the owner's answer of 22.11. That answer makes the order deliberate: documentation first, then the
valley's base. The gaps themselves stand, and section 4 says how the valley line closes each one.

**1. No player has played the game for us.** Risk: highest. Every design call so far, including the 96 whose `Retry when:`
line names a playtest, is judged by the owner, by agents or by scripts. Studios make playtest evidence the gate out of the prototype
(Riot), test before saving exists (Wikipedia: Playtest), and small teams run one-on-one sessions cheaply ([Cronin](https://www.gamedeveloper.com/design/how-you-yes-you-can-benefit-from-1-on-1-synchronous-playtesting)). Our own
spec already sets this gate (spec html:700), and our pillars say they are "testable in a playtest" (GAME_RULES.md:30).
*Smallest step:* bring back stage 1's gate as written. Five outside players each play the live valley for ten minutes on a
call, recorded only with their consent (a parent's for a player under 18, since players are 13 and up, DECISIONS:1538);
three of them come back within a week. Keep a short log in the repo (what confused them, the gaps between
pays measured against pillar 1), and read the `Retry when: ... playtest` lines against it. After that, repeat it at every
release.

**2. The current stage ends on a look, not on play.** Risk: high. A studio's vertical slice is "a small piece of everything
that is core" at final quality, and it fixes the cost of the rest (Game Developer, Codecks, Pixelsplit). Our foundation
stage ends on a beautiful, walkable 3x3 block with light, water and fog, and puts quests, hunting and creatures in a later
stage. Meanwhile content by matrix is already sized for hundreds of items. If the wide world turns out not to play well,
the art, the pipeline and the matrices will all have been sized on a guess. *Smallest step:* add one line to the
foundation's exit, or make it the next gate before the matrix emits any content: the 3x3 block holds one quest, one
find-and-bring-home loop and one creature, and the outside players of gap 1 play it. Build it twice (two quests, two
creatures) and record what each one cost, the way Pixelsplit did.

**3. The new world is built outside the game players can open.** Risk: high, and it grows every week. Studios keep one
build that is always playable and merged every day (Unity, Riot). Since 9.11 all builder slots have gone to the wide world
(DECISIONS:4350). Its engine lives outside the public game build, and wiring it in is still a later stage of about 5,000
lines (stage `into-game`, read 22.11). Every week the two drift further apart, the e2e proves nothing about the new world, and the
release gap of 31.10-21.11 can recur. *Smallest step:* move "into-game" into the foundation's exit. The 3x3 block counts as
walked only when it walks in the shipped game behind a switch that is off by default, with one e2e that crosses from the
valley into it. The plan already allows code-only promotion behind a switch (stage `chain`, the weekly promotion block).

---

## 4. The gaps in one place: what the first valley line must close

The owner's order of 22.11 points most of the effort at the first valley, and that is how the gaps above get closed. The
list below puts them in the order the line meets them. Each one gets a measure that can be checked. The manager took them
into the plan of record as the seven blocks of the `valley` stage (22.11, 09:14). This page itself changes no plan file.

| # | Gap | What studios do | What closes it in the valley line | Measured by |
|---|---|---|---|---|
| 1 | No outside player has played (gap 1) | A playtest gate out of the prototype (Riot). Testing starts before saving exists | A playtest of the valley as it is today, before the new look: a first reading of the fun | 5 outside players, 10 minutes each, recorded only with consent (a parent's under 18). The gaps between pays timed against pillar 1. Notes kept in a log in the repo |
| 2 | The look is not locked for the valley | Pre-production locks a style guide and asset budgets, and the slice sets the quality bar (Meta, Cerny) | The valley's base look, the owner's focus this week, picked by the direction rule and then frozen as the valley's frame | One recorded pick in DECISIONS with its frame. After that, polish only inside it |
| 3 | The slice is of the look, not of play (gap 2) | A vertical slice holds art, gameplay and systems at final quality (Game Developer, Codecks) | The valley is the first piece of the new world: its look, its animation and its gameplay built together, at final quality, carrying the whole first ten minutes of the hook ladder (GAME_RULES section 2). One outing past the edge is a proposal only: the 8-10 minute rung ends at the night ruins' threshold (G35), so it goes to the owner under GAME_RULES section 6 first | The ladder's rungs met in the e2e, and on a recorded play, on a phone and a desktop |
| 4 | The cost per item is not measured | The slice is built "everything two times" to set the cost of production (Pixelsplit) | Two of each new kind in the valley (two quests, two creatures, two garments), each one's cost recorded | Lines of code, pictures and sessions per item, written down before any matrix emits content |
| 5 | The new world lives outside the game build (gap 3) | One build, always playable, merged every day (Unity, Riot) | The new world's engine enters the game players open, with the valley as its first place, so every step can be played. The new world does not wait in a separate line until it is finished | Every landing is playable at the develop address. No valley work waits on a line outside the build |
| 6 | Nobody is invited to play | Beta or early access with outside players. An estimated 40-50% of Dead Cells' changes came from them | The field test: the spec's own stage-1 gate (spec html:700) is brought back as the line's end | 5 testers enjoy it, 3 return within a week, and one outside creator adds an item by PR from the README alone |
| 7 | Phases have no time box | Pre-production is time-boxed because teams "can iterate on it forever" ([Game Developer](https://www.gamedeveloper.com/game-platforms/what-you-should-take-out-of-pre-production)) | A fixed playtest every release, so progress is read in play as well as in lines of code | One playtest note per release in the log |

What stays as it is, by choice: the owner is the greenlight; documentation for most of the game came before the base; the
developers' area belongs to the MVP; the wide world's documentation and generator keep their place. They now serve the
valley and do not compete with it for effort.

## 5. One recommendation

Inside the `valley` stage, hold rows 1 and 6 as its two gates: a playtest of today's valley before the new look is built,
and the spec's tester gate at its end. The first one costs no code, and it is the only step whose answer could change the order
of everything after it.
