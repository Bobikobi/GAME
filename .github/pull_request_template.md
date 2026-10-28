<!-- Thank you for adding to the valley. Say what you added and where to find it. -->

## What this adds

<!-- One or two sentences, and where a player finds it (for example "a plum bush in the quiet glade west of the river"). A code change: what changed and why, and how you checked it. -->

## Tools that fire on this pull request

<!-- The first three lines are owed only when this pull request changes a quest, text a player reads as story, or adds a picture under content/kit/; otherwise, as in most code pull requests, answer them "n/a - code change". -->
<!-- Tree: where the work sits in the skill tree (the schools and nodes in content/core/schools/), owed by every pull request in one of the three forms below; docs/team/ONBOARDING.md, "The pull request template", explains them. -->
Quest review: <verdict of the quest-designer skill in one line, or "no quest changed">
Story review: <verdict of the story-keeper skill in one line, or "no story text changed">
Source: <where each picture added under content/kit/ came from (docs/art/PROP_FROM_REF.md), or "no new picture">
Tree: <school>/<node ids> | extends the tree: <path of the proposal> | none: <why nothing a player can grow in changes>

## Author checklist

- [ ] `pnpm check` passes on my machine (a code pull request: `pnpm verify`)
- [ ] I played it, locally with `pnpm dev` or in this pull request's preview
- [ ] Every AI tool I used is listed in `ai_tools` (a code pull request: in a `Co-Authored-By:` line of the commit)
- [ ] My files are only under `content/extensions/<my-handle>/` and `content/kit/<my-handle>/` (a code pull request: n/a - code change)
- [ ] A design choice, an abandoned approach or something found broken has its entry at the end of `DECISIONS.md` (or: none made)

## Reviewer checklist

An extension merges with a green check and one approval, the owner's, until five creators have had an extension merged; from then on, three approvals. Before you approve, confirm each point:

- [ ] **It plays.** I opened the preview, found it, and it does what the description says.
- [ ] **It fits.** Names, text and art suit the valley: cosy, plain words for every age, menace within its limit (GAME_RULES.md G22 and G46), handheld-era pixel art.
- [ ] **It is fair.** Nothing is much better than what exists for the same effort, and the rarity feels right.
- [ ] **It is clean.** No copied art or text, and no ads, links or personal data in the content.
- [ ] **It is credited.** The creator and every AI tool used are named.
