# The skill screen: three stills, one frame each (2026-10-20)

The direction step of [GROWTH.md](../GROWTH.md) section 6. The screen that replaces the journal's Skills tab is a UI frame, so it goes to the owner as stills before it is built (AGENTS.md). Nothing in the game changed: no screen code, kernel, content or schema was touched. The output is the three frames and this note; the pick's record is the DECISIONS entry of the same pull request once he answers.

## The frames

Every frame is 390x844 CSS pixels at 3x, **1170x2532**, the phone frame of the 20.10 art ladder. They are HTML mockups rendered by a headless browser: the game's UI font (Pixelify Sans, `game/public/fonts/`), the 32 core colours of STYLE.md section 2 and the one outline colour, text at 15 px and up. They are for the frame, not the final art: the icons are colour squares, the sprites are not drawn, and no pixel rule of STYLE.md was checked on them.

The content is the same in all three, so the difference is the frame alone:
- Wren, a forager at level 7 with two points to spend.
- Six schools: the trunk (Forager) and the five trades (Foraging, Woodcraft, Digging, Cooking, Handcraft), each with a corner node, small nodes and major nodes on one path.
- Learned: Quick hands, Ripe eyes and the forager's corner in Foraging; Sure swing and Felling line in Woodcraft; Steady in Digging; Camp meal in Cooking; Sure hands in Handcraft; Long stride in the trunk.
- Next: Depth sense in Digging, a major node that asks for senses 3 where the player has 2.
- The build: three open slots of five (Ripe eyes, Felling line, Camp meal; the fourth at level 10, the fifth at level 15); Camp meal follows Felling line (the gold mark); Long stride learned and not in a slot.
- The keys: carry 3, senses 2, agility 1, luck 2, stamina 2 of 5.

| Frame | Tests | Everything else |
|---|---|---|
| `2026-10-20-skill-S1-wings.png` | **The picture.** The whole growth as one picture: the trunk in the centre, five wings around it, the corner node where each wing meets the trunk, the touched node's card under the picture, the build as a strip at the foot with the keys | As listed |
| `2026-10-20-skill-S2-schools.png` | **The list.** The schools as cards, one open at a time (Digging) with its path in a row, the next node and its key named, Learn and Unlearn on the open card; the build as the same strip at the foot | As listed |
| `2026-10-20-skill-S3-board.png` | **The build.** The slots first, as a board of five with the equipped techniques and which one follows which; the shelf of learned techniques under it; the keys as tokens; the schools behind one button | As listed |

## Question

Which frame is the skill screen: the picture, the list or the build first?

Recommended: S1, the wings, with the strip at the foot. It answers the fault of 19.10 ("it is not clear what the differences are") in one look, and the build is one tap away. S3 if the build should be the first thing seen; S2 is the plainest on a phone and the most like every other game's list.

## How they were made

A script writes the three pages from one shared stylesheet and one content list, and a headless browser shoots each at 390x844 with a device scale of 3. The script is not kept in the repository: the frames are the record, and a rebuilt screen is built from the kernel's state, not from the mockup.
