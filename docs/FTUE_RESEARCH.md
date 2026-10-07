# Research: Mobile Game Onboarding (FTUE) & Mistvale Gap Analysis

## 1. Executive Summary

First-Time User Experience (FTUE) on mobile devices determines whether a player remains past the first 3–5 minutes. Unlike desktop games where players have high intent and tolerate upfront tutorials, mobile and handheld web players drop off rapidly if:
- They encounter passive text walls before taking physical action.
- The control scheme requires cognitive friction without tactile feedback.
- The goal is not immediately visible or understood within the viewport.
- Rewards and progression mechanics do not provide instant positive reinforcement within the first 60 seconds.

This document reviews established FTUE standards from leading mobile and handheld cozy/adventure RPGs (*Animal Crossing: Pocket Camp*, *Stardew Valley Mobile*, *A Short Hike*, *Sky: Children of the Light*) and audits Mistvale's current opening against those benchmarks.

---

## 2. Industry Benchmarks & Design Principles

### Principle 1: Immediacy (<15 Seconds to Meaningful Input)
- **Benchmark**: Top mobile titles give player agency in under 15 seconds. In *Animal Crossing* and *A Short Hike*, players move their character and interact with the immediate world within 2 touches.
- **Rule**: Avoid pre-game lore screens, complex naming wizards, or prolonged introductions before the core verb (move & interact) is experienced.

### Principle 2: "Show, Do, Reward" (Action-Feedback Loop)
- **Benchmark**: An action is introduced -> the player performs it -> an immediate visual and auditory reward follows.
- **Rule**: The first harvest or gather must grant an immediate level-up or progression unlock, establishing that effort converts directly into tangible power.

### Principle 3: Progressive Disclosure (Don't Overwhelm the HUD)
- **Benchmark**: *Stardew Valley* and *Animal Crossing* start with a minimal interface (movement + action button). Bag inventory, quest logs, crafting menus, and system settings are unlocked only when the player acquires their first item or meets an NPC.
- **Rule**: A cluttered HUD with disabled or empty tabs creates cognitive fatigue. Reveal interface layers as they become relevant.

### Principle 4: Visual Wayfinding & The Golden Path
- **Benchmark**: Handheld screens have small viewports (~390–430px wide). Players do not explore randomly; they follow clear contrast, breadcrumbs, or visual landmarks (smoke, glowing particles, broken bridges).
- **Rule**: The primary objective should always have a directional cue or landmark within 1–2 screens of the spawn point.

### Principle 5: Frictionless Failure & Generous Windows
- **Benchmark**: Early minigames or challenges should never wall the player. Failure should yield a partial reward rather than zero progress.
- **Rule**: Early gathering nodes must be forgiving (e.g. miss-keep mechanics) so a missed tap never produces a frustrating dead-end.

---

## 3. Mistvale Current FTUE Walkthrough

Mistvale's opening flow today:
1. **Title & Character Select**:
   - Player picks between Forager and Explorer.
   - Gender/look toggle (Male / Female appearance).
   - Enter name and tap "Wake up".
2. **Spawn**:
   - Player wakes in tall grass beside the river.
   - Opening narration: *"You wake up in the tall grass beside a river. Across the water, smoke rises over a town. The old bridge between is broken. River stones lie on the bank nearby. Three should be enough to mend it."*
   - Contextual control hint toast (D-pad + A button).
3. **First Action**:
   - Player steps toward river stones and presses A to gather.
   - Strike timing minigame triggers.
   - First gathered stone triggers level 1 foraging -> jingle -> level-up attribute modal opens immediately to spend a skill point.
4. **Second Objective**:
   - Gather 3 stones total -> walk to Old Bridge -> press A to mend the bridge.
   - Bridge restores visually and sign updates to *"Mended by <Player>"*.
5. **Town Entry**:
   - Cross the river into Mistvale town.
   - Elder Maru is positioned outside his house.
   - Talking to Elder Maru triggers town backstory, the mystery of the mist and night bells, and directions to Pell's market stall and the ruins.
6. **Market & Economy**:
   - Pell's stall sells food (berries, herb tea) and tools (basket, trowel) with clear benefits.

---

## 4. Identified Gaps in Mistvale

| Dimension | Current State | Gap / Issue | Recommended Solution |
| :--- | :--- | :--- | :--- |
| **1. HUD Density** | HUD displays Bag, Log, Menu and Day/Time clock immediately upon waking up. | Bag has 0 items; Log has 1 quest. New players tap them unnecessarily and get empty screens. | Hide Log and Menu until the player mends the bridge; open Bag only upon first item gain. |
| **2. Visual Wayfinding** | Player tracker reads *"River stone 0/3"*, but stones can blend with ground tiles on small mobile screens. | Some players walk west into the dead-end glade before finding the river stones to the north-east. | Add subtle visual glint/sparkle particle on the river stones during the opening quest. |
| **3. Mobile Touch Ergonomics** | On-screen D-pad and A/B buttons work well, but no haptic feedback exists. | Players lack tactile confirmation when tapping A, hitting a minigame sweet spot, or walking over transitions. | Integrate `navigator.vibrate([15])` on minigame beats and action confirms (supported on Android/mobile browsers). |
| **4. Typography Readability** | Pixel font (`Pixelify Sans`) previously used for all dialogue and descriptions. | Pixel typography at 14–16px on high-DPI phone screens causes eye fatigue for reading lore. | Tried a system sans-serif body font in feat/feedback-1; reverted in feat/ui-polish because it looked generic next to the art (see DECISIONS.md). Now the pixel font everywhere with ligatures off, body text 16px or more and dialogue 18px. |
| **5. Narrative Hook Urgency** | Elder Maru now explains the town and mist on first conversation. | The opening text by the river is still a passive dialogue box. | Add an atmospheric camera pan or subtle mist drift across the river toward the town smoke before handing control to the player. |
| **6. Session Closure Hook** | When players finish the opening tasks, no explicit "day summary" or milestone badge is presented. | Mobile players often leave without a clear sense of having completed the first milestone (M1). | Show a "Day 1 Complete" celebratory splash when the bridge is mended and the first town quest is accepted. |

---

## 5. Implementation Roadmap for FTUE Enhancements

- **Phase 1 (Immediate / Completed in feat/feedback-1)**:
  - Readable body text on mobile screens: 16px or more, dialogue 18px.
  - Elder Maru's town & mist lore on first talk.
  - First stone gives level-up and skill point modal pop.
  - Forgiving miss gamble (50% keep chance).
  - Clear item benefits in shop and inventory.
  - Character appearance toggle.
- **Phase 2 (Milestone 2 Onboarding Polish)**:
  - Particle glints on active quest targets (river stones, old bridge).
  - Progressive HUD unlocking (reveal Bag on first pickup, Log on bridge cross).
  - Haptic feedback on mobile touch buttons and minigame beats.
- **Phase 3 (Milestone 3 Retention & FTUE Day 1 Hook)**:
  - Animated camera intro panning from the smoking town to the player waking by the river.
  - "Milestone Complete" stamp card celebrating opening completion.
