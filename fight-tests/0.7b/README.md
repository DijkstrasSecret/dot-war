# Patch 0.7b: living infantry, fight tests (1 October 2026)

## In plain words

- **Every new behaviour works** in its own staged test (Balance Lab, "Living infantry"): the wounded
  fall back and keep firing, walk to a Medic and come back healed, soldiers keep apart and spread out
  after a shell, move up to help a comrade, step into cover, walk back to their post, and the wounded
  take a squadron's rear rank.
- **Head-on fights barely changed.** When both sides attack-move into each other (most of the
  recorded fights), 15 of 16 fights finish as before, within chance. The behaviours show most when
  soldiers stand, hold a position or get wounded mid-fight.
- **The mixed company fights better as a squadron:** the mirror with blue as a squadron went from
  32% to 55% for blue.
- **Mortars are not much weaker yet.** A shell still catches about 2.3 soldiers on average (2.3
  before). The blast is 32 m in radius and attackers bunch up as they walk in. Wider gaps would only
  bring it to about 2.0 (tested: 18 m / 24 m gaps). If mortars should hurt groups much less, a
  different tool would do it better (for example "hit the dirt": soldiers who hear a shell go prone
  and take less blast damage). That would be a new decision for Kaan.
- **Balance Lab targets:** MG pin 4.9 s (green); hill 65% (green, at the bottom edge); squadron v
  loose **63% (red, target 55–60%)**. Over 300 runs instead of 100 they come to 68% and 59%, both
  inside, so the red is most likely chance. Reported, not retuned.

## Videos (one game second per video second; spectator view, blobs show the squadrons)

| Video | Fight | Result |
| --- | --- | --- |
| `videos/squad-v-loose-seed3.mp4` | 6 v 6 Riflemen, blue as a squadron (typical seed) | blue wins in 25 s, 3 standing |
| `videos/mixed-squads-seed16.mp4` | Mixed company mirror, blue as a squadron (typical seed) | blue wins in 25 s, 4 standing |
| `videos/riflemen-v-mortars-seed25.mp4` | Riflemen attack Mortar Crews (typical seed) | the mortars win in 16 s |

## Behaviour checks (Balance Lab, seed 1)

| Check | Result | Measured |
| --- | --- | --- |
| Wounded fall back behind the healthy ones | pass | 22 m further from the enemy than the others |
| Wounded walk to a Medic within 300 m and return healed | pass | health 100%, 13 m from his post |
| Soldiers keep a personal gap (12 m outside a squadron) | pass | closest pair 14 m |
| After a nearby shell the gap grows ×1.5 | pass | closest pair 18 m |
| A soldier moves up to help a teammate under fire | pass | 210 m → 153 m from the shooter (range 170 m) |
| Under fire, a soldier steps into nearby cover | pass | into the forest |
| A soldier drawn away walks back to his post when it is quiet | pass | 6 m from his post |
| In a squadron the wounded take the rear rank | pass | −50 m, the others from −25 m |

## Fights, 40 runs each: 0.7a → 0.7b (side A wins / B wins, average length)

| Fight | 0.7a | 0.7b |
| --- | --- | --- |
| 6 v 6 Riflemen | 38 / 63, 27 s | 38 / 63, 27 s |
| 6 Riflemen v 6 MG | 0 / 100, 30 s | 0 / 100, 29 s |
| 6 Riflemen v 3 Mortars | 18 / 83, 14 s | 20 / 80, 15 s |
| 6 Riflemen (spread 30 m) v 3 Mortars | 25 / 75, 15 s | 28 / 73, 15 s |
| 3 v 3 Mortars | 50 / 50, 11 s | 53 / 48, 11 s |
| 5 Riflemen + Medic v 6 Riflemen | 23 / 78, 27 s | 20 / 80, 27 s |
| 6 v 6 Riflemen, A as a squadron | 53 / 48, 27 s | 50 / 50, 26 s |
| Mixed company mirror, A as a squadron | **33 / 68, 23 s** | **55 / 45, 24 s** |
| Hill | 0 / 100, 15 s | 0 / 100, 15 s |
| Forest edge | 5 / 95, 27 s | 5 / 95, 27 s |
| 8 attack 5 in a trench | 68 / 33, 31 s | 68 / 33, 31 s |
| Trench v mortars | 100 / 0, 22 s | 100 / 0, 22 s |
| Equal-cost Riflemen v Mortars | 43 / 58, 15 s | 43 / 58, 18 s |
| Sniper v idle Riflemen | draw 100% | draw 100% |
| Mortar nest | 100 / 0, 9 s | 100 / 0, 9 s |
| 6 v 6 Riflemen at night | 53 / 48, 20 s | 55 / 45, 20 s |

## Soldiers inside a mortar blast, per shell (20 runs)

| Fight | 0.7a | 0.7b |
| --- | --- | --- |
| 6 Riflemen v 3 Mortars | 2.34 | 2.26 |
| Equal-cost Riflemen v Mortars | 3.26 | 3.24 |
| Mortar nest | 2.59 | 2.63 |
| Trench v mortars | 1.70 | 1.70 |

## Speed

A 14-minute Hard AI match on a big map took 42.5 s of computing (38.9 s in 0.7a), about 9% more.
