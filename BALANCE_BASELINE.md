# Balance baseline: patch 0.5e

The state of the game's balance after patches 0.5c (Machine Gunner rework, forest edge cover, mortar
minimum range 150 m), 0.5d (a smarter enemy) and 0.5e (faster fog of war), measured before weather
and night (patch 0.6). Every number comes from the Balance Lab's **Meta snapshot** (`lab.html`, "Run
the meta snapshot", or `node fight-tests/tools/meta.js <patch>`), with seeded runs so it can be
repeated exactly. The raw numbers are saved in `lab/meta-baseline.js`; the lab shows every new result
next to them. It replaced the 0.5b.1 baseline with Kaan's agreement (30 September 2026). Replace it
only when Kaan agrees.

How to read it: "A wins 63%" means side A won 63 of 100 fights (30 runs per duel unless noted). For
bigger, recorded fight tests (37 set-pieces × 40 runs, with videos) see `fight-tests/`.

## 1. Equal-supply duels on flat ground

Six of each soldier against six of another, or three Mortar Crews (supply 2 each). Both sides
attack-move at each other from 110 m. Equal supply is **not** equal cost: a Machine Gunner costs
15 wood + 45 metal, a Rifleman 12 wood + 10 metal.

| A | B | A wins | B wins | Draw | Avg fight |
| --- | --- | --- | --- | --- | --- |
| 6 Riflemen | 6 Riflemen | 50% | 50% | 0% | 19 s |
| 6 Riflemen | 6 Machine Gunners | 0% | 90% | 10% | 36 s |
| 6 Riflemen | 6 Snipers | 10% | 90% | 0% | 12 s |
| 6 Riflemen | 3 Mortar Crews | 63% | 37% | 0% | 12 s |
| 6 Machine Gunners | 6 Machine Gunners | 13% | 17% | 70% | 149 s |
| 6 Machine Gunners | 6 Snipers | 67% | 33% | 0% | 12 s |
| 6 Machine Gunners | 3 Mortar Crews | 100% | 0% | 0% | 16 s |
| 6 Snipers | 6 Snipers | 63% | 37% | 0% | 6 s |
| 6 Snipers | 3 Mortar Crews | 90% | 10% | 0% | 5 s |
| 3 Mortar Crews | 3 Mortar Crews | 60% | 37% | 3% | 7 s |

**What it says:** the Machine Gunner wins by pinning, slowly; two groups of only Machine Gunners pin
each other and rarely finish. Snipers beat Riflemen and Mortars. At 110 m the Riflemen get inside the
mortars' 150 m minimum range quickly and win; from farther away the mortars win (see
`fight-tests/0.5c`: 98% from 220 m, 23% for Riflemen spread 30 m apart). Mirror results between 37%
and 63% are within chance for 30 runs.

## 2. Terrain, squads and suppression (50 runs)

| Test | Result | Target |
| --- | --- | --- |
| 5 v 5 Riflemen, flat | 50% / 50% | — |
| Side B 30 m higher | B wins 74% | 65–80% (green) |
| Side B inside a forest strip (edge cover 0.75) | B wins 86% | — |
| 6 v 6, side A as a squadron | A wins 62% (the lab's target run: 59%) | 55–60% |
| 1 Machine Gunner pins a Rifleman | 4.9 s | 3.5–5.5 s (green) |

## 3. Fortifications (30 runs)

| Test | Attackers win | Avg fight |
| --- | --- | --- |
| 8 Riflemen attack 5 in the open | 100% | 17 s |
| 8 Riflemen attack 5 in a trench | 70% | 25 s |
| 8 with grenades attack 5 in a trench | 100% | 8 s |
| 8 grenadiers assault a full Bunker (5 inside: 4 Riflemen + 1 MG) | 70% | 16 s |
| 10 grenadiers assault a full Bunker (5 inside) | 97% | 7 s |

## 4. Economy (standard opening, Highland Pass)

A Lumber Camp and a Mine with two Workers each, Workers trained up to eight, nothing else bought,
at the 0.7 pace with carriers walking to the HQ.

| Time | Wood | Metal |
| --- | --- | --- |
| First Tier II research affordable | 1.5 min | (target 1–3 min, green) |
| 5 min | 856 | 371 |
| 10 min | 1564 | 768 |
| 15 min | 2281 | 1169 |
| 20 min | 2997 | 1567 |

## 5. Enemy pressure on a player who stays home

Highland Pass, seed 1. The player keeps the starting 6 Riflemen and 4 Workers at home and orders
nothing; they only fight what comes into range.

| Difficulty | Enemy army at start → 6 min | First enemy within 500 m of the HQ | HQ destroyed |
| --- | --- | --- | --- |
| Easy | 6 → 10 | 9.4 min | 11.9 min |
| Normal | 9 → 13 | 6.3 min | 9.3 min |
| Hard | 12 → 16 | 4.8 min | 5.8 min |

**What it says:** the first raid now comes by difficulty (about 8, 5 and 3.5 minutes after the
enemy's walk). A player who does nothing loses the HQ within two to three minutes of the first raid,
so a real defence is needed by minute 9 on Easy, 6 on Normal and under 5 on Hard.

## History

- **0.5b.1 → 0.5c:** Machine Gunners stopped winning everything (6 Riflemen v 6 MG: MG 100% in 8 s →
  90% in 36 s); Bunkers got easier to take (8 grenadiers 13% → 70%); forests stopped being fortresses
  (100% → 86%); raids started coming by difficulty.
- **0.5c → 0.5e:** the faster fog moved only the mortar duels (Riflemen v Mortars 57% → 63%; the
  mortar mirror swapped sides within chance) and Normal pressure (HQ falls at 9.3 min; 8.5 in 0.5c and 8.0 with
  0.5d on the exact fog). Everything else came out identical.

## Patch 0.6 against this baseline

The Meta snapshot on 0.6 (daytime, clear weather) matches the baseline everywhere except three duels
at 110 m: the Machine Gunner mirror (13/17/70 → 30/57/13, fewer stalemates now that they must see
each other), Machine Gunners v Mortars (100% → 97%) and the mortar mirror (within chance). The bigger
effects of "only shoot what you can see" show at longer range; see `fight-tests/0.6`.

## What 0.6 did to the things we watched

- Night hurt Mortars most, as expected (Riflemen beat them 100% at night), but not Snipers: they still
  beat Riflemen 95% at night.
- Fog did **not** pull the hill duel towards 50%: the hill still wins 98% (the defenders are close
  enough to see anyway).
- Rain lengthened fights a little (Riflemen mirror 27 → 32 s).

## Things to watch when 0.6 arrives (written before 0.6)

- Night (vision ×0.5, firing reveals the shooter) should hurt Snipers and Mortars most: compare
  sections 1 and 2.
- Fog (vision ×0.6) should shorten how far Mortars can fire usefully and blunt height: the "30 m
  higher" duel should move towards 50%.
- Rain (movement ×0.8, accuracy ×0.9) should lengthen fights and slow raids: compare "first enemy
  within 500 m" in section 5.
