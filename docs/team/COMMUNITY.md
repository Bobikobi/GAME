# Players and creators find Loomvale: the community and launch plan

Written 2026-10-28 for the owner's word of 28.10 (translated from Hebrew): "You are going to be the marketing and image agent of the product we are building. I will connect all the relevant accounts in all the relevant groups on every platform that is needed, from TikTok to Facebook. You will be a UGC expert and get players and developers to try it the moment we launch. Build the necessary foundations, look for the tools safely and connect the relevant add-ons. It will take time and we will work slowly. I want you learning the users' slang automatically, with a human delay, and answering videos, posts and every relevant piece of content in its language, so that they want to come in and play."

Corrected by the owner on 29.10 (translated): "This is not hidden advertising. It is a personal assistant that takes over the grunt work I hate. I am a solo developer; I can do it, but I have no time and no energy. So you are my worker who creates." The agent is the game's community manager on the game's own accounts, and section 0 is the mandate it works under. The first version of this page made every post wait for his yes; that was the agent's reading of "UGC", not his request.

Stage: 2b, opening to developers, is current (the repository has been public since 15.10). The player launch is tied to the owner's word of 27.10: a bought domain comes "when the game can be tried". Search and AI-answer visibility is a separate plan, [SEO_GEO.md](SEO_GEO.md); this page takes over its section 9 items 4 to 11 (the posts, the listings, the video) and repeats none of the on-site work.

