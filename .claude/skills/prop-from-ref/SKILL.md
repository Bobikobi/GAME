---
name: prop-from-ref
description: Build one kit-style prop from an object in a picture from outside the game (a screenshot, a photo, a painting). Use when the owner hands a reference image and asks for a sprite, prop, tile or object "like this one". Routes through kit:gen and kit:import, names the object by looking first, takes the palette decision before the first image call, judges by eye in the gallery.
---

Follow `docs/art/PROP_FROM_REF.md` exactly, in order. It is short; read all of it first.

The three things that went wrong before and are now rules:

1. Name the object by looking at the crop, write what you saw, and wait for the owner to
   confirm (step 0a). A file name once turned a stool into a barrel.
2. Take the palette decision before the first call (step 0b): `fits`, `restyle` or
   `ramp-added`. `tools/src/kit/gen.ts` refuses an outside reference without it.
3. Never draw pixels by code or by hand, and never let a score steer a round. Open
   `gallery.html` at 3x phone size and write two sentences on what you see before each change.
   At most three rounds.
