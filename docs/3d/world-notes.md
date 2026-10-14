# World structure notes (3D track)

Direction from the product owner (09.10): the ground is never a flat plate - hills, valleys,
cliffs and other relief; a house or a cave loads through a smart transition so the browser is
never overloaded; and not everything has to run in the browser if that matters to us.

## Terrain

- Heightmap terrain: a greyscale relief image (or a small float array per chunk) displaces a
  grid mesh; slopes come from the normal map; "walkable" = slope under a threshold.
- The world is split into chunks (for example 64 x 64 m). Only the chunks around the player are
  resident, in two or three levels of detail (full / half / quarter grid) by distance; far relief
  is one low ring mesh or a skybox silhouette.
- Texturing by a splat map (grass / rock / path / snow) blended by height and slope, with a
  triplanar sample on steep faces so cliffs do not stretch.
- Vegetation and rocks are instanced meshes scattered per chunk by seeded noise, so the same
  chunk always looks the same.
- Authoring: the pixel map and the 3D heightmap share one source of truth for where things are
  (paths, buildings, water); the heightmap is derived from a painted relief layer, not
  hand-modelled.

## Interiors (house, cave)

- An interior is its own small scene file (GLB + lights), not part of the outdoor chunk.
- A door or a cave mouth is a portal: within N metres the interior starts loading in the
  background; crossing the threshold fades to the interior once it is ready (a short fade, never
  a loading screen when the preload had time).
- The outdoor chunks stay resident inside a house (cheap, fast exit); a deep cave releases the
  outdoors after the first bend and reloads them on the way back.
- Budget per interior: under 2 MB download and under 100k triangles, so the transition stays
  under one second on a mid-range phone.

## Browser or not

- Everything above fits the browser with Three.js: heightmap chunks, instancing and streamed GLBs
  are standard; the limits are download size and phone GPU, both handled by the chunk and
  interior budgets.
- A downloadable client (a desktop wrapper around the same web code, or a store app) adds
  install friction and a second deployment and changes nothing in the rendering. Worth it only
  if measurement shows the browser cannot hold the target scene. First measurement to run: a
  3 x 3 chunk valley with 20 characters at 60 fps on the reference phone.
- A different engine (a native one with its own editor) changes the art pipeline, the code and
  the team's skills at once. It is a direction decision, not a technical one, and is not
  recommended while the game is a browser game.

Decision (owner, 2026-10-09): browser-first. A downloadable client is planned only if the first
measurement above shows the browser cannot hold the scene.
