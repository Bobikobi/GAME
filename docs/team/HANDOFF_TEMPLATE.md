# Handoff template

One handoff is one goal. Copy this file into `.scratch/handoff/<name>.md`, fill
every line, and give the path to the session that runs it. `docs/team/GRUNT.md`
is a list of handoffs in this shape. Whoever finishes the last handoff of a
batch deletes the files.

```
# <name>

Route: <tool>, <model>, effort <low | medium | high>
Why this model: <one line: mechanical work -> the smaller model; design judgement,
cross-cutting refactors, permissions or deletes -> the larger one>

## Goal
<one sentence; what is true when this is done>

## Decision it implements
DECISIONS.md <date>, "<title>"  (or: PLATFORM.md section <n>)

## Files
- <exact path>: <what changes there, one line>
- <exact path>: <...>

## Proving command
```
<the command, as it is typed>
```
<what it prints when the goal is met>

## Rules in force
- Worktree only: `bash`-level isolation per docs/team/WORKFLOW.md; never the main checkout.
- `git branch --show-current` before every commit; `git add <explicit paths>`; no bare stash.
- Commit message: what and why; ends with `Co-Authored-By: <model> <noreply@anthropic.com>`.
- Pull request into `develop`; once the owner has approved it, the session that made it merges it. A release (`develop` into `main`) is the owner's alone. Never push to `main` or `develop`.
- Plain hyphen, never an em dash; no invisible direction marks; no hour estimates.
- A step that touches play (quests, camps, props, NPC lines, rewards, timing, the opening) obeys `docs/design/GAME_RULES.md`; a collision stops and goes to the owner (its section 6).
- No secrets in git or in chat. Nothing written outside the repository.
- Ask first, in three lines (what, what if it goes wrong, how to undo), before
  anything that writes to GitHub outside the branch and its pull request.

## Done when
- <the proving command's output, in words>
- CI green on the pull request
- the pull request body names the decision and the proving command

## Out of scope
<what a session will be tempted to do and must not>
```
