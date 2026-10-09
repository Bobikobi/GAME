# Meshy notes: plans, credits, limits and how to work with it cheaply

Read on 2026-10-09 from meshy.ai/pricing, docs.meshy.ai (webapp pricing, API pricing,
changelog, rigging guide), help.meshy.ai (credit costs, free plan), the Meshy credits guide,
the referral terms, the in-app dialogs, and the community write-ups listed at the end.
Numbers change; the app's own cost labels win over this page.

## Plans

| | Free | Pro | Studio |
|---|---|---|---|
| Price | 0 | 20 USD a month (new accounts: 50% off the first month; 192 USD a year) | about 60 USD a month, 4,000 credits (third-party listing, not checked on the site) |
| Credits | 100 a month, reset on the 1st at 00:00 UTC, no rollover | 1,000 a month, reset on the subscription date, no rollover | 4,000 a month |
| Downloads | 10 a month, Meshy 6 Lite models only; every download of the same model counts | unlimited, every model version | unlimited |
| Licence | CC BY 4.0: Meshy owns the output and licenses it; commercial use with a "Meshy" credit | private, customer-owned, no credit | private |
| Queue | 1 task at a time, low priority | 10 tasks, standard priority, about 60% faster | 20 tasks, higher priority |
| Animation presets | 20 | over 500 | over 500 |
| Rigging | free, only while the raw mesh is under the rig size limit; no rig after a remesh | free, also after a remesh | same |
| Pose option (A/T-pose) | no (Meshy 6 Lite has no pose option; the prompt can ask for it) | yes | yes |
| Remesh | fixed 10K only | custom polycount | custom |
| Retries | none | 4 free retries per generation | 8 |
| API | no | yes (credit based) | yes |
| 3D Agent | yes since September 2026 (asks before spending credits, per-turn budget) | yes | yes |

Models made on a paid plan stay downloadable without limit after a downgrade to Free
(help article "What is included on the free plan", updated 2026-08-31). Monthly credits
burn before permanent credits.

## Credit costs (web app, help article 10000507; the app label wins)

| Step | Credits |
|---|---|
| Model stage: Meshy 7 / Meshy 6 / Meshy 6 Lite | 25 / 20 / 10 |
| Smart Topology T1 / T2 (native low poly, 100 to 15,000 polygons) | 10 / 5 |
| Texture 2K or 4K / 8K | 10 / 15 |
| Retexture | 10 |
| Smart-Rig, preset animations, remesh to the fixed 10K | 0 |
| Text to Motion: Prime / Swift | 10 / 3 (the app showed 10 for Prime) |
| AI auto-repair, auto-split | 10 |

Credits are not charged for content-filter blocks or Meshy-side technical failures; a task
cancelled while queued is refunded, one cancelled after it started is not. A failed result
that is Meshy's "art" rather than a crash is charged.

API pricing (docs.meshy.ai/en/api/pricing) is a separate, pay-before-you-go wallet: text to
3D preview 20, refine 10, image to 3D 20 to 35, remesh 5, auto-rigging 5, animation 3 per
action, text to motion 10 (prime) or 3 (swift). Pro and above only.

## Ways to earn credits without paying

- Daily check-in: opening the workspace on a new calendar day claims the day's bonus (checked
  2026-10-09: the visit alone claimed day 2, no generation needed). Five reward days per
  30-day cycle: 30, 30, 50, 50, 100 credits, and one extra download on day 5. The days need
  not be consecutive. The in-app dialog says these credits expire after about a month (the
  credits guide calls them permanent; trust the dialog). A tab left open overnight does not
  count; the page must be loaded on the new day.
- Onboarding tasks: five tasks of 20 credits on Free, six of 50 on Pro (credits guide).
- Connecting a Discord account: 100 credits once.
- Referral: the invited account gets a 20 USD coupon (one free month of Pro); the inviter
  gets the same once the invitee makes a first model within 14 days.
- Loyalty: each on-time paid renewal grants permanent credits (Pro monthly: 500 the first
  time, growing with the streak).
- Contributor program (meshy.ai/creators): accepted creators get a free month of Pro or
  1,000 credits on joining, then rewards per approved monthly contribution. Anything
  published to the community page becomes CC0.
- Community features: 50 credits per model featured by the community team.

## What the free plan gives this project in practice

- A textured Meshy 6 Lite character is 20 credits and one download; the rig and the
  Walking and Running presets are free. About 20 credits a day of check-in bonus for five
  days a month brings the monthly pool to about 360 credits, so the download cap (10, plus
  1 on day 5) is the real limit: at most 10 or 11 downloaded assets a month.
