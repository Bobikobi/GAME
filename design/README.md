# design/

The bridge between the game and the site: one token sheet, one palette, one
signature element. Decided in `DECISIONS.md` (2026-10-07, "One token sheet and
the pixel frame tie the site to the game") and laid out in
`docs/team/PLATFORM.md`, section 5.

- `tokens.css` - colours (a subset of the 32-colour core palette, same names as
  the game), the pixel unit, the two faces, the type scale, spacing steps and
  the frame. Both apps import it; `tools/test/design-tokens.test.ts` guards it.
- The site uses the named subset `paper, paper2, ink, ink2, grey, green, green3,
  gold, cream` and no hex of its own (a `web/` test in `docs/team/GRUNT.md`).
- The game's `game/src/style.css` keeps its own `:root` copy until the import
  lands (GRUNT item 2); the test keeps the two equal until then.

What is not here on purpose: no rgba scrims, no gradients, no border radius,
no second accent colour, no icon font. Icons are sprites of the core kit drawn
at 2x or 4x with `image-rendering: pixelated`.
