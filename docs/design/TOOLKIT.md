# Toolkit: free tools and repositories that keep the game rules

A survey made on 2026-10-07 for the owner's question: which free tools and
repositories help keep the basic rules of play that top-tier games keep. One
line per tool on what it gives, what it costs, and where it fits Openfold. The
rules themselves are in [GAME_RULES.md](GAME_RULES.md).

The short answer: no tool keeps game rules for you. What keeps them is a page
the owner holds, a check that reads the content, and a review that plays the
preview. The tools below make each of those three faster.

## A. Frameworks for writing and judging the rules (free to read)

| Tool | What it gives | Cost | Where it fits |
|---|---|---|---|
| [Loops and Arcs](https://lostgarden.com/2012/04/30/loops-and-arcs), Daniel Cook | The loop (act, feedback, update, repeat) and the arc (authored meaning). The model behind GAME_RULES section 2. | Free essay | Describing any new feature as a loop or an arc before building it. |
| [The Hook Model](https://www.nirandfar.com/hooked/), Nir Eyal; a game reading at [adriancrook.com](https://adriancrook.com/?p=7962) | Trigger, action, variable reward, investment. The four questions behind each rung of the ladder. | The model is public; the book is paid | Checking that a new beat has all four parts and that the reward lands at the right step. |
| [Octalysis](https://yukaichou.com/advanced-gamification/using-octalysis-to-determine-the-right-game-design-techniques/), Yu-kai Chou | Eight motivations (accomplishment, creativity, ownership, social, scarcity, curiosity, loss, meaning). A vocabulary for "why would the player care". | Free framework pages | Naming which motivation a quest serves; a quest that serves none is a counter. |
| [A Deck of Lenses](https://apps.apple.com/us/app/-/id385531319), Jesse Schell; [the list of lenses](https://gamedesigntools.notion.site/A-Deck-of-Lenses-b76ffe2dd6c9483bab4de0b2c51ddac2) | 113 cards, each a set of questions about one angle of a game (the lens of the problem, of curiosity, of punishment). | Free app, iOS and Android | Reviews: pull three lenses for a pull request and answer them in the review. |
| [What Makes a Good Puzzle?](https://www.youtube.com/watch?v=zsjC6fa_YBg), Mark Brown (GMTK) | The catch and the reveal, assumptions, presentation. The model behind G6 and G7. | Free video | Designing every riddle: name its catch before writing its clue. |
| [10 Key Quest Design Lessons](https://gdcvault.com/play/1028897/10-Key-Quest-Design-Lessons), Pawel Sasko (CD Projekt), GDC 2022 | A quest is a story with a question; brevity; choices and consequences. | Free on the GDC Vault | Rewriting the town quests (GAME_RULES section 5). |
| [Learning from World of Warcraft's quest design mistakes](https://www.gamedeveloper.com/game-platforms/gdc-learning-from-i-world-of-warcraft-i-s-quest-design-mistakes), Jeff Kaplan, GDC 2009 | The Christmas tree, the fetch without context, the quest that sends the player away from the fun. The source of the forbidden patterns. | Free article | The forbidden-patterns table. |
| [Why games are still full of fetch quests](https://malaysia.news.yahoo.com/why-wont-fetch-quests-die-234432459.html) | The premise is fine; the execution fails when there is nothing beyond the counter and the wrapper feels arbitrary. | Free article | The argument for G1 and G2 when someone asks "what is wrong with bring 3". |
| [Celia Hodent](https://celiahodent.com), The Gamer's Brain | Usability and engage-ability as two pillars; feedback, clarity, forgiveness. Behind G13-G15. | Talks free; book paid | The feel rules and the review checklist. |
| [awesome-game-design](https://github.com/Roobyx/awesome-game-design) | A curated list of design reading, examples and tools. | Free, GitHub | The place to look next before adding a framework here. |
| [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com) | A tiered checklist (basic, intermediate, advanced) of what makes a game playable by more people. | Free | G29 is its basic tier; the checklist for any change to text, colour, motion or controls. |

## B. Authoring riddles, dialogue and quest flow (open source)

| Tool | What it gives | Licence | Where it fits, and where it does not |
|---|---|---|---|
| [ink](https://github.com/inkle/ink) and [inkjs](https://github.com/inkle/inkjs) (Inkle) | A writer's language for branching narrative with state; inkjs runs it in the browser with no dependencies; the Inky editor plays as you write. | MIT | Only if riddles and NPC talk grow past what a JSON step expresses. Today the content is JSON with a schema, and a second content language would split the check. Decision needed before use. |
| [Yarn Spinner](https://github.com/YarnSpinnerTool/YarnSpinner) | Screenplay-like dialogue files; used by A Short Hike and Night in the Woods; writer-first. | MIT | Same place as ink; its home is Unity and Godot, the JavaScript runtimes are community ports, so ink is the better fit for a browser game if either is ever adopted. |
| [Twine](https://twinery.org) | A visual editor for branching text that publishes to one HTML file; no code. | GPL v3 tool; the output is yours | Prototyping a quest or a riddle in an afternoon and playing it with the owner on a phone before anything is built. The prototype is thrown away; the quest is then written as content. |
| [Puzzlon](https://adventuron.io/puzzlon) | A browser tool for puzzle dependency charts, Ron Gilbert's method from Monkey Island ([the method](https://www.gamedeveloper.com/design/designing-puzzles-for-adventure-games-analyzing-monkey-island-2-puzzle-dependencies-and-balancing)); layout is automatic, you only type the relationships. | Free web tool | Charting the ruins riddle and every later chain before it is built: a chart with one path and no dead ends is the test for G5 and G7. The chart is pasted into the pull request. |

## C. Modelling the loop and the economy

| Tool | What it gives | Cost | Where it fits |
|---|---|---|---|
| [Machinations](https://machinations.io) | Diagrams of resources, converters and gates that run as simulations; shows where a loop stalls or runs away. | Free Public plan (diagrams are public) | Modelling gather, cook, sell and build before a parameter moves; design time only, never in the repository, nothing private in a public diagram. |
| `docs/kernel-toy/` (this repository) | Python toys for effort, rarity and the economy, written for the kernel review. | Ours | The same questions, answered with the real rules; prefer these when a number is at stake. |

## D. What this repository keeps itself

| Guard | What it does |
|---|---|
| [GAME_RULES.md](GAME_RULES.md) | The pillars, the ladder, rules G1-G16, the forbidden patterns, the conflict protocol, the review checklist. |
| `tools/src/play.ts` in `pnpm check` | Tests G2, G4, G8 and G10 on every content file, core and extensions; prints a `!` line that cites the rule. Warnings until the core content is fixed, then errors. |
| `AGENTS.md`, `CONTRIBUTING.md`, the handoff template | Point every agent, creator and session at the rules before play is touched, and at the conflict protocol when a request collides with one. |
| The pull request review | Checklist question 10: someone played the preview. No tool replaces it. |

## E. Not adopted, and why

- No dialogue language (ink, Yarn Spinner) before the schema has the `find`
  and `riddle` steps: the first riddles fit a JSON step, and one content format
  keeps one check.
- No analytics vendor for "where players stop": stage 1 saves in the browser,
  and the hub's usage section waits for the stage-1 service (PLATFORM.md).
- No design-document template from outside: the pillars are five lines in
  GAME_RULES.md and a template would add pages nobody reads.
- No paid tool. Everything above has a free tier that covers this stage; the
  one pay-per-use piece, fal in section G, runs on the creator's own key.

## F. How to use the kit this month

1. The owner rules on the five pillars and the five breaches (GAME_RULES
   sections 1 and 5). One message, five answers.
2. A Puzzlon chart of the ruins riddle (three ruin stones, one dig), pasted
   into the P-3 pull request.
3. A Twine run-through of the two rewritten town quests, played by the owner
   on his phone before a line of content is written.
4. The `find` and `riddle` steps in the schema (P-2), then the content (P-3),
   then the `play` warnings become errors.
5. From then on: every pull request that touches play answers the ten
   questions, and a collision goes to the owner in six plain lines.
6. The asset trial of ASSET_PATH.md section 2: Maru from a prompt, walk
   frames through the importer, judged in the game on a phone.

## G. Art, animation and sound: universal-modder as a sidecar (added 2026-10-08)

| Part | What it gives | Cost | Where it fits, and where it does not |
|---|---|---|---|
| [universal-modder](https://github.com/rehan-remade/universal-modder), `um sprite` | An idle animation from one frame (bob, squash, wobble, flash), sheets and slicing, a nearest-neighbour fit into a frame, a snap to a reference sprite's palette, pixelation, a checkerboard preview. | MIT; Python, Pillow, numpy. | Upstream of `pnpm kit:import`, which stays the last word on size and palette. Fits every kit; proven on the elder sprite 8.10. |
| `um fal` | A sprite with a transparent background from a prompt, the same character in a new pose (walk frames), pixelation, background removal, sound effects, music, voice lines; every generation logged with its seed. | MIT tool; fal.ai pay per use, on the creator's own key, never in the repository (gitleaks refuses it). | New characters, props, and the sounds rules G24-G27 ask for. Not a whole sheet from one prompt: grids come out uneven; one hero image, then edits. |
| `um fal model3d`, `um fal rig`, `um render3d` | One picture to a textured 3D model, an auto-rig with walk, idle and die, frames rendered from the game's camera in 8 headings, consistent across the cast. | MIT tool; fal pay per use; Blender on one machine (a CPU does at 16x24). | Stage 2 of [ASSET_PATH.md](ASSET_PATH.md), when the cast outgrows hand consistency. Not now. |

The rest of that repository (engine recon, reverse engineering, Windows
automation, mashups, the mod hub) is for modding other people's games and is
not used. Installed in its own virtual environment, never as the Claude Code
plugin: a plugin puts eleven skills and the fal tools in every session's
prompt. The path, the three stages and the recommendations for the owner:
[ASSET_PATH.md](ASSET_PATH.md).
