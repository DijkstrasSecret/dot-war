# Patch 0.7: fight tests after the whole of 0.7 (1 October 2026)

Everything 0.7 added (big random maps, living infantry, the sharper mortar blast, villages, buff
sites, citadels, cover props, siege raids) tested together, as Kaan asked: "do it really extensively".

**What was run**

| Test | Size |
| --- | --- |
| Recorded fights (`lab/fight-scenarios.js`) | 61 fights × 100 runs (40 before), 14 of them new for 0.7 |
| Balance Lab meta snapshot | at 100 runs (the 0.5e baseline used 30) |
| Big maps (13 km) | 6 AI-versus-AI matches up to 75 min, 12 "idle player" pressure runs, siege raids on 7 maps |
| Behaviour and map checks | all 20 on 10 seeds |
| Small-map AI matches (Highland Pass) | 6, up to 40 min |
| Videos | every fight group, and a whole big-map AI match at 24× |

## In plain words

1. **The citadel is the one thing that needs a decision.**
   - Grenadiers alone can hardly take it: 8 or 12 never do, 16 win 5%, and it takes about 20 for an
     even chance.
   - One Mortar Crew empties it every time, in about a minute; two take 25 s, three 14 s.
   - The cause: each shell reaches every man inside at once (30% damage each). So "really hard to
     occupy" holds against infantry only; mortars crack it at once.
2. **Mortars are no longer a hard counter.**
   - Since the sharper blast (0.7b.1), 6 Riflemen beat 3 Mortar Crews about half the time (was 18%).
   - At equal cost Riflemen win 72% (was 43%), and Machine Gunners beat mortars 83% (was 55%).
   - Mortars still beat trenches and still win the mortar mirror evenly.
3. **Cover from 0.7c works, when soldiers stand on it.**
   - Holding in ruins wins 98%, behind a stone wall 99% (on open ground 89%).
   - 7 attackers take ruins 73% of the time (a forest edge: 82%; open ground: about 100%).
   - Ruins don't hide soldiers the way a forest does, which is why they are easier to attack than a
     forest edge.
   - 8 attackers against 6 in a village with civilians is close to even (57%), and no civilian was
     ever targeted.
   - Soldiers on Defend don't step into cover on their own (Defend means "stay here").
4. **Squads fight better.**
   - The mixed company as a squadron beats the same company loose 63% (was 33%).
   - 6 Riflemen as a squadron beat 6 loose 59–63%.
5. **Fights are decisive again.**
   - The 0.6 stalemates (Machine Gunners needing spotters) are gone: the MG mirror had 70% draws in
     the 0.5e snapshot and has none now.
   - 6 Riflemen still lose to 6 Machine Gunners every time, now in 22–29 s instead of 36–70 s. That is
     the old 0.5e picture coming back (MG strong in numbers), not something new from 0.7.
6. **The siege raid works on every map tried.** On 7 maps it took the tower, then the weakest
   outpost ahead, then the HQ, and never touched an outpost off its route.
7. **Big maps:**
   - A player who orders nothing loses the HQ at about 23 min on Easy, 15–28 on Normal and 14–17 on
     Hard (on Highland Pass: 12.8, 7.7 and 5.8).
   - The enemy holds 1–3 buff sites by mid-game.
   - AI against AI: 1 of 6 matches decisive (65.5 min, inside the 45–75 min target); 5 reached 75 min
     with 120–190 soldiers lost a side.
   - Two identical scripted AIs still stall, as the plan expects until the AI plays by the player's
     economy (DD L).
   - On Highland Pass all 6 AI matches stalled at 40 min, as before.
8. **Speed is the thing to watch.**
   - A 75-minute big-map match takes 12–21 minutes of computing, the late game being the heaviest.
   - At 1× that is comfortable; at 4×, late in a big match, an ordinary laptop may stutter.
   - This is the 0.7 "done when" item still open.
9. **Nothing broke:**
   - All 20 behaviour and map checks pass on all 10 seeds.
   - The economy timeline is identical to the baseline.
   - No civilian died in any big-map match.

## Balance Lab snapshot (100 runs) against the 0.5e baseline (30 runs)

| Duel (110 m, flat) | 0.7 | 0.5e |
| --- | --- | --- |
| 6 Riflemen v 6 Riflemen | 43 / 57, 18 s | 50 / 50, 19 s |
| 6 Riflemen v 6 MG | 0 / 100, 22 s | 0 / 90 (10% draw), 37 s |
| 6 Riflemen v 6 Snipers | 5 / 95, 13 s | 10 / 90, 12 s |
| 6 Riflemen v 3 Mortars | 80 / 20, 13 s | 63 / 37, 12 s |
| 6 MG v 6 MG | 41 / 59, 61 s | 13 / 17 (70% draw), 149 s |
| 6 MG v 6 Snipers | 51 / 49, 13 s | 67 / 33, 12 s |
| 6 MG v 3 Mortars | 99 / 1, 17 s | 100 / 0, 16 s |
| 6 Snipers v 6 Snipers | 58 / 42, 6 s | 63 / 37, 6 s |
| 6 Snipers v 3 Mortars | 98 / 2, 5 s | 90 / 10, 5 s |
| 3 Mortars v 3 Mortars | 60 / 39, 9 s | 60 / 37, 7 s |

