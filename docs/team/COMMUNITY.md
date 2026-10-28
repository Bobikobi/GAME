# Players and creators find Loomvale: the community and launch plan

Written 2026-10-28 for the owner's word of 28.10 (translated from Hebrew): "You are going to be the marketing and image agent of the product we are building. I will connect all the relevant accounts in all the relevant groups on every platform that is needed, from TikTok to Facebook. You will be a UGC expert and get players and developers to try it the moment we launch. Build the necessary foundations, look for the tools safely and connect the relevant add-ons. It will take time and we will work slowly. I want you learning the users' slang automatically, with a human delay, and answering videos, posts and every relevant piece of content in its language, so that they want to come in and play."

Stage: 2b, opening to developers, is current (the repository has been public since 15.10). The player launch is tied to the owner's word of 27.10: a bought domain comes "when the game can be tried". Search and AI-answer visibility is a separate plan, [SEO_GEO.md](SEO_GEO.md); this page takes over its section 9 items 4 to 11 (the posts, the listings, the video) and repeats none of the on-site work.

The baseline, measured on 28.10: production v0.1.9; the repository has 0 stars, 0 forks and one pull request from outside the team (#115, 16.10); no Discord, no letter, no account on any platform; the share card still carries the old name (DECISIONS 2026-10-27). Marketing starts from zero, which is also the cleanest place to start honestly.

## 0. The one rule, proposed to the owner

**Every public word about the game is said in the game's name or in a team member's own name, and a person reads it before it is posted.** No account that poses as a player who is not us, no reply timed to look human, no engagement bought or automated. The listening and the learning of words are automatic; the drafting is the agent's; the posting is the owner's yes, on one page of cards (section 4).

Why this, and not the undisclosed version the owner described:

- **The platforms forbid it, each in its own words.** Reddit's content policy asks for authentic content and bans content manipulation, and its developer terms want a registered app and a bot that says it is one. Meta's standards ban inauthentic behaviour, and its platform terms forbid automating comments on other people's content. TikTok's guidelines ban spam and deceptive account behaviour, and its API posts only the account's own videos. Discord bans self-bots: a bot runs on a bot account. YouTube has its spam and deceptive-practices policy, X its platform-manipulation policy. An account caught takes the official account with it, and the game's pages lose the trust the search plan is building.
- **It is hidden advertising.** Israel's Consumer Protection Law forbids advertising that hides that it is advertising; the EU's Unfair Commercial Practices Directive lists "falsely representing oneself as a consumer" among the practices that are unfair in all circumstances; the FTC's endorsement guides and its 2024 rule on fake reviews say the same for the United States.
- **The game's own line.** DECISIONS 2026-10-09: no bots, no program that plays for a player, an exploit loop costs its accounts. A game that bans bots cannot be sold by bots.
- **It does not hold.** Communities of players and developers are the fastest at spotting it, and the thread that catches it is the post that lasts.

What the studios do: a named community manager who answers as "[Dev] Name", an official Discord, devlogs, a creator program with keys and a press kit, players' clips featured with credit. No studio with a reputation runs sockpuppets; the ones caught became news. Where we differ: no advertising budget and no paid creators at the start; the game is free in the browser, so the "key" is a link; and our incentive for user-made content is stronger than most, since a creator's townsperson enters the one shared valley with their signature on it.

The "human delay" the owner asked for stays, honestly: one batch of replies a day, read by a person, posted from accounts that say who they are. That rhythm is slower than any bot and faster than silence.

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

## 4. The engine: listen, learn, draft, approve, post, measure

Built in the private repository `Bobikobi/loomvale-community`, on the pattern of DECISIONS 2026-10-27 (the private drafts repository beside the public game): the public tree holds the rules, the private one holds the operation, the queue and the log. No secret in either.

1. **Listen** (automatic, daily). Public feeds that need no login: subreddit RSS (new posts and searches), Hacker News through the Algolia API, Mastodon tag timelines, Lemmy communities, itch.io's new HTML5 games and devlogs. With an account later: Bluesky search (it answered 403 without one on 28.10), the YouTube Data API, our own Discord, our itch page. TikTok and Instagram have no listening API: they are read by hand, once a day, in the app. Each item keeps its source, link, author, time, text, language and the watch terms it matched; the reader names itself in its user agent and pauses between feeds; items older than 90 days are dropped. Reddit gives a reader without a login one request a minute (measured 28.10 from its rate-limit headers), so the seven subreddit feeds take seven minutes a run until the registered app of home 5 lifts the limit.
2. **Learn** (automatic). The glossary counts the words and two-word phrases of each community, with how many different people used them and one example with its link. A term enters our mouth only after three different people used it in that community, and only after the agent has read the examples and written its meaning and whether we use it. Forced slang is the fastest way to be laughed at, so when in doubt the reply is plain English.
3. **Draft** (the agent). A reply answers a question or adds to the conversation; it says who we are; it carries at most one link, and none where the game is not what the thread is about. A post follows the subreddit's or group's own rules, read that day. Each draft names the item it answers and the one line of why.
4. **Approve** (the owner). One page of cards, Like / No / a note, and one Send that writes `picks.json`: the format the owner picked for the art picks. One batch a day, about ten cards at most.
5. **Post.** From the official account, through the platform's own API where it allows it (Mastodon, Bluesky, Discord, Reddit with a registered app, comments under our own YouTube videos); by the owner's hand where it does not (TikTok, Instagram, Facebook groups, comments under other people's videos), from the approved text. Every post goes into `posted.jsonl`: when, where, what, the link. That log is the disclosure trail.
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

## 8. What the owner decides, one by one

1. The rule of section 0.
2. Home 1: the Discord server, named Loomvale.
3. The handles: register `Loomvale` on every platform of section 3 now, post later.

## 9. Done on 28.10

- This page.
- The private repository `Bobikobi/loomvale-community`: the listener (`pnpm listen`), the glossary (`pnpm glossary`), the digest (`pnpm digest`), the queue folders and the log format, with tests; its README carries section 0 as its first lines.
- The first run, 28.10: 401 items kept from 12 of 18 feeds; of the last 48 hours, 86 of 237 items matched a watch term; the glossary lists 400 terms, 389 of them used by three or more people, none described yet. The top of the list is the plain vocabulary of the communities (game, free, demo, feedback, wishlist, screenshotsaturday); the ranking by what is particular to one community comes next.
