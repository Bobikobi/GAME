# LoomVale — RICH tree and depth polish, 2026-10-26

Continue the existing connected world study at `/world-study.html`; the owner's positive world feedback and approval of the sea remain the baseline. This iteration addresses repeated tree facing and weak grounding. The owner accepted the connected demonstration, requested solid tree bases, then preferred the original detailed oak as the common tree style. The current scene uses that original oak for all seven trees.

## Starting state and parallel work

Authorized checkout: `/home/elad-saadon/Projects/GAME.worktrees/codex-rich-opening`, branch `art/rich-opening-ground`. Started clean at `64f64ba1`. During the read-only investigation, the separate documentation change `5676e36d` landed in the same checkout; it was read and retained. No demonstration source changed concurrently.

`pnpm streams` and available branches, tracked history, PRs and local worktree changes were checked before implementation. No overlapping fix to this world study was found. Other tree-named streams concern the skill tree. The old ground-decoration and 3D environment changes are separate work. This is evidence about available repository state, not visibility into every unpublished session.

## Reuse and visible changes

- Retain the existing detailed oak and its original source/provenance in `../rich-world-expansion-2026-10-26/`.
- Preserve the tested broad-crowned oak draft from `art/props-wave-1`, its exact raw source, original imported derivative and successful manifest record. The owner found its style inconsistent; it is marked `rework` and is no longer loaded or placed in the scene. No new images were generated.
- Seven rooted trees from the original detailed oak, with independently selected mirrors, modest sizes and staggered root positions. All retain at least the existing 320px frame height. Whole-tree rotation is only the existing small wind sway, not a substitute for another view angle.
- Reuse the game's `cast.ts` alpha projection and morning sun table for cached tree silhouettes and a cached moving character shadow. Static shadows merge at one opacity and are clipped to land. Contact shading remains in storm weather; sun shadows turn off. The `צללים` checkbox permits a direct comparison.
- Preserve player see-through, but only fade a tree when its painted pixels overlap the character. Existing depth ordering follows the root positions.

`reuse-review.json` separates agent reuse choices from owner approval. The used source and derivatives have durable copies here; unselected woodland candidates remain discovery references in their original worktree, with that archive limitation recorded. This adds no production-kit art, map, gameplay or story content. Water art and rendering equations are unchanged.

## Review

`phone-forest-unified.png` and `desktop-forest-unified.png` show the current original-oak-only scene. `phone-forest.png` and `desktop-forest.png` retain the earlier mixed-tree trial. `phone-forest-no-shadows.png` isolates the shadow contribution. `phone-meadow.png` and `phone-cove.png` retain surrounding-world context. The broad oak has larger pixel clusters than the original narrow oak; the owner rejected the mixed style on2026-10-27. Mirrored sprites provide silhouette variety, not genuine new 3D camera angles or geometry.

Validation results are recorded in `review.json`. The importer is reproducible with `pnpm exec tsx tools/src/kit/import-world-trees.ts`. Preview: `pnpm --filter game dev --host 127.0.0.1 --port 5189 --strictPort`, then `http://127.0.0.1:5189/world-study.html`.

## Owner follow-up

The owner states the project and game are now named **LoomVale**. A later focused task should adapt the home page to that name and branding. This is a recorded next task; the home page was not edited in this tree/depth iteration. Continue from the existing page and design when that task begins.

## Follow-up: solid tree bases

Owner feedback: "הדגמה עוברת, כמובן הדמות לא אמורה לעבור דרך העצים עצמם". Walking now checks a small feet rectangle against a shallow root/trunk ellipse for each tree. The ellipse scales with the displayed tree, while the crown remains an overhang that can be walked behind. Tree hiding and wind sway do not remove or move these obstacles. Land alpha remains separate so water and shadow clipping still describe terrain alone. The character slides around a blocked axis rather than stopping both axes. Three pure tests cover contact from every side, feet-width overlap, clear canopy/corners and shore clearance. Browser input verified approach and stop from all four sides without entering or crossing a trunk, plus open canopy space and all four viewpoints.

## Owner correction — 2026-10-27

The owner finds the two oak drawings too different in style and prefers the original detailed oak. The broad oak is now removed from preload and placement; all seven trees use the original oak, retaining modest mirror/size variation, staggered roots, collision and silhouette shadows. Its raw source, original import, new import and manifest remain preserved here, marked `rework` in the reuse review. Earlier mixed-tree captures are historical evidence of the rejected mix, not the current target.

The shared visual reference is the original `../rich-world-expansion-2026-10-26/oak.png`, not whichever draft is convenient for each region. The owner has assigned geographical design to a Claude agent. This session reads the existing planning documents only and makes no geographical-design change. The corrected forest captures are `phone-forest-unified.png` and `desktop-forest-unified.png`.