| Terrain, squads, fortifications | 0.7 | 0.5e |
| --- | --- | --- |
| 5 v 5, B 30 m higher (B wins; target 65–80) | 65% | 74% |
| 5 v 5, B in forest (B wins) | 81% | 86% |
| 6 v 6, A as a squadron (A wins; target 55–65) | 63% | 62% |
| MG pins a Rifleman (target 3.5–5.5 s) | 4.9 s | 4.9 s |
| 8 v 5 in a trench (attackers win) | 63% | 70% |
| 8 grenadiers v full Bunker | 75% | 70% |
| 10 grenadiers v full Bunker | 100% | 97% |

| Economy and pressure (Highland Pass) | 0.7 | 0.5e |
| --- | --- | --- |
| First Tier II research affordable | 1.5 min | 1.5 min |
| Wood / metal at 20 min | 2998 / 1566 | 2997 / 1567 |
| Idle player's HQ falls: Easy / Normal / Hard | 12.8 / 7.7 / 5.8 min | 11.9 / 9.3 / 5.8 min |

## Citadel sweep (100 runs each; the citadel holds 6 Riflemen + 2 Machine Gunners)

| Attackers | Attackers win | Avg fight |
| --- | --- | --- |
| 8 grenadiers | 0% | 18 s |
| 12 grenadiers | 0% | 21 s |
| 16 grenadiers | 5% | 21 s |
| 20 grenadiers | 48% | 19 s |
| 6 Riflemen + 1 Mortar Crew | 100% | 58 s |
| 6 Riflemen + 2 Mortar Crews | 100% | 25 s |
| 6 Riflemen + 3 Mortar Crews | 100% | 14 s |

## Big maps

| AI v AI (13 km, 75 min cap) | Result | Soldiers lost blue / red | Buff sites at the end |
| --- | --- | --- | --- |
| Normal, map 1 | **blue wins at 65.5 min** | 77 / 66 | red 2 |
| Normal, map 2 | stalemate | 135 / 126 | blue 1, red 1 |
| Normal, map 3 | stalemate | 149 / 124 | red 3 |
| Hard, map 1 | stalemate | 116 / 118 | red 2 |
| Hard, map 2 | stalemate | 187 / 165 | blue 1, red 1 |
| Hard, map 3 | stalemate | 175 / 157 | red 3 |

