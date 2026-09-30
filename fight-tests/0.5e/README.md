# Fight testing: patch 0.5e, faster simulation (30 September 2026)

Patch 0.5e made the simulation about **4.7× faster** by changing how fog of war is worked out: a
soldier now sees from the centre of the 12 m map cell he stands in, and soldiers in the same cell
share one calculation. The test tools also run on all CPU cores now. This whole set (37 fights × 40
runs, 6 AI matches of 40 minutes, the Balance Lab snapshot) took **8 minutes**; the same work took
about 3 hours before.

## What changed

**31 of the 37 fights came out exactly the same, seed for seed.** Only fights with Mortar Crews moved,
because mortars fire at whatever the fog shows, so the edge of vision matters to them:

| Fight | 0.5c | 0.5e |
| --- | --- | --- |
| 6 Riflemen v 3 Mortar Crews (220 m) | mortars 98% | mortars 83% |
| Riflemen spread 30 m apart v Mortar Crews | mortars 78% | mortars 65% |
| 8 Riflemen v 3 Mortar Crews (equal cost) | mortars 93% | mortars 63% |
| 6 Machine Gunners v 3 Mortar Crews | MG 95% | MG 100% |
| Mortar mirror | 55 / 43 | 78 / 23 |
| Mixed company mirror, blue as a squadron | 45 / 55 | 48 / 53 |

- Mortars are **less dominant at range** than in 0.5c, which softens the biggest finding of the 0.5c
  report. They still win most fights against Riflemen in the open.
- The **mortar mirror is now lopsided** (78/23). In this set-piece both sides stand still at fixed
  spots, and seeing from the cell centre puts one side's eyes a few metres better placed. In real
  games positions vary, so this should even out; worth a look if mortar duels feel one-sided.
- Balance Lab targets are unchanged (MG pin 4.9 s, height 74%, squadron 62%, first Tier II 1.5 min),
  and the new baseline is in `BALANCE_BASELINE.md`.

## AI v AI, Highland Pass, 40 minute cap

| Difficulty | Seed | Result | Kills blue / red |
| --- | --- | --- | --- |
| Easy | 1 | Blue destroyed red's HQ at 36.3 min | 60 / 33 |
| Easy | 2 | No HQ fell in 40 min | 59 / 28 |
| Normal | 1 | No HQ fell in 40 min | 118 / 100 |
| Normal | 2 | No HQ fell in 40 min | 93 / 107 |
| Hard | 1 | No HQ fell in 40 min | 133 / 120 |
| Hard | 2 | No HQ fell in 40 min | 142 / 118 |

## Data

[data/](data/): `fights-batch.json` (every fight), `ai-stats.json`, `meta.json` (the Balance Lab
snapshot, now the baseline). The fights look the same as in the [0.5c videos](../0.5c/README.md), so
no new videos were recorded.
