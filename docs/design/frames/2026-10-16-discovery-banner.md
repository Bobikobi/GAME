# The discovery banner: three stills for the owner

In the open-world draft, the first entry to a region or a named area shows its name, once (G63). The banner is UI frame and words, so it goes to the owner as stills first, and its words follow pillar 2 (`docs/design/GAME_RULES.md:36-37`). Today the first entry to a named area shows a toast, "You reached the Town square" (`game/src/text.ts:459`). These stills try the name as a banner of its own, one difference each. No second region exists yet, so the town square stands in for one: it is labelled "Town square", its words are already in content, it is the first named area most players enter, by day, and it has the busiest background in the valley, so the name is read in the hardest place. Nothing here is in the game yet.

- `2026-10-16-banner-1-card.png`, `2026-10-16-banner-2-low.png`, `2026-10-16-banner-3-lettering.png`: the three stills.
- `2026-10-16-banner-today.png`: the same moment as the game shows it today, with its toast, for reference.

## What each still tests

1. **card**: the area's name only, "Town square", on one line, in Pixelify Sans at `--text-xl` (32 px) with `--leading-tight`, in ink, inside the game's own frame (`.frame`: paper, a 3 px ink border, a 2 px paper2 inset and the 3 px ink shadow), with the word banner's padding of 6 px by 18 px. It is centred, and its top sits 6 px under the tracker's bottom, the place today's toast for this moment uses. The words follow pillar 2: one line, a name, no verb, no lore, no input asked. Pillar 2 allows a second line; it stays free for a region's name once regions have names.
2. **low**: as 1, with the card moved down, its top 40 px under the player's feet, still centred. It sits where the eye already is, over the ground just walked: the path south of the square, for this northward entry. A southward entry would cover the ground ahead.
3. **lettering**: as 1 in place and size, without the card: the same text box and glyph places, the name in paper with a whole-pixel ink outline 2 px wide (one game pixel) on all eight sides, and no blur, box or shadow. It reads as the world's own title, as World of Warcraft's zone text and Elden Ring's area names do, instead of a message.

## The moment

One frame on a 390x844 phone at 13:03 on a fresh save (New game, Forager), the same in all three: the player has just stepped from (28, 11) onto (28, 10), the square's south row, facing north, and the first-entry visit has just fired. The camera stops at the map's top here, so the feet are at y 352, 70 px above the middle, and the square's tiles span x 115-243, y 224-352. The world is develop's, with no change for the captures; the game and its CSS animations were paused on that frame, and only the banner was redrawn between the captures. Every toast is hidden in the three stills; today's toast appears in the reference only.

The HUD is develop's. Inside the town it has no "Dark in" row, so the tracker ends at y 152.5. The HUD work in flight moves the toasts low on phones (about y 550-624), sets the tracker's text at 16 px and widens it to 368 px; if it lands first, the card keeps its place 6 px under the tracker's new bottom.

## The numbers

Measured with `getBoundingClientRect` and on the stills, in CSS px. Contrast is the WCAG ratio.

- The card is 238.5 x 54.8 (its text 196.5 x 38), one line of 11 characters, centred at x 195.3 on a whole pixel. In 1 its top is at y 159, 6.5 px under the tracker; its shadow ends at y 216.8. Today's toast in the same place is 240.7 x 32.8, at y 158.5, in 15 px text.
- In 2 its top is at y 392, 40 px under the feet, with the same size and centre.
- In both places it overlaps nothing: 0 px with the HUD and the tracker, the player's sprite (x 179-211, y 304-352), the square's tiles, the word banner's place (x 89-301, y 280-362 for a level), the pad (from y 682) and the buttons (from y 744), and the low toast zone of the HUD work in flight (y 550-624).
- Distance to the player: in 1, 90 px from the card's bottom to the top of the sprite (138 to the feet); in 2, 40 px from the feet to the card.
- Area: 6.3% of the free game area (390 x 529.5, from the tracker to the pad) in both.
- Ink on paper is 15.5:1, in exact palette colours, since the page is not graded. The glyph edges carry the browser's usual smoothing, as all of today's interface text does.
- The longest name in the valley, "Threshold of the night ruins" (28 letters), in the same card: at 32 px its text is 438 px wide, a card of 480 on one line, too wide for a phone; inside a card of 358 (390 less two 16 px gutters) it takes two lines, a card 358 x 91.6. At 22 px its text is 301 wide, a card of 343 on one line.
- The lettering (3) sits on 1's glyphs: 960 pixels fully inked in 1 and 962 fully lit in 3, 2 of them different; the 31 edge pixels that cross the half-way mark differ by at most 0.07 in coverage (the browser smooths dark on light and light on dark a little differently). All 1,921 pixels within 2 px of a glyph are ink or mostly ink, and from every glyph pixel each of the eight ways meets ink within 2 px, so the outline never breaks over the houses and cobbles. No pixel changed farther than 3 px from a glyph, so nothing of the card remains. Paper on ink is 15.5:1.
- The captures: a second capture of 1, taken last, matched the first with 0 pixels different. 1 against 2: 27,724 pixels differ, 0 outside the two card boxes (each card with its shadow). 1 against 3: 13,862 differ, 0 outside 1's box. 2 against 3: 0 outside the two boxes. The reference against 1: 0 outside today's toast and the card.
- The palette: 1 and 2 use paper, paper2 and ink, plus the frame's own shadow, today's look; 3 uses paper and ink.

## The question

Which banner: **1, 2 or 3**? 2's place with 3's lettering is also possible.

Recommended default: **1.** It is the game's own frame, in the place today's toast already uses. It stays clear of every other part of the interface, on develop and in the HUD work in flight, and never covers the player or the square. Its cost: it covers the ground north of the player, here the fronts of the houses.

- 2 puts the name where the eye already is, but it covers the ground just walked, and on a southward entry the ground ahead, the way the player is going.
- 3 is the lightest and reads as a title, but over a busy background it rests on its outline alone, and it leaves the framed card that the toast, the tracker and the word banner share.

## The 3D client

The banner is page text over both clients, so the same stills hold for the 3D client, with the same places and sizes.

## After the pick

DECISIONS.md takes the pick with its frame. The client shows the banner on the first entry to a region or a named area, in place of today's visit toast (`game/src/text.ts:459`): about 120 lines, together with the border's bump line, in stage 5. The timing is polish under the picked look: in and out like the word banner, and without motion under reduced motion (`game/src/style.css:1858`). The change that drew these stills was for the captures only and is not committed. Until then the game keeps today's toast.
