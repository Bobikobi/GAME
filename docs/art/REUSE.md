# Art reuse procedure for every agent

Owner instruction, 2026-10-26: drafts must remain available for reuse across sessions,
including alternate character designs as future NPCs. This procedure applies to
characters, props, terrain, textures, layers and animation sources.

## Before creating art

1. Name the missing asset or reusable part. Search the live kit, `docs/art/`,
   `docs/design/frames/`, generation manifests and the current task's draft folders.
   Check relevant available branches and registered worktrees read-only when the
   asset may already exist there. Do not repeat a full repository inventory for
   every image; use an existing index and inspect relevant changes.
2. Open plausible candidates. For animation, inspect motion, not only a still.
   Compare style, scale, camera angle, lighting and layers with the approved direction.
3. Reuse a suitable asset or part before requesting generation. If none fits,
   briefly record the missing quality and the sources checked in the task's review
   notes. Do not draw organic art in code to fill the gap.
4. **Open and free before drawing** (owner, 2026-10-30). When nothing in our own
   material fits, look for a finished asset under an open licence before asking a
   model to draw: OpenGameArt, Kenney, itch.io packs marked CC0, Wikimedia Commons
   for photographs and references, and the model libraries already named in
   `docs/3d/character-experiments.md`. Read the provider's index or API first and
   check the size before downloading (AGENTS.md). The licence must allow commercial
   use and changes and fit the content licence of this game (CC BY-SA): CC0 and
   CC BY are fine with the credit line, CC BY-NC and "free for personal use" are not,
   and an asset whose licence page cannot be found is not free. Record the source
   URL, author and licence in the task's `reuse-review.json` and in the credit the
   build generates; an open asset is then re-drawn or fitted to the 64 px grid and
   palette like any import, never pasted as is. Draw with a model only when the
   search found nothing fit for the look, and say in the review notes what was
   searched.

## Preserve and describe drafts

- Keep distinct originals and useful variants, even when they fail the initial
  brief. Preserve raw art separately from crops, imports, palette conversions and
  animation derivatives. Never overwrite the sole original or delete another
  session's material. Exact duplicate bytes may share one indexed asset while
  retaining every source location.
- Keep the existing generation manifest/provenance format. Add a companion
  `reuse-review.json` beside the task's art when it has no place for review data;
  do not change kit schemas or generated manifests to add these fields.
- For each candidate record a stable ID or content hash; source file and branch/
  commit when available; family/variant relationship; intended subject; what it
  actually depicts; useful parts or alternate roles; review status and reason.
  Reference the original prompt, model/tool, references and licence information
  where available. Mark missing provenance as unknown; never invent it.
- Use review statuses `unreviewed`, `keep`, `reuse-parts`, `rework`, or `archive`.
  Record who made the decision. Agent suggestions remain suggestions; do not label
  them owner-approved. Tags such as `future-npc`, `equipment`, `terrain`,
  `vegetation` and `animation` describe potential uses, not game content decisions.
- A rejected protagonist can be a future NPC; a rejected tree can contain useful
  foliage; an unsuccessful scene can contain a useful material. Describe the
  specific reuse opportunity. A `future-npc` tag creates no lore or runtime NPC.

Example companion record (replace placeholders with actual evidence):

```json
{
  "assets": [{
    "id": "creator-character-variant-b",
    "source": "sources/character-b.png",
    "provenance": "provenance.json",
    "family": "creator-character-study",
    "intendedSubject": "main character",
    "depicts": "alternate character with a travel pack",
    "tags": ["future-npc", "equipment"],
    "reuse": ["whole character", "travel pack"],
    "status": "unreviewed",
    "suggestedBy": "agent",
    "reason": "Different silhouette; retain for owner review"
  }]
}
```

## Where good material lives

The owner's rule (2026-10-30): the world is large and every good drawing is kept for
it, in one place that no session's clean-up can lose. That place is the drafts
store, `Bobikobi/GAME-art-drafts` (private, releases only) with its index
`tools/kit-gen/drafts.jsonl` in this repo (PRODUCTION_LINE.md section 3).

- **A `.scratch` folder is a workbench, not a shelf.** Before a task hands back,
  every distinct draft it made or found is pushed with `pnpm art:drafts push` and
  has its line in the index; a run folder that was never pushed counts as not kept.
  Removing a worktree whose `.scratch` holds unpushed art destroys the only copy:
  on 2026-10-30 two worktrees went that way with 541 indexed drafts and came back
  only from a backup the owner had made. Nobody removes a worktree with art in it
  before `art:drafts verify` shows its drafts in the store.
  `pnpm art:stray` lists every art file under a registered worktree's `.scratch`,
  `assets/gen` or run folder whose hash is not in the index (exit 1 when any, 0 when
  none), and `pnpm check` prints its count as a `!` line: run it before removing a
  worktree, and push what it names. Build output (`dist*`, `*-dist`) and captures
  (`e2e*`, `shots*`, and those taken for a pick or a review: `refs`, `ref-*`,
  `stills*`, `owner-*`, `*-pick`) are regenerable and are not listed.
- **Review states are the sorting.** `keep` is the library of good material;
  `reuse-parts` names the part worth cutting out; `rework` and `archive` stay
  retrievable. A drawing that fails its brief but is clean keeps a tag for its
  other use (`future-npc`, `landmark`, `vegetation`, `equipment`). The owner's
  like or no is recorded as his; an agent's sort is marked as the agent's.
- **What is not drawn by us is also kept here**: an open asset (step 4 above)
  enters the store with its source, author and licence in the line, so its credit
  can be generated and its licence checked before it reaches the live kit.
- **The index is the only catalogue.** Galleries, contact sheets and audit folders
  are views; a draft that is only in a view is not kept. Material found outside
  the index (an old worktree, a model's own output folder) is back-filled under a
  `run-backfill-<source>` release with its provenance, `unknown` where it is
  unknown, never invented.

## Review and handoff

- Group variants and animation frames by family/action. A gallery showing only
  the latest image per name does not cover the earlier drafts. Keep review
  decisions in versioned files or an exported file that can be re-imported, not
  only in browser storage or chat.
- Before handoff, ensure reusable sources and their review records have a durable
  location: committed task art, or an agreed asset archive with a retrievable
  reference. Ignored `.scratch` files and absolute paths are discovery aids, not
  a shared archive. Do not bulk-commit large raw outputs; report any archive gap.
- Report what was reused, what new candidates were retained, where they live and
  what still needs owner review. Do not claim automatic collection or complete
  coverage when the indexing/review tooling does not provide it.
- Library acceptance does not authorize insertion into the live game. Use the
  existing import pipeline, visual review and applicable checks for integration.
  Preserve source attribution and comply with the asset's licence.

## Parallel sessions

Each session writes only its own task's records and sources. Read other worktrees
without modifying them; reference or copy identified assets into the authorized
worktree with provenance. Integrate this shared procedure as a small independent
documentation change before other streams adopt it, following
[PARALLEL.md](../team/PARALLEL.md). Existing sessions must read this procedure
after it reaches their checkout; changing one worktree does not update them.