(Blue is a copy of the commander placed at the player's base; red holds the plateau. Red ended with more buff sites in 4 of 6 matches; why was not investigated.)

| Idle player, 13 km map | First enemy within 500 m | HQ lost |
| --- | --- | --- |
| Easy (4 maps) | 16.7–19.9 min | 22.6–23.9 min |
| Normal (4 maps) | 13.6–16.9 min | 15.4–28.5 min |
| Hard (4 maps) | 12.0–14.5 min | 13.8–17.4 min |

Siege raid (staged on 7 maps): tower → weakest outpost ahead → HQ on all 7; the outpost 3 km off the
route untouched on all 7 (`data/siege.json`).

## All 61 fights, 100 runs each (0.6 numbers from 40 runs)

### Equal supply, open ground

| Fight | 0.7: blue / red / draw, avg | 0.6 |
| --- | --- | --- |
| Riflemen mirror | 41 / 59 / 0, 27 s | 38 / 63 / 0, 27 s |
| Riflemen v Machine Gunners | 0 / 100 / 0, 29 s | 0 / 100 / 0, 30 s |
| Riflemen v Snipers | 0 / 100 / 0, 15 s | 0 / 100 / 0, 15 s |
| Riflemen v Mortar Crews | 51 / 49 / 0, 17 s | 18 / 83 / 0, 14 s |
| Riflemen spread 30 m apart v Mortar Crews | 52 / 48 / 0, 17 s | 25 / 75 / 0, 15 s |
| Machine Gunner mirror | 46 / 54 / 0, 67 s | 53 / 48 / 0, 69 s |
| Machine Gunners v Snipers | 23 / 77 / 0, 20 s | 33 / 68 / 0, 18 s |
| Machine Gunners v Mortar Crews | 83 / 17 / 0, 18 s | 55 / 45 / 0, 16 s |
| Sniper mirror | 58 / 42 / 0, 12 s | 58 / 43 / 0, 12 s |
| Snipers v Mortar Crews | 100 / 0 / 0, 11 s | 98 / 3 / 0, 12 s |
| Mortar mirror | 50 / 50 / 0, 14 s | 50 / 50 / 0, 11 s |

### Equal cost

| Fight | 0.7: blue / red / draw, avg | 0.6 |
| --- | --- | --- |
| 8 Riflemen v 3 Machine Gunners | 90 / 10 / 0, 22 s | 93 / 8 / 0, 22 s |
| 8 Riflemen v 5 Snipers | 58 / 42 / 0, 20 s | 75 / 25 / 0, 20 s |
| 8 Riflemen v 3 Mortar Crews | 72 / 28 / 0, 18 s | 43 / 58 / 0, 15 s |
| 3 Machine Gunners v 5 Snipers | 0 / 100 / 0, 11 s | 0 / 100 / 0, 11 s |

### Combined arms

| Fight | 0.7: blue / red / draw, avg | 0.6 |
| --- | --- | --- |
| 1 MG + 4 Riflemen v 6 Riflemen | 81 / 19 / 0, 33 s | 88 / 13 / 0, 33 s |
| 2 MG + 4 Riflemen v 7 Riflemen | 100 / 0 / 0, 31 s | 100 / 0 / 0, 31 s |
| 5 Riflemen + Medic v 6 Riflemen | 20 / 80 / 0, 26 s | 23 / 78 / 0, 27 s |
| Mixed company v 8 Riflemen (equal supply) | 98 / 2 / 0, 27 s | 98 / 3 / 0, 27 s |
| 6 v 6 Riflemen, blue as a squadron | 59 / 41 / 0, 27 s | 53 / 48 / 0, 27 s |
| Mixed company mirror, blue as a squadron | 63 / 37 / 0, 27 s | 33 / 68 / 0, 23 s |

### Terrain (red holds)

| Fight | 0.7: blue / red / draw, avg | 0.6 |
| --- | --- | --- |
| 5 v 5 Riflemen, red holding on flat ground | 11 / 89 / 0, 27 s | 15 / 85 / 0, 27 s |
| 5 v 5 Riflemen, red on a hill 30 m higher | 0 / 100 / 0, 16 s | 0 / 100 / 0, 15 s |
| 5 v 5 Riflemen, red at a forest edge | 4 / 96 / 0, 27 s | 5 / 95 / 0, 27 s |
| 5 v 5 Riflemen, red deep inside a forest | 12 / 88 / 0, 21 s | 8 / 93 / 0, 20 s |
| 7 Riflemen attack 5 at a forest edge | 82 / 13 / 5, 38 s | 93 / 5 / 3, 33 s |
| 7 Riflemen attack 3 Riflemen + MG on a hill | 100 / 0 / 0, 20 s | 100 / 0 / 0, 19 s |

### Fortifications

| Fight | 0.7: blue / red / draw, avg | 0.6 |
| --- | --- | --- |
| 8 Riflemen attack 5 in the open | 100 / 0 / 0, 22 s | 100 / 0 / 0, 22 s |
| 8 Riflemen attack 5 in a trench | 67 / 33 / 0, 31 s | 68 / 33 / 0, 31 s |
| 8 grenadiers attack 5 in a trench | 99 / 1 / 0, 10 s | 100 / 0 / 0, 9 s |
| 8 grenadiers attack 4 Riflemen + MG in a trench | 66 / 34 / 0, 14 s | 60 / 40 / 0, 15 s |
| 6 Riflemen + 2 Mortars attack 5 in a trench | 100 / 0 / 0, 24 s | 100 / 0 / 0, 22 s |
| 8 grenadiers assault a full Bunker | 60 / 40 / 0, 16 s | 65 / 35 / 0, 17 s |
| 10 grenadiers assault a full Bunker | 92 / 8 / 0, 9 s | 93 / 8 / 0, 8 s |

### Special situations

| Fight | 0.7: blue / red / draw, avg | 0.6 |
| --- | --- | --- |
| 2 Snipers pick at 6 idle Riflemen (return fire) | 0 / 0 / 100, 180 s | 0 / 0 / 100, 180 s |
| 2 Snipers against 6 Riflemen on Defend | 0 / 0 / 100, 120 s | 0 / 0 / 100, 120 s |

### Night and weather

| Fight | 0.7: blue / red / draw, avg | 0.6 |
| --- | --- | --- |
| Riflemen mirror at night | 48 / 52 / 0, 20 s | 53 / 48 / 0, 20 s |
| Riflemen v Snipers at night | 4 / 96 / 0, 16 s | 5 / 95 / 0, 16 s |
| Riflemen v Mortar Crews at night | 99 / 1 / 0, 21 s | 100 / 0 / 0, 19 s |
| 1 MG + 4 Riflemen v 6 Riflemen at night | 62 / 38 / 0, 25 s | 65 / 35 / 0, 24 s |
| 5 v 5 Riflemen, red on a hill, at night | 1 / 99 / 0, 18 s | 3 / 98 / 0, 18 s |
| Riflemen v Mortar Crews in fog | 100 / 0 / 0, 9 s | 100 / 0 / 0, 9 s |
| 5 v 5 Riflemen, red on a hill, in fog | 1 / 99 / 0, 21 s | 3 / 98 / 0, 20 s |
| Riflemen mirror in rain | 52 / 48 / 0, 31 s | 55 / 45 / 0, 32 s |
| Riflemen v Mortar Crews in rain | 40 / 60 / 0, 19 s | 13 / 88 / 0, 15 s |
| 5 v 5 Riflemen, red holding, in snow | 8 / 92 / 0, 21 s | 8 / 93 / 0, 21 s |

### Special situations

| Fight | 0.7: blue / red / draw, avg | 0.6 |
| --- | --- | --- |
| 3 Mortars + 3 Riflemen against an MG nest | 100 / 0 / 0, 13 s | 100 / 0 / 0, 9 s |

### Map detail and living infantry (0.7)

| Fight | 0.7: blue / red / draw, avg | 0.6 |
| --- | --- | --- |
| 5 v 5 Riflemen, red holding in ruins | 2 / 98 / 0, 27 s | new |
| 7 Riflemen attack 5 in ruins | 73 / 27 / 0, 36 s | new |
| 5 v 5 Riflemen, red behind a stone wall | 1 / 99 / 0, 27 s | new |
| 8 Riflemen attack 6 holding a village (with civilians) | 57 / 42 / 1, 38 s | new |
| 8 grenadiers assault a Citadel (6 Riflemen + 2 MG inside) | 0 / 100 / 0, 18 s | new |
| 12 grenadiers assault a Citadel (6 Riflemen + 2 MG inside) | 0 / 100 / 0, 21 s | new |
| 6 Riflemen + 3 Mortars against a Citadel | 100 / 0 / 0, 14 s | new |
| 3 Mortars + a spotting Sniper shell 8 idle Riflemen | 0 / 88 / 12, 34 s | new |
| 6 Riflemen attack 5 Riflemen + a Medic holding | 48 / 52 / 0, 35 s | new |
| 3 Snipers on Defend against 6 idle Riflemen spread 40 m | 0 / 17 / 83, 152 s | new |
| 16 grenadiers assault a Citadel (6 Riflemen + 2 MG inside) | 5 / 95 / 0, 21 s | new |
| 20 grenadiers assault a Citadel (6 Riflemen + 2 MG inside) | 48 / 52 / 0, 19 s | new |
| 6 Riflemen + 1 Mortar against a Citadel | 100 / 0 / 0, 58 s | new |
| 6 Riflemen + 2 Mortars against a Citadel | 100 / 0 / 0, 25 s | new |
## After the tests: citadel shells (patch 0.7d.1, Kaan's decision)

A shell now reaches 1–2 of the men inside, at 20% (grenades unchanged). 100 runs each, 10 min limit:

| Attackers (citadel: 6 Riflemen + 2 MG inside) | 0.7 (everyone, 30%) | 0.7d.1 (1–2 men, 20%) |
| --- | --- | --- |
| 6 Riflemen + 1 Mortar Crew | 100%, 58 s | 99%, 7.8 min |
| 6 Riflemen + 2 Mortar Crews | 100%, 25 s | 100%, 3.9 min |
| 6 Riflemen + 3 Mortar Crews | 100%, 14 s | 100%, 2.5 min |
| 8 grenadiers + 2 Mortar Crews | — | 100%, 4.0 min |

Tried on the way (50 runs, 5 min limit): 1–2 men at 30% let 3 Mortar Crews win in 1.7 min; at 15%,
2 Mortar Crews won only half the time within 5 min; at 10% even 3 rarely did.

## Notes on the new fights

- `l-buddy` ends in a stalemate 83% of the time, and that is real behaviour: once the Snipers on
  Defend have shot the Riflemen they can see, the survivors stand out of the Snipers' sight, and after
  chasing they walk back to their posts (0.7b "hold the post").
- `l-shelled`: idle Riflemen shelled by mortars with a spotting Sniper win 88%. Return fire and "help
  a buddy" send them at the shooters.
- Highland Pass AI matches: all 6 stalled at 40 min (`data/ai-stats.json`), as in earlier patches.

## Files

- `data/fights-batch.json`: every fight, 100 runs.
- `data/meta.json`: the Balance Lab snapshot.
- `data/bigmap.json`: the big-map matches, pressure runs and checks.
- `data/siege.json`: the siege raids.
- `data/ai-stats.json`: the Highland Pass AI matches.
- `videos/`: one video per fight group, and `Dot-War-AI-v-AI-13km-map-normal-seed1-24x.mp4`.
