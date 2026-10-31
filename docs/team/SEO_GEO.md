# Search and AI-answer visibility: audit and plan (GRUNT CR-108)

Written 2026-10-17 for the owner's word of 16.10: "maximise visibility in search and in AI answers, so that any developer thinking about something in this direction finds us when they start searching, and the same for the rest of the audience." Stage 2b, opening to developers.

Two things are meant by the two names. **Search** is a person typing a query and choosing a result. **AI answers** is a model (a chat assistant, an AI search box, a coding tool) naming or quoting us when asked; it reads the same pages, plus `llms.txt` and `llms-full.txt`, and trusts a source more when others point at it. Neither can be measured from this repository: no query volumes or rankings are claimed here. The queries below are hypotheses, to be checked against Search Console once the owner verifies the site (proposal 12).

## 1. What the site has today (checked on the live site, 17.10)

| Item | State |
|---|---|
| Title and description per page | yes, on every page; the developer pages' titles are generic ("Developer area - Loomvale") |
| `llms.txt` | yes, 40 lines, well formed; no `llms-full.txt` |
| `robots.txt` | none (404) |
| Sitemap | none (404) |
| Canonical link, Open Graph, Twitter card | none |
| Card image | none |
| Structured data | none |
| Repository | description and homepage set, no topics |
| Site address | `loomvale.vercel.app`; the config knows it only when Vercel builds |

## 2. Who is searching, and for what

Each row is a query someone could type or ask, the page that should answer it, and what that page needs to say in its first lines. A query we have no honest page for is marked.

### Developers (the audience this stage opens to)

| Query | Answer | Page |
|---|---|---|
| open source browser game I can contribute to | the project in one line, how to add a record | `/`, `/hub/` |
| contribute to a game without knowing a game engine | a content record is a JSON file; the check runs on your machine | `/docs/` |
| JSON schema for game quests and items | the schema files, one per record type | `/api/` |
| data-driven game content format (TypeBox, JSON Schema) | the format page and the schema list | `/api/`, `/docs/` |
| deterministic game kernel, pure step function, integers only | the kernel, linked from the repository | repository, `llms-full.txt` |
| MCP server for a game / for game content | the read-only MCP server and `.mcp.json` | `/docs/#your-ai-tool-and-the-project`, `llms.txt` |
| AGPL game with CC BY-SA content | the two licences, one line | `/hub/rules/` |
| good first issues for game developers | the open-call "Request for the valley" issues | repository |

### Players

| Query | Answer | Page |
|---|---|---|
| free pixel art browser game, no download, no account | the game, free, phone or computer | `/`, `/play/` |
| cozy browser rpg with foraging and cooking | the opening and the valley in two sentences | `/` |
| browser game that saves on my phone | "progress stays on this device" is on the home page | `/` |

### Pixel artists

| Query | Answer | Page |
|---|---|---|
| where can I show my pixel art in a game | custom character art, sizes (128x128 or 16x24, 128x128 or 32x32), the signature on what you add | `/docs/#your-own-art-optional` |
| pixel art contributions credited in the game | the signature and the board | `/hub/boards/` |

### People who like games built together

| Query | Answer | Page |
|---|---|---|
| community built game, players decide what comes next | the stages and the roadmap | `/`, repository `ROADMAP.md` |
| game where creators earn in-game gold for their content | the roadmap's market stage, stated as planned, not built | repository `ROADMAP.md` |
| open source game with a leaderboard of builders | the boards | `/hub/boards/` |

**Gap found:** nothing on the site names the roadmap. It lives in `ROADMAP.md` in the repository. `llms.txt` now links it, and the home page's own wording is left to the owner (copy is a look-and-voice decision).

## 3. Titles and descriptions

A title is read in a result list before anything else; a description is what an answer engine quotes. Rule: the title leads with what the page is for in the words a searcher uses, then the name. Done in this pull request for the pages where it matters:

