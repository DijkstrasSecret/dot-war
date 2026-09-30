# Fight testing: patch 0.6, weather and night (30 September 2026)

47 set-piece fights × 40 runs (the 37 from before plus 10 new "Night and weather" fights), 6 AI
matches of 40 minutes and the Balance Lab snapshot, run in 11 minutes on 4 cores.

## The six things worth your attention

1. **"Only shoot what you can see" changes daytime fights the most.** Machine Gunners (range 200,
   sight 160) and Snipers (range 300, sight 230) reach farther than they see, so without scouts or
   towers they lose their range edge. At equal cost, 8 Riflemen now beat 3 Machine Gunners **93%**
   (was 63%) and 5 Snipers **75%** (was 30%). Two Snipers 280 m from Riflemen can't fire at all: both
   sniper tests are now draws. Machine Gunner v Mortars went from 100% to 55%. This is the rule working
   as agreed, but it makes Machine Gunners much weaker on their own; worth a look in play.
2. **Night shuts mortars down without a spotter.** Riflemen beat 3 Mortar Crews **100%** at night
   (18% by day); the same in fog. Flares and searchlights are the answer.
3. **Snipers still rule the night:** 6 Snipers beat 6 Riflemen 95% at night (their 115 m night sight
   still beats the Riflemen's 80 m).
4. **Terrain keeps its value.** A hill still wins 98% at night and in fog (the old note expected fog
   to pull the hill towards 50%; it doesn't). Snow favours defenders: 5 holding Riflemen beat 5
   attackers 93%.
5. **Rain changes little:** the Riflemen mirror stays even and a bit longer; mortars still win 88%.
6. **Two things were fixed along the way** before these numbers were taken: a defender just behind a
   crest couldn't shoot at attackers he clearly saw (attackers won the hill 98%), and whoever stood at
   the edge of a 12 m map cell was seen from farther than he could see back (it also made the 0.5e
   mortar mirror look lopsided; it's 50/50 again).

Unchanged: the Balance Lab targets (MG pin 4.9 s, height 74%, squadron 62%, first Tier II 1.5 min),
the economy, and the pressure on a player who stays home (HQ lost at 12.1 / 9.3 / 6.0 min).
AI-versus-AI matches still end in stalemates (no HQ fell in any of the six).

## All fights, 0.5e → 0.6

| Fight | 0.5e blue / red / draw | 0.6 blue / red / draw |
| --- | --- | --- |
| Riflemen mirror | 48% / 53% / 0% | 38% / 63% / 0% |
| Riflemen v Machine Gunners | 0% / 100% / 0% | 0% / 100% / 0% |
| Riflemen v Snipers | 0% / 100% / 0% | 0% / 100% / 0% |
| Riflemen v Mortar Crews | 18% / 83% / 0% | 18% / 83% / 0% |
| Riflemen spread 30 m apart v Mortar Crews | 35% / 65% / 0% | 25% / 75% / 0% |
| Machine Gunner mirror | 43% / 58% / 0% | 53% / 48% / 0% |
| Machine Gunners v Snipers | 45% / 55% / 0% | 33% / 68% / 0% |
| Machine Gunners v Mortar Crews | 100% / 0% / 0% | 55% / 45% / 0% |
| Sniper mirror | 53% / 48% / 0% | 58% / 43% / 0% |
| Snipers v Mortar Crews | 100% / 0% / 0% | 98% / 3% / 0% |
| Mortar mirror | 78% / 23% / 0% | 50% / 50% / 0% |
| 8 Riflemen v 3 Machine Gunners | 63% / 38% / 0% | 93% / 8% / 0% |
| 8 Riflemen v 5 Snipers | 30% / 70% / 0% | 75% / 25% / 0% |
| 8 Riflemen v 3 Mortar Crews | 38% / 63% / 0% | 43% / 58% / 0% |
| 3 Machine Gunners v 5 Snipers | 0% / 100% / 0% | 0% / 100% / 0% |
| 1 MG + 4 Riflemen v 6 Riflemen | 85% / 15% / 0% | 88% / 13% / 0% |
| 2 MG + 4 Riflemen v 7 Riflemen | 100% / 0% / 0% | 100% / 0% / 0% |
| 5 Riflemen + Medic v 6 Riflemen | 35% / 65% / 0% | 23% / 78% / 0% |
| Mixed company v 8 Riflemen (equal supply) | 100% / 0% / 0% | 98% / 3% / 0% |
| 6 v 6 Riflemen, blue as a squadron | 63% / 38% / 0% | 53% / 48% / 0% |
| Mixed company mirror, blue as a squadron | 48% / 53% / 0% | 33% / 68% / 0% |
| 5 v 5 Riflemen, red holding on flat ground | 15% / 85% / 0% | 15% / 85% / 0% |
| 5 v 5 Riflemen, red on a hill 30 m higher | 0% / 100% / 0% | 0% / 100% / 0% |
| 5 v 5 Riflemen, red at a forest edge | 5% / 95% / 0% | 5% / 95% / 0% |
| 5 v 5 Riflemen, red deep inside a forest | 8% / 93% / 0% | 8% / 93% / 0% |
| 7 Riflemen attack 5 at a forest edge | 95% / 3% / 3% | 93% / 5% / 3% |
| 7 Riflemen attack 3 Riflemen + MG on a hill | 100% / 0% / 0% | 100% / 0% / 0% |
| 8 Riflemen attack 5 in the open | 100% / 0% / 0% | 100% / 0% / 0% |
| 8 Riflemen attack 5 in a trench | 58% / 43% / 0% | 68% / 33% / 0% |
| 8 grenadiers attack 5 in a trench | 98% / 3% / 0% | 100% / 0% / 0% |
| 8 grenadiers attack 4 Riflemen + MG in a trench | 58% / 43% / 0% | 60% / 40% / 0% |
| 6 Riflemen + 2 Mortars attack 5 in a trench | 100% / 0% / 0% | 100% / 0% / 0% |
| 8 grenadiers assault a full Bunker | 68% / 33% / 0% | 65% / 35% / 0% |
| 10 grenadiers assault a full Bunker | 100% / 0% / 0% | 93% / 8% / 0% |
| 2 Snipers pick at 6 idle Riflemen (return fire) | 0% / 100% / 0% | 0% / 0% / 100% |
| 2 Snipers against 6 Riflemen on Defend | 35% / 0% / 65% | 0% / 0% / 100% |
| Riflemen mirror at night | new | 53% / 48% / 0% |
| Riflemen v Snipers at night | new | 5% / 95% / 0% |
| Riflemen v Mortar Crews at night | new | 100% / 0% / 0% |
| 1 MG + 4 Riflemen v 6 Riflemen at night | new | 65% / 35% / 0% |
| 5 v 5 Riflemen, red on a hill, at night | new | 3% / 98% / 0% |
| Riflemen v Mortar Crews in fog | new | 100% / 0% / 0% |
| 5 v 5 Riflemen, red on a hill, in fog | new | 3% / 98% / 0% |
| Riflemen mirror in rain | new | 55% / 45% / 0% |
| Riflemen v Mortar Crews in rain | new | 13% / 88% / 0% |
| 5 v 5 Riflemen, red holding, in snow | new | 8% / 93% / 0% |
| 3 Mortars + 3 Riflemen against an MG nest | 100% / 0% / 0% | 100% / 0% / 0% |

## Videos

| File | What's inside | Length |
| --- | --- | --- |
| [Dot-War-fights-1-Night-and-weather.mp4](videos/Dot-War-fights-1-Night-and-weather.mp4) | The 10 new fights at night, in fog, rain and snow, one game second per video second | 5.5 min |
| [Dot-War-AI-match-normal-seed1-8x.mp4](videos/Dot-War-AI-match-normal-seed1-8x.mp4) | AI v AI on Normal, 30 minutes at 8×: rain arrives at 10 minutes with the first night, snow at 22, the second night at 25 | 4 min |

Raw numbers: [data/](data/).
