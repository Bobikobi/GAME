# The site's first screen, three stills (2026-10-22)

For the owner's pick, per AGENTS.md: a direction is tried as phone stills before any build, each testing one named difference. Every frame is 390x844, with one 1440x900 companion each, built from the site's own tokens, fonts and the core kit. Nothing is built: `web/` is unchanged.

## What reads as a template today

`site-direction-today-phone.png` and `-desktop.png` are the live home page in its finished frame (motion off).

- **The art comes fourth.** On a phone the first screen is the bar, a two-line headline, a three-line lead, then a 192px strip of the valley: about a quarter of the screen. Headline, lead, then "hero media" is the order of every software landing page.
- **The window reads as a banner.** At two CSS pixels per art pixel it shows twelve tiles across and six down, and a character is 48px tall. The page's one signature has the shape of the header image a visitor has learned to skip.
- **The rest of the first screen is a parts list.** A thumbnail card with a chip, a board of five rows where four say "Open", and under the fold dashed "coming soon" boxes and a grid of links. Each piece is careful and within the rules; together they are hero, cards, empty states, feature grid. That structure was approved on 2026-10-10 and stays; only the first screen is in question.
- **What strong game sites do.** The sites compared (a hand-drawn action game, a pixel-art adventure, a roguelike) open on art edge to edge, put the title on the art, keep one action in the first screen and at most a line of words before the scroll. A pixel-art game has no painted key art; its living world is the art. The game's own title screen already does this: the valley fills the screen and a paper panel sits on it.

## Three stills, one difference each

Shared by all three, and recorded by the pick: the window draws at **3 CSS pixels per art pixel on a phone and 4 on a desktop**, replacing "2 under 600px of window, 3 above" from 2026-10-10. At 2, a window this tall would still read as a strip. The camera, the finished frame and the world rows are identical across A, B and C.

| Still | The one difference |
|---|---|
| **A** taller window | The window grows from six tiles to most of the screen. The headline and lead stay above it, the door foot (Classic, Play) under it. |
| **B** world first | The headline leaves the paper and moves onto the ink band under the window, with the door's note and Play. The window starts under the bar. |
| **C** door in the world | The same headline, note and Play as B sit on a paper panel over the window, framed in ink like the game's own title screen. |

What every pick changes:

- **Home criterion 1** of PLATFORM.md 5.5: in all three, the 3D door and the board's title and tabs leave the phone's first screen. B and C also move the lead under the fold and drop the door name "Classic". The pick rewrites criterion 1 to what its first screen holds.
- **C bends the frame rule.** The panel is the classic door's face, so it takes the door's ink frame; read as a third framed thing, it breaks "only the two doors and outlined buttons".
- The stills drop the oak and lantern rising one tile above the window's top edge, and the world's lower rows are the harness's extension of the scene, not today's scene map. Both are polish after the pick.

## The question

**Where do the words sit once the valley owns the first screen: above the window (A), on the band under it (B), or on a panel over it (C)?**

Recommended default: **B**. It is the smallest step with the largest change. The ink band is already the window's mat today, the reading order stays bar, world, headline, Play, and no new frame or layer is added. A still opens on a paragraph. C is the game's own pattern and the boldest, but a framed panel over the world is one accessory more and can read as a dialog in the way.

## After the pick

The pick goes into DECISIONS.md with its frame. The build follows in one pull request: the scene map in `tools/src/site/scene.ts` grows up and down, `scene.css` takes the scale, height and camera, the first-quest animation keeps its beat, the pause stays a checkbox and label, and the home tests and criterion 1 follow.

The stills were composed from the core kit: the window's real ground strip, extended with the kit's own tiles and props, shot with headless Chrome. The harness lived outside the repository and is deleted.