The baseline, measured on 28.10: production v0.1.9; the repository has 0 stars, 0 forks and one pull request from outside the team (#115, 16.10); no Discord, no letter, no account on any platform; the share card still carries the old name (DECISIONS 2026-10-27). Marketing starts from zero, which is also the cleanest place to start honestly.

## 0. The one rule, and the owner's mandate (29.10)

**Every public word about the game is said in the game's name, on the game's own accounts, or in a team member's own name.** No account that poses as a player who is not us, no engagement bought, no burst of posts. Inside that line the agent is the game's community manager end to end: it listens, learns the words, writes and posts, without asking the owner per post. He reads the daily log, and one word from him stops it.

The mandate, held as code in the private repository (`pnpm post --mandate` prints it):

1. Every word in the game's name, on the game's own accounts; no account that poses as a player who is not us.
2. At most five posts a platform in 24 hours, at a natural pace, never a burst; a thread is answered once.
3. Money, a date or a promise, an answer to criticism or drama, anything legal: the owner first.
4. A glossary term marked `use: no` is never said.
5. Every post is a line in `posted.jsonl`, the disclosure trail; the owner reads the daily log.

Why the first line is the one that never moves: the platforms forbid accounts that pose as someone else (Reddit's content-manipulation rule, Meta's inauthentic-behaviour standard, TikTok's deceptive-account rule, Discord's ban on self-bots, YouTube's and X's manipulation policies), and an account caught takes the official one with it; Israel's Consumer Protection Law and the EU's Unfair Commercial Practices Directive name a seller posing as a consumer as hidden advertising; DECISIONS 2026-10-09 bans bots from the game itself. None of that touches a community manager posting as the game on the game's account: that is what every studio does, and it is what the owner asked for.

What the studios do: a community manager who answers as the studio, on the studio's accounts, inside a voice guide, and takes money, dates and drama to the producer first; an official Discord, devlogs, a creator program with keys and a press kit, players' clips featured with credit. Where we differ: no advertising budget and no paid creators at the start; the game is free in the browser, so the "key" is a link; and our incentive for user-made content is stronger than most, since a creator's townsperson enters the one shared valley with their signature on it.

The "human delay" the owner asked for is the pace of line 2: a few replies a day on each platform, spread over the day, each read before it goes.

## 1. Who we talk to, and the one line each hears

| Audience | The line | Where they are | Language |
|---|---|---|---|
| Creators (the first audience, INTRO_HE: the Israeli creators' community, then everyone) | "Your townsperson, in a world everyone shares, in 15 minutes, with your name on it." | GitHub, the Israeli indie groups (Facebook, WhatsApp, the GameIS community), r/gamedev, r/IndieDev, Mastodon's gamedev.place, itch.io devlogs, Hacker News | Hebrew in the Israeli groups, English elsewhere |
| Pixel artists | "Your 16x24 character walks in a shared valley, signed." | r/PixelArt, #pixelart on Mastodon, Lospec, Instagram, TikTok | English |
| Players (the PC first, DECISIONS 2026-10-23) | "A free pixel valley in your browser. No install, no account. Mend the bridge." | r/WebGames, r/IndieGaming, r/playmygame, itch.io, YouTube Shorts, TikTok, Discord | the post's language |
| People who like games built together | "The players vote, the rules are code, the credit is in the game." | Hacker News, r/opensourcegames, Lemmy, Mastodon | English |

A reply is written in the language of the post it answers. The Hebrew register is the owner's own: plain words, a regular hyphen, no marketing talk.

## 2. The voice

From the home page the owner approved (10.10) and from [STORY.md](../design/STORY.md): the valley is the hero; we say what is true today and call the rest planned, as the roadmap does ("planned, not built"); plain words, short sentences, a regular hyphen; no superlatives ("revolutionary", "epic", "the best"), no urgency tricks ("last chance"), no claim about a number we have not measured. The persona is "the Loomvale team", and the owner under his own name where a group wants a person. The agent is named as the team's tool wherever a platform asks (a bot tag on Discord, "[bot]" in a profile), never as a person.

## 3. The homes, in the order they open

The owner opens each account under the name Loomvale ([TRADEMARKS.md](../../TRADEMARKS.md) keeps the official names for the project; registering the handle early on every platform is standard practice even where we post later). Credentials live in the owner's secrets folder, never in a repository; the agent reads tokens from the environment.

| Order | Home | Why in this place | What the agent does there |
|---|---|---|---|
| 1 | A Discord server | The one home for players and creators; where the industry's communities live; the clips and the open calls need a room | Writes the channel plan, the rules (G22, G46, the conduct section of CONTRIBUTING.md) and the welcome; runs a labelled bot that posts releases and open calls |
| 2 | The letter, through Resend broadcasts | Resend already mails the sign-in link (DECISIONS 2026-10-28), so no new vendor; one letter per release | Drafts the letter from CHANGELOG.md; the owner sends |
| 3 | An itch.io page | The browser-game audience looks there first; devlogs reach followers; the page links back to the site | Writes the page and the devlogs (SEO_GEO 9.6) |
| 4 | Mastodon (mastodon.gamedev.place) and Bluesky | The indie-dev crowd; open APIs where labelled automation is allowed | Posts the devlog and the open calls; replies after the owner's yes |
| 5 | Reddit, u/Loomvale with a developer flair | The subreddits of section 1; each has its own rule on self-promotion, most wanting about nine contributions for every link to your own thing | Drafts posts and replies; the owner posts until an API app is registered |
| 6 | YouTube, TikTok, Instagram | Vertical clips of the opening, the night, the wolf; awareness more than a door, since the PC is first | Cuts the clips from a headless run of the game (the browser test already captures the opening); drafts captions; the owner uploads |
| 7 | Facebook groups (the Israeli ones) | Groups accept a person, not a page; most forbid automation | Drafts in Hebrew; the owner posts from his own profile |
| 8 | X | Later, if the others show an audience there | - |

## 4. The engine: listen, learn, draft, check, post, measure

Built in the private repository `Bobikobi/loomvale-community`, on the pattern of DECISIONS 2026-10-27 (the private drafts repository beside the public game): the public tree holds the rules, the private one holds the operation, the queue and the log. No secret in either.

1. **Listen** (automatic, daily). Public feeds that need no login: subreddit RSS (new posts and searches), Hacker News through the Algolia API, Mastodon tag timelines, Lemmy communities, itch.io's new HTML5 games and devlogs. With an account later: Bluesky search (it answered 403 without one on 28.10), the YouTube Data API, our own Discord, our itch page. TikTok and Instagram have no listening API: they are read by hand, once a day, in the app. Each item keeps its source, link, author, time, text, language and the watch terms it matched; the reader names itself in its user agent and pauses between feeds; items older than 90 days are dropped. Reddit gives a reader without a login one request a minute (measured 28.10 from its rate-limit headers), so the seven subreddit feeds take seven minutes a run until the registered app of home 5 lifts the limit.
2. **Learn** (automatic). The glossary counts the words and two-word phrases of each community, with how many different people used them and one example with its link. A term enters our mouth only after three different people used it in that community, and only after the agent has read the examples and written its meaning and whether we use it. Forced slang is the fastest way to be laughed at, so when in doubt the reply is plain English.
3. **Draft** (the agent). A reply answers a question or adds to the conversation; it says who we are; it carries at most one link, and none where the game is not what the thread is about. A post follows the subreddit's or group's own rules, read that day. Each draft names the item it answers and the one line of why.
4. **Check** (the mandate, as code). The poster refuses what the mandate refuses: over the daily cap, a thread already answered, a term the glossary marks `use: no`, money or a date or a promise without the owner's word. What waits for him goes to the page of cards, Like / No / a note, one Send that writes `picks.json` (the format he picked for the art picks); everything else goes.
5. **Post** (the tool). From the game's own account, through the platform's own API where it has one (Discord, Mastodon, Bluesky, Reddit with a registered script app; later YouTube comments and the Meta pages API); by the owner's hand from the agent's text where it has none (Facebook groups, TikTok and Instagram comments), because browser automation on a personal account gets it locked. Every post goes into `posted.jsonl`: when, where, what, the link. That log is the disclosure trail, and `pnpm log` is the owner's daily read of it.
6. **Measure.** Referrers in the site's Web Analytics, the stage-1 counters (visits, pickups, where the opening stops), GitHub (stars, forks, issues and pull requests from outside), Discord members, letter subscribers. Targets are set after two weeks of baseline, in DECISIONS.md, not guessed here.

## 5. The creator program (the user-made content)

- **The kit.** A `/press/` page on the site: the one-liner, the paragraph, six desktop screenshots, three short clips (the bridge, the lantern at night, the wolf's eyes), the share card redrawn with the new name, the logo, the facts (free, in the browser, AGPL code and CC BY-SA content, PC first, the stages) and the trademark line: "made for Loomvale" is welcome without asking. The page's look is a direction: stills first.
- **The first returners.** The story's own word for the players, given to the first creators whose extension merges. They already get a signature in the game, a creator page and points; the program adds a line in the release notes, a place in the letter and a clip of their work in the valley.
- **Open calls as posts.** A "Request for the valley" with enough votes becomes an open call (CONTRIBUTING.md); every open call becomes a post: the valley asks for a ferryman, who builds her.
- **Clips.** A clips channel in Discord; the best of the month in the letter; reposted on the official accounts only with the maker's yes and their name.
- **Streams and videos.** Welcome without asking (TRADEMARKS.md). We thank, answer and link.
- **Seasons.** A content season runs a quarter under a theme (DECISIONS 2026-10-09); each season opens with a build call and closes with the vote that already exists.

## 6. The launch, in phases

| Phase | When | What goes out |
|---|---|---|
| Now | stage 2b, the repository public | The listening baseline and the glossary (built 28.10); Discord and the letter (homes 1 and 2); one devlog per release, written from CHANGELOG.md, with a clip; GitHub Discussions turned on (SEO_GEO 9.10) |
| The game can be tried | the owner's word (27.10: the domain comes then) | The itch page; Show HN; one post per subreddit of section 1, each on its own terms, spread over a week; Mastodon and Bluesky; the Israeli groups in Hebrew; the first letter; the directories and lists of SEO_GEO 9.7 and 9.8 |
| After | weekly | Monday: the listening digest, the drafts, the owner's page, the posts. Per release: a devlog and a clip. Monthly: the letter with the clips and the new creators |

Every item that publishes outward waits for the owner's yes, one by one, as in SEO_GEO section 9.

## 7. Tools: what is used, what is a candidate, what is refused

| Need | Tool | State on 28.10 |
|---|---|---|
| Listening | Our own listener in the private repository (TypeScript, the platforms' public feeds) | Built. Hacker News, Mastodon, Lemmy and itch.io answered 200 on 28.10; Reddit's RSS answers one request a minute without a login |
| Mention alerts | F5Bot (free, mails Reddit and Hacker News mentions of a term) | Candidate, to vet |
| Posting | The platforms' own APIs, from our own tool | Built as each account exists |
| Scheduling across many platforms | Postiz (open source, self-hosted) | Candidate, only if our own tool passes four platforms; vetted under the install protocol first |
| Discord | discord.js, on a bot account | Built when the server exists |
| The letter | Resend broadcasts | Candidate; the plan's limits to check |
| The press page | A page on the site; the presskit() layout as the model | Planned |
| Platform MCP servers | per platform | None installed; each is vetted (source, scan, pinned version, the audit log) when its account exists |
| Refused | Engagement pods, bought followers, comment bots, scraping behind a login, any tool whose purpose is to look human | - |

## 8. What the owner does, one by one

1. Done 29.10: the mandate of section 0, in his words.
2. The accounts, in this order, each under the handle `Loomvale`: the Discord server with a bot, Mastodon on gamedev.place, Bluesky, Reddit with a script app, the itch.io page; then the Facebook page, TikTok, YouTube, Instagram. Their tokens go into his secrets folder, outside every repository, one file per platform, as the private repository's README lays out; `pnpm check` says which are connected.
3. The daily log, and the cards of what waits for him.

## 9. Done on 28.10

- This page.
- The private repository `Bobikobi/loomvale-community`: the listener (`pnpm listen`), the glossary (`pnpm glossary`), the digest (`pnpm digest`), the queue folders and the log format, with tests; its README carries section 0 as its first lines.
- The first run, 28.10: 401 items kept from 12 of 18 feeds; of the last 48 hours, 86 of 237 items matched a watch term; the glossary lists 400 terms, 389 of them used by three or more people, none described yet. The top of the list is the plain vocabulary of the communities (game, free, demo, feedback, wishlist, screenshotsaturday); the ranking by what is particular to one community comes next.

## 10. Done on 29.10

- The owner's correction, and sections 0, 4 and 8 of this page rewritten to it.
- The poster in the private repository: four clients over plain `fetch` (Discord, Mastodon, Bluesky, Reddit), the mandate as code, `pnpm post`, `pnpm check`, `pnpm log`; 31 tests. The repository is on GitHub, private, pushed by the owner.
- The listener reads Reddit at its one request a minute: 7 of 7 subreddit feeds, 563 items. A security pass: hidden characters out of every feed text, a link kept only when it is a plain http(s) address, the digest quotes what strangers wrote and says so up top.
- The sign-up and token pages of the first five homes opened in the owner's browser.
