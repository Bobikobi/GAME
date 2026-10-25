# Roadmap

Openfold is a free pixel-art browser game that its players build together. You can play it today at [theopenfold.vercel.app](https://theopenfold.vercel.app). Much of the valley (bushes, recipes, quests, treasures) lives in small data files, and anyone can propose an addition.

This page says where the game stands, what comes next, and where help is most welcome. The full rules of play live in [docs/design/GAME_RULES.md](docs/design/GAME_RULES.md), and every design choice is logged in [DECISIONS.md](DECISIONS.md).

## Where it stands (v0.1.3)

Stage 1 is a playable demo. Progress is saved in your browser only. It will not move to an account later; stage 2a plans a title and a cosmetic item for demo players instead.

What works today:

- **Three races**, the human, the elf and the skeleton. Each wakes in a wake pocket the seed draws, with the pocket's own first task.
- **An opening of about ten minutes.** You mend the bridge, fell a tree for the first fire, meet the town, help Elder Maru or Pell the trader, and find the way into the night ruins.
- **Gathering, digging, felling and cooking**, each with levels. There is also a day and night clock.
- **Health and danger.** A countdown to dark, a pit and a wolf in the night ruins, and things that heal. A fall takes back only what the outing brought.
- **The first maze:** the tangle south of the ruins.
- **Crafting.** A workshop that climbs three tiers and tools that wear out or last. A craft can miss, and luck tilts it; a recipe above your level can be tried at a lower chance. The bag is sorted into categories.
- **Sound** with a mute control, plus walk and work animations.
- **A 3D door**, marked as a trial: the same valley and the same save in 3D, at [/play3d/](https://theopenfold.vercel.app/play3d/).
- **For creators:** the template, `pnpm check` with readable errors, a playable preview for every pull request, a creators board with points, and a read-only MCP server so an AI tool can read the rules and check content from a clone.

## The stages

Each stage has a condition for moving on. Stages 2a and 2b run in parallel, and both must finish before stage 3.

| Stage | What it adds | Status |
|---|---|---|
| 1. Demo and the creator template | The game loop on a static site, the content format, the automatic check, the template | **Live, being finished.** Built and going live with the next release: a small service that counts visits, item pickups and short reports, shown on each creator's page, so a creator can see how their content is used. |
| 2a. Accounts and a server | Accounts; save, bag and gold decided on the server, which replays the player's actions through the same simulation; a gold ledger; server-verified leaderboards for wealth, collections and profession levels | In progress: sign-in, the handover, the ledger and the verified boards are on develop; step 3 of the 2026-10-17 order. |
| 2b. The community loop (runs beside 2a) | Requests and open calls, competing proposals as pull requests, previews, three reviewers, a vote, the credits file | **Partly built.** Requests, open calls, previews, the check and one approval to merge (three once five creators have had an extension merged) already run (see [CONTRIBUTING.md](CONTRIBUTING.md)). |
| 3. Specialisation | A camp with four places, the skill tree, quests and reputation, and harder work that opens at higher levels and pays more | Some pieces are already in the demo (three races, a camp with three places, quests). |
| 4. The market | Shared prices that move with stock, a sales board, gold for creators by the share their content is used, a first season, light presence: you see other players' camps, tracks and notes | Planned. |
| 5. Deciding inside the game | In-game polls and votes on rules and numbers | Planned. |
| 6. Looks and payments | Clothes and looks drawn on the character, a premium currency for looks only. Power is never sold. | Planned. |
| 7. Live presence and chat | Players see each other walk in real time with no chat, after accounts and the server; chat with moderation comes last (DECISIONS 2026-10-17, "The order from here") | Planned. |
| 8. Mechanics as code | New verbs and mechanics proposed by the community as code, run in isolation | Planned. |

The order can change when play shows a better one, and every change is written in [DECISIONS.md](DECISIONS.md).

## A 3D door

A 3D client of the same valley is in progress. It uses the same simulation, content and save format and moves at its own pace; since v0.1.3 the home page has a second door to it, marked as a trial. People who like 3D are welcome to push it forward.

## Where help is most welcome

- **Content:** a fruit, a herb, a recipe, a quest, a treasure or a place to restore. Start with [Add a fruit in 10 minutes](docs/creators/README.md).
- **Pixel art:** 16x24 characters and 32x32 work poses, in the kit's palette (the guide covers it).
- **Reviewing:** every extension proposal needs three approvals once five creators have had an extension merged (until then, one approval, the owner's), and an approval earns points when that proposal is merged.
- **3D:** models and scenes for the 3D door.
- **Code:** read [CONTRIBUTING.md](CONTRIBUTING.md) first. The simulation in `kernel/` stays pure and integer-only.

To ask for something, open a "Request for the valley" issue. A request with enough votes becomes an open call, an invitation to every creator to build it.

## What creators get when a contribution is merged

- **Your name in the game.** A creator profile with a signature on the signs of what you added, and a place in the Creators menu.
- **Points on the public board:** for accepted content, for commits and for reviews that counted. The weights are in [.github/points.json](.github/points.json), so changing one is a visible pull request.
- **Credit** in [CREDITS.md](CREDITS.md).
- **Possible rewards later.** Stage 4 plans in-game gold for creators by how often their accepted content is used. A creator fund of 40% of net income is planned, but there is no income and no distribution formula yet, and points carry no promised money value. See the [rules page](https://theopenfold.vercel.app/hub/rules/).

## Licences

Code is AGPL-3.0-only. Content (every record and sprite) is CC BY-SA 4.0. Fonts are under the SIL Open Font License 1.1.
