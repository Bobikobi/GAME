**summary**: Raw data for the manager. Repo context read (worktree develop-read at e612194b3): docs/design/GAME_RULES.md:313 (G30), :333 (G31), :341 (G32), :355 (G33), :368 (G34 - "A hazard is a rule, not a roll... Chance, where a rule has it, runs through the kernel's own random stream so the server at stage 2a can replay it"), :381 (G35 - combat "comes after the foundation, as a core part of the game"; "Where it is fought, and its frame, are the owner's to approve before it is built"), :418 (G36); G47 at :387 is outside the assigned range but states the predator's cone (half as wide as long) and 1-tile smell. DECISIONS.md:2904 (round 1: real time, server runs every fight on its tick, phone sends inputs over the live socket and draws what the server sends back, predicts only its own walk; option A "beats of half a second" was OFFERED AND DECLINED, so a 500-600 ms cadence is out), :2912 (round 2: "pack rule everywhere, first come", the attacker a tile away almost always first), :2918 (round 3: two small bars, health and breath, over a foe while it fights and over another player only inside the marked zone; no number printed on any bar; bars' look is a direction, shown as stills first), :2924 (round 4: noise turns every head, predator's place stays set by the clock, heading by clock and noise), :2931 (round 5: active slots as techniques, attributes as small keys, thing in hand as the strike, one power cap; the attribute map is to be redone with the combat wave per the 22.10 note, so the keys below are a proposal).

READING NOTE on "pack": in DECISIONS.md:2912 the pack is the bundle of finds a fallen player leaves (SETTLEMENT 3.9 vs the pack of 19.10), not a monster pack. Both readings are covered below; loot-ownership patterns serve the finds reading, tap/claim patterns serve the monster reading.

PROVENANCE: every number carries its source. "Derived" means my own arithmetic or proposal, not found anywhere. Tibia engine numbers come from The Forgotten Server (TFS), a community emulator, not CipSoft's code. Several sources could not be fetched (HTTP 403/402) and are only search-result summaries; they are labelled.

NOT FOUND (explicit gap list): Hyper Light Drifter dash i-frame count (only that i-frames were added 15 Apr 2016 and reduced 18 Apr 2016); Core Keeper and Moonlighter exact i-frames/active frames; any published minimum enemy telegraph duration; WoW leash distance; Albion Online tick rate and its combat prediction details; OSRS health-bar pixel size and display duration; RotMG official tick rate and Deca's own netcode documentation; the Valve and Tibia wiki pages themselves (403/402); Stardew post-hit invincibility duration (not on the wiki page fetched; the "1200 ms" figure is my memory only and is NOT used); Overwatch GDC talk itself (figures come from an Edgegap blog); sword active frames and hit-stop in ALttP.

CORE FINDING: the games that run a real server tick keep ALL combat time as whole multiples of the tick (OSRS 600 ms, LoL 33 ms rounded UP to the next tick, AoE 200 ms turns, TFS 1000/100 ms think intervals), resolve damage with integer formulas, order same-tick events by a fixed rule, and put the hit on the server. The cadence must come from real-time games (16-200 ms), the integer/queue discipline from OSRS.

## patterns
### patterns[0]
**name**: P1 Fixed tick, every duration a whole number of ticks, inputs queued to the next tick boundary

**what**: The world advances in fixed steps; weapon speeds, cooldowns, timers are integers of ticks; an action sent mid-tick starts at the next boundary; durations between ticks round UP.

**who_does_it**: OSRS: 0.6 s tick, 'All attack rates are an integer multiple of this tick time', 'Each action registered within one tick will start to take place by the beginning of the next tick', running 2 tiles/tick, walking 1. League of Legends: 33 ms tick, 'Actions resolve on whole ticks... a 0.25 s cast (about 7.57 ticks) finishes on the 8th tick'. TFS (Tibia emulator): EVENT_CREATURE_THINK_INTERVAL = 1000 ms, check interval 100 ms. Age of Empires: turns 'typically 200 msec', commands execute two turns after issue.

**fits_us_because**: Our kernel is pure integer; ms to ticks by ceil() keeps replay exact on the server (G34 line 74-76 needs the server to replay chance). Owner declined 500 ms beats (DECISIONS.md:2904), so take the integer discipline from OSRS and the cadence from the real-time group.

**source**: https://oldschool.runescape.wiki/w/Attack_speed ; https://oldschool.runescape.wiki/w/Game_tick ; https://wiki.leagueoflegends.com/en-us/Tick_and_updates ; https://raw.githubusercontent.com/otland/forgottenserver/master/src/creature.h ; https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond

### patterns[1]
**name**: P2 Weapon speed as ticks with a global cooldown; swapping the thing in hand never skips it

**what**: Each weapon has an interval in ticks; the next attack waits for the last one's cooldown regardless of what is in hand.

**who_does_it**: OSRS: 4 ticks (dagger, scimitar, unarmed), 5 (axe, longsword), 6 (battleaxe, warhammer), 7 (halberd, 2h sword); 'Attack speed works similar to a global cooldown', a 7-tick weapon swapped to a 4-tick one still waits 7. TFS: attack only when (now - lastAttack) >= getAttackSpeed(); default 2000 ms is from forum posts only. UO: base delay = displayed seconds x 4 ticks, minus stamina/30 (truncated), floor 5 ticks = 1.25 s (Stratics community formula, unofficial). RSC: all weapons the same speed at launch.

**fits_us_because**: Round 5 makes the hand slot the strike; the cleanest way to let the hand change tempo without a new system is a speed in ticks plus one shared cooldown.

**source**: https://oldschool.runescape.wiki/w/Attack_speed ; https://raw.githubusercontent.com/otland/forgottenserver/master/src/player.cpp ; https://community.stratics.com/threads/swing-speed-calculator-in-the-making-offical-response-please.59271/latest ; https://runescape.wiki/w/RuneScape_Classic

### patterns[2]
**name**: P3 Integer hit and damage reckoning

**what**: Damage is an integer function of weapon bonus and a small stat; a hit roll compares attack and defence rolls; a variance band is built from integer division; minimum damage 1 after defence.

**who_does_it**: OSRS (already integer-only): max hit = floor( floor((EffStr x (StrBonus + 64) + 320) / 640) x gearMult ); attack roll = floor(EffAtk x (AtkBonus + 64)); monster defence roll = (DefLevel + 9) x (StyleDefBonus + 64); hit chance = 1 - (D+2)/(2(A+1)) if A > D else A/(2(D+1)); average hit = chance x (max/2 + 1/(max+1)). Stardew: monster damage fluctuation = int(base/8), min = base - f, max = base + f (exclusive), player damage taken = damage - defence, minimum 1. TFS: block removes random defense/2..defense, armor above 3 random, armor 1-3 subtracts 1. RotMG: defence is a flat per-hit reduction with a floor (forum says 15% of the zero-defence hit; fan/search sources say 85-90% cap) - sources conflict.

**fits_us_because**: The +64 offset is the key trick: weapon bonuses 6 to 66 move max hit only about 1.86x, so a tier ladder stays under one power cap (round 5). Stardew's int(base/8) band is a ready integer variance. The OSRS two-branch chance converts to an integer fraction (derived algebra: A>D gives (2A - D)/(2A + 2); else A/(2D + 2)) drawn from the kernel's own random stream.

**source**: https://oldschool.runescape.wiki/w/Damage_per_second/Melee ; https://oldschool.runescape.wiki/w/Scimitar ; https://stardewvalleywiki.com/Combat/Mechanics (fetched via https://wiki.stardewvalley.net/Combat/Mechanics) ; https://raw.githubusercontent.com/otland/forgottenserver/master/src/creature.cpp ; https://realmofthemadgod.fandom.com/wiki/Stats (search summary only)

### patterns[3]
**name**: P4 Reach in tiles, Chebyshev distance, hit delay by distance

**what**: Range is measured in tiles by Chebyshev distance; melee reach 1 with no diagonals; ranged/magic hits land after a delay that grows with distance; melee delay 0.

**who_does_it**: OSRS: melee range 1 no diagonals, halberd 2, magic 10, ranged 3-10 by weapon; hit delay bows = 1 + floor((3+D)/6), magic = 1 + floor((1+D)/3), melee 0. 'NPCs are processed earlier than players, so hits on NPCs land one tick later'. TFS: nearest-target search uses Manhattan distance.

**fits_us_because**: Our world is tiles; a plus-shaped melee reach (no diagonal) is the cheapest readable range on a 64 px grid, and an integer distance delay lets a thrown thing be dodged without any float.

**source**: https://oldschool.runescape.wiki/w/Attack_range ; https://oldschool.runescape.wiki/w/Hit_delay ; https://raw.githubusercontent.com/otland/forgottenserver/master/src/monster.cpp

### patterns[4]
**name**: P5 Server authority, client predicts only its own movement

**what**: Server owns every hit and every health value; client sends numbered inputs, predicts its own walk, reconciles to server state, interpolates everyone else.

**who_does_it**: Overwatch (via Edgegap blog, not the GDC talk): fixed 16 ms command frames (7 ms tournament), client clock ahead of server by half RTT + one buffered frame, rollback and replay on misprediction, server rewinds up to ~0.5 s of target movement for hit checks, prediction of hit impact disabled above ~220 ms RTT. Valve Source (search summaries only, fetch 403): tick 66 in CSS/DoDS/TF2, default interpolation 100 ms, sv_maxunlag 1.0 s; CS:GO 64/128 tick, rewind = latency + interpolation. Gambetta: input sequence numbers, server returns last processed input, client replays unacknowledged ones. Albion: client predicts 'while sending updates to the authoritative server' (Unity blog), 'Absolute server authority is king!' (Salz, Quo Vadis 2016), one cluster is single-threaded. LoL: host-run fixed tick, a higher frame rate gives no gameplay advantage. OSRS: no prediction beyond the next tick; actions show on the following tick. RotMG (reverse-engineering write-up, search summary only): the client is the damage authority and reports its own hits (PLAYERHIT) - the cheap, exploitable end.

**fits_us_because**: Round 1 already fixes this shape (server runs every fight, phone predicts only its walk). A small team can afford server-authoritative hits with NO lag compensation and NO rollback if foes are slow and telegraphed; Valve-style rewind and Overwatch rollback are the expensive options to leave out. Round 1's retry clause says a prediction rule would be designed with the owner, never a simulation on the phone.

**source**: https://edgegap.com/blog/game-backend-deep-dive-overwatch-2016-netcode-architecture-rollback ; https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html ; https://www.gabrielgambetta.com/lag-compensation.html ; https://dignitas.gg/articles/blogs/CSGO/9512/tickrate-interpolation-lag-compensation-and-you-probably-not-the-reason-why-you-just-missed-that-shot ; https://unity.com/blog/albion-online-cross-platform-pvp-mmo-architecture ; https://www.slideshare.net/slideshow/albion-online-software-architecture-of-an-mmo-talk-at-quo-vadis-2016-berlin/62724504 ; https://him.is/posts/rotmg-wire-protocol/ (summary only) ; https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking (summary only)

### patterns[5]
**name**: P6 Windup, active, recovery, plus a mercy timer and a short stun

**what**: A swing has a telegraphed windup, a short active window, then recovery; a hit on the player grants a mercy timer (no further damage) and a brief no-input stun with knockback.

**who_does_it**: Zelda ALttP (one blog, not a disassembly): mercy timer 58 frames loaded after contact (about 967 ms at 60 fps), stun 19 frames (about 317 ms), recoil 24, 39 frames (about 650 ms) of free invulnerable movement; 144 frames (2.4 s) after a pit/warp; first knight takes 2 hits from the level 1 sword, deals one half-heart of Link's 3 hearts, enemy flashes and is knocked back about one alcove, fight is optional with a safe ledge. Terraria: player post-hit invincibility 0.67 s, per-NPC weapon hit lockout 0.17 s. Enter the Gungeon: roll about 0.7 s, first half invulnerable (wiki) or about three quarters (Steam post). Hyper Light Drifter: dash i-frames added 15 Apr 2016, reduced 18 Apr 2016 after 'a little too much freedom'. Moonlighter (forum/wiki, weak): roll i-frames at the start, 3-hit combo with a double-damage third hit, recovery differs per weapon. LoL: one-tick (33 ms) uncancellable grace at the end of windup; attack cancelled if target dies or leaves range. Stardew: weapon weight sets knockback (search summary). Hit stop: 2-4 frames in fighting games, 50-100 ms on a heavy hit (search snippets).

**fits_us_because**: Predators are escaped by running today (G34, G35); a readable windup, a bounded mercy timer and a one-tile knockback keep a first fight learnable the way ALttP's first knight is, and the whole state fits one integer 'stance_until_tick' per combatant.

**source**: https://gamertagmythras.com/blog/zelda-a-link-to-the-past/alttp-invincibility-frames ; https://www.gamedeveloper.com/design/first-combat-of-link-to-the-past ; https://terraria.wiki.gg/wiki/Invincibility_frames ; https://enterthegungeon.wiki.gg/wiki/Dodge_Roll_(Move) ; https://kotaku.com/the-contentious-debate-over-whether-to-make-hyper-light-1772125287 ; https://wiki.leagueoflegends.com/en-us/Basic_attack ; https://en.namu.wiki/w/Moonlighter

### patterns[6]
**name**: P7 Aggro by sight/hunt range, level gate, spawn leash, sleeping when nobody is near

**what**: A foe notices inside a range; may only aggro players below a level gate; is tethered to its spawn; drops its target past the tether; sleeps with no target.

**who_does_it**: OSRS: hunt range origin the NPC's south-west tile; aggressive monster attacks only players with combat level <= 2x its level; tolerance: after 10 minutes in a 21x21 tile region (10 tiles each way) it stops, re-aggro on leaving and re-entering; max range 'almost always seven tiles' from spawn, retreat interaction area 7 + 11 = 18 tiles. WoW: aggro radius about 20 yards at equal level, +/-1 yard per level of difference, min 5, max 45 (community-tested), vertical distance weighted far more; social radius differs; threat switch needs +10% in melee / +30% outside. TFS: nearest-target search, random target otherwise, target change by chance on a timer, challenge/taunt 8000 ms, monster outside spawn range is teleported back and set idle, monsters with an empty target list go idle and leave the check list (wake on damage), summons despawn beyond 30 tiles. RSC had a 'Hiding' equipment stat to stop aggressive monsters noticing, later removed.

**fits_us_because**: G47 already gives a cone and a 1-tile smell; adding a tile leash and an idle state is what lets the server run only the fights in progress (round 1's cost clause). A level gate (2x) is the existing, tested way to keep a first-ring foe from killing a newcomer. G34 says no gear answers a hazard, so skip a hiding stat.

**source**: https://oldschool.runescape.wiki/w/Aggressiveness ; https://oldschool.runescape.wiki/w/Tolerance (via the search result) ; https://oldschool.runescape.wiki/w/Retreat ; https://warcraft.wiki.gg/wiki/Aggro_radius ; https://warcraft.wiki.gg/wiki/Aggro ; https://raw.githubusercontent.com/otland/forgottenserver/master/src/monster.cpp ; https://runescape.wiki/w/RuneScape_Classic

### patterns[7]
**name**: P8 Claim / tag: the first to engage owns the fight, held by a combat lock

**what**: First damage (or engagement) fixes who is credited; the claim lives while the claimant is in combat; it ends on death, flight or lapse; others see it as taken.

**who_does_it**: OSRS single-way combat: 'a player or monster can be attacked by only one player or monster at a time'; the 8-tick (4.8 s) PJ timer after being attacked by a monster, refreshed by each attack, blocks others; ends the instant the monster dies; Wilderness PvP lock 20 ticks (12 s), PvP worlds 16 ticks; logout blocked 16 ticks after an attack. OSRS multi-way: most total damage at the end gets the drop. WoW Classic: first player to cause damage taps for the whole party; kept 'as long as they remain on its threat table'; the nameplate turns grey for everyone else; retail lets up to 5 non-grouped players share credit. FFXI: claim needs top hate AND an action on the monster, shown by a red name; passes to the last player to act; held by a party, no individual can release it. TFS: per-attacker damage map, 'lastHitCreatureId', experience split by damage ratio, map cleared when the creature goes idle.

**fits_us_because**: Round 2 says first come; OSRS's lock (first attacker, refreshed per exchange, ends at death) is first come in a tick sim and costs one integer per fight. WoW's grey bar answers 'whose is this' without any text, matching round 3's no-number bars.

**source**: https://oldschool.runescape.wiki/w/PJ_timer ; https://oldschool.runescape.wiki/w/Single-way_combat ; https://oldschool.runescape.wiki/w/Multicombat_area ; https://warcraft.wiki.gg/wiki/Tap ; https://bg-wiki.com/ffxi/Claim_System ; https://raw.githubusercontent.com/otland/forgottenserver/master/src/creature.cpp

### patterns[8]
**name**: P9 Loot / finds ownership windows (the 'pack' reading of round 2)

**what**: After a death the dropped bundle is private to someone for a window, then public, then it despawns.

**who_does_it**: OSRS: tradeable drops appear to others after 60 s and vanish 120 s later (about 3 minutes total); Wilderness drops are visible to others at once (search summary of the Drop timer page). Albion black zone: for the first 90 s the corpse is lootable only by the dead player's allies and the killer or top-damage dealer and their allies, then anyone (search snippet only, fetch 403; the wording of who is eligible varies between sources). UO (1998-2000 patch notes): only players who did lawful damage can loot without going grey; criminal and murderer corpses lootable by all; looting a blue corpse flags you a criminal. WoW: tap decides loot.

**fits_us_because**: The owner chose NO protected window (round 2, option A: first come, the attacker a tile away almost always first), which is the opposite of OSRS and Albion; so the window length is 0 and the tie-break rule carries all the weight. Same-tick ties need a fixed rule, as OSRS needs PID for PvP ties.

**source**: https://oldschool.runescape.wiki/w/Drop_timer (search summary) ; https://massivelyop.com/?p=400169 (search snippet) ; https://uo.com/wiki/ultima-online-wiki/technical/previous-publishes/2000-2/2000-publish-06-21st-august/ ; DECISIONS.md:2912

### patterns[9]
**name**: P10 Noise as an event with a radius and a lasting turn of attention

**what**: Actions emit a noise with a radius; foes inside it turn toward the source and linger, then disperse; noise ignores walls while sight does not.

**who_does_it**: Project Zomboid (community guide, qualitative): walking is heard only adjacent, sneaking nearly silent, sprinting about 2-3 blocks, breaking a window 1-2, banging a wall 1, gunshot or chainsaw the whole tile; sound passes walls; zombies converge, then gradually disperse, no forget timer given; other sources give 150-900 tile radii and disagree widely. Metal-Gear-style per-action noise is the general pattern. G47 here already gives a cone and a 1-tile smell (GAME_RULES.md:387, outside the assigned range).

**fits_us_because**: Round 4 wants a noisy act (felling, digging, running, a strike that lands) to turn a predator's heading while its place stays on the clock; a small integer radius per action in tiles, tested by Chebyshev distance, is deterministic and drawable.

**source**: https://zomboidpro.it.com/post-zombie-behavior.html ; https://pzfans.com/what-attracts-zombies-to-bases/ ; DECISIONS.md:2924

### patterns[10]
**name**: P11 Bars over heads: shown during a fight, no numbers on the bar, colour by thresholds

**what**: A small two-colour bar over a combatant while it fights; numbers, if any, live elsewhere.

**who_does_it**: OSRS: green (HP left) over red (HP lost), both combatants carry one while fighting, the bar shows no numbers (hitsplats do), always at least 1 px of green while alive since Dec 2013. OTClient (open-source Tibia client, code read): 31 x 4 px black frame, fill inset 1 px, up to 29 px wide at 100%; colours by percent: >92 #00BC00, >60 #50A150, >30 #A1A100, >8 #BF0A0A, >3 #910F0F, else #850C0C; covered creature draws #606060. WoW: bar/nameplate goes grey when another player owns the tap. Design-forum advice (weak): bars only on wounded enemies to cut clutter; numbers help quick maths, bars read faster.

**fits_us_because**: Round 3 fixes 'two small bars, no number'. OSRS and OTClient are the two proven shapes. These are starting values for the owner's stills, not a spec: the bars' look is a direction (AGENTS.md, How work moves; DECISIONS.md:2918). Hitsplat or floating damage numbers are OSRS/LoL practice and would contradict 'no number' - the owner's call, not part of the foundation.

**source**: https://oldschool.runescape.wiki/w/Health_bar ; https://raw.githubusercontent.com/mehah/otclient/main/src/client/creature.cpp ; https://warcraft.wiki.gg/wiki/Tap ; https://uxdesign.cc/5-videogame-ui-staples-and-how-to-use-them-2646ab3f9d09 (search result only)

### patterns[11]
**name**: P12 Tiers of strength: a level shown by colour, a +64 style offset, a double-level rule

**what**: Foes and gear sit on a short ladder; difference to the player is shown as a colour; gear compresses through an additive offset.

**who_does_it**: OSRS: combat level shown green to red over a +/-10 range, equal = yellow #ffff00; aggressive monsters ignore players above 2x their level; scimitar tiers (slash/strength bonus): bronze 7/6, iron 10/9, steel 15/14, mithril 21/20, adamant 29/28, rune 45/44, dragon 67/66, all 4 ticks; combat level formula base = (Def + HP + Prayer/2)/4 plus the larger of 0.325 x (Atk + Str) or 0.4875 x Ranged/Magic. WoW: aggro radius and threat scale with level difference (cap 45 yd at +25).

**fits_us_because**: Round 5 puts everything under one power cap; (bonus + 64) turns an 11x gear gap into a 1.86x hit gap (derived: (66+64)/(6+64)).

**source**: https://oldschool.runescape.wiki/w/Combat_level ; https://oldschool.runescape.wiki/w/Scimitar ; https://oldschool.runescape.wiki/w/Aggressiveness ; https://warcraft.wiki.gg/wiki/Aggro_radius

### patterns[12]
**name**: P13 Interest management and sleeping fights (what a small team can afford)

**what**: Only active fights and nearby clients cost server time.

**who_does_it**: Albion (Salz 2016): no game loop, mobs create their own timers; per-cluster event queue, single-threaded gameplay thread; grid hash of 10 x 10 m cells; about 500 mobs, over 10,000 interactive objects, up to 300 players per cluster; clusters about 1 km2, about 600 in the world. OSRS: 2000 players per members world (1400 free) on one world process at a 0.6 s tick, ticks measured 0.606-0.618 s under load. TFS: idle monsters leave the check list. Overwatch: fixed clock, risk of a 'death spiral' when late frames force more ticks.

**fits_us_because**: Round 1 says the server's cost per fight is measured before the step ships; the pattern is: fight object exists only while a combatant is awake, the sim clock is fixed (never catch up by running extra ticks), and snapshots go only to players in range.

**source**: https://www.slideshare.net/slideshow/albion-online-software-architecture-of-an-mmo-talk-at-quo-vadis-2016-berlin/62724504 ; https://oldschool.runescape.wiki/w/World ; https://oldschool.runescape.wiki/w/Game_tick ; https://edgegap.com/blog/game-backend-deep-dive-overwatch-2016-netcode-architecture-rollback

### patterns[13]
**name**: P14 What shipped first in these games' own histories

**what**: The first combat was a hit-and-HP exchange with one speed and a handful of foes; classes, requirements, ranged, magic, loot tiers came after.

**who_does_it**: Tibia: server up 7 Jan 1997; trolls, spiders, cyclopses and fighting them before Alpha 2.0 (3 Jun 1997); 'a new fighting system' in summer 1997; Alpha 3.0 28 Oct 1997; magic, skills and vocations after it, early 1998; beta 20 May 1998 (about 12-16 months from first fight to vocations). RuneScape Classic: beta 4 Jan 2001 with PvP everywhere except Lumbridge, +/-5 combat levels, one attack speed for all weapons, no running for 3 combat rounds, six quests; Wilderness 13 Aug 2001 (replaced world-wide PvP); Attack/Defence requirements on gear Nov 2001; members 27 Feb 2002; classes removed Jul 2002; RuneScape 2 (2003-2004) 'a complete overhaul of the combat system'. ALttP: the first fight is optional, teaches range and knockback. Albion: combat was part of the original pitch.

**fits_us_because**: Matches 'combat is a core part, after the foundation' (G35): ship hit/HP/one tempo/one foe type first; the technique format and combat content come later by round 5's own order.

**source**: https://otland.net/goto/post?id=2728791 ; https://runescape.wiki/w/RuneScape_Classic ; https://runescape.wiki/w/Update:Blog_-_History_of_RuneScape:_The_First_Four_Years ; https://www.gamedeveloper.com/design/first-combat-of-link-to-the-past

**recommendation**: THE FOUNDATION, IN BUILD ORDER (numbers marked [D] are derived proposals, [S] are sourced). Everything below is for the owner's approval of the frame first (G35, DECISIONS.md:2904); bars are shown as stills before any code.

0. Clock. One fixed combat tick of 100 ms (10 Hz) [D]. Why 100: round 1 refused 500 ms beats; real-time references run 16 ms (Overwatch), 33 ms (LoL), 200 ms (AoE turns, RotMG per a 2013 forum post). Arithmetic [D]: command to visible result = half RTT + wait for next tick (0 to 100 ms) + half RTT back; at 100 ms RTT that is 150-200 ms, inside AoE's measured band (under 250 ms not noticed, 250-500 playable, over 500 noticeable [S]); at 200 ms tick it would be 200-300 ms. Fixed sim clock, never run extra ticks to catch up (Overwatch death-spiral warning [S]). Every duration in the kernel is ceil(ms/100) ticks (LoL rounds up [S]). Map ticks per tile onto the kernel's existing walk speed - not read here, no source gives a figure for a 64 px tile game. Client draws other entities one tick behind (interpolation, Valve default 100 ms [S, summary only]).

1. Fight state (integers only). A fight is created at the first aggro or first strike and deleted when no combatant is awake. Per fight: id, started_tick, claimant (account or none), lock_until_tick. Per combatant: hp, breath, stance in {idle, windup, active, recovery, stagger}, stance_until_tick, last_hit_tick, mercy_until_tick, target. A fight is the same shape against a creature or another player (round 1). Fights with no awake combatant leave the tick loop (TFS idle list, Albion timers [S]).

2. Order inside a tick (the tie-break requirement). OSRS needs fixed order: NPCs processed before players so hits on NPCs land one tick later, and PID decides PvP ties [S]. Ours [D]: inputs applied in order of (arrival tick at server, then distance to target, then account id); players resolve before foes, so a strike that is valid this tick lands this tick and the foe's reply is next tick. Same rule decides who takes a pack of finds when two reach it on the same tick (round 2).

3. Authority and prediction. Server decides every hit and every hp (round 1). Phone: sends numbered inputs, predicts only its own walk, reconciles by replaying unacknowledged inputs (Gambetta [S]). Starting the swing pose locally on press is presentation, not state [D]; no hp change is drawn until the server says so. NO lag compensation and NO rollback in v1: foes are slow and telegraphed; Valve rewind and Overwatch rollback are the costly options (retry clause in round 1: a prediction rule is designed with the owner, never a simulation on the phone). Never accept a client-reported hit (RotMG's model; Albion's one serious exploit was trusting client data [S, summaries]).

4. Tempo of the thing in hand. Weapon speed in ticks, one global cooldown shared by every hand item (OSRS [S]); swapping never skips it. Start values [D]: quick 8 ticks (800 ms), standard 10 (1000 ms), heavy 12-15 (1200-1500 ms), floor 6 ticks (600 ms). References: OSRS 4-7 ticks = 2.4-4.2 s [S], Tibia 2000 ms (forum only), LoL cap 3.003 attacks/s [S], UO floor 1.25 s (community). Reach [D]: 1 tile, no diagonal (OSRS melee [S]); long reach 2 for a spear-type hand; a thrown thing lands after 1 + floor(D/6) ticks (OSRS darts/knives [S]). The hand also sets noise (step 9) and windup length.

5. The swing as three phases. windup, active, recovery, all in ticks. First-ring predator [D]: windup 5 ticks (500 ms, drawn as the wind-up pose per round 3), active 2 ticks (200 ms, near Terraria's 0.17 s per-target window [S]), recovery 8 ticks (800 ms) when it misses. The foe's strike is a RULE, not a roll: it hits whoever stands in its reach tiles on the active ticks (G34 'a hazard is a rule, not a roll'); the windup is longer than command latency (about 200 ms at 100 ms RTT) so a player who reacts can step out. No source gives a minimum telegraph; 500 ms is a tuning start. One swing hits a given target once: per-target re-hit lockout 2 ticks (Terraria 0.17 s [S]).

6. Hit, damage and the small keys. Damage = integer band around a base: f = base/8 (integer), roll in [base - f, base + f - 1] (Stardew [S]) plus the hand's bonus using the OSRS shape floor((eff x (bonus + 64) + 320) / 640) so tiers stay compressed [S pattern, constants D]; minimum 1 after defence (Stardew, OSRS [S]). Keys [D, proposal only - the attribute map is to be redone with the combat wave, DECISIONS.md:2931]: each key adds at most +/-10% to ONE term, in steps of 1% (basis points), never more than one key per term; old page's pairing was stamina = breath, agility = dodge, senses = windup readability, luck = drop, might = the hand's push. If a miss chance is wanted for the player's strike or for a dodge from agility, use the OSRS two-branch rule as an integer fraction from the kernel's random stream so the server can replay it (G34 line 74-76): with attack roll A and defence roll D, chance = (2A - D)/(2A + 2) if A > D else A/(2D + 2) [D algebra of the OSRS formula]; parity gives about 50% [S].

7. Mercy and stagger. After a hit on a player: mercy timer 8 ticks (800 ms) with no further damage [D, between Terraria 670 ms and ALttP 967 ms], stagger (no input) 3 ticks (300 ms) [ALttP 19 frames = 317 ms], knockback 1 tile away from the source (ALttP's first alcove is about one knockback). A foe hit is flagged by a 1-tick flash and the same 1-tile knockback, light foes only. No dodge-roll i-frames in the foundation: HLD added then cut them within 3 days, and G34 says the answer to a hazard is a run, never a trick. Hit stop is presentation only (1 tick, 100 ms, client-side, no kernel effect; 50-100 ms on heavy hits [S snippet]).

8. Health and tiers. One health value (G32), foes with hp and breath (round 3). Start tiers [D]: T1 small (dies in 2 hits from a starter hand, ALttP's first knight takes 2 hits [S]), T2 predator (6-8 hits), T3 chief (20+ hits, windup readable at 8 ticks). Predator bite 1/6 of the player's bar at first (ALttP: knight deals 1 half-heart of 6 [S]), so six unanswered bites fell the player. Con colour on the foe's bar frame for level difference, OSRS style (+/-10 range, yellow equal [S]); foes ignore players above 2x their level (OSRS [S]).

9. Aggro, noise, leash. Reuse G47: the cone half as wide as long, smell 1 tile; add [D]: hunt starts when the player is in the cone, in smell, or inside a noise radius; a fight lock (step 10); leash: a foe returns and goes idle when the player is more than 7 tiles from its spawn or den (OSRS max range 7 [S]) and fully resets health on return [D]; it gives up the chase on losing the target for 50 ticks (5 s) [D]. Noise [D, radii are Chebyshev tiles; ordering from Project Zomboid: walk adjacent only, sprint 2-3, window 1-2, loud tool/gun the whole area; the tile numbers are mine]: walk 0 (smell only), run 3, a strike that lands 4, felling or digging 5. A noise inside a predator's radius turns its heading toward the source for 30 ticks (3 s) [D], drawn with the head turn so the rule stays readable; its position stays on the clock (round 4). Noise ignores walls, sight does not (Zomboid [S]). Fog still shortens only the cone (G47).

10. Claim and the pack rule (first come). Claim = the first account whose strike lands on a foe; the claim lasts while the fight lock runs: lock_until_tick = tick + 48 refreshed by every hit dealt or taken by the claimant (OSRS PJ timer 8 ticks = 4.8 s, refreshed by each attack [S]; 48 ticks of 100 ms [D]); on lapse the next account to strike becomes claimant (FFXI passes to the last actor [S]). The claim never stops anyone from fighting (WoW retail shares up to 5 [S]); it only decides credit, shown by the bar going grey for others (WoW [S]). For the fallen player's pack of finds (round 2): no protected window (the owner chose first come); the pack is public at once; the first account to reach its tile takes it; same-tick ties go by step 2's order. Reference windows for the owner to see what he declined: OSRS 60 s private then 120 s public [S, summary]; Albion 90 s [S, snippet only].

11. Bars (stills first; starting values, not a spec). Two stacked bars over the head, health on top, breath below [D]; frame 31 x 4 px black, fill inset 1 px, up to 29 px at full (OTClient [S]); 31 px is about half of a 64 px tile (derived 31/64 = 48%). Health colour by percent: >92 #00BC00, >60 #50A150, >30 #A1A100, >8 #BF0A0A, >3 #910F0F, else #850C0C (OTClient [S]); breath one fixed colour [D]. At least 1 px of fill while alive (OSRS, Dec 2013 [S]). Shown from the first hit or aggro until 50 ticks (5 s) after the lock ends [D; OSRS duration not found]. Grey when another account holds the claim. No number printed on any bar (round 3); hitsplat or floating numbers are the owner's separate call.

12. First content to ship, then stop and let the owner play: one foe type (the wolf, today a hazard) fightable with one starter hand, one tempo, no technique slots, no ranged. Then the technique format, then combat content (round 5 order), then the zone fight between players (round 3 'only inside the marked zone'). This follows Tibia (fight a few monsters first, vocations about a year later) and RSC (one weapon speed first, requirements and Wilderness months later).

13. Cost gate before shipping (round 1): measure ticks per second per active fight, fights per process, bytes per snapshot at 10 Hz; Albion budget for scale is 300 players and 500 mobs per single-threaded cluster [S], OSRS 2000 players per world at 600 ms [S]. Send changed state only, to players within about 10 tiles [D from Albion's 10 x 10 m cells].

## numbers
### numbers[0]
**name**: OSRS game tick

**value**: 0.6 s (600 ms); real ticks 0.606-0.618 s under load; 100 ticks per minute

**source**: https://oldschool.runescape.wiki/w/Game_tick

### numbers[1]
**name**: OSRS movement per tick

**value**: walk 1 tile, run 2 tiles

**source**: https://oldschool.runescape.wiki/w/Game_tick

### numbers[2]
**name**: OSRS melee weapon speeds

**value**: 4 ticks (2.4 s) dagger/scimitar/mace/unarmed; 5 (3.0 s) axe/longsword; 6 (3.6 s) battleaxe/warhammer; 7 (4.2 s) halberd/2h sword

**source**: https://oldschool.runescape.wiki/w/Attack_speed

### numbers[3]
**name**: OSRS ranged weapon speeds (base/rapid)

**value**: darts/blowpipe 3/2; chinchompa/shortbow 4/3; composite bow 5/4; longbow/crossbow 6/5; all combat spells 5 ticks (3.0 s); powered staves 4

**source**: https://oldschool.runescape.wiki/w/Attack_speed

### numbers[4]
**name**: OSRS monster attack speeds

**value**: 1 tick (scarab swarm) to 15 ticks (scarab mage); 4 most common

**source**: https://oldschool.runescape.wiki/w/Attack_speed

### numbers[5]
**name**: OSRS monster retaliation delay

**value**: (attack speed / 2) + 1 ticks, rounded up

**source**: https://oldschool.runescape.wiki/w/Attack_speed

### numbers[6]
**name**: OSRS max hit

**value**: floor( floor((EffStr x (StrBonus + 64) + 320) / 640) x gearMult ); EffStr = floor((level + boost) x prayer) + style(3 aggressive / 1 controlled) + 8

**source**: https://oldschool.runescape.wiki/w/Damage_per_second/Melee

### numbers[7]
**name**: OSRS attack roll / defence roll

**value**: attack = floor(EffAtk x (AtkBonus + 64) x gearMult); monster defence = (DefLevel + 9) x (StyleDefBonus + 64); player defence = EffDef x (StyleDefBonus + 64)

**source**: https://oldschool.runescape.wiki/w/Damage_per_second/Melee

### numbers[8]
**name**: OSRS hit chance

**value**: if A > D: 1 - (D+2)/(2(A+1)); else A/(2(D+1)); average damage = chance x (max/2 + 1/(max+1))

**source**: https://oldschool.runescape.wiki/w/Damage_per_second/Melee

### numbers[9]
**name**: OSRS scimitar tiers (slash/strength bonus)

**value**: bronze 7/6, iron 10/9, steel 15/14, mithril 21/20, adamant 29/28, rune 45/44, dragon 67/66; all 4 ticks

**source**: https://oldschool.runescape.wiki/w/Scimitar

### numbers[10]
**name**: Gear compression via +64

**value**: dragon vs bronze strength: (66+64)/(6+64) = 1.86x max hit, against an 11x bonus gap (derived)

**source**: derived from https://oldschool.runescape.wiki/w/Scimitar

### numbers[11]
**name**: OSRS attack range

**value**: melee 1 (no diagonal); halberd 2; magic spells 10; ranged 3-10 by weapon, long-range style +2 capped at 10; Chebyshev distance

**source**: https://oldschool.runescape.wiki/w/Attack_range

### numbers[12]
**name**: OSRS hit delay (ticks)

**value**: melee 0; bows 1 + floor((3+D)/6); thrown 1 + floor(D/6); magic 1 + floor((1+D)/3); hits on NPCs land one tick later because NPCs are processed first

**source**: https://oldschool.runescape.wiki/w/Hit_delay

### numbers[13]
**name**: OSRS hitsplat duration

**value**: 1-2 ticks

**source**: https://oldschool.runescape.wiki/w/Hitsplat

### numbers[14]
**name**: OSRS PJ timer (combat lock)

**value**: 8 ticks (4.8 s) vs monsters, refreshed by each attack; 20 ticks (12 s) Wilderness PvP; 16 ticks (9.6 s) PvP worlds; no logout for 16 ticks after an attack

**source**: https://oldschool.runescape.wiki/w/PJ_timer

### numbers[15]
**name**: OSRS aggression level gate

**value**: aggressive monster attacks players with combat level <= 2x its level; level 63+ always attack

**source**: https://oldschool.runescape.wiki/w/Aggressiveness

### numbers[16]
**name**: OSRS tolerance

**value**: 10 minutes in a 21 x 21 tile region (10 tiles each way), then monsters go passive until the player leaves and re-enters

**source**: https://oldschool.runescape.wiki/w/Aggressiveness

### numbers[17]
**name**: OSRS retreat ranges

**value**: max range almost always 7 tiles from spawn; retreat interaction area = 7 + 11 = 18 tiles

**source**: https://oldschool.runescape.wiki/w/Retreat

### numbers[18]
**name**: OSRS drop timer

**value**: tradeable drops private 60 s, then public, gone 120 s later; Wilderness drops public at once (search summary of the wiki page)

**source**: https://oldschool.runescape.wiki/w/Drop_timer

### numbers[19]
**name**: OSRS passive hp regen

**value**: 1 hp per minute (2 with Rapid Heal; 4 with regen bracelet too)

**source**: https://oldschool.runescape.wiki/w/Hitpoints

### numbers[20]
**name**: OSRS combat-level colour

**value**: green to red over +/-10 levels; equal = yellow #ffff00

**source**: https://oldschool.runescape.wiki/w/Combat_level

### numbers[21]
**name**: OSRS world capacity

**value**: 2000 players members world, 1400 free-to-play

**source**: https://oldschool.runescape.wiki/w/World

### numbers[22]
**name**: OSRS health bar

**value**: green (hp left) over red (hp lost); shown on both fighters; no numbers on the bar; always >= 1 px green since Dec 2013; pixel size and duration not found

**source**: https://oldschool.runescape.wiki/w/Health_bar

### numbers[23]
**name**: TFS think and check intervals

**value**: EVENT_CREATURE_THINK_INTERVAL = 1000 ms; EVENT_CHECK_CREATURE_INTERVAL = 1000/10 = 100 ms

**source**: https://raw.githubusercontent.com/otland/forgottenserver/master/src/creature.h

### numbers[24]
**name**: TFS attack check

**value**: attack only when (now - lastAttack) >= getAttackSpeed(); lastAttack updates only when the weapon use succeeds; default attack speed 2000 ms is from OTLand forum posts only

**source**: https://raw.githubusercontent.com/otland/forgottenserver/master/src/player.cpp ; https://otland.net/threads/attack-speed-skill-tfs-1-4.280106/

### numbers[25]
**name**: TFS fight-mode factors

**value**: getAttackFactor ATTACK 1.0, BALANCED 1.2, DEFENSE 2.0; getDefenseFactor ATTACK 0.5 and BALANCED 0.75 while still inside the attack interval, else 1.0. CONFLICT: TibiaQA (citing TibiaWiki Formulae) gives max-damage multipliers 1 / 0.75 / 0.5 and defence factors 5 / 7 / 10 for Full Attack / Balanced / Full Defense

**source**: https://raw.githubusercontent.com/otland/forgottenserver/master/src/player.cpp ; https://www.tibiaqa.com/23492/?show=23584

### numbers[26]
**name**: TFS block and armor

**value**: defense blocks while blockCount > 0, damage reduced by a random value between defense/2 and defense; blockCount +1 every 1000 ms capped at 2; armor above 3 random reduction, 1-3 subtracts 1

**source**: https://raw.githubusercontent.com/otland/forgottenserver/master/src/creature.cpp

### numbers[27]
**name**: TFS movement timing

**value**: step durations rounded up to multiples of 50 ms; diagonal step x3; base speed 220; monsters with a nearby target double step duration

**source**: https://raw.githubusercontent.com/otland/forgottenserver/master/src/creature.cpp

### numbers[28]
**name**: TFS target and leash constants

**value**: taunt (challenge) 8000 ms; summons despawn beyond 30 tiles; monsters outside spawn range are teleported to the master position and set idle; nearest-target search uses Manhattan distance

**source**: https://raw.githubusercontent.com/otland/forgottenserver/master/src/monster.cpp ; https://raw.githubusercontent.com/otland/forgottenserver/master/src/creature.cpp

### numbers[29]
**name**: TFS combat-lock related

**value**: in-fight condition duration is config-driven (PZ_LOCKED, value not shown); PZ-locked player kick timeout 60000 ms; ping every 5000 ms

**source**: https://raw.githubusercontent.com/otland/forgottenserver/master/src/player.cpp

### numbers[30]
**name**: Tibia timeline

**value**: server 7 Jan 1997; Alpha 2.0 3 Jun 1997; new fighting system summer 1997; Alpha 3.0 28 Oct 1997; magic/skills/vocations early 1998; beta 20 May 1998

**source**: https://otland.net/goto/post?id=2728791

### numbers[31]
**name**: Tibia health-bar colour thresholds (OTClient)

**value**: >92 #00BC00, >60 #50A150, >30 #A1A100, >8 #BF0A0A, >3 #910F0F, else #850C0C

**source**: https://raw.githubusercontent.com/mehah/otclient/main/src/client/creature.cpp

### numbers[32]
**name**: Tibia health-bar geometry (OTClient)

**value**: 31 x 4 px black frame, fill inset 1 px, fill width = percent/100 x 29 px, name-to-bar minimum spacing 2 px

**source**: https://raw.githubusercontent.com/mehah/otclient/main/src/client/creature.cpp

### numbers[33]
**name**: League of Legends tick

**value**: 33 ms (30.3 Hz target); durations round up to the next whole tick (0.25 s cast = 8 ticks = 0.264 s); attack speed cap 3.003/s; 1-tick uncancellable windup grace

**source**: https://wiki.leagueoflegends.com/en-us/Tick_and_updates ; https://wiki.leagueoflegends.com/en-us/Basic_attack

### numbers[34]
**name**: Overwatch frames (via Edgegap)

**value**: 16 ms command frames (62.5 Hz), 7 ms tournament; client ahead of server by RTT/2 + 1 frame (about 96 ms at 160 ms RTT); time dilation tick 15.2 ms; hit-rewind bounding volume about 0.5 s; hit-impact prediction off above about 220 ms RTT

**source**: https://edgegap.com/blog/game-backend-deep-dive-overwatch-2016-netcode-architecture-rollback

### numbers[35]
**name**: Valve Source (search summaries, fetch 403)

**value**: tick 66 (CSS, DoDS, TF2); default interpolation 100 ms; sv_maxunlag 1.0 s; CS:GO matchmaking 64 tick, tournament 128; lag-comp execution time = server time - (latency + interpolation)

**source**: https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking ; https://dignitas.gg/articles/blogs/CSGO/9512/tickrate-interpolation-lag-compensation-and-you-probably-not-the-reason-why-you-just-missed-that-shot

### numbers[36]
**name**: Gambetta example lag

**value**: 250 ms lag, 100 ms per square used in the reconciliation example; no server rates given

**source**: https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html

### numbers[37]
**name**: Age of Empires networking

**value**: turns typically 200 ms; commands run 2 turns later; 15 fps target; command latency under 250 ms not noticed, 250-500 ms playable, over 500 ms noticeable; player command rate about one per 1.5-2 s; full unit-state sync would cap at about 250 moving units

**source**: https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond

### numbers[38]
**name**: Albion server load (Salz 2016)

**value**: no game loop (mobs use timers); per cluster about 500 mobs, over 10,000 interactive objects, up to 300 players; grid hash 10 x 10 m cells; cluster about 1 km2, about 600 clusters; gameplay single-threaded per cluster; 95% of players ping 150 ms or less (secondary report)

**source**: https://www.slideshare.net/slideshow/albion-online-software-architecture-of-an-mmo-talk-at-quo-vadis-2016-berlin/62724504 ; https://theglobalgaming.com/gaming/server-location-albion-online (search summary)

### numbers[39]
**name**: Albion black-zone loot window

**value**: 90 s protected corpse (dead player's allies, killer or top damage dealer and allies), then anyone; green zone drops nothing, yellow materials only, red/black full inventory; search snippet only, fetch 403

**source**: https://massivelyop.com/?p=400169 ; https://www.gamerevolution.com/guides/341481-albion-online-losing-items-upon-death-works-green-yellow-red-regions

### numbers[40]
**name**: RotMG

**value**: about 5 server ticks per second (200 ms) per a 2013 MPGH thread; entities drawn 200-400 ms behind; client reports its own hits, server checks shot spawn within about 1.5 tiles (reverse-engineering write-up, summary only); damage = base x (0.5 + ATT/50) minus defence with a floor (15% per a forum answer, other sources differ)

**source**: https://www.mpgh.net/forum/thread/687843-rotmg-pvp-basic-howto-private-server ; https://him.is/posts/rotmg-wire-protocol/ ; https://www.realmeye.com/forum/t/dps-full-calculation/56926

### numbers[41]
**name**: UO swing formula (community, unofficial)

**value**: base ticks = displayed seconds x 4 (4 ticks per second); stamina ticks = floor(stamina/30); hit start = (base - stamina ticks) x 100/(100 + SSI); floor 5 ticks = 1.25 s; example halberd 4.25 s = 17 ticks

**source**: https://community.stratics.com/threads/swing-speed-calculator-in-the-making-offical-response-please.59271/latest

### numbers[42]
**name**: WoW aggro radius (community-tested)

**value**: about 20 yd at equal level, +/-1 yd per level, min 5 yd, max 45 yd (at +25 levels); vertical distance weighted much more

**source**: https://warcraft.wiki.gg/wiki/Aggro_radius

### numbers[43]
**name**: WoW threat switch

**value**: new target must exceed the holder by 10% in melee range or 30% outside

**source**: https://warcraft.wiki.gg/wiki/Aggro

### numbers[44]
**name**: WoW tap

**value**: Classic: first damage taps for the whole party; Retail since 7.0.3 (2016): up to 5 non-grouped players share; tap kept while on the threat table; unit frames grey for the rest

**source**: https://warcraft.wiki.gg/wiki/Tap

### numbers[45]
**name**: Stardew damage band

**value**: fluctuation = int(base/8); damage in [base - f, base + f) i.e. 7/8 to just under 9/8 (Shadow Brute base 18 deals 16-19); damage taken = damage - defence; minimum 1; defence dampened by 0/10/20% at random when defence >= damage/2; player attack +3 damage per Attack point; crit multiplier base 3x

**source**: https://wiki.stardewvalley.net/Combat/Mechanics

### numbers[46]
**name**: ALttP mercy and stun

**value**: mercy 58 frames (967 ms at 60 fps); stun 19 frames (317 ms); recoil 24; free movement 39 frames (650 ms); 144 frames (2.4 s) after a pit/warp; electrocution timer 64 frames (1.07 s). One blog, not a disassembly

**source**: https://gamertagmythras.com/blog/zelda-a-link-to-the-past/alttp-invincibility-frames

### numbers[47]
**name**: ALttP first fight

**value**: Link 3 hearts; first knight takes 2 hits from the level 1 sword; deals 1 half-heart per hit; knocked back about one alcove; optional with a safe ledge

**source**: https://www.gamedeveloper.com/design/first-combat-of-link-to-the-past

### numbers[48]
**name**: Terraria

**value**: player post-hit invincibility 0.67 s (about 40 ticks at 60); per-NPC weapon local immunity 0.17 s (about 10 ticks)

**source**: https://terraria.wiki.gg/wiki/Invincibility_frames

### numbers[49]
**name**: Enter the Gungeon roll

**value**: about 0.7 s total; first half invulnerable (wiki) or about three quarters (Steam post); no exact frames

**source**: https://enterthegungeon.wiki.gg/wiki/Dodge_Roll_(Move)

### numbers[50]
**name**: Hyper Light Drifter dash i-frames

**value**: added in the 15 Apr 2016 patch, reduced 18 Apr 2016; frame counts not found

**source**: https://kotaku.com/the-contentious-debate-over-whether-to-make-hyper-light-1772125287 (search summary)

### numbers[51]
**name**: Core Keeper

**value**: sword 2.5 and dagger 3.3 in an unlabelled APS column (probably attacks per second); magic barrier regenerates after 8 s without damage (6 s with a talent); mobs regenerate about 10% hp/s when idle (user-reported); player i-frames not found

**source**: https://corekeeper.atma.gg/en/Weapons ; https://core-keeper.fandom.com/wiki/Magic_barrier (search summaries)

### numbers[52]
**name**: Hit stop

**value**: 2-4 frames in fighting games; 50-100 ms on a heavy hit (search snippets)

**source**: https://www.wayline.io/learn/game-feel/1

### numbers[53]
**name**: RSC combat rules at launch

**value**: PvP within 5 combat levels; cannot run for 3 combat rounds; all weapons the same speed; failed spell blocks casting for 20 s; Wilderness 13 Aug 2001; requirements Nov 2001; classes removed Jul 2002

**source**: https://runescape.wiki/w/RuneScape_Classic

### numbers[54]
**name**: Project Zomboid noise ordering (qualitative)

**value**: walk adjacent only; sneak minimal; sprint about 2-3 blocks; break window 1-2; bang wall 1; gunshot/chainsaw whole tile; other sources 150-900 tile radii and disagree

**source**: https://zomboidpro.it.com/post-zombie-behavior.html ; https://pzfans.com/what-attracts-zombies-to-bases/

### numbers[55]
**name**: Derived: latency budget at 100 ms tick

**value**: 150-200 ms input-to-result at 100 ms RTT = 50 + (0..100) + 50; vs 200 ms tick 200-300 ms

**source**: derived, inside AoE bands at https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond

### numbers[56]
**name**: Derived: starter swing and fight timings at 100 ms ticks

**value**: swing 8-15 ticks (floor 6); predator windup 5, active 2, recovery 8; mercy 8; stagger 3; knockback 1 tile; re-hit lockout 2; combat lock 48 ticks; chase give-up 50 ticks; noise turn 30 ticks; bar linger 50 ticks

**source**: derived proposals, anchored as listed in the recommendation

## catalogue
## pitfalls
- Cadence: the owner declined half-second beats (DECISIONS.md:2904). Copying OSRS's 600 ms tick wholesale re-offers the declined option; copy its integer discipline (ticks, queue to boundary, fixed order), not its number.
- Ambiguity of 'pack': DECISIONS.md:2912 is the bundle of finds a fallen player leaves; monster-pack and tagging patterns serve a different reading. Confirm with the owner which one the builder means. OSRS and Albion both protect a drop for 60-90 s, which is NOT first come.
- Same-tick ties: 'first come' needs a written order. OSRS needs NPC-before-player ordering and PID for PvP ties; the extra tick on NPC hits surprised its players for years. Write the order once in the kernel and test it.
- Tick drift under load: OSRS ticks stretched to 0.616-0.618 s on a full world. Keep sim time fixed and let the server fall behind visibly rather than run extra ticks (Overwatch death spiral).
- Weapon swap trick: in OSRS a swap keeps the old cooldown; without a shared cooldown a quick weapon plus a heavy one doubles output. Keep one cooldown for the whole hand slot.
- I-frames trivialise a fight: Hyper Light Drifter added dash i-frames on 15 Apr 2016 and cut them on 18 Apr 2016 ('a little too much freedom'). G34 also says the answer to a hazard is a run, never gear or a trick; keep the mercy timer short and give no free dodge in the foundation.
- Client-reported hits are cheap and exploitable: RotMG's client reports its own hits (reverse-engineering write-up, summary only); Albion's CTO said its one serious exploit came from the server trusting client data. Round 1's 'never a simulation on the phone' already forbids it.
- Lag compensation is a cost trap for a small team: Valve rewinds up to 1.0 s, Overwatch rewinds about 0.5 s and disables prediction above about 220 ms RTT; both need a position history and fairness clamps. Telegraphed slow foes avoid the need.
- Fight-mode factors conflict between sources (TFS 1.0/1.2/2.0 vs TibiaQA 1/0.75/0.5) and Tibia's own wiki pages could not be fetched; do not cite Tibia numbers as CipSoft's. RotMG defence floor also conflicts (15% vs 85-90% cap).
- Noise radii sourced from Project Zomboid disagree by an order of magnitude (150-900 tiles vs a few blocks); use small integer tile radii and test them on the first ring, round 4's own retry clause (stealth quests failing from other players' noise).
- Bars: OSRS and LoL show hitsplats or numbers; round 3 prints no number on any bar. Do not import damage numbers into the foundation; and the bars' look is a direction, so stills at phone size go to the owner first (AGENTS.md, How work moves; DECISIONS.md:2918).
- The attribute map of round 5 is superseded in part (attributes are six; might replaces carry; spirit is new; map to be redone with the combat wave). The keys in the recommendation are a proposal, not a decision.
- Chance must run through the kernel's own random stream (G34, GAME_RULES.md:368-376) so the server can replay it; an integer fraction compared to rng(den) is fine, a float is not. Prefer rules over rolls for foe strikes.
- Leash and reset: OSRS safespotting and TFS idle-wake bugs show a foe that does not reset hp and position on losing the target can be farmed; define the reset on leash, and what a foe does when its target falls (G33).
- Thin evidence: ALttP numbers come from one blog; Moonlighter and Core Keeper i-frames, Stardew post-hit invincibility, HLD frame counts, WoW leash distance, Albion tick rate and the OSRS bar size were not found; do not present them as known.
- Scope: G47 (GAME_RULES.md:387) was cited for the cone and smell but lies outside the G30-G36 range this research was told to read; its rule that noise never turns a head is superseded by round 4 (DECISIONS.md:2924).
## sources
- docs/design/GAME_RULES.md:313,333,341,355,368,381,387,418 (repo worktree /home/elad-saadon/Projects/GAME.worktrees/develop-read at e612194b3)
- DECISIONS.md:2904,2912,2918,2924,2931 (same worktree)
- https://oldschool.runescape.wiki/w/Attack_speed
- https://oldschool.runescape.wiki/w/Game_tick
- https://oldschool.runescape.wiki/w/Damage_per_second/Melee
- https://oldschool.runescape.wiki/w/Scimitar
- https://oldschool.runescape.wiki/w/Attack_range
- https://oldschool.runescape.wiki/w/Hit_delay
- https://oldschool.runescape.wiki/w/Hitsplat
- https://oldschool.runescape.wiki/w/Health_bar
- https://oldschool.runescape.wiki/w/PJ_timer
- https://oldschool.runescape.wiki/w/Single-way_combat
- https://oldschool.runescape.wiki/w/Multicombat_area
- https://oldschool.runescape.wiki/w/Aggressiveness
- https://oldschool.runescape.wiki/w/Retreat
- https://oldschool.runescape.wiki/w/Retaliation
- https://oldschool.runescape.wiki/w/Combat_level
- https://oldschool.runescape.wiki/w/Hitpoints
- https://oldschool.runescape.wiki/w/World
- https://oldschool.runescape.wiki/w/Drop_timer
- https://runescape.wiki/w/RuneScape_Classic
- https://runescape.wiki/w/Update:Blog_-_History_of_RuneScape:_The_First_Four_Years
- https://raw.githubusercontent.com/otland/forgottenserver/master/src/creature.cpp
- https://raw.githubusercontent.com/otland/forgottenserver/master/src/creature.h
- https://raw.githubusercontent.com/otland/forgottenserver/master/src/player.cpp
- https://raw.githubusercontent.com/otland/forgottenserver/master/src/monster.cpp
- https://raw.githubusercontent.com/mehah/otclient/main/src/client/creature.cpp
- https://otland.net/goto/post?id=2728791
- https://otland.net/threads/attack-speed-skill-tfs-1-4.280106/
- https://www.tibiaqa.com/23492/?show=23584
- https://wiki.leagueoflegends.com/en-us/Tick_and_updates
- https://wiki.leagueoflegends.com/en-us/Basic_attack
- https://edgegap.com/blog/game-backend-deep-dive-overwatch-2016-netcode-architecture-rollback
- https://gdcvault.com/play/1024001/-Overwatch-Gameplay-Architecture-and (listing only, members-only)
- https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking (search summary only, fetch 403)
- https://dignitas.gg/articles/blogs/CSGO/9512/tickrate-interpolation-lag-compensation-and-you-probably-not-the-reason-why-you-just-missed-that-shot
- https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html
- https://www.gabrielgambetta.com/lag-compensation.html
- https://www.gafferongames.com/post/deterministic_lockstep/
- https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond
- https://unity.com/blog/albion-online-cross-platform-pvp-mmo-architecture
- https://www.slideshare.net/slideshow/albion-online-software-architecture-of-an-mmo-talk-at-quo-vadis-2016-berlin/62724504
- https://massivelyop.com/?p=400169 (search snippet only, fetch 403)
- https://him.is/posts/rotmg-wire-protocol/ (search summary only, fetch 403)
- https://www.mpgh.net/forum/thread/687843-rotmg-pvp-basic-howto-private-server
- https://www.realmeye.com/forum/t/dps-full-calculation/56926
- https://community.stratics.com/threads/swing-speed-calculator-in-the-making-offical-response-please.59271/latest
- https://uo.com/wiki/ultima-online-wiki/technical/previous-publishes/2000-2/2000-publish-06-21st-august/
- https://warcraft.wiki.gg/wiki/Aggro_radius
- https://warcraft.wiki.gg/wiki/Aggro
- https://warcraft.wiki.gg/wiki/Tap
- https://bg-wiki.com/ffxi/Claim_System
- https://gamertagmythras.com/blog/zelda-a-link-to-the-past/alttp-invincibility-frames
- https://www.gamedeveloper.com/design/first-combat-of-link-to-the-past
- https://wiki.stardewvalley.net/Combat/Mechanics
- https://terraria.wiki.gg/wiki/Invincibility_frames
- https://enterthegungeon.wiki.gg/wiki/Dodge_Roll_(Move)
- https://kotaku.com/the-contentious-debate-over-whether-to-make-hyper-light-1772125287 (search summary)
- https://en.namu.wiki/w/Moonlighter (search summary)
- https://corekeeper.atma.gg/en/Weapons (search summary)
- https://zomboidpro.it.com/post-zombie-behavior.html
- https://gamedeveloper.com/design/enemy-attacks-and-telegraphing
- https://www.wayline.io/learn/game-feel/1 (search snippet)
