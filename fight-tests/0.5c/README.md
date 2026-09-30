# Fight testing: patch 0.5c (30 September 2026)

## How this was tested

- **37 set-piece fights**, each run **40 times** with different seeds, on a flat test ground
  (960 × 600 m), with the real game rules. Blue (you) starts on the left, red on the right. Unless a
  fight says "red holds", both sides attack-move at each other from about 220 m.
- **8 sweeps** ("how many does it take"), each step run 30 times.
- **6 whole AI-versus-AI matches** on Highland Pass (Easy, Normal and Hard, two seeds each), capped at 40
  game minutes.
- About **1,900 fights** in total. Nothing was retuned: these are the numbers of the current build.
- **Videos:** for every fight I recorded the *typical* outcome (the usual winner, a fight of average
  length). When the underdog wins at least 15% of the time, I also recorded the *other* outcome.
  Playback is **one game second per video second** (the game's 2× speed). The caption under the title
  says which kind each clip is and how often it happens.

## The eight things worth your attention

1. **Mortar Crews dominate Riflemen in the open.** 3 Mortar Crews beat 6 Riflemen **98%** of the time
   (equal supply), and 3 beat 8 Riflemen (equal cost) **93%**. Starting as close as 120 m still gives
   the mortars **83%**. The video shows why: the Riflemen walk in a tight line, and one shell's 32 m blast
   catches two or three of them. With the Riflemen **spread 30 m apart**, they win **23%** instead of 3%.
   Mortars are meant to be strong, but this looks like the biggest outlier. Options (your call): a longer
   wind-up before the first shell, more scatter when the target is moving, or smaller splash against
   infantry in the open.
2. **Standing still beats walking in.** 5 Riflemen holding on flat ground beat 5 attackers **85%** of
   the time; in a straight mirror where both walk it's 50/50. Firing on the move (×0.35 accuracy) costs
   the attacker the fight. So terrain adds little on top: a forest edge gives 95%, deep forest 93%, a
   30 m hill 100%. The attacker needs about **+40% more soldiers** (7 against 5 wins 80–97%).
3. **The Machine Gunner rework works.** At equal cost, 8 Riflemen beat 3 Machine Gunners 63% (fair).
   In support it shines: 1 MG + 4 Riflemen beat 6 Riflemen **85%**, and 2 MG + 4 beat 7 Riflemen
   **100%**. MG mirror fights are slow (73 s on average) but always end.
4. **Snipers are strong for their cost.** 6 Snipers beat 6 Riflemen 100%, and 5 Snipers beat 8 Riflemen
   (equal cost) 70%. You need about **6 Riflemen for every 3 Snipers**. 5 Snipers beat 3 Machine Gunners
   100% at equal cost. Not broken, but worth watching.
5. **Snipers against soldiers on Defend:** idle soldiers now charge a Sniper who shoots them (return
   fire works: the Riflemen win 100%). Soldiers on **Defend (R)** don't: 2 Snipers killed on average
   5 of 6 defenders over 97 s without losing anyone. That follows the current rule ("Defend holds its
   ground"). Should defenders under fire from beyond their reach pull back or go prone? A design question
   for you.
6. **Fortifications behave as designed.** A trench turns 8 attackers from 100% to **58%**; grenades
   bring that back to **98%**. A Machine Gunner in the trench makes grenadiers work for it (58%). Two
   mortars crack a trench (100%). A full Bunker needs **8 grenadiers for about 70%**, 10 for 100%; 6 always
   fail.
7. **The Medic doesn't pay off in a short fight.** 5 Riflemen + a Medic beat 6 Riflemen only 35%. A
   sixth rifle is worth more in a 30-second firefight; the Medic's value is between fights.
8. **AI against AI rarely finishes a match.** Only one of the six matches ended with an HQ destroyed
   within 40 minutes (Hard, seed 2, at 28 minutes). In the other five, both sides trade raids for 40 minutes. That doesn't affect you directly (the AI plays against
   you), but it confirms the AI doesn't know how to push a siege home. That fits the planned 0.5d work
   ("A smarter enemy").

Smaller notes: squadrons are worth it (6 v 6, the squadron wins 63%). Mixed companies at equal supply
crush pure Riflemen (100%). Mortar mirrors are coin flips decided in 9 seconds.

## The videos

| File | What's inside | Length |
| --- | --- | --- |
| [Dot-War-fights-1-Equal-supply-open-ground.mp4](videos/Dot-War-fights-1-Equal-supply-open-ground.mp4) | Every unit against every unit, six supply a side, plus the spread-out Riflemen v Mortars | 8 min |
| [Dot-War-fights-2-Equal-cost.mp4](videos/Dot-War-fights-2-Equal-cost.mp4) | About 180 resources a side | 2.5 min |
| [Dot-War-fights-3-Combined-arms.mp4](videos/Dot-War-fights-3-Combined-arms.mp4) | MG support, Medic, mixed companies, squadrons | 5.5 min |
| [Dot-War-fights-4-Terrain-red-holds.mp4](videos/Dot-War-fights-4-Terrain-red-holds.mp4) | Flat, hill, forest edge, deep forest | 3.5 min |
| [Dot-War-fights-5-Fortifications.mp4](videos/Dot-War-fights-5-Fortifications.mp4) | Trenches, grenades, mortars against a trench, Bunker assaults | 4 min |
| [Dot-War-fights-6-Special-situations.mp4](videos/Dot-War-fights-6-Special-situations.mp4) | Snipers against idle and defending Riflemen, mortars against an MG nest | 2.5 min |
| [Dot-War-AI-match-normal-30x.mp4](videos/Dot-War-AI-match-normal-30x.mp4) | A whole AI v AI match on Highland Pass (Normal), 40 minutes at 30× speed; the camera follows the fighting | 1.5 min |
| [Dot-War-AI-match-hard-4x.mp4](videos/Dot-War-AI-match-hard-4x.mp4) | AI v AI on Hard (seed 2) at 4× speed: blue destroys red's HQ at 28:17 | 7 min |

## Watch any fight yourself

The new **Fight Theatre** page plays these fights with both sides visible (no fog):

1. Start the preview server as usual, then open `http://127.0.0.1:8765/theatre.html`.
2. Pick a fight from the list at the bottom, type a seed (any number) and pick a speed (¼× to 8×).
3. **Restart** replays it. The same fight and seed always play out the same way, so you can pause at
   a moment and replay it.
4. For a whole AI match: `http://127.0.0.1:8765/theatre.html?match=1&diff=normal`.

The fights are listed in `lab/fight-scenarios.js`; adding one is a single line.

## All the numbers

Raw data: [data/](data/) (`fights-batch.json`, `fights-sweep.json`, `ai-stats.json`).

### Equal supply, open ground

| Fight | Blue wins | Red wins | Draw | Avg length | Blue lost | Red lost |
| --- | --- | --- | --- | --- | --- | --- |
| Riflemen mirror | 48% | 53% | 0% | 30 s | 4.3 | 4.3 |
| Riflemen v Machine Gunners | 0% | 100% | 0% | 24 s | 6.0 | 0.0 |
| Riflemen v Snipers | 0% | 100% | 0% | 15 s | 6.0 | 0.8 |
| Riflemen v Mortar Crews | 3% | 98% | 0% | 13 s | 6.0 | 0.5 |
| Riflemen spread 30 m apart v Mortar Crews | 23% | 78% | 0% | 14 s | 5.3 | 1.5 |
| Machine Gunner mirror | 43% | 58% | 0% | 73 s | 4.0 | 3.3 |
| Machine Gunners v Snipers | 45% | 55% | 0% | 22 s | 4.4 | 3.6 |
| Machine Gunners v Mortar Crews | 95% | 5% | 0% | 16 s | 1.2 | 2.9 |
| Sniper mirror | 53% | 48% | 0% | 16 s | 4.7 | 4.7 |
| Snipers v Mortar Crews | 100% | 0% | 0% | 10 s | 0.6 | 3.0 |
| Mortar mirror | 55% | 43% | 3% | 9 s | 2.2 | 2.3 |

### Equal cost

| Fight | Blue wins | Red wins | Draw | Avg length | Blue lost | Red lost |
| --- | --- | --- | --- | --- | --- | --- |
| 8 Riflemen v 3 Machine Gunners | 63% | 38% | 0% | 30 s | 3.2 | 1.9 |
| 8 Riflemen v 5 Snipers | 30% | 70% | 0% | 22 s | 6.7 | 2.5 |
| 8 Riflemen v 3 Mortar Crews | 8% | 93% | 0% | 16 s | 7.7 | 0.6 |
| 3 Machine Gunners v 5 Snipers | 0% | 100% | 0% | 10 s | 3.0 | 0.0 |

### Combined arms

| Fight | Blue wins | Red wins | Draw | Avg length | Blue lost | Red lost |
| --- | --- | --- | --- | --- | --- | --- |
| 1 MG + 4 Riflemen v 6 Riflemen | 85% | 15% | 0% | 34 s | 2.3 | 5.2 |
| 2 MG + 4 Riflemen v 7 Riflemen | 100% | 0% | 0% | 32 s | 1.1 | 7.0 |
| 5 Riflemen + Medic v 6 Riflemen | 35% | 65% | 0% | 28 s | 5.0 | 3.5 |
| Mixed company v 8 Riflemen (equal supply) | 100% | 0% | 0% | 26 s | 1.1 | 8.0 |
| 6 v 6 Riflemen, blue as a squadron | 63% | 38% | 0% | 28 s | 3.9 | 4.8 |
| Mixed company mirror, blue as a squadron | 45% | 55% | 0% | 26 s | 6.1 | 5.5 |

### Terrain (red holds)

| Fight | Blue wins | Red wins | Draw | Avg length | Blue lost | Red lost |
| --- | --- | --- | --- | --- | --- | --- |
| 5 v 5 Riflemen, red holding on flat ground | 15% | 85% | 0% | 28 s | 4.6 | 1.6 |
| 5 v 5 Riflemen, red on a hill 30 m higher | 0% | 100% | 0% | 16 s | 5.0 | 0.4 |
| 5 v 5 Riflemen, red at a forest edge | 5% | 95% | 0% | 29 s | 4.9 | 0.9 |
| 5 v 5 Riflemen, red deep inside a forest | 8% | 93% | 0% | 20 s | 4.8 | 1.5 |
| 7 Riflemen attack 5 at a forest edge | 95% | 3% | 3% | 32 s | 2.5 | 4.9 |
| 7 Riflemen attack 3 Riflemen + MG on a hill | 100% | 0% | 0% | 19 s | 0.7 | 4.0 |

### Fortifications

| Fight | Blue wins | Red wins | Draw | Avg length | Blue lost | Red lost |
| --- | --- | --- | --- | --- | --- | --- |
| 8 Riflemen attack 5 in the open | 100% | 0% | 0% | 23 s | 1.1 | 5.0 |
| 8 Riflemen attack 5 in a trench | 58% | 43% | 0% | 38 s | 5.6 | 3.8 |
| 8 grenadiers attack 5 in a trench | 98% | 3% | 0% | 10 s | 1.6 | 4.9 |
| 8 grenadiers attack 4 Riflemen + MG in a trench | 58% | 43% | 0% | 14 s | 4.7 | 3.5 |
| 6 Riflemen + 2 Mortars attack 5 in a trench | 100% | 0% | 0% | 22 s | 2.5 | 5.0 |
| 8 grenadiers assault a full Bunker | 68% | 33% | 0% | 17 s | 4.5 | 3.8 |
| 10 grenadiers assault a full Bunker | 100% | 0% | 0% | 8 s | 2.2 | 5.0 |

### Special situations

| Fight | Blue wins | Red wins | Draw | Avg length | Blue lost | Red lost |
| --- | --- | --- | --- | --- | --- | --- |
| 2 Snipers pick at 6 idle Riflemen (return fire) | 0% | 100% | 0% | 8 s | 2.0 | 0.9 |
| 2 Snipers against 6 Riflemen on Defend | 35% | 0% | 65% | 97 s | 0.0 | 5.3 |
| 3 Mortars + 3 Riflemen against an MG nest | 100% | 0% | 0% | 10 s | 0.3 | 4.0 |

## Sweeps

### 6 Riflemen v 3 Mortar Crews: starting distance

| Setup | Blue (attacker) wins | Red wins | Draw | Avg length |
| --- | --- | --- | --- | --- |
| 120 m | 17% | 83% | 0% | 13 s |
| 170 m | 10% | 90% | 0% | 12 s |
| 220 m | 0% | 100% | 0% | 12 s |
| 300 m | 0% | 100% | 0% | 13 s |

### Riflemen needed to beat 3 Machine Gunners

| Setup | Blue (attacker) wins | Red wins | Draw | Avg length |
| --- | --- | --- | --- | --- |
| 6 Riflemen | 7% | 93% | 0% | 32 s |
| 8 Riflemen | 60% | 40% | 0% | 31 s |
| 10 Riflemen | 100% | 0% | 0% | 17 s |
| 12 Riflemen | 100% | 0% | 0% | 13 s |

### Riflemen needed to beat 3 Snipers

| Setup | Blue (attacker) wins | Red wins | Draw | Avg length |
| --- | --- | --- | --- | --- |
| 4 Riflemen | 17% | 83% | 0% | 17 s |
| 6 Riflemen | 93% | 7% | 0% | 15 s |
| 8 Riflemen | 100% | 0% | 0% | 11 s |
| 10 Riflemen | 100% | 0% | 0% | 9 s |

### Attackers needed against 5 Riflemen at a forest edge

| Setup | Blue (attacker) wins | Red wins | Draw | Avg length |
| --- | --- | --- | --- | --- |
| 5 attackers | 7% | 93% | 0% | 30 s |
| 6 attackers | 20% | 77% | 3% | 40 s |
| 7 attackers | 97% | 0% | 3% | 34 s |
| 8 attackers | 97% | 0% | 3% | 31 s |
| 10 attackers | 100% | 0% | 0% | 21 s |

### Attackers needed against 5 Riflemen on a 30 m hill

| Setup | Blue (attacker) wins | Red wins | Draw | Avg length |
| --- | --- | --- | --- | --- |
| 5 attackers | 0% | 100% | 0% | 16 s |
| 6 attackers | 13% | 87% | 0% | 20 s |
| 7 attackers | 80% | 20% | 0% | 28 s |
| 8 attackers | 90% | 10% | 0% | 27 s |
| 10 attackers | 100% | 0% | 0% | 24 s |

### Attackers (no grenades) needed against 5 Riflemen in a trench

| Setup | Blue (attacker) wins | Red wins | Draw | Avg length |
| --- | --- | --- | --- | --- |
| 5 attackers | 7% | 93% | 0% | 34 s |
| 6 attackers | 7% | 93% | 0% | 39 s |
| 8 attackers | 60% | 40% | 0% | 38 s |
| 10 attackers | 100% | 0% | 0% | 22 s |

### Adding Machine Gunners to 4 Riflemen, against 7 Riflemen

| Setup | Blue (attacker) wins | Red wins | Draw | Avg length |
| --- | --- | --- | --- | --- |
| 0 MG | 0% | 100% | 0% | 18 s |
| 1 MG | 33% | 67% | 0% | 31 s |
| 2 MG | 100% | 0% | 0% | 31 s |
| 3 MG | 100% | 0% | 0% | 28 s |

### Grenadiers needed to take a full Bunker

| Setup | Blue (attacker) wins | Red wins | Draw | Avg length |
| --- | --- | --- | --- | --- |
| 6 grenadiers | 0% | 100% | 0% | 14 s |
| 8 grenadiers | 73% | 27% | 0% | 18 s |
| 10 grenadiers | 100% | 0% | 0% | 8 s |
| 12 grenadiers | 100% | 0% | 0% | 6 s |

## AI v AI, Highland Pass, 40 minute cap

| Difficulty | Seed | Result | Kills blue / red |
| --- | --- | --- | --- |
| easy | 1 | No HQ fell in 40 min | 62 / 61 |
| easy | 2 | No HQ fell in 40 min | 70 / 58 |
| normal | 1 | No HQ fell in 40 min | 126 / 107 |
| normal | 2 | No HQ fell in 40 min | 132 / 117 |
| hard | 1 | No HQ fell in 40 min | 173 / 166 |
| hard | 2 | Blue destroyed red's HQ at 28.3 min | 146 / 96 |
