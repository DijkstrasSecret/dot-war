# Balance baseline: patch 0.5b.1

The state of the game's balance after patch 0.5b.1 and its audit, measured before weather and night
(patch 0.6). Every number comes from the Balance Lab's **Meta snapshot** (`lab.html`, "Run the meta
snapshot"), with seeded runs so it can be repeated exactly. The raw numbers are saved in
`lab/meta-baseline.js`; the lab shows every new result next to them. Replace the baseline only when
Kaan agrees.

How to read it: "A wins 63%" means side A won 63 of 100 fights (30 runs per duel unless noted).

## 1. Equal-supply duels on flat ground

Six of each soldier against six of another, or three Mortar Crews (supply 2 each). Both sides
attack-move at each other from 110 m. Equal supply is **not** equal cost: a Machine Gunner costs
10 wood + 35 metal, a Rifleman 12 wood + 10 metal.

| A | B | A wins | B wins | Avg fight |
| --- | --- | --- | --- | --- |
| 6 Riflemen | 6 Riflemen | 50% | 50% | 19 s |
| 6 Riflemen | 6 Machine Gunners | 0% | 100% | 8 s |
| 6 Riflemen | 6 Snipers | 10% | 90% | 12 s |
| 6 Riflemen | 3 Mortar Crews | 33% | 67% | 11 s |
| 6 Machine Gunners | 6 Machine Gunners | 63% | 33% (3% draw) | 25 s |
| 6 Machine Gunners | 6 Snipers | 97% | 3% | 6 s |
| 6 Machine Gunners | 3 Mortar Crews | 100% | 0% | 4 s |
| 6 Snipers | 6 Snipers | 63% | 37% | 6 s |
| 6 Snipers | 3 Mortar Crews | 87% | 13% | 6 s |
| 3 Mortar Crews | 3 Mortar Crews | 53% | 47% | 3 s |

**What it says:** at 110 m the Machine Gunner is the strongest unit per supply point by far; it
beats everything, the Sniper included. Snipers beat Riflemen and Mortars. Mortars at this short
range (just past their 90 m minimum) do well against Riflemen but lose to anything faster-killing.
The mirror matches near 50% show the test is fair (60–63% in 30 runs is within chance).

## 2. Terrain, squads and suppression (50 runs)

| Test | Result | Target |
| --- | --- | --- |
| 5 v 5 Riflemen, flat | 50% / 50% | — |
| Side B 30 m higher | B wins 74% | 65–80% (green) |
| Side B inside a forest strip | B wins 100% | — |
| 6 v 6, side A as a squadron | A wins 62% (the lab's target run: 59%) | 55–60% |
| 1 Machine Gunner pins a Rifleman | 4.9 s | 3.5–5.5 s (green) |

**What it says:** forest is decisive for the defender (cover 0.55 plus hiding); height is strong
but beatable; squadrons give a small edge.

## 3. Fortifications (30 runs)

| Test | Attackers win | Avg fight |
| --- | --- | --- |
| 8 Riflemen attack 5 in the open | 100% | 17 s |
| 8 Riflemen attack 5 in a trench | 70% | 25 s |
| 8 with grenades attack 5 in a trench | 100% | 8 s |
| 8 grenadiers assault a full Bunker (5 inside: 4 Riflemen + 1 MG) | 13% | 17 s |
| 10 grenadiers assault a full Bunker (5 inside) | 97% | 6 s |

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
| Easy | 6 → 10 | 6.3 min | 8.5 min |
| Normal | 9 → 13 | 6.3 min | 8.1 min |
| Hard | 12 → 16 | 6.3 min | 7.5 min |

**What it says:** the first raid arrives at the same time on every difficulty (walking time plus
five minutes of build-up); what differs is its size. A player who does nothing loses the HQ in about
two minutes of siege, because the raid's Mortar Crews outrange idle Riflemen. So by minute 6 a
player needs a real defence.

## Patch 0.5c against this baseline

The same snapshot after 0.5c (Machine Gunner damage 6 with wider suppression, forest edge cover 0.75,
mortar minimum range 150 m, raid build-up by difficulty). The baseline above is kept until Kaan agrees
to replace it. Everything not listed stayed the same, including all the lab targets (height 74%,
squadron 62%, MG pin 4.9 s, first Tier II at 1.5 min).

| Test | 0.5b.1 | 0.5c |
| --- | --- | --- |
| 6 Riflemen v 6 Machine Gunners | MG 100%, 8 s | MG 90%, 10% draw, 36 s |
| 6 Machine Gunners v 6 Machine Gunners | 63 / 33, 25 s | **70% draw** (both pinned for 3 min), 149 s |
| 6 Machine Gunners v 6 Snipers | MG 97% | MG 67% |
| 6 Machine Gunners v 3 Mortar Crews | MG 100%, 4 s | MG 100%, 16 s |
| 6 Riflemen v 3 Mortar Crews | Riflemen 33% | Riflemen 57% |
| 3 Mortar Crews v 3 Mortar Crews | 53 / 47 | 37 / 60 (within chance) |
| 5 v 5, B inside a forest | B 100% | B 86% |
| 8 grenadiers v full Bunker (4 Riflemen + 1 MG) | attackers 13% | **attackers 70%** |
| First enemy within 500 m of the HQ, Easy / Normal / Hard | 6.3 / 6.3 / 6.3 min | 9.4 / 6.3 / 4.8 min |
| HQ destroyed, Easy / Normal / Hard | 8.5 / 8.1 / 7.5 min | 12.0 / 8.5 / 6.1 min |

**What it says:** the Machine Gunner is no longer the best unit at everything; it wins by pinning,
slowly. Two groups of only Machine Gunners pin each other and rarely finish the fight. A Bunker is
much easier to take now, because its Machine Gunner no longer kills the attackers fast. Forests
still favour the defender, but they can be taken. Raids now come early on Hard and late on Easy.

## Things to watch when 0.6 arrives

- Night (vision ×0.5, firing reveals the shooter) should hurt Snipers and Mortars most: compare
  sections 1 and 2.
- Fog (vision ×0.6) should shorten how far Mortars can fire usefully and blunt height: the "30 m
  higher" duel should move towards 50%.
- Rain (movement ×0.8, accuracy ×0.9) should lengthen fights and slow raids: compare "first enemy
  within 500 m" in section 5.