- Download once. Every download of the same model counts, so add every clip first and
  download the single combined file; rename and trim clips in the local pipeline (norm.mjs).
- Rig while the raw mesh is under the rig size limit. The warrior (191K faces) rigged, the
  mage (323K faces) did not; the fixed 10K remesh makes a mesh rig-eligible only on Pro. A
  mesh that misses the limit is reduced and rigged locally in Blender instead
  (tools: rig transfer from an already rigged character, then automatic weights).
- Queue: one task at a time and low priority; a rig took about five minutes at night.
- The free auto-rig is one per account: the second rig on the same account asks for a plan.
  Four-legged characters rig with the Quadruped Dog template, whose free library holds one
  motion, Walking; Idle and Run come from the local pass (`game/tools/blender/quad_pass.py`).
- The rig download is a zip of two GLBs; the `..._Animation_Walking_withSkin.glb` one holds the
  mesh, the skeleton and the walk. A rig of an uploaded mesh comes back without its textures,
  so keep the textured draft's download for its maps; a rig of a Meshy asset keeps the colour
  map but also wires it to emission, which glows at night.

## What people warn about

- Topology: dense, triangulated, uneven; hero characters want a retopology or a reduction
  pass before shipping (we reduce to about 60K triangles; 40K is the next target).
- Auto-rig weights: capes, skirts, long hair and anything close to the body get leg or arm
  weights and cut through the body in motion; fix by re-weighting the cloth to the pelvis
  or adding a short bone chain in Blender. Remesh before rigging gives cleaner binding
  (Meshy's own guide).
- No finger or facial bones in the auto-rig; hands ship in their generated shape.
- Credit traps on Free: the default model choice can produce a model that cannot be
  downloaded on Free (only Meshy 6 Lite downloads); check the model and the licence badge
  before every generate; the retry button is paid.
- Subscriptions auto-renew; a cancellation takes effect at the next period; refunds only
  within 5 days of payment and with at most 100 credits used.
- Fast mesh is not a shipped mesh: budget the last stretch (weights, clips, size, credit
  line) in the local pipeline, not in Meshy.

## Working cheaply and consistently

1. Decide the direction with stills, not downloads: generate 20-credit textured drafts,
   screenshot the viewer, pick one, and download only the pick.
2. One style sheet: for a matched cast use Image to 3D (or multi-view on Pro) from one set
   of concept images in the same style, instead of free text prompts per character. Meshy
   7 reads the reference closely; on Free, Meshy 6 Lite from text is the only downloadable
   path, so keep one fixed prompt prefix for the style and vary only the character part.
3. Props and environment pieces: Smart Topology (5 to 10 credits, 1K to 5K polygons) or
   Meshy 6 Lite mesh only (10 credits), textured only when needed. Buildings, props and
   vehicles cannot be rigged; humanoids and quadrupeds can.
4. Pose: ask for a relaxed A-pose in the prompt (arms about 30 degrees from the body,
   fingers apart) and check the result before rigging; the free rig cannot fix a bad pose.
5. One skeleton standard: export with the Mixamo skeleton template, keep the clip names
   Idle, Walk, Run, and give every character the same skeleton so clips are shared.
6. When a paid month makes sense: a cast of three to five characters at full quality,
   A-pose, custom polycount and rig after remesh. The first month is 10 USD; download
   everything before cancelling; the models stay downloadable afterwards.

## Sources

- https://www.meshy.ai/pricing
- https://docs.meshy.ai/en/webapp/pricing and https://docs.meshy.ai/en/api/pricing
- https://docs.meshy.ai/en/webapp/changelog
- https://docs.meshy.ai/en/webapp/guides/3d-model/rigging
- https://help.meshy.ai/en/articles/10000507 (credit costs)
- https://intercom.help/meshy/en/articles/15696428-what-is-included-on-the-free-plan
- https://www.meshy.ai/tutorials/meshy-credits-guide
- https://meshy.notion.site/Referral-Terms-Conditions-4272a9c5e69c4f9b8da827abac55f87b
- https://intercom.help/meshy/en/articles/9991915-how-can-i-get-a-refund
- https://toolradar.com/tools/meshy/pricing (Studio figures, third party)
- https://sorceress.games/blog/mesh-meshy-ai-image-to-3d-textured-glb and
  https://framia.converge.ai/blog/meshy-ai-review (community assessments)
