---
mode: agent
description: Build one kit-style prop from an object in an outside picture, through kit:gen and kit:import, eyes before numbers.
---

Follow `docs/art/PROP_FROM_REF.md` exactly, in order. Step 0a (name the object by looking,
wait for the owner's confirmation) and step 0b (the palette decision) come before any image
call; `tools/src/kit/gen.ts` refuses an outside reference that skips them. Never draw pixels
by code or by hand; look at `gallery.html` before every decision; at most three rounds.

Reference image: ${input:ref:path to the PNG crop, from the repo root}
Region: ${input:region:where the object is in the picture, in plain words, not what you think it is}
