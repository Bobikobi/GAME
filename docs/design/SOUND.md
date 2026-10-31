# Sound: the effects measured, three town-theme listens, and the source question (2026-10-30)

**Status:** Proposed 30.10. Nothing here is built. The effect numbers of section 1 are a proposal for a builder; the three listens of section 2 wait for the owner's pick; section 3 is the owner's question.

A design page. The owner, 30.10: "the sound effects need to be reduced, and the soundtrack will need enriching". The music direction step filed on 21.10 (DECISIONS 2026-10-21, "Three gaps of 21.10", the music gap) is current from today. The rules are in [GAME_RULES.md](GAME_RULES.md), "Sound and music" (G24 to G27), and are not repeated here; the beds by place are DECISIONS 2026-10-11. Today every sound is the synthesizer's (`game/src/audio/`) and the game ships no audio file.

## 1. The effects, measured

### 1.1 How it was measured

The phone opening of the e2e harness (`game/e2e/opening.ts`, `E2E_ONLY=phone`: the elf on the west bank, touch only, 390 by 844) was played headless on 30.10 from the title screen to the wake in town, with every `sound.sfx` and `sound.jingle` call logged in the page with its time and options. The whole opening took 521 s; the effects ran from 3.7 s to 508.6 s, so the window is the first 8.5 minutes, the whole opening (it ends before the tenth minute). Headless Chromium runs the audio context suspended, so the counts are the effects the game asked for, which is what a player with sound on hears (`sfx()` plays every ask once the context runs and the mute is off). The night bed's ruin bell, the birds of the day bed and the fire's pops are ambience, not effects, and are not counted.

The scripted player is quicker than a person: it walks the shortest way, never waits and reads no line. The counts per minute are therefore an upper bound; the before and after ratio is what holds.

Peak and length come from rendering each effect alone with `playSfx` at gain 1 and no detune in an `OfflineAudioContext` at 44.1 kHz. "At the speaker" multiplies by the effects bus (0.8) and the master (0.8) before the compressor (`audio/index.ts`), and by the call's own gain where the call passes one. For scale: one lead note of the valley song reaches about -20 dBFS at the speaker (lead 0.22 times the music bus 0.45 and the master), and the song's loudest moment about -7 dBFS.

### 1.2 The table

| Effect | Its cause (the beat on screen) | Played in 8.5 min | Repeats inside 1 s | Peak at the speaker | Length |
|---|---|---|---|---|---|
| `click` | a press the dialogue answers; the name carved | 116 | 91 | -24.5 dBFS | 0.04 s |
| `voice` | a named speaker's syllable, one per 4 letters typed, at gain 0.8 | 107 | 97 | -27.4 dBFS | 0.09 s |
| `dig` | a blow of a dig (the arm lands, dirt flies) | 100 | 90 | -21.1 dBFS | 0.22 s |
| `wings` | birds lift over a find the mist hides (cue `birds_lift`), 0.35 to 1 by distance | 47 | 33 | -25.6 dBFS at most | 0.90 s |
| `pluck` | a pick graded (berries, herbs); eating | 45 | 20 | -21.1 dBFS | 0.08 s |
| `pickup` | an item gained (toast) | 24 | 0 | -11.6 dBFS | 0.16 s |
| `jingle:found` | a first-of-kind item in the journal (17), the riddle solved (1) | 18 | 0 | -5.8 dBFS | 0.75 s |
| `thud` | a blow on a tree; the tree lands; hurt | 17 | 11 | -13.4 dBFS | 0.18 s |
| `perfect` | a perfect grade; an attribute point; a recipe learnt | 11 | 0 | -11.3 dBFS | 0.15 s |
| `jingle:quest` | a task done; a place restored or built | 10 | 0 | -5.2 dBFS | 2.31 s |
| `ui` | a task opened | 8 | 0 | -17.2 dBFS | 0.07 s |
| `crack` | a blow past the middle of a felling (0.5 to 0.75); the tree falls (0.9); a tool breaks | 8 | 5 | -17.7 to -14.3 dBFS | 0.25 s |
| `strike` | a blow on stone; the strike game's hit | 7 | 4 | -14.5 dBFS | 0.12 s |
| `coin` | gold in or out (toast); the coins reach the purse | 6 | 3 | -22.2 dBFS | 0.25 s |
| `step` | walking in at a shop's door | 4 | 0 | -46.0 dBFS | 0.02 s |
| `jingle:level` | a profession's level | 3 | 0 | -4.0 dBFS | 2.40 s |
| `bell` | the far bell of the first mend (0.18, low-passed); a fall | 2 | 0 | -25.4 dBFS or less (far) to -10.5 dBFS | 3.0 s |
| `whisper` | the ruin's whisper near a ruin slot | 1 | 0 | -28.6 dBFS | 1.5 s |
| `growl` | a predator has seen the player | 1 | 0 | -10.6 dBFS | 0.75 s |
| **All** | | **535** | **452 gaps under 1 s** | | |

