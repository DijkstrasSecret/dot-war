# Patch 0.8: Field Gun, armoured car, AT Rifles (1 October 2026)

## In plain words

- **The armoured car rules open ground against infantry without anti-tank support.**
  - It beats 6 Riflemen 89% of the time and 3 Machine Gunners every time: light armour takes only 35%
    from bullets.
  - With 4 Riflemen beside it, it beats 7 Riflemen every time.
  - This is the role the design gives it ("chasing down infantry in the open").
- **The AT Rifle team is the answer to it.**
  - Two teams beat a car 71% of the time; one team with 2 Riflemen 56%.
  - Three teams still lose to 6 Riflemen (2%), so they are specialists.
  - My first numbers (70 damage, accuracy 0.6, 4 s reload) lost to the car 93% of the time, because the
    car's MG pinned them. The team now does 90 damage, accuracy 0.7, 3 s reload, and takes half the
    usual stress (`DESIGN_DECISIONS.md`, "Patch 0.8").
- **The Field Gun cracks trenches.** 6 Riflemen with a Field Gun take a trench of 5 in 94% of fights
  (8 Riflemen without one: 67%).
  - Against 2 Mortar Crews and 6 Riflemen at 320 m it is about even (45%): inside its 200 m minimum
    range it can't help.
- **All Balance Lab targets stay green.** The new units change nothing in the old fights unless they
  take part.

## Fights (100 runs each)

| Fight | Blue wins | Red wins | Avg |
| --- | --- | --- | --- |
| 1 Armoured Car v 6 Riflemen | 89% | 11% | 31 s |
| 1 Armoured Car v 3 Machine Gunners | 100% | 0% | 20 s |
| 1 Armoured Car v 2 AT Rifle teams | 29% | 71% | 9 s |
| 1 Armoured Car v 1 AT Rifle team + 2 Riflemen | 43% | 56% | 15 s |
| 3 AT Rifle teams v 6 Riflemen | 2% | 98% | 12 s |
| Armoured Car + 4 Riflemen v 7 Riflemen | 100% | 0% | 21 s |
| 6 Riflemen + a Field Gun attack 5 in a trench | 94% | 6% | 30 s |
| 6 Riflemen + a Field Gun v 6 Riflemen + 2 Mortars | 45% | 55% | 32 s |

## Checks (Balance Lab, "Artillery and vehicles")

All 6 pass:
- Scout Tower level 4 needs Artillery.
- A Field Gun shells a spotted enemy 600 m away (4 sulfur a shell).
- Counter-battery reveals a firing mortar.
- The car takes no passengers and burns fuel.
- AP does full damage to light armour.
- The enemy trains Field Guns after their unlock time.

## Files

- `data/fights-batch.json`: the 8 fights.
- `videos/Dot-War-fights-1-Artillery-and-vehicles.mp4`: each fight's typical outcome (and the other
  outcome when it happens at least 15% of the time).