| Page | Before | After |
|---|---|---|
| `/hub/` | Developer area - Loomvale | Build with Loomvale: add game content as JSON, with or without AI - Loomvale |
| `/docs/` | Add a townsperson in 15 minutes - Loomvale | unchanged (the guide's own heading; the description carries the query words) |
| `/api/` | API - Loomvale | Schemas and data for Loomvale content: JSON Schema per record type - Loomvale |
| `/hub/boards/` | Boards - Loomvale | unchanged |
| `/` | unchanged | unchanged (the owner approved the home page's wording on 10.10) |

## 4. The head of every page

Added to the shared layout, from the page's own title and description, so no page can forget it:
- `link rel="canonical"` to the page's address on the production site;
- Open Graph: `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` (when a card exists, below) and the Twitter card tags;
- `robots` is left at its default (indexable); the two `/api/` write routes are excluded in `robots.txt`.

**Card image.** The owner picked the bridge frame on 17.10, with one change: no player name on it (a public image carries no real person's name). It is `web/public/og/card.png` (1200x630: the frame beside the name and one line), cut from `docs/design/frames/2026-10-17-share-card-bridge.png`, which was captured with the HUD and the bridge's signature hidden. Every page carries `og:image` and `twitter:image`; the tags point at `/og/card.png` when that file exists.

## 5. Structured data (JSON-LD)

- Every page: `WebSite` (name, url, description, in language `en`).
- Home: `VideoGame` - name Loomvale, a free browser game, `applicationCategory` Game, `operatingSystem` "Any (web browser)", `isAccessibleForFree`, `offers` price 0, `playMode` SinglePlayer (it is a stage-1 demo, saved per browser; the multiplayer stage is a plan, not a claim), `license` the content licence, `codeRepository` the repository.
- Developer area and docs: `SoftwareSourceCode` - name, `codeRepository`, `programmingLanguage` TypeScript, `license` AGPL-3.0, `runtimePlatform` Node.js.
Nothing is claimed that the site does not hold today: no ratings, no reviews, no organisation or founder block, no price other than free.
The home page's "no script" test is about executable script; a JSON-LD block is data, and the test now allows exactly that type.

## 6. Sitemap and robots

- `/sitemap.xml`: built at build time from the same sources as the pages (the fixed pages, every guide page, every builder page), with the production address; the game at `/play/` is listed.
- `/robots.txt`: allow all; disallow `/api/feedback` and `/api/s1/` (write routes that return nothing to read); `Sitemap:` line. AI crawlers are not named: the default admits them, and naming each by user agent is a policy the owner may want to set (proposal 13).

## 7. Files for AI readers

- `llms.txt`: kept, with the full-text file linked, the roadmap and the game's own address added, and a "Players" line so a model asked "where can I play" has an answer.
- `llms-full.txt` (new, generated at build): the project README, the contributing guide, the roadmap and the whole creator guide in one plain-text file, so an assistant needs one fetch. It is built from those files, so it cannot go stale.

## 8. The test

`web/test/seo.test.ts`, after the build: a sitemap that lists the home page, the guide and a builder page with absolute URLs; `robots.txt` pointing at it; on a sample of pages a canonical link and Open Graph title, description, url and type; a JSON-LD block that parses, with the home page's `VideoGame` and the developer page's `SoftwareSourceCode`; `llms-full.txt` containing the guide's first heading; and no `og:image` pointing at a file that does not exist.

## 9. Proposals that publish outward - the owner's yes, one by one

None of these is done. Each changes something public or registers the project with a third party.

1. **Repository topics** (GitHub settings): `pixel-art`, `browser-game`, `phaser`, `typescript`, `open-source-game`, `game-development`, `community-driven`, `json-schema`, `mcp-server`, `ai-friendly`. Topics are how GitHub search and many lists find a repository; today there are none.
2. **Repository description**, now "Loomvale: a free pixel-art browser game that its players build together". Proposed: add what a developer searches for - "... Add quests, items and places as JSON; AGPL code, CC BY-SA content."
3. **Social preview image** on the repository (GitHub settings): the card of the pending still.
4. **Show HN** post ("Show HN: Loomvale, a pixel-art browser game whose content is JSON anyone can add").
5. **Reddit**, one post each, per each subreddit's rules: r/gamedev, r/IndieDev, r/WebGames, r/pixelart (the art-contribution angle only).
6. **itch.io** page for the browser demo, linking back.
7. **Awesome lists**, by pull request, each only if the list's rules fit: lists of open-source games, of web games, of game-development resources.
8. **Open-source-game directories** (for example the Libre Game Wiki), if the licence and rules fit.
9. **A post for developers** (dev.to or a personal blog): "A game whose content is data: the format, the check and the MCP server".
10. **GitHub Discussions** turned on and a pinned welcome, as the place a searcher lands from the repository.
11. **A short video** of the opening for the repository and the posts (a look: stills first).
12. **Search Console and Bing Webmaster Tools** registration for the site (a verification record or file, and a sitemap submission), which also gives the first real numbers.
13. **A crawler policy** for AI user agents, if the owner wants anything other than "all welcome".

## 10. After the pull request

Measure before adding more: Search Console impressions per query after four weeks; ask three assistants the developer queries of section 2 and note whether the project is named. The result goes in `DECISIONS.md` as a choice or a retry.