Not heard in this run: `snap`, `tug`, `rustle`, `hammer`, `sizzle`, `douse`, `back`, `miss`, `good`, `safe`, `plop`. Their peaks at the speaker, for the proposal below: `douse` -13.6 dBFS over 0.85 s, `sizzle` -14.8 over 0.5 s, `safe` -21.0 over 0.59 s, `miss` -23.2, `back` -17.3, `snap` -11.9, `plop` -18.2, `rustle` -18.2, `hammer` -16.3, `good` -17.2, `tug` -29.7.

**63.1 effects a minute** over the opening; 36.8 a minute without the dialogue's click and voice. The busiest minute (the fifth, the dig loop at the ruins) had 106.

What the numbers show:
- **The found jingle is not rare.** It rang 18 times in 8.5 minutes, 17 of them for the first of a kind of item reaching the journal (the kernel's `discover` event, `ui/feedback.ts`), once for the riddle. G25 means it for a find the player could not count on; a first berry is not one. G24 asks for a journal entry to have its own short effect, and today it borrows the jingle.
- **One batch stacks up to six cues in 0.7 s.** At 25 s one pick played `pluck`, `pickup`, `perfect`, `found`, `level` and `quest`, two of them jingles that each duck the music. `feedback.ts` already says "a jingle carries a batch on its own", but still plays the small cues first.
- **Birds lift in flocks of sounds.** One step that starts the cue on several tiles played `wings` up to ten times in two seconds (at 155 s and at 228 s), each 0.9 s long, so they lay on top of each other.
- **The talk is the densest sound.** Click and voice are 223 of the 535; a voice syllable every four letters is about seven a second while a line types.
- **The effects sit 9 dB over the tune.** `pickup` and `perfect` reach -11 dBFS and the jingles -4 to -6 against a lead note at -20, so the effects, not the music, are what a player hears.

### 1.3 The proposal, in numbers

Every visible beat keeps a sound (G24) and the found jingle becomes rare again (G25). Nothing here is built; the same numbers go to the 3D door (`play3d/world3d.ts` calls the same effects for the same beats).

Quieter (the target is the peak at the speaker):

| Effect | Today | Target | How |
|---|---|---|---|
| all jingles | -4.0 to -5.8 dBFS | -9 to -11 dBFS | the jingle voices' gains times 0.55 (lead 0.24 to 0.13) |
| `pickup` | -11.6 | -17 | base gain 0.55 |
| `perfect` | -11.3 | -17 | base gain 0.5 |
| `thud` (a blow) | -13.4 | -18 | gain 0.6 on a blow; the tree's landing keeps 1 |
| `strike` (a blow) | -14.5 | -18 | gain 0.65 |
| `dig` | -21.1 | -24 | gain 0.7 |
| `voice` | -27.4 | -30 | gain 0.8 to 0.6 |
| `snap`, `douse`, `sizzle` | -11.9, -13.6, -14.8 | -17 | gain 0.55 |

Shorter:

| Effect | Today | Target |
|---|---|---|
| `wings` | 0.90 s, eight beats | 0.50 s, four beats |
| `douse` | 0.85 s | 0.50 s |
| `sizzle` | 0.50 s | 0.35 s |
| `dig` | 0.22 s | 0.14 s |

Merged into one:
- **A batch speaks once.** A batch with a jingle plays that jingle alone (level, then found, then quest); a batch without one plays at most two small cues, in the order journal, coin, task, perfect, pickup. Every toast still shows.
- **The journal gets its own sound, and it is short.** A first-of-kind item plays a new short `journal` effect (the pickup's three notes with a page tick, 0.2 s, -17 dBFS) in place of the pickup, not the found jingle. The found jingle stays for a rare dig, a recipe scrap and a riddle solved: 18 in this run becomes 1.
- **One coin per gold.** The coin of the toast and the coin of the purse landing are one sound: the landing's, when coins fly.
- **One sound per blow.** A blow past the middle plays the crack in place of the thud or strike, not both.

Stopped where the cause repeats inside a second:
- **`wings` once in 1.5 s.** The flocks of one step are still drawn; they share one sound.
- **`voice` every 8 letters, not 4** (`VOICE_EVERY` in `ui/dialog.ts`). The text still types; the speaker's pitch still says who talks.

The result on the same run, counted by replaying the log under these rules:

| | Before | After |
|---|---|---|
| Effects in 8.5 min | 535 | 410 |
| Effects a minute | 63.1 | 48.4 (-23 %) |
| Effects a minute without click and voice | 36.8 | 28.3 |
| Jingles | 31 (found 18) | 12 (found 1) |
| Gaps under 1 s between two effects | 452 | 324 |
| Peak of the loudest common effect | -11.3 dBFS | -17 dBFS |

What stays as it is: `click` (one per press; the e2e asserts it), `growl`, the fall's bell, `whisper`, `step`, `ui`, the beds and the night bell.

### 1.4 As built, and the sound by distance

Built in `feat/sound-effects-cut` (30.10) as section 1.3 wrote it, with one addition the batch rule needed: a danger cue (seen, a fall, hurt) ranks before the earned cues, so a growl is never the cue a batch drops. The rules live in `game/src/audio/heard.ts`, tested in `game/test/audio/heard.test.ts`; the 3D door's blows follow the same rule (`play3d/world3d.ts`).

**The distance curve** (CR-113). Each effect call may say where its cause is: `heard: { owner, tiles, offscreen }`. The level is:

| Tiles from the player's character to the cause (the larger axis) | Level |
|---|---|
| 0 to 4 | whole (1) |
| over 4 and under 24 | 4 / tiles: half for each doubling, 6 dB down (0.5 at 8 tiles, 0.25 at 16) |
| 24 or more | silent |
| off-screen, at any distance under 24 | the level above times 0.7, through a 1,200 Hz low-pass: it sounds distant |

It is the inverse distance of a point source with a near zone, so a sound beside the player does not jump as they step, and a cause at the edge of a phone's view (about 7 tiles across) is already near half.

**Whose cause it is.** `owner` is `self` (the default), `world` (a wolf, a ruin, birds) or `other` (another player). Another player's own cues are silent by rule whatever the distance: `coin`, `pickup`, `journal`, `ui`, `back`, `perfect`, `good`, `miss`, `click` and `safe`, the sounds of a purse, a bag, a page or a press. Their work in the world (`thud`, `strike`, `dig`, `crack`) follows the curve: a chop nearby is heard, a fight off-screen near by sounds distant, one 24 tiles away is not heard. No call passes `other` yet; it waits for the server to send other players' beats.

**Today's cases.** The wolf's growl when it sees the player is placed at the wolf (`hazardHeard`, in both doors: the 3D door projects the wolf through its camera to tell whether it is in view): in the replayed opening it was 4.5 tiles away and off-screen, so it played at 0.62 of its level through the low-pass. The ruin's whisper is placed at the ruin tile it comes from. The world's cues (birds, a fish) keep their own curve (`cueGain` in `cues.ts`: a hint is never quieter than a third), and the far bell keeps its fixed far level. No NPC makes a blow sound today; when one does, its call passes `owner: 'world'` and its tile, and the curve does the rest.

**Measured.** The same phone opening played headless on the new build, every call logged with whether the rules silenced it (524 s, the effects from the title to the wake):

| | Before (develop) | After (built) | Section 1.3 projected |
|---|---|---|---|
| Effects that sounded | 535 in 8.48 min | 406 in 8.54 min | 410 |
| Effects a minute | 63.1 | 47.6 (-25 %) | 48.4 |
| Without click and voice, a minute | 36.8 | 27.9 | 28.3 |
| Jingles (found) | 31 (18) | 13 (2, both the kernel's riddle event) | 12 (1) |
| `voice` | 107 | 52 | 54 |
| `wings` | 47 | 14 (33 inside the 1.5 s gap) | 15 |
| `pickup` / `journal` | 24 / 0 | 6 / 11 | 6 / 12 |
| `coin` | 6 | 3 | 3 |
| `thud` / `strike` / `crack` | 17 / 7 / 8 | 11 / 7 / 8 | 11 / 7 / 8 |
| Gaps under 1 s between two effects | 452 | 317 | 324 |

## 2. The listens

Three one-minute samples of the valley song by day as the town theme, each testing one named difference against A. All three have the same day ambience under them (the wind of `audio/ambience.ts` and four bird calls at fixed times inside its 8 to 20 s spacing), go through the game's own buses and compressor (music 0.45, ambience 0.5, master 0.8), and were rendered offline at 44.1 kHz in headless Chromium, peak-normalised to -1 dBFS and encoded as Ogg Vorbis at 96 kbps (about 570 KB each). The scores and the render script are not in the repository; the scores of B are written out in 2.2.

### 2.1 The files

- [2026-10-30-listen-A.ogg](sound/2026-10-30-listen-A.ogg) - **A, today:** the valley song exactly as `songs.valley` plays it (pulse lead, pulse arpeggio, wave bass, the hi-hat from bar 9), with the day ambience under it at the game's levels.
- [2026-10-30-listen-B.ogg](sound/2026-10-30-listen-B.ogg) - **B, the synth enriched:** the same tune with a second voice and a slow pad; 0 to 22 s the riverbank (a held counter-melody), 22 to 44 s the grove (the bass walks and the same counter line is struck an octave up), 44 to 60 s the riverbank again; still the synth, no file shipped.
- [2026-10-30-listen-C.ogg](sound/2026-10-30-listen-C.ogg) - **C, played by people:** the same three parts of the same tune on sampled real instruments (flute lead, nylon guitar arpeggio, acoustic bass) in a small room, no hi-hat; samples from the FluidR3_GM soundfont by Frank Wen, CC BY 3.0, as prerendered by [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts).

### 2.2 What B adds, and what it costs

B keeps every note of A and adds four voices, all built from the synth's own `playWave` and `playPulse`:
- **The riverbank's counter-melody** (wave, gain 0.13, a soft 80 ms attack): long chord tones under the lead that move when the lead holds (bars 4, 8, 12 and 16).
- **The grove's walking bass** (wave, gain 0.26): quarter notes, root, third, fifth and a step to the next chord, in place of the held bass.
- **The grove's struck line** (pulse 12.5 %, gain 0.07): the counter line an octave up, each note struck once and left.
- **The slow pad** (two wave tones, gains 0.07 and 0.06, a 1.4 s attack): the tones two chords share, held two bars each, so the harmony under the tune changes half as often; it sits behind a low-pass that opens from 420 Hz to 2.4 kHz over the minute.

The place picks the voice: the riverbank and the grove share the tune and the pad, and only the second voice changes. In the game that is one more channel per place in `songs.ts`, read from the beds' place (DECISIONS 2026-10-11) the way the beds are.

Measured on the same machine, each voice rendered alone for 60 s in an `OfflineAudioContext`, the median of five:

| Voice | Notes a minute | Audio nodes made a minute | CPU for a minute of it | File size |
|---|---|---|---|---|
| today: lead | 69 | 264 | 569 ms | 0 |
| today: arpeggio | 176 | 352 | 988 ms | 0 |
| today: bass | 44 | 88 | 226 ms | 0 |
| today: hi-hat | 18 | 54 | 340 ms | 0 |
| B: counter-melody (riverbank) | 32 | 64 | 166 ms | 0 |
| B: walking bass (grove) | 31 | 62 | 176 ms | 0 |
| B: struck line (grove) | 19 | 38 | 149 ms | 0 |
| B: slow pad (two tones and a filter) | 22 | 45 | 439 ms | 0 |

One place's voices play at a time, with the pad under both: the riverbank adds 166 + 439 = 605 ms of CPU a minute, the grove 176 + 149 + 439 = 764 ms, so B adds at most about 760 ms a minute to the 2.1 s the song costs today (about 1.3 % of one core, against about 3.5 % today, on a desktop CPU in a cloud sandbox; a mid-range phone is perhaps three to four times slower). It adds 0 bytes to the page and at most seven audio nodes alive at a time (the pad's two tones with their envelopes, its filter, one held counter note with its envelope).

### 2.3 Why C is rendered here and not taken from a library

The open libraries the brief names (freepd.com, incompetech.com, opengameart.org, the Free Music Archive) and archive.org, Wikimedia Commons and musopen.org all refused a connection from this session's network on 30.10. GitHub's raw files answered, so C was rendered from the tune through an open soundfont instead: real instruments, the game's own tune. CC BY 3.0 allows a game to ship it with the credit line "FluidR3_GM soundfont by Frank Wen, CC BY 3.0". A finished piece from a library (for example a Kevin MacLeod track, CC BY 4.0, from incompetech.com) is the other half of option C and can be fetched from a machine that reaches those sites; it would be a different tune, not ours.

## 3. The source and its cost

For the owner. Prices are 2026 market ranges as commonly quoted, not quotes; this session could not reach the vendors' pages to check today's figures.

**What big studios do.** A composer (or a team) writes an adaptive score: stems and layers that a middleware (Wwise or FMOD) mixes live by the game's state, recorded with real players or an orchestra; effects are recorded or bought from licensed libraries and designed per event by a sound team. Cost: a known composer at roughly 1,000 to 2,500 USD a finished minute and more, an orchestra session in the tens of thousands, a sound team on salary; Wwise and FMOD are free under small budgets and paid above them. Page size: a middleware's web build adds 1 to 3 MB of WebAssembly before the first sound bank, and a score of 30 to 60 minutes is tens of megabytes. Built for a download, not a page on a phone.

**What an indie of our size usually does.** One of three:
- **A composer on a per-minute rate.** Newer game composers ask roughly 100 to 500 USD a finished minute, established ones 500 to 1,500. Our needs are about 8 to 10 minutes (the town theme and its two place variants, the night, the chase, three jingles), so roughly 1,000 to 5,000 USD at the lower rates. As files (Opus at 64 kbps, about 480 KB a minute) that is 4 to 5 MB, on a game that is 3.2 MB today (`game/dist`): the download more than doubles unless each piece streams when its place is reached.
- **Open-licence music with attribution** (CC0 or CC BY: incompetech, FreePD, OpenGameArt). 0 USD and a credit line; the same file sizes as above. The pieces are not ours, are heard in thousands of videos, and do not share one tune or follow the place.
- **The synth kept as the style** and written better (listen B). 0 USD, 0 bytes; the music stays adaptive (place, hour, chase) for free because it is played live, and it matches the handheld-era pixel art. The cost is a builder's time on the scores and the ceiling of a chip sound.

A middle way exists and is what C is: the same live scores played through a few sampled instruments. A small set (three instruments, a few notes each, Opus) is about 1 to 2 MB and stays adaptive, at the price of the bytes and an attribution line.

**Recommendation: B.** Keep the synth as the game's sound and enrich it: a second voice per place, the walking bass, the slow pad, and the effects cut of section 1. It answers "the soundtrack will need enriching" at no cost in money or page size, keeps the music following the place and the hour (G26), and keeps the chip sound that suits the pixel game. Revisit a composer when the game earns, starting with the town theme alone; C is the sound that commission would aim at.

## 4. The owner's answers, 30.10

On the listen page, 30.10 at 10:09.

- **Listen A** (today): no mark.
- **Listen B** (the synth enriched): no.
- **Listen C** (played by people): liked. "nice, but I want something longer for the game, so it does not feel repetitive over a long game; free libraries, like we do in graphics. I want medieval lofi cozy playing in the routine, and other music by task and state: night outside the town, hunting, combat, near death, and so on."
- **The source and its cost** (section 3): "make a sample of each except the paid one; if B can answer all of this, I prefer it."
- **The effects cut** (section 1.3): liked. "make sure the sounds also take the distance from the character into account, with multiplayer in mind: another player chopping nearby is fine, another player picking up a coin is not relevant, a fight close by off-screen sounds distant accordingly."

What it opens: the quality of C is the bar and B as played is not, so the source stays open until round 2: a long routine piece and one piece per state, both through the synth pushed as far as it goes and through sampled instruments, beside open-licence tracks (sections 5 and 6, a pull request of their own). The music by state is CR-112 and the sound by distance CR-113 in `docs/team/GRUNT.md`. The effects cut of section 1.3 is built with the distance rule in a pull request of its own.

## 5. Round 2: the routine and the states, synth and sampled

The owner's answers (section 4) ask for a long routine piece in a medieval lofi cozy style, and for one piece each for night outside the town, hunting, combat and near death. They also ask whether B can answer all of it. Round 2 writes those five pieces once, as scores from the valley's tune family, and plays each score two ways:
- **(a) the synth pushed as far as it goes:** recorder, reed, lute, harp, pad, strings and drums all made from oscillators and noise, with one filter per part, a room, and for the routine a lofi low-pass, a faint vinyl tick and a slow tape wobble;
- **(b) sampled instruments, as listen C was:** FluidR3_GM by Frank Wen, CC BY 3.0, through [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts).

The scores and the render scripts are scratch work and are not in the repository. Each file sits at the game's levels: it goes through the game's music bus, master and compressor, each sampled piece is matched to its synth twin's loudness, and one common gain is applied to all ten files, setting the loudest to -1 dBFS. So the files are as loud as each other as the game would play them. The routine is Ogg Vorbis at 80 kbps; the state pieces are at 96 kbps.

### 5.1 The pieces

- **Routine** (3 min 8 s, 76 bpm, a lazy swing, A minor). Six sections that never play the same way twice:
  1. Intro, 4 bars: the lute alone over a held chord.
  2. A1, 16 bars: the valley tune on the recorder, with grace notes, over the lute, brushes and a lazy kick.
  3. B, 8 bars: a new line in the relative major that answers the tune, with a rim instead of the brush.
  4. A2, 16 bars: the tune moves to the lute an octave down, the recorder takes the counter-melody of listen B, and the bass walks.
  5. C, 8 bars: the bridge. The drums rest and the tune's head is slowed to half its pace over the harp.
  6. A3, 6 bars: the head an octave up, then the cadence, and the chord left to ring.
- **Night outside the town** (30 s, 60 bpm): the night song's line over the harp's broken chords and a held drone. No drum.
- **Hunting** (30 s, 100 bpm, E Phrygian): the chase song's bass as a held-breath ostinato with plucked strings. The tune's head (A C E, F E C) is turned into a horn call (E G B, C B G) three times. A low drum enters, then a rim.
- **Combat** (30 s, 138 bpm): the chase song's call doubled by strings, an octave up in the second half, over its driving bass. A big drum lands on every downbeat, string stabs and a horn answer come every fourth bar, and it ends on one hit.
- **Near death** (30 s, 56 bpm): the tune's head falling slowly (E D C, A; C B A, F; E F E) over a heartbeat, with a held A minor and a high bell. A low-pass closes from 3 kHz to 600 Hz, so the room closes in.

### 5.2 The files, their bytes and their CPU

"As a file" is the rendered Ogg in this folder: what the game would ship if it played recordings. "Live" is what the game ships to play it as it plays music today:
- for the synth, the score: the events as JSON, gzipped (the game's own notation would be smaller);
- for the sampled pieces, the FluidR3 notes the score uses, as Ogg.

"CPU" is the time to render the piece in 30 s windows (a fresh context for each, as a live context collects finished notes), divided by its length. It includes the room's reverb and the game's compressor, was measured in headless Chromium on a desktop core in a cloud sandbox, and is the median of three runs. A mid-range phone is perhaps three to four times slower. For scale, today's valley song costs about 3.5 % on the same machine (section 2.2).

| File | Length | As a file | Live: bytes | Live: CPU |
|---|---|---|---|---|
| [r2-synth-routine](sound/2026-10-30-r2-synth-routine.ogg) | 188 s | 1,171,803 B | 5,841 B of score | 11.7 % |
| [r2-sampled-routine](sound/2026-10-30-r2-sampled-routine.ogg) | 188 s | 1,305,117 B | 2,002,794 B of samples | 8.8 % |
| [r2-synth-night](sound/2026-10-30-r2-synth-night.ogg) | 30 s | 243,626 B | 386 B of score | 6.4 % |
| [r2-sampled-night](sound/2026-10-30-r2-sampled-night.ogg) | 30 s | 305,577 B | 759,366 B of samples | 4.5 % |
| [r2-synth-hunting](sound/2026-10-30-r2-synth-hunting.ogg) | 30 s | 244,657 B | 931 B of score | 15.6 % |
| [r2-sampled-hunting](sound/2026-10-30-r2-sampled-hunting.ogg) | 30 s | 273,178 B | 459,492 B of samples | 8.2 % |
| [r2-synth-combat](sound/2026-10-30-r2-synth-combat.ogg) | 30 s | 241,771 B | 1,364 B of score | 20.7 % |
| [r2-sampled-combat](sound/2026-10-30-r2-sampled-combat.ogg) | 30 s | 306,226 B | 827,979 B of samples | 12.9 % |
| [r2-synth-near-death](sound/2026-10-30-r2-synth-near-death.ogg) | 30 s | 196,403 B | 343 B of score | 6.3 % |
| [r2-sampled-near-death](sound/2026-10-30-r2-sampled-near-death.ogg) | 30 s | 237,427 B | 362,020 B of samples | 4.9 % |

- **Live sample bytes.** The five pieces together need at most 4.4 MB of samples: that is the sum, and notes they share make it less. The FluidR3 notes are long, several seconds each, so a set trimmed to each note's useful length and encoded in Opus would be perhaps a third of that.
- **Files.** The whole set as files is about 4.5 MB: synth 2.1 MB, sampled 2.4 MB.
- **CPU.** The synth pushed this far costs more CPU than the samples, by 1.3 to 1.9 times. Every synth note is two or three oscillators and their envelopes, while a sampled note is one buffer.

### 5.3 Can B answer everything?

Measured and written down; the ear is the owner's. The two columns play the same scores.

| What the owner asked, or what it takes | B, the synth pushed far | C, sampled instruments |
|---|---|---|
| Longer, not repetitive over a long game | Yes: a score of any length costs a few kilobytes, and it can vary each time it plays (a section skipped, a voice swapped) | Yes when played live from the same scores; as files, every minute is about 0.4 to 0.6 MB more |
| A piece per state (night outside the town, hunting, combat, near death) | Yes | Yes |
| Switched by the state and the place, live | Yes: the score is played live, so a layer, a section or the tempo can follow the game (G26) | Yes when played live from samples; as files, only crossfades between whole recordings |
| **Medieval lofi cozy: the timbre of real instruments** (breath in a recorder, the body of a plucked string, a bow on strings, a harp's ring) | **No.** It reads as a synth imitating them, close to the chip sound the owner marked "no" in B | **Yes:** the recorder, harp, strings, horn and lute (a nylon guitar stands in) are recordings of instruments |
| Dynamics that sound played (a note's colour changes with how hard it is struck) | **No:** louder is only louder | **Partly:** one sample a note here, so louder is mostly louder too; a soundfont with velocity layers does it |
| Bytes on the page | 0 B of audio, a few KB of score | About 2 MB for the routine's instruments, up to 4.4 MB for all five; less trimmed |
| CPU on a phone | 6 to 21 % of a desktop core here, the highest of the options | 4.5 to 13 % here |
| A composer's arrangement and performance | No | No: these are our scores. That is section 6's open-licence tracks, or a composer |

So B answers the length, the states and the switching, but not the sound of real instruments, which is what the owner liked in C. C played live answers all of it except a person's performance, for about 2 to 4 MB.

## 6. Open-licence candidates

(Filled by the local session that can reach the open libraries: CC0 and CC BY tracks, each with its page and licence.)
